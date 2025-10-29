import { ActivityFeedActions, ActivityFeedEventTypes, GroupDTO, amountToSmallestUnit, GroupId, GroupMembershipDTO, MemberRole, MemberRoles, MemberStatuses, MessageResponse, UserId } from '@splitifyd/shared';
import { toISOString } from '@splitifyd/shared';
import { FirestoreCollections, HTTP_STATUS } from '../constants';
import { FieldValue } from '../firestore-wrapper';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ApiError, Errors } from '../utils/errors';
import { newTopLevelMembershipDocId } from '../utils/idGenerator';
import { ActivityFeedService } from './ActivityFeedService';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';
import { GroupTransactionContext, GroupTransactionManager, GroupTransactionOptions } from './transactions/GroupTransactionManager';

type AccessContextOptions = {
    notFoundErrorFactory?: () => Error;
    forbiddenErrorFactory?: () => Error;
};

type AdminGuardOptions = {
    unauthorizedErrorFactory?: () => Error;
    forbiddenErrorFactory?: () => Error;
};

export class GroupMemberService {
    private readonly groupTransactionManager: GroupTransactionManager;

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly activityFeedService: ActivityFeedService,
        groupTransactionManager?: GroupTransactionManager,
    ) {
        this.groupTransactionManager = groupTransactionManager ?? new GroupTransactionManager(this.firestoreReader, this.firestoreWriter);
    }

    async ensureActiveGroupAdmin(
        groupId: GroupId,
        userId: UserId | null | undefined,
        options: AdminGuardOptions = {},
    ): Promise<GroupMembershipDTO> {
        if (!userId) {
            throw options.unauthorizedErrorFactory?.() ?? Errors.UNAUTHORIZED();
        }

        const membership = await this.firestoreReader.getGroupMember(groupId, userId);

        if (!membership || membership.memberRole !== MemberRoles.ADMIN || membership.memberStatus !== MemberStatuses.ACTIVE) {
            throw options.forbiddenErrorFactory?.() ?? Errors.FORBIDDEN();
        }

        return membership;
    }

    async getGroupAdminContext(
        groupId: GroupId,
        userId: UserId,
        options: AccessContextOptions = {},
    ): Promise<{
        group: GroupDTO;
        memberIds: UserId[];
        actorMember: GroupMembershipDTO;
    }> {
        const context = await this.getGroupAccessContext(groupId, userId, options);

        if (context.actorMember.memberRole !== MemberRoles.ADMIN || context.actorMember.memberStatus !== MemberStatuses.ACTIVE) {
            throw options.forbiddenErrorFactory?.() ?? Errors.FORBIDDEN();
        }

        return {
            group: context.group,
            memberIds: context.memberIds,
            actorMember: context.actorMember,
        };
    }

    private async runMembershipTransaction<T>(
        groupId: GroupId,
        executor: (context: GroupTransactionContext) => Promise<T>,
        options: GroupTransactionOptions = {},
    ): Promise<T> {
        const mergedOptions: GroupTransactionOptions = {
            preloadBalance: false,
            requireGroup: false,
            ...options,
        };

        return this.groupTransactionManager.run(groupId, mergedOptions, executor);
    }

    async getGroupAccessContext(
        groupId: GroupId,
        userId: UserId,
        options: AccessContextOptions = {},
    ): Promise<{
        group: GroupDTO;
        memberIds: UserId[];
        actorMember: GroupMembershipDTO;
    }> {
        const [group, memberIds, actorMember] = await Promise.all([
            this.firestoreReader.getGroup(groupId),
            this.firestoreReader.getAllGroupMemberIds(groupId),
            this.firestoreReader.getGroupMember(groupId, userId),
        ]);

        if (!group) {
            throw options.notFoundErrorFactory?.() ?? Errors.NOT_FOUND('Group');
        }

        if (!actorMember || !memberIds.includes(userId)) {
            throw options.forbiddenErrorFactory?.() ?? Errors.FORBIDDEN();
        }

        const normalizedDisplayName = actorMember.groupDisplayName?.trim();
        if (!normalizedDisplayName) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'GROUP_DISPLAY_NAME_MISSING',
                'Group member is missing required display name',
            );
        }

        actorMember.groupDisplayName = normalizedDisplayName;

        return {
            group,
            memberIds,
            actorMember,
        };
    }

    async leaveGroup(userId: UserId, groupId: GroupId): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.leaveGroup', async () => this._removeMemberFromGroup(userId, groupId, userId, true));
    }

    async removeGroupMember(userId: UserId, groupId: GroupId, memberId: UserId): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.removeGroupMember', async () => this._removeMemberFromGroup(userId, groupId, memberId, false));
    }

    async updateMemberRole(requestingUserId: UserId, groupId: GroupId, targetUserId: UserId, newRole: MemberRole): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.updateMemberRole', async () => {
            if (!targetUserId) {
                throw Errors.MISSING_FIELD('memberId');
            }

            await this.ensureActiveGroupAdmin(groupId, requestingUserId);

            const [targetMembership, allMembers] = await Promise.all([
                this.firestoreReader.getGroupMember(groupId, targetUserId),
                this.firestoreReader.getAllGroupMembers(groupId),
            ]);

            if (!targetMembership) {
                throw Errors.NOT_FOUND('Group member');
            }

            if (targetMembership.memberRole === newRole) {
                return { message: 'Member role unchanged' };
            }

            if (targetMembership.memberRole === MemberRoles.ADMIN && newRole !== MemberRoles.ADMIN) {
                const activeAdminCount = allMembers.filter((member) => member.memberRole === MemberRoles.ADMIN && member.memberStatus === MemberStatuses.ACTIVE).length;
                if (activeAdminCount <= 1) {
                    throw Errors.INVALID_INPUT({ message: 'Cannot remove the last active admin from the group' });
                }
            }

            await this.runMembershipTransaction(groupId, async (context) => {
                const transaction = context.transaction;
                const membershipDocId = newTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.NOT_FOUND('Group member');
                }

                transaction.update(membershipRef, {
                    memberRole: newRole,
                    groupUpdatedAt: FieldValue.serverTimestamp(),
                });

                await context.touchGroup();
            });

            LoggerContext.setBusinessContext({ groupId });
            logger.info('group-member-role-updated', {
                groupId,
                targetUserId,
                newRole,
            });

            return { message: 'Member role updated successfully' };
        });
    }

    async approveMember(requestingUserId: UserId, groupId: GroupId, targetUserId: UserId): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.approveMember', async () => {
            if (!targetUserId) {
                throw Errors.MISSING_FIELD('memberId');
            }

            await this.ensureActiveGroupAdmin(groupId, requestingUserId);

            const [targetMembership, group] = await Promise.all([
                this.firestoreReader.getGroupMember(groupId, targetUserId),
                this.firestoreReader.getGroup(groupId),
            ]);

            if (!targetMembership) {
                throw Errors.NOT_FOUND('Group member');
            }

            if (targetMembership.memberStatus === MemberStatuses.ACTIVE) {
                return { message: 'Member is already active' };
            }

            if (!group) {
                throw Errors.NOT_FOUND('Group');
            }

            const actorDisplayName = targetMembership.groupDisplayName?.trim();
            if (!actorDisplayName) {
                throw new ApiError(
                    HTTP_STATUS.INTERNAL_ERROR,
                    'GROUP_DISPLAY_NAME_MISSING',
                    'Group member is missing required display name',
                );
            }
            const now = toISOString(new Date().toISOString());

            await this.runMembershipTransaction(groupId, async (context) => {
                const transaction = context.transaction;
                const membershipDocId = newTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.NOT_FOUND('Group member');
                }

                const membershipsSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);
                const activityRecipients = new Set<UserId>();
                for (const doc of membershipsSnapshot.docs) {
                    const data = doc.data() as { uid: UserId; memberStatus: string; };
                    if (data.memberStatus === MemberStatuses.ACTIVE) {
                        activityRecipients.add(data.uid);
                    }
                }
                activityRecipients.add(targetUserId);

                const recipientIds = Array.from(activityRecipients);

                transaction.update(membershipRef, {
                    memberStatus: MemberStatuses.ACTIVE,
                    groupUpdatedAt: FieldValue.serverTimestamp(),
                });

                await context.touchGroup();

                if (recipientIds.length > 0) {
                    const activityItem = this.activityFeedService.buildGroupActivityItem({
                        groupId,
                        groupName: group.name,
                        eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                        action: ActivityFeedActions.JOIN,
                        actorId: targetUserId,
                        actorName: actorDisplayName,
                        timestamp: now,
                        details: this.activityFeedService.buildDetails({
                            targetUser: {
                                id: targetUserId,
                                name: actorDisplayName,
                            },
                        }),
                    });

                    this.activityFeedService.recordActivityForUsers(transaction, recipientIds, activityItem);
                }
            });

            LoggerContext.setBusinessContext({ groupId });
            logger.info('group-member-approved', {
                groupId,
                targetUserId,
            });

            return { message: 'Member approved successfully' };
        });
    }

    async rejectMember(requestingUserId: UserId, groupId: GroupId, targetUserId: UserId): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.rejectMember', async () => {
            if (!targetUserId) {
                throw Errors.MISSING_FIELD('memberId');
            }

            await this.ensureActiveGroupAdmin(groupId, requestingUserId);

            const targetMembership = await this.firestoreReader.getGroupMember(groupId, targetUserId);
            if (!targetMembership) {
                throw Errors.NOT_FOUND('Group member');
            }

            await this.runMembershipTransaction(groupId, async (context) => {
                const transaction = context.transaction;
                const membershipDocId = newTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.NOT_FOUND('Group member');
                }

                transaction.delete(membershipRef);
                await context.touchGroup();
            });

            LoggerContext.setBusinessContext({ groupId });
            logger.info('group-member-rejected', {
                groupId,
                targetUserId,
            });

            return { message: 'Member rejected successfully' };
        });
    }

    async getPendingMembers(requestingUserId: UserId, groupId: GroupId): Promise<GroupMembershipDTO[]> {
        return measure.measureDb('GroupMemberService.getPendingMembers', async () => {
            await this.ensureActiveGroupAdmin(groupId, requestingUserId);

            const members = await this.firestoreReader.getAllGroupMembers(groupId);
            return members.filter((member) => member.memberStatus === MemberStatuses.PENDING);
        });
    }

    /**
     * Unified method to handle both self-leaving and admin removal of members
     * @param requestingUserId - The user making the request
     * @param groupId - The group ID
     * @param targetUserId - The user being removed (could be same as requesting user for leave)
     * @param isLeaving - true for self-leave, false for admin removal
     */
    private async _removeMemberFromGroup(requestingUserId: UserId, groupId: GroupId, targetUserId: UserId, isLeaving: boolean): Promise<MessageResponse> {
        const timer = new PerformanceTimer();

        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({
            userId: requestingUserId,
            operation: isLeaving ? 'leave-group' : 'remove-group-member',
            ...(isLeaving ? {} : { memberId: targetUserId }),
        });

        if (!requestingUserId) {
            throw Errors.UNAUTHORIZED();
        }

        if (!isLeaving && !targetUserId) {
            throw Errors.MISSING_FIELD('memberId');
        }

        timer.startPhase('query');
        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        const memberDoc = await this.firestoreReader.getGroupMember(groupId, targetUserId);
        if (!memberDoc) {
            const message = isLeaving ? 'You are not a member of this group' : 'User is not a member of this group';
            throw Errors.INVALID_INPUT({ message });
        }

        // Authorization and validation logic
        if (isLeaving) {
            // User leaving themselves
            if (group.createdBy === targetUserId) {
                throw Errors.INVALID_INPUT({ message: 'Group creator cannot leave the group' });
            }

            const memberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);
            if (memberIds.length === 1) {
                throw Errors.INVALID_INPUT({ message: 'Cannot leave group - you are the only member' });
            }
        } else {
            // Admin removing someone else
            if (group.createdBy !== requestingUserId) {
                throw Errors.FORBIDDEN();
            }

            if (targetUserId === group.createdBy) {
                throw Errors.INVALID_INPUT({ message: 'Group creator cannot be removed' });
            }
        }

        // Balance validation (same logic for both scenarios)
        // Use pre-computed balance from Firestore (O(1) read)
        try {
            const groupBalance = await this.firestoreReader.getGroupBalance(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            for (const currency in balancesByCurrency) {
                const targetBalance = balancesByCurrency[currency][targetUserId];
                if (targetBalance) {
                    const balanceUnits = amountToSmallestUnit(targetBalance.netBalance, currency);
                    if (balanceUnits !== 0) {
                        const message = isLeaving ? 'Cannot leave group with outstanding balance' : 'Cannot remove member with outstanding balance';
                        throw Errors.INVALID_INPUT({ message });
                    }
                }
            }
        } catch (balanceError: unknown) {
            // If it's our specific "outstanding balance" error from the validation above, re-throw it
            if (balanceError instanceof ApiError) {
                const details = balanceError.details;
                const hasOutstandingBalance = details?.message?.includes('Cannot leave group with outstanding balance')
                    || details?.message?.includes('Cannot remove member with outstanding balance');
                if (hasOutstandingBalance) {
                    throw balanceError;
                }
            }

            // For any other errors from calculateGroupBalances (e.g., database issues, data corruption),
            // log them for debugging and throw a generic error to the user
            logger.error(`Unexpected error during balance check for ${isLeaving ? 'leaving' : 'member removal'}`, balanceError as Error, {
                groupId,
                requestingUserId,
                targetUserId,
                operation: isLeaving ? 'leave-group' : 'remove-member',
            });
            throw Errors.INTERNAL_ERROR();
        }
        timer.endPhase();

        const actorId = isLeaving ? targetUserId : requestingUserId;
        const targetDisplayName = memberDoc.groupDisplayName?.trim();
        if (!targetDisplayName) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'GROUP_DISPLAY_NAME_MISSING',
                'Group member is missing required display name',
            );
        }
        let actorDisplayName = targetDisplayName;

        if (!isLeaving) {
            const actorMembership = await this.firestoreReader.getGroupMember(groupId, requestingUserId);
            const normalizedActorName = actorMembership?.groupDisplayName?.trim();
            if (!normalizedActorName) {
                throw new ApiError(
                    HTTP_STATUS.INTERNAL_ERROR,
                    'GROUP_DISPLAY_NAME_MISSING',
                    'Group member is missing required display name',
                );
            }
            actorDisplayName = normalizedActorName;
        }

        const now = toISOString(new Date().toISOString());

        // Atomically update group, delete membership, clean up notifications, and emit activity
        timer.startPhase('transaction');
        await this.runMembershipTransaction(groupId, async (context) => {
            const transaction = context.transaction;
            const membershipsSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);
            const memberIdsInTransaction = membershipsSnapshot.docs.map((doc) => (doc.data() as { uid: UserId; }).uid);
            const remainingMemberIds = memberIdsInTransaction.filter((uid) => uid !== targetUserId);

            const activityRecipients = Array.from(new Set<UserId>([...remainingMemberIds, targetUserId]));

            const membershipDocId = newTopLevelMembershipDocId(targetUserId, groupId);
            const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
            transaction.delete(membershipRef);

            await context.touchGroup();

            if (activityRecipients.length > 0) {
                const activityItem = this.activityFeedService.buildGroupActivityItem({
                    groupId,
                    groupName: group.name,
                    eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                    action: ActivityFeedActions.LEAVE,
                    actorId,
                    actorName: actorDisplayName,
                    timestamp: now,
                    details: this.activityFeedService.buildDetails({
                        targetUser: {
                            id: targetUserId,
                            name: targetDisplayName,
                        },
                    }),
                });

                this.activityFeedService.recordActivityForUsers(transaction, activityRecipients, activityItem);
            }
        });
        timer.endPhase();

        LoggerContext.setBusinessContext({ groupId });
        const logEvent = isLeaving ? 'member-left' : 'member-removed';
        logger.info(logEvent, {
            id: targetUserId,
            groupId,
            timings: timer.getTimings(),
        });

        return {
            message: isLeaving ? 'Successfully left the group' : 'Member removed successfully',
        };
    }

    async isGroupMemberAsync(groupId: GroupId, userId: UserId): Promise<boolean> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);
        return member !== null;
    }

    async isGroupOwnerAsync(groupId: GroupId, userId: UserId): Promise<boolean> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);
        return Boolean(member && member.memberRole === MemberRoles.ADMIN && member.memberStatus === MemberStatuses.ACTIVE);
    }

    /**
     * Archive a group for the current user (user-specific view control)
     * This hides the group from the user's dashboard without leaving or deleting it
     */
    async archiveGroupForUser(groupId: GroupId, userId: UserId): Promise<MessageResponse> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);

        if (!member) {
            throw Errors.NOT_FOUND('Group membership');
        }

        if (member.memberStatus !== MemberStatuses.ACTIVE) {
            throw Errors.INVALID_INPUT({
                message: 'Can only archive active group memberships',
            });
        }

        const now = new Date().toISOString();
        const topLevelDocId = newTopLevelMembershipDocId(userId, groupId);
        const documentPath = `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`;

        await this.firestoreWriter.runTransaction(async (transaction) => {
            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                memberStatus: MemberStatuses.ARCHIVED,
                updatedAt: now,
            });
        });

        logger.info('group-archived-for-user', { groupId, userId });
        return { message: 'Group archived successfully' };
    }

    /**
     * Unarchive a group for the current user (restore to active view)
     */
    async unarchiveGroupForUser(groupId: GroupId, userId: UserId): Promise<MessageResponse> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);

        if (!member) {
            throw Errors.NOT_FOUND('Group membership');
        }

        if (member.memberStatus !== MemberStatuses.ARCHIVED) {
            throw Errors.INVALID_INPUT({
                message: 'Can only unarchive archived group memberships',
            });
        }

        const now = new Date().toISOString();
        const topLevelDocId = newTopLevelMembershipDocId(userId, groupId);
        const documentPath = `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`;

        await this.firestoreWriter.runTransaction(async (transaction) => {
            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                memberStatus: MemberStatuses.ACTIVE,
                updatedAt: now,
            });
        });

        logger.info('group-unarchived-for-user', { groupId, userId });
        return { message: 'Group unarchived successfully' };
    }
}

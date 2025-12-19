import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    amountToSmallestUnit,
    GroupDTO,
    GroupId,
    GroupMembershipDTO,
    MemberRole,
    MemberRoles,
    MemberStatuses,
    toCurrencyISOCode,
    UserId,
} from '@billsplit-wl/shared';
import { toISOString } from '@billsplit-wl/shared';
import { FirestoreCollections } from '../constants';
import { ApiError, ErrorDetail, Errors } from '../errors';
import { FieldValue } from '../firestore-wrapper';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { PermissionEngineAsync } from '../permissions/permission-engine-async';
import { newTopLevelMembershipDocId } from '../utils/idGenerator';
import { ActivityFeedService, CreateActivityItemInput } from './ActivityFeedService';
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
            throw options.unauthorizedErrorFactory?.() ?? Errors.authRequired();
        }

        const membership = await this.firestoreReader.getGroupMember(groupId, userId);

        if (!membership || membership.memberRole !== MemberRoles.ADMIN || membership.memberStatus !== MemberStatuses.ACTIVE) {
            throw options.forbiddenErrorFactory?.() ?? Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
        }

        return membership;
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
            throw options.notFoundErrorFactory?.() ?? Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        if (!actorMember || !memberIds.includes(userId)) {
            throw options.forbiddenErrorFactory?.() ?? Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER);
        }

        return {
            group,
            memberIds,
            actorMember,
        };
    }

    async ensureCanManagePendingMembers(
        groupId: GroupId,
        userId: UserId | null | undefined,
        options: AdminGuardOptions = {},
    ): Promise<{ group: GroupDTO; actorMember: GroupMembershipDTO; }> {
        if (!userId) {
            throw options.unauthorizedErrorFactory?.() ?? Errors.authRequired();
        }

        const { group, actorMember } = await this.getGroupAccessContext(groupId, userId, {
            notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
            forbiddenErrorFactory: options.forbiddenErrorFactory ?? (() => Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS)),
        });

        const canApproveMembers = PermissionEngineAsync.checkPermission(actorMember, group, userId, 'memberApproval');
        if (!canApproveMembers) {
            throw options.forbiddenErrorFactory?.() ?? Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
        }

        return { group, actorMember };
    }

    async leaveGroup(userId: UserId, groupId: GroupId): Promise<void> {
        await measure.measureDb('GroupMemberService.leaveGroup', async () => this._removeMemberFromGroup(userId, groupId, userId, true));
    }

    async removeGroupMember(userId: UserId, groupId: GroupId, memberId: UserId): Promise<void> {
        await measure.measureDb('GroupMemberService.removeGroupMember', async () => this._removeMemberFromGroup(userId, groupId, memberId, false));
    }

    async updateMemberRole(requestingUserId: UserId, groupId: GroupId, targetUserId: UserId, newRole: MemberRole): Promise<void> {
        await measure.measureDb('GroupMemberService.updateMemberRole', async () => {
            if (!targetUserId) {
                throw Errors.validationError('memberId', ErrorDetail.MISSING_FIELD);
            }

            await this.ensureActiveGroupAdmin(groupId, requestingUserId);

            const [group, targetMembership, actorMembership] = await Promise.all([
                this.firestoreReader.getGroup(groupId),
                this.firestoreReader.getGroupMember(groupId, targetUserId),
                this.firestoreReader.getGroupMember(groupId, requestingUserId),
            ]);

            if (!group) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }

            if (!targetMembership) {
                throw Errors.notFound('Group member', ErrorDetail.MEMBER_NOT_FOUND);
            }

            // No-op if role is already set
            if (targetMembership.memberRole === newRole) {
                return;
            }

            const actorDisplayName = actorMembership?.groupDisplayName ?? 'Unknown';
            const targetDisplayName = targetMembership.groupDisplayName;
            const now = toISOString(new Date().toISOString());
            let activityItem: CreateActivityItemInput | null = null;
            let activityRecipients: UserId[] = [];

            await this.runMembershipTransaction(groupId, async (context) => {
                const transaction = context.transaction;
                const membershipDocId = newTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.notFound('Group member', ErrorDetail.MEMBER_NOT_FOUND);
                }

                // CRITICAL: Read all members INSIDE transaction to prevent TOCTOU race condition
                // This ensures the admin count check uses transactionally consistent data
                const membershipsSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);
                const allMembersInTx = membershipsSnapshot.docs.map((doc) => doc.data() as { uid: UserId; memberRole: MemberRole; memberStatus: string; });

                // Check if demoting the last admin (must happen INSIDE transaction)
                if (targetMembership.memberRole === MemberRoles.ADMIN && newRole !== MemberRoles.ADMIN) {
                    const activeAdminCount = allMembersInTx
                        .filter(
                            (m) => m.memberRole === MemberRoles.ADMIN && m.memberStatus === MemberStatuses.ACTIVE,
                        )
                        .length;
                    if (activeAdminCount <= 1) {
                        throw Errors.invalidRequest(ErrorDetail.LAST_ADMIN_PROTECTED);
                    }
                }

                activityRecipients = allMembersInTx
                    .filter((m) => m.memberStatus === MemberStatuses.ACTIVE)
                    .map((m) => m.uid);

                transaction.update(membershipRef, {
                    memberRole: newRole,
                    groupUpdatedAt: FieldValue.serverTimestamp(),
                });

                await context.touchGroup();

                // Build activity item - will be recorded AFTER transaction commits
                activityItem = this.activityFeedService.buildGroupActivityItem({
                    groupId,
                    groupName: group.name,
                    eventType: ActivityFeedEventTypes.MEMBER_ROLE_CHANGED,
                    action: ActivityFeedActions.UPDATE,
                    actorId: requestingUserId,
                    actorName: actorDisplayName,
                    timestamp: now,
                    details: this.activityFeedService.buildDetails({
                        targetUser: {
                            id: targetUserId,
                            name: targetDisplayName,
                        },
                        newRole,
                    }),
                });
            });

            // Record activity feed AFTER transaction commits (fire-and-forget)
            if (activityItem && activityRecipients.length > 0) {
                await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                    // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
                });
            }

            LoggerContext.setBusinessContext({ groupId });
            logger.info('group-member-role-updated', {
                groupId,
                targetUserId,
                newRole,
            });
        });
    }

    async approveMember(requestingUserId: UserId, groupId: GroupId, targetUserId: UserId): Promise<void> {
        await measure.measureDb('GroupMemberService.approveMember', async () => {
            if (!targetUserId) {
                throw Errors.validationError('memberId', ErrorDetail.MISSING_FIELD);
            }

            const { group } = await this.ensureCanManagePendingMembers(groupId, requestingUserId);

            const targetMembership = await this.firestoreReader.getGroupMember(groupId, targetUserId);

            if (!targetMembership) {
                throw Errors.notFound('Group member', ErrorDetail.MEMBER_NOT_FOUND);
            }

            // No-op if member is already active
            if (targetMembership.memberStatus === MemberStatuses.ACTIVE) {
                return;
            }

            const actorDisplayName = targetMembership.groupDisplayName;
            const now = toISOString(new Date().toISOString());
            let recipientIds: UserId[] = [];
            let activityItem: CreateActivityItemInput | null = null;
            let activityRecipients: UserId[] = [];

            await this.runMembershipTransaction(groupId, async (context) => {
                const transaction = context.transaction;
                const membershipDocId = newTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.notFound('Group member', ErrorDetail.MEMBER_NOT_FOUND);
                }

                const membershipsSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);
                const activityRecipientsSet = new Set<UserId>();
                for (const doc of membershipsSnapshot.docs) {
                    const data = doc.data() as { uid: UserId; memberStatus: string; };
                    if (data.memberStatus === MemberStatuses.ACTIVE) {
                        activityRecipientsSet.add(data.uid);
                    }
                }
                activityRecipientsSet.add(targetUserId);

                recipientIds = Array.from(activityRecipientsSet);

                transaction.update(membershipRef, {
                    memberStatus: MemberStatuses.ACTIVE,
                    groupUpdatedAt: FieldValue.serverTimestamp(),
                });

                await context.touchGroup();

                // Build activity item - will be recorded AFTER transaction commits
                if (recipientIds.length > 0) {
                    activityItem = this.activityFeedService.buildGroupActivityItem({
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
                    activityRecipients = recipientIds;
                }
            });

            // Record activity feed AFTER transaction commits (fire-and-forget)
            if (activityItem && activityRecipients.length > 0) {
                await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                    // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
                });
            }

            LoggerContext.setBusinessContext({ groupId });
            logger.info('group-member-approved', {
                groupId,
                targetUserId,
            });
        });
    }

    async rejectMember(requestingUserId: UserId, groupId: GroupId, targetUserId: UserId): Promise<void> {
        await measure.measureDb('GroupMemberService.rejectMember', async () => {
            if (!targetUserId) {
                throw Errors.validationError('memberId', ErrorDetail.MISSING_FIELD);
            }

            await this.ensureCanManagePendingMembers(groupId, requestingUserId);

            const targetMembership = await this.firestoreReader.getGroupMember(groupId, targetUserId);
            if (!targetMembership) {
                throw Errors.notFound('Group member', ErrorDetail.MEMBER_NOT_FOUND);
            }

            await this.runMembershipTransaction(groupId, async (context) => {
                const transaction = context.transaction;
                const membershipDocId = newTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.notFound('Group member', ErrorDetail.MEMBER_NOT_FOUND);
                }

                transaction.delete(membershipRef);
                await context.touchGroup([membershipDocId]);
            });

            LoggerContext.setBusinessContext({ groupId });
            logger.info('group-member-rejected', {
                groupId,
                targetUserId,
            });
        });
    }

    async getPendingMembers(requestingUserId: UserId, groupId: GroupId): Promise<GroupMembershipDTO[]> {
        return measure.measureDb('GroupMemberService.getPendingMembers', async () => {
            await this.ensureCanManagePendingMembers(groupId, requestingUserId);

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
    private async _removeMemberFromGroup(requestingUserId: UserId, groupId: GroupId, targetUserId: UserId, isLeaving: boolean): Promise<void> {
        const timer = new PerformanceTimer();

        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({
            userId: requestingUserId,
            operation: isLeaving ? 'leave-group' : 'remove-group-member',
            ...(isLeaving ? {} : { memberId: targetUserId }),
        });

        if (!requestingUserId) {
            throw Errors.authRequired();
        }

        if (!isLeaving && !targetUserId) {
            throw Errors.validationError('memberId', ErrorDetail.MISSING_FIELD);
        }

        timer.startPhase('query');
        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        const memberDoc = await this.firestoreReader.getGroupMember(groupId, targetUserId);
        if (!memberDoc) {
            const message = isLeaving ? 'You are not a member of this group' : 'User is not a member of this group';
            throw Errors.invalidRequest(message);
        }

        // Authorization check (non-transactional is safe - just verifies requester is admin)
        if (!isLeaving) {
            // Admin removing someone else - must be an admin to remove
            await this.ensureActiveGroupAdmin(groupId, requestingUserId);
        }

        // Track target admin status for transactional validation
        const targetIsAdmin = memberDoc.memberRole === MemberRoles.ADMIN && memberDoc.memberStatus === MemberStatuses.ACTIVE;

        // Balance validation (same logic for both scenarios)
        // Use pre-computed balance from Firestore (O(1) read)
        try {
            const groupBalance = await this.firestoreReader.getGroupBalance(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            for (const currencyStr in balancesByCurrency) {
                const currency = toCurrencyISOCode(currencyStr);
                const targetBalance = balancesByCurrency[currency][targetUserId];
                if (targetBalance) {
                    const balanceUnits = amountToSmallestUnit(targetBalance.netBalance, currency);
                    if (balanceUnits !== 0) {
                        const message = isLeaving ? 'Cannot leave group with outstanding balance' : 'Cannot remove member with outstanding balance';
                        throw Errors.conflict(message);
                    }
                }
            }
        } catch (balanceError: unknown) {
            // If it's our specific "outstanding balance" error from the validation above, re-throw it
            if (balanceError instanceof ApiError) {
                // Check if it's the conflict error we just threw
                if (balanceError.code === 'CONFLICT') {
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
            throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
        }
        timer.endPhase();

        const actorId = isLeaving ? targetUserId : requestingUserId;
        const targetDisplayName = memberDoc.groupDisplayName;
        let actorDisplayName = targetDisplayName;

        if (!isLeaving) {
            const actorMembership = await this.firestoreReader.getGroupMember(groupId, requestingUserId);
            actorDisplayName = actorMembership!.groupDisplayName;
        }

        const now = toISOString(new Date().toISOString());
        let activityRecipients: UserId[] = [];
        let activityItem: CreateActivityItemInput | null = null;

        // Atomically update group, delete membership, clean up notifications, and emit activity
        timer.startPhase('transaction');
        await this.runMembershipTransaction(groupId, async (context) => {
            const transaction = context.transaction;

            // CRITICAL: Read all members INSIDE transaction to prevent TOCTOU race condition
            // This ensures the admin count and member count checks use transactionally consistent data
            const membershipsSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);
            const allMembersInTx = membershipsSnapshot.docs.map((doc) => doc.data() as { uid: UserId; memberRole: MemberRole; memberStatus: string; });
            const memberIdsInTransaction = allMembersInTx.map((m) => m.uid);
            const remainingMemberIds = memberIdsInTransaction.filter((uid) => uid !== targetUserId);

            // Transactional validation: check if this would leave the group orphaned
            if (isLeaving) {
                // User leaving themselves - check member count
                if (allMembersInTx.length === 1) {
                    throw Errors.invalidRequest('Cannot leave group - you are the only member');
                }
            }

            // Check if removing/leaving the last admin (applies to both scenarios)
            if (targetIsAdmin) {
                const activeAdminCount = allMembersInTx
                    .filter(
                        (m) => m.memberRole === MemberRoles.ADMIN && m.memberStatus === MemberStatuses.ACTIVE,
                    )
                    .length;
                if (activeAdminCount <= 1) {
                    throw Errors.invalidRequest(ErrorDetail.LAST_ADMIN_PROTECTED);
                }
            }

            // Re-validate balance inside transaction to prevent race conditions
            // (Pre-transaction check may have passed before a concurrent expense/settlement changed balance)
            const groupBalanceInTx = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, groupId);
            const balancesByCurrencyInTx = groupBalanceInTx.balancesByCurrency;

            for (const currencyStr in balancesByCurrencyInTx) {
                const currency = toCurrencyISOCode(currencyStr);
                const targetBalance = balancesByCurrencyInTx[currency][targetUserId];
                if (targetBalance) {
                    const balanceUnits = amountToSmallestUnit(targetBalance.netBalance, currency);
                    if (balanceUnits !== 0) {
                        const message = isLeaving ? 'Cannot leave group with outstanding balance' : 'Cannot remove member with outstanding balance';
                        throw Errors.conflict(message);
                    }
                }
            }

            activityRecipients = Array.from(new Set<UserId>([...remainingMemberIds, targetUserId]));

            const membershipDocId = newTopLevelMembershipDocId(targetUserId, groupId);
            const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
            transaction.delete(membershipRef);

            await context.touchGroup([membershipDocId]);

            // Build activity item - will be recorded AFTER transaction commits
            if (activityRecipients.length > 0) {
                activityItem = this.activityFeedService.buildGroupActivityItem({
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
            }
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        LoggerContext.setBusinessContext({ groupId });
        const logEvent = isLeaving ? 'member-left' : 'member-removed';
        logger.info(logEvent, {
            id: targetUserId,
            groupId,
            timings: timer.getTimings(),
        });
    }

    async isGroupMemberAsync(groupId: GroupId, userId: UserId): Promise<boolean> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);
        return member !== null;
    }

    /**
     * Archive a group for the current user (user-specific view control)
     * This hides the group from the user's dashboard without leaving or deleting it
     */
    async archiveGroupForUser(groupId: GroupId, userId: UserId): Promise<void> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);

        if (!member) {
            throw Errors.notFound('Group membership', ErrorDetail.MEMBER_NOT_FOUND);
        }

        if (member.memberStatus !== MemberStatuses.ACTIVE) {
            throw Errors.invalidRequest('Can only archive active group memberships');
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
    }

    /**
     * Unarchive a group for the current user (restore to active view)
     */
    async unarchiveGroupForUser(groupId: GroupId, userId: UserId): Promise<void> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);

        if (!member) {
            throw Errors.notFound('Group membership', ErrorDetail.MEMBER_NOT_FOUND);
        }

        if (member.memberStatus !== MemberStatuses.ARCHIVED) {
            throw Errors.invalidRequest('Can only unarchive archived group memberships');
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
    }
}

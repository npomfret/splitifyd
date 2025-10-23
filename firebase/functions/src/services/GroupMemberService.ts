import { amountToSmallestUnit, GroupMembershipDTO, MemberRole, MemberRoles, MemberStatuses, MessageResponse } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import { FirestoreCollections } from '../constants';
import { FieldValue } from '../firestore-wrapper';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ApiError, Errors } from '../utils/errors';
import { getTopLevelMembershipDocId } from '../utils/groupMembershipHelpers';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';

export class GroupMemberService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
    ) {}

    async leaveGroup(userId: string, groupId: GroupId): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.leaveGroup', async () => this._removeMemberFromGroup(userId, groupId, userId, true));
    }

    async removeGroupMember(userId: string, groupId: GroupId, memberId: string): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.removeGroupMember', async () => this._removeMemberFromGroup(userId, groupId, memberId, false));
    }

    async updateMemberRole(requestingUserId: string, groupId: GroupId, targetUserId: string, newRole: MemberRole): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.updateMemberRole', async () => {
            if (!requestingUserId) {
                throw Errors.UNAUTHORIZED();
            }
            if (!targetUserId) {
                throw Errors.MISSING_FIELD('memberId');
            }

            const [requesterMembership, targetMembership, allMembers] = await Promise.all([
                this.firestoreReader.getGroupMember(groupId, requestingUserId),
                this.firestoreReader.getGroupMember(groupId, targetUserId),
                this.firestoreReader.getAllGroupMembers(groupId),
            ]);

            if (!requesterMembership || requesterMembership.memberRole !== MemberRoles.ADMIN || requesterMembership.memberStatus !== MemberStatuses.ACTIVE) {
                throw Errors.FORBIDDEN();
            }

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

            await this.firestoreWriter.runTransaction(async (transaction) => {
                const membershipDocId = getTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.NOT_FOUND('Group member');
                }

                transaction.update(membershipRef, {
                    memberRole: newRole,
                    groupUpdatedAt: FieldValue.serverTimestamp(),
                });

                await this.firestoreWriter.touchGroup(groupId, transaction);
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

    async approveMember(requestingUserId: string, groupId: GroupId, targetUserId: string): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.approveMember', async () => {
            if (!requestingUserId) {
                throw Errors.UNAUTHORIZED();
            }
            if (!targetUserId) {
                throw Errors.MISSING_FIELD('memberId');
            }

            const [requesterMembership, targetMembership] = await Promise.all([
                this.firestoreReader.getGroupMember(groupId, requestingUserId),
                this.firestoreReader.getGroupMember(groupId, targetUserId),
            ]);

            if (!requesterMembership || requesterMembership.memberRole !== MemberRoles.ADMIN || requesterMembership.memberStatus !== MemberStatuses.ACTIVE) {
                throw Errors.FORBIDDEN();
            }

            if (!targetMembership) {
                throw Errors.NOT_FOUND('Group member');
            }

            if (targetMembership.memberStatus === MemberStatuses.ACTIVE) {
                return { message: 'Member is already active' };
            }

            await this.firestoreWriter.runTransaction(async (transaction) => {
                const membershipDocId = getTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.NOT_FOUND('Group member');
                }

                transaction.update(membershipRef, {
                    memberStatus: MemberStatuses.ACTIVE,
                    groupUpdatedAt: FieldValue.serverTimestamp(),
                });

                await this.firestoreWriter.touchGroup(groupId, transaction);
            });

            LoggerContext.setBusinessContext({ groupId });
            logger.info('group-member-approved', {
                groupId,
                targetUserId,
            });

            return { message: 'Member approved successfully' };
        });
    }

    async rejectMember(requestingUserId: string, groupId: GroupId, targetUserId: string): Promise<MessageResponse> {
        return measure.measureDb('GroupMemberService.rejectMember', async () => {
            if (!requestingUserId) {
                throw Errors.UNAUTHORIZED();
            }
            if (!targetUserId) {
                throw Errors.MISSING_FIELD('memberId');
            }

            const requesterMembership = await this.firestoreReader.getGroupMember(groupId, requestingUserId);
            if (!requesterMembership || requesterMembership.memberRole !== MemberRoles.ADMIN || requesterMembership.memberStatus !== MemberStatuses.ACTIVE) {
                throw Errors.FORBIDDEN();
            }

            const targetMembership = await this.firestoreReader.getGroupMember(groupId, targetUserId);
            if (!targetMembership) {
                throw Errors.NOT_FOUND('Group member');
            }

            await this.firestoreWriter.runTransaction(async (transaction) => {
                const membershipDocId = getTopLevelMembershipDocId(targetUserId, groupId);
                const membershipRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, membershipDocId);
                const membershipSnap = await transaction.get(membershipRef);
                if (!membershipSnap.exists) {
                    throw Errors.NOT_FOUND('Group member');
                }

                transaction.delete(membershipRef);
                await this.firestoreWriter.touchGroup(groupId, transaction);
            });

            LoggerContext.setBusinessContext({ groupId });
            logger.info('group-member-rejected', {
                groupId,
                targetUserId,
            });

            return { message: 'Member rejected successfully' };
        });
    }

    async getPendingMembers(requestingUserId: string, groupId: GroupId): Promise<GroupMembershipDTO[]> {
        return measure.measureDb('GroupMemberService.getPendingMembers', async () => {
            const requesterMembership = await this.firestoreReader.getGroupMember(groupId, requestingUserId);
            if (!requesterMembership || requesterMembership.memberRole !== MemberRoles.ADMIN || requesterMembership.memberStatus !== MemberStatuses.ACTIVE) {
                throw Errors.FORBIDDEN();
            }

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
    private async _removeMemberFromGroup(requestingUserId: string, groupId: GroupId, targetUserId: string, isLeaving: boolean): Promise<MessageResponse> {
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

        // Atomically update group, delete membership, and clean up notifications
        timer.startPhase('transaction');
        await this.firestoreWriter.leaveGroupAtomic(groupId, targetUserId);
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

    async isGroupMemberAsync(groupId: GroupId, userId: string): Promise<boolean> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);
        return member !== null;
    }

    async isGroupOwnerAsync(groupId: GroupId, userId: string): Promise<boolean> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);
        return member?.memberRole === MemberRoles.ADMIN || false;
    }

    /**
     * Archive a group for the current user (user-specific view control)
     * This hides the group from the user's dashboard without leaving or deleting it
     */
    async archiveGroupForUser(groupId: GroupId, userId: string): Promise<MessageResponse> {
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
        const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);
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
    async unarchiveGroupForUser(groupId: GroupId, userId: string): Promise<MessageResponse> {
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
        const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);
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

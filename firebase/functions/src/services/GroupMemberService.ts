import { Errors, ApiError } from '../utils/errors';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { BalanceCalculationService } from './balance';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import { MemberRoles, type GroupMembershipDTO } from '@splitifyd/shared';

export class GroupMemberService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly balanceService: BalanceCalculationService,
    ) {}

    async leaveGroup(userId: string, groupId: string): Promise<{ success: true; message: string }> {
        return measure.measureDb('GroupMemberService.leaveGroup', async () => this._removeMemberFromGroup(userId, groupId, userId, true));
    }

    async removeGroupMember(userId: string, groupId: string, memberId: string): Promise<{ success: true; message: string }> {
        return measure.measureDb('GroupMemberService.removeGroupMember', async () => this._removeMemberFromGroup(userId, groupId, memberId, false));
    }

    /**
     * Unified method to handle both self-leaving and admin removal of members
     * @param requestingUserId - The user making the request
     * @param groupId - The group ID
     * @param targetUserId - The user being removed (could be same as requesting user for leave)
     * @param isLeaving - true for self-leave, false for admin removal
     */
    private async _removeMemberFromGroup(requestingUserId: string, groupId: string, targetUserId: string, isLeaving: boolean): Promise<{ success: true; message: string }> {
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

            const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);
            if (memberDocs.length === 1) {
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
        try {
            const groupBalance = await this.balanceService.calculateGroupBalances(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            for (const currency in balancesByCurrency) {
                const currencyBalances = balancesByCurrency[currency];
                const targetBalance = currencyBalances[targetUserId];

                if (targetBalance && Math.abs(targetBalance.netBalance) > 0.01) {
                    const message = isLeaving ? 'Cannot leave group with outstanding balance' : 'Cannot remove member with outstanding balance';
                    throw Errors.INVALID_INPUT({ message });
                }
            }
        } catch (balanceError: unknown) {
            // If it's our specific "outstanding balance" error from the validation above, re-throw it
            if (balanceError instanceof ApiError) {
                const details = balanceError.details;
                const hasOutstandingBalance = details?.message?.includes('Cannot leave group with outstanding balance') || details?.message?.includes('Cannot remove member with outstanding balance');
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

        // Atomically update group, delete membership, and clean up notifications
        await this.firestoreWriter.leaveGroupAtomic(groupId, targetUserId);

        LoggerContext.setBusinessContext({ groupId });
        const logEvent = isLeaving ? 'member-left' : 'member-removed';
        logger.info(logEvent, { id: targetUserId, groupId });

        return {
            success: true,
            message: isLeaving ? 'Successfully left the group' : 'Member removed successfully',
        };
    }

    /**
     * Get a single member from a group
     * @deprecated Use firestoreReader.getGroupMember() instead - only used by tests
     */
    async getGroupMember(groupId: string, userId: string): Promise<GroupMembershipDTO | null> {
        return this.firestoreReader.getGroupMember(groupId, userId);
    }

    /**
     * Get all members for a group
     * @deprecated Use firestoreReader.getAllGroupMembers() instead - only used by tests
     */
    async getAllGroupMembers(groupId: string): Promise<GroupMembershipDTO[]> {
        return this.firestoreReader.getAllGroupMembers(groupId);
    }

    /**
     * Get all groups for a user using top-level collection query
     * @deprecated Use firestoreReader.getGroupsForUserV2() instead
     */
    async getUserGroupsViaSubcollection(userId: string): Promise<string[]> {
        // Use a high limit to maintain backward compatibility
        // This method is expected to return ALL groups for a user
        const paginatedGroups = await this.firestoreReader.getGroupsForUserV2(userId, { limit: 1000 });
        return paginatedGroups.data.map((group: any) => group.id);
    }

    async isGroupMemberAsync(groupId: string, userId: string): Promise<boolean> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);
        return member !== null;
    }

    async isGroupOwnerAsync(groupId: string, userId: string): Promise<boolean> {
        const member = await this.firestoreReader.getGroupMember(groupId, userId);
        return member?.memberRole === MemberRoles.ADMIN || false;
    }
}

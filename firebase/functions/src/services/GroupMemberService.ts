import { Errors, ApiError } from '../utils/errors';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { FirestoreCollections } from '@splitifyd/shared';
import type { GroupMemberDocument } from '@splitifyd/shared';
import { BalanceCalculationService } from './balance';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import { MemberRoles } from '@splitifyd/shared';
import { getTopLevelMembershipDocId, createTopLevelMembershipDocument } from '../utils/groupMembershipHelpers';

export class GroupMemberService {
    // Injected dependencies or defaults
    private readonly logger: typeof import('../logger').logger;
    private readonly loggerContext: typeof import('../logger').LoggerContext;
    private readonly measure: typeof import('../monitoring/measure');

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly balanceService: BalanceCalculationService,
        // Optional dependencies for testing
        injectedLogger?: typeof import('../logger').logger,
        injectedLoggerContext?: typeof import('../logger').LoggerContext,
        injectedMeasure?: typeof import('../monitoring/measure')
    ) {
        // Use injected dependencies or fall back to imports
        this.logger = injectedLogger || logger;
        this.loggerContext = injectedLoggerContext || LoggerContext;
        this.measure = injectedMeasure || measure;
    }

    async leaveGroup(userId: string, groupId: string): Promise<{ success: true; message: string }> {
        return this.measure.measureDb('GroupMemberService.leaveGroup', async () => this._removeMemberFromGroup(userId, groupId, userId, true));
    }

    async removeGroupMember(userId: string, groupId: string, memberId: string): Promise<{ success: true; message: string }> {
        return this.measure.measureDb('GroupMemberService.removeGroupMember', async () => this._removeMemberFromGroup(userId, groupId, memberId, false));
    }

    /**
     * Unified method to handle both self-leaving and admin removal of members
     * @param requestingUserId - The user making the request
     * @param groupId - The group ID
     * @param targetUserId - The user being removed (could be same as requesting user for leave)
     * @param isLeaving - true for self-leave, false for admin removal
     */
    private async _removeMemberFromGroup(requestingUserId: string, groupId: string, targetUserId: string, isLeaving: boolean): Promise<{ success: true; message: string }> {
        this.loggerContext.setBusinessContext({ groupId });
        this.loggerContext.update({
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
            this.logger.error(`Unexpected error during balance check for ${isLeaving ? 'leaving' : 'member removal'}`, balanceError as Error, {
                groupId,
                requestingUserId,
                targetUserId,
                operation: isLeaving ? 'leave-group' : 'remove-member',
            });
            throw Errors.INTERNAL_ERROR();
        }

        // Atomically update group, delete membership, and clean up notifications
        await this.firestoreWriter.leaveGroupAtomic(groupId, targetUserId);

        this.loggerContext.setBusinessContext({ groupId });
        const logEvent = isLeaving ? 'member-left' : 'member-removed';
        this.logger.info(logEvent, { id: targetUserId, groupId });

        return {
            success: true,
            message: isLeaving ? 'Successfully left the group' : 'Member removed successfully',
        };
    }

    // ========================================================================
    // NEW SUBCOLLECTION METHODS - For Scalable Architecture
    // ========================================================================

    /**
     * Create a member document in the top-level collection
     * Path: group-memberships/{userId}_{groupId}
     * @deprecated remove this - only used by tests
     */
    async createMember(groupId: string, memberDoc: GroupMemberDocument): Promise<void> {
        return this.measure.measureDb('CREATE_MEMBER', async () => {
            const topLevelDocId = getTopLevelMembershipDocId(memberDoc.uid, groupId);
            const topLevelMemberDoc = createTopLevelMembershipDocument(memberDoc, new Date().toISOString());

            await this.firestoreWriter.runTransaction(async (transaction) => {
                this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, topLevelDocId, topLevelMemberDoc);
            });

            this.logger.info('Member added to top-level collection', {
                groupId,
                userId: memberDoc.uid,
                memberRole: memberDoc.memberRole,
            });
        });
    }

    /**
     * Get a single member from a group
     * @deprecated Use firestoreReader.getGroupMember() instead
     */
    async getGroupMember(groupId: string, userId: string): Promise<GroupMemberDocument | null> {
        return this.firestoreReader.getGroupMember(groupId, userId);
    }

    /**
     * Get all members for a group
     * @deprecated Use firestoreReader.getAllGroupMembers() instead
     */
    async getAllGroupMembers(groupId: string): Promise<GroupMemberDocument[]> {
        return this.firestoreReader.getAllGroupMembers(groupId);
    }

    /**
     * Update a member in the top-level collection
     * @deprecated - remove this - only used by tests
     */
    async updateMember(groupId: string, userId: string, updates: Partial<GroupMemberDocument>): Promise<void> {
        return this.measure.measureDb('UPDATE_MEMBER', async () => {
            const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);

            await this.firestoreWriter.runTransaction(async (transaction) => {
                this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`, updates);
            });

            this.logger.info('Member updated in top-level collection', {
                groupId,
                userId,
                updates: Object.keys(updates),
            });
        });
    }

    /**
     * Delete a member from top-level collection
     * @deprecated - remove this - only used by tests
     */
    async deleteMember(groupId: string, userId: string): Promise<void> {
        return this.measure.measureDb('DELETE_MEMBER', async () => {
            const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);

            // Use atomic batch operation to delete membership and remove from notifications
            await this.firestoreWriter.deleteMemberAndNotifications(topLevelDocId, userId, groupId);

            this.logger.info('Member and notification tracking deleted atomically', { groupId, userId });
        });
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
        const member = await this.getGroupMember(groupId, userId);
        return member !== null;
    }

    async isGroupOwnerAsync(groupId: string, userId: string): Promise<boolean> {
        const member = await this.getGroupMember(groupId, userId);
        return member?.memberRole === MemberRoles.ADMIN || false;
    }
}

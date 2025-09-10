import { Errors, ApiError } from '../utils/errors';
import { UserService } from './UserService2';
import { NotificationService } from './notification-service';
import { logger, LoggerContext } from '../logger';
import { FirestoreCollections } from '@splitifyd/shared';
import type { GroupMemberDocument } from '@splitifyd/shared';
import { BalanceCalculationService } from './balance/BalanceCalculationService';
import { measureDb } from '../monitoring/measure';
import type { IFirestoreReader } from './firestore/IFirestoreReader';
import type { IFirestoreWriter } from './firestore/IFirestoreWriter';
import {MemberRoles} from "@splitifyd/shared";
import { getTopLevelMembershipDocId, createTopLevelMembershipDocument } from '../utils/groupMembershipHelpers';

export class GroupMemberService {
    private balanceService: BalanceCalculationService;
    
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        userService: UserService,
        private readonly notificationService: NotificationService,
    ) {
        this.balanceService = new BalanceCalculationService(firestoreReader, userService);
    }

    async leaveGroup(userId: string, groupId: string): Promise<{ success: true; message: string }> {
        return measureDb('GroupMemberService.leaveGroup', async () => this._leaveGroup(userId, groupId));
    }

    private async _leaveGroup(userId: string, groupId: string): Promise<{ success: true; message: string }> {
        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({ userId, operation: 'leave-group' });
        
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        const memberDoc = await this.firestoreReader.getGroupMember(groupId, userId);
        if (!memberDoc) {
            throw Errors.INVALID_INPUT({ message: 'You are not a member of this group' });
        }

        if (group.createdBy === userId) {
            throw Errors.INVALID_INPUT({ message: 'Group creator cannot leave the group' });
        }

        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);
        if (memberDocs.length === 1) {
            throw Errors.INVALID_INPUT({ message: 'Cannot leave group - you are the only member' });
        }

        try {
            const groupBalance = await this.balanceService.calculateGroupBalances(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            for (const currency in balancesByCurrency) {
                const currencyBalances = balancesByCurrency[currency];
                const userBalance = currencyBalances[userId];

                if (userBalance && Math.abs(userBalance.netBalance) > 0.01) {
                    throw Errors.INVALID_INPUT({ message: 'Cannot leave group with outstanding balance' });
                }
            }
        } catch (balanceError: unknown) {
            // If it's our specific "outstanding balance" error from the validation above, re-throw it
            if (balanceError instanceof ApiError) {
                // Check if it's the expected ApiError with outstanding balance message
                const details = balanceError.details;
                if (details?.message?.includes('Cannot leave group with outstanding balance')) {
                    throw balanceError;
                }
            }

            // For any other errors from calculateGroupBalances (e.g., database issues, data corruption), 
            // log them for debugging and throw a generic error to the user
            logger.error('Unexpected error during balance check for leaving group', balanceError as Error, { 
                groupId, 
                userId,
                operation: 'leave-group'
            });
            throw Errors.INTERNAL_ERROR();
        }

        // Update group timestamp
        await this.firestoreWriter.updateDocument(`${FirestoreCollections.GROUPS}/${groupId}`, {});

        await this.deleteMember(groupId, userId);

        LoggerContext.setBusinessContext({ groupId });
        logger.info('member-left', { id: userId, groupId });

        return {
            success: true,
            message: 'Successfully left the group',
        };
    }

    async removeGroupMember(userId: string, groupId: string, memberId: string): Promise<{ success: true; message: string }> {
        return measureDb('GroupMemberService.removeGroupMember', async () => this._removeGroupMember(userId, groupId, memberId));
    }

    private async _removeGroupMember(userId: string, groupId: string, memberId: string): Promise<{ success: true; message: string }> {
        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({ userId, operation: 'remove-group-member', memberId });
        
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        if (!memberId) {
            throw Errors.MISSING_FIELD('memberId');
        }

        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        if (group.createdBy !== userId) {
            throw Errors.FORBIDDEN();
        }

        const memberDoc = await this.firestoreReader.getGroupMember(groupId, memberId);
        if (!memberDoc) {
            throw Errors.INVALID_INPUT({ message: 'User is not a member of this group' });
        }

        if (memberId === group.createdBy) {
            throw Errors.INVALID_INPUT({ message: 'Group creator cannot be removed' });
        }

        try {
            const groupBalance = await this.balanceService.calculateGroupBalances(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            for (const currency in balancesByCurrency) {
                const currencyBalances = balancesByCurrency[currency];
                const memberBalance = currencyBalances[memberId];

                if (memberBalance && Math.abs(memberBalance.netBalance) > 0.01) {
                    throw Errors.INVALID_INPUT({ message: 'Cannot remove member with outstanding balance' });
                }
            }
        } catch (balanceError: unknown) {
            // If it's our specific "outstanding balance" error from the validation above, re-throw it
            if (balanceError instanceof ApiError) {
                // Check if it's the expected ApiError with outstanding balance message
                const details = balanceError.details;
                if (details?.message?.includes('Cannot remove member with outstanding balance')) {
                    throw balanceError;
                }
            }

            // For any other errors from calculateGroupBalances (e.g., database issues, data corruption), 
            // log them for debugging and throw a generic error to the user
            logger.error('Unexpected error during balance check for member removal', balanceError as Error, { 
                groupId, 
                userId,
                memberId,
                operation: 'remove-member'
            });
            throw Errors.INTERNAL_ERROR();
        }

        // Update group timestamp  
        await this.firestoreWriter.updateDocument(`${FirestoreCollections.GROUPS}/${groupId}`, {});

        // Also remove from subcollection
        await this.deleteMember(groupId, memberId);

        LoggerContext.setBusinessContext({ groupId });
        logger.info('member-removed', { id: memberId, groupId });

        return {
            success: true,
            message: 'Member removed successfully',
        };
    }

    // ========================================================================
    // NEW SUBCOLLECTION METHODS - For Scalable Architecture
    // ========================================================================

    /**
     * Create a member document in the top-level collection
     * Path: group-memberships/{userId}_{groupId}
     */
    async createMember(groupId: string, memberDoc: GroupMemberDocument): Promise<void> {
        return measureDb(
            'CREATE_MEMBER',
            async () => {
                const topLevelDocId = getTopLevelMembershipDocId(memberDoc.userId, groupId);
                const topLevelMemberDoc = createTopLevelMembershipDocument(
                    memberDoc,
                    new Date().toISOString()
                );

                await this.firestoreWriter.createDocument(
                    `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`,
                    topLevelMemberDoc
                );

                logger.info('Member added to top-level collection', { 
                    groupId, 
                    userId: memberDoc.userId,
                    memberRole: memberDoc.memberRole 
                });
            }
        );
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
     */
    async updateMember(groupId: string, userId: string, updates: Partial<GroupMemberDocument>): Promise<void> {
        return measureDb(
            'UPDATE_MEMBER',
            async () => {
                const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);
                
                await this.firestoreWriter.updateDocument(
                    `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`,
                    updates
                );

                logger.info('Member updated in top-level collection', { 
                    groupId, 
                    userId,
                    updates: Object.keys(updates)
                });
            }
        );
    }

    /**
     * Delete a member from top-level collection
     */
    async deleteMember(groupId: string, userId: string): Promise<void> {
        return measureDb(
            'DELETE_MEMBER',
            async () => {
                const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);
                
                await this.firestoreWriter.deleteDocument(
                    `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`
                );

                // Remove notification tracking for departed member
                await this.notificationService.removeUserFromGroup(userId, groupId);

                logger.info('Member deleted from top-level collection', { groupId, userId });
            }
        );
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
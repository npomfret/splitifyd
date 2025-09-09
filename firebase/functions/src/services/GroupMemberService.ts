import { FieldValue } from 'firebase-admin/firestore';
import {getFirestore} from '../firebase';
import { Errors, ApiError } from '../utils/errors';
import { UserService } from './UserService2';
import { NotificationService } from './notification-service';
import { logger, LoggerContext } from '../logger';
import { FirestoreCollections } from '@splitifyd/shared';
import type { GroupMemberDocument } from '@splitifyd/shared';
import { BalanceCalculationService } from './balance/BalanceCalculationService';
import { measureDb } from '../monitoring/measure';
import { createOptimisticTimestamp } from '../utils/dateHelpers';
import type { IFirestoreReader } from './firestore/IFirestoreReader';
import {MemberRoles} from "@splitifyd/shared";
import {DataFetcher} from "./balance/DataFetcher";
import { getTopLevelMembershipDocId } from '../utils/groupMembershipHelpers';

export class GroupMemberService {
    private balanceService: BalanceCalculationService;
    
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly userService: UserService,
        private readonly notificationService: NotificationService,
    ) {
        const dataFetcher = new DataFetcher(firestoreReader, userService);
        this.balanceService = new BalanceCalculationService(dataFetcher);
    }

    private getInitials(nameOrEmail: string): string {
        const name = nameOrEmail || '';
        const parts = name.split(/[\s@]+/).filter(Boolean);

        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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

        const memberDoc = await this.firestoreReader.getMemberFromSubcollection(groupId, userId);
        if (!memberDoc) {
            throw Errors.INVALID_INPUT({ message: 'You are not a member of this group' });
        }

        if (group.createdBy === userId) {
            throw Errors.INVALID_INPUT({ message: 'Group creator cannot leave the group' });
        }

        const memberDocs = await this.firestoreReader.getMembersFromSubcollection(groupId);
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
        const docRef = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId);
        await docRef.update({
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Also remove from subcollection
        await this.deleteMemberFromSubcollection(groupId, userId);

        // NEW: Also delete from top-level collection
        const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);
        const topLevelRef = getFirestore()
            .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
            .doc(topLevelDocId);
        await topLevelRef.delete();

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

        const memberDoc = await this.firestoreReader.getMemberFromSubcollection(groupId, memberId);
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
        const docRef2 = getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId);
        await docRef2.update({
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Also remove from subcollection
        await this.deleteMemberFromSubcollection(groupId, memberId);

        // NEW: Also delete from top-level collection
        const topLevelDocId = getTopLevelMembershipDocId(memberId, groupId);
        const topLevelRef = getFirestore()
            .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
            .doc(topLevelDocId);
        await topLevelRef.delete();

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
     * Create a member document in the subcollection
     * Path: groups/{groupId}/members/{userId}
     */
    async createMemberSubcollection(groupId: string, memberDoc: GroupMemberDocument): Promise<void> {
        return measureDb(
            'CREATE_MEMBER',
            async () => {
                const memberRef = getFirestore()
                    .collection(FirestoreCollections.GROUPS)
                    .doc(groupId)
                    .collection('members')
                    .doc(memberDoc.userId);

                await memberRef.set({
                    ...memberDoc,
                    createdAt: createOptimisticTimestamp(),
                    updatedAt: createOptimisticTimestamp(),
                });

                logger.info('Member added to subcollection', { 
                    groupId, 
                    userId: memberDoc.userId,
                    memberRole: memberDoc.memberRole 
                });
            }
        );
    }

    /**
     * Get a single member from subcollection
     * @deprecated Use firestoreReader.getMemberFromSubcollection() instead
     */
    async getMemberFromSubcollection(groupId: string, userId: string): Promise<GroupMemberDocument | null> {
        return this.firestoreReader.getMemberFromSubcollection(groupId, userId);
    }

    /**
     * Get all members for a group from subcollection
     * @deprecated Use firestoreReader.getMembersFromSubcollection() instead
     */
    async getMembersFromSubcollection(groupId: string): Promise<GroupMemberDocument[]> {
        return this.firestoreReader.getMembersFromSubcollection(groupId);
    }

    /**
     * Update a member in the subcollection
     */
    async updateMemberInSubcollection(groupId: string, userId: string, updates: Partial<GroupMemberDocument>): Promise<void> {
        return measureDb(
            'UPDATE_MEMBER',
            async () => {
                const memberRef = getFirestore()
                    .collection(FirestoreCollections.GROUPS)
                    .doc(groupId)
                    .collection('members')
                    .doc(userId);

                await memberRef.update({
                    ...updates,
                    updatedAt: createOptimisticTimestamp(),
                });

                logger.info('Member updated in subcollection', { 
                    groupId, 
                    userId,
                    updates: Object.keys(updates)
                });
            }
        );
    }

    /**
     * Delete a member from the subcollection
     */
    async deleteMemberFromSubcollection(groupId: string, userId: string): Promise<void> {
        return measureDb(
            'DELETE_MEMBER',
            async () => {
                const memberRef = getFirestore()
                    .collection(FirestoreCollections.GROUPS)
                    .doc(groupId)
                    .collection('members')
                    .doc(userId);

                await memberRef.delete();

                // Remove notification tracking for departed member
                await this.notificationService.removeUserFromGroup(userId, groupId);

                logger.info('Member deleted from subcollection', { groupId, userId });
            }
        );
    }

    /**
     * Get all groups for a user using scalable collectionGroup query
     * @deprecated Use firestoreReader.getGroupsForUser() instead
     */
    async getUserGroupsViaSubcollection(userId: string): Promise<string[]> {
        // Use a high limit to maintain backward compatibility 
        // This method is expected to return ALL groups for a user
        const paginatedGroups = await this.firestoreReader.getGroupsForUser(userId, { limit: 1000 });
        return paginatedGroups.data.map((group: any) => group.id);
    }

    async isGroupMemberAsync(groupId: string, userId: string): Promise<boolean> {
        const member = await this.getMemberFromSubcollection(groupId, userId);
        return member !== null;
    }

    async isGroupOwnerAsync(groupId: string, userId: string): Promise<boolean> {
        const member = await this.getMemberFromSubcollection(groupId, userId);
        return member?.memberRole === MemberRoles.ADMIN || false;
    }
}
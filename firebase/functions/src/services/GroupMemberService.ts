
import { FieldValue } from 'firebase-admin/firestore';
import { firestoreDb } from '../firebase';
import { Errors, ApiError } from '../utils/errors';
import { getUserService } from './serviceRegistration';
import { logger, LoggerContext } from '../logger';
import { FirestoreCollections, GroupMembersResponse, GroupMemberWithProfile, GroupMemberDocument, UserThemeColor } from '@splitifyd/shared';
import { calculateGroupBalances } from './balanceCalculator';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { createServerTimestamp } from '../utils/dateHelpers';
import type { IFirestoreReader } from './firestore/IFirestoreReader';

export class GroupMemberService {
    constructor(
        private readonly firestoreReader: IFirestoreReader
    ) {}

    private getInitials(nameOrEmail: string): string {
        const name = nameOrEmail || '';
        const parts = name.split(/[\s@]+/).filter(Boolean);

        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    async getGroupMembersResponse(membersMap: Record<string, any>): Promise<GroupMembersResponse> {
        const memberIds = Object.keys(membersMap);

        const memberProfiles = await getUserService().getUsers(memberIds);

        const members: GroupMemberWithProfile[] = memberIds.map((memberId: string) => {
            const profile = memberProfiles.get(memberId);
            const memberInfo = membersMap[memberId];

            if (!profile) {
                return {
                    uid: memberId,
                    name: 'Unknown User',
                    initials: '?',
                    email: '',
                    displayName: 'Unknown User',
                    themeColor: memberInfo.theme,
                    // Group membership metadata
                    joinedAt: memberInfo.joinedAt,
                    memberRole: memberInfo.role,
                    invitedBy: memberInfo.invitedBy,
                    memberStatus: memberInfo.status,
                    lastPermissionChange: memberInfo.lastPermissionChange,
                };
            }

            return {
                uid: memberId,
                name: profile.displayName,
                initials: this.getInitials(profile.displayName),
                email: profile.email,
                displayName: profile.displayName,
                themeColor: profile.themeColor || memberInfo.theme,
                preferredLanguage: profile.preferredLanguage,
                // Group membership metadata
                joinedAt: memberInfo.joinedAt,
                memberRole: memberInfo.role,
                invitedBy: memberInfo.invitedBy,
                memberStatus: memberInfo.status,
                lastPermissionChange: memberInfo.lastPermissionChange,
            };
        });

        members.sort((a, b) => a.displayName.localeCompare(b.displayName));

        return {
            members,
            hasMore: false,
        };
    }


    async leaveGroup(userId: string, groupId: string): Promise<{ success: true; message: string }> {
        return PerformanceMonitor.monitorServiceCall(
            'GroupMemberService',
            'leaveGroup',
            async () => this._leaveGroup(userId, groupId),
            { userId, groupId }
        );
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
            const groupBalance = await calculateGroupBalances(groupId);
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
        const docRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        await docRef.update({
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Also remove from subcollection
        await this.deleteMemberFromSubcollection(groupId, userId);

        LoggerContext.setBusinessContext({ groupId });
        logger.info('member-left', { id: userId, groupId });

        return {
            success: true,
            message: 'Successfully left the group',
        };
    }

    async removeGroupMember(userId: string, groupId: string, memberId: string): Promise<{ success: true; message: string }> {
        return PerformanceMonitor.monitorServiceCall(
            'GroupMemberService',
            'removeGroupMember',
            async () => this._removeGroupMember(userId, groupId, memberId),
            { userId, groupId, memberId }
        );
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
            const groupBalance = await calculateGroupBalances(groupId);
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
        const docRef2 = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        await docRef2.update({
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Also remove from subcollection
        await this.deleteMemberFromSubcollection(groupId, memberId);

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
        const memberRef = firestoreDb
            .collection(FirestoreCollections.GROUPS)
            .doc(groupId)
            .collection('members')
            .doc(memberDoc.userId);

        await memberRef.set({
            ...memberDoc,
            createdAt: createServerTimestamp(),
            updatedAt: createServerTimestamp(),
        });

        logger.info('Member added to subcollection', { 
            groupId, 
            userId: memberDoc.userId,
            role: memberDoc.role 
        });
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
        const memberRef = firestoreDb
            .collection(FirestoreCollections.GROUPS)
            .doc(groupId)
            .collection('members')
            .doc(userId);

        await memberRef.update({
            ...updates,
            updatedAt: createServerTimestamp(),
        });

        logger.info('Member updated in subcollection', { 
            groupId, 
            userId,
            updates: Object.keys(updates)
        });
    }

    /**
     * Delete a member from the subcollection
     */
    async deleteMemberFromSubcollection(groupId: string, userId: string): Promise<void> {
        const memberRef = firestoreDb
            .collection(FirestoreCollections.GROUPS)
            .doc(groupId)
            .collection('members')
            .doc(userId);

        await memberRef.delete();

        logger.info('Member deleted from subcollection', { groupId, userId });
    }

    /**
     * Get all groups for a user using scalable collectionGroup query
     * @deprecated Use firestoreReader.getGroupsForUser() instead
     */
    async getUserGroupsViaSubcollection(userId: string): Promise<string[]> {
        const groups = await this.firestoreReader.getGroupsForUser(userId);
        return groups.map(group => group.id);
    }

    /**
     * Get GroupMembersResponse using subcollection data
     * This maintains compatibility with existing API consumers
     */
    async getGroupMembersResponseFromSubcollection(groupId: string): Promise<GroupMembersResponse> {
        const memberDocs = await this.firestoreReader.getMembersFromSubcollection(groupId);
        const memberIds = memberDocs.map(doc => doc.userId);

        const memberProfiles = await getUserService().getUsers(memberIds);

        const members: GroupMemberWithProfile[] = memberDocs.map((memberDoc: GroupMemberDocument): GroupMemberWithProfile => {
            const profile = memberProfiles.get(memberDoc.userId);

            if (!profile) {
                return {
                    uid: memberDoc.userId,
                    initials: '?',
                    email: '',
                    displayName: 'Unknown User',
                    themeColor: memberDoc.theme,
                    // Group membership metadata
                    joinedAt: memberDoc.joinedAt,
                    memberRole: memberDoc.role,
                    invitedBy: memberDoc.invitedBy,
                    memberStatus: memberDoc.status,
                    lastPermissionChange: memberDoc.lastPermissionChange,
                };
            }

            return {
                uid: memberDoc.userId,
                initials: this.getInitials(profile.displayName),
                email: profile.email,
                displayName: profile.displayName,
                themeColor: (typeof profile.themeColor === 'object' ? profile.themeColor : memberDoc.theme) as UserThemeColor,
                preferredLanguage: profile.preferredLanguage,
                // Group membership metadata
                joinedAt: memberDoc.joinedAt,
                memberRole: memberDoc.role,
                invitedBy: memberDoc.invitedBy,
                memberStatus: memberDoc.status,
                lastPermissionChange: memberDoc.lastPermissionChange,
            };
        });

        members.sort((a, b) => a.displayName.localeCompare(b.displayName));

        return {
            members,
            hasMore: false,
        };
    }
}
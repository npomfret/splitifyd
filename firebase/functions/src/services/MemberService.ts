import { firestoreDb, FieldPath } from '../firebase';
import { FirestoreCollections, GroupMember, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import { getThemeColorForMember } from '../utils/groupHelpers';

/**
 * Service for managing group members using subcollections
 * This service provides the foundation for scaling group membership queries
 * while maintaining backward compatibility with existing embedded member patterns
 */
export class MemberService {
    /**
     * Get the members subcollection reference for a group
     */
    private getMembersCollection(groupId: string) {
        return firestoreDb
            .collection(FirestoreCollections.GROUPS)
            .doc(groupId)
            .collection('members');
    }

    /**
     * Add a member to a group's subcollection
     */
    async addMember(
        groupId: string,
        userId: string,
        memberData: {
            role: typeof MemberRoles[keyof typeof MemberRoles];
            status: typeof MemberStatuses[keyof typeof MemberStatuses];
            invitedBy?: string;
            joinedAt: string;
            themeIndex: number;
        }
    ): Promise<void> {
        const memberDoc = this.getMembersCollection(groupId).doc(userId);
        
        // Reduced logging for performance - only log in debug mode
        if (process.env.NODE_ENV === 'development') {
            logger.info('Creating member in subcollection', {
                groupId,
                userId,
                memberPath: memberDoc.path,
            });
        }
        
        const member: GroupMember & { userId: string } = {
            role: memberData.role,
            status: memberData.status,
            theme: getThemeColorForMember(memberData.themeIndex),
            joinedAt: memberData.joinedAt,
            userId: userId, // Add userId field for efficient querying
            // Only add invitedBy if it exists (founding members don't have this field)
            ...(memberData.invitedBy && { invitedBy: memberData.invitedBy }),
        };

        await memberDoc.set(member);
        
        logger.info('Member added to group subcollection', {
            groupId,
            userId,
            role: member.role,
        });
    }

    /**
     * Remove a member from a group's subcollection
     */
    async removeMember(groupId: string, userId: string): Promise<void> {
        const memberDoc = this.getMembersCollection(groupId).doc(userId);
        await memberDoc.delete();
        
        logger.info('Member removed from group subcollection', {
            groupId,
            userId,
        });
    }

    /**
     * Get a specific member from a group's subcollection
     */
    async getMember(groupId: string, userId: string): Promise<GroupMember | null> {
        const memberDoc = await this.getMembersCollection(groupId).doc(userId).get();
        
        if (!memberDoc.exists) {
            return null;
        }
        
        return memberDoc.data() as GroupMember;
    }

    /**
     * Get all group IDs where a user is a member using collection group query
     * This replaces the problematic embedded member query
     */
    async getUserGroups(userId: string): Promise<string[]> {
        try {
            logger.info('Starting collection group query for user groups', { userId });
            
            // Use collection group query to find all groups where user is a member
            // Query by userId field for efficient filtering
            const memberDocs = await firestoreDb
                .collectionGroup('members')
                .where('userId', '==', userId)
                .get();

            logger.info('Collection group query completed', {
                userId,
                docsFound: memberDocs.docs.length,
                queryEmpty: memberDocs.empty,
            });
            
            const groupIds = memberDocs.docs.map(doc => {
                // The parent of the member document is the group document
                return doc.ref.parent.parent!.id;
            });

            logger.info('Retrieved user groups via collection group query', {
                userId,
                groupCount: groupIds.length,
                groupIds: groupIds,
            });

            return groupIds;
        } catch (error) {
            logger.error('Failed to get user groups via collection group query', error as Error, {
                userId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                errorCode: (error as any)?.code,
                errorDetails: (error as any)?.details,
            });
            
            // Log the full error for debugging
            console.error('Detailed error for getUserGroups:', error);
            
            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR, 
                'MEMBER_QUERY_FAILED', 
                'Failed to retrieve user groups'
            );
        }
    }

    /**
     * Get all members of a group from the subcollection
     */
    async getGroupMembers(groupId: string): Promise<Record<string, GroupMember>> {
        const membersSnapshot = await this.getMembersCollection(groupId).get();
        
        const members: Record<string, GroupMember> = {};
        membersSnapshot.docs.forEach(doc => {
            members[doc.id] = doc.data() as GroupMember;
        });
        
        return members;
    }

    /**
     * Get legacy members map for backward compatibility
     * This method allows existing code to continue working unchanged
     * while we gradually migrate to subcollection-based queries
     */
    async getLegacyMembersMap(groupId: string): Promise<Record<string, GroupMember>> {
        return await this.getGroupMembers(groupId);
    }

    /**
     * Update a member's data in the subcollection
     */
    async updateMember(
        groupId: string, 
        userId: string, 
        updates: Partial<GroupMember>
    ): Promise<void> {
        const memberDoc = this.getMembersCollection(groupId).doc(userId);
        await memberDoc.update(updates);
        
        logger.info('Member updated in group subcollection', {
            groupId,
            userId,
            updates: Object.keys(updates),
        });
    }

    /**
     * Check if a user is a member of a group using subcollection
     */
    async isMember(groupId: string, userId: string): Promise<boolean> {
        const member = await this.getMember(groupId, userId);
        return member !== null;
    }

    /**
     * Get member count for a group
     */
    async getMemberCount(groupId: string): Promise<number> {
        const membersSnapshot = await this.getMembersCollection(groupId).get();
        return membersSnapshot.size;
    }
}

// Export singleton instance
export const memberService = new MemberService();
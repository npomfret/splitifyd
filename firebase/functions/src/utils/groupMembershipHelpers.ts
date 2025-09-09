import { GroupMemberDocument, TopLevelGroupMemberDocument } from '@splitifyd/shared';

/**
 * Helper functions for group membership document operations
 * Supports the dual-write pattern between subcollection and top-level collection
 */

/**
 * Creates a top-level membership document from a subcollection membership document
 * @param memberDoc - The original membership document from subcollection
 * @param groupUpdatedAt - The group's updatedAt timestamp for denormalization
 * @returns TopLevelGroupMemberDocument ready to be written to top-level collection (without timestamps)
 */
export function createTopLevelMembershipDocument(
    memberDoc: GroupMemberDocument, 
    groupUpdatedAt: string
): Omit<TopLevelGroupMemberDocument, 'createdAt' | 'updatedAt'> {
    return {
        ...memberDoc,
        groupUpdatedAt,
    };
}

/**
 * Generates a consistent document ID for top-level membership documents
 * Format: {userId}_{groupId}
 * @param userId - The user ID
 * @param groupId - The group ID
 * @returns Document ID string for top-level collection
 */
export function getTopLevelMembershipDocId(userId: string, groupId: string): string {
    return `${userId}_${groupId}`;
}
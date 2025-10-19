import type { GroupMembershipDTO, ISOString } from '@splitifyd/shared';
import { TopLevelGroupMemberDocument } from '../types';
import {GroupId} from "@splitifyd/shared";

/**
 * Helper functions for group membership document operations
 * Supports the dual-write pattern between subcollection and top-level collection
 */

/**
 * Creates a top-level membership document from a subcollection membership document
 * @param memberDoc - The original membership DTO (with ISO strings)
 * @param groupUpdatedAt - The group's updatedAt ISO string for denormalization
 * @returns TopLevelGroupMemberDocument ready to be written to top-level collection (without timestamps)
 *
 * Note: This function works with ISO strings throughout - no Timestamp objects.
 * FirestoreWriter will convert ISO strings to Timestamps at the write boundary.
 */
export function createTopLevelMembershipDocument(memberDoc: GroupMembershipDTO | any, groupUpdatedAt: ISOString): Omit<TopLevelGroupMemberDocument, 'createdAt' | 'updatedAt'> {
    return {
        ...memberDoc,
        // groupUpdatedAt is ISO string, FirestoreWriter converts to Timestamp
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
export function getTopLevelMembershipDocId(userId: string, groupId: GroupId): string {
    return `${userId}_${groupId}`;
}

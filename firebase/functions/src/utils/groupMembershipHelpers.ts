import type { GroupMembershipDTO, ISOString, UserId } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import { TopLevelGroupMemberDocument } from '../types';
import {newTopLevelMembershipDocId} from "@splitifyd/shared";

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

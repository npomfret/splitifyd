import { Timestamp } from 'firebase-admin/firestore';
import {GroupId} from "@splitifyd/shared";

/**
 * Document structure for top-level group memberships collection: group-memberships/{userId}_{groupId}
 *
 * This enables efficient pagination queries ordered by group activity.
 * Uses Firestore Timestamp objects for internal storage. When read by FirestoreReader,
 * these are converted to GroupMembershipDTO with ISO strings.
 *
 * Note: GroupMemberDocument removed from application layer - services use GroupMembershipDTO from @splitifyd/shared.
 * This TopLevelGroupMemberDocument type is ONLY used internally by FirestoreReader for type assertions.
 */
export interface TopLevelGroupMemberDocument {
    // Standard membership fields (from GroupMembershipDTO but with Timestamps)
    uid: string;
    groupId: GroupId; // For collectionGroup queries
    memberRole: string; // MemberRole enum value
    memberStatus: string; // MemberStatus enum value
    theme: {
        light: string;
        dark: string;
        name: string;
        pattern: string;
        assignedAt: string; // ISO string in storage
        colorIndex: number;
    };
    joinedAt: Timestamp;
    invitedBy?: string;

    // Top-level specific fields
    groupUpdatedAt: Timestamp; // From group.updatedAt - enables proper ordering
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * FirestoreCollections moved to '../constants'
 * Import directly from constants: import { FirestoreCollections } from '../constants';
 */

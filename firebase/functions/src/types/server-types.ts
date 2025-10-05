import { Timestamp } from "firebase-admin/firestore";

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
    groupId: string; // For collectionGroup queries
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
 * Per-group notification tracking within a user's document
 */
export interface UserNotificationGroupDocument {
    // Timestamps of last changes by type
    lastTransactionChange: Timestamp | null;
    lastBalanceChange: Timestamp | null;
    lastGroupDetailsChange: Timestamp | null;
    lastCommentChange: Timestamp | null;

    // Change counters for detecting missed updates
    transactionChangeCount: number;
    balanceChangeCount: number;
    groupDetailsChangeCount: number;
    commentChangeCount: number;
}

/**
 * Recent changes tracking (debugging and audit)
 */
export interface RecentChangeDocument {
    groupId: string;
    type: 'transaction' | 'balance' | 'group' | 'comment';
    timestamp: Timestamp;
}

/**
 * User notification document for client-side Firestore listeners.
 * Uses Timestamp because it's read directly by browser SDK real-time listeners.
 */
export interface UserNotificationDocument {
    // Global version counter - increments on every change
    changeVersion: number;

    // Per-group change tracking
    groups: Record<string, UserNotificationGroupDocument>;

    // Document metadata
    lastModified: Timestamp;

    // Optional: Recent changes for debugging (kept to last 10)
    recentChanges?: RecentChangeDocument[];
}

/**
 * FirestoreCollections moved to '../constants'
 * Import directly from constants: import { FirestoreCollections } from '../constants';
 */
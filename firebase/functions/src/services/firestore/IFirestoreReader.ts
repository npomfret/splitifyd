/**
 * Firestore Reader Interface
 *
 * Centralized interface for all Firestore read operations across the application.
 * This interface provides type-safe, validated access to all collections with
 * consistent error handling and performance monitoring.
 *
 * Design Principles:
 * - All methods return validated, typed data using Zod schemas
 * - Consistent null return for missing documents
 * - Consistent array return for collection queries
 * - Transaction-aware methods for complex operations
 * - Real-time subscription management
 */

import type { Transaction } from 'firebase-admin/firestore';
import { FirestoreTimestamp, MemberRole, MemberStatus } from '@splitifyd/shared';
import type { FirestoreAuditMetadata } from '../../schemas/common';

// FirestoreReader query and pagination types
interface PaginationOptions {
    limit?: number;
    offset?: number;
    cursor?: string;
}

/**
 * Standard Firestore document ordering fields
 */
export type FirestoreOrderField = keyof Pick<FirestoreAuditMetadata, 'createdAt' | 'updatedAt'>;

interface FilterOptions {
    includeDeleted?: boolean;
    dateRange?: {
        start?: FirestoreTimestamp;
        end?: FirestoreTimestamp;
    };
}

export interface GroupMemberQueryOptions {
    includeInactive?: boolean;
    roles?: MemberRole[];
    statuses?: MemberStatus[];
}

export interface QueryOptions extends PaginationOptions, FilterOptions {
    orderBy?: {
        field: string;
        direction: 'asc' | 'desc';
    };
}

export interface PaginatedResult<T> {
    data: T;
    hasMore: boolean;
    nextCursor?: string;
    totalEstimate?: number;
}

export interface GroupsPaginationCursor {
    lastGroupId: string;
    lastUpdatedAt: string;
    membershipCursor?: string;
}

export interface OrderBy {
    field: string;
    direction: 'asc' | 'desc';
}

export interface BatchGroupFetchOptions {
    orderBy: OrderBy;
    limit: number;
}

// Import parsed types from schemas
import type { UserDocument, GroupDocument, ExpenseDocument, SettlementDocument, PolicyDocument } from '../../schemas';
import type { GroupMemberDocument, CommentTargetType } from '@splitifyd/shared';
import type { UserNotificationDocument } from '../../schemas/user-notifications';
import type { ParsedShareLink } from '../../schemas';
import type { ParsedComment } from '../../schemas';

export interface IFirestoreReader {
    // ========================================================================
    // Document Read Operations
    // ========================================================================

    /**
     * Get a user document by ID
     * @param userId - The user ID
     * @returns User document or null if not found
     */
    getUser(userId: string): Promise<UserDocument | null>;

    /**
     * Get a group document by ID
     * @param groupId - The group ID
     * @returns Group document or null if not found
     */
    getGroup(groupId: string): Promise<GroupDocument | null>;

    /**
     * Get an expense document by ID
     * @param expenseId - The expense ID
     * @returns Expense document or null if not found
     */
    getExpense(expenseId: string): Promise<ExpenseDocument | null>;

    /**
     * Get a settlement document by ID
     * @param settlementId - The settlement ID
     * @returns Settlement document or null if not found
     */
    getSettlement(settlementId: string): Promise<SettlementDocument | null>;

    /**
     * Get a policy document by ID
     * @param policyId - The policy ID
     * @returns Policy document or null if not found
     */
    getPolicy(policyId: string): Promise<PolicyDocument | null>;

    /**
     * Get all policy documents
     * @returns Array of all policy documents
     */
    getAllPolicies(): Promise<PolicyDocument[]>;

    // ========================================================================
    // Collection Read Operations - User-related
    // ========================================================================

    /**
     * Get multiple user documents by IDs
     * @param userIds - Array of user IDs
     * @returns Array of user documents (missing users are excluded)
     */
    getUsersById(userIds: string[]): Promise<UserDocument[]>;

    // ========================================================================
    // Collection Read Operations - Group-related
    // ========================================================================


    /**
     * Get all groups where the user is a member using V2 implementation (top-level collection)
     * This method provides proper database-level ordering and fixes pagination issues
     * @param userId - The user ID
     * @param options - Query options for pagination and filtering
     * @returns Paginated result containing group documents, hasMore flag, and nextCursor
     */
    getGroupsForUserV2(
        userId: string,
        options?: {
            limit?: number;
            cursor?: string;
            orderBy?: {
                field: string;
                direction: 'asc' | 'desc';
            };
        },
    ): Promise<PaginatedResult<GroupDocument[]>>;

    /**
     * Get group members for a specific group
     * @param groupId - The group ID
     * @param options - Options for filtering members
     * @returns Array of group member documents
     */
    getGroupMembers(groupId: string, options?: GroupMemberQueryOptions): Promise<GroupMemberDocument[]>;

    /**
     * Get a single member from a group
     * @param groupId - The group ID
     * @param userId - The user ID to find
     * @returns Group member document or null if not found
     */
    getGroupMember(groupId: string, userId: string): Promise<GroupMemberDocument | null>;

    /**
     * Get all members for a group (simplified method)
     * @param groupId - The group ID
     * @returns Array of group member documents
     */
    getAllGroupMembers(groupId: string): Promise<GroupMemberDocument[]>;

    getAllGroupMemberIds(groupId: string): Promise<string[]>;

    // ========================================================================
    // Collection Read Operations - Expense-related
    // ========================================================================

    /**
     * Get all expenses for a specific group
     * @param groupId - The group ID
     * @param options - Query options for pagination and filtering
     * @returns Array of expense documents
     */
    getExpensesForGroup(groupId: string, options?: QueryOptions): Promise<ExpenseDocument[]>;


    /**
     * Get expense history for a specific expense
     * @param expenseId - The expense ID
     * @param limit - Maximum number of history records to return (default: 20)
     * @returns Object with history array and count
     */
    getExpenseHistory(
        expenseId: string,
        limit?: number,
    ): Promise<{
        history: any[];
        count: number;
    }>;

    /**
     * Get all expenses for a specific group with full pagination support
     * @param groupId - The group ID
     * @param options - Query options for pagination and filtering
     * @returns Object with expenses array, hasMore flag, and nextCursor
     */
    getExpensesForGroupPaginated(
        groupId: string,
        options?: {
            limit?: number;
            cursor?: string;
            includeDeleted?: boolean;
        },
    ): Promise<{
        expenses: ExpenseDocument[];
        hasMore: boolean;
        nextCursor?: string;
    }>;

    // ========================================================================
    // Collection Read Operations - Settlement-related
    // ========================================================================

    /**
     * Get all settlements for a specific group
     * @param groupId - The group ID
     * @param options - Query options for pagination and filtering
     * @returns Array of settlement documents
     */
    getSettlementsForGroup(groupId: string, options?: QueryOptions): Promise<SettlementDocument[]>;

    // ========================================================================
    // Collection Read Operations - Comment-related
    // ========================================================================

    // ========================================================================
    // Specialized Query Operations
    // ========================================================================

    // Note: getRecentGroupChanges removed as GROUP_CHANGES collection was unused

    // ========================================================================
    // Transaction-aware Read Operations
    // ========================================================================

    /**
     * Get a group document within a transaction context
     * @param transaction - The transaction context
     * @param groupId - The group ID
     * @returns Group document or null if not found
     */
    getGroupInTransaction(transaction: Transaction, groupId: string): Promise<GroupDocument | null>;

    /**
     * Get a user document within a transaction context
     * @param transaction - The transaction context
     * @param userId - The user ID
     * @returns User document or null if not found
     */
    getUserInTransaction(transaction: Transaction, userId: string): Promise<UserDocument | null>;


    // ========================================================================
    // Real-time Subscription Operations
    // ========================================================================

    // ========================================================================
    // Batch Operations
    // ========================================================================

    // ========================================================================
    // Performance Metrics Operations
    // ========================================================================

    // ========================================================================
    // Utility Operations
    // ========================================================================

    /**
     * Check if a document exists without reading its data
     * @param collection - The collection name
     * @param documentId - The document ID
     * @returns True if document exists, false otherwise
     */
    documentExists(collection: string, documentId: string): Promise<boolean>;



    // ========================================================================
    // User Notification Operations
    // ========================================================================

    /**
     * Get a user notification document by user ID
     * @param userId - The user ID
     * @returns User notification document or null if not found
     */
    getUserNotification(userId: string): Promise<UserNotificationDocument | null>;

    /**
     * Check if a user notification document exists
     * @param userId - The user ID
     * @returns True if notification document exists, false otherwise
     */
    userNotificationExists(userId: string): Promise<boolean>;

    // ========================================================================
    // Share Link Operations
    // ========================================================================

    /**
     * Find a share link by its token across all groups
     * @param token - The share link token
     * @returns Object with groupId and share link, or null if not found
     */
    findShareLinkByToken(token: string): Promise<{ groupId: string; shareLink: ParsedShareLink } | null>;

    /**
     * Get all active share links for a group
     * @param groupId - The group ID
     * @returns Array of share link documents
     */
    getShareLinksForGroup(groupId: string): Promise<ParsedShareLink[]>;

    /**
     * Get a specific share link by group and link ID
     * @param groupId - The group ID
     * @param shareLinkId - The share link ID
     * @returns Share link document or null if not found
     */
    getShareLink(groupId: string, shareLinkId: string): Promise<ParsedShareLink | null>;

    // ========================================================================
    // Comment Operations
    // ========================================================================

    /**
     * Get paginated comments for a target (group or expense)
     * @param targetType - The target type (group or expense)
     * @param targetId - The target ID
     * @param options - Pagination and ordering options
     * @returns Object with comments array, hasMore flag, and nextCursor
     */
    getCommentsForTarget(
        targetType: CommentTargetType,
        targetId: string,
        options?: {
            limit?: number;
            cursor?: string;
            orderBy?: FirestoreOrderField;
            direction?: 'asc' | 'desc';
        },
    ): Promise<{ comments: ParsedComment[]; hasMore: boolean; nextCursor?: string }>;

    /**
     * Get a specific comment by target and comment ID
     * @param targetType - The target type (group or expense)
     * @param targetId - The target ID
     * @param commentId - The comment ID
     * @returns Comment document or null if not found
     */
    getComment(targetType: CommentTargetType, targetId: string, commentId: string): Promise<ParsedComment | null>;

    /**
     * Get a comment by its document reference
     * @param commentDocRef - The comment document reference
     * @returns Comment document or null if not found
     */
    getCommentByReference(commentDocRef: FirebaseFirestore.DocumentReference): Promise<ParsedComment | null>;



    // ========================================================================
    // Group Related Collections Operations
    // ========================================================================

    /**
     * Get all related data for a group deletion operation
     * @param groupId - The group ID
     * @returns Object containing all related collections data
     */
    getGroupDeletionData(groupId: string): Promise<{
        expenses: FirebaseFirestore.QuerySnapshot;
        settlements: FirebaseFirestore.QuerySnapshot;
        shareLinks: FirebaseFirestore.QuerySnapshot;
        groupComments: FirebaseFirestore.QuerySnapshot;
        expenseComments: FirebaseFirestore.QuerySnapshot[];
    }>;


    // ========================================================================
    // Settlement Query Operations
    // ========================================================================

    /**
     * Get paginated settlements for a group with filtering and ordering
     * @param groupId - The group ID
     * @param options - Query options including pagination, filters, and ordering
     * @returns Object with settlements array, hasMore flag, and nextCursor
     */
    getSettlementsForGroupPaginated(
        groupId: string,
        options?: {
            limit?: number;
            cursor?: string;
            filterUserId?: string;
            startDate?: string;
            endDate?: string;
        },
    ): Promise<{
        settlements: SettlementDocument[];
        hasMore: boolean;
        nextCursor?: string;
    }>;

    // ========================================================================
    // System Document Operations
    // ========================================================================


    // ========================================================================
    // Group Membership Verification
    // ========================================================================

    /**
     * Verify if a user is a member of a group
     * @param groupId - The group ID
     * @param userId - The user ID
     * @returns True if user is a member, false otherwise
     */
    verifyGroupMembership(groupId: string, userId: string): Promise<boolean>;

    // ========================================================================
    // Subcollection Operations
    // ========================================================================





    // ========================================================================
    // Raw Document Access (for special cases like optimistic locking)
    // ========================================================================


    /**
     * Get raw document data in a transaction
     * @param transaction - Firestore transaction
     * @param collection - Collection name
     * @param docId - Document ID
     * @returns Raw document snapshot or null if not found
     */
    getRawDocumentInTransaction(transaction: Transaction, collection: string, docId: string): Promise<FirebaseFirestore.DocumentSnapshot | null>;


    /**
     * Get raw group document for optimistic locking scenarios
     * @param groupId - The group ID
     * @returns Raw document snapshot or null if not found
     */
    getRawGroupDocument(groupId: string): Promise<FirebaseFirestore.DocumentSnapshot | null>;

    /**
     * Get raw policy document for optimistic locking scenarios
     * @param policyId - The policy ID
     * @returns Raw document snapshot or null if not found
     */
    getRawPolicyDocument(policyId: string): Promise<FirebaseFirestore.DocumentSnapshot | null>;

    /**
     * Get raw group document in a transaction for optimistic locking
     * @param transaction - Firestore transaction
     * @param groupId - The group ID
     * @returns Raw document snapshot or null if not found
     */
    getRawGroupDocumentInTransaction(transaction: Transaction, groupId: string): Promise<FirebaseFirestore.DocumentSnapshot | null>;

    /**
     * Get raw expense document in a transaction for optimistic locking
     * @param transaction - Firestore transaction
     * @param expenseId - The expense ID
     * @returns Raw document snapshot or null if not found
     */
    getRawExpenseDocumentInTransaction(transaction: Transaction, expenseId: string): Promise<FirebaseFirestore.DocumentSnapshot | null>;

    /**
     * Get raw settlement document in a transaction for optimistic locking
     * @param transaction - Firestore transaction
     * @param settlementId - The settlement ID
     * @returns Raw document snapshot or null if not found
     */
    getRawSettlementDocumentInTransaction(transaction: Transaction, settlementId: string): Promise<FirebaseFirestore.DocumentSnapshot | null>;

    /**
     * Get raw user document in a transaction for optimistic locking
     * @param transaction - Firestore transaction
     * @param userId - The user ID
     * @returns Raw document snapshot or null if not found
     */
    getRawUserDocumentInTransaction(transaction: Transaction, userId: string): Promise<FirebaseFirestore.DocumentSnapshot | null>;



    /**
     * Get group membership documents in a transaction
     * @param transaction - The Firestore transaction
     * @param groupId - The group ID to query memberships for
     * @returns Array of raw document snapshots
     */
    getGroupMembershipsInTransaction(transaction: Transaction, groupId: string): Promise<FirebaseFirestore.QuerySnapshot>;
}

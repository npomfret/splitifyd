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

import type { Transaction, DocumentReference } from 'firebase-admin/firestore';
import {
    QueryOptions,
    GroupMemberQueryOptions,
    PaginatedResult
} from '../../types/firestore-reader-types';

// Import parsed types from schemas
import type {
    UserDocument,
    GroupDocument,
    ExpenseDocument,
    SettlementDocument,
    PolicyDocument
} from '../../schemas';
import type { GroupMemberDocument, CommentTargetType } from '@splitifyd/shared';
import type { UserNotificationDocument } from '../../schemas/user-notifications';
import type { ParsedShareLink } from '../../schemas/sharelink';
import type { ParsedComment } from '../../schemas/comment';

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
     * Get all groups where the user is a member with pagination support
     * @param userId - The user ID
     * @param options - Query options for pagination and filtering
     * @returns Paginated result containing group documents, hasMore flag, and nextCursor
     */
    getGroupsForUser(userId: string, options?: QueryOptions): Promise<PaginatedResult<GroupDocument[]>>;

    /**
     * Get group members for a specific group
     * @param groupId - The group ID
     * @param options - Options for filtering members
     * @returns Array of group member documents
     */
    getGroupMembers(groupId: string, options?: GroupMemberQueryOptions): Promise<GroupMemberDocument[]>;

    /**
     * Get a single member from group's member subcollection
     * @param groupId - The group ID
     * @param userId - The user ID to find
     * @returns Group member document or null if not found
     */
    getMemberFromSubcollection(groupId: string, userId: string): Promise<GroupMemberDocument | null>;

    /**
     * Get all members for a group from the member subcollection
     * @param groupId - The group ID
     * @returns Array of group member documents
     */
    getMembersFromSubcollection(groupId: string): Promise<GroupMemberDocument[]>;

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

    /**
     * Get multiple documents within a transaction context
     * @param transaction - The transaction context
     * @param refs - Array of document references to read
     * @returns Array of document snapshots
     */
    getMultipleInTransaction<T>(
        transaction: Transaction,
        refs: DocumentReference[]
    ): Promise<T[]>;

    // ========================================================================
    // Real-time Subscription Operations
    // ========================================================================




    // ========================================================================
    // Batch Operations
    // ========================================================================


    // ========================================================================
    // Performance Metrics Operations
    // ========================================================================

    /**
     * Query performance metrics from the metrics collection
     * @param collectionName - The metrics collection name (e.g., 'performance-metrics')
     * @param minutes - Number of minutes to look back from now
     * @param filters - Optional filters for operation type, name, and success status
     * @returns Array of performance metrics
     */
    queryPerformanceMetrics(
        collectionName: string,
        minutes: number,
        filters?: {
            operationType?: string;
            operationName?: string;
            success?: boolean;
        }
    ): Promise<any[]>;

    /**
     * Query aggregated performance statistics
     * @param collectionName - The aggregates collection name (e.g., 'performance-aggregates')  
     * @param period - The time period for aggregation ('hour', 'day', 'week')
     * @param lookbackCount - Number of periods to look back (default: 24)
     * @returns Array of aggregated statistics
     */
    queryAggregatedStats(
        collectionName: string,
        period: 'hour' | 'day' | 'week',
        lookbackCount?: number
    ): Promise<any[]>;

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
            orderBy?: 'createdAt' | 'updatedAt';
            direction?: 'asc' | 'desc';
        }
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
    // Test User Pool Operations
    // ========================================================================

    /**
     * Get an available test user from the pool
     * @returns Available test user or null if none available
     */
    getAvailableTestUser(): Promise<any | null>;

    /**
     * Get a test user by email
     * @param email - The test user email
     * @returns Test user document or null if not found
     */
    getTestUser(email: string): Promise<any | null>;

    /**
     * Get test user pool status with counts
     * @returns Pool status with available, borrowed, and total counts
     */
    getTestUserPoolStatus(): Promise<{ available: number; borrowed: number; total: number }>;

    /**
     * Get all borrowed test users for cleanup operations
     * @returns Array of borrowed test user documents
     */
    getBorrowedTestUsers(): Promise<FirebaseFirestore.QueryDocumentSnapshot[]>;

    // ========================================================================
    // System Metrics Operations
    // ========================================================================

    /**
     * Get old documents for cleanup operations
     * @param collection - The collection name
     * @param cutoffDate - The cutoff date for old documents
     * @param limit - Maximum number of documents to return
     * @returns Array of document snapshots
     */
    getOldDocuments(
        collection: string,
        cutoffDate: Date,
        limit?: number
    ): Promise<FirebaseFirestore.DocumentSnapshot[]>;

    /**
     * Get old documents for cleanup operations with custom timestamp field
     * @param collection - The collection name
     * @param timestampField - The timestamp field name
     * @param cutoffDate - The cutoff date for old documents
     * @param limit - Maximum number of documents to return
     * @returns Array of old document snapshots
     */
    getOldDocumentsByField(
        collection: string,
        timestampField: string,
        cutoffDate: Date,
        limit?: number
    ): Promise<FirebaseFirestore.DocumentSnapshot[]>;

    /**
     * Get a batch of documents from a collection (for deletion operations)
     * @param collection - The collection name
     * @param limit - Maximum number of documents to return
     * @returns Array of document snapshots
     */
    getDocumentsBatch(
        collection: string,
        limit?: number
    ): Promise<FirebaseFirestore.DocumentSnapshot[]>;

    /**
     * Get metrics documents based on timestamp field
     * @param collection - The collection name
     * @param timestampField - The timestamp field name
     * @param cutoffTimestamp - The cutoff timestamp
     * @param limit - Maximum number of documents to return
     * @returns Array of document snapshots
     */
    getMetricsDocuments(
        collection: string,
        timestampField: string,
        cutoffTimestamp: any,
        limit?: number
    ): Promise<FirebaseFirestore.DocumentSnapshot[]>;

    /**
     * Get the size of a collection
     * @param collection - The collection name
     * @returns The number of documents in the collection
     */
    getCollectionSize(collection: string): Promise<number>;

}
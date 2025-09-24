/**
 * Firestore Writer Interface
 *
 * Centralized interface for all Firestore write operations across the application.
 * This interface provides type-safe, validated write access to all collections with
 * consistent error handling, validation, and performance monitoring.
 *
 * Design Principles:
 * - All write operations validate data before writing
 * - Consistent error handling and rollback strategies
 * - Transaction support for atomic operations
 * - Batch write support for bulk operations
 * - Audit logging for all write operations
 * - Performance monitoring with sampling
 */

import type { Transaction, WriteBatch, DocumentReference, Timestamp } from 'firebase-admin/firestore';
import type { CommentTargetType } from '@splitifyd/shared';

/**
 * Options for configuring transaction behavior including retry logic
 */
export interface TransactionOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts?: number;
    /** Base delay in milliseconds for retry backoff (default: 100) */
    baseDelayMs?: number;
    /** Context information for logging and debugging */
    context?: {
        /** Operation name for logging */
        operation?: string;
        /** User ID involved in the transaction */
        userId?: string;
        /** Group ID involved in the transaction */
        groupId?: string;
        /** Additional context properties */
        [key: string]: any;
    };
}
import type { UserDocument, GroupDocument, ExpenseDocument, SettlementDocument } from '../../schemas';
import type { ParsedComment as CommentDocument } from '../../schemas';
import type { ShareLink } from '@splitifyd/shared';
import type { UserNotificationGroup, CreateUserNotificationDocument } from '../../schemas/user-notifications';

export interface WriteResult {
    id: string;
    success: boolean;
    timestamp?: Timestamp;
    error?: string;
}

export interface BatchWriteResult {
    successCount: number;
    failureCount: number;
    results: WriteResult[];
}

export interface IFirestoreWriter {
    // ========================================================================
    // User Write Operations
    // ========================================================================

    /**
     * Create a new user document
     * @param userId - The user ID (usually from Firebase Auth)
     * @param userData - The user data to write
     * @returns Write result with document ID
     */
    createUser(userId: string, userData: Omit<UserDocument, 'id'>): Promise<WriteResult>;

    /**
     * Update an existing user document
     * @param userId - The user ID
     * @param updates - Partial user data to update
     * @returns Write result
     */
    updateUser(userId: string, updates: Partial<Omit<UserDocument, 'id'>>): Promise<WriteResult>;

    /**
     * Delete a user document
     * @param userId - The user ID
     * @returns Write result
     */
    deleteUser(userId: string): Promise<WriteResult>;

    // ========================================================================
    // Group Write Operations
    // ========================================================================

    /**
     * Create a new group document
     * @param groupData - The group data to write
     * @returns Write result with generated document ID
     */
    createGroup(groupData: Omit<GroupDocument, 'id'>): Promise<WriteResult>;

    /**
     * Update an existing group document
     * @param groupId - The group ID
     * @param updates - Partial group data to update
     * @returns Write result
     */
    updateGroup(groupId: string, updates: Partial<Omit<GroupDocument, 'id'>>): Promise<WriteResult>;

    /**
     * Delete a group and all its subcollections
     * @param groupId - The group ID
     * @returns Write result
     */
    deleteGroup(groupId: string): Promise<WriteResult>;

    // ========================================================================
    // Expense Write Operations
    // ========================================================================

    /**
     * Create a new expense document
     * @param expenseData - The expense data to write
     * @returns Write result with generated document ID
     */
    createExpense(expenseData: Omit<ExpenseDocument, 'id'>): Promise<WriteResult>;

    /**
     * Update an existing expense document
     * @param expenseId - The expense ID
     * @param updates - Partial expense data to update
     * @returns Write result
     */
    updateExpense(expenseId: string, updates: Partial<Omit<ExpenseDocument, 'id'>>): Promise<WriteResult>;

    /**
     * Delete an expense document
     * @param expenseId - The expense ID
     * @returns Write result
     */
    deleteExpense(expenseId: string): Promise<WriteResult>;

    // ========================================================================
    // Settlement Write Operations
    // ========================================================================

    /**
     * Create a new settlement document
     * @param settlementData - The settlement data to write
     * @returns Write result with generated document ID
     */
    createSettlement(settlementData: Omit<SettlementDocument, 'id'>): Promise<WriteResult>;

    /**
     * Update an existing settlement document
     * @param settlementId - The settlement ID
     * @param updates - Partial settlement data to update
     * @returns Write result
     */
    updateSettlement(settlementId: string, updates: Partial<Omit<SettlementDocument, 'id'>>): Promise<WriteResult>;

    /**
     * Delete a settlement document
     * @param settlementId - The settlement ID
     * @returns Write result
     */
    deleteSettlement(settlementId: string): Promise<WriteResult>;

    // ========================================================================
    // Comment Write Operations
    // ========================================================================

    /**
     * Add a comment to a group, expense or settlement
     * @param targetType - 'group', 'expense' or 'settlement'
     * @param targetId - The group, expense or settlement ID
     * @param commentData - The comment data
     * @returns Write result with generated comment ID
     */
    addComment(targetType: CommentTargetType, targetId: string, commentData: Omit<CommentDocument, 'id'>): Promise<WriteResult>;

    /**
     * Update a comment
     * @param targetType - 'expense' or 'settlement'
     * @param targetId - The expense or settlement ID
     * @param commentId - The comment ID
     * @param updates - Partial comment data to update
     * @returns Write result
     */
    updateComment(targetType: 'expense' | 'settlement', targetId: string, commentId: string, updates: Partial<Omit<CommentDocument, 'id'>>): Promise<WriteResult>;

    /**
     * Delete a comment
     * @param targetType - 'expense' or 'settlement'
     * @param targetId - The expense or settlement ID
     * @param commentId - The comment ID
     * @returns Write result
     */
    deleteComment(targetType: 'expense' | 'settlement', targetId: string, commentId: string): Promise<WriteResult>;

    // ========================================================================
    // Batch Operations
    // ========================================================================

    /**
     * Perform multiple write operations in a batch
     * @param operations - Function that adds operations to the batch
     * @returns Batch write result
     * @deprecated Unused method - no usages found in codebase
     */
    batchWrite(operations: (batch: WriteBatch) => void): Promise<BatchWriteResult>;

    /**
     * Bulk create multiple documents
     * @param collection - The collection name
     * @param documents - Array of documents to create
     * @returns Batch write result
     * @deprecated Unused method - no usages found in codebase
     */
    bulkCreate<T>(collection: string, documents: T[]): Promise<BatchWriteResult>;

    /**
     * Bulk update multiple documents
     * @param updates - Map of document paths to update data
     * @returns Batch write result
     * @deprecated Unused method - no usages found in codebase
     */
    bulkUpdate(updates: Map<string, any>): Promise<BatchWriteResult>;

    /**
     * Bulk delete multiple documents
     * @param documentPaths - Array of document paths to delete
     * @returns Batch write result
     * @deprecated Unused method - no usages found in codebase
     */
    bulkDelete(documentPaths: string[]): Promise<BatchWriteResult>;

    // ========================================================================
    // Share Link Operations
    // ========================================================================

    /**
     * Create a share link within a transaction
     * @param transaction - The transaction object
     * @param groupId - The group ID
     * @param shareLinkData - The share link data
     * @returns Document reference
     */
    createShareLinkInTransaction(transaction: Transaction, groupId: string, shareLinkData: Omit<ShareLink, 'id'>): DocumentReference;

    // ========================================================================
    // Member Operations in Transactions
    // ========================================================================

    /**
     * Update a group within a transaction
     * @param transaction - The transaction object
     * @param groupId - The group ID
     * @param updates - The update data
     */
    updateGroupInTransaction(transaction: Transaction, groupId: string, updates: any): void;

    // ========================================================================
    // Notification Operations
    // ========================================================================

    /**
     * Update user notifications
     * @param userId - The user ID
     * @param updates - The notification updates
     * @returns Write result
     * @deprecated Legacy method - use updateUserNotification instead
     */
    updateUserNotifications(userId: string, updates: any): Promise<WriteResult>;

    /**
     * Set user notifications with merge option
     * @param userId - The user ID
     * @param data - The notification data
     * @param merge - Whether to merge with existing data
     * @returns Write result
     * @deprecated Legacy method - use setUserNotificationGroup instead
     */
    setUserNotifications(userId: string, data: any, merge?: boolean): Promise<WriteResult>;

    // ========================================================================
    // Policy Operations
    // ========================================================================

    /**
     * Create a policy document
     * @param policyId - The policy ID (optional, auto-generated if not provided)
     * @param policyData - The policy data
     * @returns Write result
     */
    createPolicy(policyId: string | null, policyData: any): Promise<WriteResult>;

    /**
     * Update a policy document
     * @param policyId - The policy ID
     * @param updates - The policy updates
     * @returns Write result
     */
    updatePolicy(policyId: string, updates: any): Promise<WriteResult>;

    // ========================================================================
    // Transaction Operations
    // ========================================================================

    /**
     * Run a transaction with custom logic and retry support
     * @param updateFunction - Function that performs transactional operations
     * @param options - Optional transaction configuration including retry behavior
     * @returns Transaction result
     */
    runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>, options?: TransactionOptions): Promise<T>;

    /**
     * Create a document within a transaction
     * @param transaction - The transaction object
     * @param collection - The collection name
     * @param documentId - Optional document ID (auto-generated if not provided)
     * @param data - The document data
     * @returns Document reference
     */
    createInTransaction(transaction: Transaction, collection: string, documentId: string | null, data: any): DocumentReference;

    /**
     * Update a document within a transaction
     * @param transaction - The transaction object
     * @param documentPath - The full document path
     * @param updates - The update data
     */
    updateInTransaction(transaction: Transaction, documentPath: string, updates: any): void;

    /**
     * Delete a document within a transaction
     * @param transaction - The transaction object
     * @param documentPath - The full document path
     */
    deleteInTransaction(transaction: Transaction, documentPath: string): void;

    // ========================================================================
    // Generic Document Operations
    // ========================================================================

    /**
     * Create a single document by path
     * @param documentPath - The full document path (e.g., 'group-memberships/userId_groupId')
     * @param data - The document data
     * @returns Write result
     * @deprecated Generic methods not used - prefer specific typed methods
     */
    createDocument(documentPath: string, data: any): Promise<WriteResult>;

    /**
     * Update a single document by path
     * @param documentPath - The full document path (e.g., 'user-notifications/userId')
     * @param updates - The update data
     * @returns Write result
     * @deprecated Generic methods not used - prefer specific typed methods
     */
    updateDocument(documentPath: string, updates: any): Promise<WriteResult>;

    /**
     * Delete a single document by path
     * @param documentPath - The full document path (e.g., 'group-memberships/userId_groupId')
     * @returns Write result
     * @deprecated Generic methods not used - prefer specific typed methods
     */
    deleteDocument(documentPath: string): Promise<WriteResult>;

    // ========================================================================
    // Utility Operations
    // ========================================================================

    /**
     * Generate a new document ID for a collection
     * @param collection - The collection name to generate ID for
     * @returns Generated document ID
     */
    generateDocumentId(collection: string): string;

    // ========================================================================
    // User Notification Operations
    // ========================================================================

    /**
     * Create a new user notification document
     * @param userId - The user ID
     * @param notificationData - The notification document data
     * @returns Write result with document ID
     */
    createUserNotification(userId: string, notificationData: CreateUserNotificationDocument): Promise<WriteResult>;

    /**
     * Update user notification document
     * @param userId - The user ID
     * @param updates - The update data (validated before writing)
     * @returns Write result
     */
    updateUserNotification(userId: string, updates: Record<string, any>): Promise<WriteResult>;

    /**
     * Add or update a group in user's notification tracking
     * @param userId - The user ID
     * @param groupId - The group ID
     * @param groupData - The group notification data
     * @returns Write result
     */
    setUserNotificationGroup(userId: string, groupId: string, groupData: UserNotificationGroup): Promise<WriteResult>;

    /**
     * Remove a group from user's notification tracking
     * @param userId - The user ID
     * @param groupId - The group ID to remove
     * @returns Write result
     */
    removeUserNotificationGroup(userId: string, groupId: string): Promise<WriteResult>;

    /**
     * Set user notification group data within a transaction
     * @param transaction - The Firestore transaction
     * @param userId - The user ID
     * @param groupId - The group ID
     * @param groupData - The group notification data
     */
    setUserNotificationGroupInTransaction(transaction: Transaction, userId: string, groupId: string, groupData: UserNotificationGroup): void;

    // ========================================================================
    // System Operations
    // ========================================================================

    /**
     * Add system metrics document for monitoring
     * @param metricsData - The metrics data to store
     * @returns Write result with document ID
     * @deprecated Unused method - no usages found in codebase
     */
    addSystemMetrics(metricsData: any): Promise<WriteResult>;

    /**
     * Perform health check operations (test read/write)
     * @returns Health check result with timing information
     */
    performHealthCheck(): Promise<{ success: boolean; responseTime: number }>;

    // ========================================================================
    // Test User Pool Operations (Test Environment Only)
    // ========================================================================

    /**
     * Create a test user in the user pool
     * @param email - Test user email
     * @param userData - Test user data including token and password
     * @returns Write result
     * @deprecated Test-only method - used only in TestUserPoolService for test infrastructure
     */
    createTestUser(email: string, userData: any): Promise<WriteResult>;

    /**
     * Update test user status in the pool
     * @param email - Test user email
     * @param status - New status ('available' or 'borrowed')
     * @returns Write result
     * @deprecated Test-only method - used only in TestUserPoolService for test infrastructure
     */
    updateTestUserStatus(email: string, status: string): Promise<WriteResult>;

    // ========================================================================
    // Transaction Helper Methods (Phase 1 - Transaction Foundation)
    // ========================================================================

    /**
     * Delete multiple documents within a transaction atomically
     * @param transaction - The transaction context
     * @param documentPaths - Array of document paths to delete
     * @throws Error if any deletion fails (transaction will be aborted)
     */
    bulkDeleteInTransaction(transaction: Transaction, documentPaths: string[]): void;

    /**
     * Query and update multiple documents within a transaction
     * @param transaction - The transaction context
     * @param collectionPath - Collection to query
     * @param queryConstraints - Query constraints (where clauses)
     * @param updates - Updates to apply to all matched documents
     * @returns Promise<number> Number of documents updated
     * @deprecated Unused method - no usages found in codebase
     */
    queryAndUpdateInTransaction(
        transaction: Transaction,
        collectionPath: string,
        queryConstraints: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: any }>,
        updates: Record<string, any>,
    ): Promise<number>;

    /**
     * Create multiple documents within a transaction
     * @param transaction - The transaction context
     * @param creates - Array of documents to create
     * @returns Array of document references created
     * @deprecated Unused method - no usages found in codebase
     */
    batchCreateInTransaction(
        transaction: Transaction,
        creates: Array<{
            collection: string;
            id?: string;
            data: any;
        }>,
    ): DocumentReference[];

    /**
     * Get multiple documents within a transaction by paths
     * @param transaction - The transaction context
     * @param documentPaths - Array of document paths to fetch
     * @returns Promise<Array<DocumentSnapshot | null>> Array of document snapshots (null for non-existent docs)
     * @deprecated Unused method - no usages found in codebase
     */
    getMultipleByPathsInTransaction(transaction: Transaction, documentPaths: string[]): Promise<Array<FirebaseFirestore.DocumentSnapshot | null>>;

    // ========================================================================
    // Group Deletion and Recovery Operations
    // ========================================================================

    /**
     * Get a document reference within a transaction for complex operations
     * @param transaction - The transaction context
     * @param collection - The collection name
     * @param documentId - The document ID
     * @returns Document reference for transaction operations
     */
    getDocumentReferenceInTransaction(transaction: Transaction, collection: string, documentId: string): FirebaseFirestore.DocumentReference;

    /**
     * Query groups by deletion status with timestamp filters
     * @param deletionStatus - The deletion status to filter by ('deleting', 'failed', etc.)
     * @param cutoffTimestamp - Optional timestamp filter for deletionStartedAt
     * @param operator - Comparison operator for timestamp ('<=', '>=', etc.)
     * @returns Promise<Array<string>> Array of group IDs matching the criteria
     * @deprecated Unused method - no usages found in codebase
     */
    queryGroupsByDeletionStatus(deletionStatus: string, cutoffTimestamp?: FirebaseFirestore.Timestamp, operator?: FirebaseFirestore.WhereFilterOp): Promise<string[]>;

    /**
     * Get a single document by path (for non-transaction operations)
     * @param collection - The collection name
     * @param documentId - The document ID
     * @returns Promise<DocumentSnapshot | null> Document snapshot or null if not found
     * @deprecated Unused method - no usages found in codebase
     */
    getSingleDocument(collection: string, documentId: string): Promise<FirebaseFirestore.DocumentSnapshot | null>;

    /**
     * Atomically delete a group membership and remove the user from notification tracking
     * @param membershipDocId - The membership document ID to delete
     * @param userId - The user ID to remove from notifications
     * @param groupId - The group ID to remove from notifications
     * @returns Batch write result
     */
    deleteMemberAndNotifications(membershipDocId: string, userId: string, groupId: string): Promise<BatchWriteResult>;

    /**
     * Atomically update group timestamp, delete membership, and remove from notifications
     * @param groupId - The group ID to update
     * @param userId - The user ID to remove from notifications
     * @returns Batch write result
     */
    leaveGroupAtomic(groupId: string, userId: string): Promise<BatchWriteResult>;
}

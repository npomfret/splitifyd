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
import type {
    UserDocument,
    GroupDocument,
    ExpenseDocument,
    SettlementDocument
} from '../../schemas';
import type { ParsedComment as CommentDocument } from '../../schemas';
import type { GroupMemberDocument, ShareLink } from '@splitifyd/shared';
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
    addComment(targetType: 'group' | 'expense' | 'settlement', targetId: string, commentData: Omit<CommentDocument, 'id'>): Promise<WriteResult>;

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
     */
    batchWrite(operations: (batch: WriteBatch) => void): Promise<BatchWriteResult>;

    /**
     * Bulk create multiple documents
     * @param collection - The collection name
     * @param documents - Array of documents to create
     * @returns Batch write result
     */
    bulkCreate<T>(collection: string, documents: T[]): Promise<BatchWriteResult>;

    /**
     * Bulk update multiple documents
     * @param updates - Map of document paths to update data
     * @returns Batch write result
     */
    bulkUpdate(updates: Map<string, any>): Promise<BatchWriteResult>;

    /**
     * Bulk delete multiple documents
     * @param documentPaths - Array of document paths to delete
     * @returns Batch write result
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
    createShareLinkInTransaction(
        transaction: Transaction,
        groupId: string,
        shareLinkData: Omit<ShareLink, 'id'>
    ): DocumentReference;

    // ========================================================================
    // Member Operations in Transactions
    // ========================================================================

    /**
     * Update a group within a transaction
     * @param transaction - The transaction object
     * @param groupId - The group ID
     * @param updates - The update data
     */
    updateGroupInTransaction(
        transaction: Transaction,
        groupId: string,
        updates: any
    ): void;

    // ========================================================================
    // Notification Operations
    // ========================================================================

    /**
     * Update user notifications
     * @param userId - The user ID
     * @param updates - The notification updates
     * @returns Write result
     */
    updateUserNotifications(userId: string, updates: any): Promise<WriteResult>;

    /**
     * Set user notifications with merge option
     * @param userId - The user ID
     * @param data - The notification data
     * @param merge - Whether to merge with existing data
     * @returns Write result
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
    runTransaction<T>(
        updateFunction: (transaction: Transaction) => Promise<T>,
        options?: TransactionOptions
    ): Promise<T>;

    /**
     * Create a document within a transaction
     * @param transaction - The transaction object
     * @param collection - The collection name
     * @param documentId - Optional document ID (auto-generated if not provided)
     * @param data - The document data
     * @returns Document reference
     */
    createInTransaction(
        transaction: Transaction,
        collection: string,
        documentId: string | null,
        data: any
    ): DocumentReference;

    /**
     * Update a document within a transaction
     * @param transaction - The transaction object
     * @param documentPath - The full document path
     * @param updates - The update data
     */
    updateInTransaction(
        transaction: Transaction,
        documentPath: string,
        updates: any
    ): void;

    /**
     * Delete a document within a transaction
     * @param transaction - The transaction object
     * @param documentPath - The full document path
     */
    deleteInTransaction(
        transaction: Transaction,
        documentPath: string
    ): void;

    // ========================================================================
    // Generic Document Operations
    // ========================================================================

    /**
     * Create a single document by path
     * @param documentPath - The full document path (e.g., 'group-memberships/userId_groupId')
     * @param data - The document data
     * @returns Write result
     */
    createDocument(documentPath: string, data: any): Promise<WriteResult>;

    /**
     * Update a single document by path
     * @param documentPath - The full document path (e.g., 'user-notifications/userId')
     * @param updates - The update data
     * @returns Write result
     */
    updateDocument(documentPath: string, updates: any): Promise<WriteResult>;

    /**
     * Delete a single document by path
     * @param documentPath - The full document path (e.g., 'group-memberships/userId_groupId')
     * @returns Write result
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

    // ========================================================================
    // System Operations
    // ========================================================================

    /**
     * Add system metrics document for monitoring
     * @param metricsData - The metrics data to store
     * @returns Write result with document ID
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
     */
    createTestUser(email: string, userData: any): Promise<WriteResult>;

    /**
     * Update test user status in the pool
     * @param email - Test user email
     * @param status - New status ('available' or 'borrowed')
     * @returns Write result
     */
    updateTestUserStatus(email: string, status: string): Promise<WriteResult>;

}
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

import type { Transaction, DocumentReference, Timestamp } from 'firebase-admin/firestore';
import type { CommentTargetType, ShareLinkDTO, ExpenseDTO, GroupDTO, SettlementDTO, RegisteredUser, CommentDTO } from '@splitifyd/shared';

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
import type { CreateUserNotificationDocument } from '../../schemas/user-notifications';

export interface WriteResult {
    id: string;
    success: boolean;
    timestamp?: Timestamp | Date;//todo: remove this
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
     * @param userId - The user ID (usually from Firebase Auth) - becomes the document ID
     * @param userData - The user data to write (DTO with ISO strings, excluding uid/emailVerified which are not stored in Firestore)
     * @returns Write result with document ID
     */
    createUser(userId: string, userData: Omit<RegisteredUser, 'id' | 'uid' | 'emailVerified'>): Promise<WriteResult>;

    /**
     * Update an existing user document
     * @param userId - The user ID
     * @param updates - Partial user data to update (DTO with ISO strings)
     * @returns Write result
     */
    updateUser(userId: string, updates: Partial<Omit<RegisteredUser, 'id'>>): Promise<WriteResult>;

    /**
     * Delete a user document
     * @param userId - The user ID
     * @returns Write result
     * @deprecated This method is not used in production code. User deletion logic exists in UserService2 using direct auth service calls.
     */
    deleteUser(userId: string): Promise<WriteResult>;

    // ========================================================================
    // Group Write Operations
    // ========================================================================

    /**
     * Create a new group document
     * @param groupData - The group data to write (DTO with ISO strings)
     * @returns Write result with generated document ID
     */
    createGroup(groupData: Omit<GroupDTO, 'id'>): Promise<WriteResult>;

    /**
     * Update an existing group document
     * @param groupId - The group ID
     * @param updates - Partial group data to update (DTO with ISO strings)
     * @returns Write result
     */
    updateGroup(groupId: string, updates: Partial<Omit<GroupDTO, 'id'>>): Promise<WriteResult>;

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
     * @param expenseData - The expense data to write (DTO with ISO strings)
     * @returns Write result with generated document ID
     */
    createExpense(expenseData: Omit<ExpenseDTO, 'id'>): Promise<WriteResult>;

    /**
     * Update an existing expense document
     * @param expenseId - The expense ID
     * @param updates - Partial expense data to update (DTO with ISO strings)
     * @returns Write result
     */
    updateExpense(expenseId: string, updates: Partial<Omit<ExpenseDTO, 'id'>>): Promise<WriteResult>;

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
     * @param settlementData - The settlement data to write (DTO with ISO strings)
     * @returns Write result with generated document ID
     */
    createSettlement(settlementData: Omit<SettlementDTO, 'id'>): Promise<WriteResult>;

    /**
     * Update an existing settlement document
     * @param settlementId - The settlement ID
     * @param updates - Partial settlement data to update (DTO with ISO strings)
     * @returns Write result
     */
    updateSettlement(settlementId: string, updates: Partial<Omit<SettlementDTO, 'id'>>): Promise<WriteResult>;

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
     * @param commentData - The comment data (DTO with ISO strings)
     * @returns Write result with generated comment ID
     */
    addComment(targetType: CommentTargetType, targetId: string, commentData: Omit<CommentDTO, 'id'>): Promise<WriteResult>;

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
    createShareLinkInTransaction(transaction: Transaction, groupId: string, shareLinkData: Omit<ShareLinkDTO, 'id'>): DocumentReference;

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
     * Remove a group from user's notification tracking
     * @param userId - The user ID
     * @param groupId - The group ID to remove
     * @returns Write result
     */
    removeUserNotificationGroup(userId: string, groupId: string): Promise<WriteResult>;

    /**
     * Set user notifications with merge option
     * @param userId - The user ID
     * @param data - The notification data
     * @param merge - Whether to merge with existing data
     * @returns Write result
     */
    setUserNotifications(userId: string, data: any, merge?: boolean): Promise<WriteResult>;


    // ========================================================================
    // Test Pool Operations (for TestUserPoolService)
    // ========================================================================

    /**
     * Create a test pool user document
     * @param email - The user email (used as document ID)
     * @param userData - The test pool user data
     * @returns Write result
     */
    createTestPoolUser(email: string, userData: {
        email: string;
        token: string;
        password: string;
        status: 'available' | 'borrowed';
    }): Promise<WriteResult>;

    /**
     * Update a test pool user document
     * @param email - The user email (document ID)
     * @param updates - The updates to apply
     * @returns Write result
     */
    updateTestPoolUser(email: string, updates: { status?: 'available' | 'borrowed' }): Promise<WriteResult>;

    // ========================================================================
    // System Operations
    // ========================================================================

    /**
     * Perform health check operations (test read/write)
     * @returns Health check result with timing information
     */
    performHealthCheck(): Promise<{ success: boolean; responseTime: number }>;

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

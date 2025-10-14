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

import type { CommentDTO, CommentTargetType, RegisteredUser, ShareLinkDTO } from '@splitifyd/shared';
import type { Timestamp } from 'firebase-admin/firestore';
import type { IDocumentReference, ITransaction, IWriteBatch } from '../../firestore-wrapper';
import type { GroupBalanceDTO } from '../../schemas';
import type { CreateUserNotificationDocument } from '../../schemas/user-notifications';

export interface WriteResult {
    id: string;
    success: boolean;
    timestamp?: Timestamp | Date; // todo: remove this
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

    // ========================================================================
    // Group Write Operations
    // ========================================================================

    /**
     * Update a group's updatedAt timestamp to mark activity
     * Use this whenever any group-related operation occurs (expenses, settlements, members, comments)
     * @param groupId - The group ID
     * @param transactionOrBatch - Optional transaction or batch to perform update within
     */
    touchGroup(groupId: string, transactionOrBatch?: ITransaction | IWriteBatch): Promise<void>;

    /**
     * Update a member's group-specific display name with uniqueness validation
     * Uses a transaction to ensure atomic read-check-write and prevent race conditions
     * @param groupId - The group ID
     * @param userId - The user ID (member's UID)
     * @param newDisplayName - The new group-specific display name
     * @throws ApiError with code 'GROUP_NOT_FOUND' if group doesn't exist
     * @throws ApiError with code 'DISPLAY_NAME_TAKEN' if name is already in use by another member
     */
    updateGroupMemberDisplayName(groupId: string, userId: string, newDisplayName: string): Promise<void>;

    // ========================================================================
    // Expense Write Operations
    // ========================================================================

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
    createShareLinkInTransaction(transaction: ITransaction, groupId: string, shareLinkData: Omit<ShareLinkDTO, 'id'>): IDocumentReference;

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
     * Run a transaction with custom logic
     *
     * NOTE: Retry logic is handled internally by Firestore's SDK with optimistic concurrency
     * control. When transactions conflict, Firestore automatically retries with exponential backoff.
     *
     * @param updateFunction - Function that performs transactional operations
     * @returns Transaction result
     */
    runTransaction<T>(updateFunction: (transaction: ITransaction) => Promise<T>): Promise<T>;

    /**
     * Create a document within a transaction
     * @param transaction - The transaction object
     * @param collection - The collection name
     * @param documentId - Optional document ID (auto-generated if not provided)
     * @param data - The document data
     * @returns Document reference
     */
    createInTransaction(transaction: ITransaction, collection: string, documentId: string | null, data: any): IDocumentReference;

    /**
     * Update a document within a transaction
     * @param transaction - The transaction object
     * @param documentPath - The full document path
     * @param updates - The update data
     */
    updateInTransaction(transaction: ITransaction, documentPath: string, updates: any): void;

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
     * Batch set user notifications using Firestore batch writes for optimal performance
     * Automatically handles batching for groups exceeding 500 users (Firestore batch limit)
     * @param updates - Array of user notification updates
     * @returns Batch write result with success/failure counts
     */
    batchSetUserNotifications(updates: Array<{ userId: string; data: any; merge?: boolean; }>): Promise<BatchWriteResult>;

    // ========================================================================
    // Test Pool Operations (for TestUserPoolService)
    // ========================================================================

    /**
     * Create a test pool user document
     * @param email - The user email (used as document ID)
     * @param userData - The test pool user data
     * @returns Write result
     */
    createTestPoolUser(
        email: string,
        userData: {
            email: string;
            token: string;
            password: string;
            status: 'available' | 'borrowed';
        },
    ): Promise<WriteResult>;

    /**
     * Update a test pool user document
     * @param email - The user email (document ID)
     * @param updates - The updates to apply
     * @returns Write result
     */
    updateTestPoolUser(email: string, updates: { status?: 'available' | 'borrowed'; }): Promise<WriteResult>;

    // ========================================================================
    // System Operations
    // ========================================================================

    /**
     * Perform health check operations (test read/write)
     * @returns Health check result with timing information
     */
    performHealthCheck(): Promise<{ success: boolean; responseTime: number; }>;

    // ========================================================================
    // Group Balance Operations
    // ========================================================================

    /**
     * Set group balance within a transaction
     * Used for atomic initialization of balance documents
     * @param transaction - The transaction context
     * @param groupId - The group ID
     * @param balance - The balance data to set
     */
    setGroupBalanceInTransaction(transaction: ITransaction, groupId: string, balance: GroupBalanceDTO): void;

    /**
     * Get group balance within a transaction (must be called before any writes)
     * @param transaction - The transaction context
     * @param groupId - The group ID
     * @returns The current group balance
     * @throws ApiError if balance not found
     */
    getGroupBalanceInTransaction(transaction: ITransaction, groupId: string): Promise<GroupBalanceDTO>;

    /**
     * Update group balance within a transaction (requires balance to be read first)
     * Used for incremental updates when expenses/settlements change
     * @param transaction - The transaction context
     * @param groupId - The group ID
     * @param currentBalance - The current balance (already read in transaction)
     * @param updater - Function that takes current balance and returns updated balance
     */
    updateGroupBalanceInTransaction(transaction: ITransaction, groupId: string, currentBalance: GroupBalanceDTO, updater: (current: GroupBalanceDTO) => GroupBalanceDTO): void;

    // ========================================================================
    // Transaction Helper Methods (Phase 1 - Transaction Foundation)
    // ========================================================================

    /**
     * Delete multiple documents within a transaction atomically
     * @param transaction - The transaction context
     * @param documentPaths - Array of document paths to delete
     * @throws Error if any deletion fails (transaction will be aborted)
     */
    bulkDeleteInTransaction(transaction: ITransaction, documentPaths: string[]): void;

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
    getDocumentReferenceInTransaction(transaction: ITransaction, collection: string, documentId: string): IDocumentReference;

    /**
     * Atomically update group timestamp, delete membership, and remove from notifications
     * @param groupId - The group ID to update
     * @param userId - The user ID to remove from notifications
     * @returns Batch write result
     */
    leaveGroupAtomic(groupId: string, userId: string): Promise<BatchWriteResult>;
}

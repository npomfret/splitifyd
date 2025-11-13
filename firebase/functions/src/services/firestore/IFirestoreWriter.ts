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

import type { BrandingArtifactMetadata, CommentDTO, ISOString, ShareLinkDTO, ShareLinkToken, SystemUserRole, UserId } from '@splitifyd/shared';
import { DisplayName, ExpenseId, GroupId, ShareLinkId } from '@splitifyd/shared';
import type { Email } from '@splitifyd/shared';
import { PolicyId } from '@splitifyd/shared';
import type { IDocumentReference, ITransaction, IWriteBatch } from '../../firestore-wrapper';
import type { GroupBalanceDTO } from '../../schemas';
import type { TenantDocument } from '../../schemas/tenant';

export interface WriteResult {
    id: string;
    success: boolean;
    error?: string;
}

export interface BatchWriteResult {
    successCount: number;
    failureCount: number;
    results: WriteResult[];
}

interface FirestoreUserDocumentFields {
    role?: SystemUserRole;
    preferredLanguage?: string;
    acceptedPolicies?: Record<string, string>;
    termsAcceptedAt?: ISOString;
    cookiePolicyAcceptedAt?: ISOString;
    privacyPolicyAcceptedAt?: ISOString;
    passwordChangedAt?: ISOString;
    createdAt?: ISOString;
    updatedAt?: ISOString;
}

export type FirestoreUserCreateData = FirestoreUserDocumentFields;

export type FirestoreUserUpdateData = Partial<FirestoreUserDocumentFields>;

export type TenantDocumentUpsertData = Omit<TenantDocument, 'id' | 'createdAt' | 'updatedAt'>;

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
    createUser(userId: UserId, userData: FirestoreUserCreateData): Promise<WriteResult>;

    /**
     * Update an existing user document
     * @param userId - The user ID
     * @param updates - Partial user data to update (DTO with ISO strings)
     * @returns Write result
     */
    updateUser(userId: UserId, updates: FirestoreUserUpdateData): Promise<WriteResult>;

    /**
     * Promote a user to system admin role
     * @param userId - The user ID
     * @returns Promise that resolves when promotion is complete
     */
    promoteUserToAdmin(userId: UserId): Promise<void>;

    // ========================================================================
    // Group Write Operations
    // ========================================================================

    /**
     * Update a group's updatedAt timestamp to mark activity
     * Use this whenever any group-related operation occurs (expenses, settlements, members, comments)
     * @param groupId - The group ID
     * @param transactionOrBatch - Optional transaction or batch to perform update within
     */
    touchGroup(groupId: GroupId, transactionOrBatch?: ITransaction | IWriteBatch): Promise<void>;

    /**
     * Update a member's group-specific display name with uniqueness validation
     * Uses a transaction to ensure atomic read-check-write and prevent race conditions
     * @param groupId - The group ID
     * @param userId - The user ID (member's UID)
     * @param newDisplayName - The new group-specific display name
     * @throws ApiError with code 'GROUP_NOT_FOUND' if group doesn't exist
     * @throws ApiError with code 'DISPLAY_NAME_TAKEN' if name is already in use by another member
     */
    updateGroupMemberDisplayName(groupId: GroupId, userId: UserId, newDisplayName: DisplayName): Promise<void>;

    // ========================================================================
    // Expense Write Operations
    // ========================================================================

    // ========================================================================
    // Comment Write Operations
    // ========================================================================

    /**
     * Create a group comment inside an existing transaction
     */
    createGroupCommentInTransaction(transaction: ITransaction, groupId: GroupId, commentData: Omit<CommentDTO, 'id'>): IDocumentReference;

    /**
     * Create an expense comment inside an existing transaction
     */
    createExpenseCommentInTransaction(transaction: ITransaction, expenseId: ExpenseId, commentData: Omit<CommentDTO, 'id'>): IDocumentReference;

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
    createShareLinkInTransaction(transaction: ITransaction, groupId: GroupId, shareLinkData: Omit<ShareLinkDTO, 'id'>): IDocumentReference;

    /**
     * Hard delete a share link and its token index
     * @param groupId - The group ID
     * @param shareLinkId - The share link document ID
     * @param shareToken - The share token value (used to delete the token index document)
     */
    deleteShareLink(groupId: GroupId, shareLinkId: ShareLinkId, shareToken: ShareLinkToken): Promise<void>;

    // ========================================================================
    // Policy Operations
    // ========================================================================

    /**
     * Create a policy document
     * @param policyId - The policy ID (optional, auto-generated if not provided)
     * @param policyData - The policy data
     * @returns Write result
     */
    createPolicy(policyId: PolicyId | null, policyData: any): Promise<WriteResult>;

    /**
     * Update a policy document
     * @param policyId - The policy ID
     * @param updates - The policy updates
     * @returns Write result
     */
    updatePolicy(policyId: PolicyId, updates: any): Promise<WriteResult>;

    /**
     * Create or update a tenant document (admin use only)
     */
    upsertTenant(tenantId: string, data: TenantDocumentUpsertData): Promise<WriteResult & { created: boolean }>;

    updateTenantThemeArtifact(tenantId: string, artifact: BrandingArtifactMetadata): Promise<WriteResult>;

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

    /**
     * Create an activity feed document within a user-scoped subcollection during a transaction.
     */
    createActivityFeedItemInTransaction(transaction: ITransaction, userId: UserId, documentId: string | null, data: Record<string, any>): IDocumentReference;

    /**
     * Get activity feed items for a user (non-transaction version for async cleanup)
     */
    getActivityFeedItemsForUser(userId: UserId, limit: number): Promise<Array<{ id: string; }>>;

    /**
     * Delete an activity feed item (non-transaction version for async cleanup)
     */
    deleteActivityFeedItem(userId: UserId, documentId: string): Promise<void>;

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
    // Test Pool Operations (for TestUserPoolService)
    // ========================================================================

    /**
     * Create a test pool user document
     * @param email - The user email (used as document ID)
     * @param userData - The test pool user data
     * @returns Write result
     */
    createTestPoolUser(
        email: Email,
        userData: {
            email: Email;
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
    updateTestPoolUser(email: Email, updates: { status?: 'available' | 'borrowed'; }): Promise<WriteResult>;

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
    setGroupBalanceInTransaction(transaction: ITransaction, groupId: GroupId, balance: GroupBalanceDTO): void;

    /**
     * Get group balance within a transaction (must be called before any writes)
     * @param transaction - The transaction context
     * @param groupId - The group ID
     * @returns The current group balance
     * @throws ApiError if balance not found
     */
    getGroupBalanceInTransaction(transaction: ITransaction, groupId: GroupId): Promise<GroupBalanceDTO>;

    /**
     * Update group balance within a transaction (requires balance to be read first)
     * Used for incremental updates when expenses/settlements change
     * @param transaction - The transaction context
     * @param groupId - The group ID
     * @param currentBalance - The current balance (already read in transaction)
     * @param updater - Function that takes current balance and returns updated balance
     */
    updateGroupBalanceInTransaction(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, updater: (current: GroupBalanceDTO) => GroupBalanceDTO): void;

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

    // ========================================================================
    // Tenant Write Operations
    // ========================================================================

    /**
     * Update tenant branding configuration
     * @param tenantId - The tenant ID to update
     * @param brandingUpdates - Partial branding updates (validated by UpdateTenantBrandingRequestSchema)
     * @returns Write result
     */
    updateTenantBranding(tenantId: string, brandingUpdates: Record<string, any>): Promise<WriteResult>;
}

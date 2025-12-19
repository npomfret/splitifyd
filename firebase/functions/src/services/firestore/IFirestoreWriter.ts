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

import type { BrandingArtifactMetadata, CommentDTO, ISOString, ShareLinkDTO, ShareLinkToken, SystemUserRole, TenantId, TenantImageDTO, TenantImageId, UserId } from '@billsplit-wl/shared';
import { CommentId, DisplayName, ExpenseId, GroupId, ShareLinkId } from '@billsplit-wl/shared';
import type { Email } from '@billsplit-wl/shared';
import { PolicyId } from '@billsplit-wl/shared';
import type { IDocumentReference, ITransaction, IWriteBatch } from 'ts-firebase-simulator';
import type { MergeJobDocument } from '../../merge/MergeService';
import type { GroupBalanceDTO } from '../../schemas';
import type { TenantDocument } from '../../schemas/tenant';

export interface WriteResult {
    id: string;
    success: boolean;
    error?: string;
}

interface FirestoreUserDocumentFields {
    role?: SystemUserRole;
    preferredLanguage?: string;
    acceptedPolicies?: Record<string, Record<string, string>>;
    signupTenantId?: TenantId;
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
     * Update a group's updatedAt and preloaded membership refs' groupUpdatedAt within a transaction.
     * Use when membership refs were preloaded at transaction start (to satisfy reads-before-writes rule).
     * This ensures groups are properly ordered by most recent activity.
     * @param groupId - The group ID
     * @param transaction - The transaction
     * @param membershipRefs - Preloaded membership document refs to update
     */
    touchGroupWithPreloadedRefs(groupId: GroupId, transaction: ITransaction, membershipRefs: IDocumentReference[]): Promise<void>;

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

    /**
     * Delete a group comment
     * @param groupId - The group ID
     * @param commentId - The comment ID
     */
    deleteGroupComment(groupId: GroupId, commentId: CommentId): Promise<void>;

    /**
     * Delete an expense comment (also decrements the expense's commentCount)
     * @param expenseId - The expense ID
     * @param commentId - The comment ID
     */
    deleteExpenseComment(expenseId: ExpenseId, commentId: CommentId): Promise<void>;

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
    upsertTenant(tenantId: string, data: TenantDocumentUpsertData): Promise<WriteResult & { created: boolean; }>;

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
     * Get activity feed items for a user (non-transaction version for async cleanup)
     */
    getActivityFeedItemsForUser(userId: UserId, limit: number): Promise<Array<{ id: string; }>>;

    /**
     * Create a write batch for batching multiple operations
     */
    createBatch(): IWriteBatch;

    /**
     * Delete an activity feed item in a batch (for efficient bulk deletes)
     */
    deleteActivityFeedItemInBatch(batch: IWriteBatch, userId: UserId, documentId: string): void;

    /**
     * Create an activity feed item in a batch (for efficient bulk writes)
     */
    createActivityFeedItemInBatch(batch: IWriteBatch, userId: UserId, documentId: string | null, data: any): void;

    // ========================================================================
    // Merge Job Operations
    // ========================================================================

    /**
     * Create a merge job document
     * @param jobId - The merge job ID (document ID)
     * @param jobData - The merge job data to write
     * @returns Write result
     */
    createMergeJob(jobId: string, jobData: MergeJobDocument): Promise<WriteResult>;

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

    /**
     * Atomically borrow an available test pool user.
     * Uses a transaction to find an available user and mark it as borrowed.
     * @returns The borrowed user data, or null if no available users exist
     */
    borrowAvailableTestPoolUser(): Promise<{ email: Email; token: string; password: string; } | null>;

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

    /**
     * Update merge job status
     * @param jobId - The merge job ID
     * @param status - The new status
     * @param error - Optional error message if failed
     * @returns Write result
     */
    updateMergeJobStatus(jobId: string, status: import('../../merge/MergeService').MergeJobStatus, error?: string): Promise<WriteResult>;

    // ========================================================================
    // Account Merge Operations
    // ========================================================================

    /**
     * Reassign group ownership from one user to another
     * @param fromUserId - Current owner user ID
     * @param toUserId - New owner user ID
     * @returns Number of groups updated
     */
    reassignGroupOwnership(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Reassign group memberships from one user to another
     * @param fromUserId - Current member user ID
     * @param toUserId - New member user ID
     * @returns Number of memberships updated
     */
    reassignGroupMemberships(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Reassign expense payer from one user to another
     * @param fromUserId - Current payer user ID
     * @param toUserId - New payer user ID
     * @returns Number of expenses updated
     */
    reassignExpensePayer(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Reassign expense participants from one user to another
     * @param fromUserId - Current participant user ID
     * @param toUserId - New participant user ID
     * @returns Number of expenses updated
     */
    reassignExpenseParticipants(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Reassign settlement payer from one user to another
     * @param fromUserId - Current payer user ID
     * @param toUserId - New payer user ID
     * @returns Number of settlements updated
     */
    reassignSettlementPayer(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Reassign settlement payee from one user to another
     * @param fromUserId - Current payee user ID
     * @param toUserId - New payee user ID
     * @returns Number of settlements updated
     */
    reassignSettlementPayee(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Reassign comment authors from one user to another
     * @param fromUserId - Current author user ID
     * @param toUserId - New author user ID
     * @returns Number of comments updated
     */
    reassignCommentAuthors(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Reassign activity feed actors from one user to another
     * @param fromUserId - Current actor user ID
     * @param toUserId - New actor user ID
     * @returns Number of activity feed entries updated
     */
    reassignActivityFeedActors(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Reassign share link token creators from one user to another
     * @param fromUserId - Current creator user ID
     * @param toUserId - New creator user ID
     * @returns Number of share link tokens updated
     */
    reassignShareLinkTokens(fromUserId: import('@billsplit-wl/shared').UserId, toUserId: import('@billsplit-wl/shared').UserId): Promise<number>;

    /**
     * Mark user account as merged and disabled
     * @param userId - User ID to mark as merged
     * @param mergedIntoUserId - Primary user ID this account was merged into
     * @returns Write result
     */
    markUserAsMerged(userId: import('@billsplit-wl/shared').UserId, mergedIntoUserId: import('@billsplit-wl/shared').UserId): Promise<WriteResult>;

    // ========================================================================
    // Tenant Image Library Operations
    // ========================================================================

    /**
     * Create a new tenant image document
     * @param tenantId - The tenant ID
     * @param imageData - The image data to write
     * @returns Write result
     */
    createTenantImage(tenantId: TenantId, imageData: TenantImageDTO): Promise<WriteResult>;

    /**
     * Update a tenant image document
     * @param tenantId - The tenant ID
     * @param imageId - The image ID
     * @param updates - Partial update fields
     * @returns Write result
     */
    updateTenantImage(tenantId: TenantId, imageId: TenantImageId, updates: Partial<Pick<TenantImageDTO, 'name'>>): Promise<WriteResult>;

    /**
     * Delete a tenant image document
     * @param tenantId - The tenant ID
     * @param imageId - The image ID
     * @returns Write result
     */
    deleteTenantImage(tenantId: TenantId, imageId: TenantImageId): Promise<WriteResult>;
}

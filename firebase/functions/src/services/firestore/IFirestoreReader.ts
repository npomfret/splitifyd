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

import type { ActivityFeedItem, CommentId, ExpenseId, ISOString, MemberStatus, ReactionEmoji, TenantDomainName, TenantId, TenantImageDTO, TenantImageId, UserId } from '@billsplit-wl/shared';
import type { IDocumentReference, IDocumentSnapshot, IQuerySnapshot, ITransaction } from 'ts-firebase-simulator';
import type { FirestoreAuditMetadata } from '../../schemas/common';

/**
 * Standard Firestore document ordering fields
 */
export type FirestoreOrderField = keyof Pick<FirestoreAuditMetadata, 'createdAt' | 'updatedAt'>;

interface OrderBy {
    field: string;
    direction: 'asc' | 'desc';
}

// FirestoreReader query and pagination types
interface PaginationOptions {
    limit?: number;
    offset?: number;
    cursor?: string;
    orderBy?: OrderBy;
}

interface FilterOptions {
    includeDeleted?: boolean;
    dateRange?: {
        start?: ISOString;
        end?: ISOString;
    };
    filterUserId?: UserId; // For filtering by user involvement (e.g., payer OR payee in settlements)
}

export interface QueryOptions extends PaginationOptions, FilterOptions {
    limit: number; // Required - forces explicit pagination consideration
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

export interface BatchGroupFetchOptions extends Required<Pick<PaginationOptions, 'limit' | 'orderBy'>> {}

export interface GetGroupsForUserOptions extends Pick<PaginationOptions, 'limit' | 'cursor' | 'orderBy'> {
    statusFilter?: MemberStatus | MemberStatus[];
}

// Import parsed types from schemas
import type { CommentDTO, ExpenseDTO, GroupDTO, GroupMembershipDTO, PolicyDTO, SettlementDTO, ShareLinkToken, TenantFullRecord } from '@billsplit-wl/shared';
import { GroupId, ShareLinkId } from '@billsplit-wl/shared';
import { SettlementId } from '@billsplit-wl/shared';
import { PolicyId } from '@billsplit-wl/shared';
import type { GroupBalanceDTO, ParsedShareLink, UserDocument } from '../../schemas';

export interface IFirestoreReader {
    // ========================================================================
    // Document Read Operations
    // ========================================================================

    /**
     * Get a user document by ID
     * @param userId - The user ID
     * @returns User document or null if not found
     */
    getUser(userId: UserId): Promise<UserDocument | null>;

    /**
     * Get a group document by ID
     * @param groupId - The group ID
     * @returns Group document or null if not found
     */
    getGroup(groupId: GroupId, options?: { includeDeleted?: boolean; }): Promise<GroupDTO | null>;

    /**
     * Get an expense document by ID
     * @param expenseId - The expense ID
     * @param options - Optional flags for retrieval behavior
     * @returns Expense document or null if not found
     */
    getExpense(expenseId: ExpenseId, options?: { includeSoftDeleted?: boolean; }): Promise<ExpenseDTO | null>;

    /**
     * Get a settlement document by ID
     * @param settlementId - The settlement ID
     * @param options - Optional flags for retrieval behavior
     * @returns Settlement document or null if not found
     */
    getSettlement(settlementId: SettlementId, options?: { includeSoftDeleted?: boolean; }): Promise<SettlementDTO | null>;

    /**
     * Get a policy document by ID
     * @param policyId - The policy ID
     * @returns Policy document or null if not found
     */
    getPolicy(policyId: PolicyId): Promise<PolicyDTO | null>;

    /**
     * Get all policy documents
     * @returns Array of all policy documents
     */
    getAllPolicies(): Promise<PolicyDTO[]>;

    // ========================================================================
    // Tenant Registry Operations
    // ========================================================================

    /**
     * Get tenant registry record by tenant ID
     */
    getTenantById(tenantId: TenantId): Promise<TenantFullRecord | null>;

    /**
     * Find tenant registry record by domain/host name
     */
    getTenantByDomain(domain: TenantDomainName): Promise<TenantFullRecord | null>;

    /**
     * Retrieve the default tenant configuration
     */
    getDefaultTenant(): Promise<TenantFullRecord | null>;

    /**
     * List all tenant configurations (system admin only)
     */
    listAllTenants(): Promise<TenantFullRecord[]>;

    // ========================================================================
    // Collection Read Operations - User-related
    // ========================================================================

    /**
     * Get all groups where the user is a member using V2 implementation (top-level collection)
     * This method provides proper database-level ordering and fixes pagination issues
     * @param userId - The user ID
     * @param options - Query options for pagination and filtering
     * @returns Paginated result containing group DTOs, hasMore flag, and nextCursor
     */
    getGroupsForUserV2(userId: UserId, options?: GetGroupsForUserOptions): Promise<PaginatedResult<GroupDTO[]>>;

    /**
     * Get a single member from a group
     * @param groupId - The group ID
     * @param userId - The user ID to find
     * @returns Group membership DTO or null if not found
     */
    getGroupMember(groupId: GroupId, userId: UserId): Promise<GroupMembershipDTO | null>;

    /**
     * Batch fetch multiple group members efficiently
     * @param groupId - The group ID
     * @param userIds - Array of user IDs to fetch
     * @returns Map of userId to GroupMembershipDTO (excludes members not found)
     */
    getGroupMembers(groupId: GroupId, userIds: UserId[]): Promise<Map<UserId, GroupMembershipDTO>>;

    /**
     * Get all members for a group (simplified method)
     * @param groupId - The group ID
     * @returns Array of group membership DTOs
     */
    getAllGroupMembers(groupId: GroupId): Promise<GroupMembershipDTO[]>;

    getAllGroupMemberIds(groupId: GroupId): Promise<UserId[]>;

    // ========================================================================
    // Activity Feed Operations
    // ========================================================================

    getActivityFeedForUser(
        userId: UserId,
        options?: {
            limit?: number;
            cursor?: string;
        },
    ): Promise<{
        items: ActivityFeedItem[];
        hasMore: boolean;
        nextCursor?: string;
    }>;

    /**
     * Get activity feed items for a specific group (across all members)
     * Uses collection group query on the 'items' subcollection
     * @param groupId - The group ID to filter by
     * @param options - Pagination options
     * @returns Paginated activity feed items for the group
     */
    getActivityFeedForGroup(
        groupId: GroupId,
        options?: {
            limit?: number;
            cursor?: string;
        },
    ): Promise<{
        items: ActivityFeedItem[];
        hasMore: boolean;
        nextCursor?: string;
    }>;

    // ========================================================================
    // Collection Read Operations - Expense-related
    // ========================================================================

    /**
     * Get all expenses for a specific group with full pagination support
     * @param groupId - The group ID
     * @param options - Query options for pagination and filtering
     * @returns Object with expenses array, hasMore flag, and nextCursor
     */
    getExpensesForGroupPaginated(
        groupId: GroupId,
        options?: {
            limit?: number;
            cursor?: string;
            includeDeleted?: boolean;
        },
    ): Promise<{
        expenses: ExpenseDTO[];
        hasMore: boolean;
        nextCursor?: string;
    }>;

    // ========================================================================
    // Collection Read Operations - Settlement-related
    // ========================================================================

    /**
     * Get settlements for a specific group with flexible filtering and pagination
     *
     * Supports both offset-based (for batch fetching) and cursor-based (for API pagination) strategies.
     * Filters out soft-deleted settlements automatically.
     *
     * @param groupId - The group ID
     * @param options - Query options for pagination, filtering, and ordering:
     *   - limit: Required - max results to return
     *   - offset: Optional - for batch fetching all settlements
     *   - cursor: Optional - for cursor-based API pagination
     *   - orderBy: Optional - custom ordering (defaults to createdAt desc)
     *   - filterUserId: Optional - filter to settlements involving this user (payer OR payee)
     *   - dateRange: Optional - filter by settlement date range
     *
     * @returns Object with settlements array, hasMore flag, and optional nextCursor
     *
     * @example
     * // Batch fetching for balance calculations
     * const result = await reader.getSettlementsForGroup(groupId, { limit: 500, offset: 0 });
     * allSettlements.push(...result.settlements);
     *
     * @example
     * // API pagination with filtering
     * const result = await reader.getSettlementsForGroup(groupId, {
     *   limit: 20,
     *   cursor: 'abc123',
     *   filterUserId: userId,
     *   dateRange: { start: '2025-01-01', end: '2025-12-31' }
     * });
     */
    getSettlementsForGroup(
        groupId: GroupId,
        options: QueryOptions,
    ): Promise<{
        settlements: SettlementDTO[];
        hasMore: boolean;
        nextCursor?: string;
    }>;

    /**
     * Check if a user notification document exists
     * @param userId - The user ID
     * @returns True if notification document exists, false otherwise
     */

    /**
     * Find a share link by its token across all groups
     * @param shareToken - The share link token
     * @returns Object with groupId and share link, or null if not found
     */
    findShareLinkByToken(shareToken: ShareLinkToken): Promise<{ groupId: GroupId; shareLinkId: ShareLinkId; shareLink: ParsedShareLink | null; } | null>;

    /**
     * Get expired share link document references within a transaction
     * @param transaction - The transaction to use for reading
     * @param groupId - The group ID
     * @param cutoffIso - ISO string timestamp for expiration cutoff
     * @returns Array of document references to expired share links
     */
    getExpiredShareLinkRefsInTransaction(transaction: ITransaction, groupId: GroupId, cutoffIso: string): Promise<IDocumentReference[]>;

    // ========================================================================
    // Comment Operations
    // ========================================================================

    /**
     * Get paginated comments for a group
     * @param groupId - The group ID
     * @param options - Pagination and ordering options
     * @returns Object with comments array, hasMore flag, and nextCursor
     */
    getGroupComments(
        groupId: GroupId,
        options?: {
            limit?: number;
            cursor?: string;
            orderBy?: FirestoreOrderField;
            direction?: 'asc' | 'desc';
        },
    ): Promise<{ comments: CommentDTO[]; hasMore: boolean; nextCursor?: string; }>;

    /**
     * Get paginated comments for an expense
     * @param expenseId - The expense ID
     * @param options - Pagination and ordering options
     * @returns Object with comments array, hasMore flag, and nextCursor
     */
    getExpenseComments(
        expenseId: ExpenseId,
        options?: {
            limit?: number;
            cursor?: string;
            orderBy?: FirestoreOrderField;
            direction?: 'asc' | 'desc';
        },
    ): Promise<{ comments: CommentDTO[]; hasMore: boolean; nextCursor?: string; }>;

    /**
     * Get a specific group comment by comment ID
     * @param groupId - The group ID
     * @param commentId - The comment ID
     * @returns Comment document or null if not found
     */
    getGroupComment(groupId: GroupId, commentId: CommentId): Promise<CommentDTO | null>;

    /**
     * Get a specific expense comment by comment ID
     * @param expenseId - The expense ID
     * @param commentId - The comment ID
     * @returns Comment document or null if not found
     */
    getExpenseComment(expenseId: ExpenseId, commentId: CommentId): Promise<CommentDTO | null>;

    // ========================================================================
    // Settlement Query Operations
    // ========================================================================

    // ========================================================================
    // Group Balance Operations
    // ========================================================================

    /**
     * Get pre-computed balance for a group
     * @param groupId - The group ID
     * @returns GroupBalanceDTO with ISO string dates
     * @throws ApiError if balance not found or read fails
     */
    getGroupBalance(groupId: GroupId): Promise<GroupBalanceDTO>;

    /**
     * Batch fetch balances for multiple groups in a single round-trip
     * @param groupIds - Array of group IDs to fetch balances for
     * @returns Map of groupId to GroupBalanceDTO (excludes groups without balance docs)
     */
    getBalancesByGroupIds(groupIds: GroupId[]): Promise<Map<GroupId, GroupBalanceDTO>>;

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
    verifyGroupMembership(groupId: GroupId, userId: UserId): Promise<boolean>;

    // ========================================================================
    // Subcollection Operations
    // ========================================================================

    // ========================================================================
    // Raw Document Access (for special cases like optimistic locking)
    // ========================================================================

    /**
     * Get raw policy document for optimistic locking scenarios
     * @param policyId - The policy ID
     * @returns Raw document snapshot or null if not found
     */
    getRawPolicyDocument(policyId: PolicyId): Promise<IDocumentSnapshot | null>;

    /**
     * Get group DTO in a transaction with Timestamp → ISO conversion
     * Use this for optimistic locking with DTOs (DTO-everywhere pattern)
     * @param transaction - Firestore transaction
     * @param groupId - The group ID
     * @returns Group DTO with ISO string dates or null if not found
     */
    getGroupInTransaction(transaction: ITransaction, groupId: GroupId): Promise<GroupDTO | null>;

    /**
     * Get membership document refs in a transaction for later updates.
     * Must be called before any writes in the transaction (Firestore rule).
     * @param transaction - Firestore transaction
     * @param groupId - The group ID
     * @returns Array of membership document IDs and refs
     */
    getMembershipRefsInTransaction(
        transaction: ITransaction,
        groupId: GroupId,
    ): Promise<Array<{ id: string; ref: IDocumentReference; }>>;

    /**
     * Get expense DTO in a transaction with Timestamp → ISO conversion
     * Use this for optimistic locking with DTOs (DTO-everywhere pattern)
     * @param transaction - Firestore transaction
     * @param expenseId - The expense ID
     * @returns Expense DTO with ISO string dates or null if not found
     */
    getExpenseInTransaction(transaction: ITransaction, expenseId: ExpenseId): Promise<ExpenseDTO | null>;

    /**
     * Get settlement DTO in a transaction with Timestamp → ISO conversion
     * Use this for optimistic locking with DTOs (DTO-everywhere pattern)
     * @param transaction - Firestore transaction
     * @param settlementId - The settlement ID
     * @returns Settlement DTO with ISO string dates or null if not found
     */
    getSettlementInTransaction(transaction: ITransaction, settlementId: SettlementId): Promise<SettlementDTO | null>;

    /**
     * @deprecated Use getGroupInTransaction instead - returns DTO with ISO strings
     * Get raw group document in a transaction for optimistic locking
     * @param transaction - Firestore transaction
     * @param groupId - The group ID
     * @returns Raw document snapshot or null if not found
     */
    getRawGroupDocumentInTransaction(transaction: ITransaction, groupId: GroupId): Promise<IDocumentSnapshot | null>;

    /**
     * Get group membership documents in a transaction
     * @param transaction - The Firestore transaction
     * @param groupId - The group ID to query memberships for
     * @returns Array of raw document snapshots
     */
    getGroupMembershipsInTransaction(transaction: ITransaction, groupId: GroupId): Promise<IQuerySnapshot>;

    /**
     * Get merge job document by ID
     * @param jobId - The merge job ID
     * @returns Merge job document or null if not found
     */
    getMergeJob(jobId: string): Promise<import('../../merge/MergeService').MergeJobDocument | null>;

    // ========================================================================
    // Admin Browser Operations
    // ========================================================================

    /**
     * List user documents with pagination for admin browser
     * Returns raw user data serialized for browser display (timestamps as ISO strings)
     * @param options - Pagination options
     * @returns Paginated result with serialized user documents
     */
    listUserDocuments(options: {
        limit: number;
        cursor?: string;
    }): Promise<{
        users: UserDocument[];
        hasMore: boolean;
        nextCursor?: string;
    }>;

    // ========================================================================
    // Tenant Image Library Operations
    // ========================================================================

    /**
     * Get all images in a tenant's image library
     * @param tenantId - The tenant ID
     * @returns Array of tenant image DTOs
     */
    getTenantImages(tenantId: TenantId): Promise<TenantImageDTO[]>;

    /**
     * Get a specific image from a tenant's library
     * @param tenantId - The tenant ID
     * @param imageId - The image ID
     * @returns TenantImageDTO or null if not found
     */
    getTenantImage(tenantId: TenantId, imageId: TenantImageId): Promise<TenantImageDTO | null>;

    // Note: getUserReactionsFor* methods removed - reactions are now denormalized on parent documents
}

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

import type { ActivityFeedItem, ExpenseId, ISOString, MemberStatus } from '@splitifyd/shared';
import type { IDocumentSnapshot, IQuerySnapshot, ITransaction } from '../../firestore-wrapper';
import type { FirestoreAuditMetadata } from '../../schemas/common';

/**
 * Standard Firestore document ordering fields
 */
export type FirestoreOrderField = keyof Pick<FirestoreAuditMetadata, 'createdAt' | 'updatedAt'>;

export interface OrderBy {
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
    filterUserId?: string; // For filtering by user involvement (e.g., payer OR payee in settlements)
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
import { CommentTargetType } from '@splitifyd/shared';
import type { CommentDTO, ExpenseDTO, GroupDTO, GroupMembershipDTO, PolicyDTO, RegisteredUser, SettlementDTO } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import { SettlementId } from '@splitifyd/shared';
import type { GroupBalanceDTO, ParsedShareLink } from '../../schemas';

export interface IFirestoreReader {
    // ========================================================================
    // Document Read Operations
    // ========================================================================

    /**
     * Get a user document by ID
     * @param userId - The user ID
     * @returns User document or null if not found
     */
    getUser(userId: string): Promise<RegisteredUser | null>;

    /**
     * Get a group document by ID
     * @param groupId - The group ID
     * @returns Group document or null if not found
     */
    getGroup(groupId: GroupId, options?: { includeDeleted?: boolean; }): Promise<GroupDTO | null>;

    /**
     * Get an expense document by ID
     * @param expenseId - The expense ID
     * @returns Expense document or null if not found
     */
    getExpense(expenseId: ExpenseId): Promise<ExpenseDTO | null>;

    /**
     * Get a settlement document by ID
     * @param settlementId - The settlement ID
     * @returns Settlement document or null if not found
     */
    getSettlement(settlementId: SettlementId): Promise<SettlementDTO | null>;

    /**
     * Get a policy document by ID
     * @param policyId - The policy ID
     * @returns Policy document or null if not found
     */
    getPolicy(policyId: string): Promise<PolicyDTO | null>;

    /**
     * Get all policy documents
     * @returns Array of all policy documents
     */
    getAllPolicies(): Promise<PolicyDTO[]>;

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
    getGroupsForUserV2(userId: string, options?: GetGroupsForUserOptions): Promise<PaginatedResult<GroupDTO[]>>;

    /**
     * Get a single member from a group
     * @param groupId - The group ID
     * @param userId - The user ID to find
     * @returns Group membership DTO or null if not found
     */
    getGroupMember(groupId: GroupId, userId: string): Promise<GroupMembershipDTO | null>;

    /**
     * Get all members for a group (simplified method)
     * @param groupId - The group ID
     * @returns Array of group membership DTOs
     */
    getAllGroupMembers(groupId: GroupId): Promise<GroupMembershipDTO[]>;

    getAllGroupMemberIds(groupId: GroupId): Promise<string[]>;

    // ========================================================================
    // Activity Feed Operations
    // ========================================================================

    getActivityFeedForUser(
        userId: string,
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
    getUserNotificationExists(userId: string): Promise<boolean>;

    /**
     * Find a share link by its token across all groups
     * @param token - The share link token
     * @returns Object with groupId and share link, or null if not found
     */
    findShareLinkByToken(token: string): Promise<{ groupId: GroupId; shareLink: ParsedShareLink; } | null>;

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
    ): Promise<{ comments: CommentDTO[]; hasMore: boolean; nextCursor?: string; }>;

    /**
     * Get a specific comment by target and comment ID
     * @param targetType - The target type (group or expense)
     * @param targetId - The target ID
     * @param commentId - The comment ID
     * @returns Comment document or null if not found
     */
    getComment(targetType: CommentTargetType, targetId: string, commentId: string): Promise<CommentDTO | null>;

    // ========================================================================
    // Group Related Collections Operations
    // ========================================================================

    /**
     * Get all related data for a group deletion operation
     * @param groupId - The group ID
     * @returns Object containing all related collections data
     */
    getGroupDeletionData(groupId: GroupId): Promise<{
        expenses: IQuerySnapshot;
        settlements: IQuerySnapshot;
        shareLinks: IQuerySnapshot;
        groupComments: IQuerySnapshot;
        expenseComments: IQuerySnapshot[];
    }>;

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
    verifyGroupMembership(groupId: GroupId, userId: string): Promise<boolean>;

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
    getRawPolicyDocument(policyId: string): Promise<IDocumentSnapshot | null>;

    /**
     * Get group DTO in a transaction with Timestamp → ISO conversion
     * Use this for optimistic locking with DTOs (DTO-everywhere pattern)
     * @param transaction - Firestore transaction
     * @param groupId - The group ID
     * @returns Group DTO with ISO string dates or null if not found
     */
    getGroupInTransaction(transaction: ITransaction, groupId: GroupId): Promise<GroupDTO | null>;

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
}

/**
 * FirestoreReader Implementation - Simplified Version
 *
 * Centralized service for all Firestore read operations with:
 * - Zod schema validation for type safety
 * - Consistent error handling and logging
 *
 * Note: This class implements IFirestoreReader interface which contains several
 * deprecated methods. See individual method deprecation comments in the interface
 * for migration guidance.
 */

import type { CommentId, TenantConfig, TenantDefaultFlag, TenantDomainName, TenantFullRecord, TenantId, TenantImageDTO, TenantImageId } from '@billsplit-wl/shared';
// Note: ParsedGroupMemberDocument no longer exported from schemas after DTO migration
// FirestoreReader now works directly with GroupMembershipDTO from @billsplit-wl/shared
import {
    type ActivityFeedAction,
    ActivityFeedActions,
    type ActivityFeedEventType,
    ActivityFeedEventTypes,
    type ActivityFeedItem,
    type ActivityFeedItemDetails,
    type CommentDTO,
    type ExpenseDTO,
    ExpenseId,
    type GroupDTO,
    GroupId,
    type GroupMembershipDTO,
    MAX_GROUP_MEMBERS,
    type MemberRole,
    type MemberStatus,
    MemberStatuses,
    type PolicyDTO,
    PolicyId,
    type ReactionEmoji,
    type SettlementDTO,
    SettlementId,
    type UserId,
} from '@billsplit-wl/shared';
import { FirestoreCollections } from '../../constants';
import { ErrorDetail, Errors } from '../../errors';
import { FieldPath, Filter, type IDocumentReference, type IDocumentSnapshot, type IFirestoreDatabase, type IQuery, type IQuerySnapshot, type ITransaction, Timestamp } from '../../firestore-wrapper';
import { logger } from '../../logger';
import type { MergeJobDocument } from '../../merge/MergeService';
import { measureDb } from '../../monitoring/measure';
import { assertTimestamp, safeParseISOToTimestamp } from '../../utils/dateHelpers';

// Import all schemas for validation (these still validate Timestamp objects from Firestore)
import { ShareLinkId, toActivityFeedItemId, toCommentId, toExpenseId, toGroupId, toGroupName, toISOString, toSettlementId, toShareLinkId, toTenantDefaultFlag, toUserId } from '@billsplit-wl/shared';
import {
    type ActivityFeedDocument,
    ActivityFeedDocumentSchema,
    CommentDocumentSchema,
    ExpenseReadDocumentSchema,
    GroupBalanceDocumentSchema,
    type GroupBalanceDTO,
    GroupReadDocumentSchema,
    type ParsedShareLink,
    PolicyDocumentSchema,
    SettlementDocumentSchema,
    ShareLinkDocumentSchema,
    TenantDocumentSchema,
    TenantImageDocumentSchema,
    TopLevelGroupMemberSchema,
    type UserDocument,
    UserDocumentSchema,
} from '../../schemas';
import type { TopLevelGroupMemberDocument } from '../../types';
import { newTopLevelMembershipDocId } from '../../utils/idGenerator';
import type { BatchGroupFetchOptions, FirestoreOrderField, GetGroupsForUserOptions, GroupsPaginationCursor, IFirestoreReader, PaginatedResult, QueryOptions } from './IFirestoreReader';

const EVENT_ACTION_MAP: Record<ActivityFeedEventType, ActivityFeedAction> = {
    [ActivityFeedEventTypes.GROUP_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.GROUP_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.GROUP_LOCKED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.GROUP_UNLOCKED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.PERMISSIONS_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.MEMBER_ROLE_CHANGED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.EXPENSE_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.EXPENSE_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.EXPENSE_DELETED]: ActivityFeedActions.DELETE,
    [ActivityFeedEventTypes.SETTLEMENT_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.SETTLEMENT_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.SETTLEMENT_DELETED]: ActivityFeedActions.DELETE,
    [ActivityFeedEventTypes.MEMBER_JOINED]: ActivityFeedActions.JOIN,
    [ActivityFeedEventTypes.MEMBER_LEFT]: ActivityFeedActions.LEAVE,
    [ActivityFeedEventTypes.COMMENT_ADDED]: ActivityFeedActions.COMMENT,
    [ActivityFeedEventTypes.REACTION_ADDED]: ActivityFeedActions.ADD,
    [ActivityFeedEventTypes.REACTION_REMOVED]: ActivityFeedActions.REMOVE,
};

export class FirestoreReader implements IFirestoreReader {
    constructor(private readonly db: IFirestoreDatabase) {}

    // ========================================================================
    // Timestamp Conversion Utilities
    // ========================================================================

    /**
     * Convert Firestore Timestamp to ISO 8601 string
     * This is the conversion boundary between Firestore storage format and application DTOs
     *
     * LENIENT MODE: During transition, accepts anything that looks like a date
     * Will be made strict once all code is updated to use DTOs consistently
     */
    private timestampToISO(value: any): string {
        if (!value) return value; // null/undefined pass through
        if (value instanceof Timestamp) {
            return value.toDate().toISOString();
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'string') {
            // Already ISO string (from old data or different SDK versions)
            return value;
        }
        // Lenient: if it has a toDate() method (Timestamp-like), use it
        if (typeof value === 'object' && typeof value.toDate === 'function') {
            return value.toDate().toISOString();
        }
        // Lenient: if it has seconds/nanoseconds (Timestamp-like object), convert
        if (typeof value === 'object' && typeof value.seconds === 'number') {
            return new Date(value.seconds * 1000).toISOString();
        }
        // Very lenient: return as-is for now, will be caught later when we tighten
        return value;
    }

    /**
     * Recursively convert all Timestamp objects in an object to ISO strings
     * This enables automatic DTO conversion at the read boundary
     *
     * Known date fields that will be converted:
     * - createdAt, updatedAt, deletedAt
     * - date (for expenses/settlements)
     * - joinedAt (for group members)
     * - lastModified, lastTransactionChange, lastBalanceChange, etc. (for notifications)
     *
     * Note: Uses Object.assign to preserve branded types (like GroupId) that would be lost with spread operator
     */
    private convertTimestampsToISO<T extends Record<string, any>>(obj: T): T {
        const result: any = Object.assign({}, obj);

        for (const [key, value] of Object.entries(result)) {
            if (value instanceof Timestamp) {
                result[key] = this.timestampToISO(value);
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.convertTimestampsToISO(value);
            } else if (Array.isArray(value)) {
                result[key] = value.map((item) => (item && typeof item === 'object' ? this.convertTimestampsToISO(item) : item));
            }
        }

        return result as T;
    }

    private getGroupCommentCollectionPath(groupId: string): string {
        return `${FirestoreCollections.GROUPS}/${groupId}/${FirestoreCollections.COMMENTS}`;
    }

    private getExpenseCommentCollectionPath(expenseId: string): string {
        return `${FirestoreCollections.EXPENSES}/${expenseId}/${FirestoreCollections.COMMENTS}`;
    }

    // ========================================================================
    // User Reactions Helpers
    // ========================================================================

    /**
     * Get all reactions by a specific user for a resource.
     * Reactions are stored as documents with ID format: {userId}_{emoji}
     *
     * @param collectionPath - Path to the reactions subcollection (e.g., "expenses/abc/reactions")
     * @param userId - The user whose reactions to fetch
     * @returns Array of emoji strings the user has reacted with
     */
    async getUserReactionsForResource(collectionPath: string, userId: UserId): Promise<ReactionEmoji[]> {
        try {
            // Query documents where ID starts with userId_
            // Firestore range query: >= userId_ and < userId`
            // The backtick character (`) comes after underscore in ASCII, so this captures all userId_* patterns
            const startAt = `${userId}_`;
            const endAt = `${userId}\``;

            const snapshot = await this
                .db
                .collection(collectionPath)
                .orderBy('__name__')
                .where(FieldPath.documentId(), '>=', startAt)
                .where(FieldPath.documentId(), '<', endAt)
                .get();

            const emojis: ReactionEmoji[] = [];
            snapshot.forEach((doc) => {
                // Extract emoji from document ID: {userId}_{emoji}
                const docId = doc.id;
                const underscoreIndex = docId.indexOf('_');
                if (underscoreIndex !== -1) {
                    const emoji = docId.substring(underscoreIndex + 1);
                    emojis.push(emoji as ReactionEmoji);
                }
            });

            return emojis;
        } catch (error) {
            logger.warn('Failed to get user reactions', { collectionPath, userId, error });
            return []; // Return empty array on error to avoid breaking the main query
        }
    }

    /**
     * Get user's reactions for an expense
     */
    async getUserReactionsForExpense(expenseId: ExpenseId, userId: UserId): Promise<ReactionEmoji[]> {
        const collectionPath = `${FirestoreCollections.EXPENSES}/${expenseId}/${FirestoreCollections.REACTIONS}`;
        return this.getUserReactionsForResource(collectionPath, userId);
    }

    /**
     * Get user's reactions for a settlement
     */
    async getUserReactionsForSettlement(settlementId: SettlementId, userId: UserId): Promise<ReactionEmoji[]> {
        const collectionPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}/${FirestoreCollections.REACTIONS}`;
        return this.getUserReactionsForResource(collectionPath, userId);
    }

    /**
     * Get user's reactions for a group comment
     */
    async getUserReactionsForGroupComment(groupId: GroupId, commentId: CommentId, userId: UserId): Promise<ReactionEmoji[]> {
        const collectionPath = `${FirestoreCollections.GROUPS}/${groupId}/${FirestoreCollections.COMMENTS}/${commentId}/${FirestoreCollections.REACTIONS}`;
        return this.getUserReactionsForResource(collectionPath, userId);
    }

    /**
     * Get user's reactions for an expense comment
     */
    async getUserReactionsForExpenseComment(expenseId: ExpenseId, commentId: CommentId, userId: UserId): Promise<ReactionEmoji[]> {
        const collectionPath = `${FirestoreCollections.EXPENSES}/${expenseId}/${FirestoreCollections.COMMENTS}/${commentId}/${FirestoreCollections.REACTIONS}`;
        return this.getUserReactionsForResource(collectionPath, userId);
    }

    private parseTenantDocument(snapshot: IDocumentSnapshot): TenantFullRecord {
        const rawData = snapshot.data();

        if (!rawData) {
            throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
        }

        const parsed = TenantDocumentSchema.parse({
            id: snapshot.id,
            ...rawData,
        });

        const createdAtIso = toISOString(this.timestampToISO(parsed.createdAt));
        const updatedAtIso = toISOString(this.timestampToISO(parsed.updatedAt));

        const tenant: TenantConfig = {
            tenantId: parsed.id,
            branding: parsed.branding,
            brandingTokens: parsed.brandingTokens,
            marketingFlags: parsed.marketingFlags,
            createdAt: createdAtIso,
            updatedAt: updatedAtIso,
        };

        // Domains are now a simple array
        const domains = parsed.domains;
        const isDefault: TenantDefaultFlag = parsed.defaultTenant ?? toTenantDefaultFlag(false);

        return {
            tenant,
            domains,
            isDefault,
        };
    }

    private normalizeStatusFilter(statusFilter?: MemberStatus | MemberStatus[]): MemberStatus | MemberStatus[] | undefined {
        if (statusFilter === undefined) {
            return undefined;
        }

        if (Array.isArray(statusFilter)) {
            const uniqueStatuses = Array.from(new Set(statusFilter));
            if (uniqueStatuses.length === 0) {
                return undefined;
            }
            if (uniqueStatuses.length === 1) {
                return uniqueStatuses[0];
            }
            return uniqueStatuses;
        }

        return statusFilter;
    }

    // ========================================================================
    // Document Read Operations
    // ========================================================================

    async getUser(userId: UserId): Promise<UserDocument | null> {
        try {
            const userDoc = await this.db.collection(FirestoreCollections.USERS).doc(userId).get();

            if (!userDoc.exists) {
                return null;
            }

            // Validate with Document schema (expects Timestamps)
            const rawData = {
                id: userDoc.id,
                ...userDoc.data(),
            };
            const userData = UserDocumentSchema.parse(rawData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(userData);

            return convertedData as unknown as UserDocument;
        } catch (error) {
            logger.error('Failed to get user', error);
            throw error;
        }
    }

    async getGroup(groupId: GroupId, options: { includeDeleted?: boolean; } = {}): Promise<GroupDTO | null> {
        try {
            const groupDoc = await this.db.collection(FirestoreCollections.GROUPS).doc(groupId).get();

            if (!groupDoc.exists) {
                return null;
            }

            // Sanitize the data before validation
            const rawData = {
                id: groupDoc.id,
                ...groupDoc.data(),
            };
            const sanitizedData = this.sanitizeGroupData(rawData);

            // Validate with Document schema (expects Timestamps)
            const groupData = GroupReadDocumentSchema.parse(sanitizedData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(groupData);

            const group = convertedData as unknown as GroupDTO;

            if (group.deletedAt && !options.includeDeleted) {
                return null;
            }

            return group;
        } catch (error) {
            logger.error('Failed to get group', error);
            throw error;
        }
    }

    async getGroupBalance(groupId: GroupId): Promise<GroupBalanceDTO> {
        try {
            const doc = await this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('metadata').doc('balance').get();

            if (!doc.exists) {
                throw Errors.notFound('Balance', ErrorDetail.BALANCE_NOT_FOUND);
            }

            const data = doc.data();
            if (!data) {
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

            // Validate with Firestore schema (expects Timestamps)
            const validated = GroupBalanceDocumentSchema.parse(data);

            // Convert Timestamps to ISO strings for DTO
            return this.convertTimestampsToISO(validated) as any as GroupBalanceDTO;
        } catch (error) {
            logger.error('Failed to get group balance', error, { groupId });
            throw error;
        }
    }

    async getExpense(expenseId: ExpenseId, options?: { includeSoftDeleted?: boolean; }): Promise<ExpenseDTO | null> {
        try {
            const expenseDoc = await this.db.collection(FirestoreCollections.EXPENSES).doc(expenseId).get();

            if (!expenseDoc.exists) {
                return null;
            }

            // Validate with Document schema (expects Timestamps)
            const rawData = {
                id: expenseDoc.id,
                ...expenseDoc.data(),
            };
            const expenseData = ExpenseReadDocumentSchema.parse(rawData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(expenseData);
            const expense = convertedData as unknown as ExpenseDTO;

            // Return null if expense is soft-deleted (unless explicitly including them)
            if (!options?.includeSoftDeleted && expense.deletedAt) {
                return null;
            }

            return expense;
        } catch (error) {
            logger.error('Failed to get expense', error);
            throw error;
        }
    }

    async getPolicy(policyId: PolicyId): Promise<PolicyDTO | null> {
        try {
            const policyDoc = await this.db.collection(FirestoreCollections.POLICIES).doc(policyId).get();

            if (!policyDoc.exists) {
                return null;
            }

            // Validate with Document schema (expects Timestamps)
            const rawData = {
                id: policyDoc.id,
                ...policyDoc.data(),
            };
            const policyData = PolicyDocumentSchema.parse(rawData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(policyData);

            return convertedData as unknown as PolicyDTO;
        } catch (error) {
            logger.error('Failed to get policy', error);
            throw error;
        }
    }

    async getAllPolicies(): Promise<PolicyDTO[]> {
        try {
            const snapshot = await this.db.collection(FirestoreCollections.POLICIES).get();

            const policies: PolicyDTO[] = [];

            snapshot.forEach((doc) => {
                try {
                    // Validate with Document schema (expects Timestamps)
                    const rawData = {
                        id: doc.id,
                        ...doc.data(),
                    };
                    const policyData = PolicyDocumentSchema.parse(rawData);

                    // Convert Timestamps to ISO strings for DTO
                    const convertedData = this.convertTimestampsToISO(policyData);

                    policies.push(convertedData as unknown as PolicyDTO);
                } catch (validationError) {
                    logger.warn('Skipping invalid policy document during getAllPolicies');
                }
            });

            return policies;
        } catch (error) {
            logger.error('Failed to get all policies', error);
            throw error;
        }
    }

    /**
     * Sanitizes group data before validation to handle invalid values
     * that may have been inserted into the database
     */
    private sanitizeGroupData(data: unknown): Record<string, unknown> {
        if (typeof data !== 'object' || data === null) {
            throw new Error('Invalid group data: expected object');
        }
        const sanitized = { ...(data as Record<string, unknown>) };

        // Remove API-only computed fields that should never be in Firestore
        // These might be present in corrupted data from old migrations or test data
        delete sanitized.balance;
        delete sanitized.lastActivity;
        // Assert timestamp fields are proper Timestamp objects
        // DO NOT silently fix corrupted data - let it throw
        sanitized.createdAt = assertTimestamp(sanitized.createdAt, 'createdAt');
        sanitized.updatedAt = assertTimestamp(sanitized.updatedAt, 'updatedAt');
        if (sanitized.deletedAt !== undefined && sanitized.deletedAt !== null) {
            sanitized.deletedAt = assertTimestamp(sanitized.deletedAt, 'deletedAt');
        }

        return sanitized;
    }

    /**
     * Encode cursor data for pagination
     * @param data - Cursor data to encode
     * @returns Base64 encoded cursor string
     */
    private encodeCursor(data: GroupsPaginationCursor): string {
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }

    /**
     * Decode cursor string for pagination
     * @param cursor - Base64 encoded cursor string
     * @returns Decoded cursor data
     */
    private decodeCursor(cursor: string): GroupsPaginationCursor {
        return JSON.parse(Buffer.from(cursor, 'base64').toString());
    }

    /**
     * Efficiently fetch groups by IDs with proper ordering and limits
     * This method avoids the "fetch-all-then-paginate" anti-pattern
     * @param groupIds - Array of group IDs to fetch
     * @param options - Options for ordering and limiting results
     * @returns Array of group documents, limited and ordered as specified
     */
    private async getGroupsByIds(groupIds: GroupId[], options: BatchGroupFetchOptions): Promise<GroupDTO[]> {
        if (groupIds.length === 0) return [];

        const allGroups: GroupDTO[] = [];

        // Process in chunks of 10 (Firestore 'in' query limit)
        // BUT apply limit across ALL chunks to avoid fetching unnecessary data
        for (let i = 0; i < groupIds.length; i += 10) {
            // Stop if we've already reached our limit
            if (allGroups.length >= options.limit) {
                break;
            }

            const chunk = groupIds.slice(i, i + 10);
            const remainingLimit = options.limit - allGroups.length;

            let query = this
                .db
                .collection(FirestoreCollections.GROUPS)
                .where(FieldPath.documentId(), 'in', chunk)
                .orderBy(options.orderBy.field, options.orderBy.direction)
                .limit(Math.min(remainingLimit, chunk.length)); // Apply limit per chunk

            const snapshot = await query.get();

            for (const doc of snapshot.docs) {
                try {
                    // Sanitize the data before validation
                    const rawData = {
                        id: doc.id,
                        ...doc.data(),
                    };
                    const sanitizedData = this.sanitizeGroupData(rawData);

                    // Validate with Document schema (expects Timestamps)
                    const groupData = GroupReadDocumentSchema.parse(sanitizedData);

                    // Convert Timestamps to ISO strings for DTO
                    const convertedData = this.convertTimestampsToISO(groupData);

                    const group = convertedData as unknown as GroupDTO;
                    if (group.deletedAt) {
                        continue;
                    }

                    allGroups.push(group);

                    // Hard stop if we reach the limit
                    if (allGroups.length >= options.limit) break;
                } catch (error) {
                    logger.error('Invalid group document in getGroupsByIds', error);
                    // Skip invalid documents rather than failing the entire query
                }
            }
        }

        // Final sort since we might have fetched from multiple queries
        // This is much more efficient than sorting ALL groups like the old implementation
        return allGroups.sort((a: GroupDTO, b: GroupDTO) => {
            const field = options.orderBy.field as keyof GroupDTO;
            const direction = options.orderBy.direction;
            const aValue = a[field];
            const bValue = b[field];

            if (aValue === undefined || aValue === null || bValue === undefined || bValue === null) return 0;

            return direction === 'asc' ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
        });
    }

    /**
     * ✅ NEW: Enhanced group retrieval using top-level group-memberships collection
     *
     * This method fixes the pagination issues by:
     * 1. Querying the top-level group-memberships collection with database-level ordering
     * 2. Using groupUpdatedAt field for proper activity-based sorting
     * 3. Supporting efficient cursor-based pagination
     *
     * @param userId - User ID to fetch groups for
     * @param options - Query options including limit, cursor, and orderBy
     * @returns Paginated result with groups ordered by most recent activity
     */
    async getGroupsForUserV2(userId: UserId, options: GetGroupsForUserOptions = {}): Promise<PaginatedResult<GroupDTO[]>> {
        return measureDb('USER_GROUPS_V2', async () => {
            const limit = options.limit || 10;

            // Build query with database-level ordering by groupUpdatedAt
            const orderDirection = options.orderBy?.direction || 'desc';
            const normalizedStatusFilter = this.normalizeStatusFilter(options.statusFilter);
            const applyStatusFilter = (targetQuery: IQuery): IQuery => {
                if (normalizedStatusFilter === undefined) {
                    return targetQuery.where('memberStatus', '==', MemberStatuses.ACTIVE);
                }

                if (Array.isArray(normalizedStatusFilter)) {
                    return targetQuery.where('memberStatus', 'in', normalizedStatusFilter);
                }

                return targetQuery.where('memberStatus', '==', normalizedStatusFilter);
            };

            let query = applyStatusFilter(
                this
                    .db
                    .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
                    .where('uid', '==', userId),
            );

            query = query.orderBy('groupUpdatedAt', orderDirection);

            // Build count query (runs in parallel for efficiency)
            const countQuery = applyStatusFilter(
                this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).where('uid', '==', userId),
            );

            // Apply cursor pagination
            if (options?.cursor) {
                try {
                    const cursorData = this.decodeCursor(options.cursor);
                    // Convert ISO string back to Timestamp for proper comparison
                    const cursorTimestamp = Timestamp.fromDate(new Date(cursorData.lastUpdatedAt));
                    query = query.startAfter(cursorTimestamp);
                } catch (error) {
                    // Invalid cursor - ignore and start from beginning
                    logger.warn('Invalid cursor provided, starting from beginning', { cursor: options.cursor });
                }
            }

            query = query.limit(limit + 1); // +1 to detect hasMore

            // Execute data query and count query in parallel
            const [snapshot, countSnapshot] = await Promise.all([
                query.get(),
                countQuery.count().get(),
            ]);

            const hasMore = snapshot.docs.length > limit;
            const memberships = (hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs).map((doc) => doc.data() as TopLevelGroupMemberDocument);
            const totalCount = countSnapshot.data().count;

            if (memberships.length === 0) {
                return {
                    data: [] as GroupDTO[],
                    hasMore: false,
                    totalEstimate: totalCount,
                };
            }

            // Get group documents and preserve the membership query order
            const groupIds = memberships.map((m) => m.groupId);

            // Fetch groups without additional sorting since we want membership order
            const fetchedGroups = await this.getGroupsByIds(groupIds, {
                limit: groupIds.length, // Get all groups since they're already limited
                orderBy: { field: 'updatedAt', direction: 'desc' },
            });

            // Preserve the order from the membership query by sorting fetchedGroups by groupIds order
            const groupsMap = new Map(fetchedGroups.map((group) => [group.id, group]));
            const groups = groupIds.map((id) => groupsMap.get(id)).filter((group): group is GroupDTO => group !== undefined);

            // Generate next cursor if there are more results
            let nextCursor: string | undefined;
            if (hasMore) {
                const lastMembership = memberships[memberships.length - 1];
                const timestamp = lastMembership.groupUpdatedAt;
                // Handle both Timestamp objects and ISO strings (from old data or different SDK versions)
                let lastUpdatedAtISO: string;
                if (typeof timestamp === 'string') {
                    // Already an ISO string (from old data)
                    lastUpdatedAtISO = timestamp;
                } else if (timestamp && typeof timestamp.toDate === 'function') {
                    // Admin Timestamp object
                    lastUpdatedAtISO = timestamp.toDate().toISOString();
                } else if (timestamp instanceof Date) {
                    // Regular Date object
                    lastUpdatedAtISO = timestamp.toISOString();
                } else {
                    throw new Error(`Invalid groupUpdatedAt timestamp type: ${typeof timestamp}`);
                }
                nextCursor = this.encodeCursor({
                    lastGroupId: lastMembership.groupId,
                    lastUpdatedAt: lastUpdatedAtISO,
                    membershipCursor: lastMembership.groupId,
                });
            }

            return {
                data: groups,
                hasMore,
                nextCursor,
                totalEstimate: totalCount,
            };
        });
    }

    async getGroupMember(groupId: GroupId, userId: UserId): Promise<GroupMembershipDTO | null> {
        return measureDb('GET_MEMBER', async () => {
            // Use top-level collection instead of subcollection
            const topLevelDocId = newTopLevelMembershipDocId(userId, groupId);
            const memberRef = this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).doc(topLevelDocId);

            const memberDoc = await memberRef.get();
            if (!memberDoc.exists) {
                return null;
            }

            const topLevelData = memberDoc.data();
            if (!topLevelData) {
                throw new Error(`Group member document ${memberDoc.id} has no data`);
            }

            // Use TopLevelGroupMemberSchema for top-level collection validation (includes groupUpdatedAt, createdAt, updatedAt)
            const parsedMember = TopLevelGroupMemberSchema.parse(topLevelData);

            // Convert Timestamps to ISO strings (DTO conversion)
            return this.convertTimestampsToISO(parsedMember) as unknown as GroupMembershipDTO;
        });
    }

    /**
     * Batch fetch multiple group members efficiently
     * Returns a Map for O(1) lookups by userId
     * @param groupId The group ID
     * @param userIds Array of user IDs to fetch
     * @returns Map of userId to GroupMembershipDTO (excludes members not found)
     */
    async getGroupMembers(groupId: GroupId, userIds: UserId[]): Promise<Map<UserId, GroupMembershipDTO>> {
        return measureDb('GET_MEMBERS_BATCH', async () => {
            if (userIds.length === 0) {
                return new Map();
            }

            // Fetch all members in parallel (more efficient than sequential)
            const memberPromises = userIds.map((userId) => this.getGroupMember(groupId, userId));
            const members = await Promise.all(memberPromises);

            // Build result map, filtering out null values (members not found)
            const result = new Map<UserId, GroupMembershipDTO>();

            for (let i = 0; i < members.length; i++) {
                const member = members[i];
                const userId = userIds[i];

                if (member) {
                    result.set(userId, member);
                }
            }

            logger.info('Batch fetched group members', {
                groupId,
                requested: userIds.length,
                found: result.size,
                missing: userIds.length - result.size,
            });

            return result;
        });
    }

    async getAllGroupMemberIds(groupId: GroupId): Promise<UserId[]> {
        return measureDb('GET_MEMBER_IDS', async () => {
            // Optimized: Only fetch uid field from Firestore
            const membersQuery = this
                .db
                .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
                .where('groupId', '==', groupId)
                .select('uid')
                .limit(MAX_GROUP_MEMBERS + 1);

            const snapshot = await membersQuery.get();

            // Detect overflow - group exceeds maximum size
            if (snapshot.size > MAX_GROUP_MEMBERS) {
                throw Errors.invalidRequest(ErrorDetail.GROUP_AT_CAPACITY);
            }

            // Extract uids and convert to branded UserId type
            return snapshot
                .docs
                .map((doc) => doc.data().uid)
                .filter((uid): uid is string => typeof uid === 'string')
                .map((uid) => toUserId(uid));
        });
    }

    async getAllGroupMembers(groupId: GroupId): Promise<GroupMembershipDTO[]> {
        return measureDb('GET_MEMBERS', async () => {
            // Use top-level collection instead of subcollection
            // Fetch one extra to detect overflow
            const membersQuery = this
                .db
                .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
                .where('groupId', '==', groupId)
                .limit(MAX_GROUP_MEMBERS + 1);

            const snapshot = await membersQuery.get();

            // Detect overflow - group exceeds maximum size - should never happen!
            if (snapshot.size > MAX_GROUP_MEMBERS) {
                throw Errors.invalidRequest(ErrorDetail.GROUP_AT_CAPACITY);
            }

            const parsedMembers: GroupMembershipDTO[] = [];

            for (const doc of snapshot.docs) {
                try {
                    const topLevelData = doc.data();
                    if (!topLevelData) {
                        logger.error('Group member document has no data', { docId: doc.id });
                        continue;
                    }

                    // Schema validation will ensure uid field exists and is correct
                    const memberData = TopLevelGroupMemberSchema.parse({
                        ...topLevelData,
                        id: topLevelData.uid, // Use uid as the document ID
                    });

                    // Convert Timestamps to ISO strings (DTO conversion)
                    parsedMembers.push(this.convertTimestampsToISO(memberData) as unknown as GroupMembershipDTO);
                } catch (error) {
                    logger.error('Invalid group member document in getAllGroupMembers', error);
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return parsedMembers;
        });
    }

    async getActivityFeedForUser(
        userId: UserId,
        options: {
            limit?: number;
            cursor?: string;
        } = {},
    ): Promise<{ items: ActivityFeedItem[]; hasMore: boolean; nextCursor?: string; }> {
        return measureDb('GET_ACTIVITY_FEED_FOR_USER', async () => {
            const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
            const fetchLimit = limit + 1;

            const collectionRef = this
                .db
                .collection(FirestoreCollections.ACTIVITY_FEED)
                .doc(userId)
                .collection('items');

            let query = collectionRef.orderBy('createdAt', 'desc').orderBy('__name__', 'desc').limit(fetchLimit);

            if (options.cursor) {
                const cursorDoc = await collectionRef.doc(options.cursor).get();
                if (!cursorDoc.exists) {
                    throw Errors.validationError('cursor', ErrorDetail.INVALID_CURSOR);
                }
                query = query.startAfter(cursorDoc);
            }

            const snapshot = await query.get();
            const docs = snapshot.docs;

            const hasMore = docs.length > limit;
            const limitedDocs = hasMore ? docs.slice(0, limit) : docs;

            const items: ActivityFeedItem[] = [];
            for (const doc of limitedDocs) {
                const rawData = doc.data();
                if (!rawData) {
                    continue;
                }

                try {
                    const validated = ActivityFeedDocumentSchema.parse({
                        id: doc.id,
                        ...rawData,
                    });

                    const converted = this.convertTimestampsToISO(validated) as unknown as ActivityFeedDocument;

                    const eventType = converted.eventType as ActivityFeedEventType;
                    const action = (converted.action as ActivityFeedAction | undefined) ?? EVENT_ACTION_MAP[eventType];

                    const item: ActivityFeedItem = {
                        id: toActivityFeedItemId(converted.id),
                        userId: converted.userId,
                        groupId: converted.groupId,
                        groupName: converted.groupName,
                        eventType,
                        action,
                        actorId: converted.actorId,
                        actorName: converted.actorName,
                        timestamp: converted.timestamp,
                        details: this.convertActivityFeedDetails(converted.details),
                        createdAt: converted.createdAt,
                    };

                    items.push(item);
                } catch (error) {
                    logger.error('Invalid activity feed document encountered', error, {
                        userId,
                        docId: doc.id,
                    });
                }
            }

            const nextCursor = hasMore && limitedDocs.length > 0 ? limitedDocs[limitedDocs.length - 1]!.id : undefined;

            return {
                items,
                hasMore,
                nextCursor,
            };
        });
    }

    async getActivityFeedForGroup(
        groupId: GroupId,
        options: {
            limit?: number;
            cursor?: string;
        } = {},
    ): Promise<{ items: ActivityFeedItem[]; hasMore: boolean; nextCursor?: string; }> {
        return measureDb('GET_ACTIVITY_FEED_FOR_GROUP', async () => {
            const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
            // Fetch extra to account for duplicates (each event stored per-member)
            // Worst case: all items are duplicates from N members, so fetch limit * estimated_members
            const fetchMultiplier = 10; // Assume up to 10 members per group
            const fetchLimit = (limit + 1) * fetchMultiplier;

            // Use collection group query to find activity items across all users for this group
            let query = this
                .db
                .collectionGroup('items')
                .where('groupId', '==', groupId)
                .orderBy('createdAt', 'desc')
                .orderBy('__name__', 'desc')
                .limit(fetchLimit);

            if (options.cursor) {
                // For collection group queries, cursor needs to include the full path
                // The cursor format is: userId/items/docId
                const cursorParts = options.cursor.split('/');
                if (cursorParts.length === 3) {
                    const [userId, , docId] = cursorParts;
                    const cursorDoc = await this
                        .db
                        .collection(FirestoreCollections.ACTIVITY_FEED)
                        .doc(userId!)
                        .collection('items')
                        .doc(docId!)
                        .get();
                    if (!cursorDoc.exists) {
                        throw Errors.validationError('cursor', ErrorDetail.INVALID_CURSOR);
                    }
                    query = query.startAfter(cursorDoc);
                } else {
                    throw Errors.validationError('cursor', ErrorDetail.INVALID_CURSOR);
                }
            }

            const snapshot = await query.get();
            const docs = snapshot.docs;

            // Deduplicate: same event is stored once per group member
            // Create unique key from eventType + actorId + timestamp + relevant details
            const seenEventKeys = new Set<string>();
            const items: ActivityFeedItem[] = [];
            let lastIncludedDocIndex = -1;

            for (let i = 0; i < docs.length; i++) {
                const doc = docs[i]!;
                const rawData = doc.data();
                if (!rawData) {
                    continue;
                }

                try {
                    const validated = ActivityFeedDocumentSchema.parse({
                        id: doc.id,
                        ...rawData,
                    });

                    const converted = this.convertTimestampsToISO(validated) as unknown as ActivityFeedDocument;

                    // Generate unique event key for deduplication
                    const eventKey = this.generateActivityEventKey(converted);
                    if (seenEventKeys.has(eventKey)) {
                        continue; // Skip duplicate
                    }
                    seenEventKeys.add(eventKey);

                    // Stop if we have enough unique items
                    if (items.length >= limit + 1) {
                        break;
                    }

                    const eventType = converted.eventType as ActivityFeedEventType;
                    const action = (converted.action as ActivityFeedAction | undefined) ?? EVENT_ACTION_MAP[eventType];

                    const item: ActivityFeedItem = {
                        id: toActivityFeedItemId(converted.id),
                        userId: converted.userId,
                        groupId: converted.groupId,
                        groupName: converted.groupName,
                        eventType,
                        action,
                        actorId: converted.actorId,
                        actorName: converted.actorName,
                        timestamp: converted.timestamp,
                        details: this.convertActivityFeedDetails(converted.details),
                        createdAt: converted.createdAt,
                    };

                    items.push(item);
                    lastIncludedDocIndex = i;
                } catch (error) {
                    logger.error('Invalid activity feed document encountered', error, {
                        groupId,
                        docId: doc.id,
                    });
                }
            }

            const hasMore = items.length > limit;
            const limitedItems = hasMore ? items.slice(0, limit) : items;

            // For collection group queries, create cursor with full path: userId/items/docId
            let nextCursor: string | undefined;
            if (hasMore && lastIncludedDocIndex >= 0) {
                // Use the document at the limit position (last included item)
                const limitDocIndex = Math.min(lastIncludedDocIndex, docs.length - 1);
                const lastDoc = docs[limitDocIndex]!;
                // Extract userId from document path: activity-feed/{userId}/items/{docId}
                const pathParts = lastDoc.ref.path.split('/');
                const userId = pathParts[1];
                const docId = pathParts[3];
                nextCursor = `${userId}/items/${docId}`;
            }

            return {
                items: limitedItems,
                hasMore,
                nextCursor,
            };
        });
    }

    /**
     * Convert raw activity feed details to use branded types.
     * Centralizes the conversion logic for both getActivityFeed and getActivityFeedForGroup.
     */
    private convertActivityFeedDetails(rawDetails: ActivityFeedDocument['details']): ActivityFeedItemDetails {
        const details = rawDetails ?? {};
        return {
            ...details,
            ...(details.expenseId && { expenseId: toExpenseId(details.expenseId) }),
            ...(details.commentId && { commentId: toCommentId(details.commentId) }),
            ...(details.settlementId && { settlementId: toSettlementId(details.settlementId) }),
            ...(details.previousGroupName && { previousGroupName: toGroupName(details.previousGroupName) }),
            ...(details.newRole && { newRole: details.newRole as MemberRole }),
        } as ActivityFeedItemDetails;
    }

    /**
     * Generate a unique key for an activity event to enable deduplication.
     * Same event is stored once per group member, differing only by userId.
     */
    private generateActivityEventKey(activity: ActivityFeedDocument): string {
        const details = activity.details ?? {};
        const keyParts = [
            activity.eventType,
            activity.actorId,
            activity.timestamp,
            details.expenseId ?? '',
            details.settlementId ?? '',
            details.commentId ?? '',
            details.targetUserId ?? '',
        ];
        return keyParts.join('|');
    }

    /**
     * ✅ FIXED: Efficient paginated group retrieval with hybrid strategy
     *
     * This method implements the performance fix from the critical pagination report:
     * - Uses query-level pagination instead of fetch-all-then-paginate
     * - Applies limits at the database query level, not in memory
     * - Provides proper cursor-based pagination with hasMore detection
     * - Reduces resource usage by 90%+ for users with many groups
     */

    async getSettlement(settlementId: SettlementId, options?: { includeSoftDeleted?: boolean; }): Promise<SettlementDTO | null> {
        try {
            const settlementDoc = await this.db.collection(FirestoreCollections.SETTLEMENTS).doc(settlementId).get();

            if (!settlementDoc.exists) {
                return null;
            }

            // Validate with Document schema (expects Timestamps)
            const rawData = {
                id: settlementDoc.id,
                ...settlementDoc.data(),
            };
            const settlementData = SettlementDocumentSchema.parse(rawData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(settlementData);
            const settlement = convertedData as unknown as SettlementDTO;

            // Return null if settlement is soft-deleted (unless explicitly including them)
            if (!options?.includeSoftDeleted && settlement.deletedAt) {
                return null;
            }

            return settlement;
        } catch (error) {
            logger.error('Failed to get settlement', error);
            throw error;
        }
    }

    /**
     * Builds base query for settlements filtering out soft-deleted items
     * @private
     */
    private buildBaseSettlementQuery(groupId: GroupId, includeDeleted: boolean = false): IQuery {
        let query = this.db.collection(FirestoreCollections.SETTLEMENTS).where('groupId', '==', groupId);

        if (!includeDeleted) {
            query = query.where('deletedAt', '==', null);
        }

        return query;
    }

    /**
     * Executes settlement query and converts documents to DTOs
     * @private
     */
    private async executeSettlementQuery(query: IQuery): Promise<SettlementDTO[]> {
        const snapshot = await query.get();
        const settlements: SettlementDTO[] = [];

        for (const doc of snapshot.docs) {
            try {
                const rawData = { id: doc.id, ...doc.data() };
                const settlementData = SettlementDocumentSchema.parse(rawData);
                const convertedData = this.convertTimestampsToISO(settlementData);
                settlements.push(convertedData as unknown as SettlementDTO);
            } catch (error) {
                logger.error('Invalid settlement document', error);
            }
        }

        return settlements;
    }

    async getSettlementsForGroup(
        groupId: GroupId,
        options: QueryOptions,
    ): Promise<{
        settlements: SettlementDTO[];
        hasMore: boolean;
        nextCursor?: string;
    }> {
        try {
            const limit = Math.min(options.limit ?? 50, 100);
            let query = this.buildBaseSettlementQuery(groupId, options.includeDeleted ?? false);

            // Apply ordering (default to createdAt desc if not specified)
            if (options.orderBy) {
                query = query.orderBy(options.orderBy.field, options.orderBy.direction);
            } else {
                query = query.orderBy('createdAt', 'desc');
            }

            // Apply user filter (for settlements involving specific user)
            if (options.filterUserId) {
                query = query.where(Filter.or(Filter.where('payerId', '==', options.filterUserId), Filter.where('payeeId', '==', options.filterUserId)));
            }

            // Apply date range filter
            if (options.dateRange?.start) {
                query = query.where('date', '>=', safeParseISOToTimestamp(options.dateRange.start));
            }
            if (options.dateRange?.end) {
                query = query.where('date', '<=', safeParseISOToTimestamp(options.dateRange.end));
            }

            // For cursor-based pagination, fetch limit + 1 to detect hasMore
            query = query.limit(limit + 1);

            // Apply offset-based pagination (for batch fetching)
            if (options.offset !== undefined && options.offset > 0) {
                query = query.offset(options.offset);
            }

            // Apply cursor-based pagination (for API endpoints)
            if (options.cursor) {
                const cursorDoc = await this.db.collection(FirestoreCollections.SETTLEMENTS).doc(options.cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            const settlements = await this.executeSettlementQuery(query);

            const hasMore = settlements.length > limit;
            const settlementsToReturn = hasMore ? settlements.slice(0, limit) : settlements;
            const nextCursor = hasMore && settlementsToReturn.length > 0 ? settlementsToReturn[settlementsToReturn.length - 1].id : undefined;

            return {
                settlements: settlementsToReturn,
                hasMore,
                nextCursor,
            };
        } catch (error) {
            logger.error('Failed to get settlements for group', error);
            throw error;
        }
    }

    // ========================================================================
    // Share Link Operations
    // ========================================================================

    async findShareLinkByToken(token: string): Promise<{ groupId: GroupId; shareLinkId: ShareLinkId; shareLink: ParsedShareLink | null; } | null> {
        try {
            // Validate token format - Firestore document IDs cannot contain forward slashes
            if (token.includes('/')) {
                logger.warn('Invalid token format: contains forward slashes', { token });
                return null;
            }

            const indexDoc = await this.db.collection(FirestoreCollections.SHARE_LINK_TOKENS).doc(token).get();

            if (!indexDoc.exists) {
                return null;
            }

            const indexData = indexDoc.data() as {
                groupId?: GroupId;
                shareLinkId?: string;
                expiresAt?: string;
            } | undefined;

            if (!indexData?.groupId || !indexData?.shareLinkId) {
                logger.error('Share link index document is missing required fields', undefined, {
                    token,
                    indexData,
                });
                return null;
            }

            const shareLinkRef = this
                .db
                .collection(FirestoreCollections.GROUPS)
                .doc(indexData.groupId)
                .collection('shareLinks')
                .doc(indexData.shareLinkId);

            const shareLinkDoc = await shareLinkRef.get();

            if (!shareLinkDoc.exists) {
                logger.warn('Share link index doc points to missing share link', {
                    token,
                    groupId: indexData.groupId,
                    shareLinkId: indexData.shareLinkId,
                });
                return {
                    groupId: indexData.groupId,
                    shareLinkId: toShareLinkId(indexData.shareLinkId),
                    shareLink: null,
                };
            }

            // Extract group ID from document path: groups/{groupId}/shareLinks/{shareLinkId}
            // shareLinkDoc.ref.parent = shareLinks collection
            // shareLinkDoc.ref.parent.parent = groups/{groupId} document
            if (!shareLinkDoc.ref.parent?.parent) {
                throw new Error('Invalid share link document structure - cannot determine group ID');
            }
            const groupId = toGroupId(shareLinkDoc.ref.parent.parent.id);

            const rawData = shareLinkDoc.data();
            if (!rawData) {
                throw new Error('Share link document data is null');
            }

            const dataWithId = { ...rawData, id: shareLinkDoc.id };
            const normalizedData = this.convertTimestampsToISO(dataWithId);
            const shareLink = ShareLinkDocumentSchema.parse(normalizedData);

            return { groupId, shareLinkId: toShareLinkId(shareLinkDoc.id), shareLink };
        } catch (error) {
            logger.error('Failed to find share link by token', error);
            throw error;
        }
    }

    async getExpiredShareLinkRefsInTransaction(transaction: ITransaction, groupId: GroupId, cutoffIso: string): Promise<IDocumentReference[]> {
        const shareLinksCollection = this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('shareLinks');
        const expiredQuery = shareLinksCollection.where('expiresAt', '<=', cutoffIso);
        const snapshot = await transaction.get(expiredQuery);
        return snapshot.docs.map((doc) => doc.ref);
    }

    // ========================================================================
    // Comment Operations
    // ========================================================================

    async getGroupComments(
        groupId: GroupId,
        options: {
            limit?: number;
            cursor?: string;
            orderBy?: FirestoreOrderField;
            direction?: 'asc' | 'desc';
        } = {},
    ): Promise<{ comments: CommentDTO[]; hasMore: boolean; nextCursor?: string; }> {
        try {
            const { limit = 50, cursor, orderBy = 'createdAt', direction = 'desc' } = options;
            const commentsCollection = this.db.collection(this.getGroupCommentCollectionPath(groupId));

            let query = commentsCollection.orderBy(orderBy, direction).limit(limit + 1);

            if (cursor) {
                const cursorDoc = await commentsCollection.doc(cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            const snapshot = await query.get();
            const docs = snapshot.docs;

            const hasMore = docs.length > limit;
            const commentsToReturn = hasMore ? docs.slice(0, limit) : docs;

            const comments: CommentDTO[] = [];
            for (const doc of commentsToReturn) {
                try {
                    const rawData = doc.data();
                    const dataWithId = { ...rawData, id: doc.id };
                    const comment = CommentDocumentSchema.parse(dataWithId);
                    const convertedComment = this.convertTimestampsToISO(comment);
                    comments.push(convertedComment as unknown as CommentDTO);
                } catch (error) {
                    logger.error('Invalid group comment document in getGroupComments', error);
                }
            }

            return {
                comments,
                hasMore,
                nextCursor: hasMore && commentsToReturn.length > 0 ? commentsToReturn[commentsToReturn.length - 1].id : undefined,
            };
        } catch (error) {
            logger.error('Failed to get group comments', error);
            throw error;
        }
    }

    async getExpenseComments(
        expenseId: ExpenseId,
        options: {
            limit?: number;
            cursor?: string;
            orderBy?: FirestoreOrderField;
            direction?: 'asc' | 'desc';
        } = {},
    ): Promise<{ comments: CommentDTO[]; hasMore: boolean; nextCursor?: string; }> {
        try {
            const { limit = 50, cursor, orderBy = 'createdAt', direction = 'desc' } = options;
            const commentsCollection = this.db.collection(this.getExpenseCommentCollectionPath(expenseId));

            let query = commentsCollection.orderBy(orderBy, direction).limit(limit + 1);

            if (cursor) {
                const cursorDoc = await commentsCollection.doc(cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            const snapshot = await query.get();
            const docs = snapshot.docs;

            const hasMore = docs.length > limit;
            const commentsToReturn = hasMore ? docs.slice(0, limit) : docs;

            const comments: CommentDTO[] = [];
            for (const doc of commentsToReturn) {
                try {
                    const rawData = doc.data();
                    const dataWithId = { ...rawData, id: doc.id };
                    const comment = CommentDocumentSchema.parse(dataWithId);
                    const convertedComment = this.convertTimestampsToISO(comment);
                    comments.push(convertedComment as unknown as CommentDTO);
                } catch (error) {
                    logger.error('Invalid expense comment document in getExpenseComments', error);
                }
            }

            return {
                comments,
                hasMore,
                nextCursor: hasMore && commentsToReturn.length > 0 ? commentsToReturn[commentsToReturn.length - 1].id : undefined,
            };
        } catch (error) {
            logger.error('Failed to get expense comments', error);
            throw error;
        }
    }

    async getGroupComment(groupId: GroupId, commentId: CommentId): Promise<CommentDTO | null> {
        const collectionPath = this.getGroupCommentCollectionPath(groupId);
        try {
            return await this.getCommentByCollectionPath(collectionPath, commentId);
        } catch (error) {
            logger.error('Failed to get group comment', error, { groupId, commentId });
            throw error;
        }
    }

    async getExpenseComment(expenseId: ExpenseId, commentId: CommentId): Promise<CommentDTO | null> {
        const collectionPath = this.getExpenseCommentCollectionPath(expenseId);
        try {
            return await this.getCommentByCollectionPath(collectionPath, commentId);
        } catch (error) {
            logger.error('Failed to get expense comment', error, { expenseId, commentId });
            throw error;
        }
    }

    private async getCommentByCollectionPath(collectionPath: string, commentId: CommentId): Promise<CommentDTO | null> {
        const commentsCollection = this.db.collection(collectionPath);
        const doc = await commentsCollection.doc(commentId).get();

        if (!doc.exists) {
            return null;
        }

        const rawData = doc.data();
        if (!rawData) {
            return null;
        }

        const dataWithId = { ...rawData, id: doc.id };
        const comment = CommentDocumentSchema.parse(dataWithId);
        const convertedComment = this.convertTimestampsToISO(comment);
        return convertedComment as unknown as CommentDTO;
    }

    // ========================================================================
    // Test User Pool Operations
    // ========================================================================

    // ========================================================================
    // System Metrics Operations
    // ========================================================================

    async getExpensesForGroupPaginated(
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
    }> {
        return measureDb('FirestoreReader.getExpensesForGroupPaginated', async () => {
            try {
                const limit = Math.min(options?.limit || 20, 100);
                const cursor = options?.cursor;
                const includeDeleted = options?.includeDeleted || false;

                let query = this.db.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId);

                // Filter out deleted expenses by default
                if (!includeDeleted) {
                    query = query.where('deletedAt', '==', null);
                }

                query = query
                    .select(
                        'groupId',
                        'createdBy',
                        'paidBy',
                        'amount',
                        'currency',
                        'description',
                        'labels',
                        'date',
                        'splitType',
                        'participants',
                        'splits',
                        'receiptUrl',
                        'createdAt',
                        'updatedAt',
                        'deletedAt',
                        'deletedBy',
                        'supersededBy',
                        'commentCount',
                    )
                    .orderBy('date', 'desc')
                    .orderBy('createdAt', 'desc')
                    .limit(limit + 1);

                if (cursor) {
                    const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
                    const cursorData = JSON.parse(decodedCursor);
                    if (cursorData.date && cursorData.createdAt) {
                        query = query.startAfter(Timestamp.fromDate(new Date(cursorData.date)), Timestamp.fromDate(new Date(cursorData.createdAt)));
                    }
                }

                const snapshot = await query.get();
                const hasMore = snapshot.docs.length > limit;
                const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

                // Validate with Document schema then convert to DTO
                const expenses = docs.map((doc) => {
                    const rawData = { id: doc.id, ...doc.data() };
                    const expenseData = ExpenseReadDocumentSchema.parse(rawData);
                    const convertedData = this.convertTimestampsToISO(expenseData);
                    return convertedData as unknown as ExpenseDTO;
                });

                let nextCursor: string | undefined;
                if (hasMore && docs.length > 0) {
                    const lastDoc = docs[docs.length - 1];
                    const lastData = lastDoc.data();
                    const cursorData = {
                        date: lastData.date?.toDate?.()?.toISOString() || lastData.date,
                        createdAt: lastData.createdAt?.toDate?.()?.toISOString() || lastData.createdAt,
                    };
                    nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
                }

                return {
                    expenses,
                    hasMore,
                    nextCursor,
                };
            } catch (error) {
                logger.error('Failed to get expenses for group paginated', error);
                throw error;
            }
        });
    }

    // ========================================================================
    // New Methods Implementation
    // ========================================================================

    async verifyGroupMembership(groupId: GroupId, userId: UserId): Promise<boolean> {
        try {
            // Check if user is a member using top-level collection lookup
            const topLevelDocId = newTopLevelMembershipDocId(userId, groupId);
            const memberDoc = await this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).doc(topLevelDocId).get();

            return memberDoc.exists;
        } catch (error) {
            logger.error('Failed to verify group membership', error);
            throw error;
        }
    }

    async getRawPolicyDocument(policyId: PolicyId): Promise<IDocumentSnapshot | null> {
        try {
            const doc = await this.db.collection(FirestoreCollections.POLICIES).doc(policyId).get();
            return doc.exists ? doc : null;
        } catch (error) {
            logger.error('Failed to get raw policy document', error, { policyId });
            throw error;
        }
    }

    /**
     * Get a group DTO in a transaction (with Timestamp → ISO conversion)
     * Use this for optimistic locking instead of getRawGroupDocumentInTransaction
     */
    async getGroupInTransaction(transaction: ITransaction, groupId: GroupId): Promise<GroupDTO | null> {
        try {
            const docRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);
            const doc = await transaction.get(docRef);

            if (!doc.exists) {
                return null;
            }

            // Validate with Document schema (expects Timestamps)
            const rawData = {
                id: doc.id,
                ...doc.data(),
            };
            const groupData = GroupReadDocumentSchema.parse(rawData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(groupData);

            const group = convertedData as unknown as GroupDTO;

            if (group.deletedAt) {
                return null;
            }

            return group;
        } catch (error) {
            logger.error('Failed to get group in transaction', error, { groupId });
            throw error;
        }
    }

    async getMembershipRefsInTransaction(
        transaction: ITransaction,
        groupId: GroupId,
    ): Promise<Array<{ id: string; ref: IDocumentReference; }>> {
        const membershipsQuery = this
            .db
            .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
            .where('groupId', '==', groupId);
        const snapshot = await transaction.get(membershipsQuery);
        return snapshot.docs.map((doc) => ({ id: doc.id, ref: doc.ref }));
    }

    /**
     * @deprecated Use getGroupInTransaction instead - returns DTO with ISO strings
     * Raw methods leak Firestore Timestamps into application layer
     */
    async getRawGroupDocumentInTransaction(transaction: ITransaction, groupId: GroupId): Promise<IDocumentSnapshot | null> {
        try {
            const docRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);
            const doc = await transaction.get(docRef);
            return doc.exists ? doc : null;
        } catch (error) {
            logger.error('Failed to get raw group document in transaction', error, { groupId });
            throw error;
        }
    }

    /**
     * Get an expense DTO in a transaction (with Timestamp → ISO conversion)
     * Use this for optimistic locking instead of getRawExpenseDocumentInTransaction
     */
    async getExpenseInTransaction(transaction: ITransaction, expenseId: ExpenseId): Promise<ExpenseDTO | null> {
        try {
            const docRef = this.db.collection(FirestoreCollections.EXPENSES).doc(expenseId);
            const doc = await transaction.get(docRef);

            if (!doc.exists) {
                return null;
            }

            // Validate with Document schema (expects Timestamps)
            const rawData = {
                id: doc.id,
                ...doc.data(),
            };
            const expenseData = ExpenseReadDocumentSchema.parse(rawData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(expenseData);

            return convertedData as unknown as ExpenseDTO;
        } catch (error) {
            logger.error('Failed to get expense in transaction', error, { expenseId });
            throw error;
        }
    }

    /**
     * Get a settlement DTO in a transaction (with Timestamp → ISO conversion)
     * Use this for optimistic locking instead of getRawSettlementDocumentInTransaction
     */
    async getSettlementInTransaction(transaction: ITransaction, settlementId: SettlementId): Promise<SettlementDTO | null> {
        try {
            const docRef = this.db.collection(FirestoreCollections.SETTLEMENTS).doc(settlementId);
            const doc = await transaction.get(docRef);

            if (!doc.exists) {
                return null;
            }

            // Validate with Document schema (expects Timestamps)
            const rawData = {
                id: doc.id,
                ...doc.data(),
            };
            const settlementData = SettlementDocumentSchema.parse(rawData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(settlementData);
            const settlement = convertedData as unknown as SettlementDTO;

            // Return null if settlement is soft-deleted
            if (settlement.deletedAt) {
                return null;
            }

            return settlement;
        } catch (error) {
            logger.error('Failed to get settlement in transaction', error, { settlementId });
            throw error;
        }
    }

    async getGroupMembershipsInTransaction(transaction: ITransaction, groupId: GroupId): Promise<IQuerySnapshot> {
        try {
            const query = this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).where('groupId', '==', groupId);
            return await transaction.get(query);
        } catch (error) {
            logger.error('Failed to get group memberships in transaction', error, { groupId });
            throw error;
        }
    }

    // ========================================================================
    // Tenant Registry Operations
    // ========================================================================

    async getTenantById(tenantId: TenantId): Promise<TenantFullRecord | null> {
        try {
            const doc = await this.db.collection(FirestoreCollections.TENANTS).doc(tenantId).get();

            if (!doc.exists) {
                return null;
            }

            return this.parseTenantDocument(doc);
        } catch (error) {
            logger.error('Failed to get tenant by ID', error, { tenantId });
            throw error;
        }
    }

    async getTenantByDomain(domain: TenantDomainName): Promise<TenantFullRecord | null> {
        try {
            const query = await this
                .db
                .collection(FirestoreCollections.TENANTS)
                .where('domains', 'array-contains', domain)
                .limit(1)
                .get();

            if (query.empty) {
                return null;
            }

            return this.parseTenantDocument(query.docs[0]);
        } catch (error) {
            logger.error('Failed to get tenant by domain', error, { domain });
            throw error;
        }
    }

    async getDefaultTenant(): Promise<TenantFullRecord | null> {
        try {
            const query = await this
                .db
                .collection(FirestoreCollections.TENANTS)
                .where('defaultTenant', '==', true)
                .limit(1)
                .get();

            if (query.empty) {
                return null;
            }

            return this.parseTenantDocument(query.docs[0]);
        } catch (error) {
            logger.error('Failed to get default tenant', error);
            throw error;
        }
    }

    async listAllTenants(): Promise<TenantFullRecord[]> {
        try {
            const query = await this.db.collection(FirestoreCollections.TENANTS).orderBy('createdAt', 'desc').get();

            if (query.empty) {
                return [];
            }

            return query.docs.map((doc) => this.parseTenantDocument(doc));
        } catch (error) {
            logger.error('Failed to list all tenants', error);
            throw error;
        }
    }

    async getMergeJob(jobId: string): Promise<MergeJobDocument | null> {
        try {
            const doc = await this.db.collection(FirestoreCollections.ACCOUNT_MERGES).doc(jobId).get();

            if (!doc.exists) {
                return null;
            }

            return doc.data() as MergeJobDocument;
        } catch (error) {
            logger.error('Failed to get merge job', error);
            throw error;
        }
    }

    // ========================================================================
    // Admin Browser Operations
    // ========================================================================

    async listUserDocuments(options: {
        limit: number;
        cursor?: string;
    }): Promise<{
        users: UserDocument[];
        hasMore: boolean;
        nextCursor?: string;
    }> {
        return measureDb('LIST_USER_DOCUMENTS', async () => {
            try {
                let query = this
                    .db
                    .collection(FirestoreCollections.USERS)
                    .orderBy('__name__')
                    .limit(options.limit + 1);

                if (options.cursor) {
                    query = query.startAfter(options.cursor);
                }

                const snapshot = await query.get();
                const docs = snapshot.docs.slice(0, options.limit);
                const hasMore = snapshot.docs.length > options.limit;
                const nextCursor = hasMore ? docs[docs.length - 1]?.id : undefined;

                // Validate and convert each document
                const users: UserDocument[] = [];
                for (const doc of docs) {
                    try {
                        const rawData = {
                            id: doc.id,
                            ...doc.data(),
                        };
                        const userData = UserDocumentSchema.parse(rawData);
                        const convertedData = this.convertTimestampsToISO(userData);
                        users.push(convertedData as unknown as UserDocument);
                    } catch (validationError) {
                        logger.warn('Skipping invalid user document during listUserDocuments', { docId: doc.id });
                    }
                }

                return { users, hasMore, nextCursor };
            } catch (error) {
                logger.error('Failed to list user documents', error);
                throw error;
            }
        });
    }

    // ========================================================================
    // Tenant Image Library Operations
    // ========================================================================

    async getTenantImages(tenantId: TenantId): Promise<TenantImageDTO[]> {
        return measureDb('GET_TENANT_IMAGES', async () => {
            const snapshot = await this
                .db
                .collection(FirestoreCollections.TENANTS)
                .doc(tenantId)
                .collection('images')
                .orderBy('uploadedAt', 'desc')
                .get();

            const images: TenantImageDTO[] = [];
            for (const doc of snapshot.docs) {
                try {
                    const rawData = { id: doc.id, ...doc.data() };
                    const validated = TenantImageDocumentSchema.parse(rawData);
                    images.push(validated);
                } catch (validationError) {
                    logger.warn('Skipping invalid tenant image document', { tenantId, docId: doc.id, validationError });
                }
            }
            return images;
        });
    }

    async getTenantImage(tenantId: TenantId, imageId: TenantImageId): Promise<TenantImageDTO | null> {
        return measureDb('GET_TENANT_IMAGE', async () => {
            const doc = await this
                .db
                .collection(FirestoreCollections.TENANTS)
                .doc(tenantId)
                .collection('images')
                .doc(imageId)
                .get();

            if (!doc.exists) {
                return null;
            }

            try {
                const rawData = { id: doc.id, ...doc.data() };
                return TenantImageDocumentSchema.parse(rawData);
            } catch (validationError) {
                logger.warn('Invalid tenant image document', { tenantId, imageId, validationError });
                return null;
            }
        });
    }
}

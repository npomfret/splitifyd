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

import type { CommentId } from '@splitifyd/shared';
// Note: ParsedGroupMemberDocument no longer exported from schemas after DTO migration
// FirestoreReader now works directly with GroupMembershipDTO from @splitifyd/shared
import {
    type ActivityFeedAction,
    ActivityFeedActions,
    type ActivityFeedEventType,
    ActivityFeedEventTypes,
    type ActivityFeedItem,
    type CommentDTO,
    type ExpenseDTO,
    ExpenseId,
    type GroupDTO,
    GroupId,
    type GroupMembershipDTO,
    GroupName,
    MAX_GROUP_MEMBERS,
    type MemberStatus,
    MemberStatuses,
    type PolicyDTO,
    PolicyId,
    type SettlementDTO,
    SettlementId,
    type UserId,
} from '@splitifyd/shared';
import { FirestoreCollections, HTTP_STATUS } from '../../constants';
import { FieldPath, Filter, type IDocumentReference, type IDocumentSnapshot, type IFirestoreDatabase, type IQuery, type IQuerySnapshot, type ITransaction, Timestamp } from '../../firestore-wrapper';
import { logger } from '../../logger';
import { measureDb } from '../../monitoring/measure';
import { assertTimestamp, safeParseISOToTimestamp } from '../../utils/dateHelpers';
import { ApiError } from '../../utils/errors';

// Import all schemas for validation (these still validate Timestamp objects from Firestore)
import { toCommentId, toExpenseId, toGroupId, toGroupName, toSettlementId } from '@splitifyd/shared';
import {
    type ActivityFeedDocument,
    ActivityFeedDocumentSchema,
    CommentDocumentSchema,
    ExpenseDocumentSchema,
    GroupBalanceDocumentSchema,
    type GroupBalanceDTO,
    GroupDocumentSchema,
    type ParsedShareLink,
    type UserDocument,
    PolicyDocumentSchema,
    SettlementDocumentSchema,
    ShareLinkDocumentSchema,
    TopLevelGroupMemberSchema,
    UserDocumentSchema,
} from '../../schemas';
import type { TopLevelGroupMemberDocument } from '../../types';
import { newTopLevelMembershipDocId } from '../../utils/idGenerator';
import type { BatchGroupFetchOptions, FirestoreOrderField, GetGroupsForUserOptions, GroupsPaginationCursor, IFirestoreReader, PaginatedResult, QueryOptions } from './IFirestoreReader';

const EVENT_ACTION_MAP: Record<ActivityFeedEventType, ActivityFeedAction> = {
    [ActivityFeedEventTypes.EXPENSE_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.EXPENSE_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.EXPENSE_DELETED]: ActivityFeedActions.DELETE,
    [ActivityFeedEventTypes.SETTLEMENT_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.SETTLEMENT_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.MEMBER_JOINED]: ActivityFeedActions.JOIN,
    [ActivityFeedEventTypes.MEMBER_LEFT]: ActivityFeedActions.LEAVE,
    [ActivityFeedEventTypes.COMMENT_ADDED]: ActivityFeedActions.COMMENT,
    [ActivityFeedEventTypes.GROUP_UPDATED]: ActivityFeedActions.UPDATE,
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
            const groupData = GroupDocumentSchema.parse(sanitizedData);

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
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'BALANCE_NOT_FOUND', `Balance not found for group ${groupId}`);
            }

            const data = doc.data();
            if (!data) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'BALANCE_READ_ERROR', 'Balance document is empty');
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

    async getExpense(expenseId: ExpenseId): Promise<ExpenseDTO | null> {
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
            const expenseData = ExpenseDocumentSchema.parse(rawData);

            // Convert Timestamps to ISO strings for DTO
            const convertedData = this.convertTimestampsToISO(expenseData);

            return convertedData as unknown as ExpenseDTO;
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
                    const groupData = GroupDocumentSchema.parse(sanitizedData);

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
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'GROUP_TOO_LARGE', `Group exceeds maximum size of ${MAX_GROUP_MEMBERS} members`);
            }

            // Extract uids directly without schema validation or timestamp conversion
            return snapshot.docs.map((doc) => doc.data().uid).filter((uid): uid is UserId => typeof uid === 'string');
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
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'GROUP_TOO_LARGE', `Group exceeds maximum size of ${MAX_GROUP_MEMBERS} members`);
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
                    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURSOR', 'Activity feed cursor is invalid or expired');
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

                    // Convert details to use branded types
                    const rawDetails = converted.details ?? {};
                    const details: typeof rawDetails & {
                        expenseId?: ExpenseId;
                        commentId?: CommentId;
                        settlementId?: SettlementId;
                        previousGroupName?: GroupName;
                    } = {
                        ...rawDetails,
                        ...(rawDetails.expenseId && { expenseId: toExpenseId(rawDetails.expenseId) }),
                        ...(rawDetails.commentId && { commentId: toCommentId(rawDetails.commentId) }),
                        ...(rawDetails.settlementId && { settlementId: toSettlementId(rawDetails.settlementId) }),
                        ...(rawDetails.previousGroupName && { previousGroupName: toGroupName(rawDetails.previousGroupName) }),
                    } as any;

                    const item: ActivityFeedItem = {
                        id: converted.id,
                        userId: converted.userId,
                        groupId: converted.groupId,
                        groupName: converted.groupName,
                        eventType,
                        action,
                        actorId: converted.actorId,
                        actorName: converted.actorName,
                        timestamp: converted.timestamp,
                        details,
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

    /**
     * ✅ FIXED: Efficient paginated group retrieval with hybrid strategy
     *
     * This method implements the performance fix from the critical pagination report:
     * - Uses query-level pagination instead of fetch-all-then-paginate
     * - Applies limits at the database query level, not in memory
     * - Provides proper cursor-based pagination with hasMore detection
     * - Reduces resource usage by 90%+ for users with many groups
     */

    async getSettlement(settlementId: SettlementId): Promise<SettlementDTO | null> {
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

            // Return null if settlement is soft-deleted
            if (settlement.deletedAt) {
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

    async findShareLinkByToken(token: string): Promise<{ groupId: GroupId; shareLinkId: string; shareLink: ParsedShareLink | null; } | null> {
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
                    shareLinkId: indexData.shareLinkId,
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

            return { groupId, shareLinkId: shareLinkDoc.id, shareLink };
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

    // ========================================================================
    // New Methods for Centralizing Firestore Access
    // ========================================================================

    async getGroupDeletionData(groupId: GroupId): Promise<{
        expenses: IQuerySnapshot;
        settlements: IQuerySnapshot;
        shareLinks: IQuerySnapshot;
        groupComments: IQuerySnapshot;
        expenseComments: IQuerySnapshot[];
    }> {
        return measureDb('FirestoreReader.getGroupDeletionData', async () => {
            try {
                const [expensesSnapshot, settlementsSnapshot, shareLinksSnapshot, groupCommentsSnapshot] = await Promise.all([
                    this.db.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId).get(),
                    this.db.collection(FirestoreCollections.SETTLEMENTS).where('groupId', '==', groupId).get(),
                    this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('shareLinks').get(),
                    this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection(FirestoreCollections.COMMENTS).get(),
                ]);

                // Get comment subcollections for each expense
                const expenseComments = await Promise.all(
                    expensesSnapshot.docs.map((expense) => this.db.collection(FirestoreCollections.EXPENSES).doc(expense.id).collection(FirestoreCollections.COMMENTS).get()),
                );

                return {
                    expenses: expensesSnapshot,
                    settlements: settlementsSnapshot,
                    shareLinks: shareLinksSnapshot,
                    groupComments: groupCommentsSnapshot,
                    expenseComments,
                };
            } catch (error) {
                logger.error('Failed to get group deletion data', error);
                throw error;
            }
        });
    }

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
                        'category',
                        'date',
                        'splitType',
                        'participants',
                        'splits',
                        'receiptUrl',
                        'createdAt',
                        'updatedAt',
                        'deletedAt',
                        'deletedBy',
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
                    const expenseData = ExpenseDocumentSchema.parse(rawData);
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
            const groupData = GroupDocumentSchema.parse(rawData);

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
            const expenseData = ExpenseDocumentSchema.parse(rawData);

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
}

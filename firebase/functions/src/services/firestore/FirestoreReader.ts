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

import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../../logger';
import {
    SecurityPresets,
    CommentTargetTypes,
    MAX_GROUP_MEMBERS,
    type CommentTargetType,
    type ExpenseDTO,
    type GroupDTO,
    type SettlementDTO,
    type PolicyDTO,
    type RegisteredUser,
    type GroupMembershipDTO,
    type CommentDTO
} from '@splitifyd/shared';
import { ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import { FieldPath, Timestamp, Filter } from 'firebase-admin/firestore';
import { measureDb } from '../../monitoring/measure';
import { safeParseISOToTimestamp, assertTimestamp } from '../../utils/dateHelpers';
import { getTopLevelMembershipDocId } from '../../utils/groupMembershipHelpers';

// Import all schemas for validation (these still validate Timestamp objects from Firestore)
import {
    UserDocumentSchema,
    GroupDocumentSchema,
    ExpenseDocumentSchema,
    SettlementDocumentSchema,
    PolicyDocumentSchema,

    // Note: GroupChangeDocumentSchema removed as unused
} from '../../schemas';
import { TopLevelGroupMemberSchema } from '../../schemas';
import { UserNotificationDocumentSchema, type UserNotificationDocument } from '../../schemas/user-notifications';
import { ShareLinkDocumentSchema, type ParsedShareLink } from '../../schemas';
import { CommentDocumentSchema } from '../../schemas';

// Note: ParsedGroupMemberDocument no longer exported from schemas after DTO migration
// FirestoreReader now works directly with GroupMembershipDTO from @splitifyd/shared
import type { IFirestoreReader, FirestoreOrderField } from './IFirestoreReader';
import type { QueryOptions, PaginatedResult, GroupsPaginationCursor, OrderBy, BatchGroupFetchOptions } from './IFirestoreReader';
import { FirestoreCollections } from "../../constants";
import type { TopLevelGroupMemberDocument } from "../../types";

export class FirestoreReader implements IFirestoreReader {
    constructor(private readonly db: Firestore) {}

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
     * - presetAppliedAt (for groups)
     * - lastModified, lastTransactionChange, lastBalanceChange, etc. (for notifications)
     */
    private convertTimestampsToISO<T extends Record<string, any>>(obj: T): T {
        const result: any = { ...obj };

        for (const [key, value] of Object.entries(result)) {
            if (value instanceof Timestamp) {
                result[key] = this.timestampToISO(value);
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.convertTimestampsToISO(value);
            } else if (Array.isArray(value)) {
                result[key] = value.map(item =>
                    item && typeof item === 'object' ? this.convertTimestampsToISO(item) : item
                );
            }
        }

        return result;
    }

    /**
     * Get the Firestore collection path for comments on a target entity
     * This eliminates type-dispatching conditionals in comment methods
     */
    private getCommentCollectionPath(targetType: CommentTargetType, targetId: string): string {
        switch (targetType) {
            case CommentTargetTypes.GROUP:
                return `${FirestoreCollections.GROUPS}/${targetId}/${FirestoreCollections.COMMENTS}`;
            case CommentTargetTypes.EXPENSE:
                return `${FirestoreCollections.EXPENSES}/${targetId}/${FirestoreCollections.COMMENTS}`;
            default:
                throw new Error(`Unsupported comment target type: ${targetType}`);
        }
    }

    // ========================================================================
    // Document Read Operations
    // ========================================================================

    async getUser(userId: string): Promise<RegisteredUser | null> {
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

            return convertedData as unknown as RegisteredUser;
        } catch (error) {
            logger.error('Failed to get user', error);
            throw error;
        }
    }

    async getGroup(groupId: string): Promise<GroupDTO | null> {
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

            return convertedData as unknown as GroupDTO;
        } catch (error) {
            logger.error('Failed to get group', error);
            throw error;
        }
    }

    async getExpense(expenseId: string): Promise<ExpenseDTO | null> {
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

    async getPolicy(policyId: string): Promise<PolicyDTO | null> {
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
        const sanitized = { ...data as Record<string, unknown> };

        // Remove API-only computed fields that should never be in Firestore
        // These might be present in corrupted data from old migrations or test data
        delete sanitized.balance;
        delete sanitized.lastActivity;

        // Sanitize securityPreset field - this is acceptable business logic
        if (sanitized.securityPreset !== undefined) {
            const validPresets = Object.values(SecurityPresets) as string[];
            if (!validPresets.includes(sanitized.securityPreset as string)) {
                logger.warn('Invalid securityPreset value detected, defaulting to OPEN');
                // Default to OPEN for invalid values
                sanitized.securityPreset = SecurityPresets.OPEN;
            }
        }

        // Assert timestamp fields are proper Timestamp objects
        // DO NOT silently fix corrupted data - let it throw
        sanitized.createdAt = assertTimestamp(sanitized.createdAt, 'createdAt');
        sanitized.updatedAt = assertTimestamp(sanitized.updatedAt, 'updatedAt');

        // Optional timestamp fields
        if (sanitized.presetAppliedAt !== undefined && sanitized.presetAppliedAt !== null) {
            sanitized.presetAppliedAt = assertTimestamp(sanitized.presetAppliedAt, 'presetAppliedAt');
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
    private async getGroupsByIds(groupIds: string[], options: BatchGroupFetchOptions): Promise<GroupDTO[]> {
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

            let query = this.db
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

                    allGroups.push(convertedData as unknown as GroupDTO);

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
    async getGroupsForUserV2(userId: string, options?: { limit?: number; cursor?: string; orderBy?: OrderBy }): Promise<PaginatedResult<GroupDTO[]>> {
        return measureDb('USER_GROUPS_V2', async () => {
            const limit = options?.limit || 10;

            // Build query with database-level ordering by groupUpdatedAt
            const orderDirection = options?.orderBy?.direction || 'desc';
            let query = this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).where('uid', '==', userId).orderBy('groupUpdatedAt', orderDirection);

            // Apply cursor pagination
            if (options?.cursor) {
                try {
                    const cursorData = this.decodeCursor(options.cursor);
                    // Convert ISO string back to Timestamp for proper comparison
                    const cursorTimestamp = Timestamp.fromDate(new Date(cursorData.lastUpdatedAt));
                    query = query.startAfter(cursorTimestamp);
                } catch (error) {
                    logger.warn('Invalid cursor provided for V2 method, ignoring');
                }
            }

            query = query.limit(limit + 1); // +1 to detect hasMore

            const snapshot = await query.get();
            const hasMore = snapshot.docs.length > limit;
            const memberships = (hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs).map((doc) => doc.data() as TopLevelGroupMemberDocument);

            if (memberships.length === 0) {
                return {
                    data: [] as GroupDTO[],
                    hasMore: false,
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
                totalEstimate: hasMore ? groups.length + 10 : groups.length,
            };
        });
    }

    async getGroupMember(groupId: string, userId: string): Promise<GroupMembershipDTO | null> {
        return measureDb('GET_MEMBER', async () => {
            // Use top-level collection instead of subcollection
            const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);
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
            return this.convertTimestampsToISO(parsedMember) as GroupMembershipDTO;
        });
    }

    async getAllGroupMemberIds(groupId: string): Promise<string[]> {
        return measureDb('GET_MEMBER_IDS', async () => {
            // Delegate to getAllGroupMembers for DRY and consistent hard cap enforcement
            const members = await this.getAllGroupMembers(groupId);
            return members.map(member => member.uid);
        });
    }

    async getAllGroupMembers(groupId: string): Promise<GroupMembershipDTO[]> {
        return measureDb('GET_MEMBERS', async () => {
            // Use top-level collection instead of subcollection
            // Fetch one extra to detect overflow
            const membersQuery = this.db
                .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
                .where('groupId', '==', groupId)
                .limit(MAX_GROUP_MEMBERS + 1);

            const snapshot = await membersQuery.get();

            // Detect overflow - group exceeds maximum size - should never happen!
            if (snapshot.size > MAX_GROUP_MEMBERS) {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'GROUP_TOO_LARGE',
                    `Group exceeds maximum size of ${MAX_GROUP_MEMBERS} members`
                );
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
                    parsedMembers.push(this.convertTimestampsToISO(memberData) as GroupMembershipDTO);
                } catch (error) {
                    logger.error('Invalid group member document in getAllGroupMembers', error);
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return parsedMembers;
        });
    }

    async getExpensesForGroup(groupId: string, options: QueryOptions): Promise<ExpenseDTO[]> {
        try {
            let query = this.db.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId).where('deletedAt', '==', null);

            // Apply ordering
            if (options.orderBy) {
                query = query.orderBy(options.orderBy.field, options.orderBy.direction);
            } else {
                query = query.orderBy('createdAt', 'desc');
            }

            // Apply limit (required parameter now)
            query = query.limit(options.limit);

            // Apply offset for pagination (if provided)
            if (options.offset) {
                query = query.offset(options.offset);
            }

            // Apply cursor for pagination (if provided)
            if (options.cursor) {
                try {
                    const cursorData = JSON.parse(Buffer.from(options.cursor, 'base64').toString());
                    query = query.startAfter(cursorData.createdAt, cursorData.id);
                } catch (err) {
                    logger.warn('Invalid cursor provided, ignoring');
                }
            }

            const snapshot = await query.get();
            const expenses: ExpenseDTO[] = [];

            for (const doc of snapshot.docs) {
                try {
                    // Validate with Document schema (expects Timestamps)
                    const rawData = {
                        id: doc.id,
                        ...doc.data(),
                    };
                    const expenseData = ExpenseDocumentSchema.parse(rawData);

                    // Convert Timestamps to ISO strings for DTO
                    const convertedData = this.convertTimestampsToISO(expenseData);

                    expenses.push(convertedData as unknown as ExpenseDTO);
                } catch (error) {
                    logger.error('Invalid expense document in getExpensesForGroup', error);
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return expenses;
        } catch (error) {
            logger.error('Failed to get expenses for group', error);
            throw error;
        }
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

    async getSettlement(settlementId: string): Promise<SettlementDTO | null> {
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
    private buildBaseSettlementQuery(groupId: string): FirebaseFirestore.Query {
        return this.db
            .collection(FirestoreCollections.SETTLEMENTS)
            .where('groupId', '==', groupId)
            .where('deletedAt', '==', null);
    }

    /**
     * Executes settlement query and converts documents to DTOs
     * @private
     */
    private async executeSettlementQuery(query: FirebaseFirestore.Query): Promise<SettlementDTO[]> {
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

    async getSettlementsForGroup(groupId: string, options: QueryOptions): Promise<{
        settlements: SettlementDTO[];
        hasMore: boolean;
        nextCursor?: string;
    }> {
        try {
            let query = this.buildBaseSettlementQuery(groupId);

            // Apply ordering (default to createdAt desc if not specified)
            if (options.orderBy) {
                query = query.orderBy(options.orderBy.field, options.orderBy.direction);
            } else {
                query = query.orderBy('createdAt', 'desc');
            }

            // Apply user filter (for settlements involving specific user)
            if (options.filterUserId) {
                query = query.where(
                    Filter.or(
                        Filter.where('payerId', '==', options.filterUserId),
                        Filter.where('payeeId', '==', options.filterUserId)
                    )
                );
            }

            // Apply date range filter
            if (options.dateRange?.start) {
                query = query.where('date', '>=', safeParseISOToTimestamp(options.dateRange.start));
            }
            if (options.dateRange?.end) {
                query = query.where('date', '<=', safeParseISOToTimestamp(options.dateRange.end));
            }

            // For cursor-based pagination, fetch limit + 1 to detect hasMore
            const effectiveLimit = options.cursor ? options.limit + 1 : options.limit;
            query = query.limit(effectiveLimit);

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

            // Determine hasMore and nextCursor for cursor-based pagination
            let hasMore = false;
            let nextCursor: string | undefined;
            let settlementsToReturn = settlements;

            if (options.cursor) {
                hasMore = settlements.length > options.limit;
                settlementsToReturn = hasMore ? settlements.slice(0, options.limit) : settlements;
                nextCursor = hasMore && settlementsToReturn.length > 0
                    ? settlementsToReturn[settlementsToReturn.length - 1].id
                    : undefined;
            }

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

    async getUserNotification(userId: string): Promise<UserNotificationDocument | null> {
        try {
            const notificationDoc = await this.db.collection('user-notifications').doc(userId).get();

            if (!notificationDoc.exists) {
                return null;
            }

            const rawData = notificationDoc.data();
            if (!rawData) {
                return null;
            }

            // Ensure all group entries have required count fields before validation
            const processedData = { ...rawData };
            if (processedData.groups) {
                for (const groupId in processedData.groups) {
                    const group = processedData.groups[groupId];
                    processedData.groups[groupId] = {
                        lastTransactionChange: group.lastTransactionChange || null,
                        lastBalanceChange: group.lastBalanceChange || null,
                        lastGroupDetailsChange: group.lastGroupDetailsChange || null,
                        transactionChangeCount: group.transactionChangeCount ?? 0,
                        balanceChangeCount: group.balanceChangeCount ?? 0,
                        groupDetailsChangeCount: group.groupDetailsChangeCount ?? 0,
                    };
                }
            }

            // Ensure required top-level fields exist
            const completeData = {
                groups: {},
                recentChanges: [],
                changeVersion: 0,
                ...processedData,
            };

            const notificationData = UserNotificationDocumentSchema.parse(completeData);
            return notificationData;
        } catch (error) {
            logger.error('Failed to get user notification', error);
            throw error;
        }
    }

    // ========================================================================
    // Share Link Operations
    // ========================================================================

    async findShareLinkByToken(token: string): Promise<{ groupId: string; shareLink: ParsedShareLink } | null> {
        try {
            const snapshot = await this.db.collectionGroup('shareLinks').where('token', '==', token).where('isActive', '==', true).limit(1).get();

            if (snapshot.empty) {
                return null;
            }

            const shareLinkDoc = snapshot.docs[0];
            const groupId = shareLinkDoc.ref.parent.parent!.id;

            const rawData = shareLinkDoc.data();
            if (!rawData) {
                throw new Error('Share link document data is null');
            }

            const dataWithId = { ...rawData, id: shareLinkDoc.id };
            const shareLink = ShareLinkDocumentSchema.parse(dataWithId);

            return { groupId, shareLink };
        } catch (error) {
            logger.error('Failed to find share link by token', error);
            throw error;
        }
    }

    // ========================================================================
    // Comment Operations
    // ========================================================================

    async getCommentsForTarget(
        targetType: CommentTargetType,
        targetId: string,
        options: {
            limit?: number;
            cursor?: string;
            orderBy?: FirestoreOrderField;
            direction?: 'asc' | 'desc';
        } = {},
    ): Promise<{ comments: CommentDTO[]; hasMore: boolean; nextCursor?: string }> {
        try {
            const { limit = 50, cursor, orderBy = 'createdAt', direction = 'desc' } = options;

            // Get the appropriate subcollection reference using collection path helper
            const collectionPath = this.getCommentCollectionPath(targetType, targetId);
            const commentsCollection = this.db.collection(collectionPath);

            // Build the query
            let query = commentsCollection.orderBy(orderBy, direction).limit(limit + 1); // +1 to check if there are more

            // Apply cursor-based pagination if provided
            if (cursor) {
                const cursorDoc = await commentsCollection.doc(cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            const snapshot = await query.get();
            const docs = snapshot.docs;

            // Determine if there are more comments
            const hasMore = docs.length > limit;
            const commentsToReturn = hasMore ? docs.slice(0, limit) : docs;

            // Transform documents to CommentDTO objects
            const comments: CommentDTO[] = [];
            for (const doc of commentsToReturn) {
                try {
                    const rawData = doc.data();
                    const dataWithId = { ...rawData, id: doc.id };
                    const comment = CommentDocumentSchema.parse(dataWithId);
                    // Convert Timestamps to ISO strings for DTO
                    const convertedComment = this.convertTimestampsToISO(comment);
                    comments.push(convertedComment as unknown as CommentDTO);
                } catch (error) {
                    logger.error('Invalid comment document in getCommentsForTarget', error);
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return {
                comments,
                hasMore,
                nextCursor: hasMore && commentsToReturn.length > 0 ? commentsToReturn[commentsToReturn.length - 1].id : undefined,
            };
        } catch (error) {
            logger.error('Failed to get comments for target', error);
            throw error;
        }
    }

    async getComment(targetType: CommentTargetType, targetId: string, commentId: string): Promise<CommentDTO | null> {
        try {
            // Get the appropriate subcollection reference using collection path helper
            const collectionPath = this.getCommentCollectionPath(targetType, targetId);
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
            // Convert Timestamps to ISO strings for DTO
            const convertedComment = this.convertTimestampsToISO(comment);
            return convertedComment as unknown as CommentDTO;
        } catch (error) {
            logger.error('Failed to get comment', error);
            throw error;
        }
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


    async getExpenseHistory(
        expenseId: string,
        limit: number = 20,
    ): Promise<{
        history: any[];
        count: number;
    }> {
        return measureDb('FirestoreReader.getExpenseHistory', async () => {
            try {
                const historySnapshot = await this.db.collection(FirestoreCollections.EXPENSES).doc(expenseId).collection('history').orderBy('modifiedAt', 'desc').limit(limit).get();

                const history = historySnapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        modifiedAt: data.modifiedAt?.toDate?.()?.toISOString() || data.modifiedAt,
                        modifiedBy: data.modifiedBy,
                        changeType: data.changeType,
                        changes: data.changes,
                        previousAmount: data.amount,
                        previousDescription: data.description,
                        previousCategory: data.category,
                        previousDate: data.date?.toDate?.()?.toISOString() || data.date,
                        previousSplits: data.splits,
                    };
                });

                return {
                    history,
                    count: history.length,
                };
            } catch (error) {
                logger.error('Failed to get expense history', error);
                throw error;
            }
        });
    }



    async getGroupDeletionData(groupId: string): Promise<{
        expenses: FirebaseFirestore.QuerySnapshot;
        settlements: FirebaseFirestore.QuerySnapshot;
        shareLinks: FirebaseFirestore.QuerySnapshot;
        groupComments: FirebaseFirestore.QuerySnapshot;
        expenseComments: FirebaseFirestore.QuerySnapshot[];
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
        groupId: string,
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

    async verifyGroupMembership(groupId: string, userId: string): Promise<boolean> {
        try {
            // Check if user is a member using top-level collection lookup
            const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);
            const memberDoc = await this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).doc(topLevelDocId).get();

            return memberDoc.exists;
        } catch (error) {
            logger.error('Failed to verify group membership', error);
            throw error;
        }
    }

    async getRawPolicyDocument(policyId: string): Promise<FirebaseFirestore.DocumentSnapshot | null> {
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
    async getGroupInTransaction(transaction: FirebaseFirestore.Transaction, groupId: string): Promise<GroupDTO | null> {
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

            return convertedData as unknown as GroupDTO;
        } catch (error) {
            logger.error('Failed to get group in transaction', error, { groupId });
            throw error;
        }
    }

    /**
     * @deprecated Use getGroupInTransaction instead - returns DTO with ISO strings
     * Raw methods leak Firestore Timestamps into application layer
     */
    async getRawGroupDocumentInTransaction(transaction: FirebaseFirestore.Transaction, groupId: string): Promise<FirebaseFirestore.DocumentSnapshot | null> {
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
    async getExpenseInTransaction(transaction: FirebaseFirestore.Transaction, expenseId: string): Promise<ExpenseDTO | null> {
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
    async getSettlementInTransaction(transaction: FirebaseFirestore.Transaction, settlementId: string): Promise<SettlementDTO | null> {
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

    async getGroupMembershipsInTransaction(transaction: FirebaseFirestore.Transaction, groupId: string): Promise<FirebaseFirestore.QuerySnapshot> {
        try {
            const query = this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).where('groupId', '==', groupId);
            return await transaction.get(query);
        } catch (error) {
            logger.error('Failed to get group memberships in transaction', error, { groupId });
            throw error;
        }
    }
}

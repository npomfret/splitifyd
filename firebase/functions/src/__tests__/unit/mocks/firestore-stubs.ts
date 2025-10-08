import { vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserRecord, UpdateRequest, CreateRequest, GetUsersResult, DecodedIdToken, ListUsersResult, DeleteUsersResult } from 'firebase-admin/auth';
import type { IFirestoreReader, QueryOptions } from '../../../services/firestore';
import type { IFirestoreWriter, WriteResult, BatchWriteResult } from '../../../services/firestore/IFirestoreWriter';
import type { IAuthService } from '../../../services/auth';
import { CommentTargetType } from '@splitifyd/shared';
import type { UserNotificationDocument } from '../../../schemas/user-notifications';
import type { GroupBalanceDTO } from '../../../schemas';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import type { GroupMembershipDTO } from '@splitifyd/shared';
import type { ExpenseDTO, GroupDTO, PolicyDTO, RegisteredUser, SettlementDTO, CommentDTO } from '@splitifyd/shared/src';

// Shared storage for comments between reader and writer
const sharedCommentStorage = new Map<string, any[]>();

/**
 * In-memory stub implementation of IFirestoreReader for unit testing
 * Only implements methods actually used by services being tested
 */
export class StubFirestoreReader implements IFirestoreReader {
    private documents = new Map<string, any>();
    private rawDocuments = new Map<string, any>();
    private userGroups = new Map<string, any>(); // userId -> pagination result or groups[]
    private paginationBehavior = new Map<string, { groups: any[]; pageSize: number }>(); // userId -> pagination config
    private methodErrors = new Map<string, Error>(); // methodName -> error to throw
    private notFoundDocuments = new Set<string>(); // Track which docs should return null

    // Helper methods to set up test data
    setDocument(collection: string, id: string, data: any) {
        this.documents.set(`${collection}/${id}`, data);
    }

    // Get the documents Map for sharing with writer
    getDocuments(): Map<string, any> {
        return this.documents;
    }

    // Helper methods for pagination testing (similar to MockFirestoreReader)
    mockGroupsForUser(userId: string, groups: any[], hasMore: boolean = false, nextCursor?: string) {
        this.userGroups.set(userId, {
            data: groups,
            hasMore,
            nextCursor,
            totalEstimate: groups.length + (hasMore ? 10 : 0),
        });
    }

    mockPaginatedGroups(userId: string, allGroups: any[], pageSize: number = 10) {
        this.paginationBehavior.set(userId, { groups: allGroups, pageSize });
    }

    // Mock helpers for compatibility
    clearAllMocks() {
        this.resetAllMocks();
    }

    mockUserExists(userId: string, existsOrUserDoc: boolean | any = true) {
        if (typeof existsOrUserDoc === 'boolean') {
            if (existsOrUserDoc) {
                this.setDocument('users', userId, createTestUser(userId));
            } else {
                this.documents.delete(`users/${userId}`);
            }
        } else {
            // Second parameter is a user document
            this.setDocument('users', userId, existsOrUserDoc);
        }
    }

    mockGroupExists(groupId: string, exists: boolean = true) {
        if (exists) {
            this.setDocument('groups', groupId, createTestGroup(groupId));
        } else {
            this.documents.delete(`groups/${groupId}`);
        }
    }

    setGroupMembers(groupId: string, members: GroupMembershipDTO[]) {
        members.forEach((member) => {
            this.setDocument('group-members', `${groupId}_${member.uid}`, member);
        });
    }

    setShareLink(groupId: string, linkId: string, shareLink: any) {
        // Store with format that findShareLinkByToken expects
        this.documents.set(`groups/${groupId}/shareLinks/${linkId}`, shareLink);
    }

    async getAllPolicies(): Promise<PolicyDTO[]> {
        const error = this.methodErrors.get('getAllPolicies');
        if (error) throw error;

        return this.filterCollection<PolicyDTO>('policies');
    }

    // Reset helper for test cleanup
    resetAllMocks() {
        this.userGroups.clear();
        this.paginationBehavior.clear();
        this.documents.clear();
        this.rawDocuments.clear();
        this.methodErrors.clear();
        this.notFoundDocuments.clear();
        sharedCommentStorage.clear();
    }

    // Helper method for filtering collections with ordering and limiting
    private filterCollection<T>(collectionPrefix: string, filter?: (doc: T) => boolean, orderBy?: { field: string; direction: 'asc' | 'desc' }, limit?: number): T[] {
        let results: T[] = [];

        // Get all documents from collection
        for (const [key, value] of this.documents.entries()) {
            if (key.startsWith(`${collectionPrefix}/`)) {
                if (!filter || filter(value)) {
                    results.push(value);
                }
            }
        }

        // Apply ordering
        if (orderBy) {
            results.sort((a: any, b: any) => {
                const aVal = a[orderBy.field];
                const bVal = b[orderBy.field];
                const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return orderBy.direction === 'asc' ? comparison : -comparison;
            });
        }

        // Apply limit
        if (limit && limit > 0) {
            results = results.slice(0, limit);
        }

        return results;
    }

    /**
     * Convert ISO strings to Firestore Timestamps in test data
     * Ensures test data matches what would be stored in real Firestore
     */
    private convertISOToTimestamps<T>(obj: T): T {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        const result: any = Array.isArray(obj) ? [...obj] : { ...obj };

        // Known date field names across all document types
        const dateFields = new Set([
            'createdAt',
            'updatedAt',
            'deletedAt',
            'date',
            'joinedAt',
            'presetAppliedAt',
            'lastModified',
            'lastTransactionChange',
            'lastBalanceChange',
            'lastGroupDetailsChange',
            'lastCommentChange',
            'timestamp',
            'expiresAt',
            'deletionStartedAt',
            'groupUpdatedAt',
            'assignedAt',
        ]);

        for (const key in result) {
            const value = result[key];

            if (value === null || value === undefined) {
                continue;
            }

            // Convert date fields from ISO string to Timestamp
            if (dateFields.has(key) && typeof value === 'string') {
                try {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        result[key] = Timestamp.fromDate(date);
                    }
                } catch {
                    // Keep original value if conversion fails
                }
            }
            // Recursively convert nested objects
            else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
                result[key] = this.convertISOToTimestamps(value);
            }
            // Recursively convert arrays
            else if (Array.isArray(value)) {
                result[key] = value.map((item) => (typeof item === 'object' && item !== null ? this.convertISOToTimestamps(item) : item));
            }
        }

        return result;
    }

    private timestampToISO(value: any): string {
        if (!value) return value; // null/undefined pass through
        if (value instanceof Timestamp) {
            return value.toDate().toISOString();
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'string') {
            // Already ISO string
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
        return value;
    }

    private convertTimestampsToISO<T extends Record<string, any>>(obj: T): T {
        const result: any = { ...obj };

        for (const [key, value] of Object.entries(result)) {
            if (value instanceof Timestamp) {
                result[key] = this.timestampToISO(value);
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.convertTimestampsToISO(value);
            } else if (Array.isArray(value)) {
                result[key] = value.map((item) => (item && typeof item === 'object' ? this.convertTimestampsToISO(item) : item));
            }
        }

        return result;
    }

    setRawDocument(id: string, data: any) {
        if (data === null) {
            this.rawDocuments.delete(id);
        } else {
            // Convert ISO strings to Timestamps before storing (mirrors Firestore behavior)
            const convertedData = this.convertISOToTimestamps(data);
            this.rawDocuments.set(id, {
                id,
                exists: !!data,
                data: () => convertedData,
                get: (field: string) => convertedData?.[field],
                ref: { id, path: `policies/${id}` },
                readTime: Timestamp.now(),
                isEqual: (other: any) => other?.id === id,
            });
        }
    }

    // Document Read Operations
    async getUser(userId: string): Promise<RegisteredUser | null> {
        const error = this.methodErrors.get('getUser');
        if (error) throw error;

        const key = `users/${userId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async getGroup(groupId: string): Promise<GroupDTO | null> {
        const error = this.methodErrors.get('getGroup');
        if (error) throw error;

        const key = `groups/${groupId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async getGroupBalance(groupId: string): Promise<GroupBalanceDTO> {
        const error = this.methodErrors.get('getGroupBalance');
        if (error) throw error;

        const key = `groups/${groupId}/metadata/balance`;
        const balance = this.documents.get(key);

        if (!balance) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'BALANCE_NOT_FOUND', `Balance not found for group ${groupId}`);
        }

        // Convert Timestamps to ISO strings before returning (mirrors production FirestoreReader)
        return this.convertTimestampsToISO(balance);
    }

    async getExpense(expenseId: string): Promise<ExpenseDTO | null> {
        const error = this.methodErrors.get('getExpense');
        if (error) throw error;

        const key = `expenses/${expenseId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async getSettlement(settlementId: string): Promise<SettlementDTO | null> {
        const error = this.methodErrors.get('getSettlement');
        if (error) throw error;

        const key = `settlements/${settlementId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async getPolicy(policyId: string): Promise<PolicyDTO | null> {
        const error = this.methodErrors.get('getPolicy');
        if (error) throw error;

        const key = `policies/${policyId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    // Raw document operations (used by PolicyService)
    async getRawPolicyDocument(policyId: string): Promise<FirebaseFirestore.DocumentSnapshot | null> {
        return this.rawDocuments.get(policyId) || null;
    }

    // Mock-enabled getGroupsForUserV2
    async getGroupsForUserV2(userId: string, options?: any): Promise<any> {
        const error = this.methodErrors.get('getGroupsForUserV2');
        if (error) throw error;

        // Check for simple mock setup first
        const userGroupsData = this.userGroups.get(userId);
        if (userGroupsData) {
            return userGroupsData;
        }

        // Check for pagination behavior setup
        const paginationConfig = this.paginationBehavior.get(userId);
        if (paginationConfig) {
            const { groups: allGroups, pageSize } = paginationConfig;
            const limit = options?.limit || pageSize;
            const cursor = options?.cursor;

            let startIndex = 0;
            if (cursor) {
                try {
                    const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
                    const cursorIndex = allGroups.findIndex((group) => group.id === cursorData.lastGroupId);
                    if (cursorIndex >= 0) {
                        startIndex = cursorIndex + 1;
                    }
                } catch (error) {
                    // Invalid cursor, start from beginning
                }
            }

            const endIndex = startIndex + limit;
            const pageData = allGroups.slice(startIndex, endIndex);
            const hasMore = endIndex < allGroups.length;

            let nextCursor: string | undefined;
            if (hasMore && pageData.length > 0) {
                const lastGroup = pageData[pageData.length - 1];
                const cursorData = {
                    lastGroupId: lastGroup.id,
                    lastUpdatedAt: lastGroup.updatedAt,
                };
                nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
            }

            return {
                data: pageData,
                hasMore,
                nextCursor,
                totalEstimate: allGroups.length,
            };
        }

        return { data: [], hasMore: false };
    }

    async getGroupMember(groupId: string, userId: string): Promise<GroupMembershipDTO | null> {
        const error = this.methodErrors.get('getGroupMember');
        if (error) throw error;

        const docId = `group-members/${groupId}_${userId}`;
        if (this.notFoundDocuments.has(docId)) return null;

        return this.documents.get(docId) || null;
    }

    // Mock-enabled getAllGroupMembers
    async getAllGroupMembers(groupId: string): Promise<GroupMembershipDTO[]> {
        const error = this.methodErrors.get('getAllGroupMembers');
        if (error) throw error;

        const members = this.filterCollection<GroupMembershipDTO>('group-members', (doc) => doc.groupId === groupId);

        // Enforce hard cap - mirror real FirestoreReader behavior
        const MAX_GROUP_MEMBERS = 50; // Import not available in stub, hardcode
        if (members.length > MAX_GROUP_MEMBERS) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'GROUP_TOO_LARGE', `Group exceeds maximum size of ${MAX_GROUP_MEMBERS} members`);
        }

        return members;
    }

    async getAllGroupMemberIds(groupId: string): Promise<string[]> {
        const error = this.methodErrors.get('getAllGroupMemberIds');
        if (error) throw error;

        const members = this.filterCollection<GroupMembershipDTO>('group-members', (doc) => doc.groupId === groupId);
        return members.map((m) => m.uid);
    }

    async getExpensesForGroup(groupId: string, options: QueryOptions): Promise<ExpenseDTO[]> {
        const error = this.methodErrors.get('getExpensesForGroup');
        if (error) throw error;

        return this.filterCollection<ExpenseDTO>('expenses', (doc) => doc.groupId === groupId && (doc.deletedAt == null || !!options.includeDeleted), options.orderBy, options.limit);
    }

    async getExpenseHistory(): Promise<any> {
        return { history: [], count: 0 };
    }

    async getExpensesForGroupPaginated(
        groupId: string,
        options?: { limit?: number; cursor?: string; includeDeleted?: boolean },
    ): Promise<{ expenses: ExpenseDTO[]; hasMore: boolean; nextCursor?: string }> {
        const error = this.methodErrors.get('getExpensesForGroupPaginated');
        if (error) throw error;

        const limit = options?.limit || 20;

        let expenses = this.filterCollection<ExpenseDTO>(
            'expenses',
            (doc) => doc.groupId === groupId && (doc.deletedAt == null || !!options?.includeDeleted),
            { field: 'createdAt', direction: 'desc' }, // Default ordering by creation date
        );

        // Handle cursor-based pagination
        if (options?.cursor) {
            const cursorIndex = expenses.findIndex((e) => e.id === options.cursor);
            if (cursorIndex >= 0) {
                expenses = expenses.slice(cursorIndex + 1);
            }
        }

        const hasMore = expenses.length > limit;
        const results = expenses.slice(0, limit);
        const nextCursor = hasMore && results.length > 0 ? results[results.length - 1]?.id : undefined;

        return { expenses: results, hasMore, nextCursor };
    }

    async getSettlementsForGroup(
        groupId: string,
        options: QueryOptions,
    ): Promise<{
        settlements: SettlementDTO[];
        hasMore: boolean;
        nextCursor?: string;
    }> {
        const error = this.methodErrors.get('getSettlementsForGroup');
        if (error) throw error;

        const settlements = this.filterCollection<SettlementDTO>('settlements', (doc) => doc.groupId === groupId, options.orderBy, options.limit);

        return {
            settlements,
            hasMore: false,
            nextCursor: undefined,
        };
    }

    async getUserNotification(userId: string): Promise<UserNotificationDocument | null> {
        const error = this.methodErrors.get('getUserNotification');
        if (error) throw error;

        const key = `user-notifications/${userId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async findShareLinkByToken(token: string): Promise<any | null> {
        // Find share link by token across all groups
        for (const [key, value] of this.documents.entries()) {
            if (key.includes('/shareLinks/') && value.token === token) {
                // Extract groupId from the key (e.g., "groups/group-123/shareLinks/link-abc")
                const groupId = key.split('/')[1];
                return { groupId, shareLink: value };
            }
        }
        return null;
    }

    // Helper method for tests to set up comments for a target
    setCommentsForTarget(targetType: CommentTargetType, targetId: string, comments: any[]) {
        sharedCommentStorage.set(`${targetType}:${targetId}`, comments);
    }

    async getCommentsForTarget(targetType: CommentTargetType, targetId: string, options?: any): Promise<{ comments: CommentDTO[]; hasMore: boolean; nextCursor?: string }> {
        const comments = sharedCommentStorage.get(`${targetType}:${targetId}`) || [];
        return { comments, hasMore: false, nextCursor: undefined };
    }

    async getComment(targetType: CommentTargetType, targetId: string, commentId: string): Promise<CommentDTO | null> {
        const comments = sharedCommentStorage.get(`${targetType}:${targetId}`) || [];
        return comments.find((c) => c.id === commentId) || null;
    }

    async getGroupDeletionData(): Promise<any> {
        return {
            expenses: { size: 0, docs: [] },
            settlements: { size: 0, docs: [] },
            shareLinks: { size: 0, docs: [] },
            groupComments: { size: 0, docs: [] },
            expenseComments: [],
        };
    }

    // Missing methods from interface
    async verifyGroupMembership(): Promise<boolean> {
        return false;
    }

    async getGroupMembershipsInTransaction(): Promise<any> {
        return { docs: [], size: 0, empty: true };
    }

    async getRawGroupDocumentInTransaction(transaction: any, groupId: string): Promise<any | null> {
        const groupData = this.documents.get(`groups/${groupId}`);
        if (!groupData) {
            return null;
        }
        return {
            id: groupId,
            exists: true,
            data: () => groupData,
            get: (field: string) => groupData?.[field],
            ref: { id: groupId, path: `groups/${groupId}` },
        };
    }

    async getGroupInTransaction(transaction: FirebaseFirestore.Transaction, groupId: string): Promise<GroupDTO | null> {
        // In stub, transaction reads work the same as non-transaction reads
        const key = `groups/${groupId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }
        return this.documents.get(key) || null;
    }

    async getExpenseInTransaction(transaction: FirebaseFirestore.Transaction, expenseId: string): Promise<ExpenseDTO | null> {
        // In stub, transaction reads work the same as non-transaction reads
        const key = `expenses/${expenseId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }
        return this.documents.get(key) || null;
    }

    async getSettlementInTransaction(transaction: FirebaseFirestore.Transaction, settlementId: string): Promise<SettlementDTO | null> {
        // In stub, transaction reads work the same as non-transaction reads
        const key = `settlements/${settlementId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }
        return this.documents.get(key) || null;
    }
}

/**
 * In-memory stub implementation of IFirestoreWriter for unit testing
 * Only implements methods actually used by services being tested
 */
export class StubFirestoreWriter implements IFirestoreWriter {
    private documents = new Map<string, any>();
    private writeResults: WriteResult[] = [];

    constructor(
        private sharedDocuments?: Map<string, any>,
        private stubReader?: StubFirestoreReader,
    ) {
        // If shared documents are provided, use those instead of our own
        if (sharedDocuments) {
            this.documents = sharedDocuments;
        }
    }

    /**
     * Convert ISO strings to Firestore Timestamps
     * Mirrors the real FirestoreWriter's conversion logic
     */
    private convertISOToTimestamps<T>(obj: T): T {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        const result: any = Array.isArray(obj) ? [...obj] : { ...obj };

        // Known date field names across all document types
        const dateFields = new Set([
            'createdAt',
            'updatedAt',
            'deletedAt',
            'date',
            'joinedAt',
            'presetAppliedAt',
            'lastModified',
            'lastTransactionChange',
            'lastBalanceChange',
            'lastGroupDetailsChange',
            'lastCommentChange',
            'timestamp',
            'expiresAt',
            'deletionStartedAt',
            'groupUpdatedAt',
            'assignedAt', // For theme.assignedAt
        ]);

        if (Array.isArray(result)) {
            // Process arrays
            return result.map((item) => (item && typeof item === 'object' && !(item instanceof Timestamp) ? this.convertISOToTimestamps(item) : item)) as T;
        }

        // Process object properties
        for (const [key, value] of Object.entries(result)) {
            if (dateFields.has(key) && value !== null && value !== undefined) {
                // Convert known date fields from ISO string to Timestamp
                if (typeof value === 'string') {
                    result[key] = Timestamp.fromDate(new Date(value));
                }
            } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
                // Recursively process nested objects (e.g., theme object)
                result[key] = this.convertISOToTimestamps(value);
            } else if (Array.isArray(value)) {
                // Recursively process arrays of objects
                result[key] = value.map((item) => (item && typeof item === 'object' && !(item instanceof Timestamp) ? this.convertISOToTimestamps(item) : item));
            }
        }

        return result;
    }

    private timestampToISO(value: any): string {
        if (!value) return value; // null/undefined pass through
        if (value instanceof Timestamp) {
            return value.toDate().toISOString();
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'string') {
            // Already ISO string
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
        return value;
    }

    private convertTimestampsToISO<T extends Record<string, any>>(obj: T): T {
        const result: any = { ...obj };

        for (const [key, value] of Object.entries(result)) {
            if (value instanceof Timestamp) {
                result[key] = this.timestampToISO(value);
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.convertTimestampsToISO(value);
            } else if (Array.isArray(value)) {
                result[key] = value.map((item) => (item && typeof item === 'object' ? this.convertTimestampsToISO(item) : item));
            }
        }

        return result;
    }

    // Helper methods to configure behavior
    setWriteResult(id: string, success: boolean, error?: string) {
        this.writeResults.push({
            id,
            success,
            timestamp: success ? Timestamp.now() : undefined,
            error,
        });
    }

    getLastWriteResult(): WriteResult | undefined {
        return this.writeResults[this.writeResults.length - 1];
    }

    // Helper method to set documents for testing
    setDocument(collection: string, id: string, data: any) {
        this.documents.set(`${collection}/${id}`, data);
    }

    // Policy operations (used by PolicyService)
    async createPolicy(policyId: string, policyData: any): Promise<WriteResult> {
        const result = this.getLastWriteResult() || {
            id: policyId,
            success: true,
            timestamp: Timestamp.now(),
        };

        if (!result.success) {
            throw new Error(result.error || 'Write operation failed');
        }

        // Convert ISO strings to Timestamps before storing (mirrors production FirestoreWriter)
        const convertedData = this.convertISOToTimestamps(policyData);
        this.documents.set(`policies/${policyId}`, convertedData);
        // Also update rawDocuments so getRawPolicyDocument works (if stubReader is available)
        if (this.stubReader) {
            this.stubReader.setRawDocument(policyId, convertedData);
        }
        return result;
    }

    async updatePolicy(policyId: string, updates: any): Promise<WriteResult> {
        const existing = this.documents.get(`policies/${policyId}`);
        if (existing) {
            // Convert ISO strings to Timestamps before merging (mirrors production FirestoreWriter)
            const convertedUpdates = this.convertISOToTimestamps(updates);
            const merged = { ...existing, ...convertedUpdates };
            this.documents.set(`policies/${policyId}`, merged);
            // Also update rawDocuments so getRawPolicyDocument works (if stubReader is available)
            if (this.stubReader) {
                this.stubReader.setRawDocument(policyId, merged);
            }
        }
        const result = this.getLastWriteResult() || {
            id: policyId,
            success: true,
            timestamp: Timestamp.now(),
        };
        return result;
    }

    // Minimal implementations for other required methods
    async createUser(): Promise<WriteResult> {
        return { id: 'user', success: true, timestamp: Timestamp.now() };
    }

    async updateUser(userId: string, updates: any): Promise<WriteResult> {
        // Convert ISO strings to Timestamps before storing, just like the real FirestoreWriter
        const convertedUpdates = this.convertISOToTimestamps(updates);

        // Update the document in memory
        const existing = this.documents.get(`users/${userId}`);
        if (existing) {
            this.documents.set(`users/${userId}`, { ...existing, ...convertedUpdates });
        }
        return { id: userId, success: true, timestamp: Timestamp.now() };
    }

    async deleteUser(): Promise<WriteResult> {
        return { id: 'user', success: true, timestamp: Timestamp.now() };
    }

    async createGroup(): Promise<WriteResult> {
        return { id: 'group', success: true, timestamp: Timestamp.now() };
    }

    async updateGroup(): Promise<WriteResult> {
        return { id: 'group', success: true, timestamp: Timestamp.now() };
    }

    async deleteGroup(): Promise<WriteResult> {
        return { id: 'group', success: true, timestamp: Timestamp.now() };
    }

    async createExpense(): Promise<WriteResult> {
        return { id: 'expense', success: true, timestamp: Timestamp.now() };
    }

    async updateExpense(): Promise<WriteResult> {
        return { id: 'expense', success: true, timestamp: Timestamp.now() };
    }

    async deleteExpense(): Promise<WriteResult> {
        return { id: 'expense', success: true, timestamp: Timestamp.now() };
    }

    async createSettlement(): Promise<WriteResult> {
        return { id: 'settlement', success: true, timestamp: Timestamp.now() };
    }

    async updateSettlement(): Promise<WriteResult> {
        return { id: 'settlement', success: true, timestamp: Timestamp.now() };
    }

    async deleteSettlement(): Promise<WriteResult> {
        return { id: 'settlement', success: true, timestamp: Timestamp.now() };
    }

    async addComment(targetType: CommentTargetType, targetId: string, commentData: any): Promise<WriteResult> {
        const id = `comment-${Date.now()}`;
        const result = this.getLastWriteResult() || { id, success: true, timestamp: Timestamp.now() };

        if (!result.success) {
            throw new Error(result.error || 'Write failed');
        }

        // Add the comment to the shared comment storage for retrieval
        const targetKey = `${targetType}:${targetId}`;
        const existingComments = sharedCommentStorage.get(targetKey) || [];
        const newComment = {
            id: result.id,
            ...commentData,
        };
        sharedCommentStorage.set(targetKey, [...existingComments, newComment]);

        return result;
    }

    createShareLinkInTransaction(): any {
        return { id: 'link', path: 'shareLinks/link' };
    }

    async createUserNotification(userId: string, notificationData: any): Promise<WriteResult> {
        this.documents.set(`user-notifications/${userId}`, notificationData);
        return { id: userId, success: true, timestamp: Timestamp.now() };
    }

    async removeUserNotificationGroup(userId: string, groupId: string): Promise<WriteResult> {
        return { id: userId, success: true, timestamp: Timestamp.now() };
    }

    public setUserNotificationsCalls: { userId: string; updates: any; merge?: boolean }[] = [];

    async setUserNotifications(userId: string, updates: any, merge?: boolean): Promise<WriteResult> {
        this.setUserNotificationsCalls.push({ userId, updates, merge });
        return { id: userId, success: true, timestamp: Timestamp.now() };
    }

    public batchSetUserNotificationsCalls: Array<{ updates: Array<{ userId: string; data: any; merge?: boolean }> }> = [];

    async batchSetUserNotifications(updates: Array<{ userId: string; data: any; merge?: boolean }>): Promise<BatchWriteResult> {
        this.batchSetUserNotificationsCalls.push({ updates });

        // Simulate individual setUserNotifications calls for backward compatibility
        for (const update of updates) {
            this.setUserNotificationsCalls.push({ userId: update.userId, updates: update.data, merge: update.merge });
        }

        return {
            successCount: updates.length,
            failureCount: 0,
            results: updates.map((u) => ({ id: u.userId, success: true, timestamp: Timestamp.now() })),
        };
    }

    async runTransaction(transactionFn: (transaction: any) => Promise<any>): Promise<any> {
        const mockTransaction = {
            get: vi.fn().mockImplementation((docRef: any) => {
                // Extract collection and document ID from docRef path
                let path = docRef.path || docRef.id || '';

                // Try alternative path formats if not found
                if (!this.documents.has(path) && docRef._path && docRef._path.segments) {
                    path = docRef._path.segments.join('/');
                }
                if (!this.documents.has(path) && docRef.parent && docRef.id) {
                    path = `${docRef.parent.id}/${docRef.id}`;
                }
                if (!this.documents.has(path) && docRef.collection && docRef.id) {
                    path = `${docRef.collection.id}/${docRef.id}`;
                }

                const documentData = this.documents.get(path);

                return Promise.resolve({
                    exists: !!documentData,
                    data: () => documentData || {},
                    ref: docRef,
                });
            }),
            update: vi.fn().mockImplementation((docRef: any, data: any) => {
                // Update the document in our mock storage
                const path = docRef.path || docRef.id || '';
                const existingData = this.documents.get(path) || {};
                this.documents.set(path, { ...existingData, ...data });
            }),
            set: vi.fn().mockImplementation((docRef: any, data: any) => {
                // Set the document in our mock storage
                const path = docRef.path || docRef.id || '';
                this.documents.set(path, data);
            }),
            delete: vi.fn().mockImplementation((docRef: any) => {
                // Delete the document from our mock storage
                const path = docRef.path || docRef.id || '';
                this.documents.delete(path);
            }),
        };
        return await transactionFn(mockTransaction);
    }

    createInTransaction(transaction: any, collection: string, documentId: string | null, data: any): any {
        const id = documentId || this.generateDocumentId();
        return { id, path: `${collection}/${id}` };
    }

    updateInTransaction = vi.fn().mockImplementation((transaction: any, documentPath: string, updates: any): void => {
        // Update the document in the writer's storage so subsequent reads see the changes
        const existingDoc = this.documents.get(documentPath) || {};
        const updatedDoc = { ...existingDoc, ...updates };
        this.documents.set(documentPath, updatedDoc);
    });

    async deleteInTransaction(): Promise<WriteResult> {
        return { id: 'doc', success: true, timestamp: Timestamp.now() };
    }

    generateDocumentId(): string {
        return 'generated-id';
    }

    async performHealthCheck(): Promise<{ success: boolean; responseTime: number }> {
        return { success: true, responseTime: 50 };
    }

    async bulkDeleteInTransaction(): Promise<any> {
        return { successCount: 0, failureCount: 0, results: [] };
    }

    getDocumentReferenceInTransaction(transaction: any, collection: string, documentId: string): any {
        return {
            id: documentId,
            path: `${collection}/${documentId}`,
            collection: { id: collection },
        };
    }

    async leaveGroupAtomic(): Promise<any> {
        return { successCount: 1, failureCount: 0, results: [] };
    }

    // Test Pool Operations
    async createTestPoolUser(email: string, userData: any): Promise<WriteResult> {
        this.documents.set(`test-user-pool/${email}`, userData);
        return {
            id: email,
            success: true,
            timestamp: Timestamp.now(),
        };
    }

    async updateTestPoolUser(email: string, updates: any): Promise<WriteResult> {
        const existing = this.documents.get(`test-user-pool/${email}`) || {};
        this.documents.set(`test-user-pool/${email}`, { ...existing, ...updates });
        return {
            id: email,
            success: true,
            timestamp: Timestamp.now(),
        };
    }

    async touchGroup(groupId: string, transactionOrBatch?: any): Promise<void> {
        const groupPath = `groups/${groupId}`;
        const existingGroup = this.documents.get(groupPath) || {};
        const updatedGroup = { ...existingGroup, updatedAt: Timestamp.now() };
        this.documents.set(groupPath, updatedGroup);
    }

    async setGroupBalance(groupId: string, balance: GroupBalanceDTO): Promise<void> {
        const balancePath = `groups/${groupId}/metadata/balance`;
        const convertedData = this.convertISOToTimestamps(balance);
        const docData = {
            ...convertedData,
            lastUpdatedAt: Timestamp.now(),
        };
        this.documents.set(balancePath, docData);
    }

    setGroupBalanceInTransaction(transaction: any, groupId: string, balance: GroupBalanceDTO): void {
        const balancePath = `groups/${groupId}/metadata/balance`;
        const convertedData = this.convertISOToTimestamps(balance);
        const docData = {
            ...convertedData,
            lastUpdatedAt: Timestamp.now(),
        };
        this.documents.set(balancePath, docData);
    }

    async getGroupBalanceInTransaction(transaction: any, groupId: string): Promise<GroupBalanceDTO> {
        const balancePath = `groups/${groupId}/metadata/balance`;
        const doc = this.documents.get(balancePath);

        if (!doc) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'BALANCE_NOT_FOUND', `Balance not found for group ${groupId}`);
        }

        // Convert Timestamps to ISO strings (mirrors production FirestoreWriter)
        return this.convertTimestampsToISO(doc) as GroupBalanceDTO;
    }

    updateGroupBalanceInTransaction(transaction: any, groupId: string, currentBalance: GroupBalanceDTO, updater: (current: GroupBalanceDTO) => GroupBalanceDTO): void {
        // Apply updater function to the provided current balance
        const newBalance = updater(currentBalance);

        // Convert and store
        const balancePath = `groups/${groupId}/metadata/balance`;
        const convertedData = this.convertISOToTimestamps(newBalance);
        const docData = {
            ...convertedData,
            lastUpdatedAt: Timestamp.now(),
        };

        this.documents.set(balancePath, docData);
    }
}

/**
 * In-memory stub implementation of IAuthService for unit testing
 * Provides predictable behavior for testing user authentication operations
 */
export class StubAuthService implements IAuthService {
    private users = new Map<string, UserRecord>();
    private usersByEmail = new Map<string, UserRecord>();
    private usersByPhone = new Map<string, UserRecord>();
    private customTokens = new Map<string, string>();
    private decodedTokens = new Map<string, DecodedIdToken>();
    private customClaims = new Map<string, object>();
    private deletedUsers = new Set<string>();

    // Helper methods to set up test data
    setUser(uid: string, user: Partial<UserRecord> & { uid: string }) {
        const fullUser: UserRecord = {
            uid,
            email: user.email,
            emailVerified: user.emailVerified ?? false,
            displayName: user.displayName,
            photoURL: user.photoURL,
            phoneNumber: user.phoneNumber,
            disabled: user.disabled ?? false,
            metadata: user.metadata ?? {
                creationTime: new Date().toISOString(),
                lastSignInTime: new Date().toISOString(),
                lastRefreshTime: new Date().toISOString(),
                toJSON: () => ({}),
            },
            customClaims: user.customClaims ?? {},
            providerData: user.providerData ?? [],
            tenantId: user.tenantId,
            tokensValidAfterTime: user.tokensValidAfterTime,
            toJSON: () => ({}),
        };

        this.users.set(uid, fullUser);
        if (fullUser.email) {
            this.usersByEmail.set(fullUser.email, fullUser);
        }
        if (fullUser.phoneNumber) {
            this.usersByPhone.set(fullUser.phoneNumber, fullUser);
        }
    }

    setDecodedToken(token: string, decoded: DecodedIdToken) {
        this.decodedTokens.set(token, decoded);
    }

    markUserAsDeleted(uid: string) {
        this.deletedUsers.add(uid);
        this.users.delete(uid);
    }

    // Clear all test data
    clear() {
        this.users.clear();
        this.usersByEmail.clear();
        this.usersByPhone.clear();
        this.customTokens.clear();
        this.decodedTokens.clear();
        this.customClaims.clear();
        this.deletedUsers.clear();
    }

    // IAuthService implementation
    async createUser(userData: CreateRequest): Promise<UserRecord> {
        const uid = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check for duplicate email
        if (userData.email && this.usersByEmail.has(userData.email)) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
        }

        const user: UserRecord = {
            uid,
            email: userData.email ?? undefined,
            emailVerified: userData.emailVerified ?? false,
            displayName: userData.displayName ?? undefined,
            photoURL: userData.photoURL ?? undefined,
            phoneNumber: userData.phoneNumber ?? undefined,
            disabled: userData.disabled ?? false,
            metadata: {
                creationTime: new Date().toISOString(),
                lastSignInTime: new Date().toISOString(),
                lastRefreshTime: new Date().toISOString(),
                toJSON: () => ({}),
            },
            customClaims: {},
            providerData: [],
            tenantId: undefined,
            tokensValidAfterTime: new Date().toISOString(),
            toJSON: () => ({}),
        };

        this.setUser(uid, user);
        return user;
    }

    async getUser(uid: string): Promise<UserRecord | null> {
        if (this.deletedUsers.has(uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${uid} not found`);
        }
        return this.users.get(uid) || null;
    }

    async getUsers(uids: { uid: string }[]): Promise<GetUsersResult> {
        const users: UserRecord[] = [];
        const notFound: { uid: string }[] = [];

        for (const { uid } of uids) {
            const user = this.users.get(uid);
            if (user && !this.deletedUsers.has(uid)) {
                users.push(user);
            } else {
                notFound.push({ uid });
            }
        }

        return { users, notFound };
    }

    async updateUser(uid: string, updates: UpdateRequest): Promise<UserRecord> {
        const existingUser = this.users.get(uid);
        if (!existingUser || this.deletedUsers.has(uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${uid} not found`);
        }

        // Check for email conflicts if updating email
        if (updates.email && updates.email !== existingUser.email && this.usersByEmail.has(updates.email)) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
        }

        const updatedUser: UserRecord = {
            ...existingUser,
            email: updates.email ?? existingUser.email,
            emailVerified: updates.emailVerified ?? existingUser.emailVerified,
            displayName: updates.displayName ?? existingUser.displayName,
            photoURL: updates.photoURL === null ? undefined : (updates.photoURL ?? existingUser.photoURL),
            phoneNumber: updates.phoneNumber ?? existingUser.phoneNumber,
            disabled: updates.disabled ?? existingUser.disabled,
            metadata: {
                ...existingUser.metadata,
                lastRefreshTime: new Date().toISOString(),
                toJSON: () => ({}),
            },
            toJSON: () => ({}),
        };

        this.setUser(uid, updatedUser);
        return updatedUser;
    }

    async deleteUser(uid: string): Promise<void> {
        const user = this.users.get(uid);
        if (!user || this.deletedUsers.has(uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${uid} not found`);
        }
        this.markUserAsDeleted(uid);
    }

    async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
        const decoded = this.decodedTokens.get(idToken);
        if (!decoded) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'INVALID_TOKEN', 'Invalid ID token');
        }
        return decoded;
    }

    async createCustomToken(uid: string, additionalClaims?: object): Promise<string> {
        const user = this.users.get(uid);
        if (!user || this.deletedUsers.has(uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${uid} not found`);
        }

        const token = `custom-token-${uid}-${Date.now()}`;
        this.customTokens.set(uid, token);

        if (additionalClaims) {
            this.customClaims.set(uid, additionalClaims);
        }

        return token;
    }

    async getUserByEmail(email: string): Promise<UserRecord | null> {
        const user = this.usersByEmail.get(email);
        if (user && this.deletedUsers.has(user.uid)) {
            return null;
        }
        return user || null;
    }

    async getUserByPhoneNumber(phoneNumber: string): Promise<UserRecord | null> {
        const user = this.usersByPhone.get(phoneNumber);
        if (user && this.deletedUsers.has(user.uid)) {
            return null;
        }
        return user || null;
    }

    async listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult> {
        const allUsers = Array.from(this.users.values()).filter((user) => !this.deletedUsers.has(user.uid));
        const limit = maxResults || 1000;
        const start = pageToken ? parseInt(pageToken, 10) : 0;
        const users = allUsers.slice(start, start + limit);

        return {
            users,
            pageToken: start + limit < allUsers.length ? (start + limit).toString() : undefined,
        };
    }

    async deleteUsers(uids: string[]): Promise<DeleteUsersResult> {
        let successCount = 0;
        const errors: any[] = [];

        for (const uid of uids) {
            try {
                await this.deleteUser(uid);
                successCount++;
            } catch (error) {
                errors.push({ index: uids.indexOf(uid), error });
            }
        }

        return {
            successCount,
            failureCount: errors.length,
            errors,
        };
    }

    async generatePasswordResetLink(email: string): Promise<string> {
        const user = this.usersByEmail.get(email);
        if (!user || this.deletedUsers.has(user.uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User with email ${email} not found`);
        }
        return `https://example.com/reset-password?token=reset-${user.uid}-${Date.now()}`;
    }

    async generateEmailVerificationLink(email: string): Promise<string> {
        const user = this.usersByEmail.get(email);
        if (!user || this.deletedUsers.has(user.uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User with email ${email} not found`);
        }
        return `https://example.com/verify-email?token=verify-${user.uid}-${Date.now()}`;
    }

    async setCustomUserClaims(uid: string, customClaims: object): Promise<void> {
        const user = this.users.get(uid);
        if (!user || this.deletedUsers.has(uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${uid} not found`);
        }
        this.customClaims.set(uid, customClaims);

        // Update the user record with custom claims
        const updatedUser = { ...user, customClaims, toJSON: () => ({}) };
        this.users.set(uid, updatedUser);
    }

    async revokeRefreshTokens(uid: string): Promise<void> {
        const user = this.users.get(uid);
        if (!user || this.deletedUsers.has(uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${uid} not found`);
        }

        // Update tokens valid after time
        const updatedUser = {
            ...user,
            tokensValidAfterTime: new Date().toISOString(),
            toJSON: () => ({}),
        };
        this.users.set(uid, updatedUser);
    }

    async verifyPassword(email: string, password: string): Promise<boolean> {
        const user = this.usersByEmail.get(email);
        if (!user || this.deletedUsers.has(user.uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User with email ${email} not found`);
        }
        // For testing purposes, return true for valid passwords
        // You could enhance this to store and verify actual passwords if needed
        return true;
    }
}

/**
 * Helper functions to create mock data for testing
 */
export function createTestUser(id: string, overrides: any = {}): any {
    return {
        id,
        email: `${id}@test.com`,
        displayName: `Test User ${id}`,
        photoURL: null,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

export function createTestGroup(id: string, overrides: any = {}): any {
    return {
        id,
        name: `Test Group ${id}`,
        description: 'A test group',
        createdBy: 'test-user',
        members: {},
        securityPreset: 'open',
        permissions: {
            expenseEditing: 'anyone',
            expenseDeletion: 'anyone',
            memberInvitation: 'anyone',
            memberApproval: 'automatic',
            settingsManagement: 'anyone',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides,
    };
}

export function createTestExpense(id: string, overrides: any = {}): any {
    return {
        id,
        groupId: 'test-group',
        description: 'Test expense',
        amount: 10.0,
        currency: 'USD',
        category: 'general',
        paidBy: 'test-user',
        createdBy: 'test-user',
        date: new Date(),
        splitType: 'equal',
        splits: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides,
    };
}

export function createMockPolicyDocument(overrides: Partial<PolicyDTO> = {}): PolicyDTO {
    const defaultHash = '4205e9e6ac39b586be85ca281f9eb22a12765bac87ca095f7ebfee54083063e3';
    const defaultTimestamp = new Date().toISOString(); // DTOs use ISO strings

    return {
        id: 'policy-123',
        policyName: 'Test Policy',
        currentVersionHash: defaultHash,
        versions: {
            [defaultHash]: {
                text: 'Default policy content',
                createdAt: defaultTimestamp,
            },
        },
        createdAt: defaultTimestamp,
        updatedAt: defaultTimestamp,
        ...overrides,
    };
}

/**
 * Clear all shared storage for tests
 */
export function clearSharedStorage() {
    sharedCommentStorage.clear();
}

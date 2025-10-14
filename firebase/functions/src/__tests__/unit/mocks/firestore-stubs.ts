import { CommentTargetType } from '@splitifyd/shared';
import type { GroupMembershipDTO } from '@splitifyd/shared';
import type { CommentDTO, ExpenseDTO, GroupDTO, PolicyDTO, RegisteredUser, SettlementDTO } from '@splitifyd/shared/src';
import type { CreateRequest, DecodedIdToken, GetUsersResult, UpdateRequest, UserRecord } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { vi } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import type { IDocumentSnapshot, IQuerySnapshot, ITransaction } from '../../../firestore-wrapper';
import type { GroupBalanceDTO } from '../../../schemas';
import type { UserNotificationDocument } from '../../../schemas/user-notifications';
import type { IAuthService } from '../../../services/auth';
import type { IFirestoreReader, QueryOptions } from '../../../services/firestore';
import type { BatchWriteResult, IFirestoreWriter, WriteResult } from '../../../services/firestore/IFirestoreWriter';
import { ApiError } from '../../../utils/errors';

// Shared storage for comments across reader and writer operations
const sharedCommentStorage = new Map<string, any[]>();

/**
 * Unified in-memory stub implementation of both IFirestoreReader and IFirestoreWriter for unit testing.
 * This single class provides both read and write operations with shared document storage,
 * making it easy to test services that use both interfaces without needing to coordinate
 * between separate reader/writer stubs.
 *
 * Document storage is automatically shared within the instance, so writes are immediately
 * visible to reads without any special coordination.
 */
export class StubFirestore implements IFirestoreReader, IFirestoreWriter {
    private documents = new Map<string, any>();
    private rawDocuments = new Map<string, any>();
    private userGroups = new Map<string, any>(); // userId -> pagination result or groups[]
    private paginationBehavior = new Map<string, { groups: any[]; pageSize: number; }>(); // userId -> pagination config
    private methodErrors = new Map<string, Error>(); // methodName -> error to throw
    private notFoundDocuments = new Set<string>(); // Track which docs should return null
    private writeResults: WriteResult[] = [];

    // Track method calls for test assertions
    public setUserNotificationsCalls: { userId: string; updates: any; merge?: boolean; }[] = [];
    public batchSetUserNotificationsCalls: Array<{ updates: Array<{ userId: string; data: any; merge?: boolean; }>; }> = [];
    public updateInTransaction = vi.fn().mockImplementation((transaction: any, documentPath: string, updates: any): void => {
        // Update the document in storage so subsequent reads see the changes
        const existingDoc = this.documents.get(documentPath) || {};
        const updatedDoc = { ...existingDoc, ...updates };
        this.documents.set(documentPath, updatedDoc);
    });

    /**
     * @deprecated Use collection-specific methods instead (e.g., setUser, setGroup, setExpense)
     */
    setDocument(collection: string, id: string, data: any) {
        this.documents.set(`${collection}/${id}`, data);
    }

    // Get the documents Map for sharing with other stubs
    getDocuments(): Map<string, any> {
        return this.documents;
    }

    // ===== Users Collection Methods =====

    /**
     * Set a user document in the mock Firestore
     *
     * @param userId - The user ID (will be set as both id and uid fields)
     * @param userData - Partial user data matching RegisteredUser DTO structure (from @splitifyd/shared).
     *                   Uses ISO string dates (createdAt, updatedAt) which are automatically converted to Timestamps.
     *                   Common fields: displayName, email, photoURL, role, themeColor, preferredLanguage, etc.
     *
     * Note: This method accepts RegisteredUser (DTO) data with ISO strings and converts them to
     * Firestore Timestamps internally, matching production Firestore storage behavior.
     */
    setUser(userId: string, userData: Partial<RegisteredUser> = {}): void {
        const defaultUser: Partial<RegisteredUser> & { id: string; } = {
            id: userId,
            uid: userId,
            displayName: `Test User ${userId}`,
            photoURL: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...userData,
        };

        // Convert ISO strings to Timestamps (mirrors production Firestore storage)
        const convertedUser = this.convertISOToTimestamps(defaultUser);
        this.documents.set(`users/${userId}`, convertedUser);
    }

    /**
     * Remove a user document from the mock Firestore
     * @param userId - The user ID to remove
     */
    removeUser(userId: string): void {
        this.documents.delete(`users/${userId}`);
    }

    /**
     * Mark a user document as "not found" (getUser will return null)
     * @param userId - The user ID
     */
    setUserNotFound(userId: string): void {
        this.notFoundDocuments.add(`users/${userId}`);
    }

    // Helper methods for pagination testing
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

    /**
     * @deprecated Use setUser() or removeUser() instead for better type safety
     */
    mockUserExists(userId: string, existsOrUserDoc: boolean | Partial<RegisteredUser> = true) {
        if (typeof existsOrUserDoc === 'boolean') {
            if (existsOrUserDoc) {
                this.setUser(userId, {});
            } else {
                this.removeUser(userId);
            }
        } else {
            // Second parameter is RegisteredUser DTO data
            this.setUser(userId, existsOrUserDoc);
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
        this.writeResults = [];
        this.setUserNotificationsCalls = [];
        this.batchSetUserNotificationsCalls = [];
        sharedCommentStorage.clear();
    }

    // Helper method for filtering collections with ordering and limiting
    private filterCollection<T>(collectionPrefix: string, filter?: (doc: T) => boolean, orderBy?: { field: string; direction: 'asc' | 'desc'; }, limit?: number): T[] {
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
            } // Recursively convert nested objects
            else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
                result[key] = this.convertISOToTimestamps(value);
            } // Recursively convert arrays
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

    // ===== IFirestoreReader Implementation =====

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
    async getRawPolicyDocument(policyId: string): Promise<IDocumentSnapshot | null> {
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

    async getExpensesForGroupPaginated(
        groupId: string,
        options?: { limit?: number; cursor?: string; includeDeleted?: boolean; },
    ): Promise<{ expenses: ExpenseDTO[]; hasMore: boolean; nextCursor?: string; }> {
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

    async getCommentsForTarget(targetType: CommentTargetType, targetId: string, options?: any): Promise<{ comments: CommentDTO[]; hasMore: boolean; nextCursor?: string; }> {
        const comments = sharedCommentStorage.get(`${targetType}:${targetId}`) || [];
        return { comments, hasMore: false, nextCursor: undefined };
    }

    async getComment(targetType: CommentTargetType, targetId: string, commentId: string): Promise<CommentDTO | null> {
        const comments = sharedCommentStorage.get(`${targetType}:${targetId}`) || [];
        return comments.find((c) => c.id === commentId) || null;
    }

    async getGroupDeletionData(): Promise<{
        expenses: IQuerySnapshot;
        settlements: IQuerySnapshot;
        shareLinks: IQuerySnapshot;
        groupComments: IQuerySnapshot;
        expenseComments: IQuerySnapshot[];
    }> {
        const emptySnapshot: IQuerySnapshot = {
            size: 0,
            docs: [],
            empty: true,
            forEach: () => {},
        };
        return {
            expenses: emptySnapshot,
            settlements: emptySnapshot,
            shareLinks: emptySnapshot,
            groupComments: emptySnapshot,
            expenseComments: [],
        };
    }

    // Missing methods from interface
    async verifyGroupMembership(): Promise<boolean> {
        return false;
    }

    async getGroupMembershipsInTransaction(): Promise<IQuerySnapshot> {
        return { docs: [], size: 0, empty: true, forEach: () => {} };
    }

    async getRawGroupDocumentInTransaction(transaction: ITransaction, groupId: string): Promise<IDocumentSnapshot | null> {
        const groupData = this.documents.get(`groups/${groupId}`);
        if (!groupData) {
            return null;
        }
        return {
            id: groupId,
            exists: true,
            data: () => groupData,
            ref: {
                id: groupId,
                path: `groups/${groupId}`,
                get: async (): Promise<IDocumentSnapshot> => {
                    const doc = await this.getRawGroupDocumentInTransaction(transaction, groupId);
                    if (!doc) throw new Error(`Group ${groupId} not found`);
                    return doc;
                },
                set: async () => {},
                update: async () => {},
                delete: async () => {},
                collection: () => ({ doc: () => ({} as any) }) as any,
                parent: null,
            },
        };
    }

    async getGroupInTransaction(transaction: ITransaction, groupId: string): Promise<GroupDTO | null> {
        // In stub, transaction reads work the same as non-transaction reads
        const key = `groups/${groupId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }
        return this.documents.get(key) || null;
    }

    async getExpenseInTransaction(transaction: ITransaction, expenseId: string): Promise<ExpenseDTO | null> {
        // In stub, transaction reads work the same as non-transaction reads
        const key = `expenses/${expenseId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }
        return this.documents.get(key) || null;
    }

    async getSettlementInTransaction(transaction: ITransaction, settlementId: string): Promise<SettlementDTO | null> {
        // In stub, transaction reads work the same as non-transaction reads
        const key = `settlements/${settlementId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }
        return this.documents.get(key) || null;
    }

    // ===== IFirestoreWriter Implementation =====

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
        // Also update rawDocuments so getRawPolicyDocument works
        this.setRawDocument(policyId, convertedData);
        return result;
    }

    async updatePolicy(policyId: string, updates: any): Promise<WriteResult> {
        const existing = this.documents.get(`policies/${policyId}`);
        if (existing) {
            // Convert ISO strings to Timestamps before merging (mirrors production FirestoreWriter)
            const convertedUpdates = this.convertISOToTimestamps(updates);
            const merged = { ...existing, ...convertedUpdates };
            this.documents.set(`policies/${policyId}`, merged);
            // Also update rawDocuments so getRawPolicyDocument works
            this.setRawDocument(policyId, merged);
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

    async batchSetUserNotifications(updates: Array<{ userId: string; data: any; merge?: boolean; }>): Promise<BatchWriteResult> {
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
            get: vi.fn().mockImplementation((refOrQuery: any) => {
                // Check if this is a Query (has _query property or where method) vs a DocumentReference
                const isQuery = refOrQuery._query || typeof refOrQuery.where === 'function' || refOrQuery.type === 'query';

                if (isQuery) {
                    // Handle collection query
                    // Extract collection path and where clauses
                    const collectionPath = refOrQuery._query?.path?.segments?.join('/')
                        || refOrQuery.path
                        || refOrQuery._path?.segments?.join('/')
                        || 'group-members'; // Fallback for our specific use case

                    // For simplicity, extract filters from the query object
                    // In real Firestore, this would be more complex
                    let filters: any = {};
                    if (refOrQuery._query?.filters) {
                        filters = refOrQuery._query.filters;
                    } else if (refOrQuery.where) {
                        // Store filter info if it exists
                        filters = refOrQuery._whereFilters || {};
                    }

                    // Query documents from storage
                    const docs: any[] = [];
                    for (const [path, data] of this.documents.entries()) {
                        if (path.startsWith(`${collectionPath}/`)) {
                            // Apply where filter if present (simplified - only handles groupId == value)
                            let matches = true;
                            if (filters.groupId !== undefined) {
                                matches = data.groupId === filters.groupId;
                            }

                            if (matches) {
                                const docId = path.substring(collectionPath.length + 1);
                                docs.push({
                                    id: docId,
                                    exists: true,
                                    data: () => data,
                                    ref: { id: docId, path },
                                });
                            }
                        }
                    }

                    return Promise.resolve({
                        empty: docs.length === 0,
                        size: docs.length,
                        docs,
                    });
                }

                // Handle document reference (original behavior)
                let path = refOrQuery.path || refOrQuery.id || '';

                // Try alternative path formats if not found
                if (!this.documents.has(path) && refOrQuery._path && refOrQuery._path.segments) {
                    path = refOrQuery._path.segments.join('/');
                }
                if (!this.documents.has(path) && refOrQuery.parent && refOrQuery.id) {
                    path = `${refOrQuery.parent.id}/${refOrQuery.id}`;
                }
                if (!this.documents.has(path) && refOrQuery.collection && refOrQuery.id) {
                    path = `${refOrQuery.collection.id}/${refOrQuery.id}`;
                }

                const documentData = this.documents.get(path);

                return Promise.resolve({
                    exists: !!documentData,
                    data: () => documentData || {},
                    ref: refOrQuery,
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

    generateDocumentId(): string {
        return 'generated-id';
    }

    async performHealthCheck(): Promise<{ success: boolean; responseTime: number; }> {
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

    async updateGroupMemberDisplayName(groupId: string, userId: string, newDisplayName: string): Promise<void> {
        // Validate display name
        if (!newDisplayName || newDisplayName.trim().length === 0) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_INPUT', 'Display name cannot be empty');
        }

        // Query all members of the group to check for name conflicts
        const members: any[] = [];
        for (const [path, data] of this.documents.entries()) {
            if (path.startsWith('group-members/') && data.groupId === groupId) {
                members.push(data);
            }
        }

        if (members.length === 0) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        // Check if display name is already taken by another user
        // Check both groupDisplayName and fallback displayName for conflicts
        // Note: member documents use 'uid' field, not 'userId'
        const nameTaken = members.some((m) => m.uid !== userId && (m.groupDisplayName || m.displayName) === newDisplayName);

        if (nameTaken) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'DISPLAY_NAME_TAKEN', `Display name "${newDisplayName}" is already in use in this group`);
        }

        // Check if member exists
        const memberPath = `group-members/${groupId}_${userId}`;
        const existing = this.documents.get(memberPath);

        if (!existing) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_MEMBER_NOT_FOUND', 'User is not a member of this group');
        }

        // Update the member document
        this.documents.set(memberPath, {
            ...existing,
            groupDisplayName: newDisplayName,
            updatedAt: Timestamp.now(),
        });

        // Touch the group to update its timestamp
        const groupPath = `groups/${groupId}`;
        const groupDoc = this.documents.get(groupPath);
        if (groupDoc) {
            this.documents.set(groupPath, {
                ...groupDoc,
                updatedAt: Timestamp.now(),
            });
        }
    }
}

/**
 * Convenience alias for StubFirestore when only reader interface is needed.
 * Uses the same unified implementation.
 */
export const StubFirestoreReader = StubFirestore;

/**
 * In-memory stub implementation of IAuthService for unit testing
 * Provides predictable behavior for testing user authentication operations
 */
export class StubAuthService implements IAuthService {
    private users = new Map<string, UserRecord>();
    private customTokens = new Map<string, string>();
    private decodedTokens = new Map<string, DecodedIdToken>();
    private deletedUsers = new Set<string>();

    // Helper methods to set up test data
    setUser(uid: string, user: Partial<UserRecord> & { uid: string; }) {
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
        this.customTokens.clear();
        this.decodedTokens.clear();
        this.deletedUsers.clear();
    }

    // IAuthService implementation
    async createUser(userData: CreateRequest): Promise<UserRecord> {
        const uid = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check for duplicate email
        if (userData.email) {
            const existingUser = Array.from(this.users.values()).find((u) => u.email === userData.email);
            if (existingUser && !this.deletedUsers.has(existingUser.uid)) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
            }
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

    async getUsers(uids: { uid: string; }[]): Promise<GetUsersResult> {
        const users: UserRecord[] = [];
        const notFound: { uid: string; }[] = [];

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
        if (updates.email && updates.email !== existingUser.email) {
            const conflictingUser = Array.from(this.users.values()).find((u) => u.email === updates.email);
            if (conflictingUser && !this.deletedUsers.has(conflictingUser.uid)) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
            }
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

        return token;
    }

    async verifyPassword(email: string, password: string): Promise<boolean> {
        // Find user by email
        const user = Array.from(this.users.values()).find((u) => u.email === email);
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
 * @deprecated Use StubFirestore.setUser() instead for better type safety and consistency
 */
export function createTestUser(id: string, overrides: Partial<RegisteredUser> = {}): RegisteredUser {
    return {
        uid: id,
        displayName: `Test User ${id}`,
        photoURL: null,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

// Export the new stub implementation
export { StubFirestoreDatabase } from '@splitifyd/test-support';

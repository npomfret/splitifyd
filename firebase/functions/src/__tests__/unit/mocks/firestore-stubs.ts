import {vi} from 'vitest';
import {Timestamp} from 'firebase-admin/firestore';
import type {UserRecord, UpdateRequest, CreateRequest, GetUsersResult, DecodedIdToken, ListUsersResult, DeleteUsersResult} from 'firebase-admin/auth';
import type {IFirestoreReader} from '../../../services/firestore';
import type {IFirestoreWriter, WriteResult} from '../../../services/firestore/IFirestoreWriter';
import type {IAuthService} from '../../../services/auth';
import type {PolicyDocument, UserDocument, GroupDocument, ExpenseDocument, SettlementDocument} from '../../../schemas';
import type {GroupMemberDocument, CommentTargetType} from '@splitifyd/shared';
import type {UserNotificationDocument} from '../../../schemas/user-notifications';
import type {ParsedShareLink, ParsedComment} from '../../../schemas';
import {ApiError} from '../../../utils/errors';
import {HTTP_STATUS} from '../../../constants';

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
    private paginationBehavior = new Map<string, { groups: any[], pageSize: number }>(); // userId -> pagination config
    private methodErrors = new Map<string, Error>(); // methodName -> error to throw
    private notFoundDocuments = new Set<string>(); // Track which docs should return null

    // Helper methods to set up test data
    setDocument(collection: string, id: string, data: any) {
        this.documents.set(`${collection}/${id}`, data);
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

    // Error injection helpers
    setMethodError(methodName: string, error: Error | string) {
        if (typeof error === 'string') {
            // Create appropriate error based on string
            if (error === 'NOT_FOUND') {
                this.methodErrors.set(methodName, new ApiError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', 'Document not found'));
            } else if (error === 'PERMISSION_DENIED') {
                this.methodErrors.set(methodName, new ApiError(HTTP_STATUS.FORBIDDEN, 'PERMISSION_DENIED', 'Permission denied'));
            } else if (error === 'FIRESTORE_ERROR') {
                this.methodErrors.set(methodName, new Error('Firestore connection failed'));
            } else {
                this.methodErrors.set(methodName, new Error(error));
            }
        } else {
            this.methodErrors.set(methodName, error);
        }
    }

    clearMethodError(methodName: string) {
        this.methodErrors.delete(methodName);
    }

    setNotFound(collection: string, id: string) {
        this.notFoundDocuments.add(`${collection}/${id}`);
    }

    clearNotFound(collection: string, id: string) {
        this.notFoundDocuments.delete(`${collection}/${id}`);
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

    async getAllPolicies(): Promise<PolicyDocument[]> {
        const error = this.methodErrors.get('getAllPolicies');
        if (error) throw error;

        return this.filterCollection<PolicyDocument>('policies');
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
    private filterCollection<T>(
        collectionPrefix: string,
        filter?: (doc: T) => boolean,
        orderBy?: { field: string; direction: 'asc' | 'desc' },
        limit?: number
    ): T[] {
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

    setRawDocument(id: string, data: any) {
        if (data === null) {
            this.rawDocuments.delete(id);
        } else {
            this.rawDocuments.set(id, {
                id,
                exists: !!data,
                data: () => data,
                get: (field: string) => data?.[field],
                ref: {id, path: `policies/${id}`},
                readTime: Timestamp.now(),
                isEqual: (other: any) => other?.id === id,
            });
        }
    }

    // Document Read Operations
    async getUser(userId: string): Promise<UserDocument | null> {
        const error = this.methodErrors.get('getUser');
        if (error) throw error;

        const key = `users/${userId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async getGroup(groupId: string): Promise<GroupDocument | null> {
        const error = this.methodErrors.get('getGroup');
        if (error) throw error;

        const key = `groups/${groupId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async getExpense(expenseId: string): Promise<ExpenseDocument | null> {
        const error = this.methodErrors.get('getExpense');
        if (error) throw error;

        const key = `expenses/${expenseId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async getSettlement(settlementId: string): Promise<SettlementDocument | null> {
        const error = this.methodErrors.get('getSettlement');
        if (error) throw error;

        const key = `settlements/${settlementId}`;
        if (this.notFoundDocuments.has(key)) {
            return null;
        }

        return this.documents.get(key) || null;
    }

    async getPolicy(policyId: string): Promise<PolicyDocument | null> {
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

    // Minimal implementations for other required methods
    async getUsersById(userIds: string[]): Promise<UserDocument[]> {
        const users: UserDocument[] = [];
        for (const userId of userIds) {
            const user = this.documents.get(`users/${userId}`);
            if (user) {
                users.push(user);
            }
        }
        return users;
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

    async getGroupMembers(): Promise<GroupMemberDocument[]> {
        return [];
    }

    async getGroupMember(groupId: string, userId: string): Promise<GroupMemberDocument | null> {
        const error = this.methodErrors.get('getGroupMember');
        if (error) throw error;

        const docId = `group-members/${groupId}_${userId}`;
        if (this.notFoundDocuments.has(docId)) return null;

        return this.documents.get(docId) || null;
    }

    // Mock-enabled getAllGroupMembers
    async getAllGroupMembers(groupId: string): Promise<GroupMemberDocument[]> {
        const error = this.methodErrors.get('getAllGroupMembers');
        if (error) throw error;

        return this.filterCollection<GroupMemberDocument>(
            'group-members',
            doc => doc.groupId === groupId
        );
    }

    async getAllGroupMemberIds(): Promise<string[]> {
        return [];
    }

    async getExpensesForGroup(groupId: string, options?: any): Promise<ExpenseDocument[]> {
        const error = this.methodErrors.get('getExpensesForGroup');
        if (error) throw error;

        return this.filterCollection<ExpenseDocument>(
            'expenses',
            doc => doc.groupId === groupId && (doc.deletedAt == null || !!options?.includeDeleted),
            options?.orderBy,
            options?.limit
        );
    }

    async getExpenseHistory(): Promise<any> {
        return {history: [], count: 0};
    }

    async getExpensesForGroupPaginated(
        groupId: string,
        options?: { limit?: number; cursor?: string; includeDeleted?: boolean }
    ): Promise<{ expenses: ExpenseDocument[]; hasMore: boolean; nextCursor?: string }> {
        const error = this.methodErrors.get('getExpensesForGroupPaginated');
        if (error) throw error;

        const limit = options?.limit || 20;

        let expenses = this.filterCollection<ExpenseDocument>(
            'expenses',
            doc => doc.groupId === groupId && (doc.deletedAt == null || !!options?.includeDeleted),
            { field: 'createdAt', direction: 'desc' } // Default ordering by creation date
        );

        // Handle cursor-based pagination
        if (options?.cursor) {
            const cursorIndex = expenses.findIndex(e => e.id === options.cursor);
            if (cursorIndex >= 0) {
                expenses = expenses.slice(cursorIndex + 1);
            }
        }

        const hasMore = expenses.length > limit;
        const results = expenses.slice(0, limit);
        const nextCursor = hasMore && results.length > 0 ? results[results.length - 1]?.id : undefined;

        return { expenses: results, hasMore, nextCursor };
    }

    async getSettlementsForGroup(groupId: string, options?: any): Promise<SettlementDocument[]> {
        const error = this.methodErrors.get('getSettlementsForGroup');
        if (error) throw error;

        return this.filterCollection<SettlementDocument>(
            'settlements',
            doc => doc.groupId === groupId && (doc.deletedAt == null || !!options?.includeDeleted),
            options?.orderBy,
            options?.limit
        );
    }

    async getGroupInTransaction(): Promise<GroupDocument | null> {
        return null;
    }

    async getUserInTransaction(): Promise<UserDocument | null> {
        return null;
    }

    async documentExists(): Promise<boolean> {
        return false;
    }

    async getUserNotification(): Promise<UserNotificationDocument | null> {
        return null;
    }

    async userNotificationExists(): Promise<boolean> {
        return false;
    }

    async findShareLinkByToken(): Promise<any | null> {
        return null;
    }

    async getShareLinksForGroup(): Promise<ParsedShareLink[]> {
        return [];
    }

    async getShareLink(): Promise<ParsedShareLink | null> {
        return null;
    }

    // Helper method for tests to set up comments for a target
    setCommentsForTarget(targetType: CommentTargetType, targetId: string, comments: any[]) {
        sharedCommentStorage.set(`${targetType}:${targetId}`, comments);
    }

    async getCommentsForTarget(targetType: CommentTargetType, targetId: string, options?: any): Promise<any> {
        const comments = sharedCommentStorage.get(`${targetType}:${targetId}`) || [];
        return {comments, hasMore: false, nextCursor: null};
    }

    async getComment(targetType: CommentTargetType, targetId: string, commentId: string): Promise<ParsedComment | null> {
        const comments = sharedCommentStorage.get(`${targetType}:${targetId}`) || [];
        return comments.find((c) => c.id === commentId) || null;
    }

    async getCommentByReference(): Promise<ParsedComment | null> {
        return null;
    }

    async getGroupDeletionData(): Promise<any> {
        return {
            expenses: {size: 0, docs: []},
            settlements: {size: 0, docs: []},
            shareLinks: {size: 0, docs: []},
            groupComments: {size: 0, docs: []},
            expenseComments: [],
        };
    }

    async getSettlementsForGroupPaginated(): Promise<any> {
        return {settlements: [], hasMore: false};
    }

    // Missing methods from interface
    async verifyGroupMembership(): Promise<boolean> {
        return false;
    }

    async getGroupMembershipsInTransaction(): Promise<any> {
        return {docs: [], size: 0, empty: true};
    }

    async getRawDocumentInTransaction(): Promise<any | null> {
        return null;
    }

    async getRawExpenseDocumentInTransaction(transaction: any, expenseId: string): Promise<any | null> {
        const expenseData = this.documents.get(`expenses/${expenseId}`);
        if (!expenseData) return null;

        return {
            exists: true,
            data: () => expenseData,
            ref: {id: expenseId, path: `expenses/${expenseId}`},
        };
    }

    async getRawGroupDocument(): Promise<any | null> {
        return null;
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
            ref: {id: groupId, path: `groups/${groupId}`},
        };
    }

    async getRawSettlementDocumentInTransaction(): Promise<any | null> {
        return null;
    }

    async getRawUserDocumentInTransaction(): Promise<any | null> {
        return null;
    }
}

/**
 * In-memory stub implementation of IFirestoreWriter for unit testing
 * Only implements methods actually used by services being tested
 */
export class StubFirestoreWriter implements IFirestoreWriter {
    private documents = new Map<string, any>();
    private writeResults: WriteResult[] = [];

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

        this.documents.set(`policies/${policyId}`, policyData);
        return result;
    }

    async updatePolicy(policyId: string, updates: any): Promise<WriteResult> {
        const existing = this.documents.get(`policies/${policyId}`);
        if (existing) {
            this.documents.set(`policies/${policyId}`, {...existing, ...updates});
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
        return {id: 'user', success: true, timestamp: Timestamp.now()};
    }

    async updateUser(userId: string, updates: any): Promise<WriteResult> {
        // Update the document in memory
        const existing = this.documents.get(`users/${userId}`);
        if (existing) {
            this.documents.set(`users/${userId}`, {...existing, ...updates});
        }
        return {id: userId, success: true, timestamp: Timestamp.now()};
    }

    async deleteUser(): Promise<WriteResult> {
        return {id: 'user', success: true, timestamp: Timestamp.now()};
    }

    async createGroup(): Promise<WriteResult> {
        return {id: 'group', success: true, timestamp: Timestamp.now()};
    }

    async updateGroup(): Promise<WriteResult> {
        return {id: 'group', success: true, timestamp: Timestamp.now()};
    }

    async deleteGroup(): Promise<WriteResult> {
        return {id: 'group', success: true, timestamp: Timestamp.now()};
    }

    async createExpense(): Promise<WriteResult> {
        return {id: 'expense', success: true, timestamp: Timestamp.now()};
    }

    async updateExpense(): Promise<WriteResult> {
        return {id: 'expense', success: true, timestamp: Timestamp.now()};
    }

    async deleteExpense(): Promise<WriteResult> {
        return {id: 'expense', success: true, timestamp: Timestamp.now()};
    }

    async createSettlement(): Promise<WriteResult> {
        return {id: 'settlement', success: true, timestamp: Timestamp.now()};
    }

    async updateSettlement(): Promise<WriteResult> {
        return {id: 'settlement', success: true, timestamp: Timestamp.now()};
    }

    async deleteSettlement(): Promise<WriteResult> {
        return {id: 'settlement', success: true, timestamp: Timestamp.now()};
    }

    async addComment(targetType: CommentTargetType, targetId: string, commentData: any): Promise<WriteResult> {
        const id = `comment-${Date.now()}`;
        const result = this.getLastWriteResult() || {id, success: true, timestamp: Timestamp.now()};

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

    async updateComment(): Promise<WriteResult> {
        return {id: 'comment', success: true, timestamp: Timestamp.now()};
    }

    async deleteComment(): Promise<WriteResult> {
        return {id: 'comment', success: true, timestamp: Timestamp.now()};
    }

    createShareLinkInTransaction(): any {
        return {id: 'link', path: 'shareLinks/link'};
    }

    async updateGroupInTransaction(): Promise<WriteResult> {
        return {id: 'group', success: true, timestamp: Timestamp.now()};
    }

    async createUserNotification(): Promise<WriteResult> {
        return {id: 'notification', success: true, timestamp: Timestamp.now()};
    }

    async updateUserNotification(): Promise<WriteResult> {
        return {id: 'notification', success: true, timestamp: Timestamp.now()};
    }

    async setUserNotificationGroup(): Promise<WriteResult> {
        return {id: 'notification', success: true, timestamp: Timestamp.now()};
    }

    async removeUserNotificationGroup(): Promise<WriteResult> {
        return {id: 'notification', success: true, timestamp: Timestamp.now()};
    }

    async setUserNotifications(): Promise<WriteResult> {
        return {id: 'notification', success: true, timestamp: Timestamp.now()};
    }

    async setUserNotificationGroupInTransaction(): Promise<WriteResult> {
        return {id: 'notification', success: true, timestamp: Timestamp.now()};
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
                this.documents.set(path, {...existingData, ...data});
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
        return {id, path: `${collection}/${id}`};
    }

    updateInTransaction = vi.fn().mockImplementation(async (): Promise<WriteResult> => {
        return {id: 'doc', success: true, timestamp: Timestamp.now()};
    });

    async deleteInTransaction(): Promise<WriteResult> {
        return {id: 'doc', success: true, timestamp: Timestamp.now()};
    }

    generateDocumentId(): string {
        return 'generated-id';
    }

    async performHealthCheck(): Promise<{ success: boolean; responseTime: number }> {
        return {success: true, responseTime: 50};
    }

    async bulkDeleteInTransaction(): Promise<any> {
        return {successCount: 0, failureCount: 0, results: []};
    }

    getDocumentReferenceInTransaction(transaction: any, collection: string, documentId: string): any {
        return {
            id: documentId,
            path: `${collection}/${documentId}`,
            collection: {id: collection},
        };
    }

    async deleteMemberAndNotifications(): Promise<any> {
        return {successCount: 1, failureCount: 0, results: []};
    }

    async leaveGroupAtomic(): Promise<any> {
        return {successCount: 1, failureCount: 0, results: []};
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

        for (const {uid} of uids) {
            const user = this.users.get(uid);
            if (user && !this.deletedUsers.has(uid)) {
                users.push(user);
            } else {
                notFound.push({uid});
            }
        }

        return {users, notFound};
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
                errors.push({index: uids.indexOf(uid), error});
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
        const updatedUser = {...user, customClaims, toJSON: () => ({})};
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

export function createMockPolicyDocument(overrides: Partial<PolicyDocument> = {}): PolicyDocument {
    const defaultHash = '4205e9e6ac39b586be85ca281f9eb22a12765bac87ca095f7ebfee54083063e3';
    const defaultTimestamp = Timestamp.now();

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
 * Stub implementation for permission engine to replace vi.mock()
 */
export class StubPermissionEngine {
    private static permissions = new Map<string, boolean>();
    private static defaultPermission = true;

    static setPermission(action: string, groupId: string, userId: string, allowed: boolean) {
        const key = `${action}:${groupId}:${userId}`;
        StubPermissionEngine.permissions.set(key, allowed);
    }

    static setDefaultPermission(allowed: boolean) {
        StubPermissionEngine.defaultPermission = allowed;
    }

    static async checkPermission(
        firestoreReader: any,
        group: any,
        userId: string,
        action: string,
        options: any = {}
    ): Promise<boolean> {
        const key = `${action}:${group.id}:${userId}`;
        return StubPermissionEngine.permissions.get(key) ?? StubPermissionEngine.defaultPermission;
    }

    private static evaluatePermission(permission: any, userRole: any, userId: string, options: any): boolean {
        return true;
    }

    static async canChangeRole(
        firestoreReader: any,
        group: any,
        currentUserRole: any,
        targetUserRole: any,
        targetUserId: string
    ): Promise<boolean> {
        return true;
    }

    static async getUserPermissions(firestoreReader: any, group: any, userId: string): Promise<Record<string, boolean>> {
        return {};
    }

    static getDefaultPermissions(preset: any): any {
        return {};
    }

    static clear() {
        StubPermissionEngine.permissions.clear();
        StubPermissionEngine.defaultPermission = true;
    }
}

/**
 * Stub implementation for logger to replace vi.mock()
 */
export class StubLogger {
    public logs: Array<{level: string, message: string, context?: any}> = [];

    info(message: string, context?: any) {
        this.logs.push({level: 'info', message, context});
    }

    error(message: string, context?: any) {
        this.logs.push({level: 'error', message, context});
    }

    warn(message: string, context?: any) {
        this.logs.push({level: 'warn', message, context});
    }

    debug(message: string, context?: any) {
        this.logs.push({level: 'debug', message, context});
    }

    getLogsForLevel(level: string) {
        return this.logs.filter(log => log.level === level);
    }

    child(context: any): StubLogger {
        const childLogger = new StubLogger();
        childLogger.logs = [...this.logs];
        return childLogger;
    }

    clear() {
        this.logs = [];
    }
}

/**
 * Stub implementation for logger context to replace vi.mock()
 */
export class StubLoggerContext {
    private static context: Record<string, any> = {};

    static run<T>(context: any, fn: () => T): T {
        const oldContext = StubLoggerContext.context;
        StubLoggerContext.context = { ...oldContext, ...context };
        try {
            return fn();
        } finally {
            StubLoggerContext.context = oldContext;
        }
    }

    static get(): any {
        return StubLoggerContext.context;
    }

    static update(updates: Record<string, any>) {
        StubLoggerContext.context = { ...StubLoggerContext.context, ...updates };
    }

    static setUser(userId: string, email?: string, role?: string) {
        StubLoggerContext.context.userId = userId;
        if (email) StubLoggerContext.context.userEmail = email;
        if (role) StubLoggerContext.context.userRole = role;
    }

    static setBusinessContext(context: Record<string, any>) {
        StubLoggerContext.context = { ...StubLoggerContext.context, ...context };
    }

    static child(additionalContext: any): any {
        return { ...StubLoggerContext.context, ...additionalContext };
    }

    static clear(...fields: string[]) {
        if (fields.length === 0) {
            StubLoggerContext.context = {};
        } else {
            fields.forEach(field => {
                delete StubLoggerContext.context[field];
            });
        }
    }

    // Legacy instance methods for backward compatibility
    setBusinessContext(context: Record<string, any>) {
        StubLoggerContext.setBusinessContext(context);
    }

    clearBusinessContext() {
        StubLoggerContext.clear();
    }

    update(updates: Record<string, any>) {
        StubLoggerContext.update(updates);
    }

    getContext() {
        return StubLoggerContext.get();
    }

    clear() {
        StubLoggerContext.clear();
    }
}

/**
 * Stub implementation for monitoring/measure to replace vi.mock()
 */
export class StubMeasure {
    public static measurements: Array<{name: string, duration?: number, result?: any}> = [];

    static async measure<T>(type: string, operation: string, fn: () => Promise<T>): Promise<T> {
        const start = Date.now();
        const result = await fn();
        const duration = Date.now() - start;
        StubMeasure.measurements.push({name: `${type}:${operation}`, duration, result});
        return result;
    }

    static async measureDb<T>(operation: string, fn: () => Promise<T>): Promise<T> {
        return StubMeasure.measure('db', operation, fn);
    }

    static async measureTrigger<T>(operation: string, fn: () => Promise<T>): Promise<T> {
        return StubMeasure.measure('trigger', operation, fn);
    }

    static getMeasurements() {
        return [...StubMeasure.measurements];
    }

    static clear() {
        StubMeasure.measurements = [];
    }
}

/**
 * Stub implementation for validation helpers to replace vi.mock()
 */
export class StubExpenseValidation {
    private validationResults = new Map<string, any>();
    private splitResults = new Map<string, any>();
    private validationError: Error | null = null;

    setValidationResult(key: string, result: any) {
        this.validationResults.set(key, result);
    }

    setValidationError(error: Error) {
        this.validationError = error;
    }

    setSplitResult(key: string, result: any) {
        this.splitResults.set(key, result);
    }

    validateCreateExpense(data: any): any {
        if (this.validationError) {
            throw this.validationError;
        }
        const key = JSON.stringify(data);
        return this.validationResults.get(key) || data;
    }

    calculateSplits(amount: number, splitType: string, participants: string[]): any[] {
        const key = `${amount}:${splitType}:${participants.join(',')}`;
        return this.splitResults.get(key) || participants.map((uid: string) => ({
            uid,
            amount: amount / participants.length,
        }));
    }

    static validateCreateExpense(data: any): any {
        return data;
    }

    static calculateSplits(amount: number, splitType: string, participants: string[]): any[] {
        return participants.map((uid: string) => ({
            uid,
            amount: amount / participants.length,
        }));
    }

    clear() {
        this.validationResults.clear();
        this.splitResults.clear();
    }

    static validateExpenseId(id: any): string {
        if (typeof id !== 'string' || !id.trim()) {
            throw new Error('Invalid expense ID');
        }
        return id;
    }

    static validateUpdateExpense(body: any): any {
        return body;
    }
}

/**
 * Stub implementation for optimistic locking to replace vi.mock()
 */
export class StubOptimisticLocking {
    private shouldSucceed = true;
    private versionUpdates = new Map<string, number>();

    setShouldSucceed(succeed: boolean) {
        this.shouldSucceed = succeed;
    }

    setDocumentVersion(docId: string, version: number) {
        this.versionUpdates.set(docId, version);
    }

    async verifyAndUpdate(docRef: any, currentVersion: any, updates: any): Promise<any> {
        if (!this.shouldSucceed) {
            throw new Error('Optimistic locking failure - document was modified');
        }

        const docId = docRef.id || docRef.path;
        const newVersion = this.versionUpdates.get(docId) || (currentVersion + 1);

        return {
            ...updates,
            version: newVersion,
            updatedAt: Timestamp.now(),
        };
    }

    clear() {
        this.shouldSucceed = true;
        this.versionUpdates.clear();
    }
}


/**
 * Stub implementation for CommentStrategyFactory to replace vi.mock()
 */
export class StubCommentStrategyFactory {
    private mockStrategy: any;

    constructor() {
        this.mockStrategy = {
            verifyAccess: vi.fn()
        };
    }

    getStrategy(targetType: string): any {
        return this.mockStrategy;
    }

    setMockStrategy(strategy: any) {
        this.mockStrategy = strategy;
    }

    getMockStrategy() {
        return this.mockStrategy;
    }

    clear() {
        this.mockStrategy.verifyAccess.mockReset();
    }
}

/**
 * Stub implementation for i18n validation to replace vi.mock()
 */
export class StubI18nValidation {
    private translations = new Map<string, string>();
    private errorMessages = new Map<string, string>();

    setTranslation(key: string, value: string) {
        this.translations.set(key, value);
    }

    setErrorMessage(error: string, message: string) {
        this.errorMessages.set(error, message);
    }

    translateJoiError(error: any): string {
        const errorKey = error.details?.[0]?.message || 'Validation error';
        return this.errorMessages.get(errorKey) || errorKey;
    }

    translate(key: string): string {
        return this.translations.get(key) || key;
    }

    translateValidationError(detail: any): string {
        return detail.message || 'Validation error';
    }

    clear() {
        this.translations.clear();
        this.errorMessages.clear();
    }
}

/**
 * Stub implementation for service registration to replace vi.mock()
 */
export class StubServiceRegistration {
    private services = new Map<string, any>();

    registerService(name: string, service: any) {
        this.services.set(name, service);
    }

    getService(name: string): any {
        return this.services.get(name);
    }

    hasService(name: string): boolean {
        return this.services.has(name);
    }

    clear() {
        this.services.clear();
    }
}

/**
 * Clear all shared storage for tests
 */
export function clearSharedStorage() {
    sharedCommentStorage.clear();
}

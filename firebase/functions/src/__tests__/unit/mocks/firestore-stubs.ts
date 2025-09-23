import { Timestamp } from 'firebase-admin/firestore';
import type { UserRecord, UpdateRequest, CreateRequest, GetUsersResult, DecodedIdToken, ListUsersResult, DeleteUsersResult } from 'firebase-admin/auth';
import type { IFirestoreReader } from '../../../services/firestore/IFirestoreReader';
import type { IFirestoreWriter, WriteResult } from '../../../services/firestore/IFirestoreWriter';
import type { IAuthService } from '../../../services/auth/IAuthService';
import type { PolicyDocument, UserDocument, GroupDocument, ExpenseDocument, SettlementDocument } from '../../../schemas';
import type { GroupMemberDocument, CommentTargetType } from '@splitifyd/shared';
import type { UserNotificationDocument } from '../../../schemas/user-notifications';
import type { ParsedShareLink, ParsedComment } from '../../../schemas';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';

// Shared storage for comments between reader and writer
const sharedCommentStorage = new Map<string, any[]>();

/**
 * In-memory stub implementation of IFirestoreReader for unit testing
 * Only implements methods actually used by services being tested
 */
export class StubFirestoreReader implements IFirestoreReader {
    private documents = new Map<string, any>();
    private rawDocuments = new Map<string, any>();

    // Helper methods to set up test data
    setDocument(collection: string, id: string, data: any) {
        this.documents.set(`${collection}/${id}`, data);
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
                ref: { id, path: `policies/${id}` },
                readTime: Timestamp.now(),
                isEqual: (other: any) => other?.id === id,
            });
        }
    }

    // Document Read Operations
    async getUser(userId: string): Promise<UserDocument | null> {
        return this.documents.get(`users/${userId}`) || null;
    }

    async getGroup(groupId: string): Promise<GroupDocument | null> {
        return this.documents.get(`groups/${groupId}`) || null;
    }

    async getExpense(expenseId: string): Promise<ExpenseDocument | null> {
        return this.documents.get(`expenses/${expenseId}`) || null;
    }

    async getSettlement(settlementId: string): Promise<SettlementDocument | null> {
        return this.documents.get(`settlements/${settlementId}`) || null;
    }

    async getPolicy(policyId: string): Promise<PolicyDocument | null> {
        return this.documents.get(`policies/${policyId}`) || null;
    }

    async getAllPolicies(): Promise<PolicyDocument[]> {
        const policies: PolicyDocument[] = [];
        for (const [key, value] of this.documents.entries()) {
            if (key.startsWith('policies/')) {
                policies.push(value);
            }
        }
        return policies;
    }

    // Raw document operations (used by PolicyService)
    async getRawPolicyDocument(policyId: string): Promise<FirebaseFirestore.DocumentSnapshot | null> {
        return this.rawDocuments.get(policyId) || null;
    }

    // Minimal implementations for other required methods
    async getUsersById(): Promise<UserDocument[]> { return []; }
    async getGroupsForUser(): Promise<any> { return { data: [], hasMore: false }; }
    async getGroupsForUserV2(): Promise<any> { return { data: [], hasMore: false }; }
    async getGroupMembers(): Promise<GroupMemberDocument[]> { return []; }
    async getGroupMember(): Promise<GroupMemberDocument | null> { return null; }
    async getAllGroupMembers(): Promise<GroupMemberDocument[]> { return []; }
    async getAllGroupMemberIds(): Promise<String[]> { return []; }
    async getExpensesForGroup(): Promise<ExpenseDocument[]> { return []; }
    async getUserExpenses(): Promise<any> { return { expenses: [], hasMore: false }; }
    async getExpenseHistory(): Promise<any> { return { history: [], count: 0 }; }
    async getExpensesForGroupPaginated(): Promise<any> { return { expenses: [], hasMore: false }; }
    async getSettlementsForGroup(): Promise<SettlementDocument[]> { return []; }
    async getGroupInTransaction(): Promise<GroupDocument | null> { return null; }
    async getUserInTransaction(): Promise<UserDocument | null> { return null; }
    async getMultipleInTransaction(): Promise<any[]> { return []; }
    async documentExists(): Promise<boolean> { return false; }
    async getSystemDocument(): Promise<any | null> { return null; }
    async getHealthCheckDocument(): Promise<any | null> { return null; }
    async getUserNotification(): Promise<UserNotificationDocument | null> { return null; }
    async userNotificationExists(): Promise<boolean> { return false; }
    async findShareLinkByToken(): Promise<any | null> { return null; }
    async getShareLinksForGroup(): Promise<ParsedShareLink[]> { return []; }
    async getShareLink(): Promise<ParsedShareLink | null> { return null; }
    // Helper method for tests to set up comments for a target
    setCommentsForTarget(targetType: CommentTargetType, targetId: string, comments: any[]) {
        sharedCommentStorage.set(`${targetType}:${targetId}`, comments);
    }

    async getCommentsForTarget(targetType: CommentTargetType, targetId: string, options?: any): Promise<any> {
        const comments = sharedCommentStorage.get(`${targetType}:${targetId}`) || [];
        return { comments, hasMore: false, nextCursor: null };
    }
    async getComment(targetType: CommentTargetType, targetId: string, commentId: string): Promise<ParsedComment | null> {
        const comments = sharedCommentStorage.get(`${targetType}:${targetId}`) || [];
        return comments.find(c => c.id === commentId) || null;
    }
    async getCommentByReference(): Promise<ParsedComment | null> { return null; }
    async getAvailableTestUser(): Promise<any | null> { return null; }
    async getTestUser(): Promise<any | null> { return null; }
    async getTestUserPoolStatus(): Promise<any> { return { available: 0, borrowed: 0, total: 0 }; }
    async getBorrowedTestUsers(): Promise<any[]> { return []; }
    async getOldDocuments(): Promise<any[]> { return []; }
    async getOldDocumentsByField(): Promise<any[]> { return []; }
    async getDocumentsBatch(): Promise<any[]> { return []; }
    async getMetricsDocuments(): Promise<any[]> { return []; }
    async getCollectionSize(): Promise<number> { return 0; }
    async getGroupDeletionData(): Promise<any> { return {}; }
    async getDocumentForTesting(collection: string, id: string): Promise<any | null> {
        return this.documents.get(`${collection}/${id}`) || null;
    }
    async verifyDocumentExists(): Promise<boolean> { return false; }
    async getSettlementsForGroupPaginated(): Promise<any> { return { settlements: [], hasMore: false }; }
    async getRawDocumentSnapshot(): Promise<any | null> { return null; }

    // Missing methods from interface
    async getSystemMetrics(): Promise<any | null> { return null; }
    async addSystemMetrics(): Promise<string> { return 'metric-id'; }
    async verifyGroupMembership(): Promise<boolean> { return false; }
    async getSubcollectionDocument(): Promise<any | null> { return null; }
    async searchUsersByEmail(): Promise<any[]> { return []; }
    async searchUsersByName(): Promise<any[]> { return []; }
    async getFirestoreStats(): Promise<any> { return {}; }
    async getDocumentWithRetries(): Promise<any | null> { return null; }
    async streamDocumentChanges(): Promise<any> { return null; }
    async getDocumentVersion(): Promise<any | null> { return null; }
    async validateUserEmailUnique(): Promise<boolean> { return true; }
    async getExpensesByDateRange(): Promise<any[]> { return []; }
    async getSettlementsByDateRange(): Promise<any[]> { return []; }
    async getUserActivityLog(): Promise<any[]> { return []; }
    async getGroupActivityLog(): Promise<any[]> { return []; }
    async getDocumentHistory(): Promise<any[]> { return []; }
    async getBulkDocuments(): Promise<any[]> { return []; }
    async streamCollectionChanges(): Promise<any> { return null; }
    async getDocumentRevisions(): Promise<any[]> { return []; }
    async getTestUsersByStatus(): Promise<any[]> { return []; }
    async getTestUserInTransaction(): Promise<any | null> { return null; }
    async queryWithComplexFilters(): Promise<any[]> { return []; }
    async getUserLanguagePreference(): Promise<string | null> { return null; }
    async findShareLinkByTokenInTransaction(): Promise<any | null> { return null; }
    async getGroupMembershipsInTransaction(): Promise<any> { return { docs: [], size: 0, empty: true }; }
    async getRawDocument(): Promise<any | null> { return null; }
    async getRawDocumentInTransaction(): Promise<any | null> { return null; }
    async getRawDocumentInTransactionWithRef(): Promise<any | null> { return null; }
    async getRawExpenseDocumentInTransaction(): Promise<any | null> { return null; }
    async getRawGroupDocument(): Promise<any | null> { return null; }
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
    async getRawSettlementDocumentInTransaction(): Promise<any | null> { return null; }
    async getRawUserDocumentInTransaction(): Promise<any | null> { return null; }
    async getSystemDocumentInTransaction(): Promise<any | null> { return null; }

    // Legacy methods that might still be called
    async getUserNotifications(): Promise<any> { return null; }
    async getUserNotificationsForGroups(): Promise<any> { return null; }
    async getGroupBalances(): Promise<any> { return null; }
    async getBalanceChangesForUser(): Promise<any> { return null; }
    async getTransactionChangesForUser(): Promise<any> { return null; }
    async getGroupChangesForUser(): Promise<any> { return null; }
    async getSystemStats(): Promise<any> { return null; }
    async getHealthStatus(): Promise<any> { return null; }
    async getCollectionForTesting(): Promise<any> { return null; }
    async getTestUserPool(): Promise<any> { return null; }
    async queryDocumentsByField(): Promise<any> { return null; }
    async queryDocumentsByDateRange(): Promise<any> { return null; }
    async queryDocumentsWithPagination(): Promise<any> { return null; }
    async getDocumentInTransaction(): Promise<any> { return null; }
    async queryDocumentsInTransaction(): Promise<any> { return null; }
    async getMultipleDocumentsInTransaction(): Promise<any> { return null; }
    async validateDocumentExists(): Promise<any> { return null; }
    async validateUserAccess(): Promise<any> { return null; }
    async getExpensesWithFilters(): Promise<any> { return null; }
    async getGroupMembersWithMetadata(): Promise<any> { return null; }
    async getExpenseParticipants(): Promise<any> { return null; }
    async createDocumentListener(): Promise<any> { return null; }
    async createCollectionListener(): Promise<any> { return null; }
    async getMembershipsByUserId(): Promise<any> { return null; }
    async getMembershipByUserAndGroup(): Promise<any> { return null; }
    async queryExpensesByDateRange(): Promise<any> { return null; }
    async querySettlementsByDateRange(): Promise<any> { return null; }
    async queryGroupsByCreatedDate(): Promise<any> { return null; }
    async getShareLinkByCode(): Promise<any> { return null; }
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

    // Policy operations (used by PolicyService)
    async createPolicy(policyId: string, policyData: any): Promise<WriteResult> {
        this.documents.set(`policies/${policyId}`, policyData);
        const result = this.getLastWriteResult() || {
            id: policyId,
            success: true,
            timestamp: Timestamp.now(),
        };
        return result;
    }

    async updatePolicy(policyId: string, updates: any): Promise<WriteResult> {
        const existing = this.documents.get(`policies/${policyId}`);
        if (existing) {
            this.documents.set(`policies/${policyId}`, { ...existing, ...updates });
        }
        const result = this.getLastWriteResult() || {
            id: policyId,
            success: true,
            timestamp: Timestamp.now(),
        };
        return result;
    }

    // Minimal implementations for other required methods
    async createUser(): Promise<WriteResult> { return { id: 'user', success: true, timestamp: Timestamp.now() }; }
    async updateUser(userId: string, updates: any): Promise<WriteResult> {
        // Update the document in memory
        const existing = this.documents.get(`users/${userId}`);
        if (existing) {
            this.documents.set(`users/${userId}`, { ...existing, ...updates });
        }
        return { id: userId, success: true, timestamp: Timestamp.now() };
    }
    async deleteUser(): Promise<WriteResult> { return { id: 'user', success: true, timestamp: Timestamp.now() }; }
    async createGroup(): Promise<WriteResult> { return { id: 'group', success: true, timestamp: Timestamp.now() }; }
    async updateGroup(): Promise<WriteResult> { return { id: 'group', success: true, timestamp: Timestamp.now() }; }
    async deleteGroup(): Promise<WriteResult> { return { id: 'group', success: true, timestamp: Timestamp.now() }; }
    async createExpense(): Promise<WriteResult> { return { id: 'expense', success: true, timestamp: Timestamp.now() }; }
    async updateExpense(): Promise<WriteResult> { return { id: 'expense', success: true, timestamp: Timestamp.now() }; }
    async deleteExpense(): Promise<WriteResult> { return { id: 'expense', success: true, timestamp: Timestamp.now() }; }
    async createSettlement(): Promise<WriteResult> { return { id: 'settlement', success: true, timestamp: Timestamp.now() }; }
    async updateSettlement(): Promise<WriteResult> { return { id: 'settlement', success: true, timestamp: Timestamp.now() }; }
    async deleteSettlement(): Promise<WriteResult> { return { id: 'settlement', success: true, timestamp: Timestamp.now() }; }
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
    async updateComment(): Promise<WriteResult> { return { id: 'comment', success: true, timestamp: Timestamp.now() }; }
    async deleteComment(): Promise<WriteResult> { return { id: 'comment', success: true, timestamp: Timestamp.now() }; }
    async batchWrite(): Promise<any> { return { successCount: 0, failureCount: 0, results: [] }; }
    async bulkCreate(): Promise<any> { return { successCount: 0, failureCount: 0, results: [] }; }
    async bulkUpdate(): Promise<any> { return { successCount: 0, failureCount: 0, results: [] }; }
    async bulkDelete(): Promise<any> { return { successCount: 0, failureCount: 0, results: [] }; }
    createShareLinkInTransaction(): any { return { id: 'link', path: 'shareLinks/link' }; }
    async updateGroupInTransaction(): Promise<WriteResult> { return { id: 'group', success: true, timestamp: Timestamp.now() }; }
    async updateUserNotifications(): Promise<WriteResult> { return { id: 'notification', success: true, timestamp: Timestamp.now() }; }
    async setUserNotifications(): Promise<WriteResult> { return { id: 'notification', success: true, timestamp: Timestamp.now() }; }
    async createUserNotification(): Promise<WriteResult> { return { id: 'notification', success: true, timestamp: Timestamp.now() }; }
    async updateUserNotification(): Promise<WriteResult> { return { id: 'notification', success: true, timestamp: Timestamp.now() }; }
    async setUserNotificationGroup(): Promise<WriteResult> { return { id: 'notification', success: true, timestamp: Timestamp.now() }; }
    async removeUserNotificationGroup(): Promise<WriteResult> { return { id: 'notification', success: true, timestamp: Timestamp.now() }; }
    async setUserNotificationGroupInTransaction(): Promise<WriteResult> { return { id: 'notification', success: true, timestamp: Timestamp.now() }; }
    async runTransaction(transactionFn: (transaction: any) => Promise<any>): Promise<any> {
        const mockTransaction = {};
        return await transactionFn(mockTransaction);
    }
    createInTransaction(transaction: any, collection: string, documentId: string | null, data: any): any {
        const id = documentId || this.generateDocumentId();
        return { id, path: `${collection}/${id}` };
    }
    async updateInTransaction(): Promise<WriteResult> { return { id: 'doc', success: true, timestamp: Timestamp.now() }; }
    async deleteInTransaction(): Promise<WriteResult> { return { id: 'doc', success: true, timestamp: Timestamp.now() }; }
    async createDocument(): Promise<WriteResult> { return { id: 'doc', success: true, timestamp: Timestamp.now() }; }
    async updateDocument(): Promise<WriteResult> { return { id: 'doc', success: true, timestamp: Timestamp.now() }; }
    async deleteDocument(): Promise<WriteResult> { return { id: 'doc', success: true, timestamp: Timestamp.now() }; }
    generateDocumentId(): string { return 'generated-id'; }
    async addSystemMetrics(): Promise<WriteResult> { return { id: 'metrics', success: true, timestamp: Timestamp.now() }; }
    async performHealthCheck(): Promise<{ success: boolean; responseTime: number }> { return { success: true, responseTime: 50 }; }
    async createTestUser(): Promise<WriteResult> { return { id: 'test-user', success: true, timestamp: Timestamp.now() }; }
    async updateTestUserStatus(): Promise<WriteResult> { return { id: 'test-user', success: true, timestamp: Timestamp.now() }; }
    async bulkDeleteInTransaction(): Promise<any> { return { successCount: 0, failureCount: 0, results: [] }; }
    async queryAndUpdateInTransaction(): Promise<any> { return { successCount: 0, failureCount: 0, results: [] }; }
    batchCreateInTransaction(): any[] { return []; }
    async getMultipleByPathsInTransaction(): Promise<any> { return []; }
    getDocumentReferenceInTransaction(): any { return { id: 'doc', path: 'collection/doc' }; }
    async queryGroupsByDeletionStatus(): Promise<any> { return []; }
    async getSingleDocument(): Promise<any> { return null; }
    async deleteMemberAndNotifications(): Promise<any> { return { successCount: 1, failureCount: 0, results: [] }; }
    async leaveGroupAtomic(): Promise<any> { return { successCount: 1, failureCount: 0, results: [] }; }
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

    setCustomToken(uid: string, token: string) {
        this.customTokens.set(uid, token);
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
        const allUsers = Array.from(this.users.values()).filter(user => !this.deletedUsers.has(user.uid));
        const limit = maxResults || 1000;
        const start = pageToken ? parseInt(pageToken, 10) : 0;
        const users = allUsers.slice(start, start + limit);

        return {
            users,
            pageToken: (start + limit < allUsers.length) ? (start + limit).toString() : undefined,
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

export function createMockWriteResult(id: string): WriteResult {
    return {
        id,
        success: true,
        timestamp: Timestamp.now(),
    };
}

export function createMockWriteResultFailure(id: string, error: string): WriteResult {
    return {
        id,
        success: false,
        error,
    };
}

/**
 * Clear all shared storage for tests
 */
export function clearSharedStorage() {
    sharedCommentStorage.clear();
}
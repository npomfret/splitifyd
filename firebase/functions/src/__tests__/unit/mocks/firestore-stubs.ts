import { Timestamp } from 'firebase-admin/firestore';
import type { IFirestoreReader } from '../../../services/firestore/IFirestoreReader';
import type { IFirestoreWriter, WriteResult } from '../../../services/firestore/IFirestoreWriter';
import type { PolicyDocument, UserDocument, GroupDocument, ExpenseDocument, SettlementDocument } from '../../../schemas';
import type { GroupMemberDocument, CommentTargetType } from '@splitifyd/shared';
import type { UserNotificationDocument } from '../../../schemas/user-notifications';
import type { ParsedShareLink, ParsedComment } from '../../../schemas';

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
    async getCommentsForTarget(): Promise<any> { return { comments: [], hasMore: false }; }
    async getComment(): Promise<ParsedComment | null> { return null; }
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
    async getDocumentForTesting(): Promise<any | null> { return null; }
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
    async getRawGroupDocumentInTransaction(): Promise<any | null> { return null; }
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
    async updateUser(): Promise<WriteResult> { return { id: 'user', success: true, timestamp: Timestamp.now() }; }
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
    async addComment(): Promise<WriteResult> { return { id: 'comment', success: true, timestamp: Timestamp.now() }; }
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
    async runTransaction(): Promise<any> { return null; }
    createInTransaction(): any { return { id: 'doc', path: 'collection/doc' }; }
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
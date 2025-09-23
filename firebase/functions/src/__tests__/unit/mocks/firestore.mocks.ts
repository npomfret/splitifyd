import { vi } from 'vitest';
import type { IFirestoreReader } from '../../../services/firestore';
import type { IFirestoreWriter, WriteResult } from '../../../services/firestore/IFirestoreWriter';
import type { PolicyDocument } from '../../../schemas';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Creates a mock IFirestoreReader with all methods stubbed
 */
export function createMockFirestoreReader(): IFirestoreReader {
    const mockMethods = {
        // Document operations
        getUser: vi.fn(),
        getGroup: vi.fn(),
        getExpense: vi.fn(),
        getSettlement: vi.fn(),
        getPolicy: vi.fn(),
        getAllPolicies: vi.fn(),

        // Collection operations - User-related
        getUsersById: vi.fn(),

        // Collection operations - Group-related
        getGroupsForUser: vi.fn(),
        getGroupsForUserV2: vi.fn(),
        getGroupMembers: vi.fn(),
        getGroupMember: vi.fn(),
        getAllGroupMembers: vi.fn(),
        getAllGroupMemberIds: vi.fn(),

        // Collection operations - Expense-related
        getExpensesForGroup: vi.fn(),
        getUserExpenses: vi.fn(),
        getExpenseHistory: vi.fn(),
        getExpensesForGroupPaginated: vi.fn(),

        // Collection operations - Settlement-related
        getSettlementsForGroup: vi.fn(),

        // Transaction-aware operations
        getGroupInTransaction: vi.fn(),
        getUserInTransaction: vi.fn(),
        getMultipleInTransaction: vi.fn(),

        // Utility operations
        documentExists: vi.fn(),
        getSystemDocument: vi.fn(),
        getHealthCheckDocument: vi.fn(),

        // User Notification operations
        getUserNotification: vi.fn(),
        userNotificationExists: vi.fn(),

        // Share Link operations
        findShareLinkByToken: vi.fn(),
        getShareLinksForGroup: vi.fn(),
        getShareLink: vi.fn(),

        // Comment operations
        getCommentsForTarget: vi.fn(),
        getComment: vi.fn(),
        getCommentByReference: vi.fn(),

        // Test User Pool operations
        getAvailableTestUser: vi.fn(),
        getTestUser: vi.fn(),
        getTestUserPoolStatus: vi.fn(),
        getBorrowedTestUsers: vi.fn(),

        // System Metrics operations
        getOldDocuments: vi.fn(),
        getOldDocumentsByField: vi.fn(),
        getDocumentsBatch: vi.fn(),
        getMetricsDocuments: vi.fn(),
        getCollectionSize: vi.fn(),

        // Group Related Collections operations
        getGroupDeletionData: vi.fn(),

        // Test and Development operations
        getDocumentForTesting: vi.fn(),
        verifyDocumentExists: vi.fn(),

        // Settlement Query operations
        getSettlementsForGroupPaginated: vi.fn(),

        // Raw document operations (additional methods that might be used)
        getRawPolicyDocument: vi.fn(),
        getRawDocumentSnapshot: vi.fn(),

        // Additional operations that may exist in actual implementation
        getUserNotifications: vi.fn(),
        getUserNotificationsForGroups: vi.fn(),
        getGroupBalances: vi.fn(),
        getBalanceChangesForUser: vi.fn(),
        getTransactionChangesForUser: vi.fn(),
        getGroupChangesForUser: vi.fn(),
        getSystemStats: vi.fn(),
        getHealthStatus: vi.fn(),
        getCollectionForTesting: vi.fn(),
        getTestUserPool: vi.fn(),
        queryDocumentsByField: vi.fn(),
        queryDocumentsByDateRange: vi.fn(),
        queryDocumentsWithPagination: vi.fn(),
        getDocumentInTransaction: vi.fn(),
        queryDocumentsInTransaction: vi.fn(),
        getMultipleDocumentsInTransaction: vi.fn(),
        validateDocumentExists: vi.fn(),
        validateUserAccess: vi.fn(),
        getExpensesWithFilters: vi.fn(),
        getGroupMembersWithMetadata: vi.fn(),
        getExpenseParticipants: vi.fn(),
        createDocumentListener: vi.fn(),
        createCollectionListener: vi.fn(),
        getMembershipsByUserId: vi.fn(),
        getMembershipByUserAndGroup: vi.fn(),
        queryExpensesByDateRange: vi.fn(),
        querySettlementsByDateRange: vi.fn(),
        queryGroupsByCreatedDate: vi.fn(),
        getShareLinkByCode: vi.fn(),

        // Missing methods from interface
        getSystemMetrics: vi.fn(),
        addSystemMetrics: vi.fn(),
        verifyGroupMembership: vi.fn(),
        getSubcollectionDocument: vi.fn(),
        searchUsersByEmail: vi.fn(),
        searchUsersByName: vi.fn(),
        getFirestoreStats: vi.fn(),
        getDocumentWithRetries: vi.fn(),
        streamDocumentChanges: vi.fn(),
        getDocumentVersion: vi.fn(),
        validateUserEmailUnique: vi.fn(),
        getExpensesByDateRange: vi.fn(),
        getSettlementsByDateRange: vi.fn(),
        getUserActivityLog: vi.fn(),
        getGroupActivityLog: vi.fn(),
        getDocumentHistory: vi.fn(),
        getBulkDocuments: vi.fn(),
        streamCollectionChanges: vi.fn(),
        getDocumentRevisions: vi.fn(),
        getTestUsersByStatus: vi.fn(),
        getTestUserInTransaction: vi.fn(),
        queryWithComplexFilters: vi.fn(),
        getUserLanguagePreference: vi.fn(),
        findShareLinkByTokenInTransaction: vi.fn(),
        getGroupMembershipsInTransaction: vi.fn(),
        getRawDocument: vi.fn(),
        getRawDocumentInTransaction: vi.fn(),
        getRawDocumentInTransactionWithRef: vi.fn(),
        getRawExpenseDocumentInTransaction: vi.fn(),
        getRawGroupDocument: vi.fn(),
        getRawGroupDocumentInTransaction: vi.fn(),
        getRawSettlementDocumentInTransaction: vi.fn(),
        getRawUserDocumentInTransaction: vi.fn(),
        getSystemDocumentInTransaction: vi.fn(),
    };

    // Use satisfies to ensure type compatibility while allowing extra methods
    return mockMethods as IFirestoreReader;
}

/**
 * Creates a mock IFirestoreWriter with all methods stubbed
 */
export function createMockFirestoreWriter(): IFirestoreWriter {
    return {
        // User operations
        createUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),

        // Group operations
        createGroup: vi.fn(),
        updateGroup: vi.fn(),
        deleteGroup: vi.fn(),

        // Expense operations
        createExpense: vi.fn(),
        updateExpense: vi.fn(),
        deleteExpense: vi.fn(),

        // Settlement operations
        createSettlement: vi.fn(),
        updateSettlement: vi.fn(),
        deleteSettlement: vi.fn(),

        // Comment operations
        addComment: vi.fn(),
        updateComment: vi.fn(),
        deleteComment: vi.fn(),

        // Batch operations
        batchWrite: vi.fn(),
        bulkCreate: vi.fn(),
        bulkUpdate: vi.fn(),
        bulkDelete: vi.fn(),

        // Share link operations
        createShareLinkInTransaction: vi.fn(),

        // Member operations
        updateGroupInTransaction: vi.fn(),

        // Notification operations
        updateUserNotifications: vi.fn(),
        setUserNotifications: vi.fn(),
        createUserNotification: vi.fn(),
        updateUserNotification: vi.fn(),
        setUserNotificationGroup: vi.fn(),
        removeUserNotificationGroup: vi.fn(),
        setUserNotificationGroupInTransaction: vi.fn(),

        // Policy operations
        createPolicy: vi.fn(),
        updatePolicy: vi.fn(),

        // Transaction operations
        runTransaction: vi.fn(),
        createInTransaction: vi.fn(),
        updateInTransaction: vi.fn(),
        deleteInTransaction: vi.fn(),

        // Generic operations
        createDocument: vi.fn(),
        updateDocument: vi.fn(),
        deleteDocument: vi.fn(),
        generateDocumentId: vi.fn(),

        // System operations
        addSystemMetrics: vi.fn(),
        performHealthCheck: vi.fn(),

        // Test operations
        createTestUser: vi.fn(),
        updateTestUserStatus: vi.fn(),

        // Transaction helpers
        bulkDeleteInTransaction: vi.fn(),
        queryAndUpdateInTransaction: vi.fn(),
        batchCreateInTransaction: vi.fn(),
        getMultipleByPathsInTransaction: vi.fn(),
        getDocumentReferenceInTransaction: vi.fn(),
        queryGroupsByDeletionStatus: vi.fn(),
        getSingleDocument: vi.fn(),
        deleteMemberAndNotifications: vi.fn(),
        leaveGroupAtomic: vi.fn(),
    } as IFirestoreWriter;
}

/**
 * Helper function to create a successful WriteResult
 */
export function createMockWriteResult(id: string): WriteResult {
    return {
        id,
        success: true,
        timestamp: Timestamp.now(),
    };
}

/**
 * Helper function to create a failed WriteResult
 */
export function createMockWriteResultFailure(id: string, error: string): WriteResult {
    return {
        id,
        success: false,
        error,
    };
}

/**
 * Creates a mock PolicyDocument for testing
 */
export function createMockPolicyDocument(overrides: Partial<PolicyDocument> = {}): PolicyDocument {
    const defaultHash = 'default-hash-123';
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
 * Creates a mock Firestore document snapshot
 */
export function createMockDocumentSnapshot(data: any, id: string, exists = true) {
    const now = Timestamp.now();
    return {
        id,
        exists,
        data: () => (exists ? data : undefined),
        get: (field: string) => (exists ? data[field] : undefined),
        ref: {
            id,
            path: `collection/${id}`,
        },
        readTime: now,
        isEqual: (other: any) => other?.id === id,
    };
}
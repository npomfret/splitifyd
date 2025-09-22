import { vi } from 'vitest';
import type { IFirestoreReader } from '../../../services/firestore/IFirestoreReader';
import type { IFirestoreWriter, WriteResult } from '../../../services/firestore/IFirestoreWriter';
import type { PolicyDocument } from '../../../schemas';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Creates a mock IFirestoreReader with all methods stubbed
 */
export function createMockFirestoreReader(): IFirestoreReader {
    return {
        // Document operations
        getUser: vi.fn(),
        getGroup: vi.fn(),
        getExpense: vi.fn(),
        getSettlement: vi.fn(),
        getPolicy: vi.fn(),
        getAllPolicies: vi.fn(),

        // Collection operations
        getUsersById: vi.fn(),
        getGroupsForUser: vi.fn(),
        getGroupsForUserV2: vi.fn(),
        getExpensesForGroup: vi.fn(),
        getSettlementsForGroup: vi.fn(),
        getCommentsForTarget: vi.fn(),

        // Member operations
        getGroupMembers: vi.fn(),
        getGroupMember: vi.fn(),
        getMembershipsByUserId: vi.fn(),
        getMembershipByUserAndGroup: vi.fn(),

        // Query operations
        queryExpensesByDateRange: vi.fn(),
        querySettlementsByDateRange: vi.fn(),
        queryGroupsByCreatedDate: vi.fn(),

        // Share link operations
        getShareLinksForGroup: vi.fn(),
        getShareLinkByCode: vi.fn(),

        // Notification operations
        getUserNotifications: vi.fn(),
        getUserNotificationsForGroups: vi.fn(),

        // Balance operations
        getGroupBalances: vi.fn(),
        getBalanceChangesForUser: vi.fn(),

        // Transaction operations
        getTransactionChangesForUser: vi.fn(),
        getGroupChangesForUser: vi.fn(),

        // System operations
        getSystemStats: vi.fn(),
        getHealthStatus: vi.fn(),

        // Test operations
        getDocumentForTesting: vi.fn(),
        getCollectionForTesting: vi.fn(),
        getTestUserPool: vi.fn(),

        // Advanced query operations
        queryDocumentsByField: vi.fn(),
        queryDocumentsByDateRange: vi.fn(),
        queryDocumentsWithPagination: vi.fn(),

        // Raw document operations
        getRawPolicyDocument: vi.fn(),
        getRawDocumentSnapshot: vi.fn(),

        // Transaction operations
        getDocumentInTransaction: vi.fn(),
        queryDocumentsInTransaction: vi.fn(),
        getMultipleDocumentsInTransaction: vi.fn(),

        // Validation operations
        validateDocumentExists: vi.fn(),
        validateUserAccess: vi.fn(),

        // Complex query operations
        getExpensesWithFilters: vi.fn(),
        getGroupMembersWithMetadata: vi.fn(),
        getExpenseParticipants: vi.fn(),

        // Real-time operations
        createDocumentListener: vi.fn(),
        createCollectionListener: vi.fn(),
    } as IFirestoreReader;
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
                versionHash: defaultHash,
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
    return {
        id,
        exists,
        data: () => (exists ? data : undefined),
        get: (field: string) => (exists ? data[field] : undefined),
        ref: {
            id,
            path: `collection/${id}`,
        },
    };
}
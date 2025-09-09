import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupService } from '../../services/GroupService';
import { MockFirestoreReader } from '../test-utils/MockFirestoreReader';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreGroupBuilder, FirestoreExpenseBuilder } from '@splitifyd/test-support';

// Mock dependencies

vi.mock('../../utils/performance-monitor', () => ({
    PerformanceMonitor: {
        monitorServiceCall: vi.fn((service, method, fn) => fn()),
        monitorBatchOperation: vi.fn((operation, fn) => fn(() => {})),
    },
}));

vi.mock('../../utils/logger-context', () => ({
    LoggerContext: {
        update: vi.fn(),
        get: vi.fn(() => ({ userId: 'test-user' })),
        setBusinessContext: vi.fn(),
    },
}));

vi.mock('../../../src/services/serviceRegistration', () => ({
    getGroupMemberService: vi.fn(() => ({
        createMemberSubcollection: vi.fn(),
        getGroupMembersResponse: vi.fn(() => ({ members: [] })),
    })),
    getUserService: vi.fn(() => ({
        getUsers: vi.fn((userIds) => {
            const userMap = new Map();
            // Mock a user for the test
            userMap.set('test-user-123', {
                uid: 'test-user-123',
                email: 'test@example.com',
                displayName: 'Test User',
            });
            return Promise.resolve(userMap);
        }),
    })),
    getExpenseService: vi.fn(() => ({
        listGroupExpenses: vi.fn(),
    })),
    getSettlementService: vi.fn(() => ({
        _getGroupSettlementsData: vi.fn(),
    })),
}));

vi.mock('../../services/balance/BalanceCalculationService', () => ({
    BalanceCalculationService: vi.fn(() => ({
        calculateGroupBalances: vi.fn((groupId) => Promise.resolve({
            groupId: groupId,
            balancesByCurrency: {},
            userBalances: {},
            simplifiedDebts: [],
            lastUpdated: Timestamp.now(),
        })),
    })),
}));

vi.mock('../../services/serviceRegistration', () => ({
    getExpenseMetadataService: vi.fn(() => ({
        calculateExpenseMetadata: vi.fn(() => Promise.resolve({
            expenseCount: 0,
            lastExpenseTime: undefined,
        })),
    })),
    getUserService: vi.fn(() => ({
        getUsers: vi.fn((userIds: string[]) => Promise.resolve(new Map(
            userIds.map((id: string) => [id, { uid: id, displayName: 'Test User', email: 'test@example.com' }])
        )))
    })),
    getGroupMemberService: vi.fn(() => ({
        getMembersFromSubcollection: vi.fn(() => Promise.resolve([]))
    })),
    getSettlementService: vi.fn(() => ({
        _getGroupSettlementsData: vi.fn(() => Promise.resolve({ settlements: [], hasMore: false }))
    })),
    getExpenseService: vi.fn(() => ({
        _getGroupExpensesData: vi.fn(() => Promise.resolve({ expenses: [], hasMore: false }))
    })),
}));

vi.mock('../../utils/groupHelpers', () => ({
    isGroupOwner: vi.fn(() => true),
    isGroupMember: vi.fn(() => true),
    isGroupOwnerAsync: vi.fn(() => Promise.resolve(true)),
    isGroupMemberAsync: vi.fn(() => Promise.resolve(true)),
    getThemeColorForMember: vi.fn(() => ({ light: '#FF6B6B' })),
}));

vi.mock('../../user-management/assign-theme-color', () => ({
    assignThemeColor: vi.fn(() => Promise.resolve('#FF6B6B')),
}));

describe('GroupService - Unit Tests', () => {
    let groupService: GroupService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockFirestoreWriter: any;
    let mockServiceProvider: any;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockFirestoreWriter = {
            runTransaction: vi.fn(),
            bulkDelete: vi.fn(),
            createInTransaction: vi.fn(),
            updateInTransaction: vi.fn(),
            deleteInTransaction: vi.fn()
        };
        mockServiceProvider = {
            getUserProfiles: vi.fn(),
            getGroupMembers: vi.fn(),
            getGroupMember: vi.fn(),
            getMembersFromSubcollection: vi.fn(),
            listGroupExpenses: vi.fn(),
            getExpenseMetadata: vi.fn(),
            getGroupSettlementsData: vi.fn(),
            runTransaction: vi.fn()
        };
        groupService = new GroupService(mockFirestoreReader, mockFirestoreWriter, mockServiceProvider);

        // Reset all mocks
        vi.clearAllMocks();
        mockFirestoreReader.resetAllMocks();
        
        // Set up default mock implementations after clearing
        mockFirestoreWriter.bulkDelete.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            results: [{ id: 'test-group-123', success: true }]
        });
        
        // Default mock for ExpenseMetadataService dependency
        mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);
    });

    describe('fetchGroupWithAccess', () => {
        it('should return group data when group exists and user has access', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            const mockGroupData = new FirestoreGroupBuilder()
                .withId(groupId)
                .withName('Test Group')
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);

            // Access the private method via type assertion
            const result = await (groupService as any).fetchGroupWithAccess(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(result.group).toBeDefined();
            expect(result.group.id).toBe(groupId);
            expect(result.group.name).toBe('Test Group');
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const groupId = 'nonexistent-group';
            const userId = 'test-user-123';

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                (groupService as any).fetchGroupWithAccess(groupId, userId)
            ).rejects.toThrow('Group not found');
        });
    });

    describe('deleteGroup', () => {
        it('should delete group when no expenses exist', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData = new FirestoreGroupBuilder()
                .withId(groupId)
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            
            // Mock the getGroupDeletionData method with empty QuerySnapshot-like objects
            const mockEmptyQuerySnapshot = {
                size: 0,
                docs: [],
                forEach: vi.fn(),
                empty: true
            } as any;

            mockFirestoreReader.getGroupDeletionData.mockResolvedValue({
                expenses: mockEmptyQuerySnapshot,
                settlements: mockEmptyQuerySnapshot,
                transactionChanges: mockEmptyQuerySnapshot,
                balanceChanges: mockEmptyQuerySnapshot,
                shareLinks: mockEmptyQuerySnapshot,
                groupComments: mockEmptyQuerySnapshot,
                expenseComments: []
            });

            const result = await groupService.deleteGroup(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getGroupDeletionData).toHaveBeenCalledWith(groupId);
            expect(result.message).toBe('Group and all associated data deleted permanently');
        });

        it('should successfully delete group with expenses (hard delete)', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData = new FirestoreGroupBuilder()
                .withId(groupId)
                .build();

            const mockExpense = new FirestoreExpenseBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withCreatedBy(userId)
                .withPaidBy(userId)
                .withAmount(100)
                .withCurrency('USD')
                .withDescription('Test Expense')
                .withCategory('general')
                .withSplitType('equal')
                .withParticipants([userId])
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            
            // Mock the getGroupDeletionData method with QuerySnapshot containing expense
            const mockExpenseQuerySnapshot = {
                size: 1,
                docs: [{
                    ref: { path: 'expenses/expense-1' },
                    id: 'expense-1',
                    data: () => mockExpense
                }],
                forEach: vi.fn(),
                empty: false
            } as any;

            const mockEmptyQuerySnapshot = {
                size: 0,
                docs: [],
                forEach: vi.fn(),
                empty: true
            } as any;

            mockFirestoreReader.getGroupDeletionData.mockResolvedValue({
                expenses: mockExpenseQuerySnapshot,
                settlements: mockEmptyQuerySnapshot,
                transactionChanges: mockEmptyQuerySnapshot,
                balanceChanges: mockEmptyQuerySnapshot,
                shareLinks: mockEmptyQuerySnapshot,
                groupComments: mockEmptyQuerySnapshot,
                expenseComments: []
            });

            const result = await groupService.deleteGroup(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getGroupDeletionData).toHaveBeenCalledWith(groupId);
            expect(result.message).toBe('Group and all associated data deleted permanently');
        });
    });

    describe('getGroupBalances', () => {
        it('should return group balances for valid group and user', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData = new FirestoreGroupBuilder()
                .withId(groupId)
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            
            // Mock getUserProfiles to return a Map with the user
            const mockUserProfile = { uid: userId, email: 'test@example.com', displayName: 'Test User' };
            const userProfilesMap = new Map([[userId, mockUserProfile]]);
            mockServiceProvider.getUserProfiles.mockResolvedValue(userProfilesMap);

            const result = await groupService.getGroupBalances(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(result.groupId).toBe(groupId);
            expect(result).toHaveProperty('userBalances');
            expect(result).toHaveProperty('simplifiedDebts');
            expect(result).toHaveProperty('lastUpdated');
            expect(result).toHaveProperty('balancesByCurrency');
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const groupId = 'nonexistent-group';
            const userId = 'test-user-123';

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                groupService.getGroupBalances(groupId, userId)
            ).rejects.toThrow('Group not found');
        });
    });

    describe('batchFetchGroupData', () => {
        it('should return empty maps for empty group list', async () => {
            const result = await (groupService as any).batchFetchGroupData([]);

            expect(result.expensesByGroup.size).toBe(0);
            expect(result.settlementsByGroup.size).toBe(0);
            expect(result.expenseMetadataByGroup.size).toBe(0);
        });

        it('should batch fetch expenses and settlements for multiple groups', async () => {
            const groupIds = ['group1', 'group2'];
            
            const mockExpense1 = new FirestoreExpenseBuilder()
                .withId('expense-1')
                .withGroupId('group1')
                .withCreatedBy('user1')
                .withPaidBy('user1')
                .withAmount(100)
                .withCurrency('USD')
                .withDescription('Test Expense 1')
                .withCategory('general')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .build();

            mockFirestoreReader.getExpensesForGroup
                .mockResolvedValueOnce([mockExpense1])
                .mockResolvedValueOnce([]);

            mockFirestoreReader.getSettlementsForGroup
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = await (groupService as any).batchFetchGroupData(groupIds);

            expect(mockFirestoreReader.getExpensesForGroup).toHaveBeenCalledTimes(2);
            expect(mockFirestoreReader.getSettlementsForGroup).toHaveBeenCalledTimes(2);
            expect(result.expensesByGroup.has('group1')).toBe(true);
            expect(result.expensesByGroup.get('group1')).toHaveLength(1);
            expect(result.expenseMetadataByGroup.has('group1')).toBe(true);
            expect(result.expenseMetadataByGroup.get('group1')?.count).toBe(1);
        });
    });
});
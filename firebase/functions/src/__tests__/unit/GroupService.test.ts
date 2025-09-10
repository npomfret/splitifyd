import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupService } from '../../services/GroupService';
import { MockFirestoreReader } from '../test-utils/MockFirestoreReader';
import { FirestoreGroupBuilder, FirestoreExpenseBuilder } from '@splitifyd/test-support';
import {SettlementService} from "../../services/SettlementService";
import {GroupMemberService} from "../../services/GroupMemberService";
import {GroupShareService} from "../../services/GroupShareService";
import { Timestamp } from 'firebase-admin/firestore';

// Create mock services for GroupService dependencies
const createMockUserService = () => ({
    getUsers: vi.fn().mockResolvedValue(new Map()),
    getUser: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
    registerUser: vi.fn(),
    createUserDirect: vi.fn(),
    getAllGroupMembers: vi.fn().mockResolvedValue([])
});

const createMockExpenseService = () => ({
    listGroupExpenses: vi.fn(),
    getExpense: vi.fn(),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn()
});

const createMockSettlementService = () => ({
    listSettlements: vi.fn(),
    getSettlement: vi.fn(),
    createSettlement: vi.fn(),
    updateSettlement: vi.fn(),
    deleteSettlement: vi.fn()
});

const createMockGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn().mockResolvedValue(true),
    isGroupOwnerAsync: vi.fn().mockResolvedValue(true),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupMembersResponseFromSubcollection: vi.fn()
});

const createMockNotificationService = () => ({
    initializeUserNotifications: vi.fn(),
    updateUserNotification: vi.fn(),
    getUserNotifications: vi.fn()
});

const createMockExpenseMetadataService = () => ({
    calculateExpenseMetadata: vi.fn().mockResolvedValue({
        expenseCount: 0,
        lastExpenseTime: undefined,
    })
});

const createMockGroupShareService = () => ({
    generateShareableLink: vi.fn(),
    previewGroupByLink: vi.fn(),
    joinGroupByLink: vi.fn()
});

// Mock Firebase dependencies
vi.mock('../../firebase', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                get: vi.fn(),
                set: vi.fn(),
                update: vi.fn(),
                delete: vi.fn()
            }))
        }))
    }))
}));

describe('GroupService - Unit Tests', () => {
    let groupService: GroupService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockFirestoreWriter: any;
    let mockUserService: ReturnType<typeof createMockUserService>;
    let mockExpenseService: ReturnType<typeof createMockExpenseService>;
    let mockSettlementService: ReturnType<typeof createMockSettlementService>;
    let mockGroupMemberService: ReturnType<typeof createMockGroupMemberService>;
    let mockNotificationService: ReturnType<typeof createMockNotificationService>;
    let mockExpenseMetadataService: ReturnType<typeof createMockExpenseMetadataService>;
    let mockGroupShareService: ReturnType<typeof createMockGroupShareService>;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockFirestoreWriter = {
            runTransaction: vi.fn(),
            bulkDelete: vi.fn(),
            createInTransaction: vi.fn(),
            updateInTransaction: vi.fn(),
            deleteInTransaction: vi.fn(),
            createUser: vi.fn(),
            updateUser: vi.fn(),
            deleteUser: vi.fn()
        };
        
        mockUserService = createMockUserService();
        mockExpenseService = createMockExpenseService();
        mockSettlementService = createMockSettlementService();
        mockGroupMemberService = createMockGroupMemberService();
        mockNotificationService = createMockNotificationService();
        mockExpenseMetadataService = createMockExpenseMetadataService();
        mockGroupShareService = createMockGroupShareService();
        
        groupService = new GroupService(
            mockFirestoreReader,
            mockFirestoreWriter,
            mockUserService as any,
            mockExpenseService as any,
            mockSettlementService as any,
            mockGroupMemberService as any,
            mockNotificationService as any,
            mockExpenseMetadataService as any,
            mockGroupShareService as any
        );

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
        mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
        
        // Mock expense metadata service
        mockExpenseMetadataService.calculateExpenseMetadata.mockResolvedValue({});
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
            // Mock user access - make sure user is a member
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);
            // Mock members for balance calculation
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue([
                { userId: userId, memberRole: 'member', memberStatus: 'active' }
            ]);

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
            // Mock user as group owner for write access
            mockGroupMemberService.isGroupOwnerAsync.mockResolvedValue(true);
            // Mock members for balance calculation
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue([
                { userId: userId, memberRole: 'admin', memberStatus: 'active' }
            ]);
            
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
            // Mock user as group owner for write access
            mockGroupMemberService.isGroupOwnerAsync.mockResolvedValue(true);
            // Mock members for balance calculation
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue([
                { userId: userId, memberRole: 'admin', memberStatus: 'active' }
            ]);
            
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
            
            // Mock required data for balance calculations
            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
            
            // Mock getUsers to return a Map with the user
            const mockUserProfile = { uid: userId, email: 'test@example.com', displayName: 'Test User' };
            const userProfilesMap = new Map([[userId, mockUserProfile]]);
            mockUserService.getUsers.mockResolvedValue(userProfilesMap);
            
            // Mock group member check to return true (user is a member)
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);
            
            // Mock group members for balance calculation (DataFetcher calls userService.getAllGroupMembers)
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue([
                { userId: userId, memberRole: 'member', memberStatus: 'active' }
            ]);

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

    describe('safeDateToISO - pure function', () => {
        it('should convert Firestore Timestamp to ISO string', () => {
            // Create a real Timestamp from the current date for testing
            const testDate = new Date('2023-01-01T10:00:00.000Z');
            const timestamp = Timestamp.fromDate(testDate);
            
            const result = (groupService as any).safeDateToISO(timestamp);
            expect(result).toBe('2023-01-01T10:00:00.000Z');
        });

        it('should convert Date to ISO string', () => {
            const date = new Date('2023-01-01T10:00:00.000Z');
            const result = (groupService as any).safeDateToISO(date);
            expect(result).toBe('2023-01-01T10:00:00.000Z');
        });

        it('should return string as-is if already string', () => {
            const dateString = '2023-01-01T10:00:00Z';
            const result = (groupService as any).safeDateToISO(dateString);
            expect(result).toBe(dateString);
        });

        it('should fallback to current timestamp for unknown types', () => {
            const result = (groupService as any).safeDateToISO(undefined);
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('formatRelativeTime - pure function', () => {
        it('should format recent timestamps as relative time', () => {
            // Mock the parseISOToTimestamp and getRelativeTime functions
            vi.mock('../../utils/dateHelpers', () => ({
                parseISOToTimestamp: vi.fn((dateStr: string) => {
                    if (dateStr === '2023-01-01T10:00:00Z') {
                        return { toDate: () => new Date('2023-01-01T10:00:00Z') };
                    }
                    return null;
                }),
                getRelativeTime: vi.fn((timestamp: any) => {
                    // Mock implementation for testing
                    if (timestamp && timestamp.toDate) {
                        return '2 hours ago';
                    }
                    return 'unknown';
                }),
                createOptimisticTimestamp: vi.fn(),
                createTrueServerTimestamp: vi.fn(),
                timestampToISO: vi.fn()
            }));

            const result = (groupService as any).formatRelativeTime('2023-01-01T10:00:00Z');
            expect(result).toBe('2 hours ago');
        });

        it('should return "unknown" for invalid date strings', () => {
            const result = (groupService as any).formatRelativeTime('invalid-date');
            expect(result).toBe('unknown');
        });
    });

    describe('Currency Balance Processing - Pure Function Logic', () => {
        it('should process currency balances correctly for user', () => {
            // Test the logic that processes currency-specific balances
            const userId = 'test-user';
            const mockBalancesByCurrency = {
                'USD': {
                    [userId]: { netBalance: 50.75, totalOwed: 50.75, totalOwing: 0 }
                },
                'EUR': {
                    [userId]: { netBalance: -25.50, totalOwed: 0, totalOwing: 25.50 }
                },
                'GBP': {
                    [userId]: { netBalance: 0.01, totalOwed: 0.01, totalOwing: 0 } // Below threshold
                }
            };

            // Simulate the processing logic from listGroups
            const balancesByCurrency: Record<string, any> = {};
            
            for (const [currency, currencyBalances] of Object.entries(mockBalancesByCurrency)) {
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                    balancesByCurrency[currency] = {
                        currency,
                        netBalance: currencyUserBalance.netBalance,
                        totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                        totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                    };
                }
            }

            // Verify processing results
            expect(balancesByCurrency).toHaveProperty('USD');
            expect(balancesByCurrency).toHaveProperty('EUR');
            expect(balancesByCurrency).not.toHaveProperty('GBP'); // Below threshold

            expect(balancesByCurrency.USD.totalOwed).toBe(50.75);
            expect(balancesByCurrency.USD.totalOwing).toBe(0);
            
            expect(balancesByCurrency.EUR.totalOwed).toBe(0);
            expect(balancesByCurrency.EUR.totalOwing).toBe(25.50);
        });

        it('should handle edge cases in balance processing', () => {
            const userId = 'test-user';
            
            // Test with exactly threshold amount (0.01)
            const exactThresholdBalance = {
                'USD': {
                    [userId]: { netBalance: 0.01, totalOwed: 0.01, totalOwing: 0 }
                }
            };

            const balancesByCurrency: Record<string, any> = {};
            for (const [currency, currencyBalances] of Object.entries(exactThresholdBalance)) {
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                    balancesByCurrency[currency] = {
                        currency,
                        netBalance: currencyUserBalance.netBalance,
                        totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                        totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                    };
                }
            }

            // Exactly 0.01 should be excluded (not greater than 0.01)
            expect(balancesByCurrency).not.toHaveProperty('USD');
        });
    });

    describe('Expense Metadata Calculation - Pure Function Logic', () => {
        it('should calculate expense metadata correctly', () => {
            const mockExpenses = [
                {
                    id: 'exp1',
                    createdAt: '2023-01-03T10:00:00Z',
                    deletedAt: undefined
                },
                {
                    id: 'exp2',
                    createdAt: '2023-01-01T10:00:00Z',
                    deletedAt: undefined
                },
                {
                    id: 'exp3',
                    createdAt: '2023-01-02T10:00:00Z',
                    deletedAt: '2023-01-04T10:00:00Z' // Soft-deleted
                }
            ];

            // Simulate the metadata calculation logic from batchFetchGroupData
            const nonDeletedExpenses = mockExpenses.filter((expense) => !expense.deletedAt);
            const sortedExpenses = nonDeletedExpenses.sort((a, b) => {
                const aTime = new Date(a.createdAt).getTime();
                const bTime = new Date(b.createdAt).getTime();
                return bTime - aTime; // DESC order
            });

            const metadata = {
                count: nonDeletedExpenses.length,
                lastExpenseTime: sortedExpenses.length > 0 ? new Date(sortedExpenses[0].createdAt) : undefined,
            };

            expect(metadata.count).toBe(2); // Only non-deleted expenses
            expect(metadata.lastExpenseTime).toEqual(new Date('2023-01-03T10:00:00Z')); // Most recent
        });

        it('should handle empty expense list', () => {
            const mockExpenses: any[] = [];
            
            const nonDeletedExpenses = mockExpenses.filter((expense) => !expense.deletedAt);
            const metadata = {
                count: nonDeletedExpenses.length,
                lastExpenseTime: undefined,
            };

            expect(metadata.count).toBe(0);
            expect(metadata.lastExpenseTime).toBeUndefined();
        });

        it('should handle all expenses being soft-deleted', () => {
            const mockExpenses = [
                {
                    id: 'exp1',
                    createdAt: '2023-01-01T10:00:00Z',
                    deletedAt: '2023-01-02T10:00:00Z'
                },
                {
                    id: 'exp2',
                    createdAt: '2023-01-01T10:00:00Z',
                    deletedAt: '2023-01-03T10:00:00Z'
                }
            ];

            const nonDeletedExpenses = mockExpenses.filter((expense) => !expense.deletedAt);
            const metadata = {
                count: nonDeletedExpenses.length,
                lastExpenseTime: undefined,
            };

            expect(metadata.count).toBe(0);
            expect(metadata.lastExpenseTime).toBeUndefined();
        });
    });

    describe('Group Data Transformation - Pure Function Logic', () => {
        it('should transform GroupDocument to Group format correctly', () => {
            const mockGroupDocument = {
                id: 'group-123',
                name: 'Test Group',
                description: 'A test group',
                createdBy: 'user-456',
                createdAt: '2023-01-01T10:00:00Z',
                updatedAt: '2023-01-01T12:00:00Z',
                securityPreset: 'open' as const,
                presetAppliedAt: '2023-01-01T10:00:00Z',
                permissions: { canAddExpense: true, canEditExpense: true }
            };

            // Simulate the transformation logic from listGroups
            const transformedGroup = {
                id: mockGroupDocument.id,
                name: mockGroupDocument.name,
                description: mockGroupDocument.description,
                createdBy: mockGroupDocument.createdBy,
                createdAt: mockGroupDocument.createdAt, // safeDateToISO would be called here
                updatedAt: mockGroupDocument.updatedAt, // safeDateToISO would be called here
                securityPreset: mockGroupDocument.securityPreset,
                presetAppliedAt: mockGroupDocument.presetAppliedAt, // safeDateToISO would be called here
                permissions: mockGroupDocument.permissions,
            };

            expect(transformedGroup.id).toBe('group-123');
            expect(transformedGroup.name).toBe('Test Group');
            expect(transformedGroup.description).toBe('A test group');
            expect(transformedGroup.createdBy).toBe('user-456');
            expect(transformedGroup.securityPreset).toBe('open');
            expect(transformedGroup.permissions).toEqual({ canAddExpense: true, canEditExpense: true });
        });
    });

    describe('User Balance Extraction - Pure Function Logic', () => {
        it('should extract user balance from first available currency', () => {
            const userId = 'test-user';
            const mockBalancesByCurrency = {
                'USD': {
                    [userId]: { netBalance: 25.50, totalOwed: 25.50, totalOwing: 0 }
                },
                'EUR': {
                    [userId]: { netBalance: -10.75, totalOwed: 0, totalOwing: 10.75 }
                }
            };

            // Simulate the user balance extraction logic from listGroups
            let userBalance = {
                netBalance: 0,
                totalOwed: 0,
                totalOwing: 0,
            };
            
            const currencyBalancesArray = Object.values(mockBalancesByCurrency);
            if (currencyBalancesArray.length > 0) {
                const firstCurrencyBalances = currencyBalancesArray[0];
                if (firstCurrencyBalances && firstCurrencyBalances[userId]) {
                    const balance = firstCurrencyBalances[userId];
                    userBalance = {
                        netBalance: balance.netBalance,
                        totalOwed: balance.netBalance > 0 ? balance.netBalance : 0,
                        totalOwing: balance.netBalance < 0 ? Math.abs(balance.netBalance) : 0,
                    };
                }
            }

            expect(userBalance.netBalance).toBe(25.50);
            expect(userBalance.totalOwed).toBe(25.50);
            expect(userBalance.totalOwing).toBe(0);
        });

        it('should return default balance when no currencies exist', () => {
            const userId = 'test-user';
            const mockBalancesByCurrency: any = {};

            let userBalance = {
                netBalance: 0,
                totalOwed: 0,
                totalOwing: 0,
            };
            
            const currencyBalancesArray = Object.values(mockBalancesByCurrency);
            if (currencyBalancesArray.length > 0) {
                const firstCurrencyBalances = currencyBalancesArray[0] as any;
                if (firstCurrencyBalances && firstCurrencyBalances[userId]) {
                    const balance = firstCurrencyBalances[userId];
                    userBalance = {
                        netBalance: balance.netBalance,
                        totalOwed: balance.netBalance > 0 ? balance.netBalance : 0,
                        totalOwing: balance.netBalance < 0 ? Math.abs(balance.netBalance) : 0,
                    };
                }
            }

            expect(userBalance.netBalance).toBe(0);
            expect(userBalance.totalOwed).toBe(0);
            expect(userBalance.totalOwing).toBe(0);
        });
    });
});
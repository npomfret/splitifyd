import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceCalculationService } from '../../../services/balance/BalanceCalculationService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import type { BalanceCalculationInput } from '../../../services/balance/types';
import { Timestamp } from 'firebase-admin/firestore';

// Mock service registration
const mockGetUsers = vi.fn();

const createMockUserService = () => ({
    getUsers: mockGetUsers,
});

describe('BalanceCalculationService', () => {
    let balanceCalculationService: BalanceCalculationService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockUserService: ReturnType<typeof createMockUserService>;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockUserService = createMockUserService();
        balanceCalculationService = new BalanceCalculationService(mockFirestoreReader as any, mockUserService as any);
        mockFirestoreReader.resetAllMocks();
        mockGetUsers.mockClear();
    });

    describe('calculateGroupBalances', () => {
        it('should calculate balances with real expense data', async () => {
            const groupId = 'test-group-id';
            const userId1 = 'user-1';
            const userId2 = 'user-2';

            // Mock complete expense data
            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId,
                    description: 'Dinner',
                    amount: 100,
                    currency: 'USD',
                    paidBy: userId1,
                    splitType: 'equal',
                    participants: [userId1, userId2],
                    splits: [
                        { userId: userId1, amount: 50 },
                        { userId: userId2, amount: 50 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            const mockSettlements: any[] = [];
            const mockGroup = {
                id: groupId,
                name: 'Test Group',
            };
            const mockMemberDocs = [
                { userId: userId1, memberRole: 'admin', memberStatus: 'active', joinedAt: new Date().toISOString() },
                { userId: userId2, memberRole: 'member', memberStatus: 'active', joinedAt: new Date().toISOString() },
            ];
            const mockUserProfiles = [
                { uid: userId1, displayName: 'User 1' },
                { uid: userId2, displayName: 'User 2' },
            ];

            // Setup mocks
            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue(mockSettlements);
            mockFirestoreReader.getGroup.mockResolvedValue(mockGroup as any);
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue(mockMemberDocs as any);
            mockGetUsers.mockResolvedValue(mockUserProfiles);

            const result = await balanceCalculationService.calculateGroupBalances(groupId);

            // Verify result structure
            expect(result.groupId).toBe(groupId);
            expect(result.userBalances).toBeDefined();
            expect(result.simplifiedDebts).toBeDefined();
            expect(result.lastUpdated).toBeDefined();
            expect(result.balancesByCurrency).toBeDefined();

            // Verify balance calculations
            expect(result.balancesByCurrency.USD).toBeDefined();
            expect(result.balancesByCurrency.USD[userId1].netBalance).toBe(50); // paid 100, owes 50
            expect(result.balancesByCurrency.USD[userId2].netBalance).toBe(-50); // paid 0, owes 50
        });

        it('should handle multi-currency expenses', async () => {
            const groupId = 'test-group-id';
            const userId1 = 'user-1';
            const userId2 = 'user-2';

            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId,
                    description: 'USD Expense',
                    amount: 100,
                    currency: 'USD',
                    paidBy: userId1,
                    splitType: 'equal',
                    participants: [userId1, userId2],
                    splits: [
                        { userId: userId1, amount: 50 },
                        { userId: userId2, amount: 50 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
                {
                    id: 'expense-2',
                    groupId,
                    description: 'EUR Expense',
                    amount: 80,
                    currency: 'EUR',
                    paidBy: userId2,
                    splitType: 'equal',
                    participants: [userId1, userId2],
                    splits: [
                        { userId: userId1, amount: 40 },
                        { userId: userId2, amount: 40 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            setupMocksForCalculation(groupId, mockExpenses, [], [userId1, userId2]);

            const result = await balanceCalculationService.calculateGroupBalances(groupId);

            // Verify multi-currency balances
            expect(Object.keys(result.balancesByCurrency)).toContain('USD');
            expect(Object.keys(result.balancesByCurrency)).toContain('EUR');
            expect(result.balancesByCurrency.USD[userId1].netBalance).toBe(50);
            expect(result.balancesByCurrency.EUR[userId2].netBalance).toBe(40);
        });

        it('should apply settlements correctly', async () => {
            const groupId = 'test-group-id';
            const userId1 = 'user-1';
            const userId2 = 'user-2';

            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId,
                    description: 'Test',
                    amount: 100,
                    currency: 'USD',
                    paidBy: userId1,
                    splitType: 'equal',
                    participants: [userId1, userId2],
                    splits: [
                        { userId: userId1, amount: 50 },
                        { userId: userId2, amount: 50 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            const mockSettlements = [
                {
                    id: 'settlement-1',
                    groupId,
                    payerId: userId2,
                    payeeId: userId1,
                    amount: 25,
                    currency: 'USD',
                    date: Timestamp.now(),
                    note: 'Partial payment',
                    createdAt: Timestamp.now(),
                },
            ];

            setupMocksForCalculation(groupId, mockExpenses, mockSettlements, [userId1, userId2]);

            const result = await balanceCalculationService.calculateGroupBalances(groupId);

            // After settlement: user1 net = 50 - 25 = 25, user2 net = -50 + 25 = -25
            expect(result.balancesByCurrency.USD[userId1].netBalance).toBe(25);
            expect(result.balancesByCurrency.USD[userId2].netBalance).toBe(-25);
        });
    });

    describe('calculateGroupBalancesWithData', () => {
        it('should validate input data with Zod schema', () => {
            const invalidInput = {} as any;

            expect(() => balanceCalculationService.calculateGroupBalancesWithData(invalidInput)).toThrow();
        });

        it('should handle empty data gracefully', () => {
            const emptyInput: BalanceCalculationInput = {
                groupId: 'test-group',
                expenses: [],
                settlements: [],
                groupData: {
                    id: 'test-group',
                    name: 'Test Group',
                    members: {},
                },
                memberProfiles: new Map(),
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(emptyInput);

            expect(result.groupId).toBe('test-group');
            expect(Object.keys(result.balancesByCurrency)).toHaveLength(0);
        });

        it('should log performance metrics for slow operations', () => {
            // Mock a slow calculation scenario
            const loggerSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            // Create input that will trigger performance logging
            const input: BalanceCalculationInput = {
                groupId: 'test-group',
                expenses: Array.from({ length: 100 }, (_, i) => ({
                    id: `expense-${i}`,
                    groupId: 'test-group',
                    description: `Expense ${i}`,
                    amount: Math.random() * 100,
                    currency: 'USD',
                    paidBy: 'user-1',
                    splitType: 'equal' as const,
                    participants: ['user-1', 'user-2'],
                    splits: [
                        { userId: 'user-1', amount: 50 },
                        { userId: 'user-2', amount: 50 },
                    ],
                    date: new Date().toISOString(),
                    category: 'Food',
                    createdAt: new Date().toISOString(),
                })),
                settlements: [],
                groupData: {
                    id: 'test-group',
                    name: 'Test Group',
                    members: {
                        'user-1': { memberRole: 'admin', memberStatus: 'active', joinedAt: new Date().toISOString() },
                        'user-2': { memberRole: 'member', memberStatus: 'active', joinedAt: new Date().toISOString() },
                    },
                },
                memberProfiles: new Map(),
            };

            balanceCalculationService.calculateGroupBalancesWithData(input);

            loggerSpy.mockRestore();
        });
    });

    describe('fetchBalanceCalculationData', () => {
        it('should fetch all required data for balance calculation', async () => {
            const groupId = 'test-group-id';
            const userId1 = 'user-1';
            const userId2 = 'user-2';

            const mockExpenses = [createMockExpense(userId1, groupId)];
            const mockSettlements = [createMockSettlement(userId1, userId2, groupId)];
            const mockGroup = { id: groupId, name: 'Test Group' };
            const mockMemberDocs = [
                { userId: userId1, memberRole: 'admin', memberStatus: 'active', joinedAt: new Date().toISOString() },
                { userId: userId2, memberRole: 'member', memberStatus: 'active', joinedAt: new Date().toISOString() },
            ];
            const mockUserProfiles = [{ uid: userId1 }, { uid: userId2 }];

            setupMocksForDataFetching(groupId, mockExpenses, mockSettlements, mockGroup, mockMemberDocs, mockUserProfiles);

            const result = await balanceCalculationService.fetchBalanceCalculationData(groupId);

            expect(result.groupId).toBe(groupId);
            expect(result.expenses).toHaveLength(1);
            expect(result.settlements).toHaveLength(1);
            expect(result.groupData.id).toBe(groupId);
            expect(result.memberProfiles).toHaveLength(2);
        });

        it('should throw error when group is not found', async () => {
            const groupId = 'non-existent-group';

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(balanceCalculationService.fetchBalanceCalculationData(groupId)).rejects.toThrow('Group not found');
        });

        it('should throw error when group has no members', async () => {
            const groupId = 'test-group-id';

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
            mockFirestoreReader.getGroup.mockResolvedValue({ id: groupId, name: 'Test' } as any);
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue([]);
            mockGetUsers.mockResolvedValue([]);

            await expect(balanceCalculationService.fetchBalanceCalculationData(groupId)).rejects.toThrow(`Group ${groupId} has no members for balance calculation`);
        });

        it('should properly filter soft-deleted expenses', async () => {
            const groupId = 'test-group-id';
            const userId1 = 'user-1';

            const mockExpenses = [
                createMockExpense(userId1, groupId, { deletedAt: null }),
                createMockExpense(userId1, groupId, { deletedAt: new Date() }), // Should be filtered
            ];

            setupMocksForDataFetching(
                groupId,
                mockExpenses,
                [],
                { id: groupId, name: 'Test' },
                [{ userId: userId1, memberRole: 'admin', memberStatus: 'active', joinedAt: new Date().toISOString() }],
                [{ uid: userId1 }],
            );

            const result = await balanceCalculationService.fetchBalanceCalculationData(groupId);

            expect(result.expenses).toHaveLength(1);
            expect(result.expenses[0].deletedAt).toBeUndefined();
        });
    });

    // Helper functions
    function setupMocksForCalculation(groupId: string, expenses: any[], settlements: any[], userIds: string[]) {
        const mockGroup = { id: groupId, name: 'Test Group' };
        const mockMemberDocs = userIds.map((id) => ({
            userId: id,
            memberRole: 'member',
            memberStatus: 'active',
            joinedAt: new Date().toISOString(),
        }));
        const mockUserProfiles = userIds.map((id) => ({ uid: id }));

        setupMocksForDataFetching(groupId, expenses, settlements, mockGroup, mockMemberDocs, mockUserProfiles);
    }

    function setupMocksForDataFetching(groupId: string, expenses: any[], settlements: any[], group: any, memberDocs: any[], userProfiles: any[]) {
        mockFirestoreReader.getExpensesForGroup.mockResolvedValue(expenses);
        mockFirestoreReader.getSettlementsForGroup.mockResolvedValue(settlements);
        mockFirestoreReader.getGroup.mockResolvedValue(group);
        mockFirestoreReader.getAllGroupMembers.mockResolvedValue(memberDocs);
        mockGetUsers.mockResolvedValue(userProfiles);
    }

    function createMockExpense(paidBy: string, groupId: string, overrides: any = {}) {
        return {
            id: 'expense-1',
            groupId,
            description: 'Test Expense',
            amount: 100,
            currency: 'USD',
            paidBy,
            splitType: 'equal',
            participants: [paidBy],
            splits: [{ userId: paidBy, amount: 100 }],
            date: Timestamp.now(),
            category: 'Food',
            createdAt: Timestamp.now(),
            deletedAt: null,
            ...overrides,
        };
    }

    function createMockSettlement(payerId: string, payeeId: string, groupId: string) {
        return {
            id: 'settlement-1',
            groupId,
            payerId,
            payeeId,
            amount: 25,
            currency: 'USD',
            date: Timestamp.now(),
            note: 'Test settlement',
            createdAt: Timestamp.now(),
        };
    }
});

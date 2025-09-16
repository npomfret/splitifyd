import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceCalculationService } from '../../../services/balance';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import type { BalanceCalculationInput } from '../../../services/balance';

const mockGetUsers = vi.fn();

const createMockUserService = () => ({
    getUsers: mockGetUsers,
});

describe('Balance Calculations - Comprehensive Scenarios', () => {
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

    const createBaseInput = (groupId: string, userIds: string[]): Omit<BalanceCalculationInput, 'expenses' | 'settlements'> => ({
        groupId,
        groupData: {
            id: groupId,
            name: 'Test Group',
            members: Object.fromEntries(
                userIds.map((userId) => [
                    userId,
                    {
                        userId,
                        memberRole: userId === userIds[0] ? 'admin' : 'member',
                        memberStatus: 'active',
                        joinedAt: new Date().toISOString(),
                    },
                ]),
            ),
        },
        memberProfiles: new Map(
            userIds.map((userId) => [
                userId,
                {
                    uid: userId,
                    displayName: `User ${userId}`,
                    email: `${userId}@test.com`,
                    initials: userId.slice(0, 2).toUpperCase(),
                    photoURL: null,
                    emailVerified: true,
                },
            ]),
        ),
    });

    describe('Single User Scenarios', () => {
        it('should handle single user paying for themselves', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1']),
                expenses: [
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'Solo expense',
                        amount: 100,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [{ userId: 'user-1', amount: 100 }],
                        splitType: 'equal',
                        participants: ['user-1'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            // Single user should have zero net balance (paid for themselves)
            expect(result.userBalances['user-1'].netBalance).toBe(0);
            expect(Object.keys(result.userBalances['user-1'].owes)).toHaveLength(0);
            expect(Object.keys(result.userBalances['user-1'].owedBy)).toHaveLength(0);
        });
    });

    describe('Two User Scenarios', () => {
        it('should handle one user paying for both (simple debt)', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1', 'user-2']),
                expenses: [
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'Dinner for both',
                        amount: 100,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [
                            { userId: 'user-1', amount: 50 },
                            { userId: 'user-2', amount: 50 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            expect(result.userBalances['user-1'].netBalance).toBe(50); // Paid 100, owes 50
            expect(result.userBalances['user-2'].netBalance).toBe(-50); // Paid 0, owes 50

            // Conservation of money
            expect(result.userBalances['user-1'].netBalance + result.userBalances['user-2'].netBalance).toBe(0);
        });

        it('should handle reciprocal expenses (the failing integration test scenario)', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-0', 'user-1']),
                expenses: [
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'User 0 pays $100',
                        amount: 100,
                        currency: 'USD',
                        paidBy: 'user-0',
                        splits: [
                            { userId: 'user-0', amount: 50 },
                            { userId: 'user-1', amount: 50 },
                        ],
                        splitType: 'equal',
                        participants: ['user-0', 'user-1'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                    {
                        id: 'exp-2',
                        groupId: 'group-1',
                        description: 'User 1 pays $80',
                        amount: 80,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [
                            { userId: 'user-0', amount: 40 },
                            { userId: 'user-1', amount: 40 },
                        ],
                        splitType: 'equal',
                        participants: ['user-0', 'user-1'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            expect(result.userBalances['user-0'].netBalance).toBe(10); // +50 -40 = +10
            expect(result.userBalances['user-1'].netBalance).toBe(-10); // -50 +40 = -10

            // Conservation of money
            expect(result.userBalances['user-0'].netBalance + result.userBalances['user-1'].netBalance).toBe(0);
        });

        it('should handle uneven splits', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1', 'user-2']),
                expenses: [
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'Uneven split',
                        amount: 100,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [
                            { userId: 'user-1', amount: 30 },
                            { userId: 'user-2', amount: 70 },
                        ],
                        splitType: 'exact',
                        participants: ['user-1', 'user-2'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            expect(result.userBalances['user-1'].netBalance).toBe(70); // Paid 100, owes 30
            expect(result.userBalances['user-2'].netBalance).toBe(-70); // Paid 0, owes 70

            // Conservation of money
            expect(result.userBalances['user-1'].netBalance + result.userBalances['user-2'].netBalance).toBe(0);
        });
    });

    describe('Three User Scenarios', () => {
        it('should handle one payer, three participants', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1', 'user-2', 'user-3']),
                expenses: [
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'Dinner for three',
                        amount: 90,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [
                            { userId: 'user-1', amount: 30 },
                            { userId: 'user-2', amount: 30 },
                            { userId: 'user-3', amount: 30 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2', 'user-3'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            expect(result.userBalances['user-1'].netBalance).toBe(60); // Paid 90, owes 30
            expect(result.userBalances['user-2'].netBalance).toBe(-30); // Paid 0, owes 30
            expect(result.userBalances['user-3'].netBalance).toBe(-30); // Paid 0, owes 30

            // Conservation of money
            const total = result.userBalances['user-1'].netBalance + result.userBalances['user-2'].netBalance + result.userBalances['user-3'].netBalance;
            expect(total).toBe(0);
        });

        it('should handle circular expenses', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1', 'user-2', 'user-3']),
                expenses: [
                    // User 1 pays 90, split equally
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'User 1 pays',
                        amount: 90,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [
                            { userId: 'user-1', amount: 30 },
                            { userId: 'user-2', amount: 30 },
                            { userId: 'user-3', amount: 30 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2', 'user-3'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                    // User 2 pays 60, split equally
                    {
                        id: 'exp-2',
                        groupId: 'group-1',
                        description: 'User 2 pays',
                        amount: 60,
                        currency: 'USD',
                        paidBy: 'user-2',
                        splits: [
                            { userId: 'user-1', amount: 20 },
                            { userId: 'user-2', amount: 20 },
                            { userId: 'user-3', amount: 20 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2', 'user-3'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                    // User 3 pays 30, split equally
                    {
                        id: 'exp-3',
                        groupId: 'group-1',
                        description: 'User 3 pays',
                        amount: 30,
                        currency: 'USD',
                        paidBy: 'user-3',
                        splits: [
                            { userId: 'user-1', amount: 10 },
                            { userId: 'user-2', amount: 10 },
                            { userId: 'user-3', amount: 10 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2', 'user-3'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            // User 1: Paid 90, owes 60 (30+20+10) → net: +30
            // User 2: Paid 60, owes 60 (30+20+10) → net: 0
            // User 3: Paid 30, owes 60 (30+20+10) → net: -30
            expect(result.userBalances['user-1'].netBalance).toBe(30);
            expect(result.userBalances['user-2'].netBalance).toBe(0);
            expect(result.userBalances['user-3'].netBalance).toBe(-30);

            // Conservation of money
            const total = result.userBalances['user-1'].netBalance + result.userBalances['user-2'].netBalance + result.userBalances['user-3'].netBalance;
            expect(total).toBe(0);
        });
    });

    describe('Multi-Currency Scenarios', () => {
        it('should handle expenses in different currencies', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1', 'user-2']),
                expenses: [
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'USD Expense',
                        amount: 100,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [
                            { userId: 'user-1', amount: 50 },
                            { userId: 'user-2', amount: 50 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                    {
                        id: 'exp-2',
                        groupId: 'group-1',
                        description: 'EUR Expense',
                        amount: 80,
                        currency: 'EUR',
                        paidBy: 'user-2',
                        splits: [
                            { userId: 'user-1', amount: 40 },
                            { userId: 'user-2', amount: 40 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            // Should have separate balances for each currency
            expect(result.balancesByCurrency.USD).toBeDefined();
            expect(result.balancesByCurrency.EUR).toBeDefined();

            // USD: User 1 +50, User 2 -50
            expect(result.balancesByCurrency.USD['user-1'].netBalance).toBe(50);
            expect(result.balancesByCurrency.USD['user-2'].netBalance).toBe(-50);

            // EUR: User 1 -40, User 2 +40
            expect(result.balancesByCurrency.EUR['user-1'].netBalance).toBe(-40);
            expect(result.balancesByCurrency.EUR['user-2'].netBalance).toBe(40);

            // Conservation of money per currency
            expect(result.balancesByCurrency.USD['user-1'].netBalance + result.balancesByCurrency.USD['user-2'].netBalance).toBe(0);
            expect(result.balancesByCurrency.EUR['user-1'].netBalance + result.balancesByCurrency.EUR['user-2'].netBalance).toBe(0);
        });
    });

    describe('Settlement Scenarios', () => {
        it('should handle settlements reducing balances', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1', 'user-2']),
                expenses: [
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'Dinner',
                        amount: 100,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [
                            { userId: 'user-1', amount: 50 },
                            { userId: 'user-2', amount: 50 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [
                    {
                        id: 'settlement-1',
                        groupId: 'group-1',
                        payerId: 'user-2',
                        payeeId: 'user-1',
                        amount: 30,
                        currency: 'USD',
                        date: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                    },
                ],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            // Before settlement: User 1 +50, User 2 -50
            // After $30 settlement: User 1 +20, User 2 -20
            expect(result.userBalances['user-1'].netBalance).toBe(20);
            expect(result.userBalances['user-2'].netBalance).toBe(-20);

            // Conservation of money
            expect(result.userBalances['user-1'].netBalance + result.userBalances['user-2'].netBalance).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero amount expenses', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1', 'user-2']),
                expenses: [
                    {
                        id: 'exp-1',
                        groupId: 'group-1',
                        description: 'Zero expense',
                        amount: 0,
                        currency: 'USD',
                        paidBy: 'user-1',
                        splits: [
                            { userId: 'user-1', amount: 0 },
                            { userId: 'user-2', amount: 0 },
                        ],
                        splitType: 'equal',
                        participants: ['user-1', 'user-2'],
                        date: new Date().toISOString(),
                        category: 'Food',
                        createdAt: new Date().toISOString(),
                        deletedAt: undefined,
                    },
                ],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            expect(result.userBalances['user-1'].netBalance).toBe(0);
            expect(result.userBalances['user-2'].netBalance).toBe(0);
        });

        it('should handle no expenses', () => {
            const input: BalanceCalculationInput = {
                ...createBaseInput('group-1', ['user-1', 'user-2']),
                expenses: [],
                settlements: [],
            };

            const result = balanceCalculationService.calculateGroupBalancesWithData(input);

            // Should have empty balances when no expenses
            expect(Object.keys(result.userBalances)).toHaveLength(0);
        });
    });
});

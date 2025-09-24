import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceCalculationService } from '../../../services/balance';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Balance Calculation Scenarios Unit Tests
 *
 * Tests specific mathematical scenarios from integration tests
 * without requiring real Firebase or API calls. These tests
 * verify the core balance calculation logic with precise
 * mathematical expectations.
 */
describe('BalanceCalculationService - Mathematical Scenarios', () => {
    let balanceCalculationService: BalanceCalculationService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockUserService: any;

    const testGroupId = 'test-group-id';
    const userAlice = 'alice-user-id';
    const userBob = 'bob-user-id';
    const userCharlie = 'charlie-user-id';

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockUserService = {
            getUsers: vi.fn().mockResolvedValue([
                { uid: userAlice, displayName: 'Alice' },
                { uid: userBob, displayName: 'Bob' },
                { uid: userCharlie, displayName: 'Charlie' },
            ]),
        };

        balanceCalculationService = new BalanceCalculationService(mockFirestoreReader as any, mockUserService);

        // Setup common group and member mocks
        mockFirestoreReader.getGroup.mockResolvedValue({
            id: testGroupId,
            name: 'Test Group',
        });

        mockFirestoreReader.getAllGroupMembers.mockResolvedValue([
            { userId: userAlice, memberRole: 'admin', memberStatus: 'active', joinedAt: new Date().toISOString() },
            { userId: userBob, memberRole: 'member', memberStatus: 'active', joinedAt: new Date().toISOString() },
            { userId: userCharlie, memberRole: 'member', memberStatus: 'active', joinedAt: new Date().toISOString() },
        ]);

        mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
    });

    describe('Two-User Balance Calculations', () => {
        it('should handle basic two-user balance scenario correctly', async () => {
            // Scenario: Alice pays €100, Bob pays €80, both split equally
            // Expected: Alice net +€10, Bob net -€10
            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId: testGroupId,
                    description: 'Alice pays €100',
                    amount: 100,
                    currency: 'EUR',
                    paidBy: userAlice,
                    splitType: 'equal',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 50 },
                        { userId: userBob, amount: 50 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
                {
                    id: 'expense-2',
                    groupId: testGroupId,
                    description: 'Bob pays €80',
                    amount: 80,
                    currency: 'EUR',
                    paidBy: userBob,
                    splitType: 'equal',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 40 },
                        { userId: userBob, amount: 40 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            // Mathematical verification:
            // Alice: paid €100, owes €90 (€50 + €40) → net +€10
            // Bob: paid €80, owes €90 (€50 + €40) → net -€10
            expect(result.balancesByCurrency.EUR[userAlice].netBalance).toBe(10);
            expect(result.balancesByCurrency.EUR[userBob].netBalance).toBe(-10);

            // Conservation of money - total should equal zero
            const total = result.balancesByCurrency.EUR[userAlice].netBalance + result.balancesByCurrency.EUR[userBob].netBalance;
            expect(total).toBe(0);

            // Verify debt simplification
            expect(result.simplifiedDebts).toHaveLength(1);
            expect(result.simplifiedDebts[0].from.userId).toBe(userBob);
            expect(result.simplifiedDebts[0].to.userId).toBe(userAlice);
            expect(result.simplifiedDebts[0].amount).toBe(10);
            expect(result.simplifiedDebts[0].currency).toBe('EUR');
        });

        it('should handle zero-sum scenarios correctly', async () => {
            // Scenario: Both users pay equal amounts with equal splits
            // Expected: Both users have net balance of 0
            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId: testGroupId,
                    description: 'Alice pays €50',
                    amount: 50,
                    currency: 'EUR',
                    paidBy: userAlice,
                    splitType: 'equal',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 25 },
                        { userId: userBob, amount: 25 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
                {
                    id: 'expense-2',
                    groupId: testGroupId,
                    description: 'Bob pays €50',
                    amount: 50,
                    currency: 'EUR',
                    paidBy: userBob,
                    splitType: 'equal',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 25 },
                        { userId: userBob, amount: 25 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            // Mathematical verification:
            // Alice: paid €50, owes €50 (€25 + €25) → net €0
            // Bob: paid €50, owes €50 (€25 + €25) → net €0
            expect(result.balancesByCurrency.EUR[userAlice].netBalance).toBe(0);
            expect(result.balancesByCurrency.EUR[userBob].netBalance).toBe(0);

            // Conservation of money
            const total = result.balancesByCurrency.EUR[userAlice].netBalance + result.balancesByCurrency.EUR[userBob].netBalance;
            expect(total).toBe(0);

            // No debts in zero-sum scenario
            expect(result.simplifiedDebts).toHaveLength(0);
        });

        it('should handle settlement balance calculation correctly', async () => {
            // Scenario from failing test: Alice pays €150, split equally
            // Expected: Bob owes Alice exactly €75
            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId: testGroupId,
                    description: 'Alice pays €150',
                    amount: 150,
                    currency: 'EUR',
                    paidBy: userAlice,
                    splitType: 'equal',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 75 },
                        { userId: userBob, amount: 75 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            // Critical mathematical verification:
            // Alice: paid €150, owes €75 → net +€75
            // Bob: paid €0, owes €75 → net -€75
            expect(result.balancesByCurrency.EUR[userAlice].netBalance).toBe(75);
            expect(result.balancesByCurrency.EUR[userBob].netBalance).toBe(-75);

            // Verify debt simplification shows exactly €75
            expect(result.simplifiedDebts).toHaveLength(1);
            const debt = result.simplifiedDebts[0];
            expect(debt.from.userId).toBe(userBob);
            expect(debt.to.userId).toBe(userAlice);
            expect(debt.amount).toBe(75);
            expect(debt.currency).toBe('EUR');
        });
    });

    describe('Multi-Currency Balance Calculations', () => {
        it('should handle multi-currency expenses without cross-currency consolidation', async () => {
            // Scenario: Alice pays $300 USD, Bob pays €240 EUR, Charlie pays £180 GBP
            // All split equally among 3 users
            const mockExpenses = [
                {
                    id: 'usd-expense',
                    groupId: testGroupId,
                    description: 'Hotel - USD',
                    amount: 300,
                    currency: 'USD',
                    paidBy: userAlice,
                    splitType: 'equal',
                    participants: [userAlice, userBob, userCharlie],
                    splits: [
                        { userId: userAlice, amount: 100 },
                        { userId: userBob, amount: 100 },
                        { userId: userCharlie, amount: 100 },
                    ],
                    date: Timestamp.now(),
                    category: 'Accommodation',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
                {
                    id: 'eur-expense',
                    groupId: testGroupId,
                    description: 'Dinner - EUR',
                    amount: 240,
                    currency: 'EUR',
                    paidBy: userBob,
                    splitType: 'equal',
                    participants: [userAlice, userBob, userCharlie],
                    splits: [
                        { userId: userAlice, amount: 80 },
                        { userId: userBob, amount: 80 },
                        { userId: userCharlie, amount: 80 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
                {
                    id: 'gbp-expense',
                    groupId: testGroupId,
                    description: 'Transport - GBP',
                    amount: 180,
                    currency: 'GBP',
                    paidBy: userCharlie,
                    splitType: 'equal',
                    participants: [userAlice, userBob, userCharlie],
                    splits: [
                        { userId: userAlice, amount: 60 },
                        { userId: userBob, amount: 60 },
                        { userId: userCharlie, amount: 60 },
                    ],
                    date: Timestamp.now(),
                    category: 'Transport',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            // USD balances: Alice paid $300, owes $100 → net +$200
            expect(result.balancesByCurrency.USD[userAlice].netBalance).toBe(200);
            expect(result.balancesByCurrency.USD[userBob].netBalance).toBe(-100);
            expect(result.balancesByCurrency.USD[userCharlie].netBalance).toBe(-100);

            // EUR balances: Bob paid €240, owes €80 → net +€160
            expect(result.balancesByCurrency.EUR[userAlice].netBalance).toBe(-80);
            expect(result.balancesByCurrency.EUR[userBob].netBalance).toBe(160);
            expect(result.balancesByCurrency.EUR[userCharlie].netBalance).toBe(-80);

            // GBP balances: Charlie paid £180, owes £60 → net +£120
            expect(result.balancesByCurrency.GBP[userAlice].netBalance).toBe(-60);
            expect(result.balancesByCurrency.GBP[userBob].netBalance).toBe(-60);
            expect(result.balancesByCurrency.GBP[userCharlie].netBalance).toBe(120);

            // Verify conservation of money in each currency
            const usdTotal = result.balancesByCurrency.USD[userAlice].netBalance + result.balancesByCurrency.USD[userBob].netBalance + result.balancesByCurrency.USD[userCharlie].netBalance;
            expect(usdTotal).toBe(0);

            const eurTotal = result.balancesByCurrency.EUR[userAlice].netBalance + result.balancesByCurrency.EUR[userBob].netBalance + result.balancesByCurrency.EUR[userCharlie].netBalance;
            expect(eurTotal).toBe(0);

            const gbpTotal = result.balancesByCurrency.GBP[userAlice].netBalance + result.balancesByCurrency.GBP[userBob].netBalance + result.balancesByCurrency.GBP[userCharlie].netBalance;
            expect(gbpTotal).toBe(0);

            // Verify separate currency debts (no cross-currency consolidation)
            const usdDebts = result.simplifiedDebts.filter((d) => d.currency === 'USD');
            const eurDebts = result.simplifiedDebts.filter((d) => d.currency === 'EUR');
            const gbpDebts = result.simplifiedDebts.filter((d) => d.currency === 'GBP');

            expect(usdDebts.length).toBeGreaterThan(0);
            expect(eurDebts.length).toBeGreaterThan(0);
            expect(gbpDebts.length).toBeGreaterThan(0);

            // Verify debt amounts
            const totalUsdOwedToAlice = usdDebts.filter((d) => d.to.userId === userAlice).reduce((sum, d) => sum + d.amount, 0);
            expect(totalUsdOwedToAlice).toBe(200); // $100 from Bob + $100 from Charlie

            const totalEurOwedToBob = eurDebts.filter((d) => d.to.userId === userBob).reduce((sum, d) => sum + d.amount, 0);
            expect(totalEurOwedToBob).toBe(160); // €80 from Alice + €80 from Charlie

            const totalGbpOwedToCharlie = gbpDebts.filter((d) => d.to.userId === userCharlie).reduce((sum, d) => sum + d.amount, 0);
            expect(totalGbpOwedToCharlie).toBe(120); // £60 from Alice + £60 from Bob
        });
    });

    describe('Complex Split Scenarios', () => {
        it('should handle complex unequal split scenarios', async () => {
            // Scenario: Alice pays €800, Bob pays €120, with unequal splits
            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId: testGroupId,
                    description: 'Expensive flight',
                    amount: 800,
                    currency: 'EUR',
                    paidBy: userAlice,
                    splitType: 'exact',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 460 }, // Alice's share
                        { userId: userBob, amount: 340 }, // Bob's share
                    ],
                    date: Timestamp.now(),
                    category: 'Transport',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
                {
                    id: 'expense-2',
                    groupId: testGroupId,
                    description: 'Restaurant dinner',
                    amount: 120,
                    currency: 'EUR',
                    paidBy: userBob,
                    splitType: 'equal',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 60 },
                        { userId: userBob, amount: 60 },
                    ],
                    date: Timestamp.now(),
                    category: 'Food',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            // Mathematical verification:
            // Alice: paid €800, owes €520 (€460 + €60) → net +€280
            // Bob: paid €120, owes €400 (€340 + €60) → net -€280
            expect(result.balancesByCurrency.EUR[userAlice].netBalance).toBe(280);
            expect(result.balancesByCurrency.EUR[userBob].netBalance).toBe(-280);

            // Conservation of money
            const total = result.balancesByCurrency.EUR[userAlice].netBalance + result.balancesByCurrency.EUR[userBob].netBalance;
            expect(total).toBe(0);

            // Verify simplified debt
            expect(result.simplifiedDebts).toHaveLength(1);
            expect(result.simplifiedDebts[0].from.userId).toBe(userBob);
            expect(result.simplifiedDebts[0].to.userId).toBe(userAlice);
            expect(result.simplifiedDebts[0].amount).toBe(280);
        });

        it('should handle percentage split calculations accurately', async () => {
            // Scenario: €100 expense with 70-30 percentage split
            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId: testGroupId,
                    description: 'Percentage split test',
                    amount: 100,
                    currency: 'EUR',
                    paidBy: userAlice,
                    splitType: 'percentage',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 70, percentage: 70 },
                        { userId: userBob, amount: 30, percentage: 30 },
                    ],
                    date: Timestamp.now(),
                    category: 'Other',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            // Mathematical verification:
            // Alice: paid €100, owes €70 → net +€30
            // Bob: paid €0, owes €30 → net -€30
            expect(result.balancesByCurrency.EUR[userAlice].netBalance).toBe(30);
            expect(result.balancesByCurrency.EUR[userBob].netBalance).toBe(-30);

            // Verify conservation of money
            const total = result.balancesByCurrency.EUR[userAlice].netBalance + result.balancesByCurrency.EUR[userBob].netBalance;
            expect(total).toBe(0);
        });
    });

    describe('Edge Cases and Validations', () => {
        it('should handle empty expense list', async () => {
            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            expect(result.balancesByCurrency).toEqual({});
            expect(result.simplifiedDebts).toHaveLength(0);
        });

        it('should handle single user expenses correctly', async () => {
            // Single user paying for themselves only
            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId: testGroupId,
                    description: 'Solo expense',
                    amount: 100,
                    currency: 'USD',
                    paidBy: userAlice,
                    splitType: 'equal',
                    participants: [userAlice],
                    splits: [{ userId: userAlice, amount: 100 }],
                    date: Timestamp.now(),
                    category: 'Personal',
                    createdAt: Timestamp.now(),
                    deletedAt: null,
                },
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            // User pays for themselves - net balance should be 0
            expect(result.balancesByCurrency.USD[userAlice].netBalance).toBe(0);
            expect(result.simplifiedDebts).toHaveLength(0);
        });

        it('should handle expenses with settlements', async () => {
            // Scenario: Bob owes Alice €75, then settles €25
            const mockExpenses = [
                {
                    id: 'expense-1',
                    groupId: testGroupId,
                    description: 'Alice pays €150',
                    amount: 150,
                    currency: 'EUR',
                    paidBy: userAlice,
                    splitType: 'equal',
                    participants: [userAlice, userBob],
                    splits: [
                        { userId: userAlice, amount: 75 },
                        { userId: userBob, amount: 75 },
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
                    groupId: testGroupId,
                    payerId: userBob,
                    payeeId: userAlice,
                    amount: 25,
                    currency: 'EUR',
                    date: Timestamp.now(),
                    createdAt: Timestamp.now(),
                },
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue(mockSettlements as any);

            const result = await balanceCalculationService.calculateGroupBalances(testGroupId);

            // After settlement: Bob now owes Alice €50 instead of €75
            expect(result.balancesByCurrency.EUR[userAlice].netBalance).toBe(50);
            expect(result.balancesByCurrency.EUR[userBob].netBalance).toBe(-50);

            // Verify simplified debt reflects settlement
            expect(result.simplifiedDebts).toHaveLength(1);
            expect(result.simplifiedDebts[0].amount).toBe(50);
        });
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { IncrementalBalanceService } from '../../../services/balance/IncrementalBalanceService';
import { StubFirestoreWriter } from '../mocks/firestore-stubs';
import { ExpenseDTOBuilder } from '@splitifyd/test-support';
import type { SettlementDTO } from '@splitifyd/shared';
import type { GroupBalanceDTO } from '../../../schemas';

describe('IncrementalBalanceService - Unit Tests', () => {
    let service: IncrementalBalanceService;
    let stubWriter: StubFirestoreWriter;
    let mockTransaction: any;

    const groupId = 'test-group-id';
    const userId1 = 'user-1';
    const userId2 = 'user-2';
    const userId3 = 'user-3';

    beforeEach(() => {
        stubWriter = new StubFirestoreWriter();
        service = new IncrementalBalanceService(stubWriter);
        mockTransaction = {}; // Simple mock transaction object
    });

    const createEmptyBalance = (): GroupBalanceDTO => ({
        groupId,
        balancesByCurrency: {},
        simplifiedDebts: [],
        lastUpdatedAt: new Date().toISOString(),
        version: 0,
    });

    const createBalanceWithUSD = (): GroupBalanceDTO => ({
        groupId,
        balancesByCurrency: {
            USD: {
                [userId1]: {
                    uid: userId1,
                    owes: {},
                    owedBy: { [userId2]: 50 },
                    netBalance: 50,
                },
                [userId2]: {
                    uid: userId2,
                    owes: { [userId1]: 50 },
                    owedBy: {},
                    netBalance: -50,
                },
            },
        },
        simplifiedDebts: [
            {
                from: { uid: userId2 },
                to: { uid: userId1 },
                amount: 50,
                currency: 'USD',
            },
        ],
        lastUpdatedAt: new Date().toISOString(),
        version: 1,
    });

    describe('Expense Operations', () => {
        describe('applyExpenseCreated', () => {
            it('should add expense to empty balance', async () => {
                const expense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 50 },
                        { uid: userId2, amount: 50 },
                    ])
                    .build();

                const initialBalance = createEmptyBalance();
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applyExpenseCreated(mockTransaction, groupId, initialBalance, expense, [userId1, userId2]);

                // Verify balance was updated
                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                expect(updatedBalance.version).toBe(1);
                expect(updatedBalance.balancesByCurrency.USD).toBeDefined();
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(50); // User1 paid 100, owes 50
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(-50); // User2 owes 50
                expect(updatedBalance.simplifiedDebts).toHaveLength(1);
                expect(updatedBalance.simplifiedDebts[0].amount).toBe(50);
            });

            it('should add expense to existing balance', async () => {
                const expense = new ExpenseDTOBuilder()
                    .withId('expense-2')
                    .withGroupId(groupId)
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(userId2)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 30 },
                        { uid: userId2, amount: 30 },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD(); // User1 is owed $50 by User2
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applyExpenseCreated(mockTransaction, groupId, initialBalance, expense, [userId1, userId2]);

                // Verify balance was updated
                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                expect(updatedBalance.version).toBe(2);
                // User1 was owed $50, now owes $30, net = $20 owed to User1
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(20);
                // User2 owed $50, now is owed $30, net = -$20 (owes $20)
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(-20);
            });

            it('should handle three-way split correctly', async () => {
                const expense = new ExpenseDTOBuilder()
                    .withId('expense-3')
                    .withGroupId(groupId)
                    .withAmount(90)
                    .withCurrency('EUR')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2, userId3])
                    .withSplits([
                        { uid: userId1, amount: 30 },
                        { uid: userId2, amount: 30 },
                        { uid: userId3, amount: 30 },
                    ])
                    .build();

                const initialBalance = createEmptyBalance();
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applyExpenseCreated(mockTransaction, groupId, initialBalance, expense, [userId1, userId2, userId3]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                expect(updatedBalance.balancesByCurrency.EUR[userId1].netBalance).toBe(60); // Paid 90, owes 30
                expect(updatedBalance.balancesByCurrency.EUR[userId2].netBalance).toBe(-30); // Owes 30
                expect(updatedBalance.balancesByCurrency.EUR[userId3].netBalance).toBe(-30); // Owes 30
            });
        });

        describe('applyExpenseDeleted', () => {
            it('should remove expense from balance', async () => {
                const expense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 50 },
                        { uid: userId2, amount: 50 },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD(); // User1 is owed $50
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applyExpenseDeleted(mockTransaction, groupId, initialBalance, expense, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                expect(updatedBalance.version).toBe(2);
                // After removing expense: User1 owed $50, minus expense ($50 owed), net = $0
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(0);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(0);
                expect(updatedBalance.simplifiedDebts).toHaveLength(0);
            });

            it('should handle deletion leaving non-zero balance', async () => {
                // Setup: User1 is owed $50 by User2
                const initialBalance = createBalanceWithUSD();
                // Modify to have User1 owed $100 (we'll delete an expense for $50)
                initialBalance.balancesByCurrency.USD[userId1].netBalance = 100;
                initialBalance.balancesByCurrency.USD[userId1].owedBy[userId2] = 100;
                initialBalance.balancesByCurrency.USD[userId2].netBalance = -100;
                initialBalance.balancesByCurrency.USD[userId2].owes[userId1] = 100;
                await stubWriter.setGroupBalance(groupId, initialBalance);

                const expense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 50 },
                        { uid: userId2, amount: 50 },
                    ])
                    .build();

                service.applyExpenseDeleted(mockTransaction, groupId, initialBalance, expense, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // User1 was owed $100, delete expense reduces by $50, net = $50
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(50);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(-50);
            });
        });

        describe('applyExpenseUpdated', () => {
            it('should handle amount change correctly', async () => {
                const oldExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 50 },
                        { uid: userId2, amount: 50 },
                    ])
                    .build();

                const newExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(120) // Changed from 100
                    .withCurrency('USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 60 },
                        { uid: userId2, amount: 60 },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD();
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applyExpenseUpdated(mockTransaction, groupId, initialBalance, oldExpense, newExpense, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // Net change: old expense removed (-50), new expense added (+60), delta = +10
                // User1 was owed $50, now owed $60, net = $60
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(60);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(-60);
            });

            it('should handle payer change correctly', async () => {
                const oldExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 50 },
                        { uid: userId2, amount: 50 },
                    ])
                    .build();

                const newExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(userId2) // Changed payer
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 50 },
                        { uid: userId2, amount: 50 },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD();
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applyExpenseUpdated(mockTransaction, groupId, initialBalance, oldExpense, newExpense, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // Old: User1 owed $50 by User2
                // Remove old: User1 owed $50, after removal = $0
                // Add new: User2 paid, User1 owes $50
                // Net: User1 owes $50, User2 is owed $50
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(-50);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(50);
            });

            it('should handle currency change correctly', async () => {
                const oldExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 50 },
                        { uid: userId2, amount: 50 },
                    ])
                    .build();

                const newExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(80)
                    .withCurrency('EUR') // Changed currency
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: 40 },
                        { uid: userId2, amount: 40 },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD();
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applyExpenseUpdated(mockTransaction, groupId, initialBalance, oldExpense, newExpense, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // Old USD expense removed: $0 balance in USD
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(0);
                // New EUR expense added
                expect(updatedBalance.balancesByCurrency.EUR[userId1].netBalance).toBe(40);
                expect(updatedBalance.balancesByCurrency.EUR[userId2].netBalance).toBe(-40);
            });
        });
    });

    describe('Settlement Operations', () => {
        describe('applySettlementCreated', () => {
            it('should apply settlement to reduce debt', async () => {
                const settlement: SettlementDTO = {
                    id: 'settlement-1',
                    groupId,
                    payerId: userId2,
                    payeeId: userId1,
                    amount: 30,
                    currency: 'USD',
                    date: new Date().toISOString(),
                    note: 'Partial payment',
                    createdBy: userId2,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    deletedAt: null,
                    deletedBy: null,
                };

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applySettlementCreated(mockTransaction, groupId, initialBalance, settlement, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // User2 owed $50, pays $30, now owes $20
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(20);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(-20);
                expect(updatedBalance.simplifiedDebts[0].amount).toBe(20);
            });

            it('should handle full settlement to zero balance', async () => {
                const settlement: SettlementDTO = {
                    id: 'settlement-1',
                    groupId,
                    payerId: userId2,
                    payeeId: userId1,
                    amount: 50, // Full amount
                    currency: 'USD',
                    date: new Date().toISOString(),
                    note: 'Full settlement',
                    createdBy: userId2,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    deletedAt: null,
                    deletedBy: null,
                };

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applySettlementCreated(mockTransaction, groupId, initialBalance, settlement, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(0);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(0);
                expect(updatedBalance.simplifiedDebts).toHaveLength(0);
            });

            it('should handle overpayment settlement', async () => {
                const settlement: SettlementDTO = {
                    id: 'settlement-1',
                    groupId,
                    payerId: userId2,
                    payeeId: userId1,
                    amount: 70, // More than owed
                    currency: 'USD',
                    date: new Date().toISOString(),
                    note: 'Overpayment',
                    createdBy: userId2,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    deletedAt: null,
                    deletedBy: null,
                };

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applySettlementCreated(mockTransaction, groupId, initialBalance, settlement, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // User2 owed $50, pays $70, now User1 owes $20
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(-20);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(20);
            });
        });

        describe('applySettlementDeleted', () => {
            it('should reverse settlement', async () => {
                const settlement: SettlementDTO = {
                    id: 'settlement-1',
                    groupId,
                    payerId: userId2,
                    payeeId: userId1,
                    amount: 30,
                    currency: 'USD',
                    date: new Date().toISOString(),
                    note: 'Partial payment',
                    createdBy: userId2,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    deletedAt: null,
                    deletedBy: null,
                };

                // Setup: User1 is owed $20 (after a $30 settlement was applied)
                const initialBalance = createBalanceWithUSD();
                initialBalance.balancesByCurrency.USD[userId1].netBalance = 20;
                initialBalance.balancesByCurrency.USD[userId1].owedBy[userId2] = 20;
                initialBalance.balancesByCurrency.USD[userId2].netBalance = -20;
                initialBalance.balancesByCurrency.USD[userId2].owes[userId1] = 20;
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applySettlementDeleted(mockTransaction, groupId, initialBalance, settlement, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // Reversing $30 settlement: User1 owed $20, add back $30, now owed $50
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(50);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(-50);
            });
        });

        describe('applySettlementUpdated', () => {
            it('should handle settlement amount change', async () => {
                const oldSettlement: SettlementDTO = {
                    id: 'settlement-1',
                    groupId,
                    payerId: userId2,
                    payeeId: userId1,
                    amount: 30,
                    currency: 'USD',
                    date: new Date().toISOString(),
                    note: 'Original',
                    createdBy: userId2,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    deletedAt: null,
                    deletedBy: null,
                };

                const newSettlement: SettlementDTO = {
                    ...oldSettlement,
                    amount: 40, // Increased amount
                    note: 'Updated',
                };

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applySettlementUpdated(mockTransaction, groupId, initialBalance, oldSettlement, newSettlement, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // Initial: User1 owed $50
                // Reverse old $30 settlement: $50 + $30 = $80 (undoing a payment increases debt)
                // Apply new $40 settlement: $80 - $40 = $40
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(40);
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(-40);
            });

            it('should handle settlement currency change', async () => {
                const oldSettlement: SettlementDTO = {
                    id: 'settlement-1',
                    groupId,
                    payerId: userId2,
                    payeeId: userId1,
                    amount: 30,
                    currency: 'USD',
                    date: new Date().toISOString(),
                    note: 'Original',
                    createdBy: userId2,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    deletedAt: null,
                    deletedBy: null,
                };

                const newSettlement: SettlementDTO = {
                    ...oldSettlement,
                    currency: 'EUR', // Changed currency
                    note: 'Updated',
                };

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                await stubWriter.setGroupBalance(groupId, initialBalance);

                service.applySettlementUpdated(mockTransaction, groupId, initialBalance, oldSettlement, newSettlement, [userId1, userId2]);

                const updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
                // Initial: User1 owed $50 (USD)
                // Reverse old $30 USD settlement: $50 + $30 = $80
                // Apply new $30 EUR settlement: EUR goes from 0 to User1 owes EUR 30
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(80);
                // New EUR settlement applied
                expect(updatedBalance.balancesByCurrency.EUR[userId1].netBalance).toBe(-30);
                expect(updatedBalance.balancesByCurrency.EUR[userId2].netBalance).toBe(30);
            });
        });
    });

    describe('Version Tracking', () => {
        it('should increment version on each operation', async () => {
            const expense = new ExpenseDTOBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withAmount(100)
                .withCurrency('USD')
                .withPaidBy(userId1)
                .withSplitType('equal')
                .withParticipants([userId1, userId2])
                .withSplits([
                    { uid: userId1, amount: 50 },
                    { uid: userId2, amount: 50 },
                ])
                .build();

            const initialBalance = createEmptyBalance();
            await stubWriter.setGroupBalance(groupId, initialBalance);

            // Version 0 initially
            let balance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
            expect(balance.version).toBe(0);

            // Apply expense - version 1
            service.applyExpenseCreated(mockTransaction, groupId, balance, expense, [userId1, userId2]);
            balance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
            expect(balance.version).toBe(1);

            // Delete expense - version 2
            service.applyExpenseDeleted(mockTransaction, groupId, balance, expense, [userId1, userId2]);
            balance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);
            expect(balance.version).toBe(2);
        });
    });

    describe('Multi-Currency Scenarios', () => {
        it('should handle expenses in different currencies independently', async () => {
            const usdExpense = new ExpenseDTOBuilder()
                .withId('expense-usd')
                .withGroupId(groupId)
                .withAmount(100)
                .withCurrency('USD')
                .withPaidBy(userId1)
                .withSplitType('equal')
                .withParticipants([userId1, userId2])
                .withSplits([
                    { uid: userId1, amount: 50 },
                    { uid: userId2, amount: 50 },
                ])
                .build();

            const eurExpense = new ExpenseDTOBuilder()
                .withId('expense-eur')
                .withGroupId(groupId)
                .withAmount(80)
                .withCurrency('EUR')
                .withPaidBy(userId2)
                .withSplitType('equal')
                .withParticipants([userId1, userId2])
                .withSplits([
                    { uid: userId1, amount: 40 },
                    { uid: userId2, amount: 40 },
                ])
                .build();

            const initialBalance = createEmptyBalance();
            await stubWriter.setGroupBalance(groupId, initialBalance);

            // Apply first expense
            service.applyExpenseCreated(mockTransaction, groupId, initialBalance, usdExpense, [userId1, userId2]);
            let updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // Apply second expense
            service.applyExpenseCreated(mockTransaction, groupId, updatedBalance, eurExpense, [userId1, userId2]);
            updatedBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // USD: User1 is owed $50
            expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe(50);
            expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe(-50);
            // EUR: User2 is owed €40
            expect(updatedBalance.balancesByCurrency.EUR[userId1].netBalance).toBe(-40);
            expect(updatedBalance.balancesByCurrency.EUR[userId2].netBalance).toBe(40);
            // Should have 2 debts (one per currency)
            expect(updatedBalance.simplifiedDebts).toHaveLength(2);
        });
    });
});

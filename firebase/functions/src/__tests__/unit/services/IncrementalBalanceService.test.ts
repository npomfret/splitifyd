import { calculateEqualSplits } from '@splitifyd/shared';
import { ExpenseDTOBuilder, GroupBalanceDTOBuilder, SettlementDTOBuilder, SimplifiedDebtBuilder, StubFirestoreDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupBalanceDTO } from '../../../schemas';
import { IncrementalBalanceService } from '../../../services/balance/IncrementalBalanceService';
import { FirestoreWriter } from '../../../services/firestore';

describe('IncrementalBalanceService - Unit Tests', () => {
    let service: IncrementalBalanceService;
    let stubDb: StubFirestoreDatabase;

    const groupId = 'test-group-id';
    const userId1 = 'user-1';
    const userId2 = 'user-2';
    const userId3 = 'user-3';

    beforeEach(() => {
        stubDb = new StubFirestoreDatabase();
        service = new IncrementalBalanceService(new FirestoreWriter(stubDb));
    });

    const createEmptyBalance = (): GroupBalanceDTO => new GroupBalanceDTOBuilder(groupId).build();

    const createBalanceWithUSD = (): GroupBalanceDTO =>
        new GroupBalanceDTOBuilder(groupId)
            .withVersion(1)
            .withUserBalance('USD', userId1, {
                netBalance: '50',
                owedBy: { [userId2]: '50' },
            })
            .withUserBalance('USD', userId2, {
                netBalance: '-50',
                owes: { [userId1]: '50' },
            })
            .withSimplifiedDebt(
                new SimplifiedDebtBuilder()
                    .from(userId2)
                    .to(userId1)
                    .withAmount(50, 'USD')
                    .build(),
            )
            .build();

    const getBalance = async (): Promise<GroupBalanceDTO> => {
        return await stubDb.runTransaction(async (transaction) => {
            const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
            const balanceSnap = await transaction.get(balanceRef);
            return balanceSnap.data();
        });
    };

    describe('Expense Operations', () => {
        describe('applyExpenseCreated', () => {
            it('should add expense to empty balance', async () => {
                const expense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '50' },
                        { uid: userId2, amount: '50' },
                    ])
                    .build();

                const initialBalance = createEmptyBalance();
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseCreated(transaction, groupId, initialBalance, expense, [userId1, userId2]);
                });

                // Verify balance was updated
                const updatedBalance = await getBalance();
                expect(updatedBalance.version).toBe(1);
                expect(updatedBalance.balancesByCurrency.USD).toBeDefined();
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('50.00'); // User1 paid 100, owes 50
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('-50.00'); // User2 owes 50
                expect(updatedBalance.simplifiedDebts).toHaveLength(1);
                expect(updatedBalance.simplifiedDebts[0].amount).toBe('50.00');
            });

            it('should add expense to existing balance', async () => {
                const expense = new ExpenseDTOBuilder()
                    .withId('expense-2')
                    .withGroupId(groupId)
                    .withAmount(60, 'USD')
                    .withPaidBy(userId2)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '30' },
                        { uid: userId2, amount: '30' },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD(); // User1 is owed $50 by User2
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseCreated(transaction, groupId, initialBalance, expense, [userId1, userId2]);
                });

                // Verify balance was updated
                const updatedBalance = await getBalance();
                expect(updatedBalance.version).toBe(2);
                // User1 was owed $50, now owes $30, net = $20 owed to User1
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('20.00');
                // User2 owed $50, now is owed $30, net = -$20 (owes $20)
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('-20.00');
            });

            it('should handle three-way split correctly', async () => {
                const expense = new ExpenseDTOBuilder()
                    .withId('expense-3')
                    .withGroupId(groupId)
                    .withAmount(90, 'EUR')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2, userId3])
                    .withSplits([
                        { uid: userId1, amount: '30' },
                        { uid: userId2, amount: '30' },
                        { uid: userId3, amount: '30' },
                    ])
                    .build();

                const initialBalance = createEmptyBalance();
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseCreated(transaction, groupId, initialBalance, expense, [userId1, userId2, userId3]);
                });

                const updatedBalance = await getBalance();
                expect(updatedBalance.balancesByCurrency.EUR[userId1].netBalance).toBe('60.00'); // Paid 90, owes 30
                expect(updatedBalance.balancesByCurrency.EUR[userId2].netBalance).toBe('-30.00'); // Owes 30
                expect(updatedBalance.balancesByCurrency.EUR[userId3].netBalance).toBe('-30.00'); // Owes 30
            });
        });

        describe('applyExpenseDeleted', () => {
            it('should remove expense from balance', async () => {
                const expense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '50' },
                        { uid: userId2, amount: '50' },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD(); // User1 is owed $50
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseDeleted(transaction, groupId, initialBalance, expense, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                expect(updatedBalance.version).toBe(2);
                // After removing expense: User1 owed $50, minus expense ($50 owed), net = $0
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('0.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('0.00');
                expect(updatedBalance.simplifiedDebts).toHaveLength(0);
            });

            it('should handle deletion leaving non-zero balance', async () => {
                // Setup: User1 is owed $50 by User2
                const initialBalance = createBalanceWithUSD();
                // Modify to have User1 owed $100 (we'll delete an expense for $50)
                initialBalance.balancesByCurrency.USD[userId1].netBalance = '100';
                initialBalance.balancesByCurrency.USD[userId1].owedBy[userId2] = '100';
                initialBalance.balancesByCurrency.USD[userId2].netBalance = '-100';
                initialBalance.balancesByCurrency.USD[userId2].owes[userId1] = '100';
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                const expense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '50' },
                        { uid: userId2, amount: '50' },
                    ])
                    .build();

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseDeleted(transaction, groupId, initialBalance, expense, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // User1 was owed $100, delete expense reduces by $50, net = $50
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('50.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('-50.00');
            });

            it('should flip owes/owedBy when deleting expense leaving settlement debt', async () => {
                const currency = 'EUR';
                const participants = [userId1, userId2];

                const currentBalance = new GroupBalanceDTOBuilder(groupId)
                    .withGroupId(groupId)
                    .withUserBalance(currency, userId1, {
                        uid: userId1,
                        owes: {},
                        owedBy: { [userId2]: '25.00' },
                        netBalance: '25.00',
                    })
                    .withUserBalance(currency, userId2, {
                        uid: userId2,
                        owes: { [userId1]: '25.00' },
                        owedBy: {},
                        netBalance: '-25.00',
                    })
                    .build();

                stubDb.seed(`groups/${groupId}/metadata/balance`, currentBalance);

                const expense = new ExpenseDTOBuilder()
                    .withId('expense-eur')
                    .withGroupId(groupId)
                    .withAmount(150.5, currency)
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(150.5, currency, participants))
                    .build();

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseDeleted(transaction, groupId, currentBalance, expense, participants);
                });

                const updatedBalance = await getBalance();
                const eurBalances = updatedBalance.balancesByCurrency?.EUR;
                expect(eurBalances).toBeDefined();
                expect(eurBalances![userId1].owes[userId2]).toBe('50.25');
                expect(eurBalances![userId1].owedBy[userId2]).toBeUndefined();
                expect(eurBalances![userId2].owedBy[userId1]).toBe('50.25');
                expect(eurBalances![userId2].owes[userId1]).toBeUndefined();
            });

            it('should reproduce expense lifecycle debt expectations', async () => {
                const currency = 'EUR';
                const participants = [userId1, userId2];

                const initialBalance = createEmptyBalance();
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                const originalExpense = new ExpenseDTOBuilder()
                    .withId('expense-lifecycle')
                    .withGroupId(groupId)
                    .withAmount(100, currency)
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(100, currency, participants))
                    .build();

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseCreated(transaction, groupId, initialBalance, originalExpense, participants);
                });
                const balanceAfterCreate = await getBalance();

                const updatedExpense = new ExpenseDTOBuilder()
                    .withId('expense-lifecycle')
                    .withGroupId(groupId)
                    .withAmount(150.5, currency)
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(150.5, currency, participants))
                    .build();

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseUpdated(transaction, groupId, balanceAfterCreate, originalExpense, updatedExpense, participants);
                });
                const balanceAfterUpdate = await getBalance();

                const settlement = new SettlementDTOBuilder()
                    .withId('settlement-lifecycle')
                    .withGroupId(groupId)
                    .withAmount(50.25, currency)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .build();

                await stubDb.runTransaction(async (transaction) => {
                    service.applySettlementCreated(transaction, groupId, balanceAfterUpdate, settlement, participants);
                });
                const balanceAfterSettlement = await getBalance();

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseDeleted(transaction, groupId, balanceAfterSettlement, updatedExpense, participants);
                });

                const finalBalance = await getBalance();
                const eurBalances = finalBalance.balancesByCurrency?.EUR;
                expect(eurBalances).toBeDefined();
                expect(eurBalances![userId1].owes[userId2]).toBe('50.25');
                expect(eurBalances![userId2].owedBy[userId1]).toBe('50.25');
            });
        });

        describe('applyExpenseUpdated', () => {
            it('should handle amount change correctly', async () => {
                const oldExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '50' },
                        { uid: userId2, amount: '50' },
                    ])
                    .build();

                const newExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(120, 'USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '60' },
                        { uid: userId2, amount: '60' },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD();
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseUpdated(transaction, groupId, initialBalance, oldExpense, newExpense, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // Net change: old expense removed (-50), new expense added (+60), delta = +10
                // User1 was owed $50, now owed $60, net = $60
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('60.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('-60.00');
            });

            it('should handle payer change correctly', async () => {
                const oldExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '50' },
                        { uid: userId2, amount: '50' },
                    ])
                    .build();

                const newExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(userId2) // Changed payer
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '50' },
                        { uid: userId2, amount: '50' },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD();
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseUpdated(transaction, groupId, initialBalance, oldExpense, newExpense, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // Old: User1 owed $50 by User2
                // Remove old: User1 owed $50, after removal = $0
                // Add new: User2 paid, User1 owes $50
                // Net: User1 owes $50, User2 is owed $50
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('-50.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('50.00');
            });

            it('should handle currency change correctly', async () => {
                const oldExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '50' },
                        { uid: userId2, amount: '50' },
                    ])
                    .build();

                const newExpense = new ExpenseDTOBuilder()
                    .withId('expense-1')
                    .withGroupId(groupId)
                    .withAmount(80, 'EUR') // Changed currency
                    .withPaidBy(userId1)
                    .withSplitType('equal')
                    .withParticipants([userId1, userId2])
                    .withSplits([
                        { uid: userId1, amount: '40' },
                        { uid: userId2, amount: '40' },
                    ])
                    .build();

                const initialBalance = createBalanceWithUSD();
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applyExpenseUpdated(transaction, groupId, initialBalance, oldExpense, newExpense, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // Old USD expense removed: $0 balance in USD
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('0.00');
                // New EUR expense added
                expect(updatedBalance.balancesByCurrency.EUR[userId1].netBalance).toBe('40.00');
                expect(updatedBalance.balancesByCurrency.EUR[userId2].netBalance).toBe('-40.00');
            });
        });
    });

    describe('Settlement Operations', () => {
        describe('applySettlementCreated', () => {
            it('should apply settlement to reduce debt', async () => {
                const settlement = new SettlementDTOBuilder()
                    .withId('settlement-1')
                    .withGroupId(groupId)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .withAmount(30, 'USD')
                    .withCreatedBy(userId2)
                    .build();

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applySettlementCreated(transaction, groupId, initialBalance, settlement, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // User2 owed $50, pays $30, now owes $20
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('20.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('-20.00');
                expect(updatedBalance.simplifiedDebts[0].amount).toBe('20.00');
            });

            it('should handle full settlement to zero balance', async () => {
                const settlement = new SettlementDTOBuilder()
                    .withId('settlement-1')
                    .withGroupId(groupId)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .withAmount(50, 'USD')
                    .withCreatedBy(userId2)
                    .build();

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applySettlementCreated(transaction, groupId, initialBalance, settlement, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('0.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('0.00');
                expect(updatedBalance.simplifiedDebts).toHaveLength(0);
            });

            it('should handle overpayment settlement', async () => {
                const settlement = new SettlementDTOBuilder()
                    .withId('settlement-1')
                    .withGroupId(groupId)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .withAmount(70, 'USD')
                    .withCreatedBy(userId2)
                    .build();

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applySettlementCreated(transaction, groupId, initialBalance, settlement, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // User2 owed $50, pays $70, now User1 owes $20
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('-20.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('20.00');
            });
        });

        describe('applySettlementDeleted', () => {
            it('should reverse settlement', async () => {
                const settlement = new SettlementDTOBuilder()
                    .withId('settlement-1')
                    .withGroupId(groupId)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .withAmount(30, 'USD')
                    .withCreatedBy(userId2)
                    .build();

                // Setup: User1 is owed $20 (after a $30 settlement was applied)
                const initialBalance = createBalanceWithUSD();
                initialBalance.balancesByCurrency.USD[userId1].netBalance = '20';
                initialBalance.balancesByCurrency.USD[userId1].owedBy[userId2] = '20';
                initialBalance.balancesByCurrency.USD[userId2].netBalance = '-20';
                initialBalance.balancesByCurrency.USD[userId2].owes[userId1] = '20';
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applySettlementDeleted(transaction, groupId, initialBalance, settlement, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // Reversing $30 settlement: User1 owed $20, add back $30, now owed $50
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('50.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('-50.00');
            });
        });

        describe('applySettlementUpdated', () => {
            it('should handle settlement amount change', async () => {
                const oldSettlement = new SettlementDTOBuilder()
                    .withId('settlement-1')
                    .withGroupId(groupId)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .withAmount(30, 'USD')
                    .withCreatedBy(userId2)
                    .build();

                const newSettlement = new SettlementDTOBuilder()
                    .withId('settlement-1')
                    .withGroupId(groupId)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .withAmount(40, 'USD')
                    .withCreatedBy(userId2)
                    .build();

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applySettlementUpdated(transaction, groupId, initialBalance, oldSettlement, newSettlement, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // Initial: User1 owed $50
                // Reverse old $30 settlement: $50 + $30 = $80 (undoing a payment increases debt)
                // Apply new $40 settlement: $80 - $40 = $40
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('40.00');
                expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('-40.00');
            });

            it('should handle settlement currency change', async () => {
                const oldSettlement = new SettlementDTOBuilder()
                    .withId('settlement-1')
                    .withGroupId(groupId)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .withAmount(30, 'USD')
                    .withCreatedBy(userId2)
                    .build();

                const newSettlement = new SettlementDTOBuilder()
                    .withId('settlement-1')
                    .withGroupId(groupId)
                    .withPayerId(userId2)
                    .withPayeeId(userId1)
                    .withAmount(30, 'EUR') // Changed currency
                    .withCreatedBy(userId2)
                    .build();

                const initialBalance = createBalanceWithUSD(); // User2 owes User1 $50
                stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

                await stubDb.runTransaction(async (transaction) => {
                    service.applySettlementUpdated(transaction, groupId, initialBalance, oldSettlement, newSettlement, [userId1, userId2]);
                });

                const updatedBalance = await getBalance();
                // Initial: User1 owed $50 (USD)
                // Reverse old $30 USD settlement: $50 + $30 = $80
                // Apply new $30 EUR settlement: EUR goes from 0 to User1 owes EUR 30
                expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('80.00');
                // New EUR settlement applied
                expect(updatedBalance.balancesByCurrency.EUR[userId1].netBalance).toBe('-30.00');
                expect(updatedBalance.balancesByCurrency.EUR[userId2].netBalance).toBe('30.00');
            });
        });
    });

    describe('Version Tracking', () => {
        it('should increment version on each operation', async () => {
            const expense = new ExpenseDTOBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withAmount(100, 'USD')
                .withPaidBy(userId1)
                .withSplitType('equal')
                .withParticipants([userId1, userId2])
                .withSplits([
                    { uid: userId1, amount: '50' },
                    { uid: userId2, amount: '50' },
                ])
                .build();

            const initialBalance = createEmptyBalance();
            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // Version 0 initially
            let balance = await getBalance();
            expect(balance.version).toBe(0);

            // Apply expense - version 1
            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseCreated(transaction, groupId, balance, expense, [userId1, userId2]);
            });
            balance = await getBalance();
            expect(balance.version).toBe(1);

            // Delete expense - version 2
            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseDeleted(transaction, groupId, balance, expense, [userId1, userId2]);
            });
            balance = await getBalance();
            expect(balance.version).toBe(2);
        });
    });

    describe('Multi-Currency Scenarios', () => {
        it('should handle expenses in different currencies independently', async () => {
            const usdExpense = new ExpenseDTOBuilder()
                .withId('expense-usd')
                .withGroupId(groupId)
                .withAmount(100, 'USD')
                .withPaidBy(userId1)
                .withSplitType('equal')
                .withParticipants([userId1, userId2])
                .withSplits([
                    { uid: userId1, amount: '50' },
                    { uid: userId2, amount: '50' },
                ])
                .build();

            const eurExpense = new ExpenseDTOBuilder()
                .withId('expense-eur')
                .withGroupId(groupId)
                .withAmount(80, 'EUR')
                .withPaidBy(userId2)
                .withSplitType('equal')
                .withParticipants([userId1, userId2])
                .withSplits([
                    { uid: userId1, amount: '40' },
                    { uid: userId2, amount: '40' },
                ])
                .build();

            const initialBalance = createEmptyBalance();
            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // Apply first expense
            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseCreated(transaction, groupId, initialBalance, usdExpense, [userId1, userId2]);
            });
            let updatedBalance = await getBalance();

            // Apply second expense
            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseCreated(transaction, groupId, updatedBalance, eurExpense, [userId1, userId2]);
            });
            updatedBalance = await getBalance();

            // USD: User1 is owed $50
            expect(updatedBalance.balancesByCurrency.USD[userId1].netBalance).toBe('50.00');
            expect(updatedBalance.balancesByCurrency.USD[userId2].netBalance).toBe('-50.00');
            // EUR: User2 is owed €40
            expect(updatedBalance.balancesByCurrency.EUR[userId1].netBalance).toBe('-40.00');
            expect(updatedBalance.balancesByCurrency.EUR[userId2].netBalance).toBe('40.00');
            // Should have 2 debts (one per currency)
            expect(updatedBalance.simplifiedDebts).toHaveLength(2);
        });
    });
});

import type { SimplifiedDebt } from '@splitifyd/shared';
import { ExpenseDTOBuilder, GroupBalanceDTOBuilder, SettlementDTOBuilder, SimplifiedDebtBuilder, StubFirestoreDatabase, UserBalanceBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { IncrementalBalanceService } from '../../../services/balance/IncrementalBalanceService';
import { FirestoreWriter } from '../../../services/firestore';

/**
 * IncrementalBalanceService - Scenario Tests
 *
 * These tests verify complex business logic scenarios that were previously tested
 * at the integration level. By testing directly against the service, we achieve:
 * - 100-1000x faster execution (no Firebase emulator, HTTP, or API overhead)
 * - More precise failure diagnosis (failures pinpoint exact calculation logic)
 * - Simpler test setup (direct service calls vs. API driver)
 */
describe('IncrementalBalanceService - Scenarios', () => {
    let service: IncrementalBalanceService;
    let stubDb: StubFirestoreDatabase;
    let writer: FirestoreWriter;

    const groupId = 'test-group-id';
    const user1 = 'user-1';
    const user2 = 'user-2';

    beforeEach(() => {
        stubDb = new StubFirestoreDatabase();
        writer = new FirestoreWriter(stubDb);
        service = new IncrementalBalanceService(writer);
    });

    describe('Mixed Currency Settlements', () => {
        /**
         * CRITICAL SCENARIO: Mixed Currency Non-Conversion
         *
         * Problem: When users settle debts in a different currency than the original
         * expense, the system must NOT perform currency conversion.
         *
         * Expected Behavior:
         * - Original currency debt remains unchanged
         * - New currency debt is created in the settlement currency
         * - NO automatic currency conversion occurs
         *
         * This test reproduced a production bug where EUR settlements were incorrectly
         * reducing USD debts using an implicit exchange rate.
         */
        it('should handle mixed currency settlements without currency conversion', async () => {
            // === SETUP ===
            // Start with empty balance and create USD expense
            const initialBalance = new GroupBalanceDTOBuilder(groupId).withVersion(0).build();
            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // User1 pays $200 expense → User2 owes User1 $100
            const usdExpense = new ExpenseDTOBuilder()
                .withId('expense-usd')
                .withGroupId(groupId)
                .withAmount(200)
                .withCurrency('USD')
                .withPaidBy(user1)
                .withSplitType('equal')
                .withParticipants([user1, user2])
                .withSplits([
                    { uid: user1, amount: '100' },
                    { uid: user2, amount: '100' },
                ])
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseCreated(transaction, groupId, initialBalance, usdExpense, [user1, user2]);
            });

            let currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // Verify expense was applied correctly
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe('-100.00');

            // === ACTION ===
            // User2 makes settlement in EUR (different currency than debt)
            const eurSettlement = new SettlementDTOBuilder()
                .withId('settlement-eur')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(75)
                .withCurrency('EUR') // DIFFERENT from debt currency (USD)
                .withNote('EUR Settlement for USD Debt')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, currentBalance, eurSettlement, [user1, user2]);
            });

            // === ASSERT ===
            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // USD debt should be UNCHANGED (no currency conversion)
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('-100.00');
            expect(finalBalance.balancesByCurrency.USD[user2].owes[user1]).toBe('100.00');
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe('100.00');
            expect(finalBalance.balancesByCurrency.USD[user1].owedBy[user2]).toBe('100.00');

            // NEW EUR debt should exist (User2 paid User1 €75, so User1 now owes User2 €75)
            expect(finalBalance.balancesByCurrency.EUR).toBeDefined();
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe('-75.00');
            expect(finalBalance.balancesByCurrency.EUR[user1].owes[user2]).toBe('75.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe('75.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].owedBy[user1]).toBe('75.00');

            // Should have TWO separate simplified debts (one per currency)
            expect(finalBalance.simplifiedDebts).toHaveLength(2);

            const usdDebt = finalBalance.simplifiedDebts.find((debt: SimplifiedDebt) => debt.currency === 'USD');
            expect(usdDebt).toBeDefined();
            expect(usdDebt?.from.uid).toBe(user2);
            expect(usdDebt?.to.uid).toBe(user1);
            expect(usdDebt?.amount).toBe('100.00');

            const eurDebt = finalBalance.simplifiedDebts.find((debt: SimplifiedDebt) => debt.currency === 'EUR');
            expect(eurDebt).toBeDefined();
            expect(eurDebt?.from.uid).toBe(user1);
            expect(eurDebt?.to.uid).toBe(user2);
            expect(eurDebt?.amount).toBe('75.00');
        });

        it('should not perform implicit currency conversion on settlements', async () => {
            // === SETUP ===
            // Complex scenario: Multiple expenses creating USD debt
            const initialBalance = new GroupBalanceDTOBuilder(groupId).withVersion(0).build();
            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // Expense 1: User1 pays $150, User2 owes $75
            const expense1 = new ExpenseDTOBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withAmount(150)
                .withCurrency('USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplits([
                    { uid: user1, amount: '75' },
                    { uid: user2, amount: '75' },
                ])
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseCreated(transaction, groupId, initialBalance, expense1, [user1, user2]);
            });

            let currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // Expense 2: User1 pays $50, User2 owes additional $25
            const expense2 = new ExpenseDTOBuilder()
                .withId('expense-2')
                .withGroupId(groupId)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplits([
                    { uid: user1, amount: '25' },
                    { uid: user2, amount: '25' },
                ])
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseCreated(transaction, groupId, currentBalance, expense2, [user1, user2]);
            });

            currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // User2 now owes User1 exactly $100 USD
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe('-100.00');

            // === ACTION ===
            // User2 settles with €75 EUR
            const eurSettlement = new SettlementDTOBuilder()
                .withId('settlement-1')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(75)
                .withCurrency('EUR')
                .withNote('Testing Currency Conversion Bug')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, currentBalance, eurSettlement, [user1, user2]);
            });

            // === ASSERT ===
            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // CRITICAL ASSERTION: USD debt must still be $100
            // If this fails with $25 remaining, currency conversion occurred (BUG)
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('-100.00');
            expect(finalBalance.balancesByCurrency.USD[user2].owes[user1]).toBe('100.00');

            // EUR debt should exist from settlement
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe('-75.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe('75.00');
        });

        it('should maintain currency independence in complex multi-currency scenarios', async () => {
            // === SETUP ===
            // Start with existing debts in USD and GBP
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withUserBalance(
                    'USD',
                    user1,
                    new UserBalanceBuilder().withUserId(user1).owedByUser(user2, 50).withNetBalance(50).build(),
                )
                .withUserBalance(
                    'USD',
                    user2,
                    new UserBalanceBuilder().withUserId(user2).owesUser(user1, 50).withNetBalance(-50).build(),
                )
                .withUserBalance(
                    'GBP',
                    user1,
                    new UserBalanceBuilder().withUserId(user1).owesUser(user2, 30).withNetBalance(-30).build(),
                )
                .withUserBalance(
                    'GBP',
                    user2,
                    new UserBalanceBuilder().withUserId(user2).owedByUser(user1, 30).withNetBalance(30).build(),
                )
                .withSimplifiedDebt(
                    new SimplifiedDebtBuilder()
                        .from(user2)
                        .to(user1)
                        .withAmount(50)
                        .withCurrency('USD')
                        .build(),
                )
                .withSimplifiedDebt(
                    new SimplifiedDebtBuilder()
                        .from(user1)
                        .to(user2)
                        .withAmount(30)
                        .withCurrency('GBP')
                        .build(),
                )
                .withVersion(5)
                .build();

            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // === ACTION ===
            // User2 makes EUR settlement
            const eurSettlement = new SettlementDTOBuilder()
                .withId('settlement-eur')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(100)
                .withCurrency('EUR')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, initialBalance, eurSettlement, [user1, user2]);
            });

            // === ASSERT ===
            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // USD and GBP debts should be completely unchanged
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('-50');
            expect(finalBalance.balancesByCurrency.GBP[user1].netBalance).toBe('-30');

            // EUR debt should be newly created
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe('-100.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe('100.00');

            // Should have 3 separate currency debts
            expect(finalBalance.simplifiedDebts).toHaveLength(3);
            expect(finalBalance.simplifiedDebts.filter((d: SimplifiedDebt) => d.currency === 'USD')).toHaveLength(1);
            expect(finalBalance.simplifiedDebts.filter((d: SimplifiedDebt) => d.currency === 'GBP')).toHaveLength(1);
            expect(finalBalance.simplifiedDebts.filter((d: SimplifiedDebt) => d.currency === 'EUR')).toHaveLength(1);
        });
    });

    describe('Partial and Overpayment Settlement Scenarios', () => {
        it('should handle partial settlement in same currency correctly', async () => {
            // === SETUP ===
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withSimpleUSDDebt(user1, user2, 100)
                .build();

            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // === ACTION ===
            // User2 pays partial amount
            const partialSettlement = new SettlementDTOBuilder()
                .withId('settlement-partial')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(60)
                .withCurrency('USD')
                .withNote('Partial payment')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, initialBalance, partialSettlement, [user1, user2]);
            });

            // === ASSERT ===
            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // Debt reduced by settlement amount
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('-40.00');
            expect(finalBalance.balancesByCurrency.USD[user2].owes[user1]).toBe('40.00');
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe('40.00');
            expect(finalBalance.balancesByCurrency.USD[user1].owedBy[user2]).toBe('40.00');

            expect(finalBalance.simplifiedDebts).toHaveLength(1);
            expect(finalBalance.simplifiedDebts[0].amount).toBe('40.00');
        });

        it('should handle multiple sequential partial settlements correctly', async () => {
            // === SETUP ===
            // User2 owes User1 €100
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withUserBalance(
                    'EUR',
                    user1,
                    new UserBalanceBuilder().withUserId(user1).owedByUser(user2, 100).withNetBalance(100).build(),
                )
                .withUserBalance(
                    'EUR',
                    user2,
                    new UserBalanceBuilder().withUserId(user2).owesUser(user1, 100).withNetBalance(-100).build(),
                )
                .withSimplifiedDebt(
                    new SimplifiedDebtBuilder()
                        .from(user2)
                        .to(user1)
                        .withAmount(100)
                        .withCurrency('EUR')
                        .build(),
                )
                .build();

            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // === ACTION 1 ===
            // First partial settlement: User2 pays €40 (40% of debt)
            const settlement1 = new SettlementDTOBuilder()
                .withId('settlement-1')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(40)
                .withCurrency('EUR')
                .withNote('Partial payment 1 of 3')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, initialBalance, settlement1, [user1, user2]);
            });

            let currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // === ASSERT AFTER FIRST SETTLEMENT ===
            // Debt should be reduced to €60
            expect(currentBalance.balancesByCurrency.EUR[user2].netBalance).toBe('-60.00');
            expect(currentBalance.balancesByCurrency.EUR[user2].owes[user1]).toBe('60.00');
            expect(currentBalance.balancesByCurrency.EUR[user1].netBalance).toBe('60.00');
            expect(currentBalance.balancesByCurrency.EUR[user1].owedBy[user2]).toBe('60.00');
            expect(currentBalance.simplifiedDebts).toHaveLength(1);
            expect(currentBalance.simplifiedDebts[0].amount).toBe('60.00');

            // === ACTION 2 ===
            // Second partial settlement: User2 pays €35
            const settlement2 = new SettlementDTOBuilder()
                .withId('settlement-2')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(35)
                .withCurrency('EUR')
                .withNote('Partial payment 2 of 3')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, currentBalance, settlement2, [user1, user2]);
            });

            currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // === ASSERT AFTER SECOND SETTLEMENT ===
            // Debt should be reduced to €25
            expect(currentBalance.balancesByCurrency.EUR[user2].netBalance).toBe('-25.00');
            expect(currentBalance.balancesByCurrency.EUR[user2].owes[user1]).toBe('25.00');
            expect(currentBalance.balancesByCurrency.EUR[user1].netBalance).toBe('25.00');
            expect(currentBalance.balancesByCurrency.EUR[user1].owedBy[user2]).toBe('25.00');
            expect(currentBalance.simplifiedDebts).toHaveLength(1);
            expect(currentBalance.simplifiedDebts[0].amount).toBe('25.00');

            // === ACTION 3 ===
            // Final settlement: User2 pays remaining €25
            const settlement3 = new SettlementDTOBuilder()
                .withId('settlement-3')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(25)
                .withCurrency('EUR')
                .withNote('Final settlement payment')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, currentBalance, settlement3, [user1, user2]);
            });

            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // === ASSERT AFTER FINAL SETTLEMENT ===
            // All debts should be cleared (fully settled)
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe('0.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe('0.00');
            expect(Object.keys(finalBalance.balancesByCurrency.EUR[user1].owes)).toHaveLength(0);
            expect(Object.keys(finalBalance.balancesByCurrency.EUR[user1].owedBy)).toHaveLength(0);
            expect(Object.keys(finalBalance.balancesByCurrency.EUR[user2].owes)).toHaveLength(0);
            expect(Object.keys(finalBalance.balancesByCurrency.EUR[user2].owedBy)).toHaveLength(0);
            expect(finalBalance.simplifiedDebts).toHaveLength(0);
        });

        it('should handle overpayment settlement creating reverse debt', async () => {
            // === SETUP ===
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withSimpleUSDDebt(user1, user2, 100)
                .build();

            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // === ACTION ===
            // User2 overpays
            const overpaymentSettlement = new SettlementDTOBuilder()
                .withId('settlement-overpay')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(150) // $50 more than owed
                .withCurrency('USD')
                .withNote('Overpayment')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, initialBalance, overpaymentSettlement, [user1, user2]);
            });

            // === ASSERT ===
            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // Debt reversed: User1 now owes User2 $50
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe('-50.00');
            expect(finalBalance.balancesByCurrency.USD[user1].owes[user2]).toBe('50.00');
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('50.00');
            expect(finalBalance.balancesByCurrency.USD[user2].owedBy[user1]).toBe('50.00');

            expect(finalBalance.simplifiedDebts).toHaveLength(1);
            expect(finalBalance.simplifiedDebts[0].from.uid).toBe(user1);
            expect(finalBalance.simplifiedDebts[0].to.uid).toBe(user2);
            expect(finalBalance.simplifiedDebts[0].amount).toBe('50.00');
        });

        it('should handle exact settlement resulting in zero balance', async () => {
            // === SETUP ===
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withSimpleUSDDebt(user1, user2, 100)
                .build();

            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // === ACTION ===
            // User2 pays exact amount owed
            const exactSettlement = new SettlementDTOBuilder()
                .withId('settlement-exact')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(100)
                .withCurrency('USD')
                .withNote('Full settlement')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, initialBalance, exactSettlement, [user1, user2]);
            });

            // === ASSERT ===
            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // All debts cleared
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe('0.00');
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('0.00');
            expect(Object.keys(finalBalance.balancesByCurrency.USD[user1].owes)).toHaveLength(0);
            expect(Object.keys(finalBalance.balancesByCurrency.USD[user1].owedBy)).toHaveLength(0);
            expect(Object.keys(finalBalance.balancesByCurrency.USD[user2].owes)).toHaveLength(0);
            expect(Object.keys(finalBalance.balancesByCurrency.USD[user2].owedBy)).toHaveLength(0);

            expect(finalBalance.simplifiedDebts).toHaveLength(0);
        });

        it('should handle partial settlements across multiple currencies independently', async () => {
            // === SETUP ===
            // Create complex multi-currency scenario:
            // - User2 owes User1 $100 USD
            // - User1 owes User2 €75 EUR
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withUserBalance(
                    'USD',
                    user1,
                    new UserBalanceBuilder().withUserId(user1).owedByUser(user2, 100).withNetBalance(100).build(),
                )
                .withUserBalance(
                    'USD',
                    user2,
                    new UserBalanceBuilder().withUserId(user2).owesUser(user1, 100).withNetBalance(-100).build(),
                )
                .withUserBalance(
                    'EUR',
                    user1,
                    new UserBalanceBuilder().withUserId(user1).owesUser(user2, 75).withNetBalance(-75).build(),
                )
                .withUserBalance(
                    'EUR',
                    user2,
                    new UserBalanceBuilder().withUserId(user2).owedByUser(user1, 75).withNetBalance(75).build(),
                )
                .withSimplifiedDebt(
                    new SimplifiedDebtBuilder()
                        .from(user2)
                        .to(user1)
                        .withAmount(100)
                        .withCurrency('USD')
                        .build(),
                )
                .withSimplifiedDebt(
                    new SimplifiedDebtBuilder()
                        .from(user1)
                        .to(user2)
                        .withAmount(75)
                        .withCurrency('EUR')
                        .build(),
                )
                .build();

            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // === ACTION 1 ===
            // Partial USD settlement: User2 pays User1 $60 USD
            const usdSettlement = new SettlementDTOBuilder()
                .withId('settlement-usd')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(60)
                .withCurrency('USD')
                .withNote('Partial USD settlement')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, initialBalance, usdSettlement, [user1, user2]);
            });

            let currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // === ASSERT AFTER USD SETTLEMENT ===
            // USD debt reduced to $40, EUR debt unchanged at €75
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe('-40.00');
            expect(currentBalance.balancesByCurrency.USD[user2].owes[user1]).toBe('40.00');
            expect(currentBalance.balancesByCurrency.USD[user1].netBalance).toBe('40.00');
            expect(currentBalance.balancesByCurrency.USD[user1].owedBy[user2]).toBe('40.00');

            // EUR debt should be completely unchanged
            expect(currentBalance.balancesByCurrency.EUR[user1].netBalance).toBe('-75');
            expect(currentBalance.balancesByCurrency.EUR[user1].owes[user2]).toBe('75');
            expect(currentBalance.balancesByCurrency.EUR[user2].netBalance).toBe('75');
            expect(currentBalance.balancesByCurrency.EUR[user2].owedBy[user1]).toBe('75');

            expect(currentBalance.simplifiedDebts).toHaveLength(2);

            // === ACTION 2 ===
            // Partial EUR settlement: User1 pays User2 €50 EUR
            const eurSettlement = new SettlementDTOBuilder()
                .withId('settlement-eur')
                .withGroupId(groupId)
                .withPayerId(user1)
                .withPayeeId(user2)
                .withAmount(50)
                .withCurrency('EUR')
                .withNote('Partial EUR settlement')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, currentBalance, eurSettlement, [user1, user2]);
            });

            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // === ASSERT AFTER EUR SETTLEMENT ===
            // USD debt unchanged at $40, EUR debt reduced to €25
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('-40.00');
            expect(finalBalance.balancesByCurrency.USD[user2].owes[user1]).toBe('40.00');
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe('40.00');
            expect(finalBalance.balancesByCurrency.USD[user1].owedBy[user2]).toBe('40.00');

            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe('-25.00');
            expect(finalBalance.balancesByCurrency.EUR[user1].owes[user2]).toBe('25.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe('25.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].owedBy[user1]).toBe('25.00');

            // Should still have 2 separate currency debts
            expect(finalBalance.simplifiedDebts).toHaveLength(2);

            const finalUsdDebt = finalBalance.simplifiedDebts.find((d: SimplifiedDebt) => d.currency === 'USD');
            expect(finalUsdDebt).toBeDefined();
            expect(finalUsdDebt?.from.uid).toBe(user2);
            expect(finalUsdDebt?.to.uid).toBe(user1);
            expect(finalUsdDebt?.amount).toBe('40.00');

            const finalEurDebt = finalBalance.simplifiedDebts.find((d: SimplifiedDebt) => d.currency === 'EUR');
            expect(finalEurDebt).toBeDefined();
            expect(finalEurDebt?.from.uid).toBe(user1);
            expect(finalEurDebt?.to.uid).toBe(user2);
            expect(finalEurDebt?.amount).toBe('25.00');
        });
    });

    describe('Currency Change Scenarios', () => {
        /**
         * SCENARIO: Expense Currency Change
         *
         * When an expense's currency is changed, the system must:
         * 1. Reverse the original transaction (remove old currency debt)
         * 2. Apply the new transaction (create new currency debt)
         * 3. Keep original currency balance at zero if no other transactions exist
         * 4. Create correct balance in the new currency
         */
        it('should update balances correctly when expense currency is changed', async () => {
            // === SETUP ===
            // Create initial expense in USD
            const initialBalance = new GroupBalanceDTOBuilder(groupId).withVersion(0).build();
            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            // User1 pays $200 USD expense → User2 owes User1 $100 USD
            const originalExpense = new ExpenseDTOBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withAmount(200)
                .withCurrency('USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplits([
                    { uid: user1, amount: '100' },
                    { uid: user2, amount: '100' },
                ])
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseCreated(transaction, groupId, initialBalance, originalExpense, [user1, user2]);
            });

            let currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // Verify initial USD debt
            expect(currentBalance.balancesByCurrency.USD).toBeDefined();
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe('-100.00');
            expect(currentBalance.balancesByCurrency.USD[user1].netBalance).toBe('100.00');
            expect(currentBalance.balancesByCurrency.EUR).toBeUndefined();
            expect(currentBalance.simplifiedDebts).toHaveLength(1);
            expect(currentBalance.simplifiedDebts[0].currency).toBe('USD');
            expect(currentBalance.simplifiedDebts[0].amount).toBe('100.00');

            // === ACTION ===
            // Change expense currency from USD to EUR (keep same amount)
            const updatedExpense = new ExpenseDTOBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withAmount(200)
                .withCurrency('EUR') // Changed from USD to EUR
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplits([
                    { uid: user1, amount: '100' },
                    { uid: user2, amount: '100' },
                ])
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseUpdated(transaction, groupId, currentBalance, originalExpense, updatedExpense, [user1, user2]);
            });

            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // === ASSERT ===
            // USD debt should be removed (or zero if key still exists)
            const usdDebtAfter = finalBalance.simplifiedDebts.find((d: SimplifiedDebt) => d.currency === 'USD');
            expect(usdDebtAfter).toBeUndefined();

            if (finalBalance.balancesByCurrency.USD) {
                expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe('0.00');
                expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('0.00');
            }

            // EUR debt should now exist with correct amounts
            expect(finalBalance.balancesByCurrency.EUR).toBeDefined();
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe('100.00');
            expect(finalBalance.balancesByCurrency.EUR[user1].owedBy[user2]).toBe('100.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe('-100.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].owes[user1]).toBe('100.00');

            const eurDebtAfter = finalBalance.simplifiedDebts.find((d: SimplifiedDebt) => d.currency === 'EUR');
            expect(eurDebtAfter).toBeDefined();
            expect(eurDebtAfter?.amount).toBe('100.00');
            expect(eurDebtAfter?.from.uid).toBe(user2);
            expect(eurDebtAfter?.to.uid).toBe(user1);
        });

        /**
         * SCENARIO: Settlement Currency Change
         *
         * When a settlement's currency is changed, the system must:
         * 1. Reverse the original settlement (restore old currency debt)
         * 2. Apply the new settlement (create new currency debt/adjustment)
         * 3. Handle complex scenarios where changing currency affects different debts
         */
        it('should update balances correctly when settlement currency is changed', async () => {
            // === SETUP ===
            // Create initial expense in USD: User1 pays $300, User2 owes $150
            const initialBalance = new GroupBalanceDTOBuilder(groupId).withVersion(0).build();
            stubDb.seed(`groups/${groupId}/metadata/balance`, initialBalance);

            const expense = new ExpenseDTOBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withAmount(300)
                .withCurrency('USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplits([
                    { uid: user1, amount: '150' },
                    { uid: user2, amount: '150' },
                ])
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applyExpenseCreated(transaction, groupId, initialBalance, expense, [user1, user2]);
            });

            let currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // Verify initial debt: User2 owes User1 $150 USD
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe('-150.00');
            expect(currentBalance.simplifiedDebts[0].amount).toBe('150.00');
            expect(currentBalance.simplifiedDebts[0].currency).toBe('USD');

            // Create settlement in USD: User2 pays User1 $50
            const originalSettlement = new SettlementDTOBuilder()
                .withId('settlement-1')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(50)
                .withCurrency('USD')
                .withNote('Original USD settlement')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementCreated(transaction, groupId, currentBalance, originalSettlement, [user1, user2]);
            });

            currentBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // Verify after settlement: User2 owes User1 $100 USD
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe('-100.00');
            expect(currentBalance.simplifiedDebts[0].amount).toBe('100.00');
            expect(currentBalance.balancesByCurrency.EUR).toBeUndefined();

            // === ACTION ===
            // Change settlement currency from USD to EUR (keep same amount)
            const updatedSettlement = new SettlementDTOBuilder()
                .withId('settlement-1')
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(50)
                .withCurrency('EUR') // Changed from USD to EUR
                .withNote('Changed to EUR')
                .build();

            await stubDb.runTransaction(async (transaction) => {
                service.applySettlementUpdated(transaction, groupId, currentBalance, originalSettlement, updatedSettlement, [user1, user2]);
            });

            const finalBalance = await stubDb.runTransaction(async (transaction) => {
                const balanceRef = stubDb.doc(`groups/${groupId}/metadata/balance`);
                const balanceSnap = await transaction.get(balanceRef);
                return balanceSnap.data();
            });

            // === ASSERT ===
            // USD debt should be restored to $150 (original $150 - $0 since settlement was removed)
            const updatedUsdDebt = finalBalance.simplifiedDebts.find((d: SimplifiedDebt) => d.currency === 'USD');
            expect(updatedUsdDebt).toBeDefined();
            expect(updatedUsdDebt?.amount).toBe('150.00');
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe('-150.00');
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe('150.00');

            // EUR debt should now exist (User1 owes User2 €50 from the settlement)
            const eurDebtAfter = finalBalance.simplifiedDebts.find((d: SimplifiedDebt) => d.currency === 'EUR');
            expect(eurDebtAfter).toBeDefined();
            expect(eurDebtAfter?.amount).toBe('50.00');
            expect(eurDebtAfter?.from.uid).toBe(user1); // User1 owes User2
            expect(eurDebtAfter?.to.uid).toBe(user2);

            expect(finalBalance.balancesByCurrency.EUR).toBeDefined();
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe('-50.00');
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe('50.00');

            // Should have 2 separate currency debts
            expect(finalBalance.simplifiedDebts).toHaveLength(2);
        });
    });
});

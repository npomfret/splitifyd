import { ExpenseDTOBuilder, GroupBalanceDTOBuilder, SettlementDTOBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { IncrementalBalanceService } from '../../../services/balance/IncrementalBalanceService';
import { StubFirestoreWriter } from '../mocks/firestore-stubs';

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
    let stubWriter: StubFirestoreWriter;
    let mockTransaction: any;

    const groupId = 'test-group-id';
    const user1 = 'user-1';
    const user2 = 'user-2';

    beforeEach(() => {
        stubWriter = new StubFirestoreWriter();
        service = new IncrementalBalanceService(stubWriter);
        mockTransaction = {}; // Simple mock transaction object
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
            await stubWriter.setGroupBalance(groupId, initialBalance);

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
                    { uid: user1, amount: 100 },
                    { uid: user2, amount: 100 },
                ])
                .build();

            service.applyExpenseCreated(mockTransaction, groupId, initialBalance, usdExpense, [user1, user2]);
            let currentBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // Verify expense was applied correctly
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe(-100);

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

            service.applySettlementCreated(mockTransaction, groupId, currentBalance, eurSettlement, [user1, user2]);

            // === ASSERT ===
            const finalBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // USD debt should be UNCHANGED (no currency conversion)
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe(-100);
            expect(finalBalance.balancesByCurrency.USD[user2].owes[user1]).toBe(100);
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe(100);
            expect(finalBalance.balancesByCurrency.USD[user1].owedBy[user2]).toBe(100);

            // NEW EUR debt should exist (User2 paid User1 €75, so User1 now owes User2 €75)
            expect(finalBalance.balancesByCurrency.EUR).toBeDefined();
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe(-75);
            expect(finalBalance.balancesByCurrency.EUR[user1].owes[user2]).toBe(75);
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe(75);
            expect(finalBalance.balancesByCurrency.EUR[user2].owedBy[user1]).toBe(75);

            // Should have TWO separate simplified debts (one per currency)
            expect(finalBalance.simplifiedDebts).toHaveLength(2);

            const usdDebt = finalBalance.simplifiedDebts.find((debt) => debt.currency === 'USD');
            expect(usdDebt).toBeDefined();
            expect(usdDebt?.from.uid).toBe(user2);
            expect(usdDebt?.to.uid).toBe(user1);
            expect(usdDebt?.amount).toBe(100);

            const eurDebt = finalBalance.simplifiedDebts.find((debt) => debt.currency === 'EUR');
            expect(eurDebt).toBeDefined();
            expect(eurDebt?.from.uid).toBe(user1);
            expect(eurDebt?.to.uid).toBe(user2);
            expect(eurDebt?.amount).toBe(75);
        });

        it('should not perform implicit currency conversion on settlements', async () => {
            // === SETUP ===
            // Complex scenario: Multiple expenses creating USD debt
            const initialBalance = new GroupBalanceDTOBuilder(groupId).withVersion(0).build();
            await stubWriter.setGroupBalance(groupId, initialBalance);

            // Expense 1: User1 pays $150, User2 owes $75
            const expense1 = new ExpenseDTOBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withAmount(150)
                .withCurrency('USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplits([
                    { uid: user1, amount: 75 },
                    { uid: user2, amount: 75 },
                ])
                .build();

            service.applyExpenseCreated(mockTransaction, groupId, initialBalance, expense1, [user1, user2]);
            let currentBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // Expense 2: User1 pays $50, User2 owes additional $25
            const expense2 = new ExpenseDTOBuilder()
                .withId('expense-2')
                .withGroupId(groupId)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplits([
                    { uid: user1, amount: 25 },
                    { uid: user2, amount: 25 },
                ])
                .build();

            service.applyExpenseCreated(mockTransaction, groupId, currentBalance, expense2, [user1, user2]);
            currentBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // User2 now owes User1 exactly $100 USD
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe(-100);

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

            service.applySettlementCreated(mockTransaction, groupId, currentBalance, eurSettlement, [user1, user2]);

            // === ASSERT ===
            const finalBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // CRITICAL ASSERTION: USD debt must still be $100
            // If this fails with $25 remaining, currency conversion occurred (BUG)
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe(-100);
            expect(finalBalance.balancesByCurrency.USD[user2].owes[user1]).toBe(100);

            // EUR debt should exist from settlement
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe(-75);
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe(75);
        });

        it('should maintain currency independence in complex multi-currency scenarios', async () => {
            // === SETUP ===
            // Start with existing debts in USD and GBP
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withUserBalance('USD', user1, {
                    uid: user1,
                    owes: {},
                    owedBy: { [user2]: 50 },
                    netBalance: 50,
                })
                .withUserBalance('USD', user2, {
                    uid: user2,
                    owes: { [user1]: 50 },
                    owedBy: {},
                    netBalance: -50,
                })
                .withUserBalance('GBP', user1, {
                    uid: user1,
                    owes: { [user2]: 30 },
                    owedBy: {},
                    netBalance: -30,
                })
                .withUserBalance('GBP', user2, {
                    uid: user2,
                    owes: {},
                    owedBy: { [user1]: 30 },
                    netBalance: 30,
                })
                .withSimplifiedDebt({
                    from: { uid: user2 },
                    to: { uid: user1 },
                    amount: 50,
                    currency: 'USD',
                })
                .withSimplifiedDebt({
                    from: { uid: user1 },
                    to: { uid: user2 },
                    amount: 30,
                    currency: 'GBP',
                })
                .withVersion(5)
                .build();

            await stubWriter.setGroupBalance(groupId, initialBalance);

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

            service.applySettlementCreated(mockTransaction, groupId, initialBalance, eurSettlement, [user1, user2]);

            // === ASSERT ===
            const finalBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // USD and GBP debts should be completely unchanged
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe(-50);
            expect(finalBalance.balancesByCurrency.GBP[user1].netBalance).toBe(-30);

            // EUR debt should be newly created
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe(-100);
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe(100);

            // Should have 3 separate currency debts
            expect(finalBalance.simplifiedDebts).toHaveLength(3);
            expect(finalBalance.simplifiedDebts.filter((d) => d.currency === 'USD')).toHaveLength(1);
            expect(finalBalance.simplifiedDebts.filter((d) => d.currency === 'GBP')).toHaveLength(1);
            expect(finalBalance.simplifiedDebts.filter((d) => d.currency === 'EUR')).toHaveLength(1);
        });
    });

    describe('Partial and Overpayment Settlement Scenarios', () => {
        it('should handle partial settlement in same currency correctly', async () => {
            // === SETUP ===
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withSimpleUSDDebt(user1, user2, 100)
                .build();

            await stubWriter.setGroupBalance(groupId, initialBalance);

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

            service.applySettlementCreated(mockTransaction, groupId, initialBalance, partialSettlement, [user1, user2]);

            // === ASSERT ===
            const finalBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // Debt reduced by settlement amount
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe(-40);
            expect(finalBalance.balancesByCurrency.USD[user2].owes[user1]).toBe(40);
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe(40);
            expect(finalBalance.balancesByCurrency.USD[user1].owedBy[user2]).toBe(40);

            expect(finalBalance.simplifiedDebts).toHaveLength(1);
            expect(finalBalance.simplifiedDebts[0].amount).toBe(40);
        });

        it('should handle multiple sequential partial settlements correctly', async () => {
            // === SETUP ===
            // User2 owes User1 €100
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withUserBalance('EUR', user1, {
                    uid: user1,
                    owes: {},
                    owedBy: { [user2]: 100 },
                    netBalance: 100,
                })
                .withUserBalance('EUR', user2, {
                    uid: user2,
                    owes: { [user1]: 100 },
                    owedBy: {},
                    netBalance: -100,
                })
                .withSimplifiedDebt({
                    from: { uid: user2 },
                    to: { uid: user1 },
                    amount: 100,
                    currency: 'EUR',
                })
                .build();

            await stubWriter.setGroupBalance(groupId, initialBalance);

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

            service.applySettlementCreated(mockTransaction, groupId, initialBalance, settlement1, [user1, user2]);
            let currentBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // === ASSERT AFTER FIRST SETTLEMENT ===
            // Debt should be reduced to €60
            expect(currentBalance.balancesByCurrency.EUR[user2].netBalance).toBe(-60);
            expect(currentBalance.balancesByCurrency.EUR[user2].owes[user1]).toBe(60);
            expect(currentBalance.balancesByCurrency.EUR[user1].netBalance).toBe(60);
            expect(currentBalance.balancesByCurrency.EUR[user1].owedBy[user2]).toBe(60);
            expect(currentBalance.simplifiedDebts).toHaveLength(1);
            expect(currentBalance.simplifiedDebts[0].amount).toBe(60);

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

            service.applySettlementCreated(mockTransaction, groupId, currentBalance, settlement2, [user1, user2]);
            currentBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // === ASSERT AFTER SECOND SETTLEMENT ===
            // Debt should be reduced to €25
            expect(currentBalance.balancesByCurrency.EUR[user2].netBalance).toBe(-25);
            expect(currentBalance.balancesByCurrency.EUR[user2].owes[user1]).toBe(25);
            expect(currentBalance.balancesByCurrency.EUR[user1].netBalance).toBe(25);
            expect(currentBalance.balancesByCurrency.EUR[user1].owedBy[user2]).toBe(25);
            expect(currentBalance.simplifiedDebts).toHaveLength(1);
            expect(currentBalance.simplifiedDebts[0].amount).toBe(25);

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

            service.applySettlementCreated(mockTransaction, groupId, currentBalance, settlement3, [user1, user2]);
            const finalBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // === ASSERT AFTER FINAL SETTLEMENT ===
            // All debts should be cleared (fully settled)
            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe(0);
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe(0);
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

            await stubWriter.setGroupBalance(groupId, initialBalance);

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

            service.applySettlementCreated(mockTransaction, groupId, initialBalance, overpaymentSettlement, [user1, user2]);

            // === ASSERT ===
            const finalBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // Debt reversed: User1 now owes User2 $50
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe(-50);
            expect(finalBalance.balancesByCurrency.USD[user1].owes[user2]).toBe(50);
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe(50);
            expect(finalBalance.balancesByCurrency.USD[user2].owedBy[user1]).toBe(50);

            expect(finalBalance.simplifiedDebts).toHaveLength(1);
            expect(finalBalance.simplifiedDebts[0].from.uid).toBe(user1);
            expect(finalBalance.simplifiedDebts[0].to.uid).toBe(user2);
            expect(finalBalance.simplifiedDebts[0].amount).toBe(50);
        });

        it('should handle exact settlement resulting in zero balance', async () => {
            // === SETUP ===
            const initialBalance = new GroupBalanceDTOBuilder(groupId)
                .withSimpleUSDDebt(user1, user2, 100)
                .build();

            await stubWriter.setGroupBalance(groupId, initialBalance);

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

            service.applySettlementCreated(mockTransaction, groupId, initialBalance, exactSettlement, [user1, user2]);

            // === ASSERT ===
            const finalBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // All debts cleared
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe(0);
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe(0);
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
                .withUserBalance('USD', user1, {
                    uid: user1,
                    owes: {},
                    owedBy: { [user2]: 100 },
                    netBalance: 100,
                })
                .withUserBalance('USD', user2, {
                    uid: user2,
                    owes: { [user1]: 100 },
                    owedBy: {},
                    netBalance: -100,
                })
                .withUserBalance('EUR', user1, {
                    uid: user1,
                    owes: { [user2]: 75 },
                    owedBy: {},
                    netBalance: -75,
                })
                .withUserBalance('EUR', user2, {
                    uid: user2,
                    owes: {},
                    owedBy: { [user1]: 75 },
                    netBalance: 75,
                })
                .withSimplifiedDebt({
                    from: { uid: user2 },
                    to: { uid: user1 },
                    amount: 100,
                    currency: 'USD',
                })
                .withSimplifiedDebt({
                    from: { uid: user1 },
                    to: { uid: user2 },
                    amount: 75,
                    currency: 'EUR',
                })
                .build();

            await stubWriter.setGroupBalance(groupId, initialBalance);

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

            service.applySettlementCreated(mockTransaction, groupId, initialBalance, usdSettlement, [user1, user2]);
            let currentBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // === ASSERT AFTER USD SETTLEMENT ===
            // USD debt reduced to $40, EUR debt unchanged at €75
            expect(currentBalance.balancesByCurrency.USD[user2].netBalance).toBe(-40);
            expect(currentBalance.balancesByCurrency.USD[user2].owes[user1]).toBe(40);
            expect(currentBalance.balancesByCurrency.USD[user1].netBalance).toBe(40);
            expect(currentBalance.balancesByCurrency.USD[user1].owedBy[user2]).toBe(40);

            // EUR debt should be completely unchanged
            expect(currentBalance.balancesByCurrency.EUR[user1].netBalance).toBe(-75);
            expect(currentBalance.balancesByCurrency.EUR[user1].owes[user2]).toBe(75);
            expect(currentBalance.balancesByCurrency.EUR[user2].netBalance).toBe(75);
            expect(currentBalance.balancesByCurrency.EUR[user2].owedBy[user1]).toBe(75);

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

            service.applySettlementCreated(mockTransaction, groupId, currentBalance, eurSettlement, [user1, user2]);
            const finalBalance = await stubWriter.getGroupBalanceInTransaction(mockTransaction, groupId);

            // === ASSERT AFTER EUR SETTLEMENT ===
            // USD debt unchanged at $40, EUR debt reduced to €25
            expect(finalBalance.balancesByCurrency.USD[user2].netBalance).toBe(-40);
            expect(finalBalance.balancesByCurrency.USD[user2].owes[user1]).toBe(40);
            expect(finalBalance.balancesByCurrency.USD[user1].netBalance).toBe(40);
            expect(finalBalance.balancesByCurrency.USD[user1].owedBy[user2]).toBe(40);

            expect(finalBalance.balancesByCurrency.EUR[user1].netBalance).toBe(-25);
            expect(finalBalance.balancesByCurrency.EUR[user1].owes[user2]).toBe(25);
            expect(finalBalance.balancesByCurrency.EUR[user2].netBalance).toBe(25);
            expect(finalBalance.balancesByCurrency.EUR[user2].owedBy[user1]).toBe(25);

            // Should still have 2 separate currency debts
            expect(finalBalance.simplifiedDebts).toHaveLength(2);

            const finalUsdDebt = finalBalance.simplifiedDebts.find((d) => d.currency === 'USD');
            expect(finalUsdDebt).toBeDefined();
            expect(finalUsdDebt?.from.uid).toBe(user2);
            expect(finalUsdDebt?.to.uid).toBe(user1);
            expect(finalUsdDebt?.amount).toBe(40);

            const finalEurDebt = finalBalance.simplifiedDebts.find((d) => d.currency === 'EUR');
            expect(finalEurDebt).toBeDefined();
            expect(finalEurDebt?.from.uid).toBe(user1);
            expect(finalEurDebt?.to.uid).toBe(user2);
            expect(finalEurDebt?.amount).toBe(25);
        });
    });
});

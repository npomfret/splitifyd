// Mixed Currency Settlement Integration Test
// Tests mixed currency settlement behavior directly via API
// This test reproduces the same scenario as the failing e2e test to isolate the issue

import { describe, expect, test } from 'vitest';
import { ApiDriver, CreateExpenseRequestBuilder, CreateSettlementRequestBuilder, borrowTestUsers, TestGroupManager } from '@splitifyd/test-support';

describe('Mixed Currency Settlements - API Integration', () => {
    const apiDriver = new ApiDriver();

    test('should handle mixed currency settlements without currency conversion', async () => {
        // Create fresh users and group for this test
        const users = await borrowTestUsers(2);
        const testGroup = await TestGroupManager.getOrCreateGroup(users, { fresh: true });
        const [user1, user2] = users;

        // Create USD expense: User1 pays $200 → User2 owes $100
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(testGroup.id)
            .withDescription('USD Expense for Settlement Test')
            .withAmount(200)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withParticipants([user1.uid, user2.uid])
            .withSplitType('equal')
            .build();

        const expense = await apiDriver.createExpense(expenseData, user1.token);
        expect(expense.id).toBeDefined();

        // Wait for balances to calculate and verify initial debt
        await apiDriver.waitForBalanceUpdate(testGroup.id, user1.token, 3000);
        const initialBalances = await apiDriver.getGroupBalances(testGroup.id, user1.token);

        // Verify User2 owes User1 $100 USD
        expect(initialBalances.simplifiedDebts).toBeDefined();
        expect(Array.isArray(initialBalances.simplifiedDebts)).toBe(true);

        const initialDebt = initialBalances.simplifiedDebts.find((debt) => debt.from.uid === user2.uid && debt.to.uid === user1.uid);
        expect(initialDebt).toBeDefined();
        expect(initialDebt?.amount).toBe(100);
        expect(initialDebt?.currency).toBe('USD');

        // User2 settles with €75 EUR (different currency than the debt)
        const settlementData = new CreateSettlementRequestBuilder()
            .withGroupId(testGroup.id)
            .withPayerId(user2.uid)
            .withPayeeId(user1.uid)
            .withAmount(75)
            .withCurrency('EUR')
            .withNote('EUR Settlement for USD Debt')
            .build();

        const settlement = await apiDriver.createSettlement(settlementData, user2.token);
        expect(settlement.id).toBeDefined();

        // Wait for settlement to process and balances to update
        await apiDriver.waitForBalanceUpdate(testGroup.id, user1.token, 3000);
        const finalBalances = await apiDriver.getGroupBalances(testGroup.id, user1.token);

        // EXPECTED BEHAVIOR: No currency conversion should occur
        // The test expects TWO separate debt relationships:
        // 1. User2 → User1: $100.00 USD (original debt unchanged)
        // 2. User1 → User2: €75.00 EUR (new debt from EUR settlement)

        const usdDebtAfterSettlement = finalBalances.simplifiedDebts?.find((debt) => debt.from.uid === user2.uid && debt.to.uid === user1.uid && debt.currency === 'USD');

        const eurDebtAfterSettlement = finalBalances.simplifiedDebts?.find((debt) => debt.from.uid === user1.uid && debt.to.uid === user2.uid && debt.currency === 'EUR');

        // Assert: USD debt should still exist at full amount (no conversion)
        expect(usdDebtAfterSettlement).toBeDefined();
        expect(usdDebtAfterSettlement?.amount).toBe(100); // Should still be $100
        expect(usdDebtAfterSettlement?.currency).toBe('USD');

        // Assert: EUR debt should exist from the settlement
        expect(eurDebtAfterSettlement).toBeDefined();
        expect(eurDebtAfterSettlement?.amount).toBe(75); // Should be €75
        expect(eurDebtAfterSettlement?.currency).toBe('EUR');

        // Verify settlement was recorded correctly
        const settlements = await apiDriver.listSettlements(user1.token, { groupId: testGroup.id });
        const recordedSettlement = settlements.settlements.find((s) => s.id === settlement.id);
        expect(recordedSettlement).toBeDefined();
        expect(recordedSettlement?.amount).toBe(75);
        expect(recordedSettlement?.currency).toBe('EUR');
        expect(recordedSettlement?.note).toBe('EUR Settlement for USD Debt');
    });

    test('should track currency conversion if application is doing it incorrectly', async () => {
        // Create fresh users and group for this test
        const users = await borrowTestUsers(2);
        const testGroup = await TestGroupManager.getOrCreateGroup(users, { fresh: true });
        const [user1, user2] = users;

        // Create USD expense: User1 pays $200 → User2 owes $100
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Currency Conversion Test')
            .withAmount(200)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withParticipants([user1.uid, user2.uid])
            .withSplitType('equal')
            .build();

        await apiDriver.createExpense(expenseData, user1.token);
        await apiDriver.waitForBalanceUpdate(testGroup.id, user1.token, 3000);

        // User2 settles with €75 EUR
        const settlementData = new CreateSettlementRequestBuilder()
            .withGroupId(testGroup.id)
            .withPayerId(user2.uid)
            .withPayeeId(user1.uid)
            .withAmount(75)
            .withCurrency('EUR')
            .withNote('Testing Currency Conversion Bug')
            .build();

        await apiDriver.createSettlement(settlementData, user2.token);
        await apiDriver.waitForBalanceUpdate(testGroup.id, user1.token, 3000);

        const finalBalances = await apiDriver.getGroupBalances(testGroup.id, user1.token);

        // If the application is incorrectly converting currencies,
        // we would see a reduced USD debt (e.g., $25 instead of $100)
        const remainingUsdDebt = finalBalances.simplifiedDebts?.find((debt) => debt.from.uid === user2.uid && debt.to.uid === user1.uid && debt.currency === 'USD');

        // This assertion will fail if there's a currency conversion bug
        // It documents the expected behavior vs actual behavior
        expect(remainingUsdDebt?.amount).toBe(100); // Will fail if bug exists
    });

    test('should reproduce exact e2e test flow that fails', async () => {
        // Create fresh users and group for this test
        const users = await borrowTestUsers(2);
        const freshTestGroup = await TestGroupManager.getOrCreateGroup(users, { fresh: true });
        const [user1, user2] = users;

        // EXACT REPLICA of the failing e2e test:
        // Create USD expense: User1 pays $200 → User2 owes $100
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(freshTestGroup.id)
            .withDescription('USD Expense for Settlement Test')
            .withAmount(200)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withParticipants([user1.uid, user2.uid])
            .withSplitType('equal')
            .build();

        const expense = await apiDriver.createExpense(expenseData, user1.token);
        expect(expense.id).toBeDefined();

        // Wait for balances to calculate and verify initial debt
        await apiDriver.waitForBalanceUpdate(freshTestGroup.id, user1.token, 3000);
        const initialBalances = await apiDriver.getGroupBalances(freshTestGroup.id, user1.token);

        // Verify User2 owes User1 $100 USD
        const initialDebt = initialBalances.simplifiedDebts.find((debt) => debt.from.uid === user2.uid && debt.to.uid === user1.uid);
        expect(initialDebt).toBeDefined();
        expect(initialDebt?.amount).toBe(100);
        expect(initialDebt?.currency).toBe('USD');

        // User2 settles with €75 EUR (different currency than the debt)
        const settlementData = new CreateSettlementRequestBuilder()
            .withGroupId(freshTestGroup.id)
            .withPayerId(user2.uid)
            .withPayeeId(user1.uid)
            .withAmount(75)
            .withCurrency('EUR')
            .withNote('EUR Settlement for USD Debt')
            .build();

        const settlement = await apiDriver.createSettlement(settlementData, user2.token);
        expect(settlement.id).toBeDefined();

        // Wait for settlement to process and balances to update
        await apiDriver.waitForBalanceUpdate(freshTestGroup.id, user1.token, 3000);
        const finalBalances = await apiDriver.getGroupBalances(freshTestGroup.id, user1.token);

        // The e2e test expects $100 but finds $25 - let's see what we get here
        const usdDebtAfterSettlement = finalBalances.simplifiedDebts?.find((debt) => debt.from.uid === user2.uid && debt.to.uid === user1.uid && debt.currency === 'USD');

        const eurDebtAfterSettlement = finalBalances.simplifiedDebts?.find((debt) => debt.from.uid === user1.uid && debt.to.uid === user2.uid && debt.currency === 'EUR');

        // E2E TEST EXPECTATION: USD debt should still exist at full amount (no conversion)
        expect(usdDebtAfterSettlement).toBeDefined();
        expect(usdDebtAfterSettlement?.amount).toBe(100); // E2E expects $100, but shows $25
        expect(usdDebtAfterSettlement?.currency).toBe('USD');

        // E2E TEST EXPECTATION: EUR debt should exist from the settlement
        expect(eurDebtAfterSettlement).toBeDefined();
        expect(eurDebtAfterSettlement?.amount).toBe(75); // Should be €75
        expect(eurDebtAfterSettlement?.currency).toBe('EUR');

        // Verify settlement was recorded correctly
        const settlements = await apiDriver.listSettlements(user1.token, { groupId: freshTestGroup.id });
        const recordedSettlement = settlements.settlements.find((s) => s.id === settlement.id);
        expect(recordedSettlement).toBeDefined();
        expect(recordedSettlement?.amount).toBe(75);
        expect(recordedSettlement?.currency).toBe('EUR');
        expect(recordedSettlement?.note).toBe('EUR Settlement for USD Debt');
    });
});

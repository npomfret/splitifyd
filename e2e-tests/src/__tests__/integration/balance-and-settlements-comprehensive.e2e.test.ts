import { simpleTest, expect } from '../../fixtures';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { SettlementData } from '../../pages/settlement-form.page';
import { generateShortId } from '@splitifyd/test-support';

/**
 * Comprehensive Balance & Settlement Operations E2E Tests
 *
 * Consolidated from:
 * - balance-visualization.e2e.test.ts (balance calculation and display)
 * - settlements.e2e.test.ts (settlement CRUD operations)
 * - Parts of realtime-comprehensive.e2e.test.ts (real-time balance updates)
 *
 * This file provides complete testing of balance calculations, settlement operations,
 * and their integration while eliminating redundancy across multiple test files.
 */

simpleTest.describe('Balance Calculation Fundamentals', () => {

    simpleTest('should show settled up when group is empty', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage },] = await createLoggedInBrowsers(1);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});

        // Empty group should always be settled up
        await groupDetailPage.waitForSettledUpMessage()
    });

    simpleTest('should show settled up when both users pay equal amounts', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Setup 2-person group
        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create two equal expenses
        await groupDetailPage.addExpense({
            description: 'User1 Payment',
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'GBP',
            splitType: 'equal',
        }, 2);

        await groupDetailPage2.addExpense({
            description: 'User2 Payment',
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'GBP',
            splitType: 'equal',
        }, 2);

        // Verify both users see settled up state
        await groupDetailPage.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();
    });

    simpleTest('should calculate debt correctly when only one person pays', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Setup 2-person group
        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // User1 pays $200, split equally → User2 owes $100
        await groupDetailPage.addExpense({
            description: 'One Person Pays',
            amount: 100.00,
            paidByDisplayName: user1DisplayName,
            currency: 'EUR',
            splitType: 'equal',
        }, 2);

        // Verify debt calculation on both screens
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00');
    });

    simpleTest('should handle complex multi-expense debt calculations', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // User1 pays $300 first
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Large User1 Payment',
            amount: 300,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Wait for first expense to be synced
        await groupDetailPage.waitForBalanceUpdate();
        await groupDetailPage.verifyExpenseVisible('Large User1 Payment');
        await groupDetailPage2.verifyExpenseVisible('Large User1 Payment');

        // User2 adds expense after synchronization
        const expenseFormPage2 = await groupDetailPage2.clickAddExpenseButton(2);
        await expenseFormPage2.submitExpense({
            description: 'Small User2 Payment',
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await groupDetailPage2.waitForBalanceUpdate();

        // Complex calculation: User1 paid $300 (owes $150), User2 paid $100 (owes $200)
        // Net: User2 owes User1 $100 ($200 - $150 = $50 + $150 - $100 = $100)
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');
    });

    simpleTest('should handle precise currency formatting in debt calculations', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // User1 pays $123.45 → User2 owes exactly $61.73 (rounded appropriately)
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Currency Precision Test',
            amount: 123.45,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Calculate expected debt: $123.45 / 2 = $61.725 → $61.73
        const expectedDebt = expenseFormPage.calculateEqualSplitDebt(123.45, 2);

        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, `$${expectedDebt}`);
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, `$${expectedDebt}`);

        // Verify original expense amount is preserved
        await expect(groupDetailPage.getCurrencyAmount('123.45')).toBeVisible();
    });

    simpleTest('should transition between settled and debt states predictably', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        // State 1: Empty group → ALWAYS settled up
        await groupDetailPage1.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();

        // State 2: User1 pays $100 → User2 MUST owe $50
        const expenseFormPage = await groupDetailPage1.clickAddExpenseButton(2);
        const expense1Description = generateShortId();
        await expenseFormPage.submitExpense({
            description: expense1Description,
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await groupDetailPage1.waitForExpense(expense1Description);
        await groupDetailPage2.waitForExpense(expense1Description);
        await groupDetailPage1.waitForPage(groupId, 2);
        await groupDetailPage2.waitForPage(groupId, 2);

        // Verify debt exists
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');

        // State 3: User2 pays $100 → MUST be settled up
        const expenseFormPage2 = await groupDetailPage2.clickAddExpenseButton(2);
        const expense2Description = generateShortId();
        await expenseFormPage2.submitExpense({
            description: expense2Description,
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await groupDetailPage1.waitForExpense(expense2Description);
        await groupDetailPage2.waitForExpense(expense2Description);
        await groupDetailPage2.waitForBalanceUpdate();

        // Verify settled up state
        await groupDetailPage1.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();

        // Verify NO debt messages remain
        await expect(groupDetailPage1.getBalancesSection().getByText(`${user2DisplayName} → ${user1DisplayName}`)).not.toBeVisible();
        await expect(groupDetailPage2.getBalancesSection().getByText(`${user2DisplayName} → ${user1DisplayName}`)).not.toBeVisible();
    });
});

simpleTest.describe('Settlement Operations', () => {
    simpleTest('should create settlement and display in history with proper formatting', async ({ createLoggedInBrowsers }) => {
        const [
            { page: user1Page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create settlement
        const settlementForm = await groupDetailPage.clickSettleUpButton(2);
        const settlementData: SettlementData = {
            payerName: payerName,
            payeeName: payeeName,
            amount: '100.50',
            note: 'Test payment for history',
        };

        await settlementForm.submitSettlement(settlementData, 2);
        await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify settlement appears in history
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData.note });
        await groupDetailPage.verifySettlementDetails(settlementData);
    });

    simpleTest('should handle settlements where creator is payee', async ({ createLoggedInBrowsers }) => {
        const [
            { page: user1Page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create settlement where creator is the payee (receives money)
        const settlementForm = await groupDetailPage.clickSettleUpButton(2);
        const settlementData: SettlementData = {
            payerName: await user2DashboardPage.header.getCurrentUserDisplayName(),
            payeeName: await groupDetailPage.header.getCurrentUserDisplayName(),
            amount: '75.00',
            note: 'Creator receives payment',
        };

        await settlementForm.submitSettlement(settlementData, 2);
        await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify settlement appears correctly
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData.note });

        // Verify creator can still edit/delete even when they're the payee
        await groupDetailPage.verifySettlementHasEditButton(settlementData.note);
        await groupDetailPage.verifySettlementHasDeleteButton(settlementData.note);
    });

    simpleTest('should edit settlement successfully', async ({ createLoggedInBrowsers }) => {
        const [
            { page: user1Page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create initial settlement
        let settlementForm = await groupDetailPage.clickSettleUpButton(2);
        const initialData: SettlementData = {
            payerName: payerName,
            payeeName: payeeName,
            amount: '100.50',
            note: 'Initial test payment',
        };

        await settlementForm.submitSettlement(initialData, 2);
        await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Open history and click edit
        await groupDetailPage.openHistoryIfClosed();
        settlementForm = await groupDetailPage.clickEditSettlement(initialData.note);

        // Verify update form is shown and has current values
        await settlementForm.verifyUpdateMode();
        await settlementForm.verifyFormValues({
            amount: initialData.amount,
            note: initialData.note,
        });

        // Update the settlement
        const updatedData = {
            amount: '150.75',
            note: 'Updated test payment',
        };

        await settlementForm.updateSettlement(updatedData);
        await settlementForm.waitForModalClosed();
        await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify updated settlement in history
        await groupDetailPage.verifySettlementDetails({ note: updatedData.note });
        await groupDetailPage.verifySettlementDetails({
            note: updatedData.note,
            amount: updatedData.amount,
            payerName: initialData.payerName,
            payeeName: initialData.payeeName,
        });
    });

    simpleTest('should validate settlement form inputs during edit', async ({ createLoggedInBrowsers }) => {
        const [
            { page: user1Page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create settlement for editing
        let settlementForm = await groupDetailPage.clickSettleUpButton(2);
        const initialData: SettlementData = {
            payerName,
            payeeName,
            amount: '50.00',
            note: 'Validation test payment',
        };

        await settlementForm.submitSettlement(initialData, 2);
        await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Open edit form
        await groupDetailPage.openHistoryIfClosed();
        settlementForm = await groupDetailPage.clickEditSettlement(initialData.note);

        // Test invalid amounts
        await settlementForm.clearAndFillAmount('0');
        await settlementForm.verifyUpdateButtonDisabled();

        await settlementForm.clearAndFillAmount('-50');
        await settlementForm.verifyUpdateButtonDisabled();

        // Test valid amount
        await settlementForm.clearAndFillAmount('75.50');
        await settlementForm.verifyUpdateButtonEnabled();

        // Close without saving
        await settlementForm.closeModal();
        await settlementForm.waitForModalClosed();

        // Verify original settlement unchanged
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({
            note: initialData.note,
            amount: initialData.amount,
            payerName: initialData.payerName,
            payeeName: initialData.payeeName,
        });
    });

    simpleTest('should delete settlement successfully', async ({ createLoggedInBrowsers }) => {
        const [
            { page: user1Page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create settlement for deletion
        const settlementForm = await groupDetailPage.clickSettleUpButton(2);
        await settlementForm.waitForFormReady(2);

        const settlementData: SettlementData = {
            payerName,
            payeeName,
            amount: '100.00',
            note: 'Payment to be deleted',
        };

        await settlementForm.submitSettlement(settlementData, 2);
        await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify settlement exists then delete it
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData.note });
        await groupDetailPage.deleteSettlement(settlementData.note, true);

        // Verify settlement removed from history
        await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementNotInHistory(settlementData.note);
    });

    simpleTest('should cancel settlement deletion when user clicks cancel', async ({ createLoggedInBrowsers }) => {
        const [
            { page: user1Page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create settlement
        const settlementForm = await groupDetailPage.clickSettleUpButton(2);
        await settlementForm.waitForFormReady(2);

        const settlementData: SettlementData = {
            payerName: payerName,
            payeeName: payeeName,
            amount: '75.00',
            note: 'Payment to keep',
        };

        await settlementForm.submitSettlement(settlementData, 2);
        await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Attempt deletion but cancel
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.deleteSettlement(settlementData.note, false); // Cancel deletion

        // Verify settlement still exists
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData.note });
    });
});

simpleTest.describe('Balance & Settlement Integration', () => {
    simpleTest('should update debt correctly after partial settlement', async ({ createLoggedInBrowsers }) => {
        const [
            { page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Create expense: User1 pays $200 → User2 owes $100
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Test Expense for Settlement',
            amount: 200,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Verify expense appears and initial debt
        await groupDetailPage.verifyExpenseVisible('Test Expense for Settlement');
        await groupDetailPage2.verifyExpenseVisible('Test Expense for Settlement');
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');

        // Record partial settlement of $60
        const settlementFormPage = await groupDetailPage.clickSettleUpButton(2);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '60',
            note: 'Partial payment of $60',
        }, 2);

        // Wait for settlement to propagate
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify settlement in history
        await groupDetailPage.openHistoryAndVerifySettlement(/Partial payment of \$60/);
        await groupDetailPage.closeModal();
        await groupDetailPage2.openHistoryAndVerifySettlement(/Partial payment of \$60/);
        await groupDetailPage2.closeModal();

        // Verify updated debt ($100 - $60 = $40 remaining)
        // Wait for debt to appear (not settled up)
        await expect(groupDetailPage.getBalancesSection().getByText(`${user2DisplayName} → ${user1DisplayName}`)).toBeVisible({ timeout: 5000 });

        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$40.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$40.00');
    });

    simpleTest('should show settled up after exact settlement', async ({ createLoggedInBrowsers }) => {
        const [
            { page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Create expense: User1 pays $150 → User2 owes $75
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'One Person Pays',
            amount: 150,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await groupDetailPage.waitForBalanceUpdate();
        await groupDetailPage2.waitForBalancesToLoad(groupId);
        await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$75.00');

        // User2 pays User1 the exact debt amount ($75) → should be settled up
        const settlementFormPage = await groupDetailPage2.clickSettleUpButton(2);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '75.00',
            note: 'Full settlement payment',
        }, 2);

        // Wait for settlement to propagate
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify settlement recorded
        await groupDetailPage.openHistoryAndVerifySettlement(/Full settlement payment/);
        await groupDetailPage.closeModal();
        await groupDetailPage2.openHistoryAndVerifySettlement(/Full settlement payment/);
        await groupDetailPage2.closeModal();

        // Verify settled up state
        await groupDetailPage.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();

        // Verify expenses still visible after settlement
        await expect(groupDetailPage.getExpensesHeading()).toBeVisible();
        await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
        await expect(groupDetailPage.getCurrencyAmount('150.00')).toBeVisible();
        await expect(groupDetailPage2.getExpensesHeading()).toBeVisible();
        await groupDetailPage2.verifyExpenseVisible('One Person Pays');
        await groupDetailPage2.verifyCurrencyAmountVisible('150.00');
    });

    simpleTest('should handle multi-user partial settlements correctly', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage },
            { dashboardPage: user3DashboardPage }
        ] = await createLoggedInBrowsers(3);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2, groupDetailPage3] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage, user3DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        // User1 creates expense for $120, split 3 ways ($40 each)
        // Result: User2 owes $40, User3 owes $40 to User1
        const expenseDescription = 'Group dinner expense';
        await groupDetailPage1.addExpense({
            description: expenseDescription,
            amount: 120,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, 3);

        // Synchronize all pages
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.waitForExpense(expenseDescription);
            await groupDetailPage.waitForPage(groupId, 3);
            await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$40.00');
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$40.00');
        }

        // User2 makes partial settlement of $30 (leaving $10 debt)
        const settlementNote1 = 'Partial payment from user2';
        await groupDetailPage1.recordSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '30',
            note: settlementNote1,
        }, 3);

        // Synchronize settlement
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.waitForSettlementToAppear(settlementNote1);
            await groupDetailPage.verifySettlementDetails({ note: settlementNote1 });
            await groupDetailPage.waitForPage(groupId, 3);
        }

        // Verify updated balances: User2 now owes $10, User3 still owes $40
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$10.00');
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$40.00');
        }

        // User2 makes final settlement of $10 (fully settled)
        const settlementNote2 = 'Final payment from user2 - all settled!';
        await groupDetailPage1.recordSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '10',
            note: settlementNote2,
        }, 3);

        // Synchronize final settlement
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.waitForSettlementToAppear(settlementNote2);
            await groupDetailPage.verifySettlementDetails({ note: settlementNote2 });
            await groupDetailPage.waitForPage(groupId, 3);
        }

        // Verify final state: User2 fully settled, User3 still owes $40
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await expect(groupDetailPage.getDebtInfo(user2DisplayName, user1DisplayName)).not.toBeVisible();
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$40.00');
        }

        // Verify both settlements in history
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifySettlementDetails({ note: "Partial payment from user2" });
            await groupDetailPage.verifySettlementDetails({ note: "Final payment from user2 - all settled!" });
        }
    });
});
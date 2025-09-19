import {expect, simpleTest} from '../../fixtures';
import {SettlementData} from '../../pages/settlement-form.page';
import {generateShortId} from '@splitifyd/test-support';

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
        const memberCount = 2;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

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
        }, memberCount);

        await groupDetailPage2.addExpense({
            description: 'User2 Payment',
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'GBP',
            splitType: 'equal',
        }, memberCount);

        // Verify both users see settled up state
        await groupDetailPage.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();
    });

    simpleTest('should calculate debt correctly when only one person pays', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

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
        }, memberCount);

        // Verify debt calculation on both screens
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00');
    });

    simpleTest('should handle complex multi-expense debt calculations', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

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
        const memberCount = 2;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

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
        const memberCount = 2;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

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
        await groupDetailPage1.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);

        // Verify debt exists
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');

        // State 3: User2 pays $100 → MUST be settled up
        const expenseFormPage2 = await groupDetailPage2.clickAddExpenseButton(memberCount);
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
            currency: 'USD',
            note: 'Test payment for history',
        };

        await settlementForm.submitSettlement(settlementData, 2);
        await groupDetailPage.verifySettlementDetails({note: settlementData.note});

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
            currency: 'USD',
            note: 'Creator receives payment',
        };

        await settlementForm.submitSettlement(settlementData, 2);
        await groupDetailPage.verifySettlementDetails({note: settlementData.note});

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
            currency: 'USD',
            note: 'Initial test payment',
        };

        await settlementForm.submitSettlement(initialData, 2);
        await groupDetailPage.verifySettlementDetails({note: initialData.note});

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
            currency: 'USD',
            note: 'Validation test payment',
        };

        await settlementForm.submitSettlement(initialData, 2);
        await groupDetailPage.verifySettlementDetails({note: initialData.note});

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
            currency: 'USD',
            note: 'Payment to be deleted',
        };

        await settlementForm.submitSettlement(settlementData, 2);
        await groupDetailPage.verifySettlementDetails({note: settlementData.note});

        // Verify settlement exists then delete it
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData.note });
        await groupDetailPage.deleteSettlement(settlementData.note, true);

        // Verify settlement removed from history
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementNotInHistory(settlementData.note);
    });

    simpleTest('should cancel settlement deletion when user clicks cancel', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create settlement
        const settlementForm = await groupDetailPage.clickSettleUpButton(2);
        await settlementForm.waitForFormReady(memberCount);

        const settlementData: SettlementData = {
            payerName: payerName,
            payeeName: payeeName,
            amount: '75.00',
            currency: 'USD',
            note: 'Payment to keep',
        };

        await settlementForm.submitSettlement(settlementData, memberCount);
        await groupDetailPage.verifySettlementDetails({note: settlementData.note});

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
            { dashboardPage: user1DashboardPage },
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
            currency: 'USD',
            note: 'Partial payment of $60',
        }, 2);

        // Wait for settlement to propagate
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify updated debt ($100 - $60 = $40 remaining)
        // Wait for debt to appear (not settled up)
        await expect(groupDetailPage.getBalancesSection().getByText(`${user2DisplayName} → ${user1DisplayName}`)).toBeVisible({ timeout: 5000 });

        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$40.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$40.00');
    });

    simpleTest('should show settled up after exact settlement', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

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
        const settlementFormPage = await groupDetailPage2.clickSettleUpButton(memberCount);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '75.00',
            currency: 'USD',
            note: 'Full settlement payment',
        }, memberCount);

        // Wait for settlement to propagate
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify settlement recorded
        await groupDetailPage.verifySettlementDetails({note: "Full settlement payment"});
        await groupDetailPage.closeModal();
        await groupDetailPage2.verifySettlementDetails({note: "Full settlement payment"});
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
        const memberCount = 3;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage },
            { dashboardPage: user3DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

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
        }, memberCount);

        // Synchronize all pages
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.waitForExpense(expenseDescription);
            await groupDetailPage.waitForPage(groupId, memberCount);
            await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$40.00');
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$40.00');
        }

        // User2 makes partial settlement of $30 (leaving $10 debt)
        const settlementNote1 = 'Partial payment from user2';
        await groupDetailPage1.recordSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '30',
            currency: 'USD',
            note: settlementNote1,
        }, memberCount);

        // Synchronize settlement
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifySettlementDetails({note: settlementNote1});
            await groupDetailPage.verifySettlementDetails({ note: settlementNote1 });
            await groupDetailPage.waitForPage(groupId, memberCount);
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
            currency: 'USD',
            note: settlementNote2,
        }, memberCount);

        // Synchronize final settlement
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifySettlementDetails({note: settlementNote2});
            await groupDetailPage.verifySettlementDetails({ note: settlementNote2 });
            await groupDetailPage.waitForPage(groupId, memberCount);
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

simpleTest.describe('Mixed Currency Operations', () => {
    simpleTest('should handle mixed currency expenses from different users correctly', async ({ createLoggedInBrowsers }) => {
        const memberCount = 3;
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage },
            { dashboardPage: user3DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2, groupDetailPage3] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage, user3DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        // User1 pays $60 USD, split 3 ways → User2 owes $20, User3 owes $20
        await groupDetailPage1.addExpense({
            description: 'USD Expense from User1',
            amount: 60,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, memberCount);

        // User2 pays €45 EUR, split 3 ways → User1 owes €15, User3 owes €15
        await groupDetailPage2.addExpense({
            description: 'EUR Expense from User2',
            amount: 45,
            paidByDisplayName: user2DisplayName,
            currency: 'EUR',
            splitType: 'equal',
        }, memberCount);

        // User3 pays £30 GBP, split 3 ways → User1 owes £10, User2 owes £10
        await groupDetailPage3.addExpense({
            description: 'GBP Expense from User3',
            amount: 30,
            paidByDisplayName: user3DisplayName,
            currency: 'GBP',
            splitType: 'equal',
        }, memberCount);

        // Wait for all expenses to synchronize
        for (const groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.waitForExpense('USD Expense from User1');
            await groupDetailPage.waitForExpense('EUR Expense from User2');
            await groupDetailPage.waitForExpense('GBP Expense from User3');
            await groupDetailPage.waitForPage(groupId, memberCount);
        }

        // Verify mixed currency debt relationships on all pages
        // User1's perspective: User2 owes $20 and £10, User3 owes $20 and €15
        for (const groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$20.00');
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$20.00');
            await groupDetailPage.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€15.00');
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user2DisplayName, '€15.00');
            await groupDetailPage.verifyDebtRelationship(user1DisplayName, user3DisplayName, '£10.00');
            await groupDetailPage.verifyDebtRelationship(user2DisplayName, user3DisplayName, '£10.00');
        }
    });

    simpleTest('should handle same user creating expenses in multiple currencies', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // User1 pays $100 USD → User2 owes $50
        await groupDetailPage.addExpense({
            description: 'USD Expense',
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, memberCount);

        // User1 pays €80 EUR → User2 owes €40
        await groupDetailPage.addExpense({
            description: 'EUR Expense',
            amount: 80,
            paidByDisplayName: user1DisplayName,
            currency: 'EUR',
            splitType: 'equal',
        }, memberCount);

        // User1 pays £60 GBP → User2 owes £30
        await groupDetailPage.addExpense({
            description: 'GBP Expense',
            amount: 60,
            paidByDisplayName: user1DisplayName,
            currency: 'GBP',
            splitType: 'equal',
        }, memberCount);

        // Wait for all expenses to synchronize
        for (const page of [groupDetailPage, groupDetailPage2]) {
            await page.waitForExpense('USD Expense');
            await page.waitForExpense('EUR Expense');
            await page.waitForExpense('GBP Expense');
            await page.waitForPage(groupId, memberCount);
        }

        // Verify User2 owes User1 in all three currencies separately
        for (const page of [groupDetailPage, groupDetailPage2]) {
            await page.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
            await page.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€40.00');
            await page.verifyDebtRelationship(user2DisplayName, user1DisplayName, '£30.00');
        }
    });

    simpleTest('should handle mixed currency settlements correctly', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        // Set up API response interceptor to debug what the frontend receives
        await groupDetailPage1.page.route('**/api/groups/*/full-details', async route => {
            const response = await route.fetch();
            const body = await response.text();

            try {
                const data = JSON.parse(body);
                console.log('=== API RESPONSE INTERCEPTED P1 ===');
                console.log('Balance data from API:', JSON.stringify(data.balances, null, 2));
            } catch (e) {
                console.log('Failed to parse API response:', e);
            }

            route.fulfill({ response });
        });

        await groupDetailPage2.page.route('**/api/groups/*/full-details', async route => {
            const response = await route.fetch();
            const body = await response.text();

            try {
                const data = JSON.parse(body);
                console.log('=== API RESPONSE INTERCEPTED P2 ===');
                console.log('Balance data from API:', JSON.stringify(data.balances, null, 2));
            } catch (e) {
                console.log('Failed to parse API response:', e);
            }

            route.fulfill({ response });
        });

        // Create USD expense: User1 pays $200 → User2 owes $100
        await groupDetailPage1.addExpense({
            description: 'USD Expense for Settlement Test',
            amount: 200,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, memberCount);

        // Wait for expense to sync and verify initial debt
        await groupDetailPage1.waitForExpense('USD Expense for Settlement Test');
        await groupDetailPage2.waitForExpense('USD Expense for Settlement Test');
        await groupDetailPage1.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);

        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');

        // User2 settles with €75 EUR (different currency than the debt)
        const settlementFormPage = await groupDetailPage2.clickSettleUpButton(memberCount);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '75.00',
            currency: 'EUR',
            note: 'EUR Settlement for USD Debt',
        }, memberCount);

        // Wait for settlement to appear in payment history on both pages
        await groupDetailPage1.verifySettlementDetails({note: 'EUR Settlement for USD Debt'});
        await groupDetailPage2.verifySettlementDetails({note: 'EUR Settlement for USD Debt'});

        // Verify settlement appears in history with EUR currency on both pages
        await groupDetailPage1.verifySettlementDetails({note: "EUR Settlement for USD Debt"});
        await groupDetailPage1.closeModal();
        await groupDetailPage2.verifySettlementDetails({note: "EUR Settlement for USD Debt"});
        await groupDetailPage2.closeModal();

        // Wait for pages to fully sync after settlement processing
        await groupDetailPage1.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);

        // Verify USD debt still exists (no currency conversion)
        // AND verify EUR settlement creates opposite EUR debt

        // Add logging to debug the actual balance state
        console.log('=== MIXED CURRENCY SETTLEMENT DEBUG ===');
        const balancesSection1 = groupDetailPage1.getBalancesSection();
        const balancesSection2 = groupDetailPage2.getBalancesSection();

        const balanceText1 = await balancesSection1.textContent();
        const balanceText2 = await balancesSection2.textContent();

        console.log('User1 Page Balance Section:', balanceText1);
        console.log('User2 Page Balance Section:', balanceText2);

        // Try to find the actual amounts shown
        const allAmounts1 = await balancesSection1.locator('[data-testid*="amount"], .amount, .currency-amount').allTextContents();
        const allAmounts2 = await balancesSection2.locator('[data-testid*="amount"], .amount, .currency-amount').allTextContents();

        console.log('User1 Page All Amounts:', allAmounts1);
        console.log('User2 Page All Amounts:', allAmounts2);

        // Log what we're looking for vs what we found
        console.log('Expected: User2 → User1: $100.00');
        console.log('Expected: User1 → User2: €75.00');

        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');
        await groupDetailPage1.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€75.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');
        await groupDetailPage2.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€75.00');
    });

    simpleTest('should show settled up only when all currencies are balanced', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Create expenses in different currencies
        await groupDetailPage.addExpense({
            description: 'USD Expense',
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, memberCount);

        await groupDetailPage.addExpense({
            description: 'EUR Expense',
            amount: 60,
            paidByDisplayName: user1DisplayName,
            currency: 'EUR',
            splitType: 'equal',
        }, memberCount);

        // Wait for expenses to sync
        await groupDetailPage.waitForExpense('USD Expense');
        await groupDetailPage.waitForExpense('EUR Expense');
        await groupDetailPage2.waitForExpense('USD Expense');
        await groupDetailPage2.waitForExpense('EUR Expense');
        await groupDetailPage.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);

        // Verify User2 owes in both currencies
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€30.00');

        // User2 settles USD debt only
        const settlementFormPage = await groupDetailPage2.clickSettleUpButton(memberCount);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '50.00',
            currency: 'USD',
            note: 'USD Settlement Only',
        }, memberCount);

        await groupDetailPage.verifySettlementDetails({note: 'USD Settlement Only'});
        await groupDetailPage.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);

        // Verify USD debt is settled but EUR debt remains
        await expect(groupDetailPage.getBalancesSection().getByText(`${user2DisplayName} → ${user1DisplayName}`).filter({hasText: '$'})).not.toBeVisible();
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€30.00');

        // Should NOT be settled up yet
        await expect(groupDetailPage.getBalancesSection().getByText('All settled up!')).not.toBeVisible();

        // User2 settles EUR debt
        const settlementFormPage2 = await groupDetailPage2.clickSettleUpButton(memberCount);
        await settlementFormPage2.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '30.00',
            currency: 'EUR',
            note: 'EUR Settlement - Final',
        }, memberCount);

        await groupDetailPage.verifySettlementDetails({note: 'EUR Settlement - Final'});
        await groupDetailPage.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);

        // NOW should be settled up
        await groupDetailPage.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();
    });

    simpleTest('should handle mixed currency expense and settlement edits', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Create USD expense
        await groupDetailPage.addExpense({
            description: 'Original USD Expense',
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, memberCount);

        await groupDetailPage.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');

        // Create EUR settlement
        const settlementFormPage = await groupDetailPage.clickSettleUpButton(memberCount);
        const originalSettlementNote = 'Original EUR Settlement';
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '40.00',
            currency: 'EUR',
            note: originalSettlementNote,
        }, memberCount);

        await groupDetailPage.verifySettlementDetails({note: originalSettlementNote});
        await groupDetailPage.waitForPage(groupId, memberCount);

        // Verify mixed currency state
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
        await groupDetailPage.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€40.00');

        // Edit settlement to GBP
        await groupDetailPage.openHistoryIfClosed();
        const editSettlementForm = await groupDetailPage.clickEditSettlement(originalSettlementNote);
        await editSettlementForm.updateSettlement({
            amount: '30.00',
            note: 'Updated GBP Settlement',
        });
        await editSettlementForm.waitForModalClosed();

        await groupDetailPage.waitForPage(groupId, memberCount);

        // Verify updated settlement appears in history
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: 'Updated GBP Settlement' });

        // Verify balances updated - EUR debt removed, new settlement amount
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
        await expect(groupDetailPage.getBalancesSection().getByText(`${user1DisplayName} → ${user2DisplayName}`).filter({hasText: '€'})).not.toBeVisible();

        // Delete the settlement
        await groupDetailPage.deleteSettlement('Updated GBP Settlement', true);

        // Verify only original USD debt remains
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
        await expect(groupDetailPage.getBalancesSection().getByText(`${user1DisplayName} → ${user2DisplayName}`)).not.toBeVisible();
    });

    simpleTest('MINIMAL: single expense + cross currency settlement', async ({ createLoggedInBrowsers }) => {
        const memberCount = 2;
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        // Step 1: Create USD expense: User1 pays $100 → User2 owes $50
        await groupDetailPage1.addExpense({
            description: 'Simple USD Expense',
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, memberCount);

        await groupDetailPage1.waitForExpense('Simple USD Expense');
        await groupDetailPage2.waitForExpense('Simple USD Expense');
        await groupDetailPage1.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);

        // Verify initial debt: User2 owes User1 $50.00
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');

        // Step 2: User2 settles with €30 EUR (different currency)
        const settlementFormPage = await groupDetailPage2.clickSettleUpButton(memberCount);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '30.00',
            currency: 'EUR',
            note: 'Cross Currency Test Settlement',
        }, memberCount);

        // Wait for settlement to process
        await groupDetailPage1.waitForPage(groupId, memberCount);
        await groupDetailPage2.waitForPage(groupId, memberCount);

        // Step 3: Verify CORRECT behavior (no currency conversion should occur)
        // Expected: USD debt unchanged, EUR debt created in opposite direction

        // Add API response interceptor to debug what the frontend receives
        await groupDetailPage1.page.route('**/api/groups/*/full-details', async route => {
            const response = await route.fetch();
            const body = await response.text();

            try {
                const data = JSON.parse(body);
                console.log('=== API RESPONSE INTERCEPTED ===');
                console.log('Balance data from API:', JSON.stringify(data.balances, null, 2));
            } catch (e) {
                console.log('Failed to parse API response:', e);
            }

            route.fulfill({ response });
        });

        await groupDetailPage2.page.route('**/api/groups/*/full-details', async route => {
            const response = await route.fetch();
            const body = await response.text();

            try {
                const data = JSON.parse(body);
                console.log('=== API RESPONSE INTERCEPTED PAGE 2 ===');
                console.log('Balance data from API:', JSON.stringify(data.balances, null, 2));
            } catch (e) {
                console.log('Failed to parse API response:', e);
            }

            route.fulfill({ response });
        });

        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00'); // USD debt unchanged
        await groupDetailPage1.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€30.00'); // EUR debt created
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00'); // USD debt unchanged
        await groupDetailPage2.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€30.00'); // EUR debt created
    });
});
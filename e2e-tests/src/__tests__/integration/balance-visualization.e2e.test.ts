import {expect, simpleTest as test} from '../../fixtures/simple-test.fixture';
import {generateShortId} from '@splitifyd/test-support';
import {GroupDetailPage, JoinGroupPage} from '../../pages';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';

/**
 * Balance Visualization Tests
 *
 * Focused on testing balance calculation, display, and state transitions.
 * Expense creation is kept minimal - comprehensive expense testing is in expense-comprehensive.e2e.test.ts
 */

test.describe('Balance Visualization', () => {

    test('should show settled up when both users pay equal amounts', async ({createLoggedInBrowsers}) => {
        const [
            {dashboardPage: user1DashboardPage},
            {page: page2, dashboardPage: user2DashboardPage}
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Setup 2-person group
        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Create two equal expenses (simplified from comprehensive expense tests)
        await groupDetailPage.addExpense({
            description: 'User1 Payment',
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, 2);

        await groupDetailPage2.addExpense({
            description: 'User2 Payment',
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, 2);

        // Verify both users see settled up state
        const balancesSection = groupDetailPage.getBalancesSection();
        await expect(balancesSection.getByText('All settled up!')).toBeVisible();

        const balancesSection2 = groupDetailPage2.getBalancesSection();
        await expect(balancesSection2.getByText('All settled up!')).toBeVisible();
    });

    test('should show specific debt when only one person pays', async ({createLoggedInBrowsers}) => {
        const [
            {dashboardPage: user1DashboardPage},
            {page: page2, dashboardPage: user2DashboardPage}
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Setup 2-person group
        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // User1 pays $200, split equally → User2 owes $100
        await groupDetailPage.addExpense({
            description: 'One Person Pays',
            amount: 200,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
        }, 2);

        // Verify debt calculation on both screens
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');
    });

    test('should calculate complex debts correctly', async ({createLoggedInBrowsers}) => {
        const memberCount = 2;

        const [
            {dashboardPage: user1DashboardPage},
            {page: page2, user: user2, dashboardPage: user2DashboardPage}
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();


        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // User1 pays $300 first
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense({
            description: 'Large User1 Payment',
            amount: 300,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Wait for first expense to be synced via real-time updates
        await groupDetailPage.waitForBalanceUpdate();

        // Verify first expense is visible via real-time updates
        await groupDetailPage.verifyExpenseVisible('Large User1 Payment');
        await groupDetailPage2.verifyExpenseVisible('Large User1 Payment');

        // User2 adds expense AFTER User1's is synchronized
        const expenseFormPage2b = await groupDetailPage2.clickAddExpenseButton(memberCount);
        await expenseFormPage2b.submitExpense({
            description: 'Small User2 Payment',
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Wait for second expense to be processed
        await groupDetailPage2.waitForBalanceUpdate();

        await expect(groupDetailPage.getBalancesHeading()).toBeVisible();

        // Verify complex debt calculation on User 1's screen: (300-100)/2 = 100
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');

        // IMPORTANT: Also verify User 2's screen shows the same calculated debt
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');

        await groupDetailPage.verifyExpenseVisible('Large User1 Payment');
        await groupDetailPage.verifyExpenseVisible('Small User2 Payment');
    });

    test('should transition from settled to debt to settled predictably', async ({createLoggedInBrowsers}) => {
        const memberCount = 2;

        const [
            {dashboardPage: user1DashboardPage},
            {page: page2, dashboardPage: user2DashboardPage}
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({ }, user2DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        // State 1: Empty group → ALWAYS settled up
        await expect(groupDetailPage1.getBalancesSection().getByText('All settled up!')).toBeVisible();
        await expect(groupDetailPage2.getBalancesSection().getByText('All settled up!')).toBeVisible();

        // State 2: User1 pays $100 → User2 MUST owe $50
        const expenseFormPage = await groupDetailPage1.clickAddExpenseButton(memberCount);
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

        // Wait for expense to be processed via real-time updates
        await groupDetailPage1.waitForPage(groupId, 2);
        await groupDetailPage2.waitForPage(groupId, 2);

        // Verify debt exists with amount $50.00 on User 1's screen
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$50.00');

        // State 3: User2 pays $100 → MUST be settled up
        const expenseFormPage2c = await groupDetailPage2.clickAddExpenseButton(memberCount);
        const expense2Description = generateShortId();
        await expenseFormPage2c.submitExpense({
            description: expense2Description,
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await groupDetailPage1.waitForExpense(expense2Description);
        await groupDetailPage2.waitForExpense(expense2Description);

        // Wait for balance calculations to be updated via real-time updates
        await groupDetailPage2.waitForBalanceUpdate();

        // Guaranteed settled up: both paid $100
        await expect(groupDetailPage1.getBalancesSection().getByText('All settled up!')).toBeVisible();
        await expect(groupDetailPage2.getBalancesSection().getByText('All settled up!')).toBeVisible();

        // Verify NO debt messages remain on either screen
        await expect(groupDetailPage1.getBalancesSection().getByText(`${user2DisplayName} → ${user1DisplayName}`)).not.toBeVisible();
        await expect(groupDetailPage2.getBalancesSection().getByText(`${user2DisplayName} → ${user1DisplayName}`)).not.toBeVisible();

    });

    test('should handle currency formatting in debt amounts', async ({createLoggedInBrowsers}) => {
        const memberCount = 2;

        const [
            {dashboardPage: user1DashboardPage},
            {page: page2, user: user2, dashboardPage: user2DashboardPage}
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const uniqueId = generateShortId();
        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({ }, user2DashboardPage);

        // User1 pays $123.45 → User2 owes exactly $61.73
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense({
            description: 'Currency Test',
            amount: 123.45,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await expect(groupDetailPage.getBalancesHeading()).toBeVisible();

        // Verify debt with calculated amount on User 1's screen: $123.45 / 2 = $61.73
        const expectedDebt = expenseFormPage.calculateEqualSplitDebt(123.45, 2);
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, `$${expectedDebt}`);

        // IMPORTANT: Also verify User 2's screen shows the same formatted debt
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, `$${expectedDebt}`);

        // Verify the original expense amount is visible
        await expect(groupDetailPage.getCurrencyAmount('123.45')).toBeVisible();
    });
});

test.describe('Balance with Settlement Calculations', () => {
    test('should update debt correctly after partial settlement', async ({createLoggedInBrowsers}) => {
        const memberCount = 2;

        const [
            {page, dashboardPage: user1DashboardPage},
            {page: page2, dashboardPage: user2DashboardPage}
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Create group and verify
        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({ }, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Verify no expenses yet
        await expect(groupDetailPage.getNoExpensesText()).toBeVisible();

        // Create expense directly
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense({
            description: 'Test Expense for Settlement',
            amount: 200,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Verify expense appears for User 1
        await groupDetailPage.verifyExpenseVisible('Test Expense for Settlement');
        await expect(groupDetailPage.getCurrencyAmount('200.00')).toBeVisible();

        // Verify User 2 sees expense via real-time updates
        await groupDetailPage2.verifyExpenseVisible('Test Expense for Settlement');
        await groupDetailPage2.verifyCurrencyAmountVisible('200.00');

        // Verify initial debt (User 2 owes User 1 $100) - check both screens BEFORE settlement
        // This helps identify if the issue is with initial balance display or only after settlement

        // User 1's screen - verify they see User 2 owes them $100
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');

        // IMPORTANT: User 2's screen - verify they also see the same $100 debt before settlement
        // This confirms both users have consistent view of the initial balance
        await groupDetailPage2.waitForBalancesToLoad(groupId);
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$100.00');

        // Record partial settlement of $60
        const settlementFormPage = await groupDetailPage.clickSettleUpButton(memberCount);
        await settlementFormPage.submitSettlement(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
                amount: '60',
                note: 'Partial payment of $60',
            },
            memberCount,
        );

        // Wait for settlement to propagate via real-time updates
        await page.waitForLoadState('domcontentloaded', {timeout: 5000});
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify settlement appears in history for both users
        await groupDetailPage.openHistoryAndVerifySettlement(/Partial payment of \$60/);
        await groupDetailPage.closeModal();

        await groupDetailPage2.openHistoryAndVerifySettlement(/Partial payment of \$60/);
        await groupDetailPage2.closeModal();

        // Wait for balance to update from "All settled up!" to showing the debt
        // This is necessary because balance recalculation after settlement is async
        const balancesSectionAfterSettlement = groupDetailPage.getBalancesSection();
        await expect(balancesSectionAfterSettlement.getByText('All settled up!')).toBeHidden({timeout: 5000});

        // Additional wait to ensure the new balance is rendered
        await expect(balancesSectionAfterSettlement.getByText(`${user2DisplayName} → ${user1DisplayName}`)).toBeVisible({timeout: 5000});

        // Assert final balance ($100 - $60 = $40 remaining)
        // Verify updated debt relationship and amount after partial settlement
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$40.00');

        // Verify User 2 also sees updated balance via real-time updates
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$40.00');
    });

    test('should show settled up after exact settlement', async ({createLoggedInBrowsers}) => {
        const memberCount = 2;

        const [
            {page, dashboardPage: user1DashboardPage},
            {page: page2, user: user2, dashboardPage: user2DashboardPage}
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Create known debt: User1 pays $150 → User2 owes $75
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense({
            description: 'One Person Pays',
            amount: 150,
            paidByDisplayName: user1DisplayName,
            currency: 'USD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Wait for expense to be processed via real-time updates
        await groupDetailPage.waitForBalanceUpdate();
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Wait for expense to appear and balance to calculate
        await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
        await groupDetailPage.waitForBalancesToLoad(groupId);

        // Verify debt exists with exact amount: $150 / 2 = $75
        const expectedDebtAmount = '75.00';
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$75.00');

        // User2 pays User1 the exact debt amount ($75) → MUST be settled up
        const settlementFormPage = await groupDetailPage2.clickSettleUpButton(memberCount);
        await settlementFormPage.submitSettlement(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
                amount: expectedDebtAmount,
                note: 'Full settlement payment',
            },
            memberCount,
        );

        // Wait for settlement to propagate via real-time updates
        await page.waitForLoadState('domcontentloaded', {timeout: 5000});
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Check if settlement was recorded by looking at payment history
        const showHistoryButton = groupDetailPage.getShowHistoryButton();
        await showHistoryButton.click();

        await groupDetailPage.verifySettlementInHistoryVisible('Full settlement payment');
        await groupDetailPage.closeModal();

        // Also verify user2 can see the settlement via real-time updates
        const showHistoryButton2 = groupDetailPage2.getShowHistoryButton();
        await showHistoryButton2.click();
        await groupDetailPage2.verifySettlementInHistoryVisible('Full settlement payment');
        await groupDetailPage2.closeModal();

        // Test user1's browser
        await expect(groupDetailPage.getBalancesHeading()).toBeVisible();

        const balanceSection = groupDetailPage.getBalancesSectionByContext();

        // Should be settled up after paying the full debt amount
        await expect(balanceSection.getByText('All settled up!')).toBeVisible();

        // Verify expenses still appear after settlement
        await expect(groupDetailPage.getExpensesHeading()).toBeVisible();
        await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
        await expect(groupDetailPage.getCurrencyAmount('150.00')).toBeVisible();

        // Test user2's browser - should show same data via real-time updates
        await expect(groupDetailPage2.getBalancesHeading()).toBeVisible();

        await expect(groupDetailPage2.getLoadingBalancesText()).not.toBeVisible();

        // Both users should see settled up
        const balanceSection2 = groupDetailPage2.getBalancesSection();
        await expect(balanceSection2.getByText('All settled up!')).toBeVisible();

        // Both users should see the expenses via real-time updates
        await expect(groupDetailPage2.getExpensesHeading()).toBeVisible();
        await groupDetailPage2.verifyExpenseVisible('One Person Pays');
        await groupDetailPage2.verifyCurrencyAmountVisible('150.00');
    });
});

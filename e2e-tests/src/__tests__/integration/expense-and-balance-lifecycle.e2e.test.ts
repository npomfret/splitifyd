import { simpleTest, expect } from '../../fixtures';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { SettlementData } from '../../pages/settlement-form.page';
import { generateShortId } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page';

/**
 * Consolidated Expense and Balance Lifecycle E2E Tests
 *
 * CONSOLIDATION: Merged overlapping tests from:
 * - expense-comprehensive.e2e.test.ts (expense creation, currency, CRUD)
 * - balance-and-settlements-comprehensive.e2e.test.ts (balance calculations)
 *
 * This file covers the complete lifecycle of expenses and their impact on balances,
 * eliminating redundancy while maintaining comprehensive coverage of:
 * - Expense creation with various currencies and precision
 * - Balance calculations and debt relationships
 * - Settlement integration with balance updates
 * - Multi-currency handling across expenses and balances
 */

simpleTest.describe('Expense and Balance Lifecycle - Comprehensive Integration', () => {

    simpleTest('should handle complete expense lifecycle with balance calculations and settlement', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Step 1: Create group and verify initial state (settled up)
        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        await groupDetailPage1.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();

        // Step 2: Create expense with EUR currency and verify balance calculation
        const expenseDescription = `Lifecycle Test ${generateShortId()}`;
        await groupDetailPage1.addExpense({
            description: expenseDescription,
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'EUR',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        // Verify expense appears and balance is calculated correctly (€50 each)
        await groupDetailPage1.waitForExpense(expenseDescription);
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00');

        // Step 3: Edit the expense and verify balance updates
        const expenseDetailPage = await groupDetailPage1.clickExpenseToView(expenseDescription);
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(2);
        const updatedDescription = `Updated ${generateShortId()}`;

        await editFormPage.fillDescription(updatedDescription);
        await editFormPage.fillAmount('150.50');
        await editFormPage.getUpdateExpenseButton().click();

        await expenseDetailPage.waitForExpenseDescription(updatedDescription);
        await expenseDetailPage.waitForCurrencyAmount('€150.50');

        // Navigate back to group to verify updated balance (€75.25 each)
        await expenseDetailPage.page.goto(`/groups/${groupId}`);
        await groupDetailPage1.waitForPage(groupId, 2);
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€75.25');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€75.25');

        // Step 4: Record partial settlement and verify balance update
        const settlementForm = await groupDetailPage2.clickSettleUpButton(2);
        await settlementForm.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '50.25',
            currency: 'EUR',
            note: 'Partial settlement test',
        }, 2);

        // Verify partial settlement reduces debt (€75.25 - €50.25 = €25.00)
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€25.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€25.00');

        // Step 5: Delete expense and verify balance cleared
        const expenseDetailPage2 = await groupDetailPage1.clickExpenseToView(updatedDescription);
        await expenseDetailPage2.deleteExpense();

        // Should be back to group page with expense deleted
        await expect(groupDetailPage1.page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage1.getExpenseByDescription(updatedDescription)).not.toBeVisible();

        // Balance should still show the settlement amount as the only transaction
        // Since expense is deleted but settlement remains, User2 actually paid User1 €50.25
        // So User1 now owes User2 €50.25 (debt relationship reversed)
        await groupDetailPage1.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€50.25');
        await groupDetailPage2.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€50.25');
    });

    simpleTest('should handle multi-currency expenses with different decimal precisions and balance calculations', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Test 1: JPY (0 decimals) with rounding
        const uniqueId = generateShortId();
        await groupDetailPage.addExpense({
            description: `JPY Test ${uniqueId}`,
            amount: 123, // Should split as ¥62 each (123/2 = 61.5 rounds up)
            paidByDisplayName: user1DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        // Verify JPY amount and balance calculation with rounding
        await expect(groupDetailPage.page.getByText('¥123').first()).toBeVisible();
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62');

        // Test 2: BHD (3 decimals)
        await groupDetailPage.addExpense({
            description: `BHD Test ${uniqueId}`,
            amount: 30.5,
            paidByDisplayName: user1DisplayName,
            currency: 'BHD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        // Verify BHD amount displays correctly and net balance calculated
        await expect(groupDetailPage.page.getByText('BHD 30.500').first()).toBeVisible();

        // Net calculation: User2 owes ¥62 + BHD15.250, but different currencies so shown separately
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62');

        // Test 3: KWD (3 decimals) with currency memory
        await groupDetailPage.addExpense({
            description: `KWD Test ${uniqueId}`,
            amount: 5.5,
            paidByDisplayName: user1DisplayName,
            currency: 'KWD',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        // Verify all currencies are displayed correctly with proper precision
        await expect(groupDetailPage.page.getByText('¥123').first()).toBeVisible();
        await expect(groupDetailPage.page.getByText('BHD 30.500').first()).toBeVisible();

        // Check for KWD amount - try multiple possible formats
        const kwdElements = [
            groupDetailPage.page.getByText('KD5.500').first(),
            groupDetailPage.page.getByText('KD 5.500').first(),
            groupDetailPage.page.getByText('5.500 KD').first(),
            groupDetailPage.page.getByText('KWD 5.500').first(),
        ];

        let kwdFound = false;
        for (const element of kwdElements) {
            try {
                await expect(element).toBeVisible({ timeout: 1000 });
                kwdFound = true;
                break;
            } catch (e) {
                // Continue to next format
            }
        }
        if (!kwdFound) {
            throw new Error('KWD amount not found in any expected format');
        }

        // Test 4: Cross-currency settlement (settle JPY debt with EUR)
        const settlementForm = await groupDetailPage2.clickSettleUpButton(2);
        await settlementForm.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '25',
            currency: 'EUR',
            note: 'Cross-currency settlement',
        }, 2);

        // Verify settlement appears while original currency debts remain
        await groupDetailPage.verifySettlementDetails({ note: 'Cross-currency settlement' });
        await groupDetailPage2.verifySettlementDetails({ note: 'Cross-currency settlement' });

        // Original currency debts should still be visible since different currency
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62');
    });

    simpleTest('should handle expense creation with custom date, time, and immediate balance impact', async ({ createLoggedInBrowsers }) => {
        const [
            { page, dashboardPage }
        ] = await createLoggedInBrowsers(1);

        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
        const groupId = groupDetailPage.inferGroupId();

        // Create expense with custom date/time and currency
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);
        await expenseFormPage.waitForExpenseFormSections();

        // Fill expense details with custom date/time
        const expenseDescription = 'Dinner with custom datetime and balance';
        await expenseFormPage.fillDescription(expenseDescription);
        await expenseFormPage.fillAmount('89.99');

        // Set currency to EUR
        const currencyButton = page.getByRole('button', { name: /select currency/i });
        await currencyButton.click();
        const searchInput = page.getByPlaceholder('Search by symbol, code, or country...');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('EUR');
        const currencyOption = page.getByText('Euro (EUR)').first();
        await currencyOption.click();

        // Set yesterday's date and custom time
        await expenseFormPage.clickYesterdayButton();

        // Set custom time
        let timeButton = expenseFormPage.getTimeButton();
        const timeButtonCount = await timeButton.count();

        if (timeButtonCount === 0) {
            const clockIcon = expenseFormPage.getClockIcon();
            const clockIconCount = await clockIcon.count();
            if (clockIconCount > 0) {
                await expenseFormPage.clickClockIcon();
            }
            timeButton = expenseFormPage.getTimeButton();
        }

        await expect(timeButton).toBeVisible();
        await timeButton.click();
        const timeInput = expenseFormPage.getTimeInput();
        await timeInput.fill('7:30pm');
        await expenseFormPage.getExpenseDetailsHeading().click(); // Blur to commit

        // Submit expense (single person group, so no balance change expected)
        await expenseFormPage.selectPayer(userDisplayName);
        await expenseFormPage.clickSelectAllButton();
        await expenseFormPage.clickSaveExpenseButton();

        // Verify success and currency display
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await groupDetailPage.verifyExpenseInList(expenseDescription, '€89.99');

        // Should remain settled up since only one person
        await groupDetailPage.waitForSettledUpMessage();
    });

    simpleTest('should handle complex multi-expense net balance calculations with settlements', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Scenario: Complex expense and settlement flow to test net calculations

        // User1 pays €300 (each owes €150)
        await groupDetailPage.addExpense({
            description: 'Large User1 Payment',
            amount: 300,
            paidByDisplayName: user1DisplayName,
            currency: 'EUR',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€150.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€150.00');

        // User2 pays €100 (each owes €50, net: User2 owes €100)
        await groupDetailPage2.addExpense({
            description: 'Small User2 Payment',
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'EUR',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        // Net calculation: User2 owes €150 - €50 = €100
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€100.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€100.00');

        // User2 makes partial settlement of €60
        const settlementForm = await groupDetailPage2.clickSettleUpButton(2);
        await settlementForm.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '60.00',
            currency: 'EUR',
            note: 'Partial settlement in complex scenario',
        }, 2);

        // Final balance: €100 - €60 = €40
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€40.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€40.00');

        // Verify settlement is recorded
        await groupDetailPage.verifySettlementDetails({ note: 'Partial settlement in complex scenario' });
        await groupDetailPage2.verifySettlementDetails({ note: 'Partial settlement in complex scenario' });

        // Add one more expense to test continued calculation
        await groupDetailPage.addExpense({
            description: 'Final Test Expense',
            amount: 50,
            paidByDisplayName: user1DisplayName,
            currency: 'EUR',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        // Final net: €40 + €25 = €65
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€65.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€65.00');
    });

});
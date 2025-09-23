import { simpleTest, expect } from '../../fixtures';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { groupDetailUrlPattern } from '../../pages/group-detail.page';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { generateShortId } from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';

/**
 * Expense Feature-Specific E2E Tests
 *
 * This file focuses exclusively on expense-specific features that don't require
 * balance calculations or multi-user scenarios:
 * - Form validation and UI behavior
 * - Date/time selection functionality
 * - Real-time comments system
 * - Server-side validation error handling
 *
 * For expense lifecycle (creation, editing, deletion) and balance impact tests,
 * see expense-and-balance-lifecycle.e2e.test.ts
 */

simpleTest.describe('Expense Form Validation & UI Behavior', () => {
    simpleTest('should validate form inputs and handle submission states', async ({ createLoggedInBrowsers }) => {
        const memberCount = 1;

        const [{ dashboardPage }] = await createLoggedInBrowsers(memberCount);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        const submitButton = expenseFormPage.getSaveButtonForValidation();

        // Test validation sequence
        await expect(submitButton).toBeDisabled(); // Empty form

        await expenseFormPage.fillDescription('Test expense');
        await expect(submitButton).toBeDisabled(); // Missing amount

        await expenseFormPage.fillAmount('0');
        await expect(submitButton).toBeDisabled(); // Zero amount

        await expenseFormPage.fillAmount('50');
        await expect(submitButton).toBeEnabled({ timeout: 2000 }); // Valid form

        // Test clearing description disables form again
        await expenseFormPage.fillDescription('');
        await expect(submitButton).toBeDisabled(); // Missing description
    });

    simpleTest('should handle server validation errors gracefully', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected: Failed to load resource: the server responded with a status of 400 (Bad Request)' });

        const memberCount = 1;

        const [{ page, dashboardPage }] = await createLoggedInBrowsers(memberCount);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Create invalid form state that passes client validation but fails server validation
        await expenseFormPage.fillDescription('Test expense');
        await expenseFormPage.fillAmount('50');

        // Set a currency to pass client validation
        const currencyButton = page.getByRole('button', { name: /select currency/i });
        await currencyButton.click();
        const searchInput = page.getByPlaceholder('Search by symbol, code, or country...');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('EUR');
        const currencyOption = page.getByText('Euro (EUR)').first();
        await currencyOption.click();

        const submitButton = expenseFormPage.getSaveButtonForValidation();
        await expect(submitButton).toBeEnabled({ timeout: 2000 });

        await expenseFormPage.typeCategoryText(''); // Clear category to trigger server error
        await submitButton.click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
        await expect(page.getByRole('heading', { name: /something went wrong/i })).toBeVisible({ timeout: 5000 });
    });
});

simpleTest.describe('Date and Time Selection', () => {
    simpleTest('should handle date convenience buttons and time input', async ({ createLoggedInBrowsers }) => {
        const memberCount = 1;

        const [{ dashboardPage }] = await createLoggedInBrowsers(memberCount);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Test date convenience buttons
        const dateInput = expenseFormPage.getDateInput();

        // Test Today button
        await expenseFormPage.clickTodayButton();
        const todayInputValue = await dateInput.inputValue();
        expect(todayInputValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Test Yesterday button
        await expenseFormPage.clickYesterdayButton();
        const yesterdayInputValue = await dateInput.inputValue();
        expect(yesterdayInputValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Verify yesterday is one day before today
        const todayParsed = new Date(todayInputValue + 'T00:00:00');
        const yesterdayParsed = new Date(yesterdayInputValue + 'T00:00:00');
        const dayDifference = (todayParsed.getTime() - yesterdayParsed.getTime()) / (1000 * 60 * 60 * 24);
        expect(dayDifference).toBe(1);

        // Test Last Night button (sets evening time)
        await expenseFormPage.clickLastNightButton();
        const lastNightInputValue = await dateInput.inputValue();
        expect(lastNightInputValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Test time input functionality
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
        await expect(timeInput).toBeVisible();
        await expect(timeInput).toBeFocused();

        // Test time suggestions
        await timeInput.fill('3');
        await expect(expenseFormPage.getTimeSuggestion('3:00 AM')).toBeVisible();
        await expect(expenseFormPage.getTimeSuggestion('3:00 PM')).toBeVisible();

        // Accept time selection
        await expenseFormPage.getTimeSuggestion('3:00 PM').click();
        await expect(expenseFormPage.getTimeSuggestion('at 3:00 PM')).toBeVisible();
    });

});

simpleTest.describe('Real-time Comments', () => {
    simpleTest('should support real-time expense comments', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.setTimeout(20000); // 20 seconds
        // Create two browser instances - Alice and Bob
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage },
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [user1GroupDetailPage, user2GroupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = user1GroupDetailPage.inferGroupId();

        // Create expense
        const expenseFormPage = await user1GroupDetailPage.clickAddExpenseButton(2);
        const expenseDescription = 'Test Expense for Comments';
        await expenseFormPage.submitExpense({
            description: expenseDescription,
            amount: 50000,
            currency: 'VND',
            paidByDisplayName: user1DisplayName,
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await user1GroupDetailPage.waitForExpense(expenseDescription);
        await user2GroupDetailPage.waitForExpense(expenseDescription);

        // Navigate to expense detail pages
        const aliceExpenseDetailPage = await user1GroupDetailPage.clickExpenseToView(expenseDescription);
        const bobExpenseDetailPage = await user2GroupDetailPage.clickExpenseToView(expenseDescription);

        await aliceExpenseDetailPage.verifyCommentsSection();
        await bobExpenseDetailPage.verifyCommentsSection();

        // Test real-time comments
        const comment1 = `comment ${uuidv4()}`;
        await aliceExpenseDetailPage.addComment(comment1);
        await bobExpenseDetailPage.waitForCommentToAppear(comment1);

        const comment2 = `comment ${uuidv4()}`;
        await bobExpenseDetailPage.addComment(comment2);
        await aliceExpenseDetailPage.waitForCommentToAppear(comment2);

        // Verify both comments visible
        await aliceExpenseDetailPage.waitForCommentCount(2);
        await bobExpenseDetailPage.waitForCommentCount(2);

        await expect(aliceExpenseDetailPage.getCommentByText(comment1)).toBeVisible();
        await expect(aliceExpenseDetailPage.getCommentByText(comment2)).toBeVisible();
        await expect(bobExpenseDetailPage.getCommentByText(comment1)).toBeVisible();
        await expect(bobExpenseDetailPage.getCommentByText(comment2)).toBeVisible();
    });
});
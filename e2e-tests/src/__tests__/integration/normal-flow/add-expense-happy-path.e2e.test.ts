import { authenticatedPageTest as test, expect } from '../../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../../helpers';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';
import { GroupWorkflow } from '../../../workflows';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';
import { ExpenseBuilder } from '@splitifyd/test-support';

setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
    test('should add new expense with equal split', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const memberCount = 1;

        // Use the comprehensive helper method for group creation and preparation
        const groupId = await GroupWorkflow.createGroup(page, generateTestGroupName('Expense'), 'Testing expense creation');

        // Navigate to expense form with all necessary waits
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        const testDinnerExpense = new ExpenseBuilder()
            .withDescription('Test Dinner')
            .withAmount(50)
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build();
        await expenseFormPage.submitExpense(testDinnerExpense);

        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription('Test Dinner')).toBeVisible();
        await expect(groupDetailPage.getExpenseAmount('$50.00')).toBeVisible();
    });

    // Form validation tests moved to form-validation.e2e.test.ts

    test('should allow selecting expense category', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Category'), 'Testing expense categories');

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded
        await groupDetailPage.waitForBalancesToLoad(groupId);

        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        const categoryExpense = new ExpenseBuilder()
            .withDescription('Dinner with category')
            .withAmount(45)
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build();
        await expenseFormPage.submitExpense(categoryExpense);

        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage.getExpenseByDescription('Dinner with category')).toBeVisible();
    });

    test('should show expense in group after creation', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Display'), 'Testing expense display');

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded (members, balances, etc.)
        await groupDetailPage.waitForBalancesToLoad(groupId);

        // Click add expense button
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        // Wait for navigation to add expense page
        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        const movieTicketsExpense = new ExpenseBuilder()
            .withDescription('Movie Tickets')
            .withAmount(25)
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build();
        await expenseFormPage.submitExpense(movieTicketsExpense);

        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription('Movie Tickets')).toBeVisible();

        const amountText = groupDetailPage.getExpenseAmount('$25.00');
        await expect(amountText).toBeVisible();

        await expect(expenseFormPage.getExpensePaidByText()).toBeVisible();
    });

    test('should allow custom category input', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('CustomCategory'), 'Testing custom category input');

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded
        await groupDetailPage.waitForBalancesToLoad(groupId);

        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        const customCategoryExpense = new ExpenseBuilder()
            .withDescription('Custom category expense')
            .withAmount(16)
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build();
        await expenseFormPage.submitExpense(customCategoryExpense);

        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription('Custom category expense')).toBeVisible();
    });
});

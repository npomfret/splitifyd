import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { generateTestGroupName } from '../../utils/test-helpers';
import { groupDetailUrlPattern, waitForURLWithContext } from '../../helpers/wait-helpers';
import { GroupWorkflow } from '../../workflows';

setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
    test('should add new expense with equal split', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const memberCount = 1;

        // Use the comprehensive helper method for group creation and preparation
        const groupId = await GroupWorkflow.createGroup(page, generateTestGroupName('Expense'), 'Testing expense creation');

        // Navigate to expense form with all necessary waits
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        const categorySelect = expenseFormPage.getCategorySelect();

        await expenseFormPage.fillDescription('Test Dinner');
        await expenseFormPage.fillAmount('50');

        await expect(categorySelect).toBeVisible();
        await expenseFormPage.typeCategoryText('dinner');

        // The save button should be visible
        // Check if button is enabled and get validation errors if not
        await expenseFormPage.expectSubmitButtonEnabled();

        // Submit the expense
        await expenseFormPage.clickSaveExpenseButton();

        await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription('Test Dinner')).toBeVisible();
        await expect(groupDetailPage.getExpenseAmount('$50.00')).toBeVisible();
    });

    // Form validation tests moved to form-validation.e2e.test.ts

    test('should allow selecting expense category', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Category'), 'Testing expense categories');

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded
        await groupDetailPage.waitForBalancesToLoad(groupId);

        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        const categorySelect = expenseFormPage.getCategorySelect();
        await expect(categorySelect).toBeVisible();

        const initialCategory = await categorySelect.inputValue();

        await expenseFormPage.typeCategoryText('Bills & Utilities');

        const newCategory = await categorySelect.inputValue();
        expect(newCategory).not.toBe(initialCategory);

        await expenseFormPage.fillDescription('Dinner with category');
        await expenseFormPage.fillAmount('45');

        await expenseFormPage.clickSaveExpenseButton();
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await expect(groupDetailPage.getExpenseByDescription('Dinner with category')).toBeVisible();
    });

    test('should show expense in group after creation', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Display'), 'Testing expense display');

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded (members, balances, etc.)
        await groupDetailPage.waitForBalancesToLoad(groupId);

        // Click add expense button
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        // Wait for navigation to add expense page
        await page.waitForURL(`**/groups/${groupId}/add-expense`);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Select all participants for the expense
        await expenseFormPage.selectAllParticipants();

        // Fill in the expense details
        await expenseFormPage.fillDescription('Movie Tickets');
        await expenseFormPage.fillAmount('25');

        // Now save the expense (button enable check and spinner wait handled internally)
        await expenseFormPage.clickSaveExpenseButton();

        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription('Movie Tickets')).toBeVisible();

        const amountText = groupDetailPage.getExpenseAmount('$25.00');
        await expect(amountText).toBeVisible();

        await expect(expenseFormPage.getExpensePaidByText()).toBeVisible();
    });

    test('should allow custom category input', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('CustomCategory'), 'Testing custom category input');

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded
        await groupDetailPage.waitForBalancesToLoad(groupId);

        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        // Test custom category input
        await expenseFormPage.typeCategoryText('Custom Office Supplies');

        await expenseFormPage.fillDescription('Custom category expense');
        await expenseFormPage.fillAmount('16');

        await expenseFormPage.clickSaveExpenseButton();

        await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription('Custom category expense')).toBeVisible();
    });
});

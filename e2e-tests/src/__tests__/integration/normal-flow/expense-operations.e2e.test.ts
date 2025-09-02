import { authenticatedPageTest as test, expect } from '../../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';
import { ExpenseBuilder } from '@splitifyd/test-support';

setupMCPDebugOnFailure();

test.describe('Basic Expense Operations E2E', () => {
    test('should create, view, and delete an expense', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Operations'), 'Testing complete expense lifecycle');
        const groupInfo = { user };
        const memberCount = 1;

        // Create expense using page object
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        const testExpense = new ExpenseBuilder()
            .withDescription('Test Expense Lifecycle')
            .withAmount(50)
            .withCurrency('USD')
            .withPaidBy(groupInfo.user.uid)
            .withSplitType('equal')
            .build();
        await expenseFormPage.submitExpense(testExpense);

        // Verify expense appears in list
        await expect(groupDetailPage.getExpenseByDescription('Test Expense Lifecycle')).toBeVisible();

        // Navigate to expense detail to view it
        await groupDetailPage.clickExpenseToView('Test Expense Lifecycle');

        // Verify expense detail page (view functionality)
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expect(groupDetailPage.getExpenseByDescription('Test Expense Lifecycle')).toBeVisible();
        await expect(groupDetailPage.getCurrencyAmount('50.00').first()).toBeVisible();

        // Delete the expense
        await groupDetailPage.deleteExpense();

        // Should redirect back to group
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Expense should no longer be visible (deletion verification)
        await expect(groupDetailPage.getExpenseByDescription('Test Expense Lifecycle')).not.toBeVisible();
    });
});

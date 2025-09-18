import {expect, simpleTest as test} from '../../fixtures/simple-test.fixture';
import {generateShortId, generateTestGroupName} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page.ts';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';

test.describe('Expense Form Operations E2E', () => {
    test('should perform basic expense CRUD operations', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();

        // Get the current user's display name
        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();

        // Create group and navigate to it
        const groupName = generateTestGroupName('CRUD Test');
        const groupDetailPageNav = await dashboardPage.createGroupAndNavigate(groupName, 'Testing basic expense CRUD operations');
        const groupId = groupDetailPageNav.inferGroupId();
        const memberCount = 1;

        // CREATE: Create expense using page object
        const expenseFormPage = await groupDetailPageNav.clickAddExpenseButton(memberCount);
        const expenseDescription = `CRUD Test ${(generateShortId())}`;
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidByDisplayName(userDisplayName)
                .withSplitType('equal')
                .build(),
        );

        await groupDetailPageNav.waitForExpense(expenseDescription);

        // READ: Navigate to expense detail to view it
        const expenseDetailPage = await groupDetailPageNav.clickExpenseToView(expenseDescription);
        await expect(expenseDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await expect(expenseDetailPage.getCurrencyAmount('50.00')).toBeVisible();

        // UPDATE: Simple edit operation
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(memberCount);
        await editFormPage.fillAmount('75');
        await editFormPage.getUpdateExpenseButton().click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expenseDetailPage.waitForPageReady();
        await expect(expenseDetailPage.getCurrencyAmount('75.00')).toBeVisible();

        // DELETE: Delete the expense
        await groupDetailPageNav.deleteExpense();

        // Should redirect back to group
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Expense should no longer be visible
        await expect(groupDetailPageNav.getExpenseByDescription(expenseDescription)).not.toBeVisible();
    });
});

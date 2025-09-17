import { simpleTest as test, expect } from '../../fixtures/simple-test.fixture';
import { GroupDetailPage, ExpenseDetailPage } from '../../pages';
import { TestGroupWorkflow } from '../../helpers';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { v4 as uuidv4 } from 'uuid';

test.describe('Expense Operations E2E', () => {
    test('should perform basic expense CRUD operations', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const expenseDetailPage = new ExpenseDetailPage(page, user);
        const uniqueId = uuidv4().slice(0, 8);

        // Get the current user's display name
        const userDisplayName = await dashboardPage.getCurrentUserDisplayName();

        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);
        const memberCount = 1;

        // CREATE: Create expense using page object
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder().withDescription(`CRUD Test ${uniqueId}`).withAmount(50).withCurrency('USD').withPaidByDisplayName(userDisplayName).withSplitType('equal').build(),
        );

        // Verify expense appears in list
        await expect(groupDetailPage.getExpenseByDescription(`CRUD Test ${uniqueId}`)).toBeVisible();

        // READ: Navigate to expense detail to view it
        await groupDetailPage.clickExpenseToView(`CRUD Test ${uniqueId}`);
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expect(groupDetailPage.getExpenseByDescription(`CRUD Test ${uniqueId}`)).toBeVisible();
        await expect(groupDetailPage.getCurrencyAmount('50.00').first()).toBeVisible();

        // UPDATE: Simple edit operation
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(memberCount);
        await editFormPage.fillAmount('75');
        await editFormPage.getUpdateExpenseButton().click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expenseDetailPage.waitForPageReady();
        await expect(groupDetailPage.getCurrencyAmount('75.00').first()).toBeVisible();

        // DELETE: Delete the expense
        await groupDetailPage.deleteExpense();

        // Should redirect back to group
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Expense should no longer be visible
        await expect(groupDetailPage.getExpenseByDescription(`CRUD Test ${uniqueId}`)).not.toBeVisible();
    });
});

// Note: Complex editing scenarios (multi-property edits, split types) and real-time multi-user updates are tested in realtime-expense-editing.e2e.test.ts
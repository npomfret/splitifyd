import {authenticatedPageTest as test, expect} from '../../../fixtures/authenticated-page-test';
import {setupMCPDebugOnFailure, TestGroupWorkflow} from '../../../helpers';
import {groupDetailUrlPattern} from '../../../pages/group-detail.page.ts';
import {ExpenseBuilder} from '@splitifyd/test-support';
import {v4 as uuidv4} from 'uuid';

setupMCPDebugOnFailure();

test.describe('Basic Expense Operations E2E', () => {
    test('should create, view, and delete an expense', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const uniqueId = uuidv4().slice(0, 8);
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);
        const groupInfo = { user };
        const memberCount = 1;

        // Create expense using page object
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense(new ExpenseBuilder()
            .withDescription(`Test Expense Lifecycle ${uniqueId}`)
            .withAmount(50)
            .withCurrency('USD')
            .withPaidBy(groupInfo.user.uid)
            .withSplitType('equal')
            .build());

        // Verify expense appears in list
        await expect(groupDetailPage.getExpenseByDescription(`Test Expense Lifecycle ${uniqueId}`)).toBeVisible();

        // Navigate to expense detail to view it
        await groupDetailPage.clickExpenseToView(`Test Expense Lifecycle ${uniqueId}`);

        // Verify expense detail page (view functionality)
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expect(groupDetailPage.getExpenseByDescription(`Test Expense Lifecycle ${uniqueId}`)).toBeVisible();
        await expect(groupDetailPage.getCurrencyAmount('50.00').first()).toBeVisible();

        // Delete the expense
        await groupDetailPage.deleteExpense();

        // Should redirect back to group
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Expense should no longer be visible (deletion verification)
        await expect(groupDetailPage.getExpenseByDescription(`Test Expense Lifecycle ${uniqueId}`)).not.toBeVisible();
    });
});

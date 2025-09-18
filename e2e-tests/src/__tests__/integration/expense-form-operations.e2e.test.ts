import {expect, simpleTest as test} from '../../fixtures/simple-test.fixture';
import {generateShortId} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';
import {DashboardPage} from "../../pages";

test.describe('Expense Form Operations E2E', () => {

    async function setupTestGroup(dashboardPage: DashboardPage) {
        const groupName = `Expense test ${generateShortId()}`;
        return await dashboardPage.createGroupAndNavigate(groupName, 'Testing expense operations');
    }

    test('should validate form inputs comprehensively', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();
        const groupDetailPage = await setupTestGroup(dashboardPage);
        const memberCount = await groupDetailPage.getCurrentMemberCount();
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        const submitButton = expenseFormPage.getSaveButtonForValidation();

        // Test multiple validation scenarios in sequence
        await expect(submitButton).toBeDisabled(); // Empty form

        await expenseFormPage.fillDescription('Test expense');
        await expect(submitButton).toBeDisabled(); // Missing amount

        await expenseFormPage.fillAmount('0');
        await expect(submitButton).toBeDisabled(); // Zero amount

        // Test with valid amount to enable form
        await expenseFormPage.fillAmount('50');
        await expect(submitButton).toBeEnabled({ timeout: 2000 }); // Valid form

        // Test clearing description disables form again
        await expenseFormPage.fillDescription('');
        await expect(submitButton).toBeDisabled(); // Missing description
    });

    test('should create and edit expense successfully', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();
        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        const groupDetailPage = await setupTestGroup(dashboardPage);
        const memberCount = await groupDetailPage.getCurrentMemberCount();

        // Create expense
        const originalDescription = `Edit Test ${generateShortId()}`;
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(originalDescription)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidByDisplayName(userDisplayName)
                .withSplitType('equal')
                .withParticipants([userDisplayName])
                .build(),
        );

        await groupDetailPage.waitForExpense(originalDescription);
        await expect(groupDetailPage.getExpenseByDescription(originalDescription)).toBeVisible();

        // Edit expense
        const expenseDetailPage = await groupDetailPage.clickExpenseToView(originalDescription);
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(memberCount);
        const updatedDescription = `Updated ${generateShortId()}`;

        await editFormPage.fillDescription(updatedDescription);
        await editFormPage.fillAmount('75');
        await editFormPage.getUpdateExpenseButton().click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expect(expenseDetailPage.getExpenseByDescription(updatedDescription)).toBeVisible();
        await expect(expenseDetailPage.getCurrencyAmount('75.00')).toBeVisible();
    });

    test('should delete expense', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();
        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        const groupDetailPage = await setupTestGroup(dashboardPage);
        const memberCount = await groupDetailPage.getCurrentMemberCount();

        const expenseDescription = `Delete Test ${generateShortId()}`;
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidByDisplayName(userDisplayName)
                .withSplitType('equal')
                .withParticipants([userDisplayName])
                .build(),
        );

        await groupDetailPage.waitForExpense(expenseDescription);
        await groupDetailPage.clickExpenseToView(expenseDescription);
        await groupDetailPage.deleteExpense();

        await expect(page).toHaveURL(groupDetailUrlPattern());
        await expect(groupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();
    });

    test('should handle server validation error gracefully', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'expected: Failed to load resource: the server responded with a status of 400 (Bad Request)' });

        const { page, dashboardPage } = await newLoggedInBrowser();
        const groupDetailPage = await setupTestGroup(dashboardPage);
        const memberCount = await groupDetailPage.getCurrentMemberCount();
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Create invalid form state that passes client validation but fails server validation
        await expenseFormPage.fillDescription('Test expense');
        await expenseFormPage.fillAmount('50');
        const submitButton = expenseFormPage.getSaveButtonForValidation();
        await expect(submitButton).toBeEnabled({ timeout: 2000 });

        await expenseFormPage.typeCategoryText(''); // Clear category to trigger server error
        await submitButton.click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
        await expect(page.getByRole('heading', { name: /something went wrong/i })).toBeVisible({ timeout: 5000 });
    });
});

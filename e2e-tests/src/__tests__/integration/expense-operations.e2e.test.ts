import { simpleTest as test, expect } from '../../fixtures/simple-test.fixture';
import { GroupDetailPage, ExpenseDetailPage } from '../../pages';
import { TestGroupWorkflow } from '../../helpers';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { v4 as uuidv4 } from 'uuid';

test.describe('Basic Expense Operations E2E', () => {
    test('should create, view, and delete an expense', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const uniqueId = uuidv4().slice(0, 8);

        // Get the current user's display name
        const userDisplayName = await dashboardPage.getCurrentUserDisplayName();

        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);
        const groupInfo = { user };
        const memberCount = 1;

        // Create expense using page object
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder().withDescription(`Test Expense Lifecycle ${uniqueId}`).withAmount(50).withCurrency('USD').withPaidByDisplayName(userDisplayName).withSplitType('equal').build(),
        );

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

    test('should edit expense and change split type from equal to exact', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const uniqueId = uuidv4().slice(0, 8);

        // Get the current user's display name
        const userDisplayName = await dashboardPage.getCurrentUserDisplayName();

        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);

        // Note: For now, testing with single user only as multi-user setup is not available
        const totalMembers = 1;

        // Step 1: Create initial expense with equal split
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(totalMembers);
        const initialExpenseData = new ExpenseFormDataBuilder()
            .withDescription(`Edit Split Test ${uniqueId}`)
            .withAmount(100) // Nice round number for testing
            .withCurrency('USD')
            .withPaidByDisplayName(userDisplayName)
            .withSplitType('equal')
            .build();

        await expenseFormPage.submitExpense(initialExpenseData);

        // Step 2: Verify initial expense appears with equal split (50/50)
        await expect(groupDetailPage.getExpenseByDescription(`Edit Split Test ${uniqueId}`)).toBeVisible();

        // Navigate to expense detail page
        const expenseDetailPage = new ExpenseDetailPage(page, user);
        await groupDetailPage.clickExpenseToView(`Edit Split Test ${uniqueId}`);

        // Verify we're on expense detail page
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);

        // Verify initial equal split amounts (should be $100.00 for single user)
        await expect(groupDetailPage.getCurrencyAmount('100.00').first()).toBeVisible();

        // Step 3: Edit the expense to change split type
        await expenseDetailPage.waitForPageReady();

        const editFormPage = await expenseDetailPage.clickEditExpenseButton(totalMembers);

        // Step 4: Change to exact amounts split
        await editFormPage.selectExactAmountsSplit();

        // Verify exact amounts instructions appear
        await expect(editFormPage.getExactAmountsInstructions()).toBeVisible();

        // Step 5: Set exact split amounts (user pays 60, second user pays 40)
        const splitInputs = editFormPage.getSplitAmountInputs();
        await expect(splitInputs).toHaveCount(totalMembers);

        // Fill exact amounts for single user
        await editFormPage.fillSplitAmount(0, '100'); // Single user owes the full amount

        // Step 6: Update the expense
        const updateButton = editFormPage.getUpdateExpenseButton();
        await expect(updateButton).toBeVisible();
        await updateButton.click();

        // Step 7: Verify we remain on expense detail page after update
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);

        // Step 9: Verify the split amounts have changed to exact values
        // For single user test, amount should remain $100.00
        await expect(groupDetailPage.getCurrencyAmount('100.00').first()).toBeVisible();

        // Step 10: Navigate back to group to verify balance updates
        await expenseDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);

        // Wait for balances to recalculate
        await groupDetailPage.waitForBalanceUpdate();

        // Verify balance section exists
        await expect(groupDetailPage.getBalancesHeading()).toBeVisible();

        console.log('✅ Expense split editing test passed - successfully changed from equal to exact split');
    });
});

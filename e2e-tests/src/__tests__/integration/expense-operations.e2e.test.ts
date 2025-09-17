import { simpleTest as test, expect } from '../../fixtures/simple-test.fixture';
import { GroupDetailPage, ExpenseDetailPage } from '../../pages';
import { TestGroupWorkflow } from '../../helpers';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { generateTestGroupName } from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';

test.describe('Expense Operations E2E', () => {
    test('should create, view, and delete an expense', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const uniqueId = uuidv4().slice(0, 8);

        // Get the current user's display name
        const userDisplayName = await dashboardPage.getCurrentUserDisplayName();

        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);
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

    test('should edit expense properties (amount, description, split type)', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking for edit operations that may have transient API validation issues
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues during editing' });

        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const uniqueId = uuidv4().slice(0, 8);
        const memberCount = 1;

        // Create group and navigate to it
        const groupDetail = await dashboardPage.createGroupAndNavigate(generateTestGroupName('EditProps'), 'Testing expense property editing');
        const groupId = groupDetail.inferGroupId();

        // Test 1: Create initial expense
        const formPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await formPage.fillDescription(`Edit Test ${uniqueId}`);
        await formPage.fillAmount('100');
        await formPage.selectAllParticipants();
        await formPage.selectCategoryFromSuggestions('Food & Dining');
        await formPage.clickSaveExpenseButton();

        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await groupDetailPage.verifyExpenseInList(`Edit Test ${uniqueId}`, '$100.00');

        // Test 2: Edit amount (consolidates increase/decrease testing)
        const expenseDetailPage = new ExpenseDetailPage(page, user);
        await groupDetailPage.clickExpenseToView(`Edit Test ${uniqueId}`);

        const editFormPage = await expenseDetailPage.clickEditExpenseButton(memberCount);
        await editFormPage.fillAmount('75.50');

        const updateButton = editFormPage.getUpdateExpenseButton();
        await updateButton.click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expenseDetailPage.waitForPageReady();
        await expenseDetailPage.verifyExpenseHeading(/Edit Test.*\$75\.50/);

        // Test 3: Edit description
        const editFormPage2 = await expenseDetailPage.clickEditExpenseButton(memberCount);
        await editFormPage2.fillDescription(`Updated Test ${uniqueId}`);

        const updateButton2 = editFormPage2.getUpdateExpenseButton();
        await updateButton2.click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expenseDetailPage.waitForPageReady();
        await expenseDetailPage.verifyExpenseHeading(/Updated Test.*\$75\.50/);

        // Test 4: Change split type from equal to exact
        const editFormPage3 = await expenseDetailPage.clickEditExpenseButton(memberCount);
        await editFormPage3.selectExactAmountsSplit();

        // Verify exact amounts instructions appear
        await expect(editFormPage3.getExactAmountsInstructions()).toBeVisible();

        // Set exact split amounts for single user
        const splitInputs = editFormPage3.getSplitAmountInputs();
        await expect(splitInputs).toHaveCount(memberCount);
        await editFormPage3.fillSplitAmount(0, '75.50');

        const updateButton3 = editFormPage3.getUpdateExpenseButton();
        await expect(updateButton3).toBeVisible();
        await updateButton3.click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expect(groupDetailPage.getCurrencyAmount('75.50').first()).toBeVisible();

        // Navigate back to group to verify all changes persisted
        await expenseDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
        await groupDetailPage.waitForBalanceUpdate();

        // Verify final state: updated description and amount
        await groupDetailPage.verifyExpenseInList(`Updated Test ${uniqueId}`, '$75.50');
    });
});

// Note: Real-time expense editing with multiple users is tested separately in realtime-expense-editing.e2e.test.ts
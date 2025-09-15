import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { ExpenseDetailPage } from '../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';

test.describe('Expense Editing Error Testing', () => {
    test('should edit expense amount (increase)', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking for edit operations
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues during editing' });

        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const memberCount = 1;

        // Create group and navigate to it
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('EditAmount'), 'Testing expense amount editing');
        const groupId = groupDetailPage.inferGroupId();

        // Navigate to expense form with proper waiting
        const formPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Fill expense form
        await formPage.fillDescription('Amount Edit Test');
        await formPage.fillAmount('50');
        await formPage.selectAllParticipants();
        await formPage.selectCategoryFromSuggestions('Food & Dining');

        // Save expense
        await formPage.clickSaveExpenseButton();
        await groupDetailPage.expectUrl(groupDetailUrlPattern(groupId));

        // Verify expense was created
        await groupDetailPage.verifyExpenseInList('Amount Edit Test', '$50.00');

        // Click on expense to view details
        const expenseDetailPage = new ExpenseDetailPage(page, user);
        await groupDetailPage.clickExpenseToView('Amount Edit Test');

        // Click edit button and get the expense form page for editing
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(memberCount);

        // Edit the amount
        await editFormPage.fillAmount('75.50');

        // Save changes
        const updateButton = editFormPage.getUpdateExpenseButton();
        await updateButton.click();

        // Wait for navigation to expense detail page
        await editFormPage.expectUrl(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);

        // Wait for the expense detail page to be ready with updated content
        await expenseDetailPage.waitForPageReady();

        // Verify the change was applied
        await expenseDetailPage.verifyExpenseHeading(/Amount Edit Test.*\$75\.50/);
    });

    test('should edit expense amount (decrease)', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking for edit operations
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues during editing' });

        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const expectedMemberCount = 1;

        // Create group and navigate to it
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('EditAmountDown'), 'Testing expense amount decrease');
        const groupId = groupDetailPage.inferGroupId();

        // Navigate to expense form with proper waiting
        const formPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);

        await formPage.fillDescription('High Amount Expense');
        await formPage.fillAmount('150');
        await formPage.selectAllParticipants();
        await formPage.selectCategoryFromSuggestions('Food & Dining');

        await formPage.clickSaveExpenseButton();
        await groupDetailPage.expectUrl(groupDetailUrlPattern(groupId));

        // Edit to decrease amount
        await groupDetailPage.verifyExpenseVisible('High Amount Expense');
        const expenseDetailPage = new ExpenseDetailPage(page, user);
        await groupDetailPage.clickExpenseToView('High Amount Expense');

        // Click edit button and get the expense form page for editing
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(expectedMemberCount);

        // Change amount from $150.00 to $25.75
        await editFormPage.fillAmount('25.75');

        const updateButton = editFormPage.getUpdateExpenseButton();
        await updateButton.click();

        await editFormPage.expectUrl(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);

        // Wait for the expense detail page to be ready with updated content
        await expenseDetailPage.waitForPageReady();

        // Verify amount was decreased
        await expenseDetailPage.verifyExpenseHeading(/High Amount Expense.*\$25\.75/);
    });

    test('should edit expense description successfully', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking for edit operations
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues during editing' });

        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const expectedMemberCount = 1;

        // Create group and navigate to it
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('EditDesc'), 'Testing expense description editing');
        const groupId = groupDetailPage.inferGroupId();

        // Navigate to expense form with proper waiting
        const formPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);

        await formPage.fillDescription('Original Description');
        await formPage.fillAmount('42.99');
        await formPage.selectAllParticipants();
        await formPage.selectCategoryFromSuggestions('Food & Dining');

        await formPage.clickSaveExpenseButton();
        await groupDetailPage.expectUrl(groupDetailUrlPattern(groupId));

        // Verify expense was created
        await groupDetailPage.verifyExpenseVisible('Original Description');

        // Edit the description
        const expenseDetailPage = new ExpenseDetailPage(page, user);
        await groupDetailPage.clickExpenseToView('Original Description');

        // Click edit button and get the expense form page for editing
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(expectedMemberCount);

        // Change description
        await editFormPage.fillDescription('Updated Description Text');

        const updateButton = editFormPage.getUpdateExpenseButton();
        await updateButton.click();

        await editFormPage.expectUrl(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);

        // Wait for the expense detail page to be ready with updated content
        await expenseDetailPage.waitForPageReady();

        // Verify description was updated
        await expenseDetailPage.verifyExpenseHeading(/Updated Description Text.*\$42\.99/);
    });
});

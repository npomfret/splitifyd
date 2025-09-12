import { simpleTest as test, expect } from '../../../fixtures/simple-test.fixture';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

test.describe('Advanced Splitting Options', () => {
    // Consolidated user journey test - creates group once and tests all split types in sequence

    test('should create expenses with all split types in comprehensive user journey', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();

        // Create a single group for the entire user journey
        const groupDetailPage = await dashboardPage.createGroupAndNavigate('Advanced Splitting Test Group', undefined);
        const groupId = groupDetailPage.inferGroupId();
        const expectedMemberCount = 1;

        // === EQUAL SPLIT EXPENSE ===
        let expenseFormPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);

        await expenseFormPage.fillDescription('Pizza for everyone');
        await expenseFormPage.fillAmount('60');

        // Equal split is default - verify it's selected
        await expect(expenseFormPage.getSplitSection()).toBeVisible();
        await expect(expenseFormPage.getEqualRadio()).toBeChecked();

        await expenseFormPage.clickSaveExpenseButton();
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage.getExpenseByDescription('Pizza for everyone')).toBeVisible();
        await expect(groupDetailPage.getExpenseAmount('$60.00')).toBeVisible();

        // === EXACT AMOUNTS SPLIT EXPENSE ===
        expenseFormPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);

        await expenseFormPage.fillDescription('Shared groceries with exact amounts');
        await expenseFormPage.fillAmount('75');

        // Change split type to exact amounts
        await expect(expenseFormPage.getSplitBetweenText()).toBeVisible();
        await expenseFormPage.switchToExactAmounts();
        await expect(expenseFormPage.getExactAmountsRadio()).toBeChecked();
        await expect(expenseFormPage.getExactAmountsInstructions()).toBeVisible();

        await expect(expenseFormPage.getExactAmountInput()).toBeVisible();
        await groupDetailPage.fillPreactInput(expenseFormPage.getExactAmountInput(), '75');

        await expenseFormPage.clickSaveExpenseButton();
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage.getExpenseByDescription('Shared groceries with exact amounts')).toBeVisible();

        // === PERCENTAGE SPLIT EXPENSE ===
        expenseFormPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);

        await expenseFormPage.fillDescription('Consulting project split by percentage');
        await expenseFormPage.fillAmount('1000');

        // Change split type to percentage
        await expect(expenseFormPage.getSplitBetweenText()).toBeVisible();
        await expenseFormPage.getPercentageText().click();
        await expect(expenseFormPage.getPercentageRadio()).toBeChecked();
        await expect(expenseFormPage.getPercentageInstructions()).toBeVisible();

        // In single user scenario, should default to 100%
        await expect(expenseFormPage.getPercentageInput()).toHaveValue('100');

        await expenseFormPage.clickSaveExpenseButton();
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage.getExpenseByDescription('Consulting project split by percentage')).toBeVisible();

        // === SPLIT TYPE CHANGES TEST ===
        // Test that split type UI updates work correctly during form interaction
        expenseFormPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        await expenseFormPage.fillDescription('Testing split type changes');
        await expenseFormPage.fillAmount('150');

        await expect(expenseFormPage.getSplitBetweenText()).toBeVisible();

        // Start with equal split (default)
        await expect(expenseFormPage.getEqualRadio()).toBeChecked();

        // Test transitions: Equal -> Exact -> Percentage -> Equal
        await expenseFormPage.switchToExactAmounts();
        await expect(expenseFormPage.getExactAmountsRadio()).toBeChecked();
        await expect(expenseFormPage.getExactAmountsInstructions()).toBeVisible();

        await expenseFormPage.getPercentageText().click();
        await expect(expenseFormPage.getPercentageRadio()).toBeChecked();
        await expect(expenseFormPage.getPercentageInstructions()).toBeVisible();

        await expenseFormPage.getEqualText().click();
        await expect(expenseFormPage.getEqualRadio()).toBeChecked();

        // Submit final expense to complete the user journey
        await expenseFormPage.clickSaveExpenseButton();
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage.getExpenseByDescription('Testing split type changes')).toBeVisible();
    });
});

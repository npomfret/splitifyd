import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from "../../helpers";
import { GroupWorkflow } from '../../workflows';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Advanced Splitting Options', () => {
  // Consolidated user journey test - creates group once and tests all split types in sequence

  test('should create expenses with all split types in comprehensive user journey', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    
    // Create a single group for the entire user journey using helper method
    const groupId = await groupDetailPage.createGroupAndPrepareForExpenses('Advanced Splitting Test Group');
    const expectedMemberCount = 1;

    // === EQUAL SPLIT EXPENSE ===
    let expenseFormPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);
    
    await expenseFormPage.fillDescription('Pizza for everyone');
    await expenseFormPage.fillAmount('60');
    
    // Equal split is default - verify it's selected
    await expect(groupDetailPage.getSplitSection()).toBeVisible();
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    await expenseFormPage.saveExpense();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Pizza for everyone')).toBeVisible();
    await expect(groupDetailPage.getExpenseAmount('$60.00')).toBeVisible();

    
    // === EXACT AMOUNTS SPLIT EXPENSE ===
    expenseFormPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);
    
    await expenseFormPage.fillDescription('Shared groceries with exact amounts');
    await expenseFormPage.fillAmount('75');
    
    // Change split type to exact amounts
    await expect(groupDetailPage.getSplitBetweenText()).toBeVisible();
    await expenseFormPage.switchToExactAmounts();
    await expect(groupDetailPage.getExactAmountsRadio()).toBeChecked();
    await expect(groupDetailPage.getExactAmountsInstructions()).toBeVisible();
    
    await expect(groupDetailPage.getExactAmountInput()).toBeVisible();
    await groupDetailPage.fillPreactInput(groupDetailPage.getExactAmountInput(), '75');
    
    await expenseFormPage.saveExpense();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Shared groceries with exact amounts')).toBeVisible();

    
    // === PERCENTAGE SPLIT EXPENSE ===
    expenseFormPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);
    
    await expenseFormPage.fillDescription('Consulting project split by percentage');
    await expenseFormPage.fillAmount('1000');
    
    // Change split type to percentage
    await expect(groupDetailPage.getSplitBetweenText()).toBeVisible();
    await groupDetailPage.getPercentageText().click();
    await expect(groupDetailPage.getPercentageRadio()).toBeChecked();
    await expect(groupDetailPage.getPercentageInstructions()).toBeVisible();
    
    // In single user scenario, should default to 100%
    await expect(groupDetailPage.getPercentageInput()).toHaveValue('100');
    
    await expenseFormPage.saveExpense();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Consulting project split by percentage')).toBeVisible();
    
    // === SPLIT TYPE CHANGES TEST ===
    // Test that split type UI updates work correctly during form interaction
    expenseFormPage = await groupDetailPage.clickAddExpenseButton(expectedMemberCount);
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    await expenseFormPage.fillDescription('Testing split type changes');
    await expenseFormPage.fillAmount('150');
    
    await expect(groupDetailPage.getSplitBetweenText()).toBeVisible();
    
    // Start with equal split (default)
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    // Test transitions: Equal -> Exact -> Percentage -> Equal
    await expenseFormPage.switchToExactAmounts();
    await expect(groupDetailPage.getExactAmountsRadio()).toBeChecked();
    await expect(groupDetailPage.getExactAmountsInstructions()).toBeVisible();
    
    await groupDetailPage.getPercentageText().click();
    await expect(groupDetailPage.getPercentageRadio()).toBeChecked();
    await expect(groupDetailPage.getPercentageInstructions()).toBeVisible();
    
    await groupDetailPage.getEqualText().click();
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    // Submit final expense to complete the user journey
    await expenseFormPage.saveExpense();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Testing split type changes')).toBeVisible();
  });
});
import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { GroupWorkflow } from '../../workflows/index';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Advanced Splitting Options', () => {
  // Consolidated user journey test - creates group once and tests all split types in sequence

  test('should create expenses with all split types in comprehensive user journey', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create a single group for the entire user journey
    const groupId = await groupWorkflow.createGroup('Advanced Splitting Test Group');
    await page.goto(`/groups/${groupId}`);
    await expect(page).toHaveURL(`/groups/${groupId}`);
    
    // === EQUAL SPLIT EXPENSE ===
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    await groupDetailPage.getExpenseDescriptionField().fill('Pizza for everyone');
    await groupDetailPage.getExpenseAmountField().fill('60');
    
    // Equal split is default - verify it's selected
    await expect(groupDetailPage.getSplitSection()).toBeVisible();
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    await groupDetailPage.getSaveExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Pizza for everyone')).toBeVisible();
    await expect(groupDetailPage.getExpenseAmount('$60.00')).toBeVisible();

    
    // === EXACT AMOUNTS SPLIT EXPENSE ===
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    await groupDetailPage.getExpenseDescriptionField().fill('Shared groceries with exact amounts');
    await groupDetailPage.getExpenseAmountField().fill('75.50');
    
    // Change split type to exact amounts
    await expect(page.getByText('Split between')).toBeVisible();
    await groupDetailPage.getExactAmountsText().click();
    await expect(groupDetailPage.getExactAmountsRadio()).toBeChecked();
    await expect(groupDetailPage.getExactAmountsInstructions()).toBeVisible();
    
    await expect(groupDetailPage.getExactAmountInput()).toBeVisible();
    await groupDetailPage.getExactAmountInput().fill('75.50');
    
    await groupDetailPage.getSaveExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Shared groceries with exact amounts')).toBeVisible();

    
    // === PERCENTAGE SPLIT EXPENSE ===
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    await groupDetailPage.getExpenseDescriptionField().fill('Consulting project split by percentage');
    await groupDetailPage.getExpenseAmountField().fill('1000');
    
    // Change split type to percentage
    await expect(page.getByText('Split between')).toBeVisible();
    await groupDetailPage.getPercentageText().click();
    await expect(groupDetailPage.getPercentageRadio()).toBeChecked();
    await expect(groupDetailPage.getPercentageInstructions()).toBeVisible();
    
    // In single user scenario, should default to 100%
    await expect(groupDetailPage.getPercentageInput()).toHaveValue('100');
    
    await groupDetailPage.getSaveExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Consulting project split by percentage')).toBeVisible();
    
    // === SPLIT TYPE CHANGES TEST ===
    // Test that split type UI updates work correctly during form interaction
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    await groupDetailPage.getExpenseDescriptionField().fill('Testing split type changes');
    await groupDetailPage.getExpenseAmountField().fill('150');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Start with equal split (default)
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    // Test transitions: Equal -> Exact -> Percentage -> Equal
    await groupDetailPage.getExactAmountsText().click();
    await expect(groupDetailPage.getExactAmountsRadio()).toBeChecked();
    await expect(groupDetailPage.getExactAmountsInstructions()).toBeVisible();
    
    await groupDetailPage.getPercentageText().click();
    await expect(groupDetailPage.getPercentageRadio()).toBeChecked();
    await expect(groupDetailPage.getPercentageInstructions()).toBeVisible();
    
    await groupDetailPage.getEqualText().click();
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    // Submit final expense to complete the user journey
    await groupDetailPage.getSaveExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Testing split type changes')).toBeVisible();
  });
});
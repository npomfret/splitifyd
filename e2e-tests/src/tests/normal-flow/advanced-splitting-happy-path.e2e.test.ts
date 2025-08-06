import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { GroupWorkflow } from '../../workflows/index';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Advanced Splitting Options', () => {
  // Simply let each test create its own group - this is safer for parallel execution
  // The authenticatedPageTest fixture already handles user authentication
  
  test.beforeEach(async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    const groupId = await groupWorkflow.createGroup('Advanced Splitting Test Group');
    
    // Navigate to the created group
    await page.goto(`/groups/${groupId}`);
    await expect(page).toHaveURL(`/groups/${groupId}`);
  });

  test('should create expense with equal split', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Click add expense button
    await groupDetailPage.getAddExpenseButton().click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    // Fill expense form
    await groupDetailPage.getExpenseDescriptionField().fill('Pizza for everyone');
    await groupDetailPage.getExpenseAmountField().fill('60');
    
    // IMPORTANT: Select participants - the payer is auto-selected but we need at least one participant
    // Since this is a single user test, the current user is the only participant
    // The payer checkbox should already be checked and disabled
    await expect(groupDetailPage.getSplitSection()).toBeVisible();
    
    // Equal split is default - verify it's selected
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    // Submit expense
    await groupDetailPage.getSaveExpenseButton().click();
    
    // Verify navigation back to group page and expense creation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Pizza for everyone')).toBeVisible();
    await expect(groupDetailPage.getExpenseAmount('$60.00')).toBeVisible();
  });

  test('should create expense with exact amounts split', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await groupDetailPage.getAddExpenseButton().click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    // Fill basic details
    await groupDetailPage.getExpenseDescriptionField().fill('Shared groceries with exact amounts');
    await groupDetailPage.getExpenseAmountField().fill('75.50');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Change split type to exact
    await groupDetailPage.getExactAmountsText().click();
    await expect(groupDetailPage.getExactAmountsRadio()).toBeChecked();
    
    // Verify exact amount input appears
    await expect(groupDetailPage.getExactAmountsInstructions()).toBeVisible();
    
    // The exact amount input for the current user should be visible
    await expect(groupDetailPage.getExactAmountInput()).toBeVisible();
    await groupDetailPage.getExactAmountInput().fill('75.50');
    
    // Submit expense
    await groupDetailPage.getSaveExpenseButton().click();
    
    // Verify navigation back to group
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Shared groceries with exact amounts')).toBeVisible();
  });

  test('should create expense with percentage split', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await groupDetailPage.getAddExpenseButton().click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    // Fill basic details
    await groupDetailPage.getExpenseDescriptionField().fill('Consulting project split by percentage');
    await groupDetailPage.getExpenseAmountField().fill('1000');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Change split type to percentage
    await groupDetailPage.getPercentageText().click();
    await expect(groupDetailPage.getPercentageRadio()).toBeChecked();
    
    // Verify percentage input appears
    await expect(groupDetailPage.getPercentageInstructions()).toBeVisible();
    
    // In single user scenario, should default to 100%
    await expect(groupDetailPage.getPercentageInput()).toHaveValue('100');
    
    // Submit expense
    await groupDetailPage.getSaveExpenseButton().click();
    
    // Verify navigation and expense creation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getExpenseByDescription('Consulting project split by percentage')).toBeVisible();
  });



  test('should handle split type changes correctly', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await groupDetailPage.getAddExpenseButton().click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    // Fill basic details
    await groupDetailPage.getExpenseDescriptionField().fill('Testing split type changes');
    await groupDetailPage.getExpenseAmountField().fill('150');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Start with equal split (default)
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    // Change to exact amount
    await groupDetailPage.getExactAmountsText().click();
    await expect(groupDetailPage.getExactAmountsRadio()).toBeChecked();
    
    // Verify UI updates for exact amount
    await expect(groupDetailPage.getExactAmountsInstructions()).toBeVisible();
    
    // Change to percentage
    await groupDetailPage.getPercentageText().click();
    await expect(groupDetailPage.getPercentageRadio()).toBeChecked();
    
    // Verify UI updates for percentage
    await expect(groupDetailPage.getPercentageInstructions()).toBeVisible();
    
    // Change back to equal
    await groupDetailPage.getEqualText().click();
    await expect(groupDetailPage.getEqualRadio()).toBeChecked();
    
    // Submit should work after changes (payer is auto-selected)
    await groupDetailPage.getSaveExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
  });
});
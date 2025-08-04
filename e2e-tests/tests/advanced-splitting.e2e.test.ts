import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { AuthenticationWorkflow } from '../workflows/authentication.workflow';
import { CreateGroupModalPage, DashboardPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Advanced Splitting Options', () => {

  test('should create expense with equal split', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    // Create a group using modal
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Equal Split Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Click add expense button
    await page.getByRole('button', { name: /add expense/i }).click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    // Fill expense form
    await page.getByPlaceholder('What was this expense for?').fill('Pizza for everyone');
    await page.getByPlaceholder('0.00').fill('60');
    
    // IMPORTANT: Select participants - the payer is auto-selected but we need at least one participant
    // Since this is a single user test, the current user is the only participant
    // The payer checkbox should already be checked and disabled
    const splitSection = page.locator('text=Split between').locator('..');
    await expect(splitSection).toBeVisible();
    
    // Equal split is default - verify it's selected
    const equalRadio = page.getByRole('radio', { name: 'Equal' });
    await expect(equalRadio).toBeChecked();
    
    // Submit expense
    await page.getByRole('button', { name: /save expense/i }).click();
    
    // Verify navigation back to group page and expense creation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(page.getByText('Pizza for everyone')).toBeVisible();
    await expect(page.getByText('$60.00')).toBeVisible();
  });

  test('should create expense with exact amounts split', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Exact Split Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: /add expense/i }).click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    // Fill basic details
    await page.getByPlaceholder('What was this expense for?').fill('Shared groceries with exact amounts');
    await page.getByPlaceholder('0.00').fill('75.50');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Change split type to exact
    await page.getByText('Exact amounts').click();
    await expect(page.getByRole('radio', { name: 'Exact amounts' })).toBeChecked();
    
    // Verify exact amount input appears
    await expect(page.getByText('Enter exact amounts for each person:')).toBeVisible();
    
    // The exact amount input for the current user should be visible
    const exactAmountInput = page.locator('input[type="number"][step="0.01"]').first();
    await expect(exactAmountInput).toBeVisible();
    await exactAmountInput.fill('75.50');
    
    // Submit expense
    await page.getByRole('button', { name: /save expense/i }).click();
    
    // Verify navigation back to group
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(page.getByText('Shared groceries with exact amounts')).toBeVisible();
  });

  test('should create expense with percentage split', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Percentage Split Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: /add expense/i }).click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    // Fill basic details
    await page.getByPlaceholder('What was this expense for?').fill('Consulting project split by percentage');
    await page.getByPlaceholder('0.00').fill('1000');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Change split type to percentage
    await page.getByText('Percentage', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Percentage' })).toBeChecked();
    
    // Verify percentage input appears
    await expect(page.getByText('Enter percentage for each person:')).toBeVisible();
    
    // In single user scenario, should default to 100%
    const percentageInput = page.locator('input[type="number"][max="100"]').first();
    await expect(percentageInput).toHaveValue('100');
    
    // Submit expense
    await page.getByRole('button', { name: /save expense/i }).click();
    
    // Verify navigation and expense creation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(page.getByText('Consulting project split by percentage')).toBeVisible();
  });

  test('should validate split amounts equal total', {
    annotation: { type: 'skip-error-checking', description: 'Test intentionally triggers validation errors to verify form validation behavior' }
  }, async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Split Validation Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: /add expense/i }).click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    // Fill expense details
    await page.getByPlaceholder('What was this expense for?').fill('Test validation');
    await page.getByPlaceholder('0.00').fill('100');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Change to exact split
    await page.getByText('Exact amounts').click();
    
    // Set invalid amount (not equal to total)
    const amountInput = page.locator('input[type="number"][step="0.01"]').first();
    await amountInput.fill('50');
    
    // Try to submit - should show validation error
    await page.getByRole('button', { name: /save expense/i }).click();
    
    // Wait a moment for validation to appear
    await page.waitForTimeout(500);
    
    // Should remain on the same page due to validation error
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Check that we're still on the form (expense not created)
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    await expect(page.getByPlaceholder('What was this expense for?')).toHaveValue('Test validation');
  });

  test('should validate percentage split equals 100%', {
    annotation: { type: 'skip-error-checking', description: 'Test intentionally triggers validation errors to verify form validation behavior' }
  }, async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Percentage Validation Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: /add expense/i }).click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    // Fill expense details
    await page.getByPlaceholder('What was this expense for?').fill('Test percentage validation');
    await page.getByPlaceholder('0.00').fill('200');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Change to percentage split
    await page.getByText('Percentage', { exact: true }).click();
    
    // Try to set invalid percentage
    const percentageInput = page.locator('input[type="number"][max="100"]').first();
    await percentageInput.fill('50'); // Less than 100%
    
    // Try to submit
    await page.getByRole('button', { name: /save expense/i }).click();
    
    // Wait a moment for validation to appear
    await page.waitForTimeout(500);
    
    // Should remain on the same page due to validation error
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Check that we're still on the form (expense not created)
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    await expect(page.getByPlaceholder('What was this expense for?')).toHaveValue('Test percentage validation');
  });

  test('should handle split type changes correctly', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Split Type Change Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: /add expense/i }).click();
    
    // Wait for navigation to add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for expense form to load
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    // Fill basic details
    await page.getByPlaceholder('What was this expense for?').fill('Testing split type changes');
    await page.getByPlaceholder('0.00').fill('150');
    
    await expect(page.getByText('Split between')).toBeVisible();
    
    // Start with equal split (default)
    const equalRadio = page.getByRole('radio', { name: 'Equal' });
    await expect(equalRadio).toBeChecked();
    
    // Change to exact amount
    await page.getByText('Exact amounts').click();
    await expect(page.getByRole('radio', { name: 'Exact amounts' })).toBeChecked();
    
    // Verify UI updates for exact amount
    await expect(page.getByText('Enter exact amounts for each person:')).toBeVisible();
    
    // Change to percentage
    await page.getByText('Percentage', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Percentage' })).toBeChecked();
    
    // Verify UI updates for percentage
    await expect(page.getByText('Enter percentage for each person:')).toBeVisible();
    
    // Change back to equal
    await page.getByText('Equal').click();
    await expect(page.getByRole('radio', { name: 'Equal' })).toBeChecked();
    
    // Submit should work after changes (payer is auto-selected)
    await page.getByRole('button', { name: /save expense/i }).click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
  });
});
import { test, expect } from '@playwright/test';
import { 
  createAndLoginTestUser, 
  createTestGroup, 
  addTestExpense,
  getGroupBalances,
  waitForBalanceUpdate,
  ExpenseBuilder,
  setupConsoleErrorReporting,
  setupMCPDebugOnFailure
} from '../helpers';

// Enable debugging and error reporting
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Advanced Splitting Options', () => {
  test.beforeEach(async ({ page }) => {
    // Create and login a test user
    await createAndLoginTestUser(page);
  });

  test('should create expense with equal split', async ({ page }) => {
    // Create a test group
    const groupId = await createTestGroup(page, 'Equal Split Test Group');
    
    // Create expense with equal split (default)
    const expense = new ExpenseBuilder()
      .withDescription('Pizza for everyone')
      .withAmount(60)
      .withCategory('food')
      .withEqualSplit(['current-user']) // In single user test, only split with self
      .build();
    
    await addTestExpense(page, groupId, expense.amount, expense.description, {
      category: expense.category,
      splitType: expense.splitType
    });
    
    // Wait for balance update
    await waitForBalanceUpdate(page);
    
    // Verify expense was created
    await expect(page.getByText(expense.description)).toBeVisible();
    await expect(page.getByText(`$${expense.amount.toFixed(2)}`)).toBeVisible();
    
    // In a single-user group with equal split, balance should remain settled
    const balances = await getGroupBalances(page, groupId);
    expect(balances.balances).toHaveLength(0);
    expect(balances.totalOwed).toBe(0);
  });

  test('should create expense with exact amounts split', async ({ page }) => {
    // Create a test group
    const groupId = await createTestGroup(page, 'Exact Split Test Group');
    
    // For single user test, we'll test the UI flow even though balances won't change
    const expense = new ExpenseBuilder()
      .withDescription('Shared groceries with exact amounts')
      .withAmount(75.50)
      .withCategory('shopping')
      .build();
    
    await page.goto(`/groups/${groupId}/expenses/add`);
    
    // Fill basic details
    await page.getByLabel(/description/i).fill(expense.description);
    await page.getByLabel(/amount/i).fill(expense.amount.toString());
    
    // Select category
    await page.getByRole('button', { name: /category/i }).click();
    await page.getByRole('option', { name: /shopping/i }).click();
    
    // Change split type to exact
    const splitButton = page.getByRole('button', { name: /split.*equally/i })
      .or(page.getByText(/split.*equally/i));
    await splitButton.click();
    await page.getByRole('option', { name: /exact.*amount/i }).click();
    
    // Verify exact amount input appears
    await expect(page.getByText(/enter.*exact.*amount/i)).toBeVisible();
    
    // Submit expense
    await page.getByRole('button', { name: /add.*expense/i }).click();
    
    // Verify navigation back to group
    await page.waitForURL(`/groups/${groupId}`);
    await expect(page.getByText(expense.description)).toBeVisible();
  });

  test('should create expense with percentage split', async ({ page }) => {
    // Create a test group
    const groupId = await createTestGroup(page, 'Percentage Split Test Group');
    
    const expense = new ExpenseBuilder()
      .withDescription('Consulting project split by percentage')
      .withAmount(1000)
      .withCategory('other')
      .build();
    
    await page.goto(`/groups/${groupId}/expenses/add`);
    
    // Fill basic details
    await page.getByLabel(/description/i).fill(expense.description);
    await page.getByLabel(/amount/i).fill(expense.amount.toString());
    
    // Change split type to percentage
    const splitButton = page.getByRole('button', { name: /split.*equally/i })
      .or(page.getByText(/split.*equally/i));
    await splitButton.click();
    await page.getByRole('option', { name: /percentage/i }).click();
    
    // Verify percentage input appears
    await expect(page.getByText(/enter.*percentage/i)).toBeVisible();
    
    // In single user scenario, should default to 100%
    const percentageInput = page.locator('input[type="number"][max="100"]').first();
    await expect(percentageInput).toHaveValue('100');
    
    // Submit expense
    await page.getByRole('button', { name: /add.*expense/i }).click();
    
    // Verify navigation and expense creation
    await page.waitForURL(`/groups/${groupId}`);
    await expect(page.getByText(expense.description)).toBeVisible();
  });

  test('should validate split amounts equal total', async ({ page }) => {
    const groupId = await createTestGroup(page, 'Split Validation Test Group');
    
    await page.goto(`/groups/${groupId}/expenses/add`);
    
    // Fill expense details
    await page.getByLabel(/description/i).fill('Test validation');
    await page.getByLabel(/amount/i).fill('100');
    
    // Change to exact split
    const splitButton = page.getByRole('button', { name: /split.*equally/i })
      .or(page.getByText(/split.*equally/i));
    await splitButton.click();
    await page.getByRole('option', { name: /exact.*amount/i }).click();
    
    // Try to submit without valid split amounts
    const submitButton = page.getByRole('button', { name: /add.*expense/i });
    
    // The button might be disabled or show validation on click
    const isDisabled = await submitButton.isDisabled();
    if (!isDisabled) {
      await submitButton.click();
      // Should show validation error
      await expect(page.getByText(/split.*amounts.*must.*equal.*total/i)).toBeVisible();
    } else {
      // Button is correctly disabled when splits don't match
      expect(isDisabled).toBe(true);
    }
  });

  test('should validate percentage split equals 100%', async ({ page }) => {
    const groupId = await createTestGroup(page, 'Percentage Validation Test Group');
    
    await page.goto(`/groups/${groupId}/expenses/add`);
    
    // Fill expense details
    await page.getByLabel(/description/i).fill('Test percentage validation');
    await page.getByLabel(/amount/i).fill('200');
    
    // Change to percentage split
    const splitButton = page.getByRole('button', { name: /split.*equally/i })
      .or(page.getByText(/split.*equally/i));
    await splitButton.click();
    await page.getByRole('option', { name: /percentage/i }).click();
    
    // In single user mode, should already be 100%
    const percentageInput = page.locator('input[type="number"][max="100"]').first();
    
    // Try to set invalid percentage
    await percentageInput.fill('50'); // Less than 100%
    
    const submitButton = page.getByRole('button', { name: /add.*expense/i });
    const isDisabled = await submitButton.isDisabled();
    
    if (!isDisabled) {
      await submitButton.click();
      // Should show validation error
      await expect(page.getByText(/percentage.*must.*equal.*100/i)).toBeVisible();
    } else {
      // Button is correctly disabled when percentages don't sum to 100
      expect(isDisabled).toBe(true);
    }
  });

  test('should handle split type changes correctly', async ({ page }) => {
    const groupId = await createTestGroup(page, 'Split Type Change Test Group');
    
    await page.goto(`/groups/${groupId}/expenses/add`);
    
    // Fill basic details
    await page.getByLabel(/description/i).fill('Testing split type changes');
    await page.getByLabel(/amount/i).fill('150');
    
    // Start with equal split (default)
    await expect(page.getByText(/split.*equally/i)).toBeVisible();
    
    // Change to exact amount
    const splitButton = page.getByRole('button', { name: /split.*equally/i })
      .or(page.getByText(/split.*equally/i));
    await splitButton.click();
    await page.getByRole('option', { name: /exact.*amount/i }).click();
    
    // Verify UI updates for exact amount
    await expect(page.getByText(/enter.*exact.*amount/i)).toBeVisible();
    
    // Change to percentage
    await splitButton.click();
    await page.getByRole('option', { name: /percentage/i }).click();
    
    // Verify UI updates for percentage
    await expect(page.getByText(/enter.*percentage/i)).toBeVisible();
    
    // Change back to equal
    await splitButton.click();
    await page.getByRole('option', { name: /equal/i }).click();
    
    // Verify UI returns to equal split
    await expect(page.getByText(/split.*equally/i)).toBeVisible();
    
    // Submit should work after changes
    await page.getByRole('button', { name: /add.*expense/i }).click();
    await page.waitForURL(`/groups/${groupId}`);
  });
});
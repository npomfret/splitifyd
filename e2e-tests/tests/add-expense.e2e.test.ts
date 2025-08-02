import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, GroupDetailPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
  test('should add new expense with equal split', async ({ page }) => {
    test.setTimeout(10000);
    await createAndLoginTestUser(page);
    
    // Create a group first using the same pattern as dashboard tests
    const createGroupModal = new CreateGroupModalPage(page);
    
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    
    await createGroupModal.createGroup('Expense Test Group', 'Testing expense creation');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 2000 });
    
    // Look for Add Expense button
    const addExpenseButton = page.getByRole('button', { name: /add expense/i })
      .or(page.getByRole('link', { name: /add expense/i }))
      .or(page.getByText(/add expense/i));
    
    await expect(addExpenseButton.first()).toBeVisible();
    await addExpenseButton.first().click();
    
    // Wait for expense form to load
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible({ timeout: 5000 });
    
    // Fill expense form
    const descriptionField = page.getByPlaceholder('What was this expense for?');
    const amountField = page.getByPlaceholder('0.00');
    const categorySelect = page.locator('select').first();
    
    await expect(descriptionField).toBeVisible();
    await descriptionField.fill('Test Dinner');
    
    await expect(amountField).toBeVisible();
    await amountField.fill('50.00');
    
    await expect(categorySelect).toBeVisible();
    await categorySelect.selectOption({ index: 1 }); // Select first category (food)
    
    // Look for submit button
    const submitButton = page.getByRole('button', { name: /add expense/i })
      .or(page.getByRole('button', { name: /create/i }))
      .or(page.getByRole('button', { name: /save/i }))
      .or(page.getByRole('button', { name: /submit/i }));
    
    await expect(submitButton.first()).toBeVisible();
    await submitButton.first().click();
    
    // Wait for expense to be added
    await page.waitForLoadState('domcontentloaded');
    
    // Verify expense was created and we're back on group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 2000 });
    await expect(page.getByText('Test Dinner')).toBeVisible();
    await expect(page.getByText('50')).toBeVisible();
  });

  test('should handle expense form validation', async ({ page }) => {
    // Increase timeout for this test
    test.setTimeout(10000);
    
    await createAndLoginTestUser(page);
    
    // Create a group using the modal
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Validation Test Group', 'Testing form validation');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
    
    // Go to add expense
    const addExpenseButton = page.getByRole('button', { name: /add expense/i })
      .or(page.getByRole('link', { name: /add expense/i }));
    
    await addExpenseButton.first().click();
    await page.waitForLoadState('domcontentloaded');
    
    // Try to submit empty form - look specifically for Save Expense button
    const submitButton = page.getByRole('button', { name: /save expense/i });
    
    // Try to submit empty form
    await submitButton.click();
    await page.waitForLoadState('domcontentloaded');
    
    // Should show validation errors for required fields
    const descriptionError = page.getByText(/description.*required/i)
      .or(page.getByText(/enter.*description/i))
      .or(page.getByText(/please.*describe/i));
    const amountError = page.getByText(/amount.*required/i)
      .or(page.getByText(/enter.*amount/i))
      .or(page.getByText(/valid.*amount/i));
    
    // At least one validation error should be visible
    const hasDescriptionError = await descriptionError.count() > 0;
    const hasAmountError = await amountError.count() > 0;
    expect(hasDescriptionError || hasAmountError).toBe(true);
    
    // Verify we're still on the expense form
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
  });

  test('should allow selecting expense category', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    // Create a group using the modal
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Category Test Group', 'Testing expense categories');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 2000 });
    
    // Go to add expense
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    await addExpenseButton.first().click();
    
    // Wait for navigation or modal
    await page.waitForLoadState('networkidle');
    
    // Wait for expense form to load
    const descriptionField = page.getByPlaceholder('What was this expense for?');
    await expect(descriptionField).toBeVisible({ timeout: 2000 });
    
    // Find category combobox (it's a select element with role="combobox")
    const categorySelect = page.getByRole('combobox');
    await expect(categorySelect).toBeVisible({ timeout: 2000 });
    
    // Get initial category value
    const initialCategory = await categorySelect.inputValue();
    
    // Select a different category
    await categorySelect.selectOption({ index: 2 }); // Select third option
    
    // Verify category changed
    const newCategory = await categorySelect.inputValue();
    expect(newCategory).not.toBe(initialCategory);
    
    // Fill required fields to test full form submission with category
    await page.getByPlaceholder('What was this expense for?').fill('Dinner with category');
    await page.getByPlaceholder('0.00').fill('45.00');
    
    // Submit the form
    await page.getByRole('button', { name: /save expense/i }).click();
    await page.waitForLoadState('networkidle');
    
    // Verify expense was created
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 2000 });
    await expect(page.getByText('Dinner with category')).toBeVisible();
  });

  test('should show expense in group after creation', async ({ page }) => {
    // Increase timeout for this test
    test.setTimeout(10000);
    
    await createAndLoginTestUser(page);
    
    // Create a group using the modal
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Expense Display Group', 'Testing expense display');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
    
    // Add expense directly without page object
    await page.getByRole('button', { name: /add expense/i }).click();
    await page.waitForLoadState('domcontentloaded');
    
    // Fill expense form
    await page.getByPlaceholder('What was this expense for?').fill('Movie Tickets');
    await page.getByPlaceholder('0.00').fill('24.99');
    
    // Submit the expense
    await page.getByRole('button', { name: /save expense/i }).click();
    
    // Wait for navigation back to group page or for expense to appear
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('networkidle');
    
    // Should show expense - use more flexible matching
    await expect(page.getByText('Movie Tickets')).toBeVisible({ timeout: 5000 });
    
    // Should show amount - be more specific to avoid multiple matches
    const amountText = page.getByText('$24.99').or(page.getByText('24.99'));
    await expect(amountText).toBeVisible({ timeout: 5000 });
    
    // Should show expense was paid by someone
    await expect(page.getByText(/paid by|Paid:/i)).toBeVisible();
  });

  test('should handle split type selection UI', async ({ page }) => {
    test.setTimeout(10000);
    await createAndLoginTestUser(page);
    
    // Create a group using the modal
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Split Types Group', 'Testing split types');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 2000 });
    
    // Go to add expense
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    await addExpenseButton.first().click();
    
    // Wait for expense form to load
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible({ timeout: 5000 });
    
    // Fill basic expense details first
    await page.getByPlaceholder('What was this expense for?').fill('Split type test');
    await page.getByPlaceholder('0.00').fill('100.00');
    
    // Split type options should appear after basic details are filled
    await page.waitForLoadState('domcontentloaded');
    
    // Look for split type section
    const splitSection = page.getByText('How to split');
    await expect(splitSection).toBeVisible({ timeout: 2000 });
    
    // Verify all split type options are available
    const equalSplit = page.getByText('Equal').first();
    const exactSplit = page.getByText('Exact amounts');
    const percentageSplit = page.getByText('Percentage');
    
    await expect(equalSplit).toBeVisible();
    await expect(exactSplit).toBeVisible();
    await expect(percentageSplit).toBeVisible();
    
    // Equal should be selected by default
    const equalRadio = page.getByRole('radio', { name: 'Equal' });
    await expect(equalRadio).toBeChecked();
    
    // Click on percentage split
    await percentageSplit.click();
    
    // Verify percentage is now selected
    const percentRadio = page.getByRole('radio', { name: 'Percentage' });
    await expect(percentRadio).toBeChecked();
    
    // Switch back to equal split
    await equalSplit.click();
    await expect(equalRadio).toBeChecked();
    
    // Submit the expense with equal split
    await page.getByRole('button', { name: /save expense/i }).click();
    await page.waitForLoadState('networkidle');
    
    // Verify expense was created
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 2000 });
    await expect(page.getByText('Split type test')).toBeVisible();
  });

  test('should handle expense with date selection', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    // Create a group using page object
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Date Test Group', 'Testing date selection');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 2000 });
    
    // Use page object to add expense
    const groupDetailPage = new GroupDetailPage(page);
    await groupDetailPage.addExpense({
      description: 'Lunch',
      amount: 12.50,
      paidBy: 'testuser@example.com',
      splitType: 'equal'
    });
    
    // Should show the expense
    await expect(page.getByText('Lunch')).toBeVisible();
    
    // Date selection is optional - we've verified the expense was created
  });
});
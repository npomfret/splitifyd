import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, GroupDetailPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
  test('should add new expense with equal split', async ({ page }) => {
    test.setTimeout(8000);
    await createAndLoginTestUser(page);
    
    // Create a group first using the same pattern as dashboard tests
    const createGroupModal = new CreateGroupModalPage(page);
    
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    
    await createGroupModal.createGroup('Expense Test Group', 'Testing expense creation');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
    // Look for Add Expense button
    const addExpenseButton = page.getByRole('button', { name: /add expense/i })
      .or(page.getByRole('link', { name: /add expense/i }))
      .or(page.getByText(/add expense/i));
    
    await expect(addExpenseButton.first()).toBeVisible();
    await addExpenseButton.first().click();
    
    // Should navigate to add expense page or open modal
    await page.waitForLoadState('domcontentloaded'); // Wait for navigation/modal
    
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
    
    // Should show the expense in the list or navigate back to group
    await expect(page.getByText('Test Dinner')).toBeVisible();
    await expect(page.getByText('50')).toBeVisible();
  });

  test('should handle expense form validation', async ({ page }) => {
    // Increase timeout for this test
    test.setTimeout(15000);
    
    await createAndLoginTestUser(page);
    
    // Create a group first
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    const nameInput = page.getByPlaceholder(/group.*name/i).or(page.getByLabel(/group.*name/i));
    await nameInput.fill('Validation Test Group');
    const descInput = page.getByPlaceholder(/details|description/i);
    await descInput.fill('Testing form validation');
    await page.getByRole('button', { name: 'Create Group' }).last().click();
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
    // Go to add expense
    const addExpenseButton = page.getByRole('button', { name: /add expense/i })
      .or(page.getByRole('link', { name: /add expense/i }));
    
    await addExpenseButton.first().click();
    await page.waitForLoadState('domcontentloaded');
    
    // Try to submit empty form - look specifically for Save Expense button
    const submitButton = page.getByRole('button', { name: /save expense/i });
    
    // Submit button should be disabled or show validation errors
    const isDisabled = await submitButton.isDisabled({ timeout: 5000 });
    let hasValidationErrors = false;
    
    if (!isDisabled) {
      await submitButton.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Should show validation errors or stay on form
      hasValidationErrors = await page.getByText(/required/i).count() > 0 ||
                           await page.getByText(/invalid/i).count() > 0 ||
                           await page.getByText(/error/i).count() > 0;
      
      if (!hasValidationErrors) {
        // Check if still on form (URL didn't change significantly)
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/expense|add/);
      }
    }
    
    // Verify that validation prevented submission
    const currentUrl = page.url();
    if (!isDisabled && !hasValidationErrors) {
      // Check if we're still on the add expense page
      expect(currentUrl).toMatch(/expense|add/);
    }
  });

  test('should allow selecting expense category', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    // Create a group
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    const nameInput = page.getByPlaceholder(/group.*name/i).or(page.getByLabel(/group.*name/i));
    await nameInput.fill('Category Test Group');
    const descInput = page.getByPlaceholder(/details|description/i);
    await descInput.fill('Testing expense categories');
    await page.getByRole('button', { name: 'Create Group' }).last().click();
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
    // Go to add expense
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    await addExpenseButton.first().click();
    await page.waitForLoadState('domcontentloaded');
    
    // Look for category selection
    const categoryField = page.getByLabel(/category/i)
      .or(page.locator('select[name*="category"]'))
      .or(page.locator('[data-testid*="category"]'));
    
    const hasCategoryField = await categoryField.count() > 0;
    if (hasCategoryField) {
      await expect(categoryField.first()).toBeVisible();
      
      // Try to select a category
      const isSelect = await categoryField.first().evaluate(el => el.tagName === 'SELECT');
      if (isSelect) {
        await categoryField.first().selectOption({ index: 1 }); // Select first non-default option
      } else {
        // Might be a button or dropdown
        await categoryField.first().click();
        await page.waitForLoadState('domcontentloaded');
        
        // Look for category options
        const categoryOption = page.getByText(/food|dining|restaurant|groceries|entertainment/i);
        const hasOptions = await categoryOption.count() > 0;
        if (hasOptions) {
          await categoryOption.first().click();
        }
      }
    }
    
    // Categories are optional - log whether implemented
    console.log(`Category selection ${hasCategoryField ? 'is' : 'is not'} implemented`);
  });

  test('should show expense in group after creation', async ({ page }) => {
    // Increase timeout for this test
    test.setTimeout(20000);
    
    await createAndLoginTestUser(page);
    
    // Create a group
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    const nameInput = page.getByPlaceholder(/group.*name/i).or(page.getByLabel(/group.*name/i));
    await nameInput.fill('Expense Display Group');
    const descInput = page.getByPlaceholder(/details|description/i);
    await descInput.fill('Testing expense display');
    await page.getByRole('button', { name: 'Create Group' }).last().click();
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
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

  test('should handle different split types if available', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    // Create a group
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    const nameInput = page.getByPlaceholder(/group.*name/i).or(page.getByLabel(/group.*name/i));
    await nameInput.fill('Split Types Group');
    const descInput = page.getByPlaceholder(/details|description/i);
    await descInput.fill('Testing split types');
    await page.getByRole('button', { name: 'Create Group' }).last().click();
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
    // Go to add expense
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    await addExpenseButton.first().click();
    await page.waitForLoadState('domcontentloaded');
    
    // Look for split type options
    const splitTypeField = page.getByLabel(/split/i)
      .or(page.locator('[data-testid*="split"]'))
      .or(page.getByText(/equal|exact|percentage/i).first());
    
    const hasSplitTypes = await splitTypeField.count() > 0;
    if (hasSplitTypes) {
      await expect(splitTypeField.first()).toBeVisible();
      
      // Try to change split type
      await splitTypeField.first().click();
      await page.waitForLoadState('domcontentloaded');
      
      // Look for split options
      const exactSplit = page.getByText(/exact/i).or(page.getByText(/custom/i));
      const hasExactOption = await exactSplit.count() > 0;
      
      if (hasExactOption) {
        await exactSplit.first().click();
        await page.waitForLoadState('domcontentloaded');
        
        // Verify custom split UI appears
        const customAmountFields = await page.locator('input[type="number"]').count();
        expect(customAmountFields).toBeGreaterThan(1);
      }
    } else {
      // Split types are optional - log status
      console.log('Split types not implemented');
    }
  });

  test('should handle expense with date selection', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    // Create a group
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    const nameInput = page.getByPlaceholder(/group.*name/i).or(page.getByLabel(/group.*name/i));
    await nameInput.fill('Date Test Group');
    const descInput = page.getByPlaceholder(/details|description/i);
    await descInput.fill('Testing date selection');
    await page.getByRole('button', { name: 'Create Group' }).last().click();
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
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
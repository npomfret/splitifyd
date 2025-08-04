import { Page, expect } from '@playwright/test';

/**
 * Standard flow for adding an expense
 * Replaces the duplicated expense creation pattern
 */
export async function addExpenseStandardFlow(
  page: Page,
  description: string,
  amount: string | number
): Promise<void> {
  // Click add expense button - use specific selector, no .or() chains
  await page.getByRole('button', { name: 'Add Expense' }).click();
  
  // Wait for add expense page
  await page.waitForURL(/\/groups\/[^/]+\/add-expense$/);
  
  // Fill the form
  await fillExpenseForm(page, { description, amount });
  
  // Submit the form
  await submitExpenseForm(page);
  
  // Wait for navigation back to group page
  await page.waitForURL(/\/groups\/[^/]+$/);
  
  // Verify expense is visible
  await expectExpenseVisible(page, description);
}

/**
 * Fills expense form fields
 */
export async function fillExpenseForm(
  page: Page,
  data: {
    description: string;
    amount: string | number;
    category?: string;
    splitType?: 'equal' | 'exact' | 'percentage';
    paidBy?: string;
  }
): Promise<void> {
  // Description field - use specific placeholder
  await page.getByPlaceholder('What was this expense for?').fill(data.description);
  
  // Amount field - use specific placeholder
  await page.getByPlaceholder('0.00').fill(data.amount.toString());
  
  // Optional: Category
  if (data.category) {
    await page.getByRole('button', { name: /category/i }).click();
    await page.getByRole('option', { name: data.category }).click();
  }
  
  // Optional: Split type (default is equal)
  if (data.splitType && data.splitType !== 'equal') {
    // Click the split type selector
    await page.getByText(/split equally/i).click();
    await page.getByRole('option', { name: data.splitType }).click();
  }
  
  // Optional: Paid by (if not the current user)
  if (data.paidBy) {
    const paidByButton = page.getByRole('button', { name: /paid by/i });
    if (await paidByButton.isVisible()) {
      await paidByButton.click();
      await page.getByRole('option', { name: data.paidBy }).click();
    }
  }
}

/**
 * Submits the expense form
 */
export async function submitExpenseForm(page: Page): Promise<void> {
  // Use the specific button text - no .or() chains
  const submitButton = page.getByRole('button', { name: /save expense/i });
  await submitButton.click();
}

/**
 * Verifies an expense is visible on the page
 */
export async function expectExpenseVisible(
  page: Page,
  description: string
): Promise<void> {
  // Look for expense in the expenses list
  const expense = page.getByText(description);
  await expect(expense).toBeVisible();
}

/**
 * Gets all expenses visible on the current page
 */
export async function getAllExpenses(page: Page): Promise<Array<{
  description: string;
  amount: string;
}>> {
  const expenses: Array<{ description: string; amount: string }> = [];
  
  // Find expense items - would be better with data-testid
  const expenseItems = await page.locator('.expense-item, [class*="expense"]').all();
  
  for (const item of expenseItems) {
    const descriptionElement = item.locator('[class*="description"]').first();
    const amountElement = item.locator('[class*="amount"]').first();
    
    if (await descriptionElement.isVisible() && await amountElement.isVisible()) {
      expenses.push({
        description: await descriptionElement.textContent() || '',
        amount: await amountElement.textContent() || ''
      });
    }
  }
  
  return expenses;
}

/**
 * Clicks on a specific expense to view details
 */
export async function clickExpense(page: Page, description: string): Promise<void> {
  const expense = page.getByText(description).first();
  await expense.click();
  
  // Wait for expense detail page or modal
  await page.waitForLoadState('networkidle');
}

/**
 * Deletes an expense
 */
export async function deleteExpense(page: Page, description: string): Promise<void> {
  // First click on the expense
  await clickExpense(page, description);
  
  // Click delete button
  const deleteButton = page.getByRole('button', { name: /delete/i });
  await deleteButton.click();
  
  // Confirm deletion if there's a confirmation dialog
  const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }
  
  // Wait for expense to be removed
  await expect(page.getByText(description)).not.toBeVisible();
}

/**
 * Sets up custom split amounts for an expense
 */
export async function setCustomSplits(
  page: Page,
  splits: Array<{
    userName: string;
    amount?: number;
    percentage?: number;
  }>
): Promise<void> {
  for (const split of splits) {
    if (split.amount !== undefined) {
      // Find input associated with user for exact amount
      const input = page.locator(`input[placeholder*="${split.userName}"]`);
      await input.fill(split.amount.toString());
    } else if (split.percentage !== undefined) {
      // Find input associated with user for percentage
      const input = page.locator(`input[placeholder*="${split.userName}"]`);
      await input.fill(split.percentage.toString());
    }
  }
}

/**
 * Verifies the total amount of all expenses
 */
export async function expectTotalExpenses(
  page: Page,
  expectedTotal: number
): Promise<void> {
  const expenses = await getAllExpenses(page);
  
  const total = expenses.reduce((sum, expense) => {
    const amount = parseFloat(expense.amount.replace(/[$,]/g, ''));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  
  expect(total).toBeCloseTo(expectedTotal, 2);
}
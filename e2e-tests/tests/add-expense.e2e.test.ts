import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, AuthenticationWorkflow } from '../helpers';
import { CreateGroupModalPage, DashboardPage } from '../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
  test('should add new expense with equal split', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.createGroupWithUser('Expense Test Group', 'Testing expense creation');
    
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    
    await expect(addExpenseButton).toBeVisible();
    await addExpenseButton.click();
    
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    const descriptionField = page.getByPlaceholder('What was this expense for?');
    const amountField = page.getByPlaceholder('0.00');
    const categorySelect = page.getByRole('combobox').first();
    
    await expect(descriptionField).toBeVisible();
    await descriptionField.fill('Test Dinner');
    
    await expect(amountField).toBeVisible();
    await amountField.fill('50.00');
    
    await expect(categorySelect).toBeVisible();
    await categorySelect.selectOption({ index: 1 });
    
    const submitButton = page.getByRole('button', { name: /save expense/i });
    
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 1000 });
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText('Test Dinner')).toBeVisible({ timeout: 500 });
    await expect(page.getByText('$50.00')).toBeVisible();
  });

  test('should handle expense form validation', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Validation Test Group', 'Testing form validation');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    
    await addExpenseButton.click();
    await page.waitForLoadState('domcontentloaded');
    
    const submitButton = page.getByRole('button', { name: /save expense/i });
    
    await submitButton.click();
    
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    await expect(page).not.toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.getByPlaceholder('What was this expense for?').fill('Test expense');
    await page.getByPlaceholder('0.00').fill('25.00');
    
    await submitButton.click();
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 1000 });
  });

  test('should allow selecting expense category', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Category Test Group', 'Testing expense categories');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    await addExpenseButton.first().click();
    
    await page.waitForLoadState('networkidle');
    
    const descriptionField = page.getByPlaceholder('What was this expense for?');
    await expect(descriptionField).toBeVisible();
    
    const categorySelect = page.getByRole('combobox').first();
    await expect(categorySelect).toBeVisible();
    
    const initialCategory = await categorySelect.inputValue();
    
    await categorySelect.selectOption({ index: 2 });
    
    const newCategory = await categorySelect.inputValue();
    expect(newCategory).not.toBe(initialCategory);
    
    await page.getByPlaceholder('What was this expense for?').fill('Dinner with category');
    await page.getByPlaceholder('0.00').fill('45.00');
    
    await page.getByRole('button', { name: /save expense/i }).click();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    await expect(page.getByText('Dinner with category')).toBeVisible();
  });

  test('should show expense in group after creation', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Expense Display Group', 'Testing expense display');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    
    await page.getByRole('button', { name: /add expense/i }).click();
    await page.waitForLoadState('domcontentloaded');
    
    await page.getByPlaceholder('What was this expense for?').fill('Movie Tickets');
    await page.getByPlaceholder('0.00').fill('24.99');
    
    await page.getByRole('button', { name: /save expense/i }).click();
    
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText('Movie Tickets')).toBeVisible();
    
    const amountText = page.getByText('$24.99');
    await expect(amountText).toBeVisible();
    
    await expect(page.getByText(/paid by|Paid:/i)).toBeVisible();
  });

});
import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, GroupWorkflow } from '../helpers';
import { DashboardPage, GroupDetailPage } from '../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
  test('should add new expense with equal split', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.createGroupWithUser('Expense Test Group', 'Testing expense creation');
    const groupDetailPage = new GroupDetailPage(page);
    
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    
    await expect(addExpenseButton).toBeVisible();
    await addExpenseButton.click();
    
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    const amountField = groupDetailPage.getExpenseAmountField();
    const categorySelect = groupDetailPage.getCategorySelect();
    
    await expect(descriptionField).toBeVisible();
    await descriptionField.fill('Test Dinner');
    
    await expect(amountField).toBeVisible();
    await amountField.fill('50.00');
    
    await expect(categorySelect).toBeVisible();
    await categorySelect.selectOption({ index: 1 });
    
    const submitButton = groupDetailPage.getSaveExpenseButton();
    
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 1000 });
    await page.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getExpenseByDescription('Test Dinner')).toBeVisible({ timeout: 500 });
    await expect(groupDetailPage.getExpenseAmount('$50.00')).toBeVisible();
  });

  // Form validation tests moved to form-validation.e2e.test.ts

  test('should allow selecting expense category', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Category Test Group', 'Testing expense categories');
    const groupDetailPage = new GroupDetailPage(page);
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await addExpenseButton.first().click();
    
    await page.waitForLoadState('networkidle');
    
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible();
    
    const categorySelect = groupDetailPage.getCategorySelect();
    await expect(categorySelect).toBeVisible();
    
    const initialCategory = await categorySelect.inputValue();
    
    await categorySelect.selectOption({ index: 2 });
    
    const newCategory = await categorySelect.inputValue();
    expect(newCategory).not.toBe(initialCategory);
    
    await groupDetailPage.getExpenseDescriptionField().fill('Dinner with category');
    await groupDetailPage.getExpenseAmountField().fill('45.00');
    
    await groupDetailPage.getSaveExpenseButton().click();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    await expect(groupDetailPage.getExpenseByDescription('Dinner with category')).toBeVisible();
  });

  test('should show expense in group after creation', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Expense Display Group', 'Testing expense display');
    const groupDetailPage = new GroupDetailPage(page);
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    
    await groupDetailPage.getAddExpenseButton().click();
    await page.waitForLoadState('domcontentloaded');
    
    await groupDetailPage.getExpenseDescriptionField().fill('Movie Tickets');
    await groupDetailPage.getExpenseAmountField().fill('24.99');
    
    await groupDetailPage.getSaveExpenseButton().click();
    
    await page.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getExpenseByDescription('Movie Tickets')).toBeVisible();
    
    const amountText = groupDetailPage.getExpenseAmount('$24.99');
    await expect(amountText).toBeVisible();
    
    await expect(page.getByText(/paid by|Paid:/i)).toBeVisible();
  });

});
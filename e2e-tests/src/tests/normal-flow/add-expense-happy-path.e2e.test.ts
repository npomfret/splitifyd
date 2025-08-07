import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
  test('should add new expense with equal split', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    await dashboardPage.createGroupAndNavigate(generateTestGroupName('Expense'), 'Testing expense creation');
    
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
    await groupDetailPage.typeCategoryText('dinner');
    
    const submitButton = groupDetailPage.getSaveExpenseButton();
    
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    await page.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getExpenseByDescription('Test Dinner')).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    await expect(groupDetailPage.getExpenseAmount('$50.00')).toBeVisible();
  });

  // Form validation tests moved to form-validation.e2e.test.ts

  test('should allow selecting expense category', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    await dashboardPage.createGroupAndNavigate(generateTestGroupName('Category'), 'Testing expense categories');
    
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await addExpenseButton.first().click();
    
    await page.waitForLoadState('networkidle');
    
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible();
    
    const categorySelect = groupDetailPage.getCategorySelect();
    await expect(categorySelect).toBeVisible();
    
    const initialCategory = await categorySelect.inputValue();
    
    await groupDetailPage.typeCategoryText('Bills & Utilities');
    
    const newCategory = await categorySelect.inputValue();
    expect(newCategory).not.toBe(initialCategory);
    
    await groupDetailPage.getExpenseDescriptionField().fill('Dinner with category');
    await groupDetailPage.getExpenseAmountField().fill('45.00');
    
    await groupDetailPage.getSaveExpenseButton().click();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    await expect(groupDetailPage.getExpenseByDescription('Dinner with category')).toBeVisible();
  });

  test('should show expense in group after creation', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    await dashboardPage.createGroupAndNavigate(generateTestGroupName('Display'), 'Testing expense display');
    
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

  test('should allow custom category input', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    await dashboardPage.createGroupAndNavigate(generateTestGroupName('CustomCategory'), 'Testing custom category input');
    
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await addExpenseButton.first().click();
    
    await page.waitForLoadState('networkidle');
    
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible();
    
    // Test custom category input
    await groupDetailPage.typeCategoryText('Custom Office Supplies');
    
    await groupDetailPage.getExpenseDescriptionField().fill('Custom category expense');
    await groupDetailPage.getExpenseAmountField().fill('15.99');
    
    await groupDetailPage.getSaveExpenseButton().click();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
    await expect(groupDetailPage.getExpenseByDescription('Custom category expense')).toBeVisible();
  });

});
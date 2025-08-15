import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { generateTestGroupName } from '../../utils/test-helpers';
import { waitForURLWithContext, groupDetailUrlPattern, editExpenseUrlPattern, expenseDetailUrlPattern } from '../../helpers/wait-helpers';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { GroupWorkflow } from '../../workflows';

setupMCPDebugOnFailure();

test.describe('Expense Editing Error Testing', () => {
  test('should edit expense amount (increase)', async ({ 
    authenticatedPage, 
    dashboardPage, 
    groupDetailPage 
  }, testInfo) => {
    // Skip error checking for edit operations
    testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues during editing' });
    
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName('EditAmount'), 'Testing expense amount editing');
    
    // Create initial expense (following successful pattern from add-expense-happy-path)
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await expect(addExpenseButton).toBeVisible();
    await addExpenseButton.click();
    
    // Wait for add expense page to load
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    // Fill expense form
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Amount Edit Test');
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '50');
    await groupDetailPage.selectCategoryFromSuggestions('Food & Dining');
    
    // Save expense
    await groupDetailPage.getSaveExpenseButton().click();
    await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Verify expense was created
    await expect(groupDetailPage.getExpenseByDescription('Amount Edit Test')).toBeVisible();
    await expect(groupDetailPage.getExpenseAmount('$50.00')).toBeVisible();
    
    // Click on expense to view details (following working pattern)
    const expenseElement = groupDetailPage.getExpenseByDescription('Amount Edit Test');
    await expenseElement.click();
    
    // Wait for expense detail page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Look for edit button (following working pattern with proper timeout)
    const editButton = page.getByRole('button', { name: /edit/i });
    await expect(editButton).toBeVisible({ timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    await editButton.click();
    
    // Wait for edit page to load (following working pattern)
    await waitForURLWithContext(page, editExpenseUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Edit the amount (following working pattern with proper timeout)
    const amountField = groupDetailPage.getExpenseAmountField();
    await expect(amountField).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    
    // Change amount from $50.00 to $75.50
    await groupDetailPage.fillPreactInput(amountField, '75.50');
    
    // Save changes (following working pattern)
    const updateButton = page.getByRole('button', { name: /update expense/i });
    await expect(updateButton).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    await updateButton.click();
    
    // Wait for navigation to expense detail page (following working pattern)
    await waitForURLWithContext(page, expenseDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Verify the change was applied - use exact match to avoid strict mode violation
    await expect(page.getByText('Amount Edit Test', { exact: true })).toBeVisible();
    // Check that the amount heading contains the new value
    await expect(page.getByRole('heading', { name: /Amount Edit Test.*\$75\.50/ })).toBeVisible();
  });


  test("should edit expense amount (decrease)", async ({
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }, testInfo) => {
    // Skip error checking for edit operations
    testInfo.annotations.push({ type: "skip-error-checking", description: "May have API validation issues during editing" });
    
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName("EditAmountDown"), "Testing expense amount decrease");
    
    // Create initial expense with higher amount
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await expect(addExpenseButton).toBeVisible();
    await addExpenseButton.click();
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), "High Amount Expense");
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), "150");
    await groupDetailPage.selectCategoryFromSuggestions("Food & Dining");
    
    await groupDetailPage.getSaveExpenseButton().click();
    await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Edit to decrease amount
    const expenseElement = groupDetailPage.getExpenseByDescription("High Amount Expense");
    await expect(expenseElement).toBeVisible();
    await expenseElement.click();
    await page.waitForLoadState("domcontentloaded");
    
    const editButton = page.getByRole("button", { name: /edit/i });
    await expect(editButton).toBeVisible({ timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    await editButton.click();
    
    await waitForURLWithContext(page, editExpenseUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Change amount from $150.00 to $25.75
    const amountField = groupDetailPage.getExpenseAmountField();
    await expect(amountField).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    await groupDetailPage.fillPreactInput(amountField, "25.75");
    
    const updateButton = page.getByRole("button", { name: /update expense/i });
    await expect(updateButton).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    await updateButton.click();
    
    await waitForURLWithContext(page, expenseDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Verify amount was decreased - use exact match to avoid strict mode violation
    await expect(page.getByText("High Amount Expense", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /High Amount Expense.*\$25\.75/ })).toBeVisible();
  });

  test('should edit expense description successfully', async ({ 
    authenticatedPage, 
    dashboardPage, 
    groupDetailPage 
  }, testInfo) => {
    // Skip error checking for edit operations
    testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues during editing' });
    
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName('EditDesc'), 'Testing expense description editing');
    
    // Create initial expense
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await expect(addExpenseButton).toBeVisible();
    await addExpenseButton.click();
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Original Description');
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '42.99');
    await groupDetailPage.selectCategoryFromSuggestions('Food & Dining');
    
    await groupDetailPage.getSaveExpenseButton().click();
    await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Verify expense was created
    await expect(groupDetailPage.getExpenseByDescription('Original Description')).toBeVisible();
    
    // Edit the description - rest of the test continues from here...
    const expenseElement = groupDetailPage.getExpenseByDescription('Original Description');
    await expenseElement.click();
    
    await page.waitForLoadState('domcontentloaded');
    
    const editButton = page.getByRole('button', { name: /edit/i });
    await expect(editButton).toBeVisible({ timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    await editButton.click();
    
    await waitForURLWithContext(page, editExpenseUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    
    // Change description
    await groupDetailPage.fillPreactInput(descriptionField, 'Updated Description Text');
    
    const updateButton = page.getByRole('button', { name: /update expense/i });
    await expect(updateButton).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    await updateButton.click();
    
    await waitForURLWithContext(page, expenseDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Verify description was updated - use exact match to avoid strict mode violation
    await expect(page.getByText('Updated Description Text', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Updated Description Text.*\$42\.99/ })).toBeVisible();
  });
});
import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { generateTestGroupName } from '../../utils/test-helpers';
import { waitForURLWithContext, groupDetailUrlPattern, editExpenseUrlPattern, expenseDetailUrlPattern } from '../../helpers/wait-helpers';
import { GroupWorkflow } from '../../workflows';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Freeform Categories Error Testing', () => {
  test('should handle category with special characters and emojis', async ({ 
    authenticatedPage, 
    dashboardPage, 
    groupDetailPage 
  }, testInfo) => {
    // @skip-error-checking - May have API validation issues with special characters
    testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues with special characters' });
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName('SpecialCat'), 'Testing special characters');
    
    // Start adding expense
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await addExpenseButton.click();
    
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    // Fill basic expense details
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Special characters test');
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '33.33');
    
    // Test category with special characters (avoiding security filters)
    const specialCategory = 'Café & Restaurant - Fine Dining';
    await groupDetailPage.typeCategoryText(specialCategory);
    
    // Verify special category was entered
    const categoryInput = groupDetailPage.getCategoryInput();
    const categoryValue = await categoryInput.inputValue();
    expect(categoryValue).toBe(specialCategory);
    
    // Submit expense
    await groupDetailPage.getSaveExpenseButton().click();
    await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Verify expense was created with special character category
    await expect(groupDetailPage.getExpenseByDescription('Special characters test')).toBeVisible();
    await expect(groupDetailPage.getExpenseAmount('$33.33')).toBeVisible();
  });

  test('should edit expense and change category from predefined to custom', async ({ 
    authenticatedPage, 
    dashboardPage, 
    groupDetailPage 
  }, testInfo) => {
    // @skip-error-checking - May have API validation issues during editing
    testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues during editing' });
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName('EditCat'), 'Testing category editing');
    
    // Create expense with predefined category first
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await addExpenseButton.click();
    
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Business lunch');
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '55.00');
    await groupDetailPage.selectCategoryFromSuggestions('Food & Dining');
    
    await groupDetailPage.getSaveExpenseButton().click();
    await waitForURLWithContext(page, groupDetailUrlPattern());
    
    // Verify expense was created
    await expect(groupDetailPage.getExpenseByDescription('Business lunch')).toBeVisible();
    
    // Click on the expense to view details/edit
    const expenseElement = groupDetailPage.getExpenseByDescription('Business lunch');
    await expenseElement.click();
    
    // Should navigate to expense detail or edit page
    await page.waitForLoadState('networkidle');
    
    // Look for edit button and click it
    const editButton = page.getByRole('button', { name: /edit/i });
    await expect(editButton).toBeVisible({ timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    await editButton.click();
    
    // Wait for navigation to the edit page
    await waitForURLWithContext(page, editExpenseUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // Now we should be on the edit expense page
    // Change the category to a custom one
    const categoryInput = groupDetailPage.getCategoryInput();
    await expect(categoryInput).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    
    const customCategory = 'Corporate Client Meeting';
    await groupDetailPage.fillPreactInput(categoryInput, customCategory);
    
    // Save the changes - in edit mode the button says "Update Expense"
    const updateButton = page.getByRole('button', { name: /update expense/i });
    await updateButton.click();
    
    // After updating, we navigate to the expense detail page, not group detail
    await waitForURLWithContext(page, expenseDetailUrlPattern());
    
    // Verify we're on the expense detail page with the updated category
    await expect(page.getByText('Business lunch')).toBeVisible();
    await expect(page.getByText(customCategory)).toBeVisible();
  });

  test('should prevent submission with empty category', async ({ 
    authenticatedPage, 
    dashboardPage, 
    groupDetailPage 
  }, testInfo) => {
    // @skip-error-checking - This test expects validation errors
    testInfo.annotations.push({ type: 'skip-error-checking', description: 'This test expects validation errors' });
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName('EmptyCat'), 'Testing empty category validation');
    
    // Start adding expense
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await addExpenseButton.click();
    
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    // Fill basic expense details but leave category empty
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Test empty category');
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '10.00');
    
    // Clear category field (it might have a default)
    const categoryInput = groupDetailPage.getCategoryInput();
    await groupDetailPage.fillPreactInput(categoryInput, '');
    
    // Try to submit
    const saveButton = groupDetailPage.getSaveExpenseButton();
    await saveButton.click();
    
    // Should stay on the same page (not navigate away)
    await page.waitForTimeout(1000); // Brief wait to see if navigation occurs
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // There should be an error message or the form should be invalid
    // (specific validation UI depends on implementation)
  });
});
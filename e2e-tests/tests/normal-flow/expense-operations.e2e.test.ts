import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Basic Expense Operations E2E', () => {
  test('should create and view an expense', async ({ authenticatedPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup('Test Group', 'Testing expense creation');
    const groupInfo = { user };

    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add expense using page object
    await groupDetailPage.addExpense({
      description: 'Test Expense',
      amount: 50,
      paidBy: groupInfo.user.displayName,
      splitType: 'equal'
    });
    
    // Verify expense appears in list
    await expect(page.getByText('Test Expense')).toBeVisible();
    
    // Navigate to expense detail
    await page.getByText('Test Expense').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Verify expense detail page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
    await expect(page.getByText('Test Expense')).toBeVisible();
    await expect(page.getByText('$50.00').first()).toBeVisible();
  });

  test('should delete an expense', async ({ authenticatedPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup('Delete Test Group', 'Testing expense deletion');
    const groupInfo = { user };

    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add expense to delete
    await groupDetailPage.addExpense({
      description: 'Expense to Delete',
      amount: 75,
      paidBy: groupInfo.user.displayName,
      splitType: 'equal'
    });
    
    // Verify expense exists
    await expect(page.getByText('Expense to Delete')).toBeVisible();
    
    // Navigate to expense detail
    await page.getByText('Expense to Delete').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click delete button
    const deleteButton = page.getByRole('button', { name: /delete/i });
    await deleteButton.click();
    
    // Confirm deletion - click the second delete button in the confirmation dialog
    const confirmButton = page.getByRole('button', { name: 'Delete' }).nth(1);
    await confirmButton.click();
    
    // Should redirect back to group
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Expense should no longer be visible
    await expect(page.getByText('Expense to Delete')).not.toBeVisible();
  });
});
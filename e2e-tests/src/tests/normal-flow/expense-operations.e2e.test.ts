import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Basic Expense Operations E2E', () => {
  test('should create, view, and delete an expense', async ({ authenticatedPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup(generateTestGroupName('Operations'), 'Testing complete expense lifecycle');
    const groupInfo = { user };

    // Create expense using page object
    await groupDetailPage.addExpense({
      description: 'Test Expense Lifecycle',
      amount: 50,
      paidBy: groupInfo.user.displayName,
      splitType: 'equal'
    });
    
    // Verify expense appears in list
    await expect(page.getByText('Test Expense Lifecycle')).toBeVisible();
    
    // Navigate to expense detail to view it
    await page.getByText('Test Expense Lifecycle').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Verify expense detail page (view functionality)
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
    await expect(page.getByText('Test Expense Lifecycle')).toBeVisible();
    await expect(page.getByText('$50.00').first()).toBeVisible();
    
    // Delete the expense
    const deleteButton = page.getByRole('button', { name: /delete/i });
    await deleteButton.click();
    
    // Confirm deletion - click the second delete button in the confirmation dialog
    const confirmButton = page.getByRole('button', { name: 'Delete' }).nth(1);
    await confirmButton.click();
    
    // Should redirect back to group
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Expense should no longer be visible (deletion verification)
    await expect(page.getByText('Test Expense Lifecycle')).not.toBeVisible();
  });
});
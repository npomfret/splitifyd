import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, DashboardPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Delete Operations E2E', () => {
  test.describe('Expense Deletion', () => {
    test('should delete an expense with confirmation', async ({ page }) => {
      const user = await createAndLoginTestUser(page);
      
      // Create a group
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Delete Test Group', 'Testing expense deletion');
      
      // Wait for navigation to group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Add an expense to delete
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      
      // Wait for expense form to load
      await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
      
      const descriptionField = page.getByPlaceholder('What was this expense for?');
      const amountField = page.getByPlaceholder('0.00');
      
      await descriptionField.fill('Expense to Delete');
      await amountField.fill('50.00');
      
      const submitButton = page.getByRole('button', { name: 'Save Expense' });
      await submitButton.click();
      await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      
      // Verify expense was created
      await expect(page.getByText('Expense to Delete')).toBeVisible();
      
      // Click on the expense to view details
      await page.getByText('Expense to Delete').click();
      await page.waitForLoadState('domcontentloaded');
      
      // Click delete button
      const deleteButton = page.getByRole('button', { name: /delete/i });
      await deleteButton.click();
      
      // Confirm deletion
      const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
      await confirmButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should be back on group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Expense should no longer be visible
      await expect(page.getByText('Expense to Delete')).not.toBeVisible();
    });

    test('should cancel expense deletion', async ({ page }) => {
      await createAndLoginTestUser(page);
      
      // Create group and expense
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Cancel Delete Test', 'Testing deletion cancellation');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Add expense
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      
      await page.getByPlaceholder('What was this expense for?').fill('Keep This Expense');
      await page.getByPlaceholder('0.00').fill('75.00');
      
      await page.getByRole('button', { name: 'Save Expense' }).click();
      await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      
      // Click on expense
      await page.getByText('Keep This Expense').click();
      
      // Click delete
      const deleteButton = page.getByRole('button', { name: /delete/i });
      await deleteButton.click();
      
      // Cancel deletion
      const cancelButton = page.getByRole('button', { name: /cancel|no/i });
      await cancelButton.click();
      
      // Expense should still be visible
      await expect(page.getByText('Keep This Expense')).toBeVisible();
    });

    test('should prevent deletion of expenses by non-creator', async ({ page, browser }) => {
      // User 1 creates group and expense
      const user1 = await createAndLoginTestUser(page);
      
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Permission Test Group', 'Testing delete permissions');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      const groupUrl = page.url();
      
      // Add expense as User 1
      await page.getByRole('button', { name: /add expense/i }).click();
      await page.getByPlaceholder('What was this expense for?').fill('User 1 Expense');
      await page.getByPlaceholder('0.00').fill('100.00');
      await page.getByRole('button', { name: 'Save Expense' }).click();
      await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      
      // User 2 joins the group
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await createAndLoginTestUser(page2);
      
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // User 2 should see the expense but not be able to delete it
      await expect(page2.getByText('User 1 Expense')).toBeVisible();
      
      // Click on expense as User 2
      await page2.getByText('User 1 Expense').click();
      
      // Delete button should not be visible for non-creator
      const deleteButton = page2.getByRole('button', { name: /delete/i });
      await expect(deleteButton).not.toBeVisible();
      
      await context2.close();
    });
  });

  test.describe('Group Deletion', () => {
    test('should delete an empty group', async ({ page }) => {
      await createAndLoginTestUser(page);
      
      // Create empty group
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Empty Group', 'Group to be deleted');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Open group settings
      const settingsButton = page.getByRole('button', { name: /settings/i });
      await settingsButton.click();
      
      // Click delete group option
      const deleteGroupOption = page.getByText(/delete.*group/i);
      await deleteGroupOption.click();
      
      // Confirm deletion
      const confirmButton = page.getByRole('button', { name: /confirm|delete/i });
      await confirmButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Group should not appear in list
      await expect(page.getByText('Empty Group')).not.toBeVisible();
    });

    test('should prevent deletion of group with expenses', async ({ page }) => {
      await createAndLoginTestUser(page);
      
      // Create group
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Group with Expenses', 'Cannot be deleted');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Add expense
      await page.getByRole('button', { name: /add expense/i }).click();
      await page.getByPlaceholder('What was this expense for?').fill('Blocking Expense');
      await page.getByPlaceholder('0.00').fill('200.00');
      await page.getByRole('button', { name: 'Save Expense' }).click();
      await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      
      // Try to delete group
      const settingsButton = page.getByRole('button', { name: /settings/i });
      await settingsButton.click();
      
      const deleteGroupOption = page.getByText(/delete.*group/i);
      await deleteGroupOption.click();
      
      // Should show error message
      const warningMessage = page.getByText(/cannot.*delete.*expenses|remove.*expenses.*first/i);
      await expect(warningMessage).toBeVisible();
      
      // Group should still exist
      await expect(page.getByText('Group with Expenses')).toBeVisible();
    });
  });

  test.describe('Bulk Operations', () => {
    test('should select and delete multiple expenses', async ({ page }) => {
      await createAndLoginTestUser(page);
      
      // Create group
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Bulk Delete Test', 'Testing bulk operations');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Add multiple expenses
      for (let i = 1; i <= 3; i++) {
        await page.getByRole('button', { name: /add expense/i }).click();
        await page.getByPlaceholder('What was this expense for?').fill(`Expense ${i}`);
        await page.getByPlaceholder('0.00').fill(`${i * 10}.00`);
        await page.getByRole('button', { name: 'Save Expense' }).click();
        await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      }
      
      // Enable bulk select mode
      const bulkSelectButton = page.getByRole('button', { name: /bulk|select.*multiple/i });
      await bulkSelectButton.click();
      
      // Select all expenses
      const selectAllCheckbox = page.getByRole('checkbox', { name: /select.*all/i });
      await selectAllCheckbox.check();
      
      // Delete selected
      const bulkDeleteButton = page.getByRole('button', { name: /delete.*selected/i });
      await bulkDeleteButton.click();
      
      // Confirm bulk deletion
      const confirmButton = page.getByRole('button', { name: /confirm|delete/i });
      await confirmButton.click();
      await page.waitForLoadState('networkidle');
      
      // All expenses should be deleted
      await expect(page.getByText('Expense 1')).not.toBeVisible();
      await expect(page.getByText('Expense 2')).not.toBeVisible();
      await expect(page.getByText('Expense 3')).not.toBeVisible();
    });
  });
});
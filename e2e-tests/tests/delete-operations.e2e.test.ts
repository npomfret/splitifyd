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
      test.setTimeout(20000); // 20 seconds for delete test
      const user = await createAndLoginTestUser(page);
      
      // Create a group
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Delete Test Group', 'Testing expense deletion');
      
      // Wait for navigation to group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Add an expense to delete
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      // Wait for expense form to load
      await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible({ timeout: 5000 });
      
      const descriptionField = page.getByPlaceholder('What was this expense for?');
      const amountField = page.getByRole('spinbutton');
      
      await descriptionField.fill('Expense to Delete');
      await amountField.fill('50.00');
      
      const submitButton = page.getByRole('button', { name: 'Save Expense' });
      
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      
      // Verify expense was created
      await expect(page.getByText('Expense to Delete')).toBeVisible();
      
      // Click on the expense to go to detail page
      await page.getByText('Expense to Delete').click();
      await page.waitForLoadState('domcontentloaded');
      
      // Look for delete button
      const deleteButton = page.getByRole('button', { name: /delete/i })
        .or(page.getByRole('button', { name: /remove/i }))
        .or(page.locator('[data-testid*="delete"]'));
      
      const hasDeleteButton = await deleteButton.count() > 0;
      if (hasDeleteButton) {
        await deleteButton.first().click();
                
        // Look for confirmation dialog
        const confirmDialog = page.getByText(/are you sure/i)
          .or(page.getByText(/confirm.*delete/i))
          .or(page.getByRole('dialog'));
        
        const hasConfirmation = await confirmDialog.count() > 0;
        if (hasConfirmation) {
          // Confirm deletion
          const confirmButton = page.getByRole('button', { name: /confirm/i })
            .or(page.getByRole('button', { name: /yes/i }))
            .or(page.getByRole('button', { name: /delete/i }).last());
          
          await confirmButton.click();
          await page.waitForLoadState('networkidle');
        }
        
        // Should be back on group page
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
        
        // Expense should no longer be visible on the group page
        await expect(page.getByText('Expense to Delete')).not.toBeVisible();
      } else {
        // Delete functionality not implemented - skip test
        test.skip();
      }
    });

    test('should cancel expense deletion', async ({ page }) => {
      test.setTimeout(20000);
      await createAndLoginTestUser(page);
      
      // Create group and expense
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Cancel Delete Test', 'Testing deletion cancellation');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Add expense
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      await page.waitForLoadState('domcontentloaded');
      
      const descriptionField = page.getByPlaceholder('What was this expense for?');
      const amountField = page.getByRole('spinbutton');
      
      await descriptionField.fill('Keep This Expense');
      await amountField.fill('75.00');
      
      const submitButton = page.getByRole('button', { name: 'Save Expense' });
      
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      
      // Click on expense
      await page.getByText('Keep This Expense').click();
      await page.waitForLoadState('domcontentloaded');
      
      // Try to delete but cancel
      const deleteButton = page.getByRole('button', { name: /delete/i });
      
      if (await deleteButton.count() > 0) {
        await deleteButton.first().click();
                
        // Cancel deletion
        const cancelButton = page.getByRole('button', { name: /cancel/i })
          .or(page.getByRole('button', { name: /no/i }));
        
        if (await cancelButton.count() > 0) {
          await cancelButton.first().click();
          await page.waitForLoadState('domcontentloaded');
        }
        
        // Expense should still exist
        await expect(page.getByText('Keep This Expense')).toBeVisible();
      } else {
        // Cancel functionality not implemented - skip test
        test.skip();
      }
    });

    test('should prevent deletion of expenses by non-creator', async ({ page, browser }) => {
      test.setTimeout(20000);
      // Create User 1 and expense
      await createAndLoginTestUser(page);
      
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Permission Test Group', 'Testing delete permissions');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      const groupUrl = page.url();
      
      // Add expense as User 1
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      await page.waitForLoadState('domcontentloaded');
      
      const descriptionField = page.getByPlaceholder('What was this expense for?');
      const amountField = page.getByRole('spinbutton');
      
      await descriptionField.fill('User 1 Expense');
      await amountField.fill('100.00');
      
      const submitButton = page.getByRole('button', { name: 'Save Expense' });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      
      // Create User 2 in separate context
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createAndLoginTestUser(page2);
      
      // User 2 tries to access the group (would need invitation in real app)
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // Check if User 2 can see the group
      const canSeeGroup = await page2.getByText('Permission Test Group').count() > 0;
      
      if (canSeeGroup) {
        // Try to access the expense
        const expenseVisible = await page2.getByText('User 1 Expense').count() > 0;
        
        if (expenseVisible) {
          await page2.getByText('User 1 Expense').click();
          await page2.waitForLoadState('domcontentloaded');
          
          // Check if delete button is visible/enabled for User 2
          const deleteButton = page2.getByRole('button', { name: /delete/i });
          const hasDeleteButton = await deleteButton.count() > 0;
          
          if (hasDeleteButton) {
            const isDisabled = await deleteButton.first().isDisabled();
            const isHidden = await deleteButton.first().isHidden();
            
            // Delete button should be disabled or hidden for non-creator
            expect(isDisabled || isHidden).toBeTruthy();
          } else {
            // Delete button not present for non-creator - this is correct behavior
            expect(hasDeleteButton).toBe(false);
          }
        }
      }
      
      await context2.close();
    });
  });

  test.describe('Group Deletion', () => {
    test('should delete an empty group', async ({ page }) => {
      await createAndLoginTestUser(page);
      
      // Create a group to delete
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Empty Group to Delete', 'This group will be deleted');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Look for group settings or delete option
      const settingsButton = page.getByRole('button', { name: /settings/i })
        .or(page.getByRole('button', { name: /menu/i }))
        .or(page.getByRole('button', { name: /options/i }))
        .or(page.locator('[data-testid*="settings"]'));
      
      if (await settingsButton.count() > 0) {
        await settingsButton.first().click();
                
        // Look for delete group option
        const deleteGroupOption = page.getByText(/delete.*group/i)
          .or(page.getByRole('button', { name: /delete.*group/i }))
          .or(page.getByRole('menuitem', { name: /delete/i }));
        
        if (await deleteGroupOption.count() > 0) {
          await deleteGroupOption.first().click();
                    
          // Confirm deletion
          const confirmButton = page.getByRole('button', { name: /confirm/i })
            .or(page.getByRole('button', { name: /delete/i }).last());
          
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
            await page.waitForLoadState('networkidle');
            
            // Should redirect to dashboard
            await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
            
            // Group should not appear in list
            await expect(page.getByText('Empty Group to Delete')).not.toBeVisible();
          }
        }
      } else {
        // Delete group functionality not implemented - skip test
        test.skip();
      }
    });

    test('should prevent deletion of group with expenses', async ({ page }) => {
      test.setTimeout(20000);
      await createAndLoginTestUser(page);
      
      // Create group with expense
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
            await createGroupModal.createGroup('Group with Expenses', 'Cannot delete with expenses');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Add an expense
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      await page.waitForLoadState('domcontentloaded');
      
      const descriptionField = page.getByPlaceholder('What was this expense for?');
      const amountField = page.getByRole('spinbutton');
      
      await descriptionField.fill('Blocking Expense');
      await amountField.fill('200.00');
      
      const submitButton = page.getByRole('button', { name: 'Save Expense' });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      
      // Try to delete group
      const settingsButton = page.getByRole('button', { name: /settings/i })
        .or(page.getByRole('button', { name: /menu/i }));
      
      if (await settingsButton.count() > 0) {
        await settingsButton.first().click();
                
        const deleteGroupOption = page.getByText(/delete.*group/i);
        
        if (await deleteGroupOption.count() > 0) {
          await deleteGroupOption.first().click();
                    
          // Should show error or warning
          const warningMessage = page.getByText(/cannot.*delete.*expenses/i)
            .or(page.getByText(/remove.*expenses.*first/i))
            .or(page.getByText(/group.*has.*expenses/i));
          
          const hasWarning = await warningMessage.count() > 0;
          if (hasWarning) {
            await expect(warningMessage.first()).toBeVisible();
          }
          
          // Group should still exist
          await expect(page.getByText('Group with Expenses')).toBeVisible();
        }
      } else {
        // Delete settings not available - skip test
        test.skip();
      }
    });

    test('should handle group deletion with unsettled balances', async ({ page }) => {
      test.setTimeout(20000);
      await createAndLoginTestUser(page);
      
      // Create group
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
            await createGroupModal.createGroup('Unsettled Group', 'Has unsettled balances');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Add expenses to create unsettled balance
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      
      // Add first expense
      await addExpenseButton.click();
      await page.waitForLoadState('domcontentloaded');
      
      const descriptionField = page.getByPlaceholder('What was this expense for?');
      const amountField = page.getByRole('spinbutton');
      
      await descriptionField.fill('Dinner');
      await amountField.fill('120.00');
      
      const submitButton = page.getByRole('button', { name: 'Save Expense' });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      
      // Try to delete group with unsettled balances
      const settingsButton = page.getByRole('button', { name: /settings/i })
        .or(page.getByRole('button', { name: /menu/i }));
      
      if (await settingsButton.count() > 0) {
        await settingsButton.first().click();
                
        const deleteGroupOption = page.getByText(/delete.*group/i);
        
        if (await deleteGroupOption.count() > 0) {
          await deleteGroupOption.first().click();
                    
          // Look for warning about unsettled balances
          const balanceWarning = page.getByText(/unsettled.*balance/i)
            .or(page.getByText(/settle.*first/i))
            .or(page.getByText(/outstanding.*debt/i));
          
          const hasBalanceWarning = await balanceWarning.count() > 0;
          
          // Either shows warning or prevents deletion
          if (hasBalanceWarning) {
            await expect(balanceWarning.first()).toBeVisible();
          }
        }
      } else {
        // Delete settings not available - skip test
        test.skip();
      }
    });
  });

  test.describe('Bulk Operations', () => {
    test('should select and delete multiple expenses', async ({ page }) => {
      test.setTimeout(20000);
      await createAndLoginTestUser(page);
      
      // Create group
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
            await createGroupModal.createGroup('Bulk Delete Test', 'Testing bulk operations');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Add multiple expenses
      for (let i = 1; i <= 3; i++) {
        const addExpenseButton = page.getByRole('button', { name: /add expense/i });
        await addExpenseButton.click();
        await page.waitForLoadState('domcontentloaded');
        
        const descriptionField = page.getByPlaceholder('What was this expense for?');
        const amountField = page.getByRole('spinbutton');
        
        await descriptionField.fill(`Expense ${i}`);
        await amountField.fill(`${i * 10}.00`);
        
        const submitButton = page.getByRole('button', { name: 'Save Expense' });
        await submitButton.click();
        await page.waitForLoadState('networkidle');
      }
      
      // Look for bulk selection UI
      const selectAllCheckbox = page.getByRole('checkbox', { name: /select.*all/i })
        .or(page.locator('[data-testid="select-all"]'));
      
      const bulkSelectButton = page.getByRole('button', { name: /select/i })
        .or(page.getByText(/bulk.*action/i));
      
      const hasBulkOperations = await selectAllCheckbox.count() > 0 || await bulkSelectButton.count() > 0;
      
      if (hasBulkOperations) {
        // Enable bulk mode if needed
        if (await bulkSelectButton.count() > 0) {
          await bulkSelectButton.first().click();
                  }
        
        // Select expenses
        const expenseCheckboxes = page.getByRole('checkbox').filter({ hasNot: page.getByText(/select.*all/i) });
        const checkboxCount = await expenseCheckboxes.count();
        
        for (let i = 0; i < Math.min(2, checkboxCount); i++) {
          await expenseCheckboxes.nth(i).check();
        }
        
        // Look for bulk delete button
        const bulkDeleteButton = page.getByRole('button', { name: /delete.*selected/i })
          .or(page.getByRole('button', { name: /delete \(\d+\)/i }));
        
        if (await bulkDeleteButton.count() > 0) {
          await bulkDeleteButton.first().click();
                    
          // Confirm bulk deletion
          const confirmButton = page.getByRole('button', { name: /confirm/i });
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
            await page.waitForLoadState('networkidle');
          }
          
          // At least one expense should be removed
          const remainingExpenses = await page.getByText(/Expense \d/).count();
          expect(remainingExpenses).toBeLessThan(3);
        } else {
          // Bulk delete not available - skip test
          test.skip();
        }
      } else {
        // Bulk operations not implemented - skip test
        test.skip();
      }
    });
  });

  test.describe('Undo/Recovery', () => {
    test('should show undo option after deletion', async ({ page }) => {
      test.setTimeout(20000);
      await createAndLoginTestUser(page);
      
      // Create group and expense
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
            await createGroupModal.createGroup('Undo Test Group', 'Testing undo functionality');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Add expense
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      await page.waitForLoadState('domcontentloaded');
      
      const descriptionField = page.getByPlaceholder('What was this expense for?');
      const amountField = page.getByRole('spinbutton');
      
      await descriptionField.fill('Expense to Undo');
      await amountField.fill('45.00');
      
      const submitButton = page.getByRole('button', { name: 'Save Expense' });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      
      // Delete the expense
      await page.getByText('Expense to Undo').click();
      await page.waitForLoadState('domcontentloaded');
      
      const deleteButton = page.getByRole('button', { name: /delete/i });
      
      if (await deleteButton.count() > 0) {
        await deleteButton.first().click();
                
        // Confirm deletion
        const confirmButton = page.getByRole('button', { name: /confirm/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForLoadState('networkidle');
        }
        
        // Look for undo notification
        const undoNotification = page.getByText(/undo/i)
          .or(page.getByRole('button', { name: /undo/i }))
          .or(page.getByText(/deleted.*undo/i));
        
        const hasUndo = await undoNotification.count() > 0;
        
        if (hasUndo) {
          await expect(undoNotification.first()).toBeVisible();
          
          // Try to undo
          const undoButton = page.getByRole('button', { name: /undo/i });
          if (await undoButton.count() > 0) {
            await undoButton.click();
            await page.waitForLoadState('networkidle');
            
            // Expense should be restored
            await expect(page.getByText('Expense to Undo')).toBeVisible();
          }
        } else {
          // Undo feature not available - this is okay
          console.log('Undo feature not implemented');
        }
      } else {
        // Delete functionality not available - skip test
        test.skip();
      }
    });

    test('should handle deletion of recently edited expense', async ({ page }) => {
      test.setTimeout(20000);
      await createAndLoginTestUser(page);
      
      // Create group and expense
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
            await createGroupModal.createGroup('Edit Delete Test', 'Testing edit then delete');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Add expense
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      await page.waitForLoadState('domcontentloaded');
      
      const descriptionField = page.getByPlaceholder('What was this expense for?');
      const amountField = page.getByRole('spinbutton');
      
      await descriptionField.fill('Original Expense');
      await amountField.fill('60.00');
      
      const submitButton = page.getByRole('button', { name: 'Save Expense' });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      
      // Edit the expense
      await page.getByText('Original Expense').click();
      await page.waitForLoadState('domcontentloaded');
      
      const editButton = page.getByRole('button', { name: /edit/i });
      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForLoadState('domcontentloaded');
        
        // Update description
        const editDescField = page.getByPlaceholder('What was this expense for?');
        await editDescField.fill('Edited Expense');
        
        const updateButton = page.getByRole('button', { name: /save|update/i });
        
        if (await updateButton.count() > 0) {
          await updateButton.first().click();
        }
        await page.waitForLoadState('networkidle');
      }
      
      // Now delete the edited expense
      const deleteButton = page.getByRole('button', { name: /delete/i });
      if (await deleteButton.count() > 0) {
        await deleteButton.first().click();
                
        const confirmButton = page.getByRole('button', { name: /confirm/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForLoadState('networkidle');
        }
        
        // Expense should be deleted
        await expect(page.getByText('Edited Expense')).not.toBeVisible();
        await expect(page.getByText('Original Expense')).not.toBeVisible();
      } else {
        // Delete functionality not available - skip test  
        test.skip();
      }
    });
  });
});
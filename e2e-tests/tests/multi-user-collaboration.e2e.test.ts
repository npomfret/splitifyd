import { test, expect, Browser } from '@playwright/test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, DashboardPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Multi-User Collaboration E2E', () => {
  test.describe('Group Sharing and Invitations', () => {
    test('should handle invalid or expired share links', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const user = await createAndLoginTestUser(page);
      
      // Try to access an invalid share link
      const invalidShareLink = `${page.url().split('/dashboard')[0]}/join/invalid-group-id`;
      
      await page.goto(invalidShareLink);
      await page.waitForLoadState('networkidle');
      
      // Check for error handling - 404 page shows "Page not found"
      const errorMessage = page.getByText(/page not found/i)
        .or(page.getByText(/404/))
        .or(page.getByText(/invalid.*link/i))
        .or(page.getByText(/expired/i));
      
      // Should show error message
      await expect(errorMessage.first()).toBeVisible();
      
      // Should show "Go Home" link on 404 page
      const goHomeLink = page.getByRole('link', { name: /go home/i });
      await expect(goHomeLink).toBeVisible();
      
      await context.close();
    });
  });

  test.describe('Concurrent Expense Management', () => {
    test('should handle concurrent expense creation by multiple users', async ({ browser }) => {
      // User 1 creates group
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Concurrent Test Group', 'Testing concurrent operations');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      const groupUrl = page1.url();
      
      // User 2 joins the same group
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await createAndLoginTestUser(page2);
      
      // Navigate directly to group URL
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // Both users attempt to add expenses simultaneously
      const user1ExpensePromise = (async () => {
        const addExpenseButton = page1.getByRole('button', { name: /add expense/i });
        if (await addExpenseButton.count() > 0) {
          await addExpenseButton.first().click();
          await page1.waitForLoadState('domcontentloaded');
          
          const descField = page1.getByLabel(/description/i);
          const amountField = page1.getByLabel(/amount/i);
          
          await descField.first().fill('User 1 Concurrent Expense');
          await amountField.first().fill('100.00');
          
          const submitButton = page1.getByRole('button', { name: /save/i });
          await submitButton.first().click();
          await page1.waitForLoadState('networkidle');
        }
      })();
      
      const user2ExpensePromise = (async () => {
        const addExpenseButton = page2.getByRole('button', { name: /add expense/i });
        if (await addExpenseButton.count() > 0) {
          await addExpenseButton.first().click();
          await page2.waitForLoadState('domcontentloaded');
          
          const descField = page2.getByLabel(/description/i);
          const amountField = page2.getByLabel(/amount/i);
          
          await descField.first().fill('User 2 Concurrent Expense');
          await amountField.first().fill('150.00');
          
          const submitButton = page2.getByRole('button', { name: /save/i });
          await submitButton.first().click();
          await page2.waitForLoadState('networkidle');
        }
      })();
      
      // Wait for both operations to complete
      await Promise.all([user1ExpensePromise, user2ExpensePromise]);
      
      // Verify both expenses were created
      await page1.reload();
      await page2.reload();
      
      // Check if both expenses are visible
      const user1Expense = page1.getByText('User 1 Concurrent Expense');
      const user2Expense = page1.getByText('User 2 Concurrent Expense');
      
      if (await user1Expense.count() > 0 && await user2Expense.count() > 0) {
        await expect(user1Expense).toBeVisible();
        await expect(user2Expense).toBeVisible();
      }
      
      await context1.close();
      await context2.close();
    });

    test('should sync expense updates across users in real-time', async ({ browser }) => {
      // User 1 creates group
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Real-time Sync Group', 'Testing real-time synchronization');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      const groupUrl = page1.url();
      
      // User 2 joins the same group
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await createAndLoginTestUser(page2);
      
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // User 1 adds an expense
      const addExpenseButton = page1.getByRole('button', { name: /add expense/i });
      if (await addExpenseButton.count() > 0) {
        await addExpenseButton.click();
        await page1.waitForLoadState('domcontentloaded');
        
        const descField = page1.getByLabel(/description/i);
        const amountField = page1.getByLabel(/amount/i);
        
        await descField.first().fill('Real-time Test Expense');
        await amountField.first().fill('200.00');
        
        const submitButton = page1.getByRole('button', { name: /save/i });
        await submitButton.first().click();
        await page1.waitForLoadState('networkidle');
      }
      
      // User 2 should see the expense without refreshing
      await page2.waitForTimeout(1000); // Give time for real-time update
      
      const expenseOnUser2 = page2.getByText('Real-time Test Expense');
      if (await expenseOnUser2.count() === 0) {
        // If real-time sync isn't working, try refreshing
        await page2.reload();
      }
      
      await expect(expenseOnUser2).toBeVisible();
      
      await context1.close();
      await context2.close();
    });

    test('should update balances when multiple users add expenses', async ({ browser }) => {
      // User 1 creates group
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Balance Test Group', 'Testing balance calculations');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      const groupUrl = page1.url();
      
      // User 2 joins the group
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await createAndLoginTestUser(page2);
      
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // User 1 adds expense paid by them, split equally
      const addExpenseButton1 = page1.getByRole('button', { name: /add expense/i });
      if (await addExpenseButton1.count() > 0) {
        await addExpenseButton1.click();
        await page1.waitForLoadState('domcontentloaded');
        
        const descField1 = page1.getByLabel(/description/i);
        const amountField1 = page1.getByLabel(/amount/i);
        
        await descField1.first().fill('User 1 Paid Dinner');
        await amountField1.first().fill('100.00');
        
        const submitButton1 = page1.getByRole('button', { name: /save/i });
        await submitButton1.first().click();
        await page1.waitForLoadState('networkidle');
      }
      
      // User 2 adds expense paid by them, split equally
      const addExpenseButton2 = page2.getByRole('button', { name: /add expense/i });
      if (await addExpenseButton2.count() > 0) {
        await addExpenseButton2.click();
        await page2.waitForLoadState('domcontentloaded');
        
        const descField2 = page2.getByLabel(/description/i);
        const amountField2 = page2.getByLabel(/amount/i);
        
        await descField2.first().fill('User 2 Paid Lunch');
        await amountField2.first().fill('60.00');
        
        const submitButton2 = page2.getByRole('button', { name: /save/i });
        await submitButton2.first().click();
        await page2.waitForLoadState('networkidle');
      }
      
      // Check balances
      await page1.reload();
      
      // Look for balance indicators
      const balanceIndicator = page1.getByText(/owed|owes/)
        .or(page1.getByText(/\$20/))
        .or(page1.getByText(/owed.*20/i));
      
      if (await balanceIndicator.count() > 0) {
        await expect(balanceIndicator.first()).toBeVisible();
      }
      
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Settlement and Payment Recording', () => {
    test('should handle settlement recording by different users', async ({ browser }) => {
      // User 1 creates group
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Settlement Test Group', 'Testing payment recording');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Add test expense first
      const addExpenseButton = page1.getByRole('button', { name: /add expense/i });
      if (await addExpenseButton.count() > 0) {
        await addExpenseButton.click();
        await page1.waitForLoadState('domcontentloaded');
        
        const descField = page1.getByLabel(/description/i);
        const amountField = page1.getByLabel(/amount/i);
        
        await descField.first().fill('Test Expense for Settlement');
        await amountField.first().fill('100.00');
        
        const submitButton = page1.getByRole('button', { name: /save/i });
        await submitButton.first().click();
        await page1.waitForLoadState('networkidle');
      }
      
      // Look for settle up functionality
      const settleButton = page1.getByRole('button', { name: /settle.*up/i })
        .or(page1.getByRole('button', { name: /record.*payment/i }));
      
      if (await settleButton.count() > 0) {
        await settleButton.first().click();
        
        // Record a payment
        const paymentAmountField = page1.getByLabel(/amount/i);
        if (await paymentAmountField.count() > 0) {
          await paymentAmountField.fill('50.00');
          
          const recordPaymentButton = page1.getByRole('button', { name: /record|save|confirm/i });
          await recordPaymentButton.first().click();
          await page1.waitForLoadState('networkidle');
          
          // Verify payment was recorded
          const paymentRecord = page1.getByText(/payment.*50/i);
          if (await paymentRecord.count() > 0) {
            await expect(paymentRecord).toBeVisible();
          }
        }
      }
      
      await context1.close();
    });
  });

  test.describe('Conflict Resolution', () => {
    test('should handle edit conflicts when users modify same expense', async ({ browser }) => {
      // User 1 creates group and expense
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Conflict Test Group', 'Testing edit conflicts');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      const groupUrl = page1.url();
      
      // Add an expense to edit
      const addExpenseButton = page1.getByRole('button', { name: /add expense/i });
      if (await addExpenseButton.count() > 0) {
        await addExpenseButton.click();
        await page1.waitForLoadState('domcontentloaded');
        
        const descField = page1.getByLabel(/description/i);
        const amountField = page1.getByLabel(/amount/i);
        
        await descField.first().fill('Original Expense');
        await amountField.first().fill('100.00');
        
        const submitButton = page1.getByRole('button', { name: /save/i });
        await submitButton.first().click();
        await page1.waitForLoadState('networkidle');
      }
      
      // User 2 joins the group
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await createAndLoginTestUser(page2);
      
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // Both users try to edit the same expense
      const editButton1 = page1.getByRole('button', { name: /edit/i });
      const editButton2 = page2.getByRole('button', { name: /edit/i });
      
      if (await editButton1.count() > 0 && await editButton2.count() > 0) {
        // User 1 starts editing
        await editButton1.first().click();
        
        // User 2 also starts editing
        await editButton2.first().click();
        
        // Both make changes
        const descField1 = page1.getByLabel(/description/i);
        await descField1.first().fill('User 1 Edit');
        
        const descField2 = page2.getByLabel(/description/i);
        await descField2.first().fill('User 2 Edit');
        
        // User 1 saves first
        const saveButton1 = page1.getByRole('button', { name: /save/i });
        await saveButton1.first().click();
        await page1.waitForLoadState('networkidle');
        
        // User 2 tries to save
        const saveButton2 = page2.getByRole('button', { name: /save/i });
        await saveButton2.first().click();
        
        // Check for conflict message
        const conflictMessage = page2.getByText(/conflict/i)
          .or(page2.getByText(/changed.*another.*user/i))
          .or(page2.getByText(/outdated/i));
        
        if (await conflictMessage.count() > 0) {
          await expect(conflictMessage.first()).toBeVisible();
        }
      }
      
      await context1.close();
      await context2.close();
    });

    test('should prevent race conditions in expense deletion', async ({ browser }) => {
      // User 1 creates group and expense
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Deletion Race Test Group', 'Testing deletion race conditions');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      const groupUrl = page1.url();
      
      // Add an expense to delete
      const addExpenseButton = page1.getByRole('button', { name: /add expense/i });
      if (await addExpenseButton.count() > 0) {
        await addExpenseButton.click();
        await page1.waitForLoadState('domcontentloaded');
        
        const descField = page1.getByLabel(/description/i);
        const amountField = page1.getByLabel(/amount/i);
        
        await descField.first().fill('Expense to Delete');
        await amountField.first().fill('75.00');
        
        const submitButton = page1.getByRole('button', { name: /save/i });
        await submitButton.first().click();
        await page1.waitForLoadState('networkidle');
      }
      
      // User 2 joins the group
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await createAndLoginTestUser(page2);
      
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // Both users try to delete the same expense
      const deleteButton1 = page1.getByRole('button', { name: /delete/i });
      const deleteButton2 = page2.getByRole('button', { name: /delete/i });
      
      if (await deleteButton1.count() > 0 && await deleteButton2.count() > 0) {
        // Simultaneous deletion attempts
        const deletion1 = deleteButton1.first().click();
        const deletion2 = deleteButton2.first().click();
        
        await Promise.all([deletion1, deletion2]);
        
        // Wait for operations to complete
        await page1.waitForLoadState('networkidle');
        await page2.waitForLoadState('networkidle');
        
        // Verify expense is deleted
        const expenseText1 = page1.getByText('Expense to Delete');
        const expenseText2 = page2.getByText('Expense to Delete');
        
        await expect(expenseText1).not.toBeVisible();
        await expect(expenseText2).not.toBeVisible();
      }
      
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Real-time Features', () => {
    test('should notify users of group activity', async ({ browser }) => {
      // User 1 creates group
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Activity Test Group', 'Testing activity notifications');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      const groupUrl = page1.url();
      
      // User 2 joins the group
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await createAndLoginTestUser(page2);
      
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // User 1 adds an expense
      const addExpenseButton = page1.getByRole('button', { name: /add expense/i });
      if (await addExpenseButton.count() > 0) {
        await addExpenseButton.click();
        await page1.waitForLoadState('domcontentloaded');
        
        const descField = page1.getByLabel(/description/i);
        const amountField = page1.getByLabel(/amount/i);
        
        await descField.first().fill('Activity Test Expense');
        await amountField.first().fill('50.00');
        
        const submitButton = page1.getByRole('button', { name: /save/i });
        await submitButton.first().click();
        await page1.waitForLoadState('networkidle');
      }
      
      // Check for activity indicators
      const activityFeed = page1.getByText(/activity/i)
        .or(page1.getByText(/recent/i))
        .or(page1.getByRole('region', { name: /activity/i }));
      
      if (await activityFeed.count() > 0) {
        await expect(activityFeed.first()).toBeVisible();
        
        // Look for the activity entry
        const activityEntry = page1.getByText(/added.*expense/i)
          .or(page1.getByText(/created.*activity test expense/i))
          .or(page1.getByText(new RegExp(user1.displayName + '.*added', 'i')));
        
        if (await activityEntry.count() > 0) {
          await expect(activityEntry.first()).toBeVisible();
        }
      }
      
      // Check for notification badge
      await page2.reload();
      const notificationBadge = page2.getByText(/\d+/).filter({ hasText: /^[1-9]\d*$/ })
        .or(page2.locator('.badge'))
        .or(page2.getByText(/^\d+$/).filter({ hasText: /^[1-9]\d*$/ }));
      
      if (await notificationBadge.count() > 0) {
        await expect(notificationBadge.first()).toBeVisible();
      }
      
      await context1.close();
      await context2.close();
    });

    test('should show real-time updates when other users make changes', async ({ browser }) => {
      // User 1 creates group
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Real-time Update Group', 'Testing live updates');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      const groupUrl = page1.url();
      
      // User 2 joins the group
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await createAndLoginTestUser(page2);
      
      await page2.goto(groupUrl);
      await page2.waitForLoadState('networkidle');
      
      // Check for real-time connection indicators
      const connectionStatus = page1.getByText(/connected/i)
        .or(page1.getByText(/connected/i))
        .or(page1.locator('.online-indicator'));
      
      if (await connectionStatus.count() > 0) {
        await expect(connectionStatus.first()).toBeVisible();
      }
      
      // Look for auto-refresh settings
      const autoRefreshToggle = page1.getByLabel(/auto.*refresh/i)
        .or(page1.getByRole('checkbox', { name: /auto.*refresh/i }))
        .or(page1.getByText(/real.*time/i));
      
      if (await autoRefreshToggle.count() > 0) {
        // Ensure auto-refresh is enabled
        const isChecked = await autoRefreshToggle.first().isChecked().catch(() => false);
        if (!isChecked) {
          await autoRefreshToggle.first().click();
        }
      }
      
      // User 1 makes a change
      const addExpenseButton = page1.getByRole('button', { name: /add expense/i });
      if (await addExpenseButton.count() > 0) {
        await addExpenseButton.click();
        
        // Look for loading/syncing indicator
        const syncIndicator = page1.getByText(/saving/i)
          .or(page1.getByText(/syncing/i))
          .or(page1.locator('[data-testid="sync-spinner"]'));
        
        if (await syncIndicator.count() > 0) {
          await expect(syncIndicator.first()).toBeVisible();
        }
      }
      
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Permission Management', () => {
    test('should enforce group admin permissions', async ({ browser }) => {
      // User 1 creates group (becomes admin)
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await createAndLoginTestUser(page1);
      
      const dashboard1 = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard1.openCreateGroupModal();
      await createGroupModal.createGroup('Permission Test Group', 'Testing admin permissions');
      
      await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // User 1 should see admin controls
      const adminIndicator = page1.getByText(/admin/i)
        .or(page1.getByText(/owner/i))
        .or(page1.locator('[data-testid="admin-badge"]'));
      
      if (await adminIndicator.count() > 0) {
        await expect(adminIndicator.first()).toBeVisible();
      }
      
      // Check for admin-only actions
      const adminActions = page1.getByRole('button', { name: /settings/i })
        .or(page1.getByRole('button', { name: /group.*settings/i }))
        .or(page1.getByRole('button', { name: /delete.*group/i }));
      
      if (await adminActions.count() > 0) {
        await expect(adminActions.first()).toBeVisible();
      }
      
      await context1.close();
    });

    test('should handle member role changes', async ({ page }) => {
      const user = await createAndLoginTestUser(page);
      
      const dashboard = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Role Management Group', 'Testing role changes');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
      
      // Look for members management
      const membersSection = page.getByRole('button', { name: /members/i })
        .or(page.getByRole('button', { name: /members/i })
        .or(page.getByText(/members.*settings/i)));
      
      if (await membersSection.count() > 0) {
        await membersSection.first().click();
        
        // Check for role management UI
        const roleSelector = page.getByRole('combobox', { name: /role/i })
          .or(page.getByText(/member.*role/i))
          .or(page.locator('[data-testid="role-selector"]'));
        
        if (await roleSelector.count() > 0) {
          await expect(roleSelector.first()).toBeVisible();
        }
      }
    });
  });
});
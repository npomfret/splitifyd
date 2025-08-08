import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Multi-User Collaboration E2E', () => {
  test('should handle group sharing via share link', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup(generateTestGroupName('Shared'), 'Testing group sharing');

    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.getShareButton().click();
    
    await expect(groupDetailPage.getShareModal()).toBeVisible();
    
    await expect(groupDetailPage.getShareLinkInput()).toBeVisible();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    expect(shareLink).toMatch(/\/join(\?|\/)/);
    
    await page.keyboard.press('Escape');
    
    const page2 = secondUser.page;
    const groupDetailPage2 = secondUser.groupDetailPage;

    // Navigate to the share link directly - it contains the full path including query params
    await page2.goto(shareLink);
    
    // Wait for the join page to load
    await expect(groupDetailPage2.getJoinGroupHeading()).toBeVisible();
    
    // Click the Join Group button
    await groupDetailPage2.getJoinGroupButton().click();
    
    // Now wait for navigation to the group page
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
  });

  test('should allow multiple users to add expenses to same group', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup(generateTestGroupName('MultiExp'), 'Testing concurrent expenses');
    const user1 = user;
    
    // Get share link
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    // Second user joins
    const page2 = secondUser.page;
    const groupDetailPage2 = secondUser.groupDetailPage;
    const user2 = secondUser.user;
    
    await page2.goto(shareLink);
    await expect(groupDetailPage2.getJoinGroupHeading()).toBeVisible();
    await groupDetailPage2.getJoinGroupButton().click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // CRITICAL FIX: Refresh first user's page to see the new member, then wait for synchronization
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // Also ensure second user sees both members
    await page2.reload();
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // Now add expenses
    await groupDetailPage.addExpense({
      description: 'User 1 Lunch',
      amount: 25,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    await groupDetailPage2.addExpense({
      description: 'User 2 Dinner',
      amount: 40,
      paidBy: user2.displayName,
      splitType: 'equal'
    });
    
    // Wait for balance calculations before verifying
    await page.reload();
    await groupDetailPage.waitForBalanceCalculation();
    await page2.reload(); 
    await groupDetailPage2.waitForBalanceCalculation();
    
    // Verify expenses
    await expect(groupDetailPage.getExpenseByDescription('User 1 Lunch')).toBeVisible();
    await expect(groupDetailPage.getExpenseByDescription('User 2 Dinner')).toBeVisible();
    await expect(groupDetailPage2.getExpenseByDescription('User 1 Lunch')).toBeVisible();
    await expect(groupDetailPage2.getExpenseByDescription('User 2 Dinner')).toBeVisible();
    
  });

  test('should show group creator as admin', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup(generateTestGroupName('Admin'), 'Testing admin badge');
    
    await expect(page.getByText('Admin', { exact: true })).toBeVisible();
  });

  test('single user can create group and add multiple expenses', async ({ authenticatedPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup(generateTestGroupName('Solo'), 'Testing multiple expenses');
    
    // Add multiple expenses
    const expenses = [
      { description: 'Hotel Booking', amount: 300 },
      { description: 'Car Rental', amount: 150 },
      { description: 'Groceries', amount: 80 }
    ];
    
    for (const expense of expenses) {
      await groupDetailPage.addExpense({
        description: expense.description,
        amount: expense.amount,
        paidBy: user.displayName,
        splitType: 'equal'
      });
      
      // Wait for each expense to be processed
      await groupDetailPage.waitForBalanceCalculation();
    }
    
    // Verify all expenses are visible
    for (const expense of expenses) {
      await expect(groupDetailPage.getExpenseByDescription(expense.description)).toBeVisible();
    }
  });

  test('balances update correctly with multiple users and expenses', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup(generateTestGroupName('Balance'), 'Testing balance calculations');
    const groupInfo = { user };
    const user1 = groupInfo.user;
    
    // Get share link
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    // Second user joins
    const page2 = secondUser.page;
    const groupDetailPage2 = secondUser.groupDetailPage;
    const user2 = secondUser.user;
    await page2.goto(shareLink);
    await expect(groupDetailPage2.getJoinGroupHeading()).toBeVisible();
    await groupDetailPage2.getJoinGroupButton().click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    // User 1 pays for shared expense
    await groupDetailPage.addExpense({
      description: 'Shared Meal',
      amount: 100,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Verify balance shows User 2 owes User 1
    await page.reload();
    await page.waitForLoadState('networkidle');
    const owesPattern = new RegExp(`${user2.displayName}.*owes.*${user1.displayName}`, 'i');
    await expect(page.getByText(owesPattern)).toBeVisible();
    
  });
});
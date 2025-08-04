import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, GroupWorkflow, AuthenticationWorkflow } from '../helpers';
import { GroupDetailPage } from '../pages';
import { TIMEOUT_CONTEXTS, TIMEOUTS } from '../config/timeouts';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Multi-User Collaboration E2E', () => {
  test('should handle group sharing via share link', async ({ page, browser }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Shared Test Group', 'Testing group sharing');
    const groupDetailPage = new GroupDetailPage(page);

    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);

    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.getShareButton().click();
    
    await expect(groupDetailPage.getShareModal()).toBeVisible();
    
    await expect(groupDetailPage.getShareLinkInput()).toBeVisible();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    expect(shareLink).toMatch(/\/join(\?|\/)/);
    
    await page.keyboard.press('Escape');
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const groupDetailPage2 = new GroupDetailPage(page2);
    const user2 = await AuthenticationWorkflow.createTestUser(page2);
    
    // Navigate to the share link directly - it contains the full path including query params
    await page2.goto(shareLink);
    
    // Wait for the join page to load
    await expect(groupDetailPage2.getJoinGroupHeading()).toBeVisible();
    
    // Click the Join Group button
    await groupDetailPage2.getJoinGroupButton().click();
    
    // Now wait for navigation to the group page
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
    await context2.close();
  });

  test('should allow multiple users to add expenses to same group', async ({ page, browser }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Multi-User Expense Group', 'Testing concurrent expenses');
    const groupDetailPage = new GroupDetailPage(page);
    const user1 = groupInfo.user;
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const groupDetailPage2 = new GroupDetailPage(page2);
    const user2 = await AuthenticationWorkflow.createTestUser(page2);
    // Navigate to the share link directly - it contains the full path including query params
    await page2.goto(shareLink);
    
    // Wait for the join page to load and click Join Group button
    await expect(groupDetailPage2.getJoinGroupHeading()).toBeVisible();
    await groupDetailPage2.getJoinGroupButton().click();
    
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    
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
    
    // Refresh both pages to see all expenses (no real-time sync)
    await page.reload();
    await page2.reload();
    await page.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getExpenseByDescription('User 1 Lunch')).toBeVisible();
    await expect(groupDetailPage.getExpenseByDescription('User 2 Dinner')).toBeVisible();
    await expect(groupDetailPage2.getExpenseByDescription('User 1 Lunch')).toBeVisible();
    await expect(groupDetailPage2.getExpenseByDescription('User 2 Dinner')).toBeVisible();
    
    await context2.close();
  });

  test('should handle invalid share links', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const invalidShareLink = `${page.url().split('/dashboard')[0]}/join/invalid-group-id`;
    
    const basePage = new GroupDetailPage(page);
    await basePage.navigateToShareLink(invalidShareLink);
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText(/404/)).toBeVisible();
    
    const goHomeLink = page.getByRole('link', { name: /go home/i });
    await expect(goHomeLink).toBeVisible();
  });

  test('should show group creator as admin', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Admin Test Group', 'Testing admin badge');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(page.getByText('Admin', { exact: true })).toBeVisible();
  });

  test('single user can create group and add multiple expenses', async ({ page }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Solo Expense Group', 'Testing multiple expenses');
    const groupDetail = new GroupDetailPage(page);
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add multiple expenses
    const expenses = [
      { description: 'Hotel Booking', amount: 300 },
      { description: 'Car Rental', amount: 150 },
      { description: 'Groceries', amount: 80 }
    ];
    
    for (const expense of expenses) {
      await groupDetail.addExpense({
        description: expense.description,
        amount: expense.amount,
        paidBy: groupInfo.user.displayName,
        splitType: 'equal'
      });
    }
    
    // Verify all expenses are visible
    for (const expense of expenses) {
      await expect(groupDetail.getExpenseByDescription(expense.description)).toBeVisible();
    }
  });

  test('balances update correctly with multiple users and expenses', async ({ page, browser }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Balance Test Group', 'Testing balance calculations');
    const groupDetailPage = new GroupDetailPage(page);
    const user1 = groupInfo.user;
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Get share link
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    // Second user joins
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const groupDetailPage2 = new GroupDetailPage(page2);
    const user2 = await AuthenticationWorkflow.createTestUser(page2);
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
    
    await context2.close();
  });
});
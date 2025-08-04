import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, GroupWorkflow, AuthenticationWorkflow } from '../helpers';
import { GroupDetailPage } from '../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Multi-User Collaboration E2E', () => {
  test('should handle group sharing via share link', async ({ page, browser }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Shared Test Group', 'Testing group sharing');

    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);

    const shareButton = page.getByRole('button', { name: /share/i });
    await expect(shareButton).toBeVisible();
    await shareButton.click();
    
    const shareModal = page.getByRole('dialog', { name: /share group/i });
    await expect(shareModal).toBeVisible();
    
    const shareLinkInput = shareModal.getByRole('textbox');
    await expect(shareLinkInput).toBeVisible();
    const shareLink = await shareLinkInput.inputValue();
    expect(shareLink).toMatch(/\/join(\?|\/)/);
    
    await page.keyboard.press('Escape');
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await AuthenticationWorkflow.createTestUser(page2);
    
    // Navigate to the share link directly - it contains the full path including query params
    await page2.goto(shareLink);
    
    // Wait for the join page to load
    await expect(page2.getByRole('heading', { name: 'Join Group' })).toBeVisible();
    
    // Click the Join Group button
    await page2.getByRole('button', { name: 'Join Group' }).click();
    
    // Now wait for navigation to the group page
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 1000 });
    
    await context2.close();
  });

  test('should allow multiple users to add expenses to same group', async ({ page, browser }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Multi-User Expense Group', 'Testing concurrent expenses');
    const user1 = groupInfo.user;
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    const shareModal = page.getByRole('dialog', { name: /share group/i });
    const shareLinkInput = shareModal.getByRole('textbox');
    const shareLink = await shareLinkInput.inputValue();
    await page.keyboard.press('Escape');
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await AuthenticationWorkflow.createTestUser(page2);
    // Navigate to the share link directly - it contains the full path including query params
    await page2.goto(shareLink);
    
    // Wait for the join page to load and click Join Group button
    await expect(page2.getByRole('heading', { name: 'Join Group' })).toBeVisible();
    await page2.getByRole('button', { name: 'Join Group' }).click();
    
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 1000 });
    
    const groupDetail1 = new GroupDetailPage(page);
    await groupDetail1.addExpense({
      description: 'User 1 Lunch',
      amount: 25,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    const groupDetail2 = new GroupDetailPage(page2);
    await groupDetail2.addExpense({
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
    
    await expect(page.getByText('User 1 Lunch')).toBeVisible();
    await expect(page.getByText('User 2 Dinner')).toBeVisible();
    await expect(page2.getByText('User 1 Lunch')).toBeVisible();
    await expect(page2.getByText('User 2 Dinner')).toBeVisible();
    
    await context2.close();
  });

  test('should handle invalid share links', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const invalidShareLink = `${page.url().split('/dashboard')[0]}/join/invalid-group-id`;
    
    await page.goto(invalidShareLink);
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
      await expect(page.getByText(expense.description)).toBeVisible();
    }
  });

  test('balances update correctly with multiple users and expenses', async ({ page, browser }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Balance Test Group', 'Testing balance calculations');
    const user1 = groupInfo.user;
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Get share link
    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    const shareModal = page.getByRole('dialog', { name: /share group/i });
    const shareLinkInput = shareModal.getByRole('textbox');
    const shareLink = await shareLinkInput.inputValue();
    await page.keyboard.press('Escape');
    
    // Second user joins
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await AuthenticationWorkflow.createTestUser(page2);
    await page2.goto(shareLink);
    await expect(page2.getByRole('heading', { name: 'Join Group' })).toBeVisible();
    await page2.getByRole('button', { name: 'Join Group' }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 1000 });
    
    // User 1 pays for shared expense
    const groupDetail1 = new GroupDetailPage(page);
    await groupDetail1.addExpense({
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
import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, DashboardPage, GroupDetailPage } from '../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Multi-User Collaboration E2E', () => {
  test('should handle group sharing via share link', async ({ page, browser }) => {
    const user1 = await createAndLoginTestUser(page);
    
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Shared Test Group', 'Testing group sharing');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    const groupUrl = page.url();
    
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
    const user2 = await createAndLoginTestUser(page2);
    
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
    const user1 = await createAndLoginTestUser(page);
    
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Multi-User Expense Group', 'Testing concurrent expenses');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    const shareModal = page.getByRole('dialog', { name: /share group/i });
    const shareLinkInput = shareModal.getByRole('textbox');
    const shareLink = await shareLinkInput.inputValue();
    await page.keyboard.press('Escape');
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await createAndLoginTestUser(page2);
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
    
    await expect(page.getByText('User 1 Lunch')).toBeVisible();
    await expect(page.getByText('User 2 Dinner')).toBeVisible({ timeout: 500 });
    await expect(page2.getByText('User 1 Lunch')).toBeVisible({ timeout: 500 });
    await expect(page2.getByText('User 2 Dinner')).toBeVisible();
    
    await context2.close();
  });

  test('should handle invalid share links', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    const invalidShareLink = `${page.url().split('/dashboard')[0]}/join/invalid-group-id`;
    
    await page.goto(invalidShareLink);
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText(/page not found/i).or(page.getByText(/404/)).first()).toBeVisible();
    
    const goHomeLink = page.getByRole('link', { name: /go home/i });
    await expect(goHomeLink).toBeVisible();
  });

  test('should show group creator as admin', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Admin Test Group', 'Testing admin badge');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(page.getByText('Admin', { exact: true })).toBeVisible();
  });
});
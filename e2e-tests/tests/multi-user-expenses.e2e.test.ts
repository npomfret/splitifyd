import { test, expect } from '../fixtures/base-test';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { GroupDetailPage, DashboardPage, CreateGroupModalPage } from '../pages';

test.describe('Multi-user group with expenses', () => {
  test('multiple users can join a group via share link and add expenses', async ({ browser }) => {
    test.setTimeout(40000);
    // Create 3 browser contexts for 3 different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();
    
    try {
      // User 1: Create account and group
      const user1 = await createAndLoginTestUser(page1);

      // Create a new group using page objects
      const dashboard = new DashboardPage(page1);
      const createGroupModal = new CreateGroupModalPage(page1);
      await dashboard.openCreateGroupModal();
      await createGroupModal.createGroup('Multi-User Test Group', 'Testing expenses with multiple users');
      
      // Wait for navigation to group detail page
      await page1.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      const groupUrl = page1.url();
      const groupId = groupUrl.split('/').pop()!;

      // Wait for page to stabilize after group creation
      await page1.waitForLoadState('networkidle');
      
      // Generate share link

      const groupDetailPage1 = new GroupDetailPage(page1);
      
      try {
        await groupDetailPage1.openShareModal();

      } catch (error) {
        console.error('Failed to open share modal:', error);
        // Take a screenshot for debugging
        await page1.screenshot({ path: 'share-modal-error.png' });
        throw error;
      }
      
      // Wait for the share link input to appear with the generated link

      const shareLinkInput = page1.locator('input[type="text"][readonly]');
      
      // Wait for the input to be visible and have a value
      await shareLinkInput.waitFor({ state: 'visible', timeout: 10000 });
      
      // Wait for the value to be populated (it starts empty)
      await page1.waitForFunction(
        () => {
          const input = document.querySelector('input[type="text"][readonly]') as HTMLInputElement;
          return input && input.value && input.value.includes('http');
        },
        { timeout: 10000 }
      );
      
      const shareLink = await shareLinkInput.inputValue();

      // Close the share modal
      await page1.keyboard.press('Escape');
      await page1.waitForLoadState('domcontentloaded');
      
      // User 2: Create account and join via share link
      const user2 = await createAndLoginTestUser(page2);

      // Extract the path from the share link (same as real join flow test)
      const url = new URL(shareLink);
      const joinPath = url.pathname + url.search;

      // Navigate to the join path  
      await page2.goto(joinPath);
      
      // Wait for automatic join and redirect to group page (no manual clicking needed)
      await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 15000 });

      // User 3: Create account and join via share link
      const user3 = await createAndLoginTestUser(page3);


      await page3.goto(joinPath);
      
      // Wait for automatic join and redirect to group page
      await page3.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 15000 });

      // User 1: Add an expense
      const groupDetailPage1Updated = new GroupDetailPage(page1);
      await groupDetailPage1Updated.addExpense({
        description: 'Lunch for everyone',
        amount: 60,
        paidBy: user1.displayName,
        splitType: 'equal'
      });

      // User 2: Refresh and add an expense
      await page2.reload();
      await page2.waitForLoadState('networkidle');
      
      const groupDetailPage2 = new GroupDetailPage(page2);
      await groupDetailPage2.addExpense({
        description: 'Movie tickets',
        amount: 45,
        paidBy: user2.displayName,
        splitType: 'equal'
      });

      // User 3: Refresh and add an expense
      await page3.reload();
      await page3.waitForLoadState('networkidle');
      
      const groupDetailPage3 = new GroupDetailPage(page3);
      await groupDetailPage3.addExpense({
        description: 'Uber ride',
        amount: 30,
        paidBy: user3.displayName,
        splitType: 'equal'
      });

      // Verify all expenses appear for all users

      // Refresh all pages to ensure latest data
      await Promise.all([
        page1.reload(),
        page2.reload(),
        page3.reload()
      ]);
      
      await Promise.all([
        page1.waitForLoadState('networkidle'),
        page2.waitForLoadState('networkidle'),
        page3.waitForLoadState('networkidle')
      ]);
      
      // Check User 1's view
      await expect(page1.getByText('Lunch for everyone')).toBeVisible();
      await expect(page1.getByText('Movie tickets')).toBeVisible();
      await expect(page1.getByText('Uber ride')).toBeVisible();

      // Check User 2's view
      await expect(page2.getByText('Lunch for everyone')).toBeVisible();
      await expect(page2.getByText('Movie tickets')).toBeVisible();
      await expect(page2.getByText('Uber ride')).toBeVisible();

      // Check User 3's view
      await expect(page3.getByText('Lunch for everyone')).toBeVisible();
      await expect(page3.getByText('Movie tickets')).toBeVisible();
      await expect(page3.getByText('Uber ride')).toBeVisible();

      // Verify member count shows 3 users
      const memberCount1 = await page1.locator('text=/3 members?/i').first();
      await expect(memberCount1).toBeVisible();

      // Take screenshots for debugging
      await page1.screenshot({ path: 'multi-user-test-user1.png', fullPage: true });
      await page2.screenshot({ path: 'multi-user-test-user2.png', fullPage: true });
      await page3.screenshot({ path: 'multi-user-test-user3.png', fullPage: true });

    } finally {
      // Clean up contexts
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });
});
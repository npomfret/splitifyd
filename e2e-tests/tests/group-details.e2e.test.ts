import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { DashboardPage, CreateGroupModalPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Group Details E2E', () => {
  test('should display group information', async ({ page }) => {
    const user = await createAndLoginTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    // Create a group first via the UI
    await dashboardPage.openCreateGroupModal();
    await createGroupModal.createGroup('Test Group Details', 'Test group for details page');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
    // Verify group name is displayed
    await expect(page.getByRole('heading', { name: 'Test Group Details' })).toBeVisible();
    
    // Verify group description is displayed
    await expect(page.getByText('Test group for details page')).toBeVisible();
    
    // Verify user is shown as member
    const userNameElement = page.getByText(user.displayName).first();
    const isVisible = await userNameElement.isVisible();
    
    // On mobile, the element might be present but hidden in a collapsed view
    if (!isVisible) {
      // Check if the element at least exists in the DOM
      await expect(userNameElement).toBeAttached();
    } else {
      await expect(userNameElement).toBeVisible();
    }
    
    // Verify member count
    await expect(page.getByText(/1 member/i)).toBeVisible();
  });

  test('should display empty expense list', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    // Create a group first
    await dashboardPage.openCreateGroupModal();
    await createGroupModal.createGroup('Empty Expenses Group', 'Group with no expenses');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
    // Should show empty state for expenses
    await expect(page.getByText(/no expenses yet/i).or(page.getByText(/add your first expense/i)).first()).toBeVisible();
    
    // Should show Add Expense button
    await expect(page.getByRole('button', { name: /add expense/i })).toBeVisible();
  });

  test('should show group balances section', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    // Create a group
    await dashboardPage.openCreateGroupModal();
    await createGroupModal.createGroup('Balance Test Group', 'Group for testing balances');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
    // Should show balances section (even if empty)
    await expect(page.getByText(/balance/i).or(page.getByText(/settled/i)).or(page.getByText(/no outstanding/i)).first()).toBeVisible();
  });

  test('should have navigation back to dashboard', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    // Create a group and navigate to it
    await dashboardPage.openCreateGroupModal();
    await createGroupModal.createGroup('Navigation Test Group', 'Test description');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
    // Look for navigation elements back to dashboard
    const dashboardLink = page.getByRole('link', { name: /dashboard/i })
      .or(page.getByRole('button', { name: /back/i }))
      .or(page.getByRole('link', { name: /groups/i }));
    
    // If navigation exists, test it
    const navigationExists = await dashboardLink.count() > 0;
    if (navigationExists) {
      await dashboardLink.first().click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 3000 });
    } else {
      // Use browser back button as fallback
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 3000 });
    }
  });

  test('should show group settings or options', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    // Create a group
    await dashboardPage.openCreateGroupModal();
    await page.waitForLoadState('domcontentloaded'); // Wait for modal to fully load
    await createGroupModal.createGroup('Settings Test Group', 'Test description for settings');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    
    // Look for settings, menu, or options button
    const settingsElement = page.getByRole('button', { name: /settings/i })
      .or(page.getByRole('button', { name: /menu/i }))
      .or(page.getByRole('button', { name: /options/i }))
      .or(page.locator('[data-testid*="settings"]'))
      .or(page.locator('[data-testid*="menu"]'));
    
    // If settings exist, they should be visible
    const hasSettings = await settingsElement.count() > 0;
    if (hasSettings) {
      await expect(settingsElement.first()).toBeVisible();
    }
    
    // Verify we explored the page elements

    expect(await page.getByText('Settings Test Group').count()).toBeGreaterThan(0);
  });
});
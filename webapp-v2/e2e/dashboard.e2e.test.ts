import { test, expect } from '@playwright/test';
import { authenticatedTest } from './fixtures/authenticated-test';
import { setupConsoleErrorListener, setupMCPDebugOnFailure, V2_URL } from './helpers';
import { createAndLoginTestUser } from './helpers/auth-utils';
import { DashboardPage, CreateGroupModalPage } from './pages';

setupMCPDebugOnFailure();

test.describe('Dashboard E2E', () => {
  test('should display user info after login', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    const user = await createAndLoginTestUser(page);
    const dashboardPage = new DashboardPage(page);
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Check user is logged in
    await expect(dashboardPage.isLoggedIn()).resolves.toBe(true);
    
    // Check user name in header
    const displayName = await dashboardPage.getUserDisplayName();
    expect(displayName).toBe(user.displayName);
    
    // Check welcome message
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
    
    expect(errors).toHaveLength(0);
  });

  authenticatedTest('should display user groups', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const errors = setupConsoleErrorListener(page);
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    await expect(page.getByText(/Your Groups|My Groups|Groups/i)).toBeVisible();
    
    const createGroupButton = page.getByRole('button', { name: /Create.*Group/i });
    await expect(createGroupButton).toBeVisible();
    
    expect(errors).toHaveLength(0);
  });

  authenticatedTest('should handle empty state', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const errors = setupConsoleErrorListener(page);
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    const emptyStateMessage = page.getByText(/no groups yet|create.*first group|get started/i);
    const createGroupButton = page.getByRole('button', { name: /Create.*Group/i });
    
    if (await emptyStateMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(createGroupButton).toBeVisible();
      await expect(createGroupButton).toBeEnabled();
    }
    
    expect(errors).toHaveLength(0);
  });

  test('should navigate to dashboard after login', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(`${V2_URL}/login`);
    
    await createAndLoginTestUser(page);
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    
    expect(errors).toHaveLength(0);
  });

  authenticatedTest('should show navigation elements', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const errors = setupConsoleErrorListener(page);
    
    const logoutButton = page.getByRole('button', { name: /Sign Out|Logout/i });
    const profileButton = page.getByRole('button', { name: /Profile|Account|User/i });
    
    const hasLogout = await logoutButton.isVisible({ timeout: 2000 }).catch(() => false);
    const hasProfile = await profileButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(hasLogout || hasProfile).toBeTruthy();
    
    expect(errors).toHaveLength(0);
  });

  test.describe('Create Group Modal', () => {
    authenticatedTest('should open create group modal', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      const errors = setupConsoleErrorListener(page);
      
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      await expect(createGroupModal.isOpen()).resolves.toBe(true);
      await expect(page.getByText(/Create.*New.*Group|New Group/i)).toBeVisible();
      
      // Check form fields are visible
      await expect(page.getByPlaceholder(/e\.g\., Apartment Expenses/i)).toBeVisible();
      await expect(page.getByPlaceholder(/Add any details/i)).toBeVisible();
      
      expect(errors).toHaveLength(0);
    });

    authenticatedTest('should create a new group', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      const errors = setupConsoleErrorListener(page);
      
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      await page.waitForTimeout(500);
      
      await createGroupModal.createGroup('Test Group', 'Test Description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      await expect(page.getByText('Test Group')).toBeVisible();
      
      expect(errors).toHaveLength(0);
    });

    authenticatedTest('should close modal on cancel', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      const errors = setupConsoleErrorListener(page);
      
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      await expect(createGroupModal.isOpen()).resolves.toBe(true);
      
      await createGroupModal.cancel();
      
      await createGroupModal.waitForModalToClose();
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      expect(errors).toHaveLength(0);
    });

    authenticatedTest('should validate group name is required', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      const errors = setupConsoleErrorListener(page);
      
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.openCreateGroupModal();
      
      const submitButton = page.getByRole('button', { name: 'Create Group' }).last();
      
      await expect(submitButton).toBeDisabled();
      
      const nameInput = page.getByPlaceholder(/e\.g\., Apartment Expenses/i);
      await nameInput.fill('Test');
      
      await expect(submitButton).toBeEnabled();
      
      expect(errors).toHaveLength(0);
    });
  });

  test.describe('Dashboard Navigation', () => {
    authenticatedTest('should navigate to group details after creating a group', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      const errors = setupConsoleErrorListener(page);

      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);

      // Create a group via UI first
      await dashboardPage.openCreateGroupModal();
      
      await page.waitForTimeout(500);
      
      await createGroupModal.createGroup('Navigation Test Group');
      
      // Should navigate to the new group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      await expect(page.getByText('Navigation Test Group')).toBeVisible();
      
      expect(errors).toHaveLength(0);
    });

    authenticatedTest('should sign out successfully', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      const errors = setupConsoleErrorListener(page);
      
      const signOutButton = page.getByRole('button', { name: /Sign Out|Logout/i });
      
      if (await signOutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await signOutButton.click();
      } else {
        const userMenu = page.getByRole('button', { name: /Profile|Account|User|Menu/i });
        await userMenu.click();
        const menuSignOut = page.getByRole('menuitem', { name: /Sign Out|Logout/i });
        await menuSignOut.click();
      }
      
      await expect(page).toHaveURL(/\/(login|home|$)/, { timeout: 3000 });
      
      await expect(page.getByRole('button', { name: /Sign In|Login/i })).toBeVisible();
      
      expect(errors).toHaveLength(0);
    });

    authenticatedTest('should return to dashboard from group page', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      const errors = setupConsoleErrorListener(page);
      
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      // Create a group via UI first, then navigate back
      await dashboardPage.openCreateGroupModal();
      
      await page.waitForTimeout(500);
      
      await createGroupModal.createGroup('Back Navigation Test');
      
      // Wait for navigation to group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Navigate back to dashboard - the UI must have a way to do this
      const backButton = page.getByRole('button', { name: /Back|Dashboard|Home/i });
      const dashboardLink = page.getByRole('link', { name: /Dashboard|Home/i });
      
      if (await backButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backButton.click();
      } else {
        await dashboardLink.click();
      }
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      expect(errors).toHaveLength(0);
    });

    authenticatedTest('should persist authentication on page reload', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      const errors = setupConsoleErrorListener(page);
      const dashboardPage = new DashboardPage(page);
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      await page.reload();
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Check user name is still displayed after reload
      const displayName = await dashboardPage.getUserDisplayName();
      expect(displayName).toBe(authenticatedPage.user.displayName);
      
      expect(errors).toHaveLength(0);
    });
  });
});
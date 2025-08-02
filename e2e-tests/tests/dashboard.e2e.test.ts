import { test, expect } from '../fixtures/base-test';
import { authenticatedTest } from '../fixtures/authenticated-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, EMULATOR_URL } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { DashboardPage, CreateGroupModalPage } from '../pages';

setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Dashboard E2E', () => {
  test('should display user info after login', async ({ page }) => {
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
  });

  authenticatedTest('should display user groups', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    await expect(page.getByRole('heading', { name: /Your Groups|My Groups/i })).toBeVisible();
    
    const createGroupButton = page.getByRole('button', { name: 'Create Group' }).or(page.getByRole('button', { name: 'Create Your First Group' }));
    await expect(createGroupButton.first()).toBeVisible();
    
  });

  authenticatedTest('should handle empty state', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    const emptyStateMessage = page.getByText(/no groups yet|create.*first group|get started/i);
    const createGroupButton = page.getByRole('button', { name: /Create.*Group/i });
    
    if (await emptyStateMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(createGroupButton).toBeVisible();
      await expect(createGroupButton).toBeEnabled();
    }
    
  });

  test('should navigate to dashboard after login', async ({ page }) => {
    
    await page.goto(`${EMULATOR_URL}/login`);
    
    await createAndLoginTestUser(page);
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    
  });

  authenticatedTest('should show navigation elements', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    // Check for various navigation elements that indicate user is logged in
    const logoutButton = page.getByRole('button', { name: /Sign Out|Logout/i });
    const profileButton = page.getByRole('button', { name: /Profile|Account|User/i });
    // On mobile, might just show user avatar/initial
    const userAvatar = page.getByRole('button', { name: /^[A-Z]$/ }); // Single letter avatar
    
    const hasLogout = await logoutButton.isVisible({ timeout: 2000 }).catch(() => false);
    const hasProfile = await profileButton.isVisible({ timeout: 2000 }).catch(() => false);
    const hasAvatar = await userAvatar.isVisible({ timeout: 2000 }).catch(() => false);
    
    // At least one navigation element should be visible
    expect(hasLogout || hasProfile || hasAvatar).toBeTruthy();
    
  });

  test.describe('Create Group Modal', () => {
    authenticatedTest('should open create group modal', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      await expect(createGroupModal.isOpen()).resolves.toBe(true);
      await expect(page.getByText(/Create.*New.*Group|New Group/i)).toBeVisible();
      
      // Check form fields are visible
      // Verify form fields are visible using proper selectors
      await expect(page.getByLabel('Group Name*')).toBeVisible();
      await expect(page.getByPlaceholder(/Add any details/i)).toBeVisible();
      
      });

    authenticatedTest('should create a new group', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      await page.waitForLoadState('domcontentloaded');
      
      await createGroupModal.createGroup('Test Group', 'Test Description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      await expect(page.getByText('Test Group')).toBeVisible();
    });

    authenticatedTest('should close modal on cancel', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      await expect(createGroupModal.isOpen()).resolves.toBe(true);
      
      await createGroupModal.cancel();
      
      await createGroupModal.waitForModalToClose();
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      });

    authenticatedTest('should validate group form fields', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      // Wait for modal to be ready
      await expect(createGroupModal.isOpen()).resolves.toBe(true);
      
      // Use proper modal selector for the submit button
      const modalElement = page.locator('.fixed.inset-0').filter({ has: page.getByText('Create New Group') });
      const submitButton = modalElement.getByRole('button', { name: 'Create Group' });
      
      // Button should be disabled initially (empty form)
      await expect(submitButton).toBeDisabled();
      
      // Fill in only one character - should still be disabled
      const nameInput = page.getByLabel('Group Name*');
      await nameInput.click();
      await nameInput.type('T');
      await page.keyboard.press('Tab'); // Trigger blur event
      await page.waitForLoadState('domcontentloaded');
      
      // Button should still be disabled (name too short - needs at least 2 chars)
      await expect(submitButton).toBeDisabled();
      
      // Fill in valid name (at least 2 characters)
      await nameInput.clear();
      await nameInput.type('Test Group');
      await page.keyboard.press('Tab'); // Trigger blur event
      await page.waitForLoadState('domcontentloaded');
      
      // Now button should be enabled (description is optional)
      await expect(submitButton).toBeEnabled();
      
      });
  });

  test.describe('Dashboard Navigation', () => {
    authenticatedTest('should navigate to group details after creating a group', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
  
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);

      // Create a group via UI first
      await dashboardPage.openCreateGroupModal();
      
      await page.waitForLoadState('domcontentloaded');
      
      await createGroupModal.createGroup('Navigation Test Group', 'Test description');
      
      // Should navigate to the new group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      await expect(page.getByText('Navigation Test Group')).toBeVisible();
      
      });

    authenticatedTest('should sign out successfully', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      // Try direct sign out button first (desktop)
      const signOutButton = page.getByRole('button', { name: /Sign Out|Logout/i });
      
      if (await signOutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await signOutButton.click();
      } else {
        // If not visible, try clicking user menu first
        // On mobile, this might be just a single letter avatar
        const userMenuOptions = [
          page.getByRole('button', { name: /Profile|Account|User|Menu/i }),
          page.getByRole('button', { name: /^[A-Z]$/ }) // Single letter avatar
        ];
        
        let menuClicked = false;
        for (const menu of userMenuOptions) {
          if (await menu.isVisible({ timeout: 1000 }).catch(() => false)) {
            await menu.click();
            menuClicked = true;
            break;
          }
        }
        
        if (menuClicked) {
          // Wait for menu to open and click sign out button
          const menuSignOut = page.getByRole('button', { name: /Sign Out|Logout/i });
          await menuSignOut.click();
        }
      }
      
      await expect(page).toHaveURL(/\/(login|home|$)/, { timeout: 3000 });
      
      await expect(page.getByRole('button', { name: /Sign In|Login/i })).toBeVisible();
      
      });

    authenticatedTest('should return to dashboard from group page', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      // Create a group via UI first, then navigate back
      await dashboardPage.openCreateGroupModal();
      
      await page.waitForLoadState('domcontentloaded');
      
      await createGroupModal.createGroup('Back Navigation Test', 'Test description');
      
      // Wait for navigation to group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Navigate back to dashboard using browser back button since UI navigation may not exist yet
      await page.goBack();
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      });

    authenticatedTest('should persist authentication on page reload', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      await page.reload();
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Check user name is still displayed after reload
      const displayName = await dashboardPage.getUserDisplayName();
      expect(displayName).toBe(authenticatedPage.user.displayName);
      
      });
  });
});
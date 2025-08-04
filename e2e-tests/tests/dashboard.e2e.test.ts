import { test, expect } from '../fixtures/base-test';
import { authenticatedTest } from '../fixtures/authenticated-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, EMULATOR_URL } from '../helpers';
import { AuthenticationWorkflow } from '../workflows/authentication.workflow';
import { DashboardPage, CreateGroupModalPage } from '../pages';

setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Dashboard E2E', () => {
  test('should display user info after login', async ({ page }) => {
    const user = await AuthenticationWorkflow.createTestUser(page);
    const dashboardPage = new DashboardPage(page);
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    await expect(dashboardPage.isLoggedIn()).resolves.toBe(true);
    
    const displayName = await dashboardPage.getUserDisplayName();
    expect(displayName).toBe(user.displayName);
    
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
  });

  authenticatedTest('should display user groups section', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    await expect(page.getByRole('heading', { name: /Your Groups|My Groups/i })).toBeVisible();
    
    const createGroupButton = page.getByRole('button', { name: /Create.*Group/i }).first();
    await expect(createGroupButton).toBeVisible();
    
  });

  authenticatedTest('should show create group button', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    const createGroupButton = page.getByRole('button', { name: /Create.*Group/i }).first();
    await expect(createGroupButton).toBeVisible();
    await expect(createGroupButton).toBeEnabled();
    
  });

  test('should navigate to dashboard after login', async ({ page }) => {
    
    await page.goto(`${EMULATOR_URL}/login`);
    
    await AuthenticationWorkflow.createTestUser(page);
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    
  });

  authenticatedTest('should show navigation elements', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    const userMenuButton = page.getByRole('button', { name: /Profile|Account|User|Menu|^[A-Z]$/i }).first();
    await expect(userMenuButton).toBeVisible();
    
  });

  test.describe('Create Group Modal', () => {
    authenticatedTest('should open create group modal', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      await expect(createGroupModal.isOpen()).resolves.toBe(true);
      await expect(page.getByText(/Create.*New.*Group|New Group/i)).toBeVisible();
      
      await expect(page.getByLabel('Group Name*')).toBeVisible();
      await expect(page.getByPlaceholder(/Add any details/i)).toBeVisible();
      
      });

    authenticatedTest('should create a new group', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      const dashboardPage = new DashboardPage(page);
      const groupId = await dashboardPage.createGroupAndNavigate('Test Group', 'Test Description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      await expect(page.getByRole('heading', { name: 'Test Group' })).toBeVisible();
      expect(groupId).toBeTruthy();
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
      
      await expect(createGroupModal.isOpen()).resolves.toBe(true);
      
      const modalElement = page.locator('.fixed.inset-0').filter({ has: page.getByText('Create New Group') });
      const submitButton = modalElement.getByRole('button', { name: 'Create Group' });
      
      await expect(submitButton).toBeDisabled();
      
      const nameInput = page.getByLabel('Group Name*');
      await nameInput.click();
      await nameInput.type('T');
      await page.keyboard.press('Tab');
      await page.waitForLoadState('domcontentloaded');
      
      await expect(submitButton).toBeDisabled();
      
      await nameInput.clear();
      await nameInput.type('Test Group');
      await page.keyboard.press('Tab');
      await page.waitForLoadState('domcontentloaded');
      
      await expect(submitButton).toBeEnabled();
      
      });
  });

  test.describe('Dashboard Navigation', () => {
    authenticatedTest('should navigate to group details after creating a group', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
  
      const dashboardPage = new DashboardPage(page);
      const groupId = await dashboardPage.createGroupAndNavigate('Navigation Test Group', 'Test description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
      await expect(page.getByText('Navigation Test Group')).toBeVisible();
      expect(groupId).toBeTruthy();
      
      });

    authenticatedTest('should sign out successfully', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const userMenu = page.getByRole('button', { name: /Profile|Account|User|Menu|^[A-Z]$/i }).first();
      await userMenu.click();
      
      const signOutButton = page.getByRole('button', { name: /Sign Out|Logout/i });
      await signOutButton.click();
      
      await expect(page).toHaveURL(/\/login/);
      
      await expect(page.getByRole('button', { name: /Sign In|Login/i })).toBeVisible();
      
      });

    authenticatedTest('should return to dashboard from group page', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const dashboardPage = new DashboardPage(page);
      const groupId = await dashboardPage.createGroupAndNavigate('Back Navigation Test', 'Test description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
      
      await page.goBack();
      
      await expect(page).toHaveURL(/\/dashboard/);
      expect(groupId).toBeTruthy();
      
      });

    authenticatedTest('should persist authentication on page reload', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      await page.reload();
      
      await expect(page).toHaveURL(/\/dashboard/);
      
      const displayName = await dashboardPage.getUserDisplayName();
      expect(displayName).toBe(authenticatedPage.user.displayName);
      
      });
  });
});

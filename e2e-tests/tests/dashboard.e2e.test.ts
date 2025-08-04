import { test, expect } from '../fixtures/base-test';
import { authenticatedTest } from '../fixtures/authenticated-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { AuthenticationWorkflow } from '../workflows/authentication.workflow';
import { DashboardPage, CreateGroupModalPage, LoginPage, GroupDetailPage } from '../pages';

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
    
    await expect(dashboardPage.getWelcomeMessage()).toBeVisible();
  });

  authenticatedTest('should display user groups section', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    const dashboardPage = new DashboardPage(page);
    
    await expect(dashboardPage.getGroupsHeading()).toBeVisible();
    
    await expect(dashboardPage.getCreateGroupButton()).toBeVisible();
    
  });

  authenticatedTest('should show create group button', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    const dashboardPage = new DashboardPage(page);
    
    await expect(dashboardPage.getCreateGroupButton()).toBeVisible();
    await expect(dashboardPage.getCreateGroupButton()).toBeEnabled();
    
  });

  test('should navigate to dashboard after login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    
    await AuthenticationWorkflow.createTestUser(page);
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    
  });

  authenticatedTest('should show navigation elements', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    const dashboardPage = new DashboardPage(page);
    
    await expect(dashboardPage.getUserMenuButton()).toBeVisible();
    
  });

  test.describe('Create Group Modal', () => {
    authenticatedTest('should open create group modal', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      
      await expect(createGroupModal.isOpen()).resolves.toBe(true);
      await expect(createGroupModal.getModalTitle()).toBeVisible();
      
      await expect(createGroupModal.getGroupNameInput()).toBeVisible();
      await expect(createGroupModal.getDescriptionInput()).toBeVisible();
      
      });

    authenticatedTest('should create a new group', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      const dashboardPage = new DashboardPage(page);
      const groupId = await dashboardPage.createGroupAndNavigate('Test Group', 'Test Description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      const groupDetailPage = new GroupDetailPage(page);
      await expect(groupDetailPage.getGroupTitleByName('Test Group')).toBeVisible();
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
      
      const submitButton = createGroupModal.getSubmitButton();
      
      await expect(submitButton).toBeDisabled();
      
      const nameInput = createGroupModal.getGroupNameInput();
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
      const groupDetailPage = new GroupDetailPage(page);
      await expect(groupDetailPage.getGroupTextByName('Navigation Test Group')).toBeVisible();
      expect(groupId).toBeTruthy();
      
      });

    authenticatedTest('should sign out successfully', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
        
      const dashboardPage = new DashboardPage(page);
      
      await dashboardPage.getUserMenuButton().click();
      
      await dashboardPage.getSignOutButton().click();
      
      await expect(page).toHaveURL(/\/login/);
      
      await expect(dashboardPage.getSignInButton()).toBeVisible();
      
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

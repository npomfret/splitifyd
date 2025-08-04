import { test, expect } from '../fixtures/base-test';
import { authenticatedTest } from '../fixtures/authenticated-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { CreateGroupModalPage, GroupDetailPage, DashboardPage } from '../pages';
import { pageTest } from '../fixtures/page-fixtures';

setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Dashboard E2E', () => {
  authenticatedTest('should display dashboard with user info and groups section', async ({ authenticatedPage }) => {
    const { page, user } = authenticatedPage;
    const dashboardPage = new DashboardPage(page);
    
    // Verify navigation to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Verify user is logged in and info is displayed
    await expect(dashboardPage.isLoggedIn()).resolves.toBe(true);
    const displayName = await dashboardPage.getUserDisplayName();
    expect(displayName).toBe(user.displayName);
    await expect(dashboardPage.getWelcomeMessage()).toBeVisible();
    
    // Verify groups section is displayed
    await expect(dashboardPage.getGroupsHeading()).toBeVisible();
    
    // Verify create group button is present and enabled
    const createGroupButton = dashboardPage.getCreateGroupButton();
    await expect(createGroupButton).toBeVisible();
    await expect(createGroupButton).toBeEnabled();
  });

  authenticatedTest('should persist authentication on reload', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const dashboardPage = new DashboardPage(page);
    
    // Verify user menu is visible (indicates authenticated state)
    await expect(dashboardPage.getUserMenuButton()).toBeVisible();
    
    // Reload and verify authentication persists
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
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

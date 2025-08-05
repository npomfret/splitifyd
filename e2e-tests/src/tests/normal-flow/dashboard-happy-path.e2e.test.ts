import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

setupMCPDebugOnFailure();
setupConsoleErrorReporting();

authenticatedPageTest.describe('Dashboard E2E', () => {
  authenticatedPageTest('should display dashboard with user info and groups section', async ({ authenticatedPage, dashboardPage }) => {
    const { page, user } = authenticatedPage;
    
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

  authenticatedPageTest('should persist authentication on reload', async ({ authenticatedPage, dashboardPage }) => {
    const { page } = authenticatedPage;
    
    // Verify user menu is visible (indicates authenticated state)
    await expect(dashboardPage.getUserMenuButton()).toBeVisible();
    
    // Reload and verify authentication persists
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(dashboardPage.getUserMenuButton()).toBeVisible();
  });

  authenticatedPageTest.describe('Create Group Modal', () => {
    authenticatedPageTest('should open create group modal', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
      const { page } = authenticatedPage;
      
      await dashboardPage.openCreateGroupModal();
      
      await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
      await expect(createGroupModalPage.getModalTitle()).toBeVisible();
      
      await expect(createGroupModalPage.getGroupNameInput()).toBeVisible();
      await expect(createGroupModalPage.getDescriptionInput()).toBeVisible();
    });

    authenticatedPageTest('should create a new group', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
      const { page } = authenticatedPage;
      const groupId = await dashboardPage.createGroupAndNavigate('Test Group', 'Test Description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      await expect(groupDetailPage.getGroupTitleByName('Test Group')).toBeVisible();
      expect(groupId).toBeTruthy();
    });

    authenticatedPageTest('should close modal on cancel', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
      const { page } = authenticatedPage;
      
      await dashboardPage.openCreateGroupModal();
      
      await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
      
      await createGroupModalPage.cancel();
      
      await createGroupModalPage.waitForModalToClose();
      
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  authenticatedPageTest.describe('Dashboard Navigation', () => {
    authenticatedPageTest('should navigate to group details after creating a group', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
      const { page } = authenticatedPage;
      const groupId = await dashboardPage.createGroupAndNavigate('Navigation Test Group', 'Test description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
      await expect(groupDetailPage.getGroupTextByName('Navigation Test Group')).toBeVisible();
      expect(groupId).toBeTruthy();
      
      });

    authenticatedPageTest('should sign out successfully', async ({ authenticatedPage, dashboardPage }) => {
      const { page } = authenticatedPage;
      
      await dashboardPage.getUserMenuButton().click();
      
      await dashboardPage.getSignOutButton().click();
      
      await expect(page).toHaveURL(/\/login/);
      
      await expect(dashboardPage.getSignInButton()).toBeVisible();
      
      });

    authenticatedPageTest('should return to dashboard from group page', async ({ authenticatedPage, dashboardPage }) => {
      const { page } = authenticatedPage;
      const groupId = await dashboardPage.createGroupAndNavigate('Back Navigation Test', 'Test description');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, );
      
      await page.goBack();
      
      await expect(page).toHaveURL(/\/dashboard/);
      expect(groupId).toBeTruthy();
      
      });

  });
});
import { authenticatedPageTest, expect } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { generateTestGroupName } from '../../utils/test-helpers';

setupMCPDebugOnFailure();
setupConsoleErrorReporting();

authenticatedPageTest.describe('Dashboard User Journey', () => {
  authenticatedPageTest('should handle complete dashboard workflow with authentication persistence', async ({ authenticatedPage, dashboardPage }) => {
    const { page, user } = authenticatedPage;
    
    // Phase 1: Dashboard display and authentication verification
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(dashboardPage.isLoggedIn()).resolves.toBe(true);
    const displayName = await dashboardPage.getUserDisplayName();
    expect(displayName).toBe(user.displayName);
    await expect(dashboardPage.getWelcomeMessage()).toBeVisible();
    await expect(dashboardPage.getGroupsHeading()).toBeVisible();
    
    const createGroupButton = dashboardPage.getCreateGroupButton();
    await expect(createGroupButton).toBeVisible();
    await expect(createGroupButton).toBeEnabled();
    
    // Phase 2: Test authentication persistence on reload
    await dashboardPage.waitForUserMenu(user.displayName);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await dashboardPage.waitForUserMenu(user.displayName);
  });

  authenticatedPageTest('should handle complete group creation and navigation workflow', async ({ authenticatedPage, dashboardPage, groupDetailPage, createGroupModalPage }) => {
    const { page } = authenticatedPage;
    
    // Phase 1: Modal interaction - open, verify, cancel
    await dashboardPage.openCreateGroupModal();
    await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
    await expect(createGroupModalPage.getModalTitle()).toBeVisible();
    await expect(createGroupModalPage.getGroupNameInput()).toBeVisible();
    await expect(createGroupModalPage.getDescriptionInput()).toBeVisible();
    
    await createGroupModalPage.cancel();
    await createGroupModalPage.waitForModalToClose();
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Phase 2: Successful group creation and navigation
    const groupName = generateTestGroupName('FullWorkflow');
    const groupId = await dashboardPage.createGroupAndNavigate(groupName, 'Complete workflow test');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getGroupTitleByName(groupName)).toBeVisible();
    expect(groupId).toBeTruthy();
    
    // Phase 3: Navigation back to dashboard
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  authenticatedPageTest('should handle user session management', async ({ authenticatedPage, dashboardPage }) => {
    const { page, user } = authenticatedPage;
    
    // Test sign out functionality
    await dashboardPage.waitForUserMenu(user.displayName);
    await dashboardPage.getUserMenuButton(user.displayName).click();
    await dashboardPage.getSignOutButton().click();
    
    await expect(page).toHaveURL(/\/login/);
    await expect(dashboardPage.getSignInButton()).toBeVisible();
  });
});
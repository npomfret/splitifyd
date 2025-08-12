import { authenticatedPageTest, expect } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { generateTestGroupName } from '../../utils/test-helpers';
import { GroupWorkflow } from '../../workflows';

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
    // Welcome message only appears for first-time users (no groups)
    // Skip checking for welcome message since test user may have groups
    await expect(dashboardPage.getGroupsHeading()).toBeVisible();
    
    const createGroupButton = dashboardPage.getCreateGroupButton();
    await expect(createGroupButton).toBeVisible();
    await expect(createGroupButton).toBeEnabled();
    
    // Phase 2: Test authentication persistence on reload
    await dashboardPage.waitForUserMenu();
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await dashboardPage.waitForUserMenu();
  });

  authenticatedPageTest('should handle complete group creation and navigation workflow', async ({ authenticatedPage, dashboardPage, groupDetailPage, createGroupModalPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
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
    const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Complete workflow test');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(groupDetailPage.getGroupTitleByName(groupName)).toBeVisible();
    expect(groupId).toBeTruthy();
    
    // Phase 3: Navigation back to dashboard
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  authenticatedPageTest('should properly clear all state and prevent unauthorized access after logout', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Phase 1: Create some user data before logout to verify it gets cleared
    const groupName = generateTestGroupName('LogoutTest');
    const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Test data for logout verification');
    const groupUrl = page.url(); // Capture the protected group URL
    
    // Navigate back to dashboard and verify we have user data
    await dashboardPage.navigate();
    await dashboardPage.waitForUserMenu();
    await expect(dashboardPage.isLoggedIn()).resolves.toBe(true);
    
    // Phase 2: Perform logout
    await dashboardPage.getUserMenuButton().click();
    await dashboardPage.getSignOutButton().click();
    
    // Phase 3: Verify immediate logout effects
    await expect(page).toHaveURL(/\/login/);
    await expect(dashboardPage.getSignInButton()).toBeVisible();
    
    // Phase 4: Verify authentication state is cleared - dashboard access should redirect to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    
    // Phase 5: Verify protected group pages are inaccessible with the cached URL
    await page.goto(groupUrl);
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    
    // Phase 6: Verify that attempting to access any group URL pattern fails
    const testGroupUrls = [
      '/groups/test123',
      `/groups/${groupId}`,
      '/dashboard'
    ];
    
    for (const testUrl of testGroupUrls) {
      await page.goto(testUrl);
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    }
    
    // Phase 7: Verify browser storage is cleared
    const storageData = await page.evaluate(() => {
      return {
        localStorageKeys: Object.keys(localStorage),
        sessionStorageKeys: Object.keys(sessionStorage),
        userId: localStorage.getItem('userId'),
        authToken: localStorage.getItem('authToken')
      };
    });
    
    // Check that no user ID remains in storage
    expect(storageData.userId).toBeNull();
    expect(storageData.authToken).toBeNull();
    
    // Phase 8: Verify that page reload doesn't restore authentication state
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    
    // Phase 9: Verify no user menu is visible if we somehow get to a protected page
    // This would catch the bug where stores aren't cleared
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded' });
    
    // Wait a moment to see if any redirect happens
    await page.waitForTimeout(1000);
    
    // Should be on login page, not showing any user data
    const currentUrl = page.url();
    if (currentUrl.includes('/groups/')) {
      // This should NOT happen - if we're still on group page, check for user data
      const userMenuVisible = await page.locator('.text-sm.font-medium.text-gray-700').first().isVisible().catch(() => false);
      expect(userMenuVisible).toBe(false); // User menu should NOT be visible
      
      // Additional check: should see login/signup buttons in header
      const loginLinkVisible = await page.getByText('Login').isVisible().catch(() => false);
      const signUpLinkVisible = await page.getByText('Sign Up').isVisible().catch(() => false);
      expect(loginLinkVisible || signUpLinkVisible).toBe(true); // Should see auth links, not user menu
      
      throw new Error(`SECURITY BUG: Group page ${groupUrl} is accessible after logout with user data visible`);
    }
    
    await expect(page).toHaveURL(/\/login/);
  });
});
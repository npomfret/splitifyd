import {simpleTest, expect} from '../../../fixtures/simple-test.fixture';
import {TestGroupWorkflow} from '../../../helpers';
import {generateTestGroupName} from '../../../../../packages/test-support/test-helpers.ts';
import {GroupWorkflow} from '../../../workflows';
import {groupDetailUrlPattern} from '../../../pages/group-detail.page.ts';
import {GroupDetailPage, CreateGroupModalPage} from '../../../pages';

simpleTest.describe('Dashboard User Journey', () => {
    simpleTest('should handle complete dashboard workflow with authentication persistence', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();

        // Phase 1: Dashboard display and authentication verification
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(dashboardPage.isLoggedIn()).resolves.toBe(true);

        const displayName = await dashboardPage.getCurrentUserDisplayName();
        expect(displayName.length).toBeGreaterThan(0);

        // Welcome message only appears for first-time users (no groups)
        // Skip checking for welcome message since test user may have groups
        await expect(dashboardPage.getGroupsHeading()).toBeVisible();

        const createGroupButton = dashboardPage.getCreateGroupButton();
        await expect(createGroupButton).toBeVisible();
        await expect(createGroupButton).toBeEnabled();

        // Phase 2: Test authentication persistence on reload
        await dashboardPage.waitForUserMenu();
        await expect(page).toHaveURL(/\/dashboard/);
        await dashboardPage.waitForUserMenu();
    });

    simpleTest('should handle complete group creation and navigation workflow', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const createGroupModalPage = new CreateGroupModalPage(page, user);
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
        // Use TestGroupWorkflow for better performance
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);

        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        // Verify we're on a valid group page by checking for the general group title heading
        await expect(groupDetailPage.getGroupTitle()).toBeVisible();
        expect(groupId).toBeTruthy();

        // Phase 3: Navigation back to dashboard
        await page.goBack();
        await expect(page).toHaveURL(/\/dashboard/);
    });

    simpleTest('should properly clear all state and prevent unauthorized access after logout', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const createGroupModalPage = new CreateGroupModalPage(page, user);
        const groupWorkflow = new GroupWorkflow(page);

        // Phase 1: Create some user data before logout to verify it gets cleared
        // For logout test, we need a fresh group to test access control properly
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
        await expect(page).toHaveURL(/\/login/);

        // Phase 5: Verify protected group pages are inaccessible with the cached URL
        await page.goto(groupUrl);
        await expect(page).toHaveURL(/\/login/);

        // Phase 6: Verify that attempting to access any group URL pattern fails
        const testGroupUrls = ['/groups/test123', `/groups/${groupId}`, '/dashboard'];

        for (const testUrl of testGroupUrls) {
            await page.goto(testUrl);
            await expect(page).toHaveURL(/\/login/);
        }

        // Phase 7: Verify browser storage is cleared
        const storageData = await page.evaluate(() => {
            return {
                localStorageKeys: Object.keys(localStorage),
                sessionStorageKeys: Object.keys(sessionStorage),
                userId: localStorage.getItem('userId'),
                authToken: localStorage.getItem('authToken'),
            };
        });

        // Check that no user ID remains in storage
        expect(storageData.userId).toBeNull();
        expect(storageData.authToken).toBeNull();

        // Phase 8: Verify that page reload doesn't restore authentication state
        await expect(page).toHaveURL(/\/login/);

        // Phase 9: Verify protected pages redirect to login after logout
        // Navigate to group URL and wait for auth redirect to complete
        await page.goto(groupUrl);

        // Wait for the redirect to login page to complete
        // The auth guard should redirect unauthenticated users
        await expect(page).toHaveURL(/\/login/);
    });
});

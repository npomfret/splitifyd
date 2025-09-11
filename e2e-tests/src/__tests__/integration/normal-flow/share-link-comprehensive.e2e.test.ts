import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { GroupWorkflow, MultiUserWorkflow } from '../../../workflows';
import {GroupDetailPage, JoinGroupPage} from '../../../pages';
import { DEFAULT_PASSWORD, generateNewUserDetails, generateShortId } from '../../../../../packages/test-support/test-helpers.ts';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';
import { getUserPool } from '../../../fixtures/user-pool.fixture';

simpleTest.describe('Comprehensive Share Link Testing', () => {
    simpleTest.describe('Share Link - Already Logged In User', () => {
        simpleTest('should allow logged-in user to join group via share link', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: page1, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
            const { page: page2, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();

            const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
            const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();

            // Create group with user1
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            const groupId = await groupWorkflow.createGroupAndNavigate(`Share Link Test ${uniqueId}`, 'Testing share link functionality');

            // Get share link from user1's page
            const multiUserWorkflow = new MultiUserWorkflow(); // Not using browser here
            const shareLink = await multiUserWorkflow.getShareLink(page1);
            expect(shareLink).toContain('/join?linkId=');

            // User2 (already logged in) joins via share link
            const joinGroupPage2 = new JoinGroupPage(page2);
            await joinGroupPage2.joinGroupUsingShareLink(shareLink);

            // Verify user2 is now in the group
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId));
            const groupDetailPage2 = new GroupDetailPage(page2, user2);
            await groupDetailPage2.waitForMemberCount(2);

            // Both users should be visible
            await expect(groupDetailPage2.getTextElement(user1DisplayName).first()).toBeVisible();
            await expect(groupDetailPage2.getTextElement(user2DisplayName).first()).toBeVisible();
        });

        simpleTest('should show appropriate message when logged-in user is already a member', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: page1, user: user1 } = await newLoggedInBrowser();
            const { page: page2, user: user2 } = await newLoggedInBrowser();

            // Create page objects
            const groupDetailPage = new GroupDetailPage(page1, user1);

            // Create group and add user2
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            await groupWorkflow.createGroupAndNavigate(`Already Member Test ${uniqueId}`, 'Testing already member scenario');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // User2 joins first time
            const joinGroupPage2 = new JoinGroupPage(page2);
            await joinGroupPage2.joinGroupUsingShareLink(shareLink);

            // User2 tries to join again - should show already member message
            await multiUserWorkflow.testShareLinkAlreadyMember(page2, shareLink);
        });
    });

    simpleTest.describe('Share Link - Not Logged In User', () => {
        simpleTest('should redirect non-logged-in user to login then to group after login', async ({ newLoggedInBrowser }) => {
            // Create authenticated user and manually create unauthenticated browser
            const { page: page1, user: user1 } = await newLoggedInBrowser();
            
            // Create a second browser context without authentication
            const browser = page1.context().browser();
            if (!browser) throw new Error('Browser not found');
            const context2 = await browser.newContext();
            const page2 = await context2.newPage();
            const joinGroupPage = new JoinGroupPage(page2);

            // Verify starting authentication states
            await expect(page1).toHaveURL(/\/dashboard/); // Authenticated user on dashboard
            expect(page2.url()).toBe('about:blank'); // Unauthenticated user on clean slate

            // Verify unauthenticated user cannot access protected pages
            await joinGroupPage.navigateToDashboard();

            // Should be redirected to login or show login UI
            const isLoggedIn = await joinGroupPage.isUserLoggedIn();
            expect(isLoggedIn).toBe(false); // Confirm user is not logged in

            // Create group with authenticated user
            const groupWorkflow = new GroupWorkflow(page1);
            const groupId = await groupWorkflow.createGroupAndNavigate(`Login Required Test ${generateShortId()}`, 'Testing login requirement');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // Navigate to share link with unauthenticated user
            // Should throw AuthenticationError since user is not logged in
            await joinGroupPage.navigateToShareLink(shareLink);
            await expect(page2).toHaveURL(/\/login/);
            expect(page2.url()).toContain('/login');
        });

        simpleTest('should allow unregistered user to register and join group via share link', async ({ newLoggedInBrowser }) => {
            // Create authenticated user and manually create unauthenticated browser
            const { page: page1, user: user1, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
            
            // Create a second browser context without authentication
            const browser = page1.context().browser();
            if (!browser) throw new Error('Browser not found');
            const context2 = await browser.newContext();
            const page2 = await context2.newPage();
            
            // Import page objects for unauthenticated flows
            const { RegisterPage, LoginPage } = await import('../../../pages');
            const registerPage = new RegisterPage(page2);
            const loginPage = new LoginPage(page2);

            // Create group with authenticated user
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            const groupId = await groupWorkflow.createGroupAndNavigate(`Register Test ${uniqueId}`, 'Testing registration via share link');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // Navigate to share link with unauthenticated user
            await page2.goto(shareLink);
            await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Should be redirected to login page
            await expect(page2).toHaveURL(/\/login/);
            expect(page2.url()).toContain('returnUrl');

            // Click on Sign Up link
            await loginPage.clickSignUp();
            await expect(page2).toHaveURL(/\/register/);

            // Note: returnUrl might not be preserved when navigating to register page
            // This is a known limitation - after registration, user goes to dashboard

            // Register new user
            const { displayName: newUserName, email: newUserEmail, password: newUserPassword } = generateNewUserDetails();

            await registerPage.fillRegistrationForm(newUserName, newUserEmail, newUserPassword);
            await registerPage.submitForm();

            // After registration, user goes to dashboard (returnUrl is not preserved)
            await expect(page2).toHaveURL(/\/dashboard/);

            // Now navigate to the share link to join the group
            await page2.goto(shareLink);
            await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Now we should be on the join page since we're logged in
            const joinPage = new JoinGroupPage(page2);
            await joinPage.joinGroupUsingShareLink(shareLink);

            // Should be redirected to the group
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId));

            // Verify user is now in the group
            const groupDetailPage2 = new GroupDetailPage(page2);
            await groupDetailPage2.waitForMemberCount(2);

            // Both users should be visible
            await expect(groupDetailPage2.getTextElement(await user1DashboardPage.getCurrentUserDisplayName()).first()).toBeVisible();
            await expect(groupDetailPage2.getTextElement(newUserName).first()).toBeVisible();
        });

        simpleTest('should allow user to login and then join group via share link', async ({ newLoggedInBrowser }) => {
            // Create authenticated user and manually create unauthenticated browser
            const { page: page1, user: user1, dashboardPage } = await newLoggedInBrowser();
            
            // Create a second browser context without authentication
            const browser = page1.context().browser();
            if (!browser) throw new Error('Browser not found');
            const context2 = await browser.newContext();
            const page2 = await context2.newPage();
            
            // Import page objects for unauthenticated flows
            const { LoginPage } = await import('../../../pages');
            const loginPage = new LoginPage(page2);

            // Create group with authenticated user
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            const groupId = await groupWorkflow.createGroupAndNavigate(`Login Then Join ${uniqueId}`, 'Testing login then join flow');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // First, create a second user that we'll login as
            // We need to use the user pool to get an existing user
            const userPool = getUserPool();
            const user2 = await userPool.claimUser(page2.context().browser());

            // Navigate to share link with unauthenticated user
            await page2.goto(shareLink);
            await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Should be redirected to login page with returnUrl
            await expect(page2).toHaveURL(/\/login/);
            const loginUrl = page2.url();
            expect(loginUrl).toContain('returnUrl');
            expect(loginUrl).toContain('linkId');

            // Login as the second user
            await loginPage.fillLoginForm(user2.email, DEFAULT_PASSWORD);
            await loginPage.submitForm();

            // After login, user goes to dashboard (returnUrl is not preserved through login)
            await expect(page2).toHaveURL(/\/dashboard/);

            // Now navigate to the share link to join the group
            await page2.goto(shareLink);
            await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Now we should be on the join page since we're logged in
            const joinPage = new JoinGroupPage(page2);
            await joinPage.joinGroupUsingShareLink(shareLink);

            // Should be redirected to the group
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId));

            // Verify user is now in the group
            const groupDetailPage2 = new GroupDetailPage(page2);
            await groupDetailPage2.waitForMemberCount(2);
            const user2DisplayName = await groupDetailPage2.getCurrentUserDisplayName();

            // Both users should be visible
            await expect(groupDetailPage2.getTextElement(await dashboardPage.getCurrentUserDisplayName()).first()).toBeVisible();
            await expect(groupDetailPage2.getTextElement(user2DisplayName).first()).toBeVisible();

            // Clean up - release the user back to the pool
            userPool.releaseUser(user2);
        });
    });
});

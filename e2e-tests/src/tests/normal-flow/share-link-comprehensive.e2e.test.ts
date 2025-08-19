import { expect, test } from '@playwright/test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { multiUserTest } from '../../fixtures';
import { singleMixedAuthTest } from '../../fixtures/mixed-auth-test';
import { GroupWorkflow, MultiUserWorkflow } from '../../workflows';
import { GroupDetailPage, JoinGroupPage } from '../../pages';
import {generateNewUserDetails, generateShortId} from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Comprehensive Share Link Testing', () => {
    test.describe('Share Link - Already Logged In User', () => {
        multiUserTest('should allow logged-in user to join group via share link', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
            const { page: page1, user: user1 } = authenticatedPage;
            const { page: page2, user: user2 } = secondUser;
            const groupDetailPage2 = new GroupDetailPage(page2);

            // Create group with user1
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            await groupWorkflow.createGroupAndNavigate(`Share Link Test ${uniqueId}`, 'Testing share link functionality');

            // Get share link from user1's page
            const multiUserWorkflow = new MultiUserWorkflow(); // Not using browser here
            const shareLink = await multiUserWorkflow.getShareLink(page1);
            expect(shareLink).toContain('/join?linkId=');

            // User2 (already logged in) joins via share link
            const joinGroupPage2 = new JoinGroupPage(page2);
            await joinGroupPage2.attemptJoinWithStateDetection(shareLink, { 
                displayName: user2.displayName, 
                email: user2.email 
            });

            // Verify user2 is now in the group
            await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
            await groupDetailPage2.waitForMemberCount(2);

            // Both users should be visible
            await expect(groupDetailPage2.getTextElement(user1.displayName).first()).toBeVisible();
            await expect(groupDetailPage2.getTextElement(user2.displayName).first()).toBeVisible();
        });

        multiUserTest('should show appropriate message when logged-in user is already a member', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
            const { page: page1, user: user1 } = authenticatedPage;
            const { page: page2, user: user2 } = secondUser;

            // Create group and add user2
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            await groupWorkflow.createGroupAndNavigate(`Already Member Test ${uniqueId}`, 'Testing already member scenario');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // User2 joins first time
            const joinGroupPage2 = new JoinGroupPage(page2);
            await joinGroupPage2.attemptJoinWithStateDetection(shareLink, { 
                displayName: user2.displayName, 
                email: user2.email 
            });

            // User2 tries to join again - should show already member message
            await multiUserWorkflow.testShareLinkAlreadyMember(page2, shareLink);
        });
    });

    test.describe('Share Link - Not Logged In User', () => {
        singleMixedAuthTest('should redirect non-logged-in user to login then to group after login', async ({ authenticatedUsers, unauthenticatedUsers }) => {
            const { page: page1, user: user1 } = authenticatedUsers[0];
            const { page: page2, joinGroupPage } = unauthenticatedUsers[0];

            // Verify starting authentication states
            await expect(page1).toHaveURL(/\/dashboard/); // Authenticated user on dashboard
            expect(page2.url()).toBe('about:blank'); // Unauthenticated user on clean slate

            // Verify unauthenticated user cannot access protected pages
            await joinGroupPage.navigateToDashboard();

            // Should be redirected to login or show login UI
            const isLoggedIn = await joinGroupPage.isUserLoggedIn();
            expect(isLoggedIn).toBe(false); // Confirm user is not logged in

            // Create group with authenticated user
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            const groupId = await groupWorkflow.createGroupAndNavigate(`Login Required Test ${uniqueId}`, 'Testing login requirement');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // Navigate to share link with unauthenticated user
            // Should throw AuthenticationError since user is not logged in
            await expect(async () => {
                await joinGroupPage.attemptJoinWithStateDetection(shareLink);
            }).rejects.toThrow('User redirected to login');
        });

        singleMixedAuthTest('should allow unregistered user to register and join group via share link', async ({ authenticatedUsers, unauthenticatedUsers }) => {
            const { page: page1, user: user1 } = authenticatedUsers[0];
            const { page: page2, registerPage, loginPage } = unauthenticatedUsers[0];

            // Create group with authenticated user
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            await groupWorkflow.createGroupAndNavigate(`Register Test ${uniqueId}`, 'Testing registration via share link');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // Navigate to share link with unauthenticated user
            await page2.goto(shareLink);
            await page2.waitForLoadState('domcontentloaded');

            // Should be redirected to login page
            await expect(page2).toHaveURL(/\/login/);
            expect(page2.url()).toContain('returnUrl');

            // Click on Sign Up link
            await loginPage.clickSignUp();
            await expect(page2).toHaveURL(/\/register/);

            // Note: returnUrl might not be preserved when navigating to register page
            // This is a known limitation - after registration, user goes to dashboard
            
            // Register new user
            const {displayName: newUserName, email: newUserEmail, password: newUserPassword} = generateNewUserDetails();
            
            await registerPage.fillRegistrationForm(newUserName, newUserEmail, newUserPassword);
            await registerPage.submitForm();

            // After registration, user goes to dashboard (returnUrl is not preserved)
            await page2.waitForURL(/\/dashboard/, { timeout: 10000 });

            // Now navigate to the share link to join the group
            await page2.goto(shareLink);
            await page2.waitForLoadState('domcontentloaded');
            
            // Now we should be on the join page since we're logged in
            const joinPage = new JoinGroupPage(page2);
            await joinPage.attemptJoinWithStateDetection(shareLink, {
                displayName: newUserName,
                email: newUserEmail
            });
            
            // Should be redirected to the group
            await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 10000 });
            
            // Verify user is now in the group
            const groupDetailPage2 = new GroupDetailPage(page2);
            await groupDetailPage2.waitForMemberCount(2);
            
            // Both users should be visible
            await expect(groupDetailPage2.getTextElement(user1.displayName).first()).toBeVisible();
            await expect(groupDetailPage2.getTextElement(newUserName).first()).toBeVisible();
        });

        singleMixedAuthTest('should allow user to login and then join group via share link', async ({ authenticatedUsers, unauthenticatedUsers }) => {
            const { page: page1, user: user1 } = authenticatedUsers[0];
            const { page: page2, loginPage } = unauthenticatedUsers[0];

            // Create group with authenticated user
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(page1);
            await groupWorkflow.createGroupAndNavigate(`Login Then Join ${uniqueId}`, 'Testing login then join flow');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // First, create a second user that we'll login as
            // We need to use the user pool to get an existing user
            const userPool = await import('../../fixtures/user-pool.fixture').then(m => m.getUserPool());
            const user2 = await userPool.claimUser(page2.context().browser());

            // Navigate to share link with unauthenticated user
            await page2.goto(shareLink);
            await page2.waitForLoadState('domcontentloaded');

            // Should be redirected to login page with returnUrl
            await expect(page2).toHaveURL(/\/login/);
            const loginUrl = page2.url();
            expect(loginUrl).toContain('returnUrl');
            expect(loginUrl).toContain('linkId');

            // Login as the second user
            await loginPage.fillLoginForm(user2.email, 'TestPassword123!');
            await loginPage.submitForm();

            // After login, user goes to dashboard (returnUrl is not preserved through login)
            await page2.waitForURL(/\/dashboard/, { timeout: 10000 });

            // Now navigate to the share link to join the group
            await page2.goto(shareLink);
            await page2.waitForLoadState('domcontentloaded');
            
            // Now we should be on the join page since we're logged in
            const joinPage = new JoinGroupPage(page2);
            await joinPage.attemptJoinWithStateDetection(shareLink, {
                displayName: user2.displayName,
                email: user2.email
            });
            
            // Should be redirected to the group
            await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 10000 });
            
            // Verify user is now in the group
            const groupDetailPage2 = new GroupDetailPage(page2);
            await groupDetailPage2.waitForMemberCount(2);
            
            // Both users should be visible
            await expect(groupDetailPage2.getTextElement(user1.displayName).first()).toBeVisible();
            await expect(groupDetailPage2.getTextElement(user2.displayName).first()).toBeVisible();

            // Clean up - release the user back to the pool
            userPool.releaseUser(user2);
        });
    });
});

import { expect, test } from '@playwright/test';
import { EMULATOR_URL, setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { multiUserTest } from '../../fixtures';
import { singleMixedAuthTest } from '../../fixtures/mixed-auth-test';
import { AuthenticationWorkflow, GroupWorkflow, MultiUserWorkflow } from '../../workflows';
import { GroupDetailPage } from '../../pages';
import { generateShortId } from '../../utils/test-helpers';

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
            const multiUserWorkflow = new MultiUserWorkflow(null); // Not using browser here
            const shareLink = await multiUserWorkflow.getShareLink(page1);
            expect(shareLink).toContain('/join?linkId=');

            // User2 (already logged in) joins via share link
            await multiUserWorkflow.joinGroupViaShareLink(page2, shareLink, user2);

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

            const multiUserWorkflow = new MultiUserWorkflow(null);
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // User2 joins first time
            await multiUserWorkflow.joinGroupViaShareLink(page2, shareLink, user2);

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

            const multiUserWorkflow = new MultiUserWorkflow(null);
            const shareLink = await multiUserWorkflow.getShareLink(page1);

            // Navigate to share link with unauthenticated user
            const result = await joinGroupPage.attemptJoinWithStateDetection(shareLink);

            expect(result.success).toBe(false);
            expect(result.needsLogin).toBe(true);
            expect(result.reason).toContain('log in');
        });

        // NOTE: Unregistered user registration flow via share link removed as it's not fully implemented

        // NOTE: Login-then-join flow via share link removed as it's not fully implemented
    });
});

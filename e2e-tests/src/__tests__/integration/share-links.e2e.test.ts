import { simpleTest, expect } from '../../fixtures';
import { GroupDetailPage, JoinGroupPage } from '../../pages';
import { generateNewUserDetails, generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page';
import { getUserPool } from '../../fixtures/user-pool.fixture';

simpleTest.describe('Comprehensive Share Link Testing', () => {
    simpleTest.describe('Share Link - Already Logged In User', () => {
        // the 'normal' happy path is tested over and over again indirectly by the other tests

        simpleTest('should show appropriate message when logged-in user is already a member', async ({ createLoggedInBrowsers }) => {
            // Create two browser instances - User 1 and User 2
            const [{ dashboardPage: user1DashboardPage }, { page: page2 }] = await createLoggedInBrowsers(2);

            const groupName = generateTestGroupName(`ShareLink`);
            const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({
                name: groupName,
                description: 'Testing already member scenario',
            });
            const groupId = groupDetailPage.inferGroupId();
            const shareLink = await groupDetailPage.getShareLink();

            // User2 joins first time
            const user2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(page2, shareLink, groupId);
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId));
            await user2GroupDetailPage.waitForPage(groupId, 2);
            const user2Dashboard = await user2GroupDetailPage.navigateToDashboard();
            await user2Dashboard.waitForDashboard();
            await user2Dashboard.waitForGroupToAppear(groupName);

            // User2 tries to join again - join group button should be missing and OK button should be present
            const joinGroupPage = new JoinGroupPage(page2);
            await joinGroupPage.navigateToShareLink(shareLink);
            await joinGroupPage.assertJoinGroupButtonIsMissing();
            await joinGroupPage.assertAlreadyMemberTextIsVisible();
            await joinGroupPage.clickOkButton();
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId));
        });
    });

    simpleTest.describe('Share Link - Not Logged In User', () => {
        simpleTest('should redirect non-logged-in user to login then to group after login', async ({ createLoggedInBrowsers, newEmptyBrowser }) => {
            // Create authenticated user to set up the group
            const [{ dashboardPage: ownerDashboardPage }] = await createLoggedInBrowsers(1);

            // Create unauthenticated browser
            const { page: unauthPage, loginPage } = await newEmptyBrowser();

            // Create group with authenticated user
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup({});
            const groupId = groupDetailPage.inferGroupId();
            const groupName = await groupDetailPage.getGroupName();

            // Get share link from the group
            const shareLink = await groupDetailPage.getShareLink();

            // Navigate to share link with unauthenticated user - should redirect to login
            const joinGroupPage = new JoinGroupPage(unauthPage);
            await joinGroupPage.navigateToShareLink(shareLink);
            await expect(unauthPage).toHaveURL(/\/login/);

            // Get a second user to login with (but use the unauthenticated page)
            const secondUser = await getUserPool().claimUser(unauthPage);
            await loginPage.login(secondUser.email, secondUser.password);

            // After successful login, user should be redirected to the join group page
            // The redirect should preserve the share link token
            await expect(unauthPage).toHaveURL(/\/join\?linkId=/);
            expect(unauthPage.url()).toContain('/join?linkId=');

            // Verify user can see the group details on the join page
            await expect(unauthPage.getByRole('heading', { name: groupName, level: 2 })).toBeVisible();

            // Complete the join process
            await joinGroupPage.joinGroupUsingShareLink(shareLink);

            // Verify user successfully joined and is now on the group detail page
            await expect(unauthPage).toHaveURL(new RegExp(`/groups/${groupId}`));

            // Clean up the claimed user
            await getUserPool().releaseUser(secondUser);
        });

        simpleTest('should allow unregistered user to register and join group via share link', async ({ createLoggedInBrowsers, newEmptyBrowser }) => {
            // Create authenticated user to set up the group
            const [{ dashboardPage: ownerDashboardPage }] = await createLoggedInBrowsers(1);

            // Create unauthenticated browser
            const { page: unauthPage, loginPage } = await newEmptyBrowser();

            // Create group with authenticated user
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup({});
            const groupId = groupDetailPage.inferGroupId();

            // Get share link from the group
            const shareLink = await groupDetailPage.getShareLink();

            // Navigate to share link with unauthenticated user
            await unauthPage.goto(shareLink);
            await unauthPage.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Should be redirected to login page
            await expect(unauthPage).toHaveURL(/\/login/);
            expect(unauthPage.url()).toContain('returnUrl');

            // Click on Sign Up link to go to registration
            const registerPage = await loginPage.clickSignUp();

            // Register new user
            const { displayName: newUserName, email: newUserEmail, password: newUserPassword } = generateNewUserDetails();
            await registerPage.fillRegistrationForm(newUserName, newUserEmail, newUserPassword);
            await registerPage.submitForm();

            // After successful registration, user should be redirected to the join group page
            // The returnUrl should be preserved through the registration flow
            await expect(unauthPage).toHaveURL(/\/join\?linkId=/);
            expect(unauthPage.url()).toContain('/join?linkId=');

            // User should now see the join group page and can join directly
            const joinPage = new JoinGroupPage(unauthPage);
            await joinPage.clickJoinGroupAndWaitForJoin();

            // Should be redirected to the group
            await expect(unauthPage).toHaveURL(groupDetailUrlPattern(groupId));

            // Verify user is now in the group
            const newUserGroupDetailPage = new GroupDetailPage(unauthPage);
            await newUserGroupDetailPage.waitForMemberCount(2);

            // Both users should be visible - the owner and the new registered user
            await expect(unauthPage.getByText(newUserName).first()).toBeVisible();
        });

        simpleTest('should allow user to login and then join group via share link', async ({ createLoggedInBrowsers, newEmptyBrowser }) => {
            // Create authenticated user to set up the group
            const [{ dashboardPage: ownerDashboardPage }] = await createLoggedInBrowsers(1);

            // Create unauthenticated browser
            const { page: unauthPage, loginPage } = await newEmptyBrowser();

            // Create group with authenticated user
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup({});
            const groupId = groupDetailPage.inferGroupId();

            // Get share link from the group
            const shareLink = await groupDetailPage.getShareLink();

            // Get a second user to login with
            const [{ user: secondUser }] = await createLoggedInBrowsers(1);

            // Navigate to share link with unauthenticated user
            await unauthPage.goto(shareLink);
            await unauthPage.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Should be redirected to login page with returnUrl
            await expect(unauthPage).toHaveURL(/\/login/);
            const loginUrl = unauthPage.url();
            expect(loginUrl).toContain('returnUrl');
            expect(loginUrl).toContain('linkId');

            // Login as the second user
            await loginPage.login(secondUser.email, secondUser.password);

            // After login, user should be redirected to the join page with linkId
            await expect(unauthPage).toHaveURL(/\/join\?linkId=/);

            // Complete the join process - we're already on the join page after login redirect
            const joinPage = new JoinGroupPage(unauthPage);
            await joinPage.clickJoinGroupAndWaitForJoin();

            // Should be redirected to the group detail page
            await expect(unauthPage).toHaveURL(groupDetailUrlPattern(groupId));

            // Verify user is now in the group
            const secondUserGroupDetailPage = new GroupDetailPage(unauthPage);
            await secondUserGroupDetailPage.waitForMemberCount(2);

            // Verify the second user is visible in the group members list
            const secondUserDisplayName = await secondUserGroupDetailPage.header.getCurrentUserDisplayName();
            await expect(unauthPage.getByText(secondUserDisplayName).first()).toBeVisible();
        });
    });

    simpleTest.describe('Share Link - Error Scenarios', () => {
        simpleTest('should handle invalid share links gracefully', { annotation: { type: 'skip-error-checking' } }, async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

            // Get the base URL from the current page
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            const baseUrl = dashboardPage.getBaseUrl();
            const invalidShareLink = `${baseUrl}/join?linkId=invalid-group-id-12345`;

            await JoinGroupPage.attemptToJoinWithInvalidShareLink(page, invalidShareLink);
        });

        simpleTest('should handle malformed share links', { annotation: { type: 'skip-error-checking' } }, async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

            // Get the base URL from the current page using page object
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            const baseUrl = dashboardPage.getBaseUrl();

            // Test various malformed links using page object navigation
            // When linkId is missing or empty, app now shows an error page (not redirect)
            const emptyLinkCases = [`${baseUrl}/join?linkId=`, `${baseUrl}/join`];

            const joinGroupPage = new JoinGroupPage(page);

            for (const link of emptyLinkCases) {
                await joinGroupPage.navigateToShareLink(link);

                expect(page.url()).toContain('/join');
                await expect(page.getByText('Invalid Link')).toBeVisible();

                const backButton = joinGroupPage.getBackToDashboardButton();
                await expect(backButton).toBeVisible();
            }

            // Test with malicious/invalid linkId - should show error
            const invalidLink = `${baseUrl}/join?linkId=../../malicious`;

            await joinGroupPage.navigateToShareLink(invalidLink);
            expect(page.url()).toContain('/join');
            await expect(page.getByText('Failed to join group')).toBeVisible();

            // Should have a button to go back to dashboard using page object method
            const backButton = joinGroupPage.getBackToDashboardButton();
            await expect(backButton).toBeVisible();

            // Click the button to verify navigation works using page object method
            await backButton.click();
            await joinGroupPage.expectUrl(/\/dashboard/);
        });
    });
});

import {MultiUserWorkflow} from '../../workflows';
import {simpleTest, expect} from '../../fixtures';
import {GroupDetailPage, JoinGroupPage, RegisterPage} from '../../pages';
import {generateNewUserDetails, generateShortId, generateTestGroupName} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page.ts';

simpleTest.describe('Comprehensive Share Link Testing', () => {
    simpleTest.describe('Share Link - Already Logged In User', () => {
        simpleTest('should allow logged-in user to join group via share link', async ({newLoggedInBrowser}) => {
            // Create two browser instances - User 1 and User 2
            const {page: page1, dashboardPage: user1DashboardPage, user: user1} = await newLoggedInBrowser();
            const {page: page2, dashboardPage: user2DashboardPage, user: user2} = await newLoggedInBrowser();

            const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
            const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();

            // Create group with user1
            const uniqueId = generateShortId();
            const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(`Share Link Test ${uniqueId}`, 'Testing share link functionality');
            const groupId = groupDetailPage.inferGroupId();

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

        simpleTest('should show appropriate message when logged-in user is already a member', async ({newLoggedInBrowser}) => {
            // Create two browser instances - User 1 and User 2
            const {page: page1, user: user1, dashboardPage: user1DashboardPage} = await newLoggedInBrowser();
            const {page: page2, user: user2} = await newLoggedInBrowser();

            // Create page objects

            // Create group and add user2
            const uniqueId = generateShortId();
            const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName("ShareLink"), "Test group for share links");
            const groupId = groupDetailPage.inferGroupId();
            await user1DashboardPage.createGroupAndNavigate(`Already Member Test ${uniqueId}`, 'Testing already member scenario');

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
        simpleTest('should redirect non-logged-in user to login then to group after login', async ({newLoggedInBrowser, newEmptyBrowser}) => {
            // Create authenticated user to set up the group
            const {page: ownerPage, dashboardPage: ownerDashboardPage} = await newLoggedInBrowser();
            
            // Create unauthenticated browser
            const {page: unauthPage, loginPage} = await newEmptyBrowser();

            // Create group with authenticated user
            const groupName = generateTestGroupName('Login Required Test');
            const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing login requirement');
            const groupId = groupDetailPage.inferGroupId();

            // Get share link from the group
            const shareLink = await groupDetailPage.getShareLink();

            // Navigate to share link with unauthenticated user - should redirect to login
            const joinGroupPage = new JoinGroupPage(unauthPage);
            await joinGroupPage.navigateToShareLink(shareLink);
            await expect(unauthPage).toHaveURL(/\/login/);

            // Get a second user to login with (but use the unauthenticated page)
            const {user: secondUser} = await newLoggedInBrowser();
            await loginPage.login(secondUser.email, secondUser.password);
            
            // After successful login, user should be redirected to the join group page
            // The redirect should preserve the share link token
            await expect(unauthPage).toHaveURL(/\/join\?linkId=/);
            expect(unauthPage.url()).toContain('/join?linkId=');
            
            // Verify user can see the group details on the join page
            await expect(unauthPage.getByText(groupName)).toBeVisible();
            
            // Complete the join process
            await joinGroupPage.joinGroupUsingShareLink(shareLink);
            
            // Verify user successfully joined and is now on the group detail page
            await expect(unauthPage).toHaveURL(new RegExp(`/groups/${groupId}`));
        });

        simpleTest('should allow unregistered user to register and join group via share link', async ({newLoggedInBrowser, newEmptyBrowser}) => {
            // Create authenticated user to set up the group
            const {dashboardPage: ownerDashboardPage} = await newLoggedInBrowser();

            // Create unauthenticated browser
            const {page: unauthPage, loginPage} = await newEmptyBrowser();

            // Create group with authenticated user
            const groupName = generateTestGroupName('Register Test');
            const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing registration via share link');
            const groupId = groupDetailPage.inferGroupId();

            // Get share link from the group
            const shareLink = await groupDetailPage.getShareLink();

            // Navigate to share link with unauthenticated user
            await unauthPage.goto(shareLink);
            await unauthPage.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Should be redirected to login page
            await expect(unauthPage).toHaveURL(/\/login/);
            expect(unauthPage.url()).toContain('returnUrl');

            // Click on Sign Up link to go to registration
            const registerPage = await loginPage.clickSignUp();

            // Register new user
            const {displayName: newUserName, email: newUserEmail, password: newUserPassword} = generateNewUserDetails();
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

        simpleTest('should allow user to login and then join group via share link', async ({newLoggedInBrowser, newEmptyBrowser}) => {
            // Create authenticated user to set up the group
            const {dashboardPage: ownerDashboardPage} = await newLoggedInBrowser();

            // Create unauthenticated browser
            const {page: unauthPage, loginPage} = await newEmptyBrowser();

            // Create group with authenticated user
            const groupName = generateTestGroupName('Login Then Join');
            const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing login then join flow');
            const groupId = groupDetailPage.inferGroupId();

            // Get share link from the group
            const shareLink = await groupDetailPage.getShareLink();

            // Get a second user to login with
            const {user: secondUser} = await newLoggedInBrowser();

            // Navigate to share link with unauthenticated user
            await unauthPage.goto(shareLink);
            await unauthPage.waitForLoadState('domcontentloaded', {timeout: 5000});

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
            const secondUserDisplayName = await secondUserGroupDetailPage.getCurrentUserDisplayName();
            await expect(unauthPage.getByText(secondUserDisplayName).first()).toBeVisible();
        });
    });

    simpleTest.describe('Share Link - Error Scenarios', () => {
        simpleTest('should handle invalid share links gracefully', {annotation: {type: 'skip-error-checking'}}, async ({newLoggedInBrowser}) => {
            const {page} = await newLoggedInBrowser();

            // Get the base URL from the current page
            await page.waitForLoadState('domcontentloaded', {timeout: 5000});
            const baseUrl = page.url().split('/dashboard')[0];
            const invalidShareLink = `${baseUrl}/join?linkId=invalid-group-id-12345`;

            const multiUserWorkflow = new MultiUserWorkflow();
            await multiUserWorkflow.testInvalidShareLink(page, invalidShareLink);
        });

        simpleTest('should handle malformed share links', {annotation: {type: 'skip-error-checking'}}, async ({newLoggedInBrowser}) => {
            const {page} = await newLoggedInBrowser();

            // Get the base URL from the current page using page object
            await page.waitForLoadState('domcontentloaded', {timeout: 5000});
            const baseUrl = page.url().split('/dashboard')[0];

            // Test various malformed links using page object navigation
            // When linkId is missing or empty, app now shows an error page (not redirect)
            const emptyLinkCases = [`${baseUrl}/join?linkId=`, `${baseUrl}/join`];

            for (const link of emptyLinkCases) {
                await page.goto(link);
                await page.waitForLoadState('domcontentloaded', {timeout: 5000});

                // Should stay on /join page and show error message
                expect(page.url()).toContain('/join');

                // Check for error message
                await expect(page.getByText('Invalid Link')).toBeVisible();
                await expect(page.getByText(/No group invitation link was provided/)).toBeVisible();

                // Should have a button to go back to dashboard
                const backButton = page.getByRole('button', {name: /Back to Dashboard/i});
                await expect(backButton).toBeVisible();
            }

            // Test with malicious/invalid linkId - should show error
            const invalidLink = `${baseUrl}/join?linkId=../../malicious`;
            const multiUserWorkflow = new MultiUserWorkflow();
            await multiUserWorkflow.testInvalidShareLink(page, invalidLink);
        });

        simpleTest('should display error messages with back navigation option', {annotation: {type: 'skip-error-checking'}}, async ({newLoggedInBrowser}) => {
            const {page} = await newLoggedInBrowser();
            const joinGroupPage = new JoinGroupPage(page);
            const groupDetailPage = new GroupDetailPage(page);

            const invalidShareLink = `${page.url().split('/dashboard')[0]}/join?linkId=invalid-specific-test`;

            // Navigate to invalid share link using page object method
            await groupDetailPage.navigateToShareLink(invalidShareLink);
            await page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // The app should show an error message for invalid links
            await expect(joinGroupPage.getErrorMessage()).toBeVisible();

            // Should show specific error message using page object method
            const errorMessage = joinGroupPage.getSpecificErrorMessage(/Invalid share link|Group not found|expired/i);
            await expect(errorMessage).toBeVisible();

            // Should have a button to go back to dashboard using page object method
            const backButton = joinGroupPage.getBackToDashboardButton();
            await expect(backButton).toBeVisible();

            // Click the button to verify navigation works using page object method
            await backButton.click();
            await joinGroupPage.expectUrl(/\/dashboard/);
        });
    });
});

import {
    ApiDriver,
    DashboardPage,
    DEFAULT_PASSWORD,
    generateTestEmail,
    generateTestUserName,
    GroupDetailPage,
    JoinGroupPage,
    LoginPage,
    PolicyAcceptanceModalPage,
    RegisterPage,
    SettingsPage,
    TestUserBuilder,
} from '@billsplit-wl/test-support';
import { expect } from '@playwright/test';
import { simpleTest } from '../../fixtures';
import { getUserPool } from '../../fixtures/user-pool.fixture';

type DashboardNavigable = SettingsPage | GroupDetailPage;

async function navigateToDashboardFromPage(pageObject: DashboardNavigable): Promise<DashboardPage> {
    await pageObject.header.navigateToDashboard();
    const dashboardPage = new DashboardPage(pageObject.page);
    await dashboardPage.waitForDashboard();
    return dashboardPage;
}

/**
 * Consolidated User Management and Access E2E Tests
 *
 * CONSOLIDATION: Merged overlapping tests from:
 * - user-management-comprehensive.e2e.test.ts (profile management, registration)
 * - policy-acceptance.e2e.test.ts (policy flows)
 * - share-links.e2e.test.ts (group sharing and access)
 *
 * This file covers all user-related functionality and access patterns:
 * - User registration and profile management
 * - Policy acceptance flows
 * - Share link access patterns
 * - Authentication and authorization
 */

simpleTest.describe('User Profile Management', () => {
    simpleTest('comprehensive profile and password management with validation and real-time updates', async ({ createLoggedInBrowsers, newEmptyBrowser }) => {
        // Create a fresh user specifically for comprehensive testing
        const { displayName, email, password } = new TestUserBuilder()
            .build();

        // Test 1: Profile viewing, updating, and real-time updates
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const settingsPage = new SettingsPage(page);

        await settingsPage.navigate();

        // Verify profile information is displayed
        const expectedDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        await settingsPage.verifyProfileInformation(expectedDisplayName, user.email);
        await settingsPage.verifyDisplayNameInputVisible();
        await settingsPage.verifySaveButtonVisible();

        // Test display name validation
        await settingsPage.fillDisplayName('');
        await settingsPage.verifyErrorMessage('Display name cannot be empty');
        await settingsPage.verifySaveButtonDisabled();

        const longName = 'A'.repeat(101);
        await settingsPage.fillDisplayName(longName);
        await settingsPage.verifyErrorMessage('Display name must be 100 characters or less');
        await settingsPage.verifySaveButtonDisabled();

        // Test successful profile update with loading states and real-time updates
        const newDisplayName = `Updated Name ${Date.now()}`;
        await settingsPage.fillDisplayName(newDisplayName);
        await settingsPage.verifySaveButtonEnabled();

        await settingsPage.clickSaveChangesButton();
        await settingsPage.verifyLoadingState('save');
        await settingsPage.waitForLoadingComplete('save');

        // Verify comprehensive real-time updates across all UI components
        await settingsPage.verifyProfileDisplayNameText(newDisplayName);
        await settingsPage.header.verifyUserMenuButtonContainsText(newDisplayName);
        await settingsPage.verifyDisplayNameInputValue(newDisplayName);

        // Verify persistence when navigating to dashboard and back
        await navigateToDashboardFromPage(settingsPage);
        await settingsPage.header.verifyUserMenuButtonContainsText(newDisplayName);
        await settingsPage.navigate();
        await settingsPage.verifyProfileEmailText(user.email);
        await settingsPage.verifyProfileDisplayNameText(newDisplayName);

        // Test 2: Password management with fresh user account
        const { page: passwordPage } = await newEmptyBrowser();
        const registerPage = new RegisterPage(passwordPage);
        await registerPage.navigate();
        await registerPage.register(displayName, email, password);

        const passwordDashboardPage = new DashboardPage(passwordPage);
        await passwordDashboardPage.waitForDashboard();

        const passwordSettingsPage = new SettingsPage(passwordPage);
        await passwordSettingsPage.navigate();

        // Test password validation
        await passwordSettingsPage.openPasswordChangeForm();
        await passwordSettingsPage.fillCurrentPassword('currentPass');
        await passwordSettingsPage.fillNewPassword('123');
        await passwordSettingsPage.fillConfirmPassword('123');
        await passwordSettingsPage.clickUpdatePasswordButton();
        await passwordSettingsPage.verifyErrorMessage('New password must be at least 12 characters long');

        // Test password mismatch
        await passwordSettingsPage.fillNewPassword('newPassword1234');
        await passwordSettingsPage.fillConfirmPassword('differentPassword');
        await passwordSettingsPage.clickUpdatePasswordButton();
        await passwordSettingsPage.verifyErrorMessage('Passwords do not match');

        // Test successful password change
        await passwordSettingsPage.cancelPasswordChange();
        await passwordSettingsPage.changePassword(password, 'newPassword1234!');
        await passwordSettingsPage.verifySuccessMessage('Password changed successfully');
        await passwordSettingsPage.verifyPasswordFormVisible(false);

        // Test password change cancellation
        await passwordSettingsPage.openPasswordChangeForm();
        await passwordSettingsPage.fillCurrentPassword('somePassword');
        await passwordSettingsPage.fillNewPassword('newPassword1234');
        await passwordSettingsPage.cancelPasswordChange();
        await passwordSettingsPage.verifyPasswordFormVisible(false);
        await passwordSettingsPage.verifyChangePasswordButtonVisible();
    });
});

simpleTest.describe('User Registration & Account Management', () => {
    simpleTest('simple happy path: register new user successfully', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);

        const email = generateTestEmail('happy-path');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('HappyPath');

        await registerPage.navigate();
        await registerPage.register(displayName, email, password);

        await expect(page).toHaveURL(/\/dashboard/);
        await registerPage.verifyUserDisplayNameVisible(displayName);
    });

    simpleTest('comprehensive registration flow with loading states, validation, and error handling', async ({ newEmptyBrowser }) => {
        simpleTest.setTimeout(30000); // Extended timeout for comprehensive test with 4 registrations
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        simpleTest.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected for duplicate registration' });

        const email = generateTestEmail('comprehensive');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Comprehensive');

        // Test 1: Successful initial registration with loading state verification
        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.fillRegistrationForm(displayName, email, password);
        await registerPage.acceptAllPolicies();

        await registerPage.verifySubmitButtonEnabled();

        await registerPage.submitForm();

        // Check for loading spinner (might be very quick)
        const spinnerVisible = await registerPage.isLoadingSpinnerVisible();
        simpleTest.info().annotations.push({
            type: 'loading-spinner',
            description: spinnerVisible ? 'Spinner was visible' : 'Registration was instant (no spinner)',
        });

        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.verifyYourGroupsHeadingVisible();

        // Log out to test duplicate registration prevention
        await dashboardPage.header.logout();

        // Test 2: Duplicate registration prevention with comprehensive error handling
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Start capturing console messages for 409 error verification
        const consoleMessages: string[] = [];
        page.on('console', (msg) => {
            consoleMessages.push(`${msg.type()}: ${msg.text()}`);
        });

        // Fill form with duplicate email
        await registerPage.fillName(displayName);
        await registerPage.fillEmail(email);
        await registerPage.fillPassword(password);
        await registerPage.fillConfirmPassword(password);
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();
        await registerPage.checkPrivacyCheckbox();
        await registerPage.checkAdminEmailsCheckbox();

        // Submit form - this will fail with duplicate email error
        await registerPage.submitForm();

        // Should stay on registration page, not redirect
        await registerPage.expectUrl(/\/register/);

        // Verify error message appears (shows error code for i18n translation)
        await registerPage.verifyErrorContainerVisible();
        await registerPage.verifyErrorMessageMatches(/already_exists/);

        // Verify error in console (ALREADY_EXISTS error code)
        const errorInConsole = consoleMessages.some((msg) => {
            const lowerMsg = msg.toLowerCase();
            // Look for ALREADY_EXISTS error code or registration failure
            return lowerMsg.includes('already_exists') || lowerMsg.includes('409') || lowerMsg.includes('registration');
        });
        expect(errorInConsole).toBe(true);

        // Test form persistence (user doesn't lose their input)
        await registerPage.verifyNameInputValue(displayName);
        await registerPage.verifyEmailInputValue(email);

        // Test 3: Recovery by changing email and additional loading state tests
        const newEmail = generateTestEmail('recovery');
        await registerPage.fillEmail(newEmail);
        await registerPage.fillPassword(password);
        await registerPage.fillConfirmPassword(password);
        await registerPage.submitForm();

        // Should succeed with different email
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // Test 4: Additional registration scenarios with different users
        await dashboardPage.header.logout();

        const email2 = generateTestEmail('additional-test');
        const displayName2 = generateTestUserName('AdditionalTest');

        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.fillRegistrationForm(displayName2, email2, password);
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    });
});

simpleTest.describe('Policy Acceptance', () => {
    simpleTest.describe('Registration Policy Acceptance', () => {
        simpleTest('should require all policy checkboxes for registration', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            const registerPage = new RegisterPage(page);
            await registerPage.navigate();

            // Verify both checkboxes and buttons are present
            await registerPage.verifyTermsCheckboxVisible();
            await registerPage.verifyCookiesCheckboxVisible();
            await registerPage.verifyPrivacyCheckboxVisible();
            await registerPage.verifyTermsButtonVisible();
            await registerPage.verifyCookiePolicyButtonVisible();
            await registerPage.verifyPrivacyPolicyButtonVisible();

            // Fill form completely
            await registerPage.fillName('Test User');
            await registerPage.fillEmail(generateTestEmail());
            await registerPage.fillPassword(DEFAULT_PASSWORD);
            await registerPage.fillConfirmPassword(DEFAULT_PASSWORD);

            // Submit should be disabled with no checkboxes
            await registerPage.verifySubmitButtonDisabled();

            // Submit should be disabled with only terms checked
            await registerPage.checkTermsCheckbox();
            await registerPage.verifySubmitButtonDisabled();

            // Submit should be disabled with only cookie policy checked
            await registerPage.uncheckTermsCheckbox();
            await registerPage.checkCookieCheckbox();
            await registerPage.verifySubmitButtonDisabled();

            // Submit should be disabled with only privacy policy checked
            await registerPage.uncheckCookieCheckbox();
            await registerPage.checkPrivacyCheckbox();
            await registerPage.verifySubmitButtonDisabled();

            // Submit should remain disabled with any two policies checked
            await registerPage.checkTermsCheckbox();
            await registerPage.verifySubmitButtonDisabled();
            await registerPage.uncheckTermsCheckbox();
            await registerPage.checkCookieCheckbox();
            await registerPage.verifySubmitButtonDisabled();

            // Submit should still be disabled with all three policies but no admin emails consent
            await registerPage.checkTermsCheckbox();
            await registerPage.verifySubmitButtonDisabled();

            // Submit should be enabled only when all policies AND admin emails consent are accepted
            await registerPage.checkAdminEmailsCheckbox();
            await registerPage.verifySubmitButtonEnabled();
        });
    });

    simpleTest.describe('Existing User Policy Updates', () => {
        simpleTest('should update each policy and accept them sequentially', async ({ browser }) => {
            const apiDriver = await ApiDriver.create();

            // Borrow a test user from the pool
            const user = await apiDriver.borrowTestUser();

            // Login the user normally
            const context = await browser.newContext({
                storageState: undefined, // Start with clean storage (no cookies, localStorage, IndexedDB)
            });
            const page = await context.newPage();

            const loginPage = new LoginPage(page);
            await loginPage.navigate();
            await loginPage.login(user.email, user.password);

            // Wait for dashboard to load
            await page.waitForLoadState('domcontentloaded');
            const dashboardPage = new DashboardPage(page);
            await dashboardPage.waitForDashboard();

            // Now hack: clear their policy acceptances to simulate unaccepted policies
            await apiDriver.clearUserPolicyAcceptances(user.token);

            // Refresh the page - policy modal should appear
            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            // The policy modal should appear because user hasn't accepted policies
            const policyModal = new PolicyAcceptanceModalPage(page);
            await policyModal.waitForModalToAppear();

            // Test accepting all policies at once
            await policyModal.acceptMultiplePoliciesSequentially();

            // Verify we're back to dashboard after accepting all policies
            await expect(page).toHaveURL(/\/dashboard/);
            await dashboardPage.waitForDashboard();

            // Return the user to the pool
            await apiDriver.returnTestUser(user.email);

            // Close the browser context
            await context.close();
        });

        simpleTest('should validate policy modal structure and content', async ({ browser }) => {
            const apiDriver = await ApiDriver.create();

            // Borrow a test user from the pool
            const user = await apiDriver.borrowTestUser();

            // Login the user normally
            const context = await browser.newContext({
                storageState: undefined, // Start with clean storage (no cookies, localStorage, IndexedDB)
            });
            const page = await context.newPage();

            const loginPage = new LoginPage(page);
            await loginPage.navigate();
            await loginPage.login(user.email, user.password);

            // Wait for dashboard to load
            await page.waitForLoadState('domcontentloaded');
            const dashboardPage = new DashboardPage(page);
            await dashboardPage.waitForDashboard();

            // Now hack: clear their policy acceptances to simulate unaccepted policies
            await apiDriver.clearUserPolicyAcceptances(user.token);

            // Refresh the page - policy modal should appear
            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            // Test policy modal structure - modal MUST appear
            const policyModal = new PolicyAcceptanceModalPage(page);

            await policyModal.waitForModalToAppear();

            // Verify modal structure
            await policyModal.verifyTitleVisible();
            await policyModal.verifySubtitleVisible();
            await policyModal.verifyProgressBarVisible();
            await policyModal.verifyPolicyCardVisible();

            await policyModal.waitForPolicyContentToLoad();

            // Verify policy acceptance elements
            await policyModal.verifyAcceptanceCheckboxVisible();
            await policyModal.verifyAcceptanceLabelVisible();

            // Verify policy name is displayed (should be some policy content)
            await policyModal.verifyPolicyNameHasContent(5);

            // Complete acceptance - use acceptMultiplePoliciesSequentially since there may be
            // multiple policies pending (the test only updates one, but system shows all pending)
            await policyModal.acceptMultiplePoliciesSequentially();

            // Verify we're back to dashboard
            await expect(page).toHaveURL(/\/dashboard/);

            // Close the browser context
            await context.close();
        });
    });
});

simpleTest.describe('Share Link Access Management', () => {
    simpleTest.describe('Share Link - Already Logged In User', () => {
        simpleTest('should show appropriate message when logged-in user is already a member', async ({ createLoggedInBrowsers }) => {
            // Create two browser instances - User 1 and User 2
            const [{ dashboardPage: user1DashboardPage }, { page: page2 }] = await createLoggedInBrowsers(2);

            const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup();
            const groupId = groupDetailPage.inferGroupId();
            const groupName = await groupDetailPage.getGroupNameText();

            const shareModal = await groupDetailPage.clickShareGroupAndOpenModal();
            const shareLink = await shareModal.getShareLink();
            await shareModal.closeModal();

            // User2 joins first time
            const joinGroupPage2 = new JoinGroupPage(page2);
            await joinGroupPage2.joinGroupUsingShareLink(shareLink);
            await expect(page2).toHaveURL(JoinGroupPage.groupDetailUrlPattern(groupId));

            const user2GroupDetailPage = new GroupDetailPage(page2);
            await user2GroupDetailPage.waitForPage(groupId, 2);
            const user2Dashboard = await navigateToDashboardFromPage(user2GroupDetailPage);
            await user2Dashboard.waitForDashboard();
            await user2Dashboard.waitForGroupToAppear(groupName);

            // User2 tries to join again - join group button should be missing and OK button should be present
            const joinGroupPage = new JoinGroupPage(page2);
            await joinGroupPage.navigateToShareLink(shareLink);
            await joinGroupPage.verifyJoinGroupButtonNotVisible();
            await joinGroupPage.verifyAlreadyMemberMessageVisible();
            await joinGroupPage.clickOkButton();
            await expect(page2).toHaveURL(JoinGroupPage.groupDetailUrlPattern(groupId));
        });
    });

    simpleTest.describe('Share Link - Not Logged In User', () => {
        simpleTest('should redirect non-logged-in user to login then to group after login', async ({ createLoggedInBrowsers, newEmptyBrowser }) => {
            // Create authenticated user to set up the group
            const [{ dashboardPage: ownerDashboardPage }] = await createLoggedInBrowsers(1);

            // Create unauthenticated browser
            const { page: unauthPage, loginPage } = await newEmptyBrowser();

            // Create group with authenticated user
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup();
            const groupId = groupDetailPage.inferGroupId();
            const groupName = await groupDetailPage.getGroupNameText();

            // Get share link from the group
            const shareModal = await groupDetailPage.clickShareGroupAndOpenModal();
            const shareLink = await shareModal.getShareLink();
            await shareModal.closeModal();

            // Navigate to share link with unauthenticated user - should redirect to login
            const joinGroupPage = new JoinGroupPage(unauthPage);
            await joinGroupPage.navigateToShareLink(shareLink);
            await expect(unauthPage).toHaveURL(/\/login/);

            // Get a second user to login with (but use the unauthenticated page)
            const secondUser = await (await getUserPool()).claimUser(unauthPage);
            await loginPage.login(secondUser.email, secondUser.password);

            // After successful login, user should be redirected to the join group page
            // The redirect should preserve the share link token
            await expect(unauthPage).toHaveURL(/\/join\?shareToken=/);
            expect(unauthPage.url()).toContain('/join?shareToken=');

            // Verify user can see the group details on the join page
            const displayedGroupName = await joinGroupPage.getGroupName();
            expect(displayedGroupName).toBe(groupName);

            // Complete the join process
            await joinGroupPage.joinGroupUsingShareLink(shareLink);

            // Verify user successfully joined and is now on the group detail page
            await expect(unauthPage).toHaveURL(JoinGroupPage.groupDetailUrlPattern(groupId));

            // Clean up the claimed user
            await (await getUserPool()).releaseUser(secondUser);
        });

        simpleTest('should allow unregistered user to register and join group via share link', async ({ createLoggedInBrowsers, newEmptyBrowser }) => {
            // Create authenticated user to set up the group
            const [{ dashboardPage: ownerDashboardPage }] = await createLoggedInBrowsers(1);

            // Create unauthenticated browser
            const { page: unauthPage, loginPage } = await newEmptyBrowser();

            // Create group with authenticated user
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup();
            const groupId = groupDetailPage.inferGroupId();

            // Get share link from the group
            const shareModal = await groupDetailPage.clickShareGroupAndOpenModal();
            const shareLink = await shareModal.getShareLink();
            await shareModal.closeModal();

            // Navigate to share link with unauthenticated user (simulating external link click)
            const joinPage = new JoinGroupPage(unauthPage);
            await joinPage.navigateToShareLink(shareLink);

            // Should be redirected to login page
            await expect(unauthPage).toHaveURL(/\/login/);
            expect(unauthPage.url()).toContain('returnUrl');

            // Click on Sign Up link to go to registration
            await loginPage.clickSignUp();
            const registerPage = new RegisterPage(unauthPage);

            // Register new user
            const { displayName: newUserName, email: newUserEmail, password: newUserPassword } = new TestUserBuilder()
                .build();
            await registerPage.fillRegistrationForm(newUserName, newUserEmail, newUserPassword);
            await registerPage.acceptAllPolicies();
            await registerPage.submitForm();

            // After successful registration, user should be redirected to the join group page
            // The returnUrl should be preserved through the registration flow
            await expect(unauthPage).toHaveURL(/\/join\?shareToken=/);
            expect(unauthPage.url()).toContain('/join?shareToken=');

            // User should now see the join group page and can join directly
            await joinPage.clickJoinGroupAndWaitForJoin();

            // Should be redirected to the group
            await expect(unauthPage).toHaveURL(JoinGroupPage.groupDetailUrlPattern(groupId));

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
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup();
            const groupId = groupDetailPage.inferGroupId();

            // Get share link from the group
            const shareModal = await groupDetailPage.clickShareGroupAndOpenModal();
            const shareLink = await shareModal.getShareLink();
            await shareModal.closeModal();

            // Get a second user to login with
            const [{ user: secondUser }] = await createLoggedInBrowsers(1);

            // Navigate to share link with unauthenticated user (simulating external link click)
            const joinPage = new JoinGroupPage(unauthPage);
            await joinPage.navigateToShareLink(shareLink);

            // Should be redirected to login page with returnUrl
            await expect(unauthPage).toHaveURL(/\/login/);
            const loginUrl = unauthPage.url();
            expect(loginUrl).toContain('returnUrl');
            expect(loginUrl).toContain('shareToken');

            // Login as the second user
            await loginPage.login(secondUser.email, secondUser.password);

            // After login, user should be redirected to the join page with shareToken
            await expect(unauthPage).toHaveURL(/\/join\?shareToken=/);

            // Complete the join process - we're already on the join page after login redirect
            await joinPage.clickJoinGroupAndWaitForJoin();

            // Should be redirected to the group detail page
            await expect(unauthPage).toHaveURL(JoinGroupPage.groupDetailUrlPattern(groupId));

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
            const invalidShareLink = `${baseUrl}/join?shareToken=invalid-group-id-12345`;

            // Attempt to join with invalid share link - should show error
            const joinGroupPage = new JoinGroupPage(page);
            await joinGroupPage.navigateToShareLink(invalidShareLink);

            // Should show error page OR join page without join button (both are valid error states)
            const isErrorPage = await joinGroupPage.isErrorPage();
            const joinButtonVisible = await joinGroupPage.isJoinGroupButtonVisible();

            if (!isErrorPage && joinButtonVisible) {
                // If no error message and join button is visible, that's unexpected
                throw new Error(`Expected error page or disabled join but found active join page.`);
            }
        });

        simpleTest('should handle malformed share links', { annotation: { type: 'skip-error-checking' } }, async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

            // Get the base URL from the current page using page object
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            const baseUrl = dashboardPage.getBaseUrl();

            // Test various malformed links using page object navigation
            // When shareToken is missing or empty, app now shows an error page (not redirect)
            const emptyLinkCases = [`${baseUrl}/join?shareToken=`, `${baseUrl}/join`];

            const joinGroupPage = new JoinGroupPage(page);

            for (const link of emptyLinkCases) {
                await joinGroupPage.navigateToShareLink(link);

                expect(page.url()).toContain('/join');
                await joinGroupPage.verifyInvalidLinkWarningVisible();

                await joinGroupPage.verifyBackToDashboardButtonVisible();
            }

            // Test with malicious/invalid shareToken - should show error
            const invalidLink = `${baseUrl}/join?shareToken=../../malicious`;

            await joinGroupPage.navigateToShareLink(invalidLink);
            expect(page.url()).toContain('/join');
            await joinGroupPage.verifyUnableToJoinWarningVisible();

            // Should have a button to go back to dashboard using page object method
            await joinGroupPage.verifyBackToDashboardButtonVisible();

            // Click the button to verify navigation works using page object method
            await joinGroupPage.clickBackToDashboard();
            await joinGroupPage.expectUrl(/\/dashboard/);
        });

        simpleTest('should regenerate share link and update QR code when Generate New button is clicked', async ({ createLoggedInBrowsers }) => {
            const [{ dashboardPage }] = await createLoggedInBrowsers(1);

            // Create a group to share
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup();

            // Open the share modal
            const shareModalPage = await groupDetailPage.clickShareGroupAndOpenModal();
            await shareModalPage.waitForModalToOpen();

            // Get the initial share link
            const initialShareLink = await shareModalPage.getShareLink();
            expect(initialShareLink).toMatch(/\/join\?shareToken=/);

            // Use the helper method that properly waits for the link to update
            const newShareLink = await shareModalPage.generateNewShareLink();
            expect(newShareLink).toMatch(/\/join\?shareToken=/);

            // Verify the link has actually changed
            expect(newShareLink).not.toBe(initialShareLink);

            // Verify both links follow the correct format but are different
            const initialLinkId = new URL(initialShareLink).searchParams.get('shareToken');
            const newLinkId = new URL(newShareLink).searchParams.get('shareToken');

            expect(initialLinkId).toBeTruthy();
            expect(newLinkId).toBeTruthy();
            expect(newLinkId).not.toBe(initialLinkId);

            // Close the modal
            await shareModalPage.closeModal();
        });
    });
});

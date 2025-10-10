import { expect } from '@playwright/test';
import { CreateGroupFormDataBuilder, DEFAULT_PASSWORD, generateTestEmail, generateTestGroupName, generateTestUserName, TestUserBuilder } from '@splitifyd/test-support';
import { ApiDriver } from '@splitifyd/test-support';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { simpleTest } from '../../fixtures';
import { getUserPool } from '../../fixtures/user-pool.fixture';
import { DashboardPage, GroupDetailPage, HomepagePage, JoinGroupPage, LoginPage, RegisterPage, SettingsPage } from '../../pages';
import { groupDetailUrlPattern } from '../../pages/group-detail.page';
import { PolicyAcceptanceModalPage } from '../../pages/policy-acceptance-modal.page';

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
        await expect(settingsPage.getDisplayNameInput()).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeVisible();

        // Test display name validation
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), '');
        await expect(page.getByText('Display name cannot be empty')).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeDisabled();

        const longName = 'A'.repeat(101);
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), longName);
        await expect(page.getByText('Display name must be 100 characters or less')).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeDisabled();

        // Test successful profile update with loading states and real-time updates
        const newDisplayName = `Updated Name ${Date.now()}`;
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), newDisplayName);
        await expect(settingsPage.getSaveChangesButton()).toBeEnabled();

        const saveButton = settingsPage.getSaveChangesButton();
        await settingsPage.clickButton(saveButton, { buttonName: 'Save Changes' });
        await settingsPage.verifyLoadingState('save');
        await settingsPage.waitForLoadingComplete('save');

        // Verify comprehensive real-time updates across all UI components
        await expect(settingsPage.getProfileDisplayName()).toContainText(newDisplayName);
        await expect(settingsPage.header.getUserMenuButton()).toContainText(newDisplayName);
        await expect(settingsPage.getDisplayNameInput()).toHaveValue(newDisplayName);

        // Verify persistence when navigating to dashboard and back
        await settingsPage.navigateToDashboard();
        await expect(settingsPage.header.getUserMenuButton()).toContainText(newDisplayName);
        await settingsPage.navigate();
        await expect(settingsPage.getProfileEmail()).toContainText(user.email);
        await expect(settingsPage.getProfileDisplayName()).toContainText(newDisplayName);

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
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getCurrentPasswordInput(), 'currentPass');
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getNewPasswordInput(), '123');
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getConfirmPasswordInput(), '123');
        await passwordSettingsPage.clickButton(passwordSettingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
        await expect(passwordPage.getByText('New password must be at least 6 characters long')).toBeVisible();

        // Test password mismatch
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getNewPasswordInput(), 'newPassword123');
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getConfirmPasswordInput(), 'differentPassword');
        await passwordSettingsPage.clickButton(passwordSettingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
        await expect(passwordPage.getByText('Passwords do not match')).toBeVisible();

        // Test successful password change
        await passwordSettingsPage.cancelPasswordChange();
        await passwordSettingsPage.changePassword(password, 'newPassword123!');
        await passwordSettingsPage.verifySuccessMessage('Password changed successfully');
        await passwordSettingsPage.verifyPasswordFormVisible(false);

        // Test password change cancellation
        await passwordSettingsPage.openPasswordChangeForm();
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getCurrentPasswordInput(), 'somePassword');
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getNewPasswordInput(), 'newPassword123');
        await passwordSettingsPage.cancelPasswordChange();
        await passwordSettingsPage.verifyPasswordFormVisible(false);
        await expect(passwordSettingsPage.getChangePasswordButton()).toBeVisible();
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
        await expect(page.getByText(displayName).first()).toBeVisible();
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

        const submitButton = registerPage.getSubmitButton();
        await expect(submitButton).toBeEnabled();

        await registerPage.submitForm();

        // Check for loading spinner (might be very quick)
        const spinnerVisible = await registerPage.isLoadingSpinnerVisible();
        simpleTest.info().annotations.push({
            type: 'loading-spinner',
            description: spinnerVisible ? 'Spinner was visible' : 'Registration was instant (no spinner)',
        });

        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
        await expect(page.getByRole('heading', { name: /welcome|your groups/i }).first()).toBeVisible({ timeout: 5000 });

        // Log out to test duplicate registration prevention
        const dashboardPage = new DashboardPage(page);
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
        await registerPage.fillFormField('name', displayName);
        await registerPage.fillFormField('email', email);
        await registerPage.fillFormField('password', password);
        await registerPage.fillFormField('confirmPassword', password);
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit and verify error response
        const responsePromise = registerPage.waitForRegistrationResponse(409);
        await registerPage.submitForm();
        await responsePromise;

        // Should stay on registration page, not redirect
        await registerPage.expectUrl(/\/register/);

        // Verify error message appears and form persistence
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });
        const errorText = await errorElement.textContent();
        expect(errorText?.toLowerCase()).toMatch(/email.*already.*exists|email.*in use|account.*exists|email.*registered/);

        // Verify 409 error in console
        const errorInConsole = consoleMessages.some((msg) => {
            const lowerMsg = msg.toLowerCase();
            return lowerMsg.includes('409') || (lowerMsg.includes('error') && lowerMsg.includes('conflict'));
        });
        expect(errorInConsole).toBe(true);

        // Test form persistence (user doesn't lose their input)
        const nameInput = registerPage.getFormField('name');
        const emailInput = registerPage.getFormField('email');
        await expect(nameInput).toHaveValue(displayName);
        await expect(emailInput).toHaveValue(email);

        // Test 3: Recovery by changing email and additional loading state tests
        const newEmail = generateTestEmail('recovery');
        await registerPage.fillFormField('email', newEmail);
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
    simpleTest.describe('Policy Page Navigation', () => {
        simpleTest('should load and navigate between policy pages without errors', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            const homepagePage = new HomepagePage(page);

            // Test all three policy pages load properly
            const policyPages = [
                { path: '/terms', heading: /Terms of Service|Terms and Conditions/ },
                { path: '/privacy', heading: /Privacy Policy|Privacy/ },
                { path: '/cookies', heading: /Cookie Policy|Cookie/ },
            ];

            for (const { path, heading } of policyPages) {
                await homepagePage.navigateToStaticPath(path);
                await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
                await homepagePage.getHeadingByLevel(1).filter({ hasText: heading }).first().waitFor();

                // Wait for policy content to fully load - the loading spinner should disappear
                await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 5000 });
            }

            // Test footer navigation from login page
            await page.goto('/login');
            await homepagePage.getTermsLink().click();
            await expect(page).toHaveURL(/\/terms/);

            await page.goto('/login');
            await homepagePage.getPrivacyLink().click();
            await expect(page).toHaveURL(/\/privacy/);
        });
    });

    simpleTest.describe('Registration Policy Acceptance', () => {
        simpleTest('should require both policy checkboxes for registration', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            const registerPage = new RegisterPage(page);
            await registerPage.navigate();

            // Verify both checkboxes and links are present
            await expect(registerPage.getTermsCheckbox()).toBeVisible();
            await expect(registerPage.getCookieCheckbox()).toBeVisible();
            await expect(registerPage.getTermsLink()).toBeVisible();
            await expect(registerPage.getCookiesLink()).toBeVisible();

            // Fill form completely
            await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
            await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
            await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
            await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

            const submitButton = registerPage.getCreateAccountButton();

            // Submit should be disabled with no checkboxes
            await expect(submitButton).toBeDisabled();

            // Submit should be disabled with only terms checked
            await registerPage.checkTermsCheckbox();
            await expect(submitButton).toBeDisabled();

            // Submit should be disabled with only cookie policy checked
            await registerPage.uncheckTermsCheckbox();
            await registerPage.checkCookieCheckbox();
            await expect(submitButton).toBeDisabled();

            // Submit should be enabled with both checked
            await registerPage.checkTermsCheckbox();
            await expect(submitButton).toBeEnabled();
        });
    });

    simpleTest.describe('Existing User Policy Updates', () => {
        simpleTest('should update each policy and accept them sequentially', async ({ browser }) => {
            const apiDriver = new ApiDriver();

            // Borrow a test user from the pool and promote to admin
            const user = await apiDriver.borrowTestUser();

            // Promote user to admin for policy management operations
            await apiDriver.promoteUserToAdmin(user.token);

            // Clean up test environment to remove any non-standard policies
            await apiDriver.cleanupTestEnvironment(user.token);

            // Ensure base policies exist before testing
            await apiDriver.ensurePoliciesExist();

            // Clear any existing policy acceptances to ensure clean state
            await apiDriver.clearUserPolicyAcceptances(user.token);

            // Accept base policies for this user (simulating a user who registered earlier)
            await apiDriver.acceptCurrentPublishedPolicies(user.token);

            // Now update all policies to newer versions that user hasn't seen
            const policies = ['terms-of-service', 'privacy-policy', 'cookie-policy'];

            for (const policyId of policies) {
                await apiDriver.updateSpecificPolicy(policyId, user.token);
            }

            // Now login the user manually
            const context = await browser.newContext({
                storageState: undefined, // Start with clean storage (no cookies, localStorage, IndexedDB)
            });
            const page = await context.newPage();

            // Use the LoginPage to handle the login process
            const loginPage = new LoginPage(page);
            await loginPage.navigate();
            await loginPage.login(user.email, user.password);

            // Should be redirected to policy modal or dashboard
            await page.waitForLoadState('domcontentloaded');

            const dashboardPage = new DashboardPage(page);

            // The policy modal should appear because user hasn't accepted updated policies
            const policyModal = new PolicyAcceptanceModalPage(page);

            // Wait for modal to appear - it should appear automatically since user hasn't accepted updated policies
            await policyModal.waitForModalToAppear();

            // Test accepting all policies at once (simulating multiple policy updates)
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
            const apiDriver = new ApiDriver();

            // Get a test user and promote to admin for policy management
            const user = await apiDriver.borrowTestUser();
            await apiDriver.promoteUserToAdmin(user.token);

            // Clean up test environment to remove any non-standard policies
            await apiDriver.cleanupTestEnvironment(user.token);

            // Ensure base policies exist before testing
            await apiDriver.ensurePoliciesExist();

            // Clear and accept base policies first
            await apiDriver.clearUserPolicyAcceptances(user.token);
            await apiDriver.acceptCurrentPublishedPolicies(user.token);

            // Manually log in the user (not using fixture that auto-accepts policies)
            const context = await browser.newContext({
                storageState: undefined, // Start with clean storage (no cookies, localStorage, IndexedDB)
            });
            const page = await context.newPage();

            const loginPage = new LoginPage(page);
            await loginPage.navigate();
            await loginPage.login(user.email, user.password);

            // Update a policy to trigger modal (user has already accepted base policies)
            await apiDriver.updateSpecificPolicy('terms-of-service', user.token);

            // Trigger policy check
            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            // Test policy modal structure - modal MUST appear
            const policyModal = new PolicyAcceptanceModalPage(page);

            await policyModal.waitForModalToAppear();

            // Verify modal structure
            await expect(policyModal.title).toBeVisible();
            await expect(policyModal.subtitle).toBeVisible();
            await expect(policyModal.progressBar).toBeVisible();
            await expect(policyModal.policyCard).toBeVisible();

            await policyModal.waitForPolicyContentToLoad();

            // Verify policy acceptance elements
            await expect(policyModal.acceptanceCheckbox).toBeVisible();
            await expect(policyModal.acceptanceLabel).toBeVisible();

            // Verify policy name is displayed (should be some policy content)
            const policyName = await policyModal.getCurrentPolicyName();
            expect(policyName).toBeTruthy();
            expect(policyName.length).toBeGreaterThan(5); // Should have some meaningful content

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

            const groupName = generateTestGroupName(`ShareLink`);
            const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup(
                new CreateGroupFormDataBuilder()
                    .withName(groupName)
                    .withDescription('Testing already member scenario'),
            );
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
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder());
            const groupId = groupDetailPage.inferGroupId();
            const groupName = await groupDetailPage.getGroupNameText();

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
            const displayedGroupName = await joinGroupPage.getGroupName();
            expect(displayedGroupName).toBe(groupName);

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
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder());
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
            const registerPage = await loginPage.navigateToRegisterPage();

            // Register new user
            const { displayName: newUserName, email: newUserEmail, password: newUserPassword } = new TestUserBuilder()
                .build();
            await registerPage.fillRegistrationForm(newUserName, newUserEmail, newUserPassword);
            await registerPage.acceptAllPolicies();
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
            const [groupDetailPage] = await ownerDashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder());
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

        simpleTest('should regenerate share link and update QR code when Generate New button is clicked', async ({ createLoggedInBrowsers }) => {
            const [{ dashboardPage }] = await createLoggedInBrowsers(1);

            // Create a group to share
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder());

            // Open the share modal
            const shareModalPage = await groupDetailPage.openShareGroupModal();
            await shareModalPage.waitForModalToOpen();

            // Get the initial share link
            const initialShareLink = await shareModalPage.getShareLink();
            expect(initialShareLink).toMatch(/\/join\?linkId=/);

            // Click "Generate New" to regenerate the link
            await shareModalPage.clickGenerateNewLink();

            // Get the new share link
            const newShareLink = await shareModalPage.getShareLink();
            expect(newShareLink).toMatch(/\/join\?linkId=/);

            // Verify the link has actually changed
            expect(newShareLink).not.toBe(initialShareLink);

            // Verify both links follow the correct format but are different
            const initialLinkId = new URL(initialShareLink).searchParams.get('linkId');
            const newLinkId = new URL(newShareLink).searchParams.get('linkId');

            expect(initialLinkId).toBeTruthy();
            expect(newLinkId).toBeTruthy();
            expect(newLinkId).not.toBe(initialLinkId);

            // Close the modal
            await shareModalPage.closeModal();
        });
    });
});

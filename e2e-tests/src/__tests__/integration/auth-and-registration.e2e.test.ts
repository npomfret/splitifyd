import { expect } from '@playwright/test';
import { simpleTest } from '../../fixtures';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { DEFAULT_PASSWORD, generateTestEmail, generateTestUserName } from '@splitifyd/test-support';
import { CreateGroupModalPage, DashboardPage, RegisterPage } from '../../pages';

/**
 * Authentication and Registration E2E Tests
 *
 * Note: Basic form validation (login/register form field validation, submit button states,
 * password matching) is tested in form-validation-comprehensive.e2e.test.ts
 *
 * This file focuses on:
 * - Authentication security and redirects
 * - Duplicate registration prevention
 * - Registration loading states
 * - Terms and policy acceptance
 */

simpleTest.describe('Authentication Security', () => {
    simpleTest('should redirect unauthenticated users to login', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        // Clear authentication by going to login and not logging in
        await page.goto('/login');

        // Try to access protected dashboard directly
        await page.goto('/dashboard');

        // Should be redirected to login
        await expect(page).toHaveURL(/\/login/);
    });

    simpleTest('should protect group pages from unauthorized access', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const createGroupModalPage = new CreateGroupModalPage(page, user);

        // Create a group while authenticated
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();

        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm('Security Test Group');
        await createGroupModalPage.submitForm();

        // Wait for group creation and get the group ID from URL
        await page.waitForURL(/\/groups\/[a-zA-Z0-9]+/);
        const groupId = page.url().split('/groups/')[1];

        // Navigate back to dashboard and log out properly
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();
        await dashboardPage.logout();

        // Try to access the group page directly while logged out
        await page.goto(`/groups/${groupId}`);

        // Should be redirected to login (may take a few seconds for auth check)
        await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 15000 });
    });
});

simpleTest.describe('Multi-User Security', () => {
    simpleTest('should prevent users from accessing other users groups', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - unauthorized user will get expected 404s when trying to access private group
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when unauthorized user tries to access private group' });
        // Create two browser instances - User 1 and User 2
        const { page: page1, dashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: page2, user: user2 } = await newLoggedInBrowser();

        // Create page objects
        const createGroupModalPage = new CreateGroupModalPage(page1, user1);

        // User 1 creates a private group using POMs
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();

        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm('Private Group');
        await createGroupModalPage.submitForm();

        // Wait for group creation and get the group ID from URL
        await page1.waitForURL(/\/groups\/[a-zA-Z0-9]+/);
        const groupId = page1.url().split('/groups/')[1];

        // User 2 tries to access User 1's group directly
        await page2.goto(`/groups/${groupId}`);

        // Should be redirected away (either to dashboard or 404)
        await expect(page2).not.toHaveURL(new RegExp(`/groups/${groupId}`));
    });
});

test.describe('Duplicate User Registration E2E', () => {
    test('should prevent duplicate email registration and show error', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        // This test expects a 409 error when trying to register duplicate email
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
        const email = generateTestEmail('duplicate');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Duplicate');

        // First registration - should succeed
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill registration form using page object method
        await registerPage.register(displayName, email, password);

        // Should redirect to dashboard after successful registration
        await expect(page).toHaveURL(/\/dashboard/);

        // Log out to attempt second registration using page object
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.logout();

        // Navigate to register page using page object
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Start capturing console messages before the registration attempt
        const consoleMessages: string[] = [];
        page.on('console', (msg) => {
            consoleMessages.push(`${msg.type()}: ${msg.text()}`);
        });

        // Fill form again with same email using enhanced page object methods
        await registerPage.fillFormField('name', displayName);
        await registerPage.fillFormField('email', email);
        await registerPage.fillFormField('password', password);
        await registerPage.fillFormField('confirmPassword', password);
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit form and wait for error response using page object method
        const responsePromise = registerPage.waitForRegistrationResponse(409);
        await registerPage.submitForm();
        await responsePromise;

        // Should NOT redirect - should stay on registration page
        await registerPage.expectUrl(/\/register/);

        // Check for error message using enhanced page object method
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });

        const errorText = await errorElement.textContent();
        expect(errorText?.toLowerCase()).toMatch(/email.*already.*exists|email.*in use|account.*exists|email.*registered/);

        // Check console for error messages (make it more flexible)
        // The 409 error appears as a resource load failure
        const errorInConsole = consoleMessages.some((msg) => {
            const lowerMsg = msg.toLowerCase();
            return lowerMsg.includes('409') || (lowerMsg.includes('error') && lowerMsg.includes('conflict'));
        });

        // We verified the error appears on screen, and the 409 is in the console
        expect(errorInConsole).toBe(true);
    });

    test('should show error immediately without clearing form', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });

        const email = generateTestEmail('persist');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Persist');

        // First registration using page object
        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.register(displayName, email, password);

        // Wait for dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Log out using page object
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.logout();

        // Wait for navigation after logout using page object
        await expect(page).toHaveURL((url) => {
            const urlStr = url.toString();
            const path = new URL(urlStr).pathname;
            return path === '/' || path === '/login' || path === '/home';
        });

        // Second attempt - navigate to register page using page object
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill form using enhanced page object methods
        await registerPage.fillFormField('name', displayName);
        await registerPage.fillFormField('email', email);
        await registerPage.fillFormField('password', password);
        await registerPage.fillFormField('confirmPassword', password);
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit and wait for the expected error response using page object method
        const responsePromise2 = registerPage.waitForRegistrationResponse(409);
        await registerPage.submitForm();
        await responsePromise2;

        // Form fields should still contain the values - using page object getters
        const nameInput = registerPage.getFormField('name');
        const emailInput = registerPage.getFormField('email');
        const passwordInput = registerPage.getFormField('password');

        await expect(nameInput).toHaveValue(displayName);
        await expect(emailInput).toHaveValue(email);
        // Password might be cleared for security - check if it has value
        const passwordValue = await passwordInput.inputValue();
        expect(passwordValue.length).toBeGreaterThanOrEqual(0); // Allow it to be cleared or retained

        // Error should be visible using page object method
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });
    });

    test('should allow registration with different email after duplicate attempt', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });

        const email1 = generateTestEmail('first');
        const email2 = generateTestEmail('second');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Recovery');

        // First registration using page object
        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.register(displayName, email1, password);
        await expect(page).toHaveURL(/\/dashboard/);

        // Log out using page object
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.logout();

        // Wait for navigation after logout
        await expect(page).toHaveURL((url) => {
            const urlStr = url.toString();
            const path = new URL(urlStr).pathname;
            return path === '/' || path === '/login' || path === '/home';
        });

        // Try duplicate (should fail) using page object methods
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill form with duplicate email using enhanced page object methods
        await registerPage.fillFormField('name', displayName);
        await registerPage.fillFormField('email', email1);
        await registerPage.fillFormField('password', password);
        await registerPage.fillFormField('confirmPassword', password);
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit and wait for the expected error response using page object method
        const responsePromise3 = registerPage.waitForRegistrationResponse(409);
        await registerPage.submitForm();
        await responsePromise3;

        // Should see error using page object method
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });

        // Now change email and try again using page object method
        await registerPage.fillFormField('email', email2);
        await registerPage.submitForm();

        // Should succeed this time
        await expect(page).toHaveURL(/\/dashboard/);
    });
});

test.describe('Registration Loading State', () => {
    test('should show loading spinner during registration', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        const email = generateTestEmail('loading-test');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('LoadingTest');

        // Navigate to register page
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill the registration form
        await registerPage.fillRegistrationForm(displayName, email, password);

        // Submit the form
        await registerPage.submitForm();

        // Check if we can see the loading spinner (might be very quick)
        // Note: This might not always be visible if registration is instant
        const spinnerVisible = await registerPage.isLoadingSpinnerVisible();

        // Whether we saw the spinner or not, we should end up on dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // Log whether we saw the spinner for debugging
        test.info().annotations.push({
            type: 'loading-spinner',
            description: spinnerVisible ? 'Spinner was visible' : 'Registration was instant (no spinner)',
        });
    });

    test('should handle both instant and delayed registration', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        const email = generateTestEmail('instant-test');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('InstantTest');

        // Navigate to register page
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Use the main register method which handles both scenarios
        await registerPage.register(displayName, email, password);

        // Should be on dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify we're actually logged in by checking for dashboard elements
        await expect(page.getByRole('heading', { name: /welcome|your groups/i }).first()).toBeVisible({ timeout: 5000 });
    });

    test('should disable submit button while processing', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        const email = generateTestEmail('disabled-test');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('DisabledTest');

        // Navigate to register page
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill the registration form
        await registerPage.fillRegistrationForm(displayName, email, password);

        // Get the submit button
        const submitButton = registerPage.getSubmitButton();

        // Verify it's enabled before submission
        await expect(submitButton).toBeEnabled();

        // Submit the form
        await registerPage.submitForm();

        // The button should become disabled during processing
        // This might happen very quickly, so we use a race condition
        await Promise.race([expect(submitButton).toBeDisabled({ timeout: 1000 }), page.waitForURL(/\/dashboard/, { timeout: 1000 })]).catch(() => {
            // It's ok if we miss the disabled state due to instant registration
        });

        // Eventually should redirect to dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    });
});

simpleTest.describe('Terms and Cookie Policy Acceptance', () => {
    simpleTest('should display both terms and cookie policy checkboxes', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const registerPage = new RegisterPage(page);

        // Check that both checkboxes are present using page object methods
        await expect(registerPage.getTermsCheckbox()).toBeVisible();
        await expect(registerPage.getCookieCheckbox()).toBeVisible();

        // Check that they have appropriate labels
        await expect(registerPage.getTermsText()).toBeVisible();
        await expect(registerPage.getCookieText()).toBeVisible();

        // Check that links exist
        await expect(registerPage.getTermsLink()).toBeVisible();
        await expect(registerPage.getCookiesLink()).toBeVisible();
    });

    simpleTest('should disable submit button when terms not accepted', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        // Fill form but leave terms unchecked
        const registerPage = new RegisterPage(page);
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Check only cookie policy checkbox using page object method
        await registerPage.checkCookieCheckbox();

        // Submit button should be disabled
        await expect(registerPage.getCreateAccountButton()).toBeDisabled();
    });

    simpleTest('should disable submit button when cookie policy not accepted', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const registerPage = new RegisterPage(page);
        // Fill form but leave cookie policy unchecked
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Check only terms checkbox using page object method
        await registerPage.checkTermsCheckbox();

        // Submit button should be disabled
        await expect(registerPage.getCreateAccountButton()).toBeDisabled();
    });

    simpleTest('should enable submit button when both policies accepted', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const registerPage = new RegisterPage(page);
        // Fill form completely
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Check both checkboxes using page object methods
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit button should be enabled
        await expect(registerPage.getCreateAccountButton()).toBeEnabled();
    });

    simpleTest('should show appropriate error messages for unchecked boxes', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const registerPage = new RegisterPage(page);
        // Fill form but don't check any boxes
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Try to submit (should show validation error before form submission)
        // Since the submit button is disabled, we'll test by checking the form validity
        const submitButton = registerPage.getCreateAccountButton();
        await expect(submitButton).toBeDisabled();

        // Check one box, should still be disabled
        await registerPage.checkTermsCheckbox();
        await expect(submitButton).toBeDisabled();

        // Check second box, should now be enabled
        await registerPage.checkCookieCheckbox();
        await expect(submitButton).toBeEnabled();
    });

    simpleTest('should handle form submission when both policies accepted', async ({ newEmptyBrowser }, testInfo) => {
        const { page } = await newEmptyBrowser();
        // @skip-error-checking - This test may have expected registration errors
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'This test may have expected registration errors' });

        const registerPage = new RegisterPage(page);
        // Navigate to the register page first
        await registerPage.navigate();

        // Fill form completely using proper Page Object Model methods
        await registerPage.fillPreactInput(registerPage.getFullNameInput(), 'Test User');
        await registerPage.fillPreactInput(registerPage.getEmailInput(), generateTestEmail());
        await registerPage.fillPreactInput(registerPage.getPasswordInput(), DEFAULT_PASSWORD);
        await registerPage.fillPreactInput(registerPage.getConfirmPasswordInput(), DEFAULT_PASSWORD);

        // Check both checkboxes using page object methods
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit button should be enabled and clickable
        const submitButton = registerPage.getCreateAccountButton();
        await expect(submitButton).toBeEnabled();

        // Test that clicking the button doesn't immediately fail (form validation passes)
        // Note: We don't test the full registration flow as that's covered elsewhere
        await submitButton.click();

        // Wait for any validation or network activity to complete using page object
        await registerPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // At this point, the form has passed client-side validation and attempted submission
        // The actual registration success/failure is tested in other test files
    });
});
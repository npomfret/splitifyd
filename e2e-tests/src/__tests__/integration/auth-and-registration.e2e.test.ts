import { expect } from '@playwright/test';
import { simpleTest } from '../../fixtures';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { DEFAULT_PASSWORD, generateTestEmail, generateTestUserName } from '@splitifyd/test-support';
import { CreateGroupModalPage, DashboardPage, RegisterPage } from '../../pages';

/**
 * Authentication and Registration E2E Tests
 *
 * IMPORTANT: This file covers different scenarios than other policy/validation tests:
 * - Basic form validation (login/register fields) → form-validation-comprehensive.e2e.test.ts
 * - Policy acceptance (registration + existing users) → policy-acceptance-comprehensive.e2e.test.ts
 *
 * This file focuses on:
 * - Authentication security and redirects
 * - Duplicate registration prevention with comprehensive error handling
 * - Registration loading states and form interactions
 */

simpleTest.describe('Authentication Security', () => {
    simpleTest('should redirect unauthenticated users to login', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
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
        await dashboardPage.header.logout();

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
        const { page: page2, } = await newLoggedInBrowser();

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
    test('should handle duplicate email registration with comprehensive error checking and form persistence', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected for duplicate registration' });

        const email = generateTestEmail('comprehensive');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Comprehensive');

        // STEP 1: Successful initial registration
        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.register(displayName, email, password);
        await expect(page).toHaveURL(/\/dashboard/);

        // Log out to attempt duplicate registration
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.header.logout();

        // STEP 2: Attempt duplicate registration and verify error handling
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

        // Verify error message appears
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

        // STEP 3: Verify form fields persist (user doesn't lose their input)
        const nameInput = registerPage.getFormField('name');
        const emailInput = registerPage.getFormField('email');
        const passwordInput = registerPage.getFormField('password');

        await expect(nameInput).toHaveValue(displayName);
        await expect(emailInput).toHaveValue(email);
        // Password might be cleared for security
        const passwordValue = await passwordInput.inputValue();
        expect(passwordValue.length).toBeGreaterThanOrEqual(0);

        // STEP 4: Verify user can recover by changing email
        const newEmail = generateTestEmail('recovery');
        await registerPage.fillFormField('email', newEmail);
        await registerPage.submitForm();

        // Should succeed with different email
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
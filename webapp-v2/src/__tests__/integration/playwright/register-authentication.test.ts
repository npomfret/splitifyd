import { toEmail } from '@billsplit-wl/shared';
import { ClientUserBuilder, DashboardPage, RegisterPage, TEST_TIMEOUTS } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('Registration Authentication Flow', () => {
    test('should register successfully and navigate to dashboard', async ({ pageWithLogging: page, mockFirebase }) => {
        // 1. Create test user data
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('John Smith')
            .withEmail(toEmail('john.smith@example.com'))
            .build();
        const registerPage = new RegisterPage(page);

        // 2. Configure mock Firebase for successful registration
        await mockFirebase.mockRegisterSuccess(testUser);

        // 3. Navigate to register page and verify it loaded
        await registerPage.navigate();

        // 4. Complete registration and navigate to dashboard (fluent interface)
        const dashboardPage = await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'SecurePassword1234');

        // 5. Verify successful registration and navigation
        await dashboardPage.verifyAuthenticatedUser(testUser.displayName);
        await dashboardPage.verifyDashboardPageLoaded();
    });

    test('should show error message for duplicate email', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        // 1. Navigate to register page
        await registerPage.navigate();

        // 2. Configure mock Firebase for duplicate email error
        await mockFirebase.mockRegisterFailure({
            code: 'REGISTRATION_FAILED',
            message: 'Unable to create account. If you already registered, try signing in.',
        });

        // 3. Attempt registration expecting failure (fluent interface)
        await registerPage.registerExpectingFailure('John Smith', toEmail('existing@example.com'), 'Password1234');

        // 4. Verify error handling (shows error code for i18n translation)
        await registerPage.verifyErrorMessage('REGISTRATION_FAILED');
    });

    test('should handle network errors gracefully', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        // 1. Navigate to register page first to ensure clean state
        await registerPage.navigate();

        // 2. Configure mock Firebase for network error
        await mockFirebase.mockRegisterFailure({
            code: 'NETWORK_ERROR',
            message: 'Network error. Please check your connection.',
        });

        // 3. Attempt registration expecting failure (fluent interface)
        await registerPage.registerExpectingFailure('Jane Doe', toEmail('jane@example.com'), 'Password1234');

        // 4. Verify network error handling (shows error code for i18n translation)
        await registerPage.verifyErrorMessage('NETWORK_ERROR');
    });

    test('should handle weak password error', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure mock Firebase for weak password error
        await mockFirebase.mockRegisterFailure({
            code: 'WEAK_PASSWORD',
            message: 'Password is too weak. Please use at least 12 characters.',
        });

        // Attempt registration with password that satisfies client validation but fails backend strength checks
        await registerPage.registerExpectingFailure('Test User', toEmail('test@example.com'), 'weakpassword1');

        // Verify error message (shows error code for i18n translation)
        await registerPage.verifyErrorMessage('WEAK_PASSWORD');
    });

    test('should handle invalid email format from backend', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure mock Firebase for invalid email error from backend
        await mockFirebase.mockRegisterFailure({
            code: 'INVALID_EMAIL',
            message: 'This email address is invalid.',
        });

        // Attempt registration with validly formatted email that backend rejects
        await registerPage.registerExpectingFailure('Test User', toEmail('badformat@example.com'), 'Password1234');

        // Verify error code is shown (shows error code for i18n translation)
        await registerPage.verifyErrorMessage('INVALID_EMAIL');
    });
});

test.describe('Registration Flow - Already Authenticated', () => {
    test('should redirect already authenticated user from register page', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        // Create authenticated user for this test
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('Existing User')
            .build();

        await setupSuccessfulApiMocks(page);

        // Set up mock Firebase with authenticated user from the start
        await authenticatedMockFirebase(testUser);

        const dashboardPage = new DashboardPage(page);

        // Try to navigate to register page - should redirect immediately
        await page.goto('/register');

        // Should be redirected to dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await dashboardPage.verifyAuthenticatedUser('Existing User');
        await dashboardPage.verifyDashboardPageLoaded();
    });

    test('should redirect to returnUrl after registration when present', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('New User')
            .withEmail(toEmail('newuser@example.com'))
            .build();
        const registerPage = new RegisterPage(page);

        await mockFirebase.mockRegisterSuccess(testUser);

        const returnUrl = '/groups/test-group-id';
        await page.goto(`/register?returnUrl=${encodeURIComponent(returnUrl)}`);
        await registerPage.verifyRegisterPageLoaded();

        // Fill and submit manually (not using fluent method since we're checking returnUrl, not dashboard)
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password1234');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Should navigate to the returnUrl instead of dashboard
        await expect(page).toHaveURL(returnUrl);
    });

    test('should navigate to dashboard when no returnUrl present', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);

        await mockFirebase.mockRegisterSuccess(testUser);

        await registerPage.navigate();

        // Complete registration - should default to dashboard
        const dashboardPage = await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'Password1234');

        await expect(page).toHaveURL(/\/dashboard/);
        await dashboardPage.verifyAuthenticatedUser(testUser.displayName);
    });
});

test.describe('Registration Form - Loading and Disabled States', () => {
    test('should show loading state during registration attempt', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);

        // Configure mock with delayed response to test loading state
        await mockFirebase.mockRegisterWithDelay(testUser, 100);

        await registerPage.navigate();

        // Fill form and verify it's enabled
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password1234');
        await registerPage.acceptAllPolicies();
        await registerPage.verifyFormEnabled();

        // Submit form
        await registerPage.submitForm();

        // Verify loading state is shown (all inputs and buttons should be disabled)
        await registerPage.verifyFormDisabled();

        // Wait for registration to complete and verify redirect
        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should disable submit button when form is incomplete', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Initially disabled (empty form)
        await registerPage.verifySubmitButtonDisabled();

        // Fill only some fields - should still be disabled
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail(toEmail('john@example.com'));
        await registerPage.verifySubmitButtonDisabled();

        // Fill password but not confirm password
        await registerPage.fillPassword('Password1234');
        await registerPage.verifySubmitButtonDisabled();

        // Fill confirm password but don't accept policies
        await registerPage.fillConfirmPassword('Password1234');
        await registerPage.verifySubmitButtonDisabled();

        // Accept only one policy checkbox
        await registerPage.toggleTermsCheckbox();
        await registerPage.verifySubmitButtonDisabled();

        // Accept second policy checkbox - should still be disabled
        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifySubmitButtonDisabled();

        // Accept third policy checkbox - should still be disabled
        await registerPage.togglePrivacyCheckbox();
        await registerPage.verifySubmitButtonDisabled();

        // Accept admin emails consent - should now be enabled
        await registerPage.checkAdminEmailsCheckbox();
        await registerPage.verifySubmitButtonEnabled();
    });

    test('should disable all interactive elements during loading state', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);
        await mockFirebase.mockRegisterWithDelay(testUser, 100);

        await registerPage.navigate();

        await registerPage.fillName(testUser.displayName);
        await registerPage.fillEmail(testUser.email);
        await registerPage.fillPassword('Password1234');
        await registerPage.fillConfirmPassword('Password1234');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Verify all form elements are disabled during loading
        await registerPage.verifyFormDisabled();

        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });
});

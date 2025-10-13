import { ClientUserBuilder, DashboardPage, RegisterPage, TEST_TIMEOUTS } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('Registration Authentication Flow', () => {
    test('should register successfully and navigate to dashboard', async ({ pageWithLogging: page, mockFirebase }) => {
        // 1. Create test user data
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('John Smith')
            .withEmail('john.smith@example.com')
            .build();
        const registerPage = new RegisterPage(page);

        // 2. Configure mock Firebase for successful registration
        mockFirebase.mockRegisterSuccess(testUser);

        // 3. Navigate to register page and verify it loaded
        await registerPage.navigate();

        // 4. Complete registration and navigate to dashboard (fluent interface)
        const dashboardPage = await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'SecurePassword123');

        // 5. Verify successful registration and navigation
        await expect(dashboardPage.getUserMenuButton()).toContainText(testUser.displayName);
        await expect(dashboardPage.getYourGroupsHeading()).toBeVisible();
    });

    test('should show error message for duplicate email', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        // 1. Navigate to register page
        await registerPage.navigate();

        // 2. Configure mock Firebase for duplicate email error
        mockFirebase.mockRegisterFailure({
            code: 'auth/email-already-in-use',
            message: 'An account with this email already exists.',
        });

        // 3. Attempt registration expecting failure (fluent interface)
        await registerPage.registerExpectingFailure('John Smith', 'existing@example.com', 'Password123');

        // 4. Verify error handling
        await registerPage.verifyErrorMessage('An account with this email already exists.');
    });

    test('should handle network errors gracefully', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        // 1. Navigate to register page first to ensure clean state
        await registerPage.navigate();

        // 2. Configure mock Firebase for network error
        mockFirebase.mockRegisterFailure({
            code: 'auth/network-request-failed',
            message: 'Network error. Please check your connection.',
        });

        // 3. Attempt registration expecting failure (fluent interface)
        await registerPage.registerExpectingFailure('Jane Doe', 'jane@example.com', 'Password123');

        // 4. Verify network error handling
        await registerPage.verifyErrorMessage('Network error. Please check your connection.');
    });

    test('should handle weak password error', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure mock Firebase for weak password error
        mockFirebase.mockRegisterFailure({
            code: 'auth/weak-password',
            message: 'Password is too weak. Please choose a stronger password.',
        });

        // Attempt registration with weak password (6 chars to pass client validation)
        await registerPage.registerExpectingFailure('Test User', 'test@example.com', '123456');

        // Verify error message
        await registerPage.verifyErrorMessage('Password is too weak. Please choose a stronger password.');
    });

    test('should handle invalid email format from backend', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure mock Firebase for invalid email error from backend
        mockFirebase.mockRegisterFailure({
            code: 'auth/invalid-email',
            message: 'This email address is invalid.',
        });

        // Attempt registration with validly formatted email that backend rejects
        await registerPage.registerExpectingFailure('Test User', 'badformat@example.com', 'Password123');

        // Verify backend error message is shown
        await registerPage.verifyErrorMessage('This email address is invalid.');
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
        await expect(dashboardPage.getUserMenuButton()).toContainText('Existing User');
    });

    test('should redirect to returnUrl after registration when present', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('New User')
            .withEmail('newuser@example.com')
            .build();
        const registerPage = new RegisterPage(page);

        mockFirebase.mockRegisterSuccess(testUser);

        const returnUrl = '/groups/test-group-id';
        await page.goto(`/register?returnUrl=${encodeURIComponent(returnUrl)}`);
        await registerPage.verifyRegisterPageLoaded();

        // Fill and submit manually (not using fluent method since we're checking returnUrl, not dashboard)
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password123');
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

        mockFirebase.mockRegisterSuccess(testUser);

        await registerPage.navigate();

        // Complete registration - should default to dashboard
        const dashboardPage = await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'Password123');

        await expect(page).toHaveURL(/\/dashboard/);
        await expect(dashboardPage.getUserMenuButton()).toContainText(testUser.displayName);
    });
});

test.describe('Registration Form - Loading and Disabled States', () => {
    test('should show loading state during registration attempt', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);

        // Configure mock with delayed response to test loading state
        mockFirebase.mockRegisterWithDelay(testUser, 1000);

        await registerPage.navigate();

        // Fill form and verify it's enabled
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password123');
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

        const submitButton = registerPage.getSubmitButton();

        // Initially disabled (empty form)
        await expect(submitButton).toBeDisabled();

        // Fill only some fields - should still be disabled
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');
        await expect(submitButton).toBeDisabled();

        // Fill password but not confirm password
        await registerPage.fillPassword('Password123');
        await expect(submitButton).toBeDisabled();

        // Fill confirm password but don't accept policies
        await registerPage.fillConfirmPassword('Password123');
        await expect(submitButton).toBeDisabled();

        // Accept only one policy checkbox
        await registerPage.toggleTermsCheckbox();
        await expect(submitButton).toBeDisabled();

        // Accept both policies - should now be enabled
        await registerPage.toggleCookiesCheckbox();
        await expect(submitButton).toBeEnabled();
    });

    test('should disable all interactive elements during loading state', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);
        mockFirebase.mockRegisterWithDelay(testUser, 1000);

        await registerPage.navigate();

        await registerPage.fillName(testUser.displayName);
        await registerPage.fillEmail(testUser.email);
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Verify all form elements are disabled during loading
        await registerPage.verifyFormDisabled();

        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });
});

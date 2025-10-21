import { ClientUserBuilder, DashboardPage, LoginPage, TEST_TIMEOUTS } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('Authentication Flow', () => {
    test('should log in successfully and navigate to dashboard', async ({ pageWithLogging: page, mockFirebase }) => {
        // 1. Create test user and login page
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const loginPage = new LoginPage(page);

        // 2. Configure mock Firebase for this test
        mockFirebase.mockLoginSuccess(testUser);

        // 3. Navigate to login page and verify it loaded
        await loginPage.navigate();

        // 4. Login with credentials and navigate to dashboard (fluent interface)
        const dashboardPage = await loginPage.loginAndNavigateToDashboard(testUser.email, 'password123');

        // 5. Verify successful login and navigation
        await dashboardPage.verifyAuthenticatedUser(testUser.displayName);
        await dashboardPage.verifyDashboardPageLoaded();
    });

    test('should show error message for invalid credentials', async ({ pageWithLogging: page, mockFirebase }) => {
        const loginPage = new LoginPage(page);

        // 1. Navigate to login page
        await loginPage.navigate();

        // 2. Configure mock Firebase for login failure
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        // 3. Attempt login expecting failure (fluent interface)
        await loginPage.loginExpectingFailure('test@example.com', 'wrong-password');

        // 4. Verify error handling
        await loginPage.verifyErrorMessage('Invalid email or password.');
    });

    test('should handle network errors gracefully', async ({ pageWithLogging: page, mockFirebase }) => {
        const loginPage = new LoginPage(page);

        // 1. Navigate to login page first to ensure clean state
        await loginPage.navigate();

        // 2. Configure mock Firebase for network error
        mockFirebase.mockLoginFailure({
            code: 'auth/network-request-failed',
            message: 'Network error. Please check your connection.',
        });

        // 3. Attempt login expecting failure (fluent interface)
        await loginPage.loginExpectingFailure('test@example.com', 'password123');

        // 4. Verify network error handling
        await loginPage.verifyErrorMessage('Network error. Please check your connection.');
    });
});

test.describe('Authentication Flow - Already Authenticated', () => {
    test('should redirect already authenticated user from login page', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        // Create authenticated user for this test
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('Test User')
            .build();

        await setupSuccessfulApiMocks(page);

        // Set up mock Firebase with authenticated user from the start
        await authenticatedMockFirebase(testUser);

        const dashboardPage = new DashboardPage(page);

        // Try to navigate to login page - should redirect immediately
        await page.goto('/login');

        // Should be redirected to dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await dashboardPage.verifyAuthenticatedUser('Test User');
        await dashboardPage.verifyDashboardPageLoaded();
    });
});

test.describe('LoginPage Reactivity and UI States', () => {
    test('should show loading state during login attempt', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const loginPage = new LoginPage(page);

        // Configure mock with delayed response to test loading state
        mockFirebase.mockLoginWithDelay(testUser, 100);

        await loginPage.navigate();

        // Fill form and verify it's enabled
        await loginPage.fillCredentials(testUser.email, 'password123');
        await loginPage.verifyFormEnabled();

        // Submit form
        await loginPage.submitForm();

        // Verify loading state is shown (all inputs and buttons should be disabled)
        await loginPage.verifyFormDisabled();

        // Wait for login to complete and verify redirect
        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should clear error state when component mounts', async ({ pageWithLogging: page, mockFirebase }) => {
        const loginPage = new LoginPage(page);

        await loginPage.navigate();

        // Configure mock Firebase for login failure
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        // Attempt login expecting failure (waits for error to appear)
        await loginPage.loginExpectingFailure('test@example.com', 'wrong-password');

        // Verify error appears
        await loginPage.verifyErrorMessage('Invalid email or password.');

        // Navigate away and back to login
        await page.goto('/');
        await loginPage.navigate();

        // Verify error is cleared on mount
        await loginPage.verifyNoErrorMessage();
    });

    // Note: Session storage persistence is better tested in e2e tests where browser
    // behavior is more realistic. Unit tests with mocks don't accurately reflect
    // real browser storage mechanisms and reload behavior.

    test('should disable submit button when form is empty', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // Initially disabled (empty form)
        await loginPage.verifySubmitButtonState(false);
    });

    test('should disable submit button when only one field is filled', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // Fill only email - should still be disabled
        await loginPage.fillEmail('test@example.com');
        await loginPage.verifySubmitButtonState(false);
    });

    test('should enable submit button when both email and password are filled', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // Fill both fields - should become enabled
        await loginPage.fillCredentials('test@example.com', 'password123');
        await loginPage.verifySubmitButtonState(true);
    });

    test('should reactively disable submit button when required field is cleared', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // Fill both fields - button should be enabled
        await loginPage.fillCredentials('test@example.com', 'password123');
        await loginPage.verifySubmitButtonState(true);

        // Clear email - should become disabled again
        await loginPage.fillEmail('');
        await loginPage.verifySubmitButtonState(false);

        // Fill valid email again - should become enabled
        await loginPage.fillEmail('test@example.com');
        await loginPage.verifySubmitButtonState(true);
    });

    test('should handle error state changes reactively', async ({ pageWithLogging: page, mockFirebase }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // First login attempt with error
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        // Use fluent method that waits for error
        await loginPage.loginExpectingFailure('test@example.com', 'wrong-password');

        // Verify error appears
        await loginPage.verifyErrorMessage('Invalid email or password.');

        // Change mock to success for second attempt
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        mockFirebase.mockLoginSuccess(testUser);

        // Refill password and submit again
        await loginPage.fillPassword('correct-password');
        await loginPage.submitForm();

        // Verify successful login (error should disappear and redirect occurs)
        await expect(page).toHaveURL('/dashboard');
    });

    test('should disable all interactive elements during loading state', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const loginPage = new LoginPage(page);
        mockFirebase.mockLoginWithDelay(testUser, 100);

        await loginPage.navigate();

        await loginPage.fillEmail(testUser.email);
        await loginPage.fillPassword('password123');
        await loginPage.submitForm();

        // Verify all form elements are disabled during loading
        await loginPage.verifyFormDisabled();

        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should navigate to register page with returnUrl preservation', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        const returnUrl = '/groups/test-group-id';

        await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        await loginPage.verifyLoginPageLoaded();

        // Click the sign-up link
        await loginPage.clickSignUp();

        // Verify navigation to register with preserved returnUrl
        await expect(page).toHaveURL(`/register?returnUrl=${encodeURIComponent(returnUrl)}`);
    });

    test('should navigate to register page without returnUrl when none present', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // Click the sign-up link
        await loginPage.clickSignUp();

        // Verify navigation to register without returnUrl
        await expect(page).toHaveURL('/register');
    });

    test('should handle returnUrl navigation after successful login', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const loginPage = new LoginPage(page);
        mockFirebase.mockLoginSuccess(testUser);

        const returnUrl = '/groups/test-group-id';
        await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        await loginPage.verifyLoginPageLoaded();

        // Fill and submit manually (not using fluent method since we're checking returnUrl, not dashboard)
        await loginPage.fillCredentials(testUser.email, 'password123');
        await loginPage.submitForm();

        // Should navigate to the returnUrl instead of dashboard
        await expect(page).toHaveURL(returnUrl);
    });

    test('should show validation errors for empty fields', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // Try to submit empty form
        await loginPage.verifySubmitButtonState(false);

        // Fill only email and verify submit is still disabled
        await loginPage.fillEmail('test@example.com');
        await loginPage.verifySubmitButtonState(false);

        // Fill only password and clear email
        await loginPage.fillEmail('');
        await loginPage.fillPassword('password123');
        await loginPage.verifySubmitButtonState(false);
    });
});

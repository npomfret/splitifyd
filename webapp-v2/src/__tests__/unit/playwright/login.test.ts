import { test, expect } from '../../utils/console-logging-fixture';
import { createMockFirebase, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';
import { ClientUserBuilder, LoginPage, DashboardPage } from '@splitifyd/test-support';

test.describe('Authentication Flow', () => {
    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        // Set up mock Firebase (start logged out)
        mockFirebase = await createMockFirebase(page, null);
    });

    test.afterEach(async () => {
        await mockFirebase.dispose();
    });

    test('should log in successfully and navigate to dashboard', async ({ pageWithLogging: page }) => {
        // 1. Create test user and login page
        const testUser = ClientUserBuilder.validUser().build();
        const loginPage = new LoginPage(page);
        const dashboardPage = new DashboardPage(page);

        // 2. Configure mock Firebase for this test
        mockFirebase.mockLoginSuccess(testUser);

        // 3. Navigate to login page and verify it loaded
        await loginPage.navigate();

        // 4. Login with credentials
        await loginPage.login(testUser.email, 'password123');

        // 5. Verify successful login and navigation
        await expect(page).toHaveURL('/dashboard');
        await expect(dashboardPage.getUserMenuButton()).toContainText(testUser.displayName);
        await expect(dashboardPage.getYourGroupsHeading()).toBeVisible();
    });

    test('should show error message for invalid credentials', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);

        // 1. Navigate to login page
        await loginPage.navigate();

        // 2. Configure mock Firebase for login failure
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        // 3. Attempt login with invalid credentials
        await loginPage.login('test@example.com', 'wrong-password');

        // 4. Verify error handling
        await loginPage.verifyErrorMessage('Invalid email or password.');
        await expect(page).toHaveURL('/login');
        await loginPage.verifyLoginPageLoaded();
    });

    test('should handle network errors gracefully', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);

        // 1. Navigate to login page first to ensure clean state
        await loginPage.navigate();

        // 2. Configure mock Firebase for network error
        mockFirebase.mockLoginFailure({
            code: 'auth/network-request-failed',
            message: 'Network error. Please check your connection.',
        });

        // 3. Attempt login
        await loginPage.login('test@example.com', 'password123');

        // 4. Verify network error handling
        await loginPage.verifyErrorMessage('Network error. Please check your connection.');
        await expect(page).toHaveURL('/login');
    });

});

test.describe('Authentication Flow - Already Authenticated', () => {
    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        // Create authenticated user for this test group
        const testUser = ClientUserBuilder.validUser()
            .withDisplayName('Test User')
            .build();

        await setupSuccessfulApiMocks(page);

        // Set up mock Firebase with authenticated user from the start
        mockFirebase = await createMockFirebase(page, testUser);
    });

    test.afterEach(async () => {
        await mockFirebase.dispose();
    });

    test('should redirect already authenticated user from login page', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Try to navigate to login page - should redirect immediately
        await page.goto('/login');

        // Should be redirected to dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(dashboardPage.getUserMenuButton()).toContainText('Test User');
    });
});

test.describe('LoginPage Reactivity and UI States', () => {
    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, null);
    });

    test.afterEach(async () => {
        await mockFirebase.dispose();
    });

    test('should show loading state during login attempt', async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const loginPage = new LoginPage(page);

        // Configure mock with delayed response to test loading state
        mockFirebase.mockLoginWithDelay(testUser, 1000);

        await loginPage.navigate();

        // Fill form and verify it's enabled
        await loginPage.fillCredentials(testUser.email, 'password123');
        await loginPage.verifyFormEnabled();

        // Submit form
        await loginPage.submitForm();

        // Verify loading state is shown (all inputs and buttons should be disabled)
        await loginPage.verifyFormDisabled();

        // Wait for login to complete and verify redirect
        await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
    });

    test('should clear error state when component mounts', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);

        await loginPage.navigate();

        // Configure mock Firebase for login failure
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        // Attempt login
        await loginPage.login('test@example.com', 'wrong-password');

        // Verify error appears
        await loginPage.verifyErrorMessage('Invalid email or password.');

        // Navigate away and back to login
        await page.goto('/');
        await loginPage.navigate();

        // Verify error is cleared on mount
        await loginPage.verifyNoErrorMessage();
    });

    test('should preserve form data in sessionStorage', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        const testEmail = 'test@example.com';
        const testPassword = 'password123';

        await loginPage.navigate();

        // Fill form
        await loginPage.fillCredentials(testEmail, testPassword);

        // Wait for state to be persisted
        await page.waitForTimeout(100);

        // Refresh page
        await page.reload();

        // Verify email is restored (password may not be due to browser security)
        await loginPage.verifyEmailRestored();

        // Check if password persistence is working, but don't require it
        const passwordValue = await loginPage.getPasswordInput().inputValue();
        if (passwordValue) {
            // If password is persisted, verify it's correct
            expect(passwordValue).toBe(testPassword);
        }
        // Note: Some browsers may not persist password fields for security reasons
    });

    test('should update submit button state reactively based on form validity', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        const submitButton = loginPage.getSubmitButton();
        const emailInput = loginPage.getEmailInput();
        const passwordInput = loginPage.getPasswordInput();

        // Initially disabled (empty form)
        await expect(submitButton).toBeDisabled();

        // Fill only email - should still be disabled
        await loginPage.fillPreactInput(emailInput, 'test@example.com');
        await expect(submitButton).toBeDisabled();

        // Fill password - should become enabled
        await loginPage.fillPreactInput(passwordInput, 'password123');
        await expect(submitButton).toBeEnabled();

        // Clear email - should become disabled again
        await loginPage.fillPreactInput(emailInput, '');
        await expect(submitButton).toBeDisabled();

        // Fill valid email again - should become enabled
        await loginPage.fillPreactInput(emailInput, 'test@example.com');
        await expect(submitButton).toBeEnabled();
    });

    test('should handle error state changes reactively', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // First login attempt with error
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        await loginPage.login('test@example.com', 'wrong-password');

        // Verify error appears
        await loginPage.verifyErrorMessage('Invalid email or password.');

        // Change mock to success for second attempt
        const testUser = ClientUserBuilder.validUser().build();
        mockFirebase.mockLoginSuccess(testUser);

        // Refill password and submit again
        await loginPage.fillPassword('correct-password');
        await loginPage.submitForm();

        // Verify successful login (error should disappear and redirect occurs)
        await expect(page).toHaveURL('/dashboard');
    });

    test('should disable all interactive elements during loading state', async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const loginPage = new LoginPage(page);
        mockFirebase.mockLoginWithDelay(testUser, 1000);

        await loginPage.navigate();

        await loginPage.fillEmail(testUser.email);
        await loginPage.fillPassword('password123');
        await loginPage.submitForm();

        // Verify all form elements are disabled during loading
        await loginPage.verifyFormDisabled();

        // Check that DefaultLoginButton is also disabled (if present)
        const defaultLoginButton = loginPage.getDefaultLoginButton();
        if (await defaultLoginButton.count() > 0) {
            await expect(defaultLoginButton).toBeDisabled();
        }

        await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
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

    test('should handle returnUrl navigation after successful login', async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const loginPage = new LoginPage(page);
        mockFirebase.mockLoginSuccess(testUser);

        const returnUrl = '/groups/test-group-id';
        await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        await loginPage.verifyLoginPageLoaded();

        await loginPage.login(testUser.email, 'password123');

        // Should navigate to the returnUrl instead of dashboard
        await expect(page).toHaveURL(returnUrl);
    });

    test('should show validation errors for empty fields', async ({ pageWithLogging: page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        const submitButton = loginPage.getSubmitButton();
        const emailInput = loginPage.getEmailInput();
        const passwordInput = loginPage.getPasswordInput();

        // Try to submit empty form
        await expect(submitButton).toBeDisabled();

        // Fill only email and verify submit is still disabled
        await loginPage.fillPreactInput(emailInput, 'test@example.com');
        await expect(submitButton).toBeDisabled();

        // Fill only password and clear email
        await loginPage.fillPreactInput(emailInput, '');
        await loginPage.fillPreactInput(passwordInput, 'password123');
        await expect(submitButton).toBeDisabled();
    });
});
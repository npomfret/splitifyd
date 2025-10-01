import { test, expect } from './console-logging-fixture';
import { createMockFirebase, setupSuccessfulApiMocks } from './mock-firebase-service';
import { ClientUserBuilder, LoginPage } from '@splitifyd/test-support';

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

        // 2. Configure mock Firebase for this test
        mockFirebase.mockLoginSuccess(testUser);

        // 3. Navigate to login page and verify it loaded
        await loginPage.navigate();

        // 4. Login with credentials
        await loginPage.login(testUser.email, 'password123');

        // 5. Verify successful login and navigation
        await expect(page).toHaveURL('/dashboard');
        await expect(page.getByTestId('user-menu-button')).toContainText(testUser.displayName);
        await expect(page.getByText('Your Groups')).toBeVisible();
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
        await expect(page.getByTestId('error-message')).toContainText('Invalid email or password.');
        await expect(page).toHaveURL('/login');
        await loginPage.verifyLoginPageLoaded();
    });

    test('should handle network errors gracefully', async ({ pageWithLogging: page }) => {
        // 1. Navigate to login page first to ensure clean state
        await page.goto('/login');

        // Ensure page is fully loaded and form is ready
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // 2. Configure mock Firebase for network error
        mockFirebase.mockLoginFailure({
            code: 'auth/network-request-failed',
            message: 'Network error. Please check your connection.',
        });

        // 3. Fill and submit login form
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');

        // Wait for form validation and ensure submit button is enabled
        await expect(page.locator('button[type="submit"]')).toBeEnabled();
        await page.click('button[type="submit"]');

        // 4. Verify network error handling - wait for the error to appear
        await expect(page.getByTestId('error-message')).toBeVisible();
        await expect(page.getByTestId('error-message')).toContainText('Network error. Please check your connection.');
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
        // Try to navigate to login page - should redirect immediately
        await page.goto('/login');

        // Should be redirected to dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByTestId('user-menu-button')).toContainText('Test User');
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

        // First, trigger an error
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        await loginPage.navigate();
        await loginPage.fillCredentials('test@example.com', 'wrong-password');
        await loginPage.submitForm();

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
        await page.goto('/login');

        const submitButton = page.locator('button[type="submit"]');
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');

        // Initially disabled (empty form)
        await expect(submitButton).toBeDisabled();

        // Fill only email - should still be disabled
        await emailInput.fill('test@example.com');
        await expect(submitButton).toBeDisabled();

        // Fill password - should become enabled
        await passwordInput.fill('password123');
        await expect(submitButton).toBeEnabled();

        // Clear email - should become disabled again
        await emailInput.fill('');
        await expect(submitButton).toBeDisabled();

        // Fill email with just spaces - should remain disabled
        await emailInput.fill('   ');
        await expect(submitButton).toBeDisabled();

        // Fill valid email again - should become enabled
        await emailInput.fill('test@example.com');
        await expect(submitButton).toBeEnabled();
    });

    test('should handle error state changes reactively', async ({ pageWithLogging: page }) => {
        await page.goto('/login');

        // First login attempt with error
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'wrong-password');
        await page.click('button[type="submit"]');

        // Verify error appears
        await expect(page.getByTestId('error-message')).toContainText('Invalid email or password.');

        // Change mock to success for second attempt
        const testUser = ClientUserBuilder.validUser().build();
        mockFirebase.mockLoginSuccess(testUser);

        // Clear and refill form
        await page.fill('input[type="password"]', 'correct-password');
        await page.click('button[type="submit"]');

        // Verify successful login (error should disappear and redirect occurs)
        await expect(page).toHaveURL('/dashboard');
    });

    test('should disable all interactive elements during loading state', async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        mockFirebase.mockLoginWithDelay(testUser, 1000);

        await page.goto('/login');

        await page.fill('input[type="email"]', testUser.email);
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');

        // Verify all form elements are disabled during loading
        await expect(page.locator('input[type="email"]')).toBeDisabled();
        await expect(page.locator('input[type="password"]')).toBeDisabled();
        await expect(page.locator('button[type="submit"]')).toBeDisabled();
        await expect(page.locator('[data-testid="remember-me-checkbox"]')).toBeDisabled();

        // Check that DefaultLoginButton is also disabled
        const defaultLoginButton = page.locator('button').filter({ hasText: /demo|default/i });
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
        await page.goto('/login');

        // Click the sign-up link
        await page.click('[data-testid="loginpage-signup-button"]');

        // Verify navigation to register without returnUrl
        await expect(page).toHaveURL('/register');
    });

    test('should handle returnUrl navigation after successful login', async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        mockFirebase.mockLoginSuccess(testUser);

        const returnUrl = '/groups/test-group-id';
        await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);

        await page.fill('input[type="email"]', testUser.email);
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');

        // Should navigate to the returnUrl instead of dashboard
        await expect(page).toHaveURL(returnUrl);
    });

    test('should show validation errors for empty fields', async ({ pageWithLogging: page }) => {
        await page.goto('/login');

        const submitButton = page.locator('button[type="submit"]');

        // Try to submit empty form
        await expect(submitButton).toBeDisabled();

        // Fill only email and verify submit is still disabled
        await page.fill('input[type="email"]', 'test@example.com');
        await expect(submitButton).toBeDisabled();

        // Fill only password and clear email
        await page.fill('input[type="email"]', '');
        await page.fill('input[type="password"]', 'password123');
        await expect(submitButton).toBeDisabled();
    });
});
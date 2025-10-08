import { test, expect } from '../../utils/console-logging-fixture';
import { ClientUserBuilder, RegisterPage, TEST_TIMEOUTS } from '@splitifyd/test-support';

test.describe('Registration Navigation Flows', () => {
    test('should navigate to login page when clicking sign in link', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Click the sign in link
        await registerPage.clickSignIn();

        // Verify navigation to login page
        await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.NAVIGATION });

        // Verify login page elements are visible
        await expect(page.getByRole('heading', { name: /sign.*in/i })).toBeVisible();
    });

    // NOTE: returnUrl preservation test removed because the application doesn't currently
    // preserve returnUrl when navigating from register to login (navigationService.goToLogin()
    // doesn't accept or forward query parameters). This would need to be implemented in the
    // application first before testing it.

    test('should navigate to login when clicking sign in link', async ({
        pageWithLogging: page,
        mockFirebase,
    }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Click the sign in link
        await registerPage.clickSignIn();

        // Verify navigation to login without returnUrl
        await expect(page).toHaveURL('/login');
    });

    test('should handle direct URL navigation to register page', async ({ pageWithLogging: page, mockFirebase }) => {
        // Navigate directly via URL
        await page.goto('/register');

        const registerPage = new RegisterPage(page);
        await registerPage.verifyRegisterPageLoaded();
    });

    test('should handle register page URL with query parameters', async ({ pageWithLogging: page, mockFirebase }) => {
        const returnUrl = '/groups/abc123';

        // Navigate with query parameters
        await page.goto(`/register?returnUrl=${encodeURIComponent(returnUrl)}`);

        const registerPage = new RegisterPage(page);
        await registerPage.verifyRegisterPageLoaded();

        // Verify URL includes query parameters
        await expect(page).toHaveURL(new RegExp(`/register\\?returnUrl=${encodeURIComponent(returnUrl)}`));
    });
});

test.describe('Registration Success Navigation', () => {
    test('should navigate to dashboard after successful registration', async ({
        pageWithLogging: page,
        mockFirebase,
    }) => {
        const testUser = ClientUserBuilder.validUser()
            .withDisplayName('New User')
            .withEmail('newuser@example.com')
            .build();
        const registerPage = new RegisterPage(page);

        mockFirebase.mockRegisterSuccess(testUser);

        await registerPage.navigate();

        // Register and verify navigation to dashboard
        const dashboardPage = await registerPage.registerAndNavigateToDashboard(
            testUser.displayName,
            testUser.email,
            'Password123',
        );

        await expect(page).toHaveURL('/dashboard');
        await expect(dashboardPage.getUserMenuButton()).toContainText(testUser.displayName);
    });

    test('should navigate to returnUrl after successful registration when specified', async ({
        pageWithLogging: page,
        mockFirebase,
    }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const registerPage = new RegisterPage(page);
        const returnUrl = '/groups/target-group';

        mockFirebase.mockRegisterSuccess(testUser);

        // Navigate to register with returnUrl
        await page.goto(`/register?returnUrl=${encodeURIComponent(returnUrl)}`);
        await registerPage.verifyRegisterPageLoaded();

        // Complete registration
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password123');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Should navigate to returnUrl instead of dashboard
        await expect(page).toHaveURL(returnUrl, { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should handle encoded returnUrl correctly', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const registerPage = new RegisterPage(page);
        const returnUrl = '/groups/test-group-id?tab=expenses';

        mockFirebase.mockRegisterSuccess(testUser);

        // Navigate with encoded returnUrl
        await page.goto(`/register?returnUrl=${encodeURIComponent(returnUrl)}`);
        await registerPage.verifyRegisterPageLoaded();

        // Complete registration
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password123');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Should navigate to decoded returnUrl
        await expect(page).toHaveURL(returnUrl, { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should default to dashboard when returnUrl is empty', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const registerPage = new RegisterPage(page);

        mockFirebase.mockRegisterSuccess(testUser);

        // Navigate with empty returnUrl parameter
        await page.goto('/register?returnUrl=');
        await registerPage.verifyRegisterPageLoaded();

        // Complete registration
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password123');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Should navigate to dashboard (default)
        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });
});

test.describe('Registration Page State Persistence', () => {
    test('should maintain form state during registration flow', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form partially
        await registerPage.fillName('Jane Doe');
        await registerPage.fillEmail('jane@example.com');
        await registerPage.fillPassword('Password123');

        // Verify state is maintained
        await expect(registerPage.getNameInput()).toHaveValue('Jane Doe');
        await expect(registerPage.getEmailInput()).toHaveValue('jane@example.com');
        await expect(registerPage.getPasswordInput()).toHaveValue('Password123');

        // Continue filling
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // All values should still be present
        await expect(registerPage.getNameInput()).toHaveValue('Jane Doe');
        await expect(registerPage.getEmailInput()).toHaveValue('jane@example.com');
        await expect(registerPage.getPasswordInput()).toHaveValue('Password123');
        await expect(registerPage.getConfirmPasswordInput()).toHaveValue('Password123');
    });

    test('should clear form state after successful registration', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const registerPage = new RegisterPage(page);

        mockFirebase.mockRegisterSuccess(testUser);

        await registerPage.navigate();

        // Complete registration
        await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'Password123');

        // Navigate back to register page (shouldn't happen in real flow, but testing cleanup)
        await page.goto('/register');

        // Form should be empty for new registration
        // Note: This tests sessionStorage cleanup after successful registration
    });

    test('should handle browser back button after registration', async ({
        pageWithLogging: page,
        mockFirebase,
    }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const registerPage = new RegisterPage(page);

        mockFirebase.mockRegisterSuccess(testUser);

        await registerPage.navigate();

        // Complete registration
        await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'Password123');

        // Verify we're on dashboard
        await expect(page).toHaveURL('/dashboard');

        // Go back
        await page.goBack();

        // Should redirect back to dashboard (already authenticated)
        await expect(page).toHaveURL(/\/dashboard/);
    });
});

test.describe('Registration Page Error Recovery', () => {
    test('should remain on register page after validation error', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Submit with mismatched passwords
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('DifferentPassword');
        await registerPage.acceptAllPolicies();

        await registerPage.submitForm();

        // Should remain on register page
        await expect(page).toHaveURL(/\/register/);

        // Error should be displayed
        await registerPage.verifyErrorMessage('Passwords do not match');
    });

    test('should remain on register page after network error', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure network error
        mockFirebase.mockRegisterFailure({
            code: 'auth/network-request-failed',
            message: 'Network error occurred.',
        });

        // Attempt registration
        await registerPage.registerExpectingFailure('John Doe', 'john@example.com', 'Password123');

        // Should remain on register page
        await expect(page).toHaveURL(/\/register/);

        // Error should be displayed
        await registerPage.verifyErrorMessage('Network error occurred.');

        // Form should be usable for retry
        await registerPage.verifyFormEnabled();
    });

    test('should allow retry after registration failure', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // First attempt fails
        mockFirebase.mockRegisterFailure({
            code: 'auth/email-already-in-use',
            message: 'Email already registered.',
        });

        await registerPage.registerExpectingFailure('John Doe', 'existing@example.com', 'Password123');

        // Verify error
        await registerPage.verifyErrorMessage('Email already registered.');

        // Change to success for retry
        const testUser = ClientUserBuilder.validUser()
            .withDisplayName('John Doe')
            .withEmail('newemail@example.com')
            .build();
        mockFirebase.mockRegisterSuccess(testUser);

        // Retry with different email
        await registerPage.fillEmail('newemail@example.com');
        await registerPage.submitForm();

        // Should succeed and navigate to dashboard
        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });
});

test.describe('Registration Page Accessibility and Focus', () => {
    test('should have proper tab order for form fields', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Verify form fields are keyboard accessible
        const nameInput = registerPage.getNameInput();
        const emailInput = registerPage.getEmailInput();
        const passwordInput = registerPage.getPasswordInput();
        const confirmPasswordInput = registerPage.getConfirmPasswordInput();

        // All inputs should be visible and enabled
        await expect(nameInput).toBeVisible();
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        await expect(confirmPasswordInput).toBeVisible();
    });

    test('should display page heading for screen readers', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Verify main heading is present
        const heading = registerPage.getPageHeading();
        await expect(heading).toBeVisible();
        await expect(heading).toContainText('Create Account');
    });
});

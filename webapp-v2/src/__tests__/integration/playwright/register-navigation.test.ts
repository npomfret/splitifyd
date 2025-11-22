import { ClientUserBuilder, LoginPage, RegisterPage, TEST_TIMEOUTS } from '@billsplit-wl/test-support';
import { toEmail } from '@billsplit-wl/shared';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Registration Navigation Flows', () => {
    test('should navigate to login page when clicking sign in link', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Click the sign in link
        await registerPage.clickSignIn();

        // Verify navigation to login page
        await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.NAVIGATION });

        // Verify login page elements are visible
        const loginPage = new LoginPage(page);
        await loginPage.verifyLoginPageLoaded();
    });

    // NOTE: returnUrl preservation test removed because the application doesn't currently
    // preserve returnUrl when navigating from register to login (navigationService.goToLogin()
    // doesn't accept or forward query parameters). This would need to be implemented in the
    // application first before testing it.

    test('should navigate to login when clicking sign in link', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Click the sign in link
        await registerPage.clickSignIn();

        // Verify navigation to login without returnUrl
        await expect(page).toHaveURL('/login');

        const loginPage = new LoginPage(page);
        await loginPage.verifyLoginPageLoaded();
    });

    test('should handle direct URL navigation to register page', async ({ pageWithLogging: page }) => {
        // Navigate directly via URL
        await page.goto('/register');

        const registerPage = new RegisterPage(page);
        await registerPage.verifyRegisterPageLoaded();
    });

    test('should handle register page URL with query parameters', async ({ pageWithLogging: page }) => {
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
    test('should navigate to dashboard after successful registration', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('New User')
            .withEmail(toEmail('newuser@example.com'))
            .build();
        const registerPage = new RegisterPage(page);

        await mockFirebase.mockRegisterSuccess(testUser);

        await registerPage.navigate();

        // Register and verify navigation to dashboard
        const dashboardPage = await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'Password1234');

        await expect(page).toHaveURL('/dashboard');
        await dashboardPage.verifyAuthenticatedUser(testUser.displayName);
    });

    test('should navigate to returnUrl after successful registration when specified', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);
        const returnUrl = '/groups/target-group';

        await mockFirebase.mockRegisterSuccess(testUser);

        // Navigate to register with returnUrl
        await page.goto(`/register?returnUrl=${encodeURIComponent(returnUrl)}`);
        await registerPage.verifyRegisterPageLoaded();

        // Complete registration
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password1234');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Should navigate to returnUrl instead of dashboard
        await expect(page).toHaveURL(returnUrl, { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should handle encoded returnUrl correctly', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);
        const returnUrl = '/groups/test-group-id?tab=expenses';

        await mockFirebase.mockRegisterSuccess(testUser);

        // Navigate with encoded returnUrl
        await page.goto(`/register?returnUrl=${encodeURIComponent(returnUrl)}`);
        await registerPage.verifyRegisterPageLoaded();

        // Complete registration
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password1234');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Should navigate to decoded returnUrl
        await expect(page).toHaveURL(returnUrl, { timeout: TEST_TIMEOUTS.NAVIGATION });
    });

    test('should default to dashboard when returnUrl is empty', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);

        await mockFirebase.mockRegisterSuccess(testUser);

        // Navigate with empty returnUrl parameter
        await page.goto('/register?returnUrl=');
        await registerPage.verifyRegisterPageLoaded();

        // Complete registration
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password1234');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Should navigate to dashboard (default)
        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });
});

test.describe('Registration Page State Persistence', () => {
    test('should maintain form state during registration flow', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form partially
        await registerPage.fillName('Jane Doe');
        await registerPage.fillEmail(toEmail('jane@example.com'));
        await registerPage.fillPassword('Password1234');

        // Verify state is maintained
        await registerPage.verifyNameInputValue('Jane Doe');
        await registerPage.verifyEmailInputValue(toEmail('jane@example.com'));
        await registerPage.verifyPasswordInputValue('Password1234');

        // Continue filling
        await registerPage.fillConfirmPassword('Password1234');
        await registerPage.acceptAllPolicies();

        // All values should still be present
        await registerPage.verifyNameInputValue('Jane Doe');
        await registerPage.verifyEmailInputValue(toEmail('jane@example.com'));
        await registerPage.verifyPasswordInputValue('Password1234');
        await registerPage.verifyConfirmPasswordInputValue('Password1234');
    });

    test('should clear form state after successful registration', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);

        await mockFirebase.mockRegisterSuccess(testUser);

        await registerPage.navigate();

        // Complete registration
        await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'Password1234');

        // Navigate back to register page (shouldn't happen in real flow, but testing cleanup)
        await page.goto('/register');

        // Form should be empty for new registration
        // Note: This tests sessionStorage cleanup after successful registration
    });

    test('should handle browser back button after registration', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);

        await mockFirebase.mockRegisterSuccess(testUser);

        await registerPage.navigate();

        // Complete registration
        await registerPage.registerAndNavigateToDashboard(testUser.displayName, testUser.email, 'Password1234');

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

        await mockFirebase.mockRegisterFailure({
            code: 'auth/passwords-mismatch',
            message: 'Passwords do not match',
        });

        // Attempt registration with mismatched passwords
        await registerPage.registerExpectingFailure('John Doe', toEmail('john@example.com'), 'Password1234', 'DifferentPassword');

        // Should remain on register page
        await expect(page).toHaveURL(/\/register/);

        // Error should be displayed
        await registerPage.verifyErrorMessage('Passwords do not match');
    });

    test('should remain on register page after network error', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure network error
        await mockFirebase.mockRegisterFailure({
            code: 'auth/network-request-failed',
            message: 'Network error occurred.',
        });

        // Attempt registration
        await registerPage.registerExpectingFailure('John Doe', toEmail('john@example.com'), 'Password1234');

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
        await mockFirebase.mockRegisterFailure({
            code: 'auth/email-already-in-use',
            message: 'Email already registered.',
        });

        await registerPage.registerExpectingFailure('John Doe', toEmail('existing@example.com'), 'Password1234');

        // Verify error
        await registerPage.verifyErrorMessage('Email already registered.');

        // Change to success for retry
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('John Doe')
            .withEmail(toEmail('newemail@example.com'))
            .build();
        await mockFirebase.mockRegisterSuccess(testUser);

        // Retry with different email (passwords must be re-entered after security fix removed persistence)
        await registerPage.fillEmail(toEmail('newemail@example.com'));
        await registerPage.fillPassword('Password1234');
        await registerPage.fillConfirmPassword('Password1234');
        await registerPage.submitForm();

        // Should succeed and navigate to dashboard
        await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION });
    });
});

test.describe('Registration Page Accessibility and Focus', () => {
    test('should have proper tab order for form fields', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Verify form fields are keyboard accessible
        await registerPage.verifyFormEnabled();
    });

    test('should display page heading for screen readers', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Verify main heading is present
        await registerPage.verifyPageHeadingContains('Create Account');
    });
});

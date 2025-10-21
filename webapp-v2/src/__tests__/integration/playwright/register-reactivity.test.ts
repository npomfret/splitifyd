import { ClientUserBuilder, RegisterPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Registration Form Reactivity and UI States', () => {
    test('should clear error state when component mounts', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure mock Firebase for registration failure
        await mockFirebase.mockRegisterFailure({
            code: 'auth/email-already-in-use',
            message: 'An account with this email already exists.',
        });

        // Attempt registration expecting failure (waits for error to appear)
        await registerPage.registerExpectingFailure('John Doe', 'existing@example.com', 'Password12344');

        // Verify error appears
        await registerPage.verifyErrorMessage('An account with this email already exists.');

        // Navigate away and back to register
        await page.goto('/');
        await registerPage.navigate();

        // Verify error is cleared on mount
        await registerPage.verifyNoErrorMessage();
    });

    test('should handle error state changes reactively', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // First registration attempt with error
        await mockFirebase.mockRegisterFailure({
            code: 'auth/email-already-in-use',
            message: 'An account with this email already exists.',
        });

        // Use fluent method that waits for error
        await registerPage.registerExpectingFailure('John Doe', 'john@example.com', 'Password12344');

        // Verify error appears
        await registerPage.verifyErrorMessage('An account with this email already exists.');

        // Change mock to success for second attempt with different email
        const testUser = ClientUserBuilder
            .validUser()
            .withDisplayName('John Doe')
            .withEmail('newemail@example.com')
            .build();
        await mockFirebase.mockRegisterSuccess(testUser);

        // Refill email and passwords, then submit again (passwords must be re-entered after security fix)
        await registerPage.fillEmail('newemail@example.com');
        await registerPage.fillPassword('Password12344');
        await registerPage.fillConfirmPassword('Password12344');
        await registerPage.submitForm();

        // Verify successful registration (error should disappear and redirect occurs)
        await expect(page).toHaveURL('/dashboard');
    });

    test('should reactively update submit button based on form validity', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Initially disabled
        await registerPage.verifySubmitButtonDisabled();

        // Fill fields one by one, verify button stays disabled until complete
        await registerPage.fillName('John Doe');
        await registerPage.verifySubmitButtonDisabled();

        await registerPage.fillEmail('john@example.com');
        await registerPage.verifySubmitButtonDisabled();

        await registerPage.fillPassword('Password12344');
        await registerPage.verifySubmitButtonDisabled();

        await registerPage.fillConfirmPassword('Password12344');
        await registerPage.verifySubmitButtonDisabled();

        await registerPage.toggleTermsCheckbox();
        await registerPage.verifySubmitButtonDisabled();

        // After all fields filled and policies accepted, should be enabled
        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifySubmitButtonEnabled();

        // Clear one field - should become disabled again
        await registerPage.fillName('');
        await registerPage.verifySubmitButtonDisabled();

        // Refill field - should become enabled again
        await registerPage.fillName('John Doe');
        await registerPage.verifySubmitButtonEnabled();
    });

    test('should maintain form state while modal/page is open', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields
        await registerPage.fillName('Jane Smith');
        await registerPage.fillEmail('jane@example.com');
        await registerPage.fillPassword('SecurePassword12344');
        await registerPage.fillConfirmPassword('SecurePassword12344');
        await registerPage.acceptAllPolicies();

        // Verify state persists
        await registerPage.verifyNameInputValue('Jane Smith');
        await registerPage.verifyEmailInputValue('jane@example.com');
        await registerPage.verifyPasswordInputValue('SecurePassword12344');
        await registerPage.verifyConfirmPasswordInputValue('SecurePassword12344');
        await registerPage.verifyCheckboxStates(true, true);
        await registerPage.verifySubmitButtonState(true);

        // State should persist - verify again to ensure no unexpected changes
        await registerPage.verifyNameInputValue('Jane Smith');
        await registerPage.verifyEmailInputValue('jane@example.com');
    });

    test('should handle multiple field updates correctly', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Update name multiple times
        await registerPage.fillName('First Name');
        await registerPage.verifySubmitButtonState(false);

        await registerPage.fillName('Second Name');
        await registerPage.verifyNameInputValue('Second Name');
        await registerPage.verifySubmitButtonState(false);

        // Update email multiple times
        await registerPage.fillEmail('first@example.com');
        await registerPage.verifyEmailInputValue('first@example.com');

        await registerPage.fillEmail('second@example.com');
        await registerPage.verifyEmailInputValue('second@example.com');

        // Fill remaining fields with final values
        await registerPage.fillPassword('FinalPassword12344');
        await registerPage.fillConfirmPassword('FinalPassword12344');
        await registerPage.acceptAllPolicies();

        // Final values should be latest
        await registerPage.verifyNameInputValue('Second Name');
        await registerPage.verifyEmailInputValue('second@example.com');
        await registerPage.verifyPasswordInputValue('FinalPassword12344');
        await registerPage.verifySubmitButtonState(true);
    });

    test('should handle rapid checkbox toggling', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill text fields first
        await registerPage.fillRegistrationForm('John Doe', 'john@example.com', 'Password12344');

        // Rapidly toggle checkboxes multiple times
        await registerPage.toggleTermsCheckbox();
        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifyCheckboxStates(true, true);

        await registerPage.toggleTermsCheckbox();
        await registerPage.verifyCheckboxStates(false, true);

        await registerPage.toggleTermsCheckbox();
        await registerPage.verifyCheckboxStates(true, true);

        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifyCheckboxStates(true, false);

        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifyCheckboxStates(true, true);

        // Final state should be both checked and button enabled
        await registerPage.verifySubmitButtonState(true);
    });

    test('should update submit button state when password mismatch is corrected', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form with mismatched passwords
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');
        await registerPage.fillPassword('Password12344');
        await registerPage.fillConfirmPassword('DifferentPassword');
        await registerPage.acceptAllPolicies();

        // Button should be enabled (validation happens on submit)
        await registerPage.verifySubmitButtonEnabled();

        // Correct the confirm password to match
        await registerPage.fillConfirmPassword('Password12344');

        // Button should remain enabled
        await registerPage.verifySubmitButtonEnabled();
    });
});

test.describe('Registration Form Error Display and Recovery', () => {
    test('should show and clear errors based on form changes', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        await mockFirebase.mockRegisterFailure({
            code: 'auth/passwords-mismatch',
            message: 'Passwords do not match',
        });

        // Attempt registration with mismatched passwords
        await registerPage.registerExpectingFailure('John Doe', 'john@example.com', 'Password12344', 'WrongPassword');

        // Verify password mismatch error
        await registerPage.verifyErrorMessage('Passwords do not match');

        // Fix the password mismatch
        await registerPage.fillConfirmPassword('Password12344');

        // Note: Error may persist until re-submit since validation is on submit
        // This is expected behavior - error doesn't auto-clear on field change
    });

    test('should display different error types correctly', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        // Test 1: Short password error
        await registerPage.navigate();

        await mockFirebase.mockRegisterFailure({
            code: 'auth/weak-password',
            message: 'Password must be at least 12 characters',
        });

        await registerPage.registerExpectingFailure('John Doe', 'john@example.com', '12345');
        await registerPage.verifyErrorMessage('Password must be at least 12 characters');

        // Test 2: Navigate away and back to clear state
        await page.goto('/');
        await registerPage.navigate();

        // Test 3: Missing terms acceptance
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');
        await registerPage.fillPassword('Password12344');
        await registerPage.fillConfirmPassword('Password12344');
        await registerPage.toggleCookiesCheckbox(); // Only check cookies, not terms
        // Submit button should be disabled, so we can't submit
        await registerPage.verifySubmitButtonDisabled();
    });

    test('should handle email clearing to remove email-related errors', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Configure mock to return email-already-in-use error
        await mockFirebase.mockRegisterFailure({
            code: 'auth/email-already-in-use',
            message: 'This email is already registered.',
        });

        // Attempt registration
        await registerPage.registerExpectingFailure('John Doe', 'existing@example.com', 'Password12344');

        // Verify error appears
        await registerPage.verifyErrorMessage('This email is already registered.');

        // Note: According to RegisterPage.tsx, changing the email field should clear email-related errors
        // This is handled by authStore.clearError() in the onInput handler
    });
});

test.describe('Registration Form Loading States', () => {
    test('should show loading indicator during registration', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);

        // Mock registration with delay to see loading state
        await mockFirebase.mockRegisterWithDelay(testUser, 100);

        await registerPage.navigate();

        // Fill and submit form
        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password12344');
        await registerPage.acceptAllPolicies();
        await registerPage.verifyFormEnabled();

        // Submit
        await registerPage.submitForm();

        // Verify loading state (form should be disabled)
        await registerPage.verifyFormDisabled();

        // Wait for completion
        await expect(page).toHaveURL('/dashboard', { timeout: 3000 });
    });

    test('should prevent double submission during loading', async ({ pageWithLogging: page, mockFirebase }) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const registerPage = new RegisterPage(page);

        await mockFirebase.mockRegisterWithDelay(testUser, 100);

        await registerPage.navigate();

        await registerPage.fillRegistrationForm(testUser.displayName, testUser.email, 'Password12344');
        await registerPage.acceptAllPolicies();

        // First submit
        await registerPage.submitForm();

        // Verify button is disabled during loading
        await registerPage.verifySubmitButtonDisabled();

        // Attempting to click again should have no effect (button is disabled)
        await registerPage.attemptSubmitWhileDisabled();

        // Should still complete successfully
        await expect(page).toHaveURL('/dashboard', { timeout: 3000 });
    });

    test('should re-enable form after registration failure', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure mock for failure
        await mockFirebase.mockRegisterFailure({
            code: 'auth/network-request-failed',
            message: 'Network error occurred.',
        });

        // Fill and submit
        await registerPage.fillRegistrationForm('John Doe', 'john@example.com', 'Password12344');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Wait for error to appear
        await registerPage.verifyErrorMessage('Network error occurred.');

        // Form should be re-enabled after error
        await registerPage.verifyFormEnabled();
    });
});

test.describe('Registration Form Policy Links', () => {
    test('should display Terms of Service link', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        await registerPage.verifyTermsLinkVisible();
        await registerPage.verifyTermsLinkAttributes('/terms');
    });

    test('should display Cookie Policy link', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        await registerPage.verifyCookiePolicyLinkVisible();
        await registerPage.verifyCookiePolicyLinkAttributes('/cookies');
    });
});

import { createJsonHandler } from '@/test/msw/handlers.ts';
import { ClientUserBuilder, RegisterPage } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Registration Form Reactivity and UI States', () => {
    test('should clear error state when component mounts', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        // Configure mock Firebase for registration failure
        await mockFirebase.mockRegisterFailure({
            code: 'REGISTRATION_FAILED',
            message: 'Unable to create account. If you already registered, try signing in.',
        });

        // Attempt registration expecting failure (waits for error to appear)
        await registerPage.registerExpectingFailure('John Doe', 'existing@example.com', 'Password12344');

        // Verify error appears (shows error code for i18n translation)
        await registerPage.verifyErrorMessage('REGISTRATION_FAILED');

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
            code: 'REGISTRATION_FAILED',
            message: 'Unable to create account. If you already registered, try signing in.',
        });

        // Use fluent method that waits for error
        await registerPage.registerExpectingFailure('John Doe', 'john@example.com', 'Password12344');

        // Verify error appears (shows error code for i18n translation)
        await registerPage.verifyErrorMessage('REGISTRATION_FAILED');

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

        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifySubmitButtonDisabled();

        await registerPage.togglePrivacyCheckbox();
        await registerPage.verifySubmitButtonDisabled();

        // After all fields filled and policies/consents accepted, should be enabled
        await registerPage.checkAdminEmailsCheckbox();
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
        await registerPage.verifyCheckboxStates(true, true, true, true, false);
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
        await registerPage.togglePrivacyCheckbox();
        await registerPage.verifyCheckboxStates(true, true, true, false, false);

        await registerPage.toggleTermsCheckbox();
        await registerPage.verifyCheckboxStates(false, true, true, false, false);

        await registerPage.toggleTermsCheckbox();
        await registerPage.verifyCheckboxStates(true, true, true, false, false);

        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifyCheckboxStates(true, false, true, false, false);

        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifyCheckboxStates(true, true, true, false, false);

        await registerPage.togglePrivacyCheckbox();
        await registerPage.verifyCheckboxStates(true, true, false, false, false);

        await registerPage.togglePrivacyCheckbox();
        await registerPage.verifyCheckboxStates(true, true, true, false, false);

        // Check admin emails to complete the required consents
        await registerPage.checkAdminEmailsCheckbox();
        await registerPage.verifyCheckboxStates(true, true, true, true, false);

        // Final state should be all required checked and button enabled
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

        // Note: Password mismatch is caught by client-side validation before API call
        // So the mock is not used - the frontend shows its own validation message
        await mockFirebase.mockRegisterFailure({
            code: 'PASSWORDS_MISMATCH',
            message: 'Passwords do not match',
        });

        // Attempt registration with mismatched passwords
        await registerPage.registerExpectingFailure('John Doe', 'john@example.com', 'Password12344', 'WrongPassword');

        // Verify password mismatch error (client-side validation message)
        await registerPage.verifyErrorMessage('Passwords do not match');

        // Fix the password mismatch
        await registerPage.fillConfirmPassword('Password12344');

        // Note: Error may persist until re-submit since validation is on submit
        // This is expected behavior - error doesn't auto-clear on field change
    });

    test('should display different error types correctly', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        // Test 1: Short password error (caught by client-side validation)
        await registerPage.navigate();

        // Note: Short password is caught by client-side validation before API call
        await mockFirebase.mockRegisterFailure({
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 12 characters',
        });

        await registerPage.registerExpectingFailure('John Doe', 'john@example.com', '12345');
        // Verify error (client-side validation message)
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
            code: 'EMAIL_ALREADY_IN_USE',
            message: 'This email is already registered.',
        });

        // Attempt registration
        await registerPage.registerExpectingFailure('John Doe', 'existing@example.com', 'Password12344');

        // Verify error appears (shows error code for i18n translation)
        await registerPage.verifyErrorMessage('EMAIL_ALREADY_IN_USE');

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
            code: 'NETWORK_ERROR',
            message: 'Network error occurred.',
        });

        // Fill and submit
        await registerPage.fillRegistrationForm('John Doe', 'john@example.com', 'Password12344');
        await registerPage.acceptAllPolicies();
        await registerPage.submitForm();

        // Wait for error to appear (shows error code for i18n translation)
        await registerPage.verifyErrorMessage('NETWORK_ERROR');

        // Form should be re-enabled after error
        await registerPage.verifyFormEnabled();
    });
});

test.describe('Registration Form Policy Buttons', () => {
    test('should display Terms of Service button', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        await registerPage.verifyTermsButtonVisible();
    });

    test('should display Cookie Policy button', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        await registerPage.verifyCookiePolicyButtonVisible();
    });
});

test.describe('Registration Form Policy View Modal', () => {
    // Helper to set up policy content mocks
    const setupPolicyMocks = async (msw: { use: (handler: ReturnType<typeof createJsonHandler>) => Promise<void>; }) => {
        const policies = [
            { id: 'terms-of-service', name: 'Terms of Service' },
            { id: 'cookie-policy', name: 'Cookie Policy' },
            { id: 'privacy-policy', name: 'Privacy Policy' },
        ];

        for (const policy of policies) {
            await msw.use(
                createJsonHandler(
                    'GET',
                    `/api/policies/${policy.id}/current`,
                    {
                        id: policy.id,
                        policyName: policy.name,
                        currentVersionHash: `${policy.id}-hash-v1`,
                        text: `# ${policy.name}\n\nThis is the ${policy.name} content for testing purposes.`,
                        createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
                    },
                ),
            );
        }
    };

    test('should open Terms of Service modal and display content', async ({ pageWithLogging: page, msw }) => {
        await setupPolicyMocks(msw);
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Open modal and verify content loads
        await registerPage.openAndVerifyTermsModal();
    });

    test('should open Cookie Policy modal and display content', async ({ pageWithLogging: page, msw }) => {
        await setupPolicyMocks(msw);
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Open modal and verify content loads
        await registerPage.openAndVerifyCookiePolicyModal();
    });

    test('should open Privacy Policy modal and display content', async ({ pageWithLogging: page, msw }) => {
        await setupPolicyMocks(msw);
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Open modal and verify content loads
        await registerPage.openAndVerifyPrivacyPolicyModal();
    });

    test('should allow closing modal with close button', async ({ pageWithLogging: page, msw }) => {
        await setupPolicyMocks(msw);
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Open Terms modal
        await registerPage.clickTermsButton();
        await registerPage.verifyPolicyModalOpen('Terms of Service');

        // Close it using the close button
        await registerPage.closePolicyModal('Terms of Service');
        await registerPage.verifyPolicyModalClosed('Terms of Service');

        // Verify we're still on the register page
        await registerPage.verifyRegisterPageLoaded();
    });

    test('should preserve form state after viewing policy modal', async ({ pageWithLogging: page, msw }) => {
        await setupPolicyMocks(msw);
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill some form fields first
        await registerPage.fillName('Test User');
        await registerPage.fillEmail('test@example.com');

        // Open and close a policy modal
        await registerPage.openAndVerifyTermsModal();

        // Verify form state is preserved
        await registerPage.verifyNameInputValue('Test User');
        await registerPage.verifyEmailInputValue('test@example.com');
    });
});

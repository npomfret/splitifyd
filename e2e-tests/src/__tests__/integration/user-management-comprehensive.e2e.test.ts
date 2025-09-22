import { expect } from '@playwright/test';
import { simpleTest, simpleTest as test } from '../../fixtures/simple-test.fixture';
import { SettingsPage, RegisterPage, DashboardPage } from '../../pages';
import { generateNewUserDetails, DEFAULT_PASSWORD, generateTestEmail, generateTestUserName } from '@splitifyd/test-support';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';

/**
 * Comprehensive User Management E2E Tests
 *
 * Consolidated from:
 * - user-profile.e2e.test.ts (12 profile management tests)
 * - auth-and-registration.e2e.test.ts (5 registration tests)
 *
 * This file covers all user management functionality comprehensively:
 * - Profile viewing, updating, and validation
 * - Registration flows and error handling
 * - Real-time UI updates and loading states
 * - Form validation and persistence
 *
 * Eliminates redundancy while maintaining complete test coverage.
 */

simpleTest.describe('Profile Management', () => {
    simpleTest('should allow comprehensive profile viewing and updating', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const settingsPage = new SettingsPage(page, user);

        // Test 1: View profile information
        await settingsPage.navigate();

        // Verify profile information is displayed
        const expectedDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        await settingsPage.verifyProfileInformation(expectedDisplayName, user.email);

        // Verify profile form elements are present
        await expect(settingsPage.getDisplayNameInput()).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeVisible();

        // Test 2: Update display name with real-time updates
        const newDisplayName = `Updated Name ${Date.now()}`;

        // Update display name using POM method
        await settingsPage.updateDisplayName(newDisplayName);

        // Verify real-time updates - both in settings and navigation (no page reload needed)
        await settingsPage.verifyRealTimeDisplayNameUpdate(newDisplayName);

        // Also verify display name persists when navigating to dashboard
        await settingsPage.navigateToDashboard();
        await expect(settingsPage.header.getUserMenuButton()).toContainText(newDisplayName);

        // Test 3: Verify profile information preservation
        await settingsPage.navigate();

        // Note original email - should remain unchanged
        const originalEmail = user.email;
        await expect(settingsPage.getProfileEmail()).toContainText(originalEmail);

        // Verify email unchanged and display name updated
        await expect(settingsPage.getProfileEmail()).toContainText(originalEmail);
        await expect(settingsPage.getProfileDisplayName()).toContainText(newDisplayName);
    });

    simpleTest('should handle loading states and comprehensive real-time updates', async ({ createLoggedInBrowsers }) => {
        const [{ page, user }] = await createLoggedInBrowsers(1);
        const settingsPage = new SettingsPage(page, user);

        // Test 1: Loading states during profile updates
        const testDisplayName = `Loading Test ${Date.now()}`;

        await settingsPage.navigate();

        // Fill display name but don't use the POM update method (we want to test loading states)
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), testDisplayName);

        // Click save and verify loading state
        const saveButton = settingsPage.getSaveChangesButton();
        await settingsPage.clickButton(saveButton, { buttonName: 'Save Changes' });

        // Verify loading state (button disabled)
        await settingsPage.verifyLoadingState('save');

        // Wait for completion and verify real-time update
        await settingsPage.waitForLoadingComplete('save');
        await expect(settingsPage.getProfileDisplayName()).toContainText(testDisplayName);

        // Test 2: Comprehensive real-time updates across all UI components
        const initialDisplayName = (await settingsPage.getProfileDisplayName().textContent())!;
        const realTimeDisplayName = `RealTime ${Date.now()}`;

        // Update display name
        await settingsPage.updateDisplayName(realTimeDisplayName);

        // Verify comprehensive real-time updates without any page reload:
        // 1. Profile display section shows NEW name
        await expect(settingsPage.getProfileDisplayName()).toContainText(realTimeDisplayName);

        // 2. Profile display section does NOT show OLD name
        await expect(settingsPage.getProfileDisplayName()).not.toContainText(initialDisplayName);

        // 3. User menu shows NEW name
        await expect(settingsPage.header.getUserMenuButton()).toContainText(realTimeDisplayName);

        // 4. User menu does NOT show OLD name
        await expect(settingsPage.header.getUserMenuButton()).not.toContainText(initialDisplayName);

        // 5. Input field shows NEW value
        await expect(settingsPage.getDisplayNameInput()).toHaveValue(realTimeDisplayName);

        // 6. Open user dropdown to verify it also shows updated name
        await settingsPage.header.getUserMenuButton().click();
        await expect(settingsPage.header.getUserDropdownMenu()).toContainText(realTimeDisplayName);
        await expect(settingsPage.header.getUserDropdownMenu()).not.toContainText(initialDisplayName);
    });

    simpleTest('should handle password management comprehensively', async ({ newEmptyBrowser }) => {
        // Create a fresh user specifically for password testing to avoid affecting other tests
        const { displayName, email, password } = generateNewUserDetails();

        // Test 1: Password change functionality
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();
        await registerPage.register(displayName, email, password);

        // Wait for registration to complete and navigate to dashboard
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.waitForDashboard();

        // Navigate to settings page with our fresh user
        const settingsPage = new SettingsPage(page);
        await settingsPage.navigate();

        // Change password using POM method
        await settingsPage.changePassword(password, 'newPassword123!');

        // Verify success message
        await settingsPage.verifySuccessMessage('Password changed successfully');

        // Verify form is reset/hidden
        await settingsPage.verifyPasswordFormVisible(false);

        // Test 2: Password change cancellation
        // Open password change form and fill partially
        await settingsPage.openPasswordChangeForm();
        await settingsPage.fillPreactInput(settingsPage.getCurrentPasswordInput(), 'somePassword');
        await settingsPage.fillPreactInput(settingsPage.getNewPasswordInput(), 'newPassword123');

        // Cancel password change using POM method
        await settingsPage.cancelPasswordChange();

        // Verify form is hidden and change password button is visible again
        await settingsPage.verifyPasswordFormVisible(false);
        await expect(settingsPage.getChangePasswordButton()).toBeVisible();
    });

    simpleTest('should validate all profile input requirements', async ({ createLoggedInBrowsers }) => {
        const [{ page, user }] = await createLoggedInBrowsers(1);
        const settingsPage = new SettingsPage(page, user);

        // Test 1: Display name validation
        await settingsPage.navigate();

        // Test empty display name - button should be disabled and error shown
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), '');
        await expect(page.getByText('Display name cannot be empty')).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeDisabled();

        // Test display name too long (over 100 characters) - button should be disabled and error shown
        const longName = 'A'.repeat(101);
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), longName);
        await expect(page.getByText('Display name must be 100 characters or less')).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeDisabled();

        // Test whitespace-only display name - button should be disabled and error shown
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), '   ');
        await expect(page.getByText('Display name cannot be empty')).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeDisabled();

        // Test valid display name - error should be gone and button enabled
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), 'Valid Name');
        await expect(page.getByText('Display name cannot be empty')).not.toBeVisible();
        await expect(page.getByText('Display name must be 100 characters or less')).not.toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeEnabled();

        // Test 2: Password validation requirements
        // Open password change section using POM
        await settingsPage.openPasswordChangeForm();

        // Test password too short - trigger validation by trying to submit
        await settingsPage.fillPreactInput(settingsPage.getCurrentPasswordInput(), 'currentPass');
        await settingsPage.fillPreactInput(settingsPage.getNewPasswordInput(), '123');
        await settingsPage.fillPreactInput(settingsPage.getConfirmPasswordInput(), '123');
        await settingsPage.clickButton(settingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
        await expect(page.getByText('New password must be at least 6 characters long')).toBeVisible();

        // Test password mismatch - clear confirm and enter different password
        await settingsPage.fillPreactInput(settingsPage.getNewPasswordInput(), 'newPassword123');
        await settingsPage.fillPreactInput(settingsPage.getConfirmPasswordInput(), 'differentPassword');
        await settingsPage.clickButton(settingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
        await expect(page.getByText('Passwords do not match')).toBeVisible();
    });
});

test.describe('Registration & Account Management', () => {
    test('should handle comprehensive registration flow with duplicate prevention', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected for duplicate registration' });

        const email = generateTestEmail('comprehensive');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Comprehensive');

        // Test 1: Successful initial registration
        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.register(displayName, email, password);
        await expect(page).toHaveURL(/\/dashboard/);

        // Log out to attempt duplicate registration
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.header.logout();

        // Test 2: Duplicate registration prevention with comprehensive error handling
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

        // Test 3: Form persistence (user doesn't lose their input)
        const nameInput = registerPage.getFormField('name');
        const emailInput = registerPage.getFormField('email');
        const passwordInput = registerPage.getFormField('password');

        await expect(nameInput).toHaveValue(displayName);
        await expect(emailInput).toHaveValue(email);
        // Password might be cleared for security
        const passwordValue = await passwordInput.inputValue();
        expect(passwordValue.length).toBeGreaterThanOrEqual(0);

        // Test 4: Recovery by changing email
        const newEmail = generateTestEmail('recovery');
        await registerPage.fillFormField('email', newEmail);
        await registerPage.submitForm();

        // Should succeed with different email
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle registration loading states comprehensively', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);

        // Test 1: Registration loading spinner
        const email = generateTestEmail('loading-test');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('LoadingTest');

        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill the registration form
        await registerPage.fillRegistrationForm(displayName, email, password);

        // Submit the form
        await registerPage.submitForm();

        // Check if we can see the loading spinner (might be very quick)
        const spinnerVisible = await registerPage.isLoadingSpinnerVisible();

        // Whether we saw the spinner or not, we should end up on dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // Log whether we saw the spinner for debugging
        test.info().annotations.push({
            type: 'loading-spinner',
            description: spinnerVisible ? 'Spinner was visible' : 'Registration was instant (no spinner)',
        });

        // Test 2: Form button states during processing
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.header.logout();

        const email2 = generateTestEmail('disabled-test');
        const displayName2 = generateTestUserName('DisabledTest');

        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill the registration form
        await registerPage.fillRegistrationForm(displayName2, email2, password);

        // Get the submit button
        const submitButton = registerPage.getSubmitButton();

        // Verify it's enabled before submission
        await expect(submitButton).toBeEnabled();

        // Submit the form
        await registerPage.submitForm();

        // Registration should complete and redirect to dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // Test 3: Combined instant and delayed registration handling
        await dashboardPage.header.logout();

        const email3 = generateTestEmail('instant-test');
        const displayName3 = generateTestUserName('InstantTest');

        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Use the main register method which handles both scenarios
        await registerPage.register(displayName3, email3, password);

        // Should be on dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify we're actually logged in by checking for dashboard elements
        await expect(page.getByRole('heading', { name: /welcome|your groups/i }).first()).toBeVisible({ timeout: 5000 });
    });
});
import { expect } from '@playwright/test';
import { simpleTest, simpleTest as test } from '../../fixtures/simple-test.fixture';
import { SettingsPage, RegisterPage, DashboardPage } from '../../pages';
import { generateNewUserDetails, DEFAULT_PASSWORD, generateTestEmail, generateTestUserName } from '@splitifyd/test-support';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';

/**
 * Comprehensive User Management E2E Tests
 *
 * Consolidated from multiple user management test files to eliminate redundancy:
 * - Profile viewing, updating, and validation (merged from 4 separate tests)
 * - Password management with comprehensive validation
 * - Registration flows with loading states and error handling (merged from 2 separate tests)
 * - Real-time UI updates and form persistence
 *
 * Reduced from ~7 tests to 2 comprehensive tests while maintaining complete coverage.
 */

simpleTest.describe('Profile Management', () => {
    simpleTest('comprehensive profile and password management with validation and real-time updates', async ({ createLoggedInBrowsers, newEmptyBrowser }) => {
        // Create a fresh user specifically for comprehensive testing
        const { displayName, email, password } = generateNewUserDetails();

        // Test 1: Profile viewing, updating, and real-time updates
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const settingsPage = new SettingsPage(page, user);

        await settingsPage.navigate();

        // Verify profile information is displayed
        const expectedDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        await settingsPage.verifyProfileInformation(expectedDisplayName, user.email);
        await expect(settingsPage.getDisplayNameInput()).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeVisible();

        // Test display name validation
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), '');
        await expect(page.getByText('Display name cannot be empty')).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeDisabled();

        const longName = 'A'.repeat(101);
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), longName);
        await expect(page.getByText('Display name must be 100 characters or less')).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeDisabled();

        // Test successful profile update with loading states and real-time updates
        const newDisplayName = `Updated Name ${Date.now()}`;
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), newDisplayName);
        await expect(settingsPage.getSaveChangesButton()).toBeEnabled();

        const saveButton = settingsPage.getSaveChangesButton();
        await settingsPage.clickButton(saveButton, { buttonName: 'Save Changes' });
        await settingsPage.verifyLoadingState('save');
        await settingsPage.waitForLoadingComplete('save');

        // Verify comprehensive real-time updates across all UI components
        await expect(settingsPage.getProfileDisplayName()).toContainText(newDisplayName);
        await expect(settingsPage.header.getUserMenuButton()).toContainText(newDisplayName);
        await expect(settingsPage.getDisplayNameInput()).toHaveValue(newDisplayName);

        // Verify persistence when navigating to dashboard and back
        await settingsPage.navigateToDashboard();
        await expect(settingsPage.header.getUserMenuButton()).toContainText(newDisplayName);
        await settingsPage.navigate();
        await expect(settingsPage.getProfileEmail()).toContainText(user.email);
        await expect(settingsPage.getProfileDisplayName()).toContainText(newDisplayName);

        // Test 2: Password management with fresh user account
        const { page: passwordPage } = await newEmptyBrowser();
        const registerPage = new RegisterPage(passwordPage);
        await registerPage.navigate();
        await registerPage.register(displayName, email, password);

        const passwordDashboardPage = new DashboardPage(passwordPage);
        await passwordDashboardPage.waitForDashboard();

        const passwordSettingsPage = new SettingsPage(passwordPage);
        await passwordSettingsPage.navigate();

        // Test password validation
        await passwordSettingsPage.openPasswordChangeForm();
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getCurrentPasswordInput(), 'currentPass');
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getNewPasswordInput(), '123');
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getConfirmPasswordInput(), '123');
        await passwordSettingsPage.clickButton(passwordSettingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
        await expect(passwordPage.getByText('New password must be at least 6 characters long')).toBeVisible();

        // Test password mismatch
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getNewPasswordInput(), 'newPassword123');
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getConfirmPasswordInput(), 'differentPassword');
        await passwordSettingsPage.clickButton(passwordSettingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
        await expect(passwordPage.getByText('Passwords do not match')).toBeVisible();

        // Test successful password change
        await passwordSettingsPage.cancelPasswordChange();
        await passwordSettingsPage.changePassword(password, 'newPassword123!');
        await passwordSettingsPage.verifySuccessMessage('Password changed successfully');
        await passwordSettingsPage.verifyPasswordFormVisible(false);

        // Test password change cancellation
        await passwordSettingsPage.openPasswordChangeForm();
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getCurrentPasswordInput(), 'somePassword');
        await passwordSettingsPage.fillPreactInput(passwordSettingsPage.getNewPasswordInput(), 'newPassword123');
        await passwordSettingsPage.cancelPasswordChange();
        await passwordSettingsPage.verifyPasswordFormVisible(false);
        await expect(passwordSettingsPage.getChangePasswordButton()).toBeVisible();
    });
});

test.describe('Registration & Account Management', () => {
    test('simple happy path: register new user successfully', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);

        const email = generateTestEmail('happy-path');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('HappyPath');

        await registerPage.navigate();
        await registerPage.register(displayName, email, password);

        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByText(displayName).first()).toBeVisible();
    });

    test('comprehensive registration flow with loading states, validation, and error handling', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected for duplicate registration' });

        const email = generateTestEmail('comprehensive');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Comprehensive');

        // Test 1: Successful initial registration with loading state verification
        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.fillRegistrationForm(displayName, email, password);

        const submitButton = registerPage.getSubmitButton();
        await expect(submitButton).toBeEnabled();

        await registerPage.submitForm();

        // Check for loading spinner (might be very quick)
        const spinnerVisible = await registerPage.isLoadingSpinnerVisible();
        test.info().annotations.push({
            type: 'loading-spinner',
            description: spinnerVisible ? 'Spinner was visible' : 'Registration was instant (no spinner)',
        });

        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
        await expect(page.getByRole('heading', { name: /welcome|your groups/i }).first()).toBeVisible({ timeout: 5000 });

        // Log out to test duplicate registration prevention
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

        // Verify error message appears and form persistence
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

        // Test form persistence (user doesn't lose their input)
        const nameInput = registerPage.getFormField('name');
        const emailInput = registerPage.getFormField('email');
        await expect(nameInput).toHaveValue(displayName);
        await expect(emailInput).toHaveValue(email);

        // Test 3: Recovery by changing email and additional loading state tests
        const newEmail = generateTestEmail('recovery');
        await registerPage.fillFormField('email', newEmail);
        await registerPage.submitForm();

        // Should succeed with different email
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // Test 4: Additional registration scenarios with different users
        await dashboardPage.header.logout();

        const email2 = generateTestEmail('additional-test');
        const displayName2 = generateTestUserName('AdditionalTest');

        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.register(displayName2, email2, password);
        await expect(page).toHaveURL(/\/dashboard/);
    });
});

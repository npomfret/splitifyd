import { simpleTest, expect } from '../../fixtures';
import { SettingsPage, RegisterPage, DashboardPage } from '../../pages';
import { generateNewUserDetails } from '@splitifyd/test-support';

simpleTest.describe('User Profile Management', () => {
    simpleTest('should allow user to view their profile information', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const settingsPage = new SettingsPage(page, user);

        // Navigate to settings page
        await settingsPage.navigate();

        // Verify profile information is displayed
        const expectedDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        await settingsPage.verifyProfileInformation(expectedDisplayName, user.email);

        // Verify profile form elements are present
        await expect(settingsPage.getDisplayNameInput()).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeVisible();
    });

    simpleTest('should allow user to update their display name', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const settingsPage = await dashboardPage.clickSettings();
        const newDisplayName = `Updated Name ${Date.now()}`;

        // Update display name using POM method
        await settingsPage.updateDisplayName(newDisplayName);

        // Verify real-time updates - both in settings and navigation (no page reload needed)
        await settingsPage.verifyRealTimeDisplayNameUpdate(newDisplayName);

        // Also verify display name persists when navigating to dashboard
        await settingsPage.navigateToDashboard();
        await expect(settingsPage.header.getUserMenuButton()).toContainText(newDisplayName);
    });

    simpleTest('should allow user to change their password', async ({ newEmptyBrowser }) => {
        // Create a fresh user specifically for password testing to avoid affecting other tests
        const { displayName, email, password } = generateNewUserDetails();

        // Register the fresh user
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

        // Change password using POM method - use the fresh user's original password
        // Use a password that meets complexity requirements (uppercase, lowercase, numbers, symbols)
        await settingsPage.changePassword(password, 'newPassword123!');

        // Verify success message
        await settingsPage.verifySuccessMessage('Password changed successfully');

        // Verify form is reset/hidden
        await settingsPage.verifyPasswordFormVisible(false);
    });

    simpleTest('should preserve other profile information when updating display name', async ({ newLoggedInBrowser }) => {
        const { page, user } = await newLoggedInBrowser();
        const settingsPage = new SettingsPage(page, user);

        const newDisplayName = `Test Name ${Date.now()}`;

        // Navigate to settings page
        await settingsPage.navigate();

        // Note original email - should remain unchanged
        const originalEmail = user.email;
        await expect(settingsPage.getProfileEmail()).toContainText(originalEmail);

        // Update only display name using POM method
        await settingsPage.updateDisplayName(newDisplayName);

        // Verify email unchanged and display name updated
        await expect(settingsPage.getProfileEmail()).toContainText(originalEmail);
        await expect(settingsPage.getProfileDisplayName()).toContainText(newDisplayName);
    });

    simpleTest('should show loading states during profile updates', async ({ newLoggedInBrowser }) => {
        const { page, user } = await newLoggedInBrowser();
        const settingsPage = new SettingsPage(page, user);

        const testDisplayName = `Loading Test ${Date.now()}`;

        // Navigate to settings page
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
        // Verify the display name updated in real-time
        await expect(settingsPage.getProfileDisplayName()).toContainText(testDisplayName);
    });

    simpleTest('should allow canceling password change', async ({ newLoggedInBrowser }) => {
        const { page, user } = await newLoggedInBrowser();
        const settingsPage = new SettingsPage(page, user);

        // Navigate to settings page
        await settingsPage.navigate();

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

    simpleTest('should update display name in real-time across all UI components without page reload', async ({ newLoggedInBrowser }) => {
        const { page, user } = await newLoggedInBrowser();
        const settingsPage = new SettingsPage(page, user);

        // Navigate to settings page
        await settingsPage.navigate();

        // Get the actual current display name from the page
        const initialDisplayName = (await settingsPage.getProfileDisplayName().textContent())!;

        // Verify initial state shows current name (which we just read from the page)
        await expect(settingsPage.getProfileDisplayName()).toContainText(initialDisplayName);
        await expect(settingsPage.header.getUserMenuButton()).toContainText(initialDisplayName);

        const realTimeDisplayName = `RealTime ${Date.now()}`;

        // Update display name
        await settingsPage.updateDisplayName(realTimeDisplayName);

        // Verify real-time updates without any page reload:
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

        // 6. Open user dropdown to verify it also shows updated name and not old name
        await settingsPage.header.getUserMenuButton().click();
        await expect(settingsPage.header.getUserDropdownMenu()).toContainText(realTimeDisplayName);
        await expect(settingsPage.header.getUserDropdownMenu()).not.toContainText(initialDisplayName);
    });

    simpleTest('should validate display name requirements', async ({ newLoggedInBrowser }) => {
        const { page, user } = await newLoggedInBrowser();
        const settingsPage = new SettingsPage(page, user);

        // Navigate to settings page using POM
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
        await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), 'a Valid Name');
        await expect(page.getByText('Display name cannot be empty')).not.toBeVisible();
        await expect(page.getByText('Display name must be 100 characters or less')).not.toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeEnabled();
    });

    simpleTest('should validate password change requirements', async ({ newLoggedInBrowser }) => {
        const { page, user } = await newLoggedInBrowser();
        const settingsPage = new SettingsPage(page, user);

        // Navigate to settings page using POM
        await settingsPage.navigate();

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

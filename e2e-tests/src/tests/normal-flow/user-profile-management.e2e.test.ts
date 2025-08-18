import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { test as baseTest } from '../../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { SettingsPage, RegisterPage, DashboardPage } from '../../pages';
import { generateNewUserDetails } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('User Profile Management', () => {
    authenticatedPageTest(
        'should allow user to view their profile information',
        async ({ authenticatedPage }) => {
            const { page, user } = authenticatedPage;
            const settingsPage = new SettingsPage(page);

            // Navigate to settings page
            await settingsPage.navigate();

            // Verify profile information is displayed
            const expectedDisplayName = user.displayName || user.email.split('@')[0];
            await settingsPage.verifyProfileInformation(expectedDisplayName, user.email);
            
            // Verify profile form elements are present
            await expect(settingsPage.getDisplayNameInput()).toBeVisible();
            await expect(settingsPage.getSaveChangesButton()).toBeVisible();
        }
    );

    authenticatedPageTest(
        'should allow user to update their display name',
        async ({ authenticatedPage }) => {
            const { page, user } = authenticatedPage;
            const settingsPage = new SettingsPage(page);
            
            const newDisplayName = `Updated Name ${Date.now()}`;

            // Navigate to settings page and wait for ready
            await settingsPage.navigate();

            // Update display name using POM method
            await settingsPage.updateDisplayName(newDisplayName);

            // Verify display name was updated in UI
            await expect(settingsPage.getProfileDisplayName()).toContainText(newDisplayName);

            // Verify display name appears in header/navigation
            await settingsPage.navigateToDashboard();
            await expect(page.getByTestId('user-menu-button')).toContainText(newDisplayName);
        }
    );

    baseTest(
        'should allow user to change their password',
        async ({ page }) => {
            // Create a fresh user specifically for password testing to avoid affecting other tests
            const { displayName, email, password } = generateNewUserDetails();
            
            // Register the fresh user
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
            await settingsPage.changePassword(password, 'newPassword123');

            // Verify success message
            await settingsPage.verifySuccessMessage('Password changed successfully');

            // Verify form is reset/hidden
            await settingsPage.verifyPasswordFormVisible(false);
        }
    );

    authenticatedPageTest(
        'should preserve other profile information when updating display name',
        async ({ authenticatedPage }) => {
            const { page, user } = authenticatedPage;
            const settingsPage = new SettingsPage(page);

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
        }
    );

    authenticatedPageTest(
        'should show loading states during profile updates',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;
            const settingsPage = new SettingsPage(page);

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

            // Wait for completion
            await settingsPage.verifySuccessMessage('Profile updated successfully');
            await settingsPage.waitForLoadingComplete('save');
        }
    );

    authenticatedPageTest(
        'should allow canceling password change',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;
            const settingsPage = new SettingsPage(page);

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
        }
    );
});
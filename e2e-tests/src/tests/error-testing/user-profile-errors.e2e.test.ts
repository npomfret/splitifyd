import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { SettingsPage } from '../../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('User Profile Error Handling', () => {
    authenticatedPageTest(
        'should validate display name requirements',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;
            const settingsPage = new SettingsPage(page);

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
            await settingsPage.fillPreactInput(settingsPage.getDisplayNameInput(), 'Valid Name');
            await expect(page.getByText('Display name cannot be empty')).not.toBeVisible();
            await expect(page.getByText('Display name must be 100 characters or less')).not.toBeVisible();
            await expect(settingsPage.getSaveChangesButton()).toBeEnabled();
        }
    );

    authenticatedPageTest(
        'should validate password change requirements',
        async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;
            const settingsPage = new SettingsPage(page);

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

            // Test passwords don't match - clear fields and test mismatch
            await settingsPage.fillPreactInput(settingsPage.getCurrentPasswordInput(), 'currentPass');
            await settingsPage.fillPreactInput(settingsPage.getNewPasswordInput(), 'newPassword123');
            await settingsPage.fillPreactInput(settingsPage.getConfirmPasswordInput(), 'differentPassword');
            await settingsPage.clickButton(settingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
            await expect(page.getByText('Passwords do not match')).toBeVisible();

            // Test same as current password
            await settingsPage.fillPreactInput(settingsPage.getCurrentPasswordInput(), 'samePassword123');
            await settingsPage.fillPreactInput(settingsPage.getNewPasswordInput(), 'samePassword123');
            await settingsPage.fillPreactInput(settingsPage.getConfirmPasswordInput(), 'samePassword123');
            await settingsPage.clickButton(settingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
            await expect(page.getByText('New password must be different from current password')).toBeVisible();

            // Test empty fields
            await settingsPage.fillPreactInput(settingsPage.getCurrentPasswordInput(), '');
            await settingsPage.fillPreactInput(settingsPage.getNewPasswordInput(), '');
            await settingsPage.fillPreactInput(settingsPage.getConfirmPasswordInput(), '');
            await settingsPage.clickButton(settingsPage.getUpdatePasswordButton(), { buttonName: 'Update Password' });
            await expect(page.getByText('Current password and new password are required')).toBeVisible();
        }
    );
});
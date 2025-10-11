import { SettingsPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Settings Page Object', () => {
    test('should have all required element getters', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Verify all getter methods exist and return Locators
        expect(settingsPage.getProfileDisplayName()).toBeTruthy();
        expect(settingsPage.getProfileEmail()).toBeTruthy();
        expect(settingsPage.getDisplayNameInput()).toBeTruthy();
        expect(settingsPage.getSaveChangesButton()).toBeTruthy();
        expect(settingsPage.getChangePasswordButton()).toBeTruthy();
        expect(settingsPage.getCurrentPasswordInput()).toBeTruthy();
        expect(settingsPage.getNewPasswordInput()).toBeTruthy();
        expect(settingsPage.getConfirmPasswordInput()).toBeTruthy();
        expect(settingsPage.getUpdatePasswordButton()).toBeTruthy();
        expect(settingsPage.getCancelButton()).toBeTruthy();
    });

    test('should have settings action methods', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Verify action methods exist
        expect(typeof settingsPage.navigate).toBe('function');
        expect(typeof settingsPage.openPasswordChangeForm).toBe('function');
        expect(typeof settingsPage.fillPasswordChangeForm).toBe('function');
        expect(typeof settingsPage.submitPasswordChange).toBe('function');
        expect(typeof settingsPage.changePassword).toBe('function');
        expect(typeof settingsPage.cancelPasswordChange).toBe('function');
        expect(typeof settingsPage.verifyPasswordFormVisible).toBe('function');
        expect(typeof settingsPage.verifyProfileInformation).toBe('function');
        expect(typeof settingsPage.verifySuccessMessage).toBe('function');
        expect(typeof settingsPage.waitForFormReady).toBe('function');
    });

    test('should be able to navigate to settings page', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await settingsPage.navigate();

        // Verify we're on settings page
        await expect(page).toHaveURL(/\/settings/);
    });

    test('should display profile information elements', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Check profile elements are visible
        await expect(settingsPage.getProfileDisplayName()).toBeVisible();
        await expect(settingsPage.getProfileEmail()).toBeVisible();
        await expect(settingsPage.getDisplayNameInput()).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeVisible();
    });

    test('should display password section elements', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Password change button should be visible
        await expect(settingsPage.getChangePasswordButton()).toBeVisible();

        // Password form should not be visible initially
        await expect(settingsPage.getCurrentPasswordInput()).not.toBeVisible();
        await expect(settingsPage.getNewPasswordInput()).not.toBeVisible();
        await expect(settingsPage.getConfirmPasswordInput()).not.toBeVisible();
    });

    test('should be able to open password change form', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Open password form
        await settingsPage.openPasswordChangeForm();

        // Verify form is visible
        await expect(settingsPage.getCurrentPasswordInput()).toBeVisible();
        await expect(settingsPage.getNewPasswordInput()).toBeVisible();
        await expect(settingsPage.getConfirmPasswordInput()).toBeVisible();
        await expect(settingsPage.getUpdatePasswordButton()).toBeVisible();
        await expect(settingsPage.getCancelButton()).toBeVisible();
    });

    test('should be able to fill password change form', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Open password form
        await settingsPage.openPasswordChangeForm();

        // Fill the form
        await settingsPage.fillPasswordChangeForm('currentPassword123', 'newPassword456');

        // Verify inputs have values (check they're not empty)
        const currentPasswordValue = await settingsPage.getCurrentPasswordInput().inputValue();
        const newPasswordValue = await settingsPage.getNewPasswordInput().inputValue();
        const confirmPasswordValue = await settingsPage.getConfirmPasswordInput().inputValue();

        expect(currentPasswordValue).toBe('currentPassword123');
        expect(newPasswordValue).toBe('newPassword456');
        expect(confirmPasswordValue).toBe('newPassword456'); // Should match new password by default
    });

    test('should support different confirm password', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Open password form
        await settingsPage.openPasswordChangeForm();

        // Fill the form with different confirm password
        await settingsPage.fillPasswordChangeForm('currentPassword123', 'newPassword456', 'differentPassword789');

        // Verify confirm password is different
        const confirmPasswordValue = await settingsPage.getConfirmPasswordInput().inputValue();
        expect(confirmPasswordValue).toBe('differentPassword789');
    });

    test('should be able to cancel password change', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Open password form
        await settingsPage.openPasswordChangeForm();

        // Verify form is visible
        await expect(settingsPage.getCurrentPasswordInput()).toBeVisible();

        // Cancel the form
        await settingsPage.cancelPasswordChange();

        // Verify form is hidden
        await expect(settingsPage.getCurrentPasswordInput()).not.toBeVisible();
        await expect(settingsPage.getChangePasswordButton()).toBeVisible();
    });

    test('should verify password form visibility state', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Initially form should not be visible
        await settingsPage.verifyPasswordFormVisible(false);

        // Open form
        await settingsPage.openPasswordChangeForm();

        // Now form should be visible
        await settingsPage.verifyPasswordFormVisible(true);
    });

    test('should get success message locator', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Verify success message getters return Locators
        const genericSuccess = settingsPage.getSuccessMessage();
        const specificSuccess = settingsPage.getSuccessMessage('Profile updated');

        expect(genericSuccess).toBeTruthy();
        expect(specificSuccess).toBeTruthy();
    });

    test('should have correct URL constant', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Verify URL constant
        expect(settingsPage.url).toBe('/settings');
    });

    test('should have correct button text constants', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Verify button text constants exist
        expect(settingsPage.changePasswordButtonText).toBeTruthy();
        expect(settingsPage.updatePasswordButtonText).toBeTruthy();
        expect(settingsPage.cancelButtonText).toBeTruthy();

        // Verify they're strings
        expect(typeof settingsPage.changePasswordButtonText).toBe('string');
        expect(typeof settingsPage.updatePasswordButtonText).toBe('string');
        expect(typeof settingsPage.cancelButtonText).toBe('string');
    });

    test('should wait for form to be ready', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Wait for form ready (should not throw)
        await settingsPage.waitForFormReady();

        // Verify key elements are visible
        await expect(settingsPage.getDisplayNameInput()).toBeVisible();
        await expect(settingsPage.getSaveChangesButton()).toBeVisible();
        await expect(settingsPage.getChangePasswordButton()).toBeVisible();
    });

    test('should get profile display name element', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Get display name and verify it has content
        const displayName = settingsPage.getProfileDisplayName();
        await expect(displayName).toBeVisible();

        const displayNameText = await displayName.textContent();
        expect(displayNameText).toBeTruthy();
        expect(displayNameText!.trim().length).toBeGreaterThan(0);
    });

    test('should get profile email element', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Get email and verify it has content
        const email = settingsPage.getProfileEmail();
        await expect(email).toBeVisible();

        const emailText = await email.textContent();
        expect(emailText).toBeTruthy();
        expect(emailText!.trim().length).toBeGreaterThan(0);
        expect(emailText).toMatch(/@/); // Should contain @ symbol
    });
});

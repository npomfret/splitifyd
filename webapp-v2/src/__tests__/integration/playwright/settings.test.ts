import { SettingsPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Settings Page Object', () => {
    test('should have all required verification methods', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Verify all verification methods exist
        expect(typeof settingsPage.verifyProfileDisplayNameVisible).toBe('function');
        expect(typeof settingsPage.verifyProfileEmailVisible).toBe('function');
        expect(typeof settingsPage.verifyDisplayNameInputVisible).toBe('function');
        expect(typeof settingsPage.verifySaveChangesButtonVisible).toBe('function');
        expect(typeof settingsPage.verifyChangePasswordButtonVisible).toBe('function');
        expect(typeof settingsPage.verifyCurrentPasswordInputVisible).toBe('function');
        expect(typeof settingsPage.verifyNewPasswordInputVisible).toBe('function');
        expect(typeof settingsPage.verifyConfirmPasswordInputVisible).toBe('function');
        expect(typeof settingsPage.verifyUpdatePasswordButtonVisible).toBe('function');
        expect(typeof settingsPage.verifyCancelButtonVisible).toBe('function');
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
        await settingsPage.verifyProfileDisplayNameVisible();
        await settingsPage.verifyProfileEmailVisible();
        await settingsPage.verifyDisplayNameInputVisible();
        await settingsPage.verifySaveChangesButtonVisible();
    });

    test('should display password section elements', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Password change button should be visible
        await settingsPage.verifyChangePasswordButtonVisible();

        // Password form should not be visible initially
        await settingsPage.verifyCurrentPasswordInputNotVisible();
        await settingsPage.verifyNewPasswordInputNotVisible();
        await settingsPage.verifyConfirmPasswordInputNotVisible();
    });

    test('should be able to open password change form', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Open password form
        await settingsPage.openPasswordChangeForm();

        // Verify form is visible
        await settingsPage.verifyCurrentPasswordInputVisible();
        await settingsPage.verifyNewPasswordInputVisible();
        await settingsPage.verifyConfirmPasswordInputVisible();
        await settingsPage.verifyUpdatePasswordButtonVisible();
        await settingsPage.verifyCancelButtonVisible();
    });

    test('should be able to fill password change form', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Open password form
        await settingsPage.openPasswordChangeForm();

        // Fill the form
        await settingsPage.fillPasswordChangeForm('currentPassword1234', 'newPassword456');

        // Verify inputs have values (check they're not empty)
        const currentPasswordValue = await settingsPage.getCurrentPasswordInputValue();
        const newPasswordValue = await settingsPage.getNewPasswordInputValue();
        const confirmPasswordValue = await settingsPage.getConfirmPasswordInputValue();

        expect(currentPasswordValue).toBe('currentPassword1234');
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
        await settingsPage.fillPasswordChangeForm('currentPassword1234', 'newPassword456', 'differentPassword789');

        // Verify confirm password is different
        const confirmPasswordValue = await settingsPage.getConfirmPasswordInputValue();
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
        await settingsPage.verifyCurrentPasswordInputVisible();

        // Cancel the form
        await settingsPage.cancelPasswordChange();

        // Verify form is hidden
        await settingsPage.verifyCurrentPasswordInputNotVisible();
        await settingsPage.verifyChangePasswordButtonVisible();
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

    test('should verify success message visibility', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Verify success message verification methods exist
        expect(typeof settingsPage.verifySuccessMessage).toBe('function');
        expect(typeof settingsPage.verifySuccessMessageVisible).toBe('function');
        expect(typeof settingsPage.verifySuccessMessageNotVisible).toBe('function');
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
        await settingsPage.verifyDisplayNameInputVisible();
        await settingsPage.verifySaveChangesButtonVisible();
        await settingsPage.verifyChangePasswordButtonVisible();
    });

    test('should get profile display name element', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Verify display name is visible and has content
        await settingsPage.verifyProfileDisplayNameVisible();

        const displayNameText = await settingsPage.getProfileDisplayNameText();
        expect(displayNameText).toBeTruthy();
        expect(displayNameText!.trim().length).toBeGreaterThan(0);
    });

    test('should get profile email element', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        // Navigate to settings
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Verify email is visible and has content
        await settingsPage.verifyProfileEmailVisible();

        const emailText = await settingsPage.getProfileEmailText();
        expect(emailText).toBeTruthy();
        expect(emailText!.trim().length).toBeGreaterThan(0);
        expect(emailText).toMatch(/@/); // Should contain @ symbol
    });
});

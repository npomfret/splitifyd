import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { SETTINGS_SELECTORS, SETTINGS_TEXTS } from '../constants/selectors';
import { PooledTestUser} from '@splitifyd/shared';

export class SettingsPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }
    // URL and button texts (using translation-based constants)
    readonly url = '/settings';
    readonly changePasswordButtonText = SETTINGS_TEXTS.CHANGE_PASSWORD_BUTTON;
    readonly saveChangesButtonText = SETTINGS_TEXTS.SAVE_CHANGES_BUTTON;
    readonly updatePasswordButtonText = SETTINGS_TEXTS.UPDATE_PASSWORD_BUTTON;
    readonly cancelButtonText = SETTINGS_TEXTS.CANCEL_BUTTON;

    async navigate() {
        await this.navigateToStaticPath(this.url);

        // Fail fast if we're not on the settings page
        try {
            await this.expectUrl(/\/settings/);
        } catch (error) {
            throw new Error('Expected to navigate to settings page but was redirected.');
        }

        // Wait for the form to be ready
        await this.waitForFormReady();
    }

    // Profile Information Elements (using strategic data-testid approach)
    getProfileDisplayName(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.PROFILE_DISPLAY_NAME);
    }

    getProfileEmail(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.PROFILE_EMAIL);
    }

    getDisplayNameInput(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.DISPLAY_NAME_INPUT);
    }

    getSaveChangesButton(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.SAVE_CHANGES_BUTTON);
    }

    // Password Change Elements (using strategic data-testid approach)
    getChangePasswordButton(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.CHANGE_PASSWORD_BUTTON);
    }

    getCurrentPasswordInput(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.CURRENT_PASSWORD_INPUT);
    }

    getNewPasswordInput(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.NEW_PASSWORD_INPUT);
    }

    getConfirmPasswordInput(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.CONFIRM_PASSWORD_INPUT);
    }

    getUpdatePasswordButton(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.UPDATE_PASSWORD_BUTTON);
    }

    getCancelButton(): Locator {
        return this.page.locator(SETTINGS_SELECTORS.CANCEL_PASSWORD_BUTTON);
    }

    // Success/Error Messages
    getSuccessMessage(text?: string): Locator {
        if (text) {
            // Use a more specific locator for the exact success message text
            return this.page.locator('[role="alert"], .bg-green-50, .text-green-600').filter({ hasText: text });
        }
        return this.page.locator('.text-green-600, .bg-green-50, [role="alert"]').filter({ hasText: /successfully|updated|changed/i });
    }

    getErrorMessage(text?: string): Locator {
        if (text) {
            return this.page.getByText(text);
        }
        return this.page.locator('[role="alert"], [data-testid*="error"]').filter({ hasText: /error|failed|invalid/i });
    }

    // Profile Information Actions
    async updateDisplayName(newDisplayName: string): Promise<void> {
        const displayNameInput = this.getDisplayNameInput();

        // Clear and fill the display name
        await this.fillPreactInput(displayNameInput, '');
        await this.fillPreactInput(displayNameInput, newDisplayName);

        // Click save button
        const saveButton = this.getSaveChangesButton();
        await this.clickButton(saveButton, { buttonName: this.saveChangesButtonText });

        // Wait for loading to complete (button becomes disabled after successful save)
        await this.waitForLoadingComplete('save');

        // Real-time updates: verify the display name updated in both places
        // 1. In the profile display section
        await expect(this.getProfileDisplayName()).toContainText(newDisplayName);
        // 2. In the user menu at the top right corner
        await expect(this.getUserMenuButton()).toContainText(newDisplayName);
    }

    async verifyRealTimeDisplayNameUpdate(expectedName: string): Promise<void> {
        // Verify the display name updates in real-time in the profile section
        await expect(this.getProfileDisplayName()).toContainText(expectedName);

        // Verify the user menu in navigation also updates automatically
        await expect(this.getUserMenuButton()).toContainText(expectedName);
    }

    // Password Change Actions
    async openPasswordChangeForm(): Promise<void> {
        const changePasswordButton = this.getChangePasswordButton();
        await this.clickButton(changePasswordButton, { buttonName: this.changePasswordButtonText });

        // Wait for form to appear
        await expect(this.getCurrentPasswordInput()).toBeVisible();
        await expect(this.getNewPasswordInput()).toBeVisible();
        await expect(this.getConfirmPasswordInput()).toBeVisible();
    }

    async fillPasswordChangeForm(currentPassword: string, newPassword: string, confirmPassword?: string): Promise<void> {
        const confirmPass = confirmPassword || newPassword;

        await this.fillPreactInput(this.getCurrentPasswordInput(), currentPassword);
        await this.fillPreactInput(this.getNewPasswordInput(), newPassword);
        await this.fillPreactInput(this.getConfirmPasswordInput(), confirmPass);
    }

    async submitPasswordChange(): Promise<void> {
        const updateButton = this.getUpdatePasswordButton();
        await this.clickButton(updateButton, { buttonName: this.updatePasswordButtonText });

        await this.waitForDomContentLoaded();
    }

    async changePassword(currentPassword: string, newPassword: string, confirmPassword?: string): Promise<void> {
        await this.openPasswordChangeForm();
        await this.fillPasswordChangeForm(currentPassword, newPassword, confirmPassword);
        await this.submitPasswordChange();
    }

    async cancelPasswordChange(): Promise<void> {
        const cancelButton = this.getCancelButton();
        await this.clickButton(cancelButton, { buttonName: this.cancelButtonText });

        // Verify form is hidden
        await expect(this.getCurrentPasswordInput()).not.toBeVisible();
        await expect(this.getChangePasswordButton()).toBeVisible();
    }

    // Form Validation
    async verifyPasswordFormVisible(visible: boolean = true): Promise<void> {
        if (visible) {
            await expect(this.getCurrentPasswordInput()).toBeVisible();
            await expect(this.getNewPasswordInput()).toBeVisible();
            await expect(this.getConfirmPasswordInput()).toBeVisible();
        } else {
            await expect(this.getCurrentPasswordInput()).not.toBeVisible();
            await expect(this.getNewPasswordInput()).not.toBeVisible();
            await expect(this.getConfirmPasswordInput()).not.toBeVisible();
        }
    }

    // Profile Information Verification
    async verifyProfileInformation(displayName: string, email: string): Promise<void> {
        await expect(this.getProfileDisplayName()).toContainText(displayName);
        await expect(this.getProfileEmail()).toContainText(email);
    }

    // Message Verification
    async verifySuccessMessage(expectedText?: string): Promise<void> {
        const message = expectedText ? this.getSuccessMessage(expectedText) : this.getSuccessMessage();
        // Increase timeout as the success message may take a moment to appear after API call
        await expect(message).toBeVisible({ timeout: 5000 });
    }

    // Form State Verification
    async waitForFormReady(): Promise<void> {
        await this.waitForDomContentLoaded();
        await expect(this.getDisplayNameInput()).toBeVisible();
        await expect(this.getSaveChangesButton()).toBeVisible();
        await expect(this.getChangePasswordButton()).toBeVisible();
    }

    // Loading State Verification
    async verifyLoadingState(button: 'save' | 'update'): Promise<void> {
        const targetButton = button === 'save' ? this.getSaveChangesButton() : this.getUpdatePasswordButton();
        await expect(targetButton).toBeDisabled();
    }

    async waitForLoadingComplete(button: 'save' | 'update'): Promise<void> {
        const targetButton = button === 'save' ? this.getSaveChangesButton() : this.getUpdatePasswordButton();
        // For save button: after successful update, it should be disabled (no unsaved changes)
        // For update button: after successful password change, it should be enabled again
        if (button === 'save') {
            await expect(targetButton).toBeDisabled();
        } else {
            await expect(targetButton).toBeEnabled();
        }
    }
}

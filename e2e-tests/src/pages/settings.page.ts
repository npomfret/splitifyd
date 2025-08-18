import { expect, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES } from '../constants/selectors';

export class SettingsPage extends BasePage {
    // URL and button texts
    readonly url = '/settings';
    readonly changePasswordButtonText = 'Change Password';
    readonly saveChangesButtonText = 'Save Changes';
    readonly updatePasswordButtonText = 'Update Password';
    readonly cancelButtonText = 'Cancel';

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

    // Profile Information Elements
    getProfileDisplayName(): Locator {
        return this.page.getByTestId('profile-display-name');
    }

    getProfileEmail(): Locator {
        return this.page.getByTestId('profile-email');
    }

    getDisplayNameInput(): Locator {
        return this.page.getByLabel('Display Name');
    }

    getSaveChangesButton(): Locator {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.saveChangesButtonText });
    }

    // Password Change Elements
    getChangePasswordButton(): Locator {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.changePasswordButtonText });
    }

    getCurrentPasswordInput(): Locator {
        return this.page.getByLabel('Current Password');
    }

    getNewPasswordInput(): Locator {
        return this.page.getByRole(ARIA_ROLES.TEXTBOX, { name: 'New Password', exact: true });
    }

    getConfirmPasswordInput(): Locator {
        return this.page.getByLabel('Confirm New Password');
    }

    getUpdatePasswordButton(): Locator {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.updatePasswordButtonText });
    }

    getCancelButton(): Locator {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.cancelButtonText });
    }

    // Success/Error Messages
    getSuccessMessage(text?: string): Locator {
        if (text) {
            return this.page.getByText(text);
        }
        return this.page.locator('.text-green-600, .bg-green-50, [role="alert"]').filter({ hasText: /successfully|updated|changed/i });
    }

    getErrorMessage(text?: string): Locator {
        if (text) {
            return this.page.getByText(text);
        }
        return this.page.locator('.text-red-600, .bg-red-50, [role="alert"]').filter({ hasText: /error|failed|invalid/i });
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
        
        // Wait for success and completion
        await this.verifySuccessMessage('Profile updated successfully');
        await this.waitForLoadingComplete('save');
        
        // Refresh the page to see the updated display name in UI (no real-time updates)
        await this.page.reload();
        await this.waitForNetworkIdle();
    }

    async verifyDisplayNameValue(expectedName: string): Promise<void> {
        const displayNameInput = this.getDisplayNameInput();
        await expect(displayNameInput).toHaveValue(expectedName);
    }

    async verifySaveButtonState(expectedEnabled: boolean): Promise<void> {
        const saveButton = this.getSaveChangesButton();
        if (expectedEnabled) {
            await expect(saveButton).toBeEnabled();
        } else {
            await expect(saveButton).toBeDisabled();
        }
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
        
        await this.waitForNetworkIdle();
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

    async verifyUpdatePasswordButtonState(expectedEnabled: boolean): Promise<void> {
        const updateButton = this.getUpdatePasswordButton();
        if (expectedEnabled) {
            await expect(updateButton).toBeEnabled();
        } else {
            await expect(updateButton).toBeDisabled();
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
        await expect(message).toBeVisible();
    }

    async verifyErrorMessage(expectedText?: string): Promise<void> {
        const message = expectedText ? this.getErrorMessage(expectedText) : this.getErrorMessage();
        await expect(message).toBeVisible();
    }

    // Form State Verification
    async waitForFormReady(): Promise<void> {
        await this.page.waitForLoadState('domcontentloaded');
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
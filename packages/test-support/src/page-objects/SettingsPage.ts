import { expect, Locator, Page } from '@playwright/test';
import { DisplayName } from '@splitifyd/shared';
import type { Email } from '@splitifyd/shared';
import { BasePage } from './BasePage';
import { HeaderPage } from './HeaderPage';

/**
 * Shared base class for Settings page object.
 * Provides access to profile management and password change functionality.
 */
export class SettingsPage extends BasePage {
    readonly url = '/settings';

    // Button text constants (hardcoded to avoid translation import issues)
    readonly changePasswordButtonText = 'Change Password';
    readonly updatePasswordButtonText = 'Update Password';
    readonly cancelButtonText = 'Cancel';

    // Header component for navigation
    protected _header?: HeaderPage;

    constructor(page: Page) {
        super(page);
    }

    /**
     * Header page object for user menu and navigation functionality.
     * Lazy loaded to avoid circular dependencies.
     */
    get header(): HeaderPage {
        if (!this._header) {
            this._header = new HeaderPage(this.page);
        }
        return this._header;
    }

    /**
     * Navigate to settings page
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });

        // Fail fast if we're not on the settings page
        try {
            await expect(this.page).toHaveURL(/\/settings/);
        } catch (error) {
            throw new Error('Expected to navigate to settings page but was redirected.');
        }

        // Wait for the form to be ready
        await this.waitForFormReady();
    }

    /**
     * Profile Information Locators
     */
    protected getProfileDisplayName(): Locator {
        return this.page.locator('[data-testid="profile-display-name"]');
    }

    protected getProfileEmail(): Locator {
        return this.page.locator('[data-testid="profile-email"]');
    }

    protected getDisplayNameInput(): Locator {
        return this.page.locator('[data-testid="display-name-input"]');
    }

    protected getSaveChangesButton(): Locator {
        return this.page.locator('[data-testid="save-changes-button"]');
    }

    /**
     * Password Change Locators
     */
    protected getChangePasswordButton(): Locator {
        return this.page.locator('[data-testid="change-password-button"]');
    }

    protected getCurrentPasswordInput(): Locator {
        return this.page.locator('[data-testid="current-password-input"]');
    }

    protected getNewPasswordInput(): Locator {
        return this.page.locator('[data-testid="new-password-input"]');
    }

    protected getConfirmPasswordInput(): Locator {
        return this.page.locator('[data-testid="confirm-password-input"]');
    }

    protected getUpdatePasswordButton(): Locator {
        return this.page.locator('[data-testid="update-password-button"]');
    }

    protected getCancelButton(): Locator {
        return this.page.locator('[data-testid="cancel-password-button"]');
    }

    /**
     * Success/Error Message Locators
     */
    protected getSuccessMessage(text?: string): Locator {
        const alerts = this.page.getByRole('alert');
        if (text) {
            return alerts.filter({ hasText: text });
        }
        return alerts.filter({ hasText: /successfully|updated|changed/i });
    }

    /**
     * Profile Form Actions - Encapsulated fill methods
     */
    async fillDisplayName(value: string): Promise<void> {
        const input = this.getDisplayNameInput();
        await this.fillPreactInput(input, value);
    }

    async clickSaveChangesButton(): Promise<void> {
        const button = this.getSaveChangesButton();
        await this.clickButton(button, { buttonName: 'Save Changes' });
    }

    /**
     * Profile Form Verification Methods
     */
    async verifyDisplayNameInputVisible(): Promise<void> {
        await expect(this.getDisplayNameInput()).toBeVisible();
    }

    async verifySaveButtonVisible(): Promise<void> {
        await expect(this.getSaveChangesButton()).toBeVisible();
    }

    async verifySaveButtonEnabled(): Promise<void> {
        await expect(this.getSaveChangesButton()).toBeEnabled();
    }

    async verifySaveButtonDisabled(): Promise<void> {
        await expect(this.getSaveChangesButton()).toBeDisabled();
    }

    async verifyProfileDisplayNameText(text: string): Promise<void> {
        await expect(this.getProfileDisplayName()).toContainText(text);
    }

    async verifyProfileEmailText(text: string): Promise<void> {
        await expect(this.getProfileEmail()).toContainText(text);
    }

    async verifyDisplayNameInputValue(value: string): Promise<void> {
        await expect(this.getDisplayNameInput()).toHaveValue(value);
    }

    /**
     * Error message verification
     */
    async verifyErrorMessage(text: string): Promise<void> {
        await expect(this.page.getByText(text)).toBeVisible();
    }

    /**
     * Password Change Actions
     */
    async openPasswordChangeForm(): Promise<void> {
        const changePasswordButton = this.getChangePasswordButton();
        await this.clickButton(changePasswordButton, { buttonName: this.changePasswordButtonText });

        // Wait for form to appear
        await expect(this.getCurrentPasswordInput()).toBeVisible();
        await expect(this.getNewPasswordInput()).toBeVisible();
        await expect(this.getConfirmPasswordInput()).toBeVisible();
    }

    /**
     * Password Form Actions - Encapsulated fill methods
     */
    async fillCurrentPassword(value: string): Promise<void> {
        const input = this.getCurrentPasswordInput();
        await this.fillPreactInput(input, value);
    }

    async fillNewPassword(value: string): Promise<void> {
        const input = this.getNewPasswordInput();
        await this.fillPreactInput(input, value);
    }

    async fillConfirmPassword(value: string): Promise<void> {
        const input = this.getConfirmPasswordInput();
        await this.fillPreactInput(input, value);
    }

    async clickUpdatePasswordButton(): Promise<void> {
        const button = this.getUpdatePasswordButton();
        await this.clickButton(button, { buttonName: this.updatePasswordButtonText });
    }

    /**
     * Password Form Verification Methods
     */
    async verifyChangePasswordButtonVisible(): Promise<void> {
        await expect(this.getChangePasswordButton()).toBeVisible();
    }

    async fillPasswordChangeForm(
        currentPassword: string,
        newPassword: string,
        confirmPassword?: string,
    ): Promise<void> {
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

    async changePassword(
        currentPassword: string,
        newPassword: string,
        confirmPassword?: string,
    ): Promise<void> {
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

    /**
     * Form Validation
     */
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

    /**
     * Profile Information Verification
     */
    async verifyProfileInformation(displayName: DisplayName, email: Email): Promise<void> {
        await expect(this.getProfileDisplayName()).toContainText(displayName);
        await expect(this.getProfileEmail()).toContainText(email);
    }

    /**
     * Message Verification
     */
    async verifySuccessMessage(expectedText?: string): Promise<void> {
        const message = expectedText ? this.getSuccessMessage(expectedText) : this.getSuccessMessage();
        // Increase timeout as the success message may take a moment to appear after API call
        await expect(message).toBeVisible({ timeout: 5000 });
    }

    /**
     * Form State Verification
     */
    async waitForFormReady(): Promise<void> {
        await this.waitForDomContentLoaded();
        await expect(this.getDisplayNameInput()).toBeVisible();
        await expect(this.getSaveChangesButton()).toBeVisible();
        await expect(this.getChangePasswordButton()).toBeVisible();
    }

    /**
     * Loading State Verification
     */
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

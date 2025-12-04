import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the User Editor Modal in the Admin Panel
 *
 * This modal allows system admins to edit user profiles (displayName, email)
 * and manage user roles.
 */
export class UserEditorModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ✅ Protected locators - internal use only
    protected getModal(): Locator {
        return this.page.getByTestId('user-editor-modal');
    }

    protected getProfileTab(): Locator {
        return this.page.getByTestId('profile-tab');
    }

    protected getRoleTab(): Locator {
        return this.page.getByTestId('role-tab');
    }

    protected getDisplayNameInput(): Locator {
        return this.page.getByTestId('display-name-input');
    }

    protected getEmailInput(): Locator {
        return this.page.getByTestId('email-input');
    }

    protected getSaveProfileButton(): Locator {
        return this.page.getByTestId('save-profile-button');
    }

    protected getSaveRoleButton(): Locator {
        return this.page.getByTestId('save-role-button');
    }

    protected getCancelButton(): Locator {
        return this.page.getByTestId('cancel-button');
    }

    protected getSuccessAlert(): Locator {
        return this.page.getByText('Profile updated successfully');
    }

    protected getRoleOption(label: string): Locator {
        return this.page.getByText(label);
    }

    // ✅ Navigation / Wait methods
    async waitForModalToBeVisible(): Promise<void> {
        await expect(this.getModal()).toBeVisible();
    }

    async waitForModalToBeHidden(): Promise<void> {
        await expect(this.getModal()).not.toBeVisible();
    }

    // ✅ Action methods
    async clickProfileTab(): Promise<void> {
        await this.clickButtonNoWait(this.getProfileTab(), { buttonName: 'Profile tab' });
    }

    async clickRoleTab(): Promise<void> {
        await this.clickButtonNoWait(this.getRoleTab(), { buttonName: 'Role tab' });
    }

    async fillDisplayName(value: string): Promise<void> {
        await this.getDisplayNameInput().fill(value);
    }

    async fillEmail(value: string): Promise<void> {
        await this.getEmailInput().fill(value);
    }

    async clickSaveProfile(): Promise<void> {
        await this.clickButton(this.getSaveProfileButton(), { buttonName: 'Save Profile' });
    }

    async clickCancel(): Promise<void> {
        await this.clickButtonNoWait(this.getCancelButton(), { buttonName: 'Cancel' });
    }

    // ✅ Verification methods
    async verifyModalIsOpen(): Promise<void> {
        await expect(this.getModal()).toBeVisible();
    }

    async verifyModalIsClosed(): Promise<void> {
        await expect(this.getModal()).not.toBeVisible();
    }

    async verifyProfileTabIsActive(): Promise<void> {
        await expect(this.getProfileTab()).toHaveClass(/border-interactive-primary/);
    }

    async verifyDisplayNameInputVisible(): Promise<void> {
        await expect(this.getDisplayNameInput()).toBeVisible();
    }

    async verifyDisplayNameInputNotVisible(): Promise<void> {
        await expect(this.getDisplayNameInput()).not.toBeVisible();
    }

    async verifyEmailInputVisible(): Promise<void> {
        await expect(this.getEmailInput()).toBeVisible();
    }

    async verifyDisplayNameValue(expectedValue: string): Promise<void> {
        await expect(this.getDisplayNameInput()).toHaveValue(expectedValue);
    }

    async verifyEmailValue(expectedValue: string): Promise<void> {
        await expect(this.getEmailInput()).toHaveValue(expectedValue);
    }

    async verifySaveProfileButtonDisabled(): Promise<void> {
        await expect(this.getSaveProfileButton()).toBeDisabled();
    }

    async verifySaveProfileButtonEnabled(): Promise<void> {
        await expect(this.getSaveProfileButton()).toBeEnabled();
    }

    async verifySuccessMessage(): Promise<void> {
        await expect(this.getSuccessAlert()).toBeVisible();
    }

    async verifyRoleOptionVisible(label: string): Promise<void> {
        await expect(this.getRoleOption(label)).toBeVisible();
    }
}

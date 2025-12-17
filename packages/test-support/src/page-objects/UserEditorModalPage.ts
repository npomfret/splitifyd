import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

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
        return this.page.getByRole('dialog');
    }

    protected getProfileTab(): Locator {
        return this.page.getByRole('tab', { name: translation.admin.userEditor.tabs.profile });
    }

    protected getRoleTab(): Locator {
        return this.page.getByRole('tab', { name: translation.admin.userEditor.tabs.role });
    }

    protected getDisplayNameInput(): Locator {
        return this.page.getByLabel(translation.admin.userEditor.profile.displayName);
    }

    protected getEmailInput(): Locator {
        return this.page.getByLabel(translation.admin.userEditor.profile.email);
    }

    protected getSaveProfileButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.common.save });
    }

    protected getSaveRoleButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.common.save });
    }

    protected getCancelButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.common.cancel });
    }

    protected getSuccessAlert(): Locator {
        return this.page.getByText(translation.admin.userEditor.success.profileUpdated);
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
        await this.fillPreactInput(this.getDisplayNameInput(), value);
    }

    async fillEmail(value: string): Promise<void> {
        await this.fillPreactInput(this.getEmailInput(), value);
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
        await expect(this.getProfileTab()).toHaveAttribute('aria-selected', 'true');
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

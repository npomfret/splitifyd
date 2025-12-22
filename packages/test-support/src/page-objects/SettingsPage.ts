import { DisplayName } from '@billsplit-wl/shared';
import type { Email } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { HeaderPage } from './HeaderPage';

const translation = translationEn;

/**
 * Shared base class for Settings page object.
 * Provides access to profile management and password change functionality.
 */
export class SettingsPage extends BasePage {
    readonly url = '/settings';

    // Button text from translations for i18n resilience
    readonly changePasswordButtonText = translation.settingsPage.changePasswordButton;
    readonly updatePasswordButtonText = translation.settingsPage.updatePasswordButton;
    readonly cancelButtonText = translation.settingsPage.cancelButton;

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
        return this.page.getByLabel(translation.settingsPage.displayNameValue);
    }

    protected getProfileEmail(): Locator {
        return this.page.getByLabel(translation.settingsPage.emailValue);
    }

    protected getDisplayNameInput(): Locator {
        return this.page.getByLabel(translation.settingsPage.displayNameLabel, { exact: true });
    }

    protected getSaveChangesButton(): Locator {
        // Scope to profile section to avoid matching the email section's Save Changes button
        return this.getProfileSection().getByRole('button', { name: translation.settingsPage.saveChangesButton });
    }

    /**
     * Section locators for scoping - use named regions (Card components have aria-label)
     */
    protected getProfileSection(): Locator {
        return this.page.getByRole('region', { name: translation.settingsPage.profileInformationHeader });
    }

    protected getPasswordSection(): Locator {
        return this.page.getByRole('region', { name: translation.settingsPage.passwordHeader });
    }

    /**
     * Password Change Locators
     */
    protected getChangePasswordButton(): Locator {
        return this.page.getByRole('button', { name: translation.settingsPage.changePasswordButton });
    }

    protected getCurrentPasswordInput(): Locator {
        return this.page.getByLabel(translation.settingsPage.currentPasswordLabel);
    }

    protected getNewPasswordInput(): Locator {
        // Use exact: true because "Confirm New Password" contains "New Password" as substring
        return this.page.getByLabel(translation.settingsPage.newPasswordLabel, { exact: true });
    }

    protected getConfirmPasswordInput(): Locator {
        return this.page.getByLabel(translation.settingsPage.confirmNewPasswordLabel, { exact: true });
    }

    protected getUpdatePasswordButton(): Locator {
        return this.page.getByRole('button', { name: translation.settingsPage.updatePasswordButton });
    }

    protected getCancelButton(): Locator {
        // Scope to password section to avoid matching the email section's Cancel button
        return this.getPasswordSection().getByRole('button', { name: translation.settingsPage.cancelButton });
    }

    /**
     * Success/Error Message Locators
     */
    protected getSuccessMessage(text?: string): Locator {
        const alerts = this.page.getByRole('alert');
        if (text) {
            return alerts.filter({ hasText: text });
        }
        // All success messages contain "successfully" - no conditional regex needed
        return alerts.filter({ hasText: /successfully/i });
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

    async verifyProfileDisplayNameVisible(): Promise<void> {
        await expect(this.getProfileDisplayName()).toBeVisible();
    }

    async verifyProfileEmailVisible(): Promise<void> {
        await expect(this.getProfileEmail()).toBeVisible();
    }

    async verifySaveChangesButtonVisible(): Promise<void> {
        await expect(this.getSaveChangesButton()).toBeVisible();
    }

    async verifyCurrentPasswordInputVisible(): Promise<void> {
        await expect(this.getCurrentPasswordInput()).toBeVisible();
    }

    async verifyCurrentPasswordInputNotVisible(): Promise<void> {
        await expect(this.getCurrentPasswordInput()).not.toBeVisible();
    }

    async verifyNewPasswordInputVisible(): Promise<void> {
        await expect(this.getNewPasswordInput()).toBeVisible();
    }

    async verifyNewPasswordInputNotVisible(): Promise<void> {
        await expect(this.getNewPasswordInput()).not.toBeVisible();
    }

    async verifyConfirmPasswordInputVisible(): Promise<void> {
        await expect(this.getConfirmPasswordInput()).toBeVisible();
    }

    async verifyConfirmPasswordInputNotVisible(): Promise<void> {
        await expect(this.getConfirmPasswordInput()).not.toBeVisible();
    }

    async verifyUpdatePasswordButtonVisible(): Promise<void> {
        await expect(this.getUpdatePasswordButton()).toBeVisible();
    }

    async verifyCancelButtonVisible(): Promise<void> {
        await expect(this.getCancelButton()).toBeVisible();
    }

    async verifySuccessMessageVisible(): Promise<void> {
        await expect(this.getSuccessMessage()).toBeVisible();
    }

    async verifySuccessMessageNotVisible(): Promise<void> {
        await expect(this.getSuccessMessage()).not.toBeVisible();
    }

    async getCurrentPasswordInputValue(): Promise<string> {
        return await this.getCurrentPasswordInput().inputValue();
    }

    async getNewPasswordInputValue(): Promise<string> {
        return await this.getNewPasswordInput().inputValue();
    }

    async getConfirmPasswordInputValue(): Promise<string> {
        return await this.getConfirmPasswordInput().inputValue();
    }

    async getProfileDisplayNameText(): Promise<string | null> {
        return await this.getProfileDisplayName().textContent();
    }

    async getProfileEmailText(): Promise<string | null> {
        return await this.getProfileEmail().textContent();
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
    async verifyProfileInformation(displayName: DisplayName | string, email: Email | string): Promise<void> {
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

    // ============================================================================
    // PROFILE SUMMARY CARD LOCATORS
    // ============================================================================

    /**
     * Profile overview card header text
     */
    protected getProfileOverviewText(): Locator {
        return this.page.getByText(translation.settingsPage.profileSummaryTitle);
    }

    /**
     * Avatar or initials element - scoped to profile summary section
     * .first(): Profile card may have decorative images; avatar is first
     */
    protected getAvatarOrInitials(): Locator {
        // Profile summary card contains the avatar - scope by visible profile overview text
        return this
            .page
            .locator('section, div')
            .filter({
                has: this.page.getByText(translation.settingsPage.profileSummaryTitle),
            })
            .getByRole('img')
            .first();
    }

    /**
     * Account role label (only visible to admins)
     */
    protected getAccountRoleLabel(): Locator {
        return this.page.getByText(translation.settingsPage.profileSummaryRoleLabel);
    }

    /**
     * Account role value (e.g., "Administrator")
     */
    protected getAccountRoleValue(value: string): Locator {
        return this.page.getByText(value);
    }

    // ============================================================================
    // PASSWORD CHECKLIST LOCATORS
    // ============================================================================

    /**
     * Strong password checklist heading
     */
    protected getPasswordChecklistHeading(): Locator {
        return this.page.getByText(translation.settingsPage.passwordRequirementsHeading);
    }

    /**
     * Password requirement text by pattern
     */
    protected getPasswordRequirement(pattern: RegExp): Locator {
        return this.page.getByText(pattern);
    }

    // ============================================================================
    // SECTION HEADER LOCATORS
    // ============================================================================

    /**
     * Profile Information section header
     */
    protected getProfileInformationHeader(): Locator {
        return this.page.getByRole('heading', { name: translation.settingsPage.profileInformationHeader });
    }

    /**
     * Profile Information section info icon (description is in tooltip)
     * .first(): Section may have multiple info icons; profile info is first
     */
    protected getProfileInformationInfoIcon(): Locator {
        // The info icon is next to the Profile Information heading
        return this.getProfileSection().getByLabel(translation.common.moreInfo).first();
    }

    /**
     * Password section header
     */
    protected getPasswordHeader(): Locator {
        return this.page.getByRole('heading', { name: translation.settingsPage.passwordHeader });
    }

    /**
     * Password section info icon (description is in tooltip)
     * .first(): Section may have multiple info icons; password info is first
     */
    protected getPasswordInfoIcon(): Locator {
        // The info icon is next to the Password heading
        return this.getPasswordSection().getByLabel(translation.common.moreInfo).first();
    }

    /**
     * Page hero/title label
     * .first(): Hero label text may appear in multiple contexts; page header first
     */
    protected getHeroLabel(): Locator {
        return this.page.getByText(translation.settingsPage.heroLabel).first();
    }

    // ============================================================================
    // PROFILE SUMMARY VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify profile overview card is visible
     */
    async verifyProfileOverviewCardVisible(): Promise<void> {
        await expect(this.getProfileOverviewText()).toBeVisible();
    }

    /**
     * Verify avatar or initials is visible
     */
    async verifyAvatarOrInitialsVisible(): Promise<void> {
        await expect(this.getAvatarOrInitials()).toBeVisible();
    }

    /**
     * Verify account role label is visible (for admins)
     */
    async verifyAccountRoleLabelVisible(): Promise<void> {
        await expect(this.getAccountRoleLabel()).toBeVisible();
    }

    /**
     * Verify account role label is NOT visible (for regular users)
     */
    async verifyAccountRoleLabelNotVisible(): Promise<void> {
        await expect(this.getAccountRoleLabel()).not.toBeVisible();
    }

    /**
     * Verify account role value is displayed
     */
    async verifyAccountRoleValueVisible(value: string): Promise<void> {
        await expect(this.getAccountRoleValue(value)).toBeVisible();
    }

    // ============================================================================
    // PASSWORD CHECKLIST VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify password checklist heading is visible
     */
    async verifyPasswordChecklistHeadingVisible(): Promise<void> {
        await expect(this.getPasswordChecklistHeading()).toBeVisible();
    }

    /**
     * Verify a password requirement is visible by pattern
     */
    async verifyPasswordRequirementVisible(pattern: RegExp): Promise<void> {
        await expect(this.getPasswordRequirement(pattern)).toBeVisible();
    }

    // ============================================================================
    // SECTION HEADER VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify all section headers and info icons are visible
     */
    async verifySectionHeadersAndInfoIconsVisible(): Promise<void> {
        await expect(this.getProfileInformationHeader()).toBeVisible();
        await expect(this.getProfileInformationInfoIcon()).toBeVisible();
        await expect(this.getPasswordHeader()).toBeVisible();
        await expect(this.getPasswordInfoIcon()).toBeVisible();
    }

    /**
     * Verify profile information section header is visible
     */
    async verifyProfileInformationHeaderVisible(): Promise<void> {
        await expect(this.getProfileInformationHeader()).toBeVisible();
    }

    /**
     * Verify profile information section info icon is visible (description in tooltip)
     */
    async verifyProfileInformationInfoIconVisible(): Promise<void> {
        await expect(this.getProfileInformationInfoIcon()).toBeVisible();
    }

    /**
     * Verify password section header is visible
     */
    async verifyPasswordSectionHeaderVisible(): Promise<void> {
        await expect(this.getPasswordHeader()).toBeVisible();
    }

    /**
     * Verify password section info icon is visible (description in tooltip)
     */
    async verifyPasswordInfoIconVisible(): Promise<void> {
        await expect(this.getPasswordInfoIcon()).toBeVisible();
    }

    /**
     * Verify hero/title label is visible
     */
    async verifyHeroLabelVisible(): Promise<void> {
        await expect(this.getHeroLabel()).toBeVisible();
    }

    /**
     * Language Preferences Locators
     */
    protected getLanguageSelect(): Locator {
        // Use name attribute - stable across language changes (aria-label changes with language)
        return this.page.locator('select[name="language"]');
    }

    protected getLanguageSectionHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.languageSelector.label });
    }

    /**
     * Language Preferences Actions
     */
    async selectLanguage(languageCode: 'en' | 'uk' | 'ar'): Promise<void> {
        const select = this.getLanguageSelect();
        await select.selectOption(languageCode);

        // Wait for language change to be reflected in DOM
        // Arabic is RTL, other languages are LTR
        const expectedDir = languageCode === 'ar' ? 'rtl' : 'ltr';
        await expect(this.page.locator('html')).toHaveAttribute('dir', expectedDir);
    }

    /**
     * Language Preferences Verification Methods
     */
    async verifyLanguageSectionVisible(): Promise<void> {
        await expect(this.getLanguageSectionHeading()).toBeVisible();
        await expect(this.getLanguageSelect()).toBeVisible();
    }

    async verifyLanguageSelected(languageCode: 'en' | 'uk' | 'ar'): Promise<void> {
        await expect(this.getLanguageSelect()).toHaveValue(languageCode);
    }

    async verifyLanguageSectionHeadingText(expectedText: string): Promise<void> {
        // After language change, verify the section heading reflects the new language
        await expect(this.page.getByRole('heading', { name: expectedText })).toBeVisible();
    }

    /**
     * Page Direction Verification Methods
     */
    async verifyPageDirectionIsRTL(): Promise<void> {
        const dir = await this.page.locator('html').getAttribute('dir');
        expect(dir).toBe('rtl');
    }

    async verifyPageDirectionIsLTR(): Promise<void> {
        const dir = await this.page.locator('html').getAttribute('dir');
        expect(dir).toBe('ltr');
    }

    // ============================================================================
    // EMAIL PREFERENCES SECTION LOCATORS
    // ============================================================================

    /**
     * Email Preferences section container
     */
    protected getEmailPreferencesSection(): Locator {
        return this.page.getByRole('region', { name: translation.settingsPage.emailPreferences.title });
    }

    /**
     * Email Preferences section header
     */
    protected getEmailPreferencesHeader(): Locator {
        return this.page.getByRole('heading', { name: translation.settingsPage.emailPreferences.title });
    }

    /**
     * Admin emails label (account notifications)
     */
    protected getAdminEmailsLabel(): Locator {
        return this.getEmailPreferencesSection().getByText(translation.settingsPage.emailPreferences.adminEmails.label);
    }

    /**
     * Admin emails description
     */
    protected getAdminEmailsDescription(): Locator {
        return this.getEmailPreferencesSection().getByText(translation.settingsPage.emailPreferences.adminEmails.description);
    }

    /**
     * Marketing emails checkbox
     */
    protected getMarketingEmailsCheckbox(): Locator {
        return this.getEmailPreferencesSection().getByLabel(
            translation.settingsPage.emailPreferences.marketingEmails.label,
        );
    }

    /**
     * Marketing emails description
     */
    protected getMarketingEmailsDescription(): Locator {
        return this.getEmailPreferencesSection().getByText(
            translation.settingsPage.emailPreferences.marketingEmails.description,
        );
    }

    // ============================================================================
    // EMAIL PREFERENCES ACTIONS
    // ============================================================================

    /**
     * Toggle marketing emails checkbox
     */
    async toggleMarketingEmailsCheckbox(): Promise<void> {
        await this.getMarketingEmailsCheckbox().click();
    }

    /**
     * Check marketing emails checkbox (ensure it's checked)
     */
    async checkMarketingEmailsCheckbox(): Promise<void> {
        const checkbox = this.getMarketingEmailsCheckbox();
        await checkbox.check();
    }

    /**
     * Uncheck marketing emails checkbox (ensure it's unchecked)
     */
    async uncheckMarketingEmailsCheckbox(): Promise<void> {
        const checkbox = this.getMarketingEmailsCheckbox();
        await checkbox.uncheck();
    }

    // ============================================================================
    // EMAIL PREFERENCES VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify email preferences section is visible
     */
    async verifyEmailPreferencesSectionVisible(): Promise<void> {
        await expect(this.getEmailPreferencesHeader()).toBeVisible();
        await expect(this.getAdminEmailsLabel()).toBeVisible();
        await expect(this.getMarketingEmailsCheckbox()).toBeVisible();
    }

    /**
     * Verify email preferences header is visible
     */
    async verifyEmailPreferencesHeaderVisible(): Promise<void> {
        await expect(this.getEmailPreferencesHeader()).toBeVisible();
    }

    /**
     * Verify admin emails info is displayed (read-only section)
     */
    async verifyAdminEmailsInfoVisible(): Promise<void> {
        await expect(this.getAdminEmailsLabel()).toBeVisible();
        await expect(this.getAdminEmailsDescription()).toBeVisible();
    }

    /**
     * Verify admin emails accepted date is displayed
     */
    async verifyAdminEmailsAcceptedDateVisible(date: string): Promise<void> {
        const dateText = this.getEmailPreferencesSection().getByText(date);
        await expect(dateText).toBeVisible();
    }

    /**
     * Verify marketing emails checkbox is visible
     */
    async verifyMarketingEmailsCheckboxVisible(): Promise<void> {
        await expect(this.getMarketingEmailsCheckbox()).toBeVisible();
    }

    /**
     * Verify marketing emails checkbox is checked
     */
    async verifyMarketingEmailsChecked(): Promise<void> {
        await expect(this.getMarketingEmailsCheckbox()).toBeChecked();
    }

    /**
     * Verify marketing emails checkbox is unchecked
     */
    async verifyMarketingEmailsUnchecked(): Promise<void> {
        await expect(this.getMarketingEmailsCheckbox()).not.toBeChecked();
    }

    /**
     * Verify marketing emails checkbox is disabled (during update)
     */
    async verifyMarketingEmailsCheckboxDisabled(): Promise<void> {
        await expect(this.getMarketingEmailsCheckbox()).toBeDisabled();
    }

    /**
     * Verify marketing emails checkbox is enabled
     */
    async verifyMarketingEmailsCheckboxEnabled(): Promise<void> {
        await expect(this.getMarketingEmailsCheckbox()).toBeEnabled();
    }

    /**
     * Verify marketing emails description is visible
     */
    async verifyMarketingEmailsDescriptionVisible(): Promise<void> {
        await expect(this.getMarketingEmailsDescription()).toBeVisible();
    }
}

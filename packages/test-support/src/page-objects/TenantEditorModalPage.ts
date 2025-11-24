import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class TenantEditorModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // Locators
    get modal() {
        return this.page.getByTestId('tenant-editor-modal');
    }

    get tenantIdInput() {
        return this.page.getByTestId('tenant-id-input');
    }

    get appNameInput() {
        return this.page.getByTestId('app-name-input');
    }

    get logoUploadField() {
        return this.page.getByTestId('logo-upload-field');
    }

    get faviconUploadField() {
        return this.page.getByTestId('favicon-upload-field');
    }

    get primaryColorInput() {
        return this.page.getByTestId('primary-color-input');
    }

    get secondaryColorInput() {
        return this.page.getByTestId('secondary-color-input');
    }

    get accentColorInput() {
        return this.page.getByTestId('accent-color-input');
    }

    get backgroundColorInput() {
        return this.page.getByTestId('background-color-input');
    }

    get headerBackgroundColorInput() {
        return this.page.getByTestId('header-background-color-input');
    }

    get themePaletteInput() {
        return this.page.getByTestId('theme-palette-input');
    }

    get customCssInput() {
        return this.page.getByTestId('custom-css-input');
    }

    get showLandingPageCheckbox() {
        return this.page.getByTestId('show-landing-page-checkbox');
    }

    get showMarketingContentCheckbox() {
        return this.page.getByTestId('show-marketing-content-checkbox');
    }

    get showPricingPageCheckbox() {
        return this.page.getByTestId('show-pricing-page-checkbox');
    }

    get newDomainInput() {
        return this.page.getByTestId('new-domain-input');
    }

    get addDomainButton() {
        return this.page.getByTestId('add-domain-button');
    }

    get saveTenantButton() {
        return this.page.getByTestId('save-tenant-button');
    }

    get cancelButton() {
        return this.page.getByTestId('cancel-button');
    }

    get closeModalButton() {
        return this.page.getByTestId('close-modal-button');
    }

    get publishButton() {
        return this.page.getByTestId('publish-theme-button');
    }

    get successAlert() {
        return this.page.locator('[role="alert"]').filter({ hasText: 'successfully' });
    }

    get errorAlert() {
        return this.page.locator('[role="alert"][class*="error"]');
    }

    // Actions
    async waitForModalToBeVisible() {
        await this.modal.waitFor({ state: 'visible' });
    }

    async waitForModalToBeHidden() {
        await this.modal.waitFor({ state: 'hidden' });
    }

    async fillTenantId(value: string) {
        await this.tenantIdInput.fill(value);
    }

    async fillAppName(value: string) {
        await this.appNameInput.fill(value);
    }

    async fillLogoUrl(url: string) {
        // Find the "Or enter URL" button within the logo upload field
        const logoField = this.page.getByTestId('logo-upload-field');
        await logoField.getByRole('button', { name: 'Or enter URL' }).click();
        // Fill URL input
        await this.page.getByTestId('logo-upload-field-url-input').fill(url);
        // Click Download button within logo field
        await logoField.getByRole('button', { name: 'Download' }).click();
        // Wait for download to complete
        await this.page.waitForTimeout(1000);
    }

    async fillFaviconUrl(url: string) {
        // Find the "Or enter URL" button within the favicon upload field
        const faviconField = this.page.getByTestId('favicon-upload-field');
        await faviconField.getByRole('button', { name: 'Or enter URL' }).click();
        // Fill URL input
        await this.page.getByTestId('favicon-upload-field-url-input').fill(url);
        // Click Download button within favicon field
        await faviconField.getByRole('button', { name: 'Download' }).click();
        // Wait for download to complete
        await this.page.waitForTimeout(1000);
    }

    async addDomain(domain: string) {
        await this.newDomainInput.fill(domain);
        await this.addDomainButton.click();
    }

    async removeDomain(index: number) {
        await this.page.getByTestId(`remove-domain-${index}`).click();
    }

    async setPrimaryColor(color: string) {
        await this.primaryColorInput.fill(color);
    }

    async setSecondaryColor(color: string) {
        await this.secondaryColorInput.fill(color);
    }

    async setAccentColor(color: string) {
        await this.accentColorInput.fill(color);
    }

    async setBackgroundColor(color: string) {
        await this.backgroundColorInput.fill(color);
    }

    async setHeaderBackgroundColor(color: string) {
        await this.headerBackgroundColorInput.fill(color);
    }

    async setThemePalette(palette: string) {
        await this.themePaletteInput.fill(palette);
    }

    async setCustomCss(css: string) {
        await this.customCssInput.fill(css);
    }

    async fillAllRequiredColors(colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        headerBackground: string;
    }) {
        await this.setPrimaryColor(colors.primary);
        await this.setSecondaryColor(colors.secondary);
        await this.setAccentColor(colors.accent);
        await this.setBackgroundColor(colors.background);
        await this.setHeaderBackgroundColor(colors.headerBackground);
    }

    async toggleShowLandingPage(checked: boolean) {
        const checkbox = this.showLandingPageCheckbox;
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleShowMarketingContent(checked: boolean) {
        const checkbox = this.showMarketingContentCheckbox;
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleShowPricingPage(checked: boolean) {
        const checkbox = this.showPricingPageCheckbox;
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async clickSave() {
        await this.saveTenantButton.click();
    }

    async clickCancel() {
        await this.cancelButton.click();
    }

    async clickClose() {
        await this.closeModalButton.click();
    }

    async clickPublish() {
        await this.publishButton.click();
    }

    // Verifications
    async verifyModalIsOpen() {
        await this.modal.waitFor({ state: 'visible' });
    }

    async verifyModalIsClosed() {
        // Modal closes after 1.5s delay in create mode to show success message
        await this.modal.waitFor({ state: 'hidden', timeout: 3000 });
    }

    async verifyTenantIdDisabled() {
        await this.page.waitForFunction(() => {
            const input = document.querySelector('[data-testid="tenant-id-input"]') as HTMLInputElement;
            return input?.disabled === true;
        });
    }

    async verifySuccessMessage(message?: string) {
        await this.successAlert.waitFor({ state: 'visible' });
        if (message) {
            await this.page.waitForSelector(`text="${message}"`);
        }
    }

    async verifyErrorMessage(message?: string) {
        await this.errorAlert.waitFor({ state: 'visible' });
        if (message) {
            await this.page.waitForSelector(`text="${message}"`);
        }
    }

    async verifyFieldValue(fieldTestId: string, expectedValue: string) {
        const field = this.page.getByTestId(fieldTestId);
        await this.page.waitForFunction(
            ({ testId, value }) => {
                const input = document.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
                return input?.value === value;
            },
            { testId: fieldTestId, value: expectedValue },
        );
    }

    async fillBasicTenantInfo(data: {
        tenantId: string;
        appName: string;
        logoUrl?: string;
        domains: string[];
    }) {
        await this.fillTenantId(data.tenantId);
        await this.fillAppName(data.appName);
        if (data.logoUrl) {
            await this.fillLogoUrl(data.logoUrl);
        }
        // Add each domain
        for (const domain of data.domains) {
            await this.addDomain(domain);
        }
    }
}

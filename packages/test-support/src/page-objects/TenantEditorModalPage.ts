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

    get logoUrlInput() {
        return this.page.getByTestId('logo-url-input');
    }

    get faviconUrlInput() {
        return this.page.getByTestId('favicon-url-input');
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

    async fillLogoUrl(value: string) {
        await this.logoUrlInput.fill(value);
    }

    async fillFaviconUrl(value: string) {
        await this.faviconUrlInput.fill(value);
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

    // Verifications
    async verifyModalIsOpen() {
        await this.modal.waitFor({ state: 'visible' });
    }

    async verifyModalIsClosed() {
        await this.modal.waitFor({ state: 'hidden' });
    }

    async verifyTenantIdDisabled() {
        await this.page.waitForFunction(() => {
            const input = document.querySelector('[data-testid="tenant-id-input"]') as HTMLInputElement;
            return input?.disabled === true;
        });
    }

    async verifySuccessMessage() {
        await this.successAlert.waitFor({ state: 'visible' });
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
        logoUrl: string;
        domains: string[];
    }) {
        await this.fillTenantId(data.tenantId);
        await this.fillAppName(data.appName);
        await this.fillLogoUrl(data.logoUrl);
        // Add each domain
        for (const domain of data.domains) {
            await this.addDomain(domain);
        }
    }
}

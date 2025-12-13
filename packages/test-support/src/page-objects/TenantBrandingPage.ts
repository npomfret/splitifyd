import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { translationEn } from '../translations/translation-en';

const translation = translationEn;

/**
 * Page Object Model for the Tenant Branding Configuration page.
 * Provides methods for interacting with tenant branding settings (admin-only).
 */
export class TenantBrandingPage extends BasePage {
    readonly url = '/settings/tenant/branding';

    constructor(page: Page) {
        super(page);
    }

    /**
     * Navigate to tenant branding page
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });

        // Check if we successfully navigated
        try {
            await expect(this.page).toHaveURL(/\/settings\/tenant\/branding/);
        } catch (error) {
            // May have been denied access
            const url = this.page.url();
            if (url.includes('/settings/tenant/branding')) {
                // We're on the page but might show access denied
                return;
            }
            throw new Error(`Expected to navigate to tenant branding page but was redirected to: ${url}`);
        }
    }

    /**
     * Form Input Locators
     */
    protected getAppNameInput(): Locator {
        return this.page.getByLabel(translation.tenantBranding.fields.appName);
    }

    protected getLogoUrlInput(): Locator {
        return this.page.locator('[data-testid="logo-url-input"]');
    }

    protected getFaviconUrlInput(): Locator {
        return this.page.locator('[data-testid="favicon-url-input"]');
    }

    protected getPrimaryColorInput(): Locator {
        return this.page.locator('[data-testid="primary-color-input"]');
    }

    protected getSecondaryColorInput(): Locator {
        return this.page.locator('[data-testid="secondary-color-input"]');
    }

    protected getShowMarketingContentCheckbox(): Locator {
        return this.page.getByRole('checkbox', { name: translation.tenantBranding.marketing.contentLabel });
    }

    protected getShowPricingPageCheckbox(): Locator {
        return this.page.getByRole('checkbox', { name: translation.tenantBranding.marketing.pricingLabel });
    }

    protected getSaveButton(): Locator {
        return this.page.locator('[data-testid="save-branding-button"]');
    }

    /**
     * Access Denied Message
     */
    protected getAccessDeniedMessage(): Locator {
        return this.page.locator('text=/you do not have permission/i');
    }

    /**
     * Success/Error Messages
     */
    protected getSuccessMessage(): Locator {
        return this.page.locator('text=/branding settings updated successfully/i');
    }

    protected getNotImplementedMessage(): Locator {
        return this.page.locator('text=/branding update not yet implemented/i');
    }

    /**
     * Fill Methods
     */
    async fillAppName(appName: string): Promise<void> {
        await this.getAppNameInput().fill(appName);
    }

    async fillLogoUrl(logoUrl: string): Promise<void> {
        await this.getLogoUrlInput().fill(logoUrl);
    }

    async fillFaviconUrl(faviconUrl: string): Promise<void> {
        await this.getFaviconUrlInput().fill(faviconUrl);
    }

    async fillPrimaryColor(color: string): Promise<void> {
        await this.getPrimaryColorInput().fill(color);
    }

    async fillSecondaryColor(color: string): Promise<void> {
        await this.getSecondaryColorInput().fill(color);
    }

    async toggleShowMarketingContent(): Promise<void> {
        await this.getShowMarketingContentCheckbox().click();
    }

    async toggleShowPricingPage(): Promise<void> {
        await this.getShowPricingPageCheckbox().click();
    }

    async clickSaveButton(): Promise<void> {
        await this.getSaveButton().click();
    }

    /**
     * Verification Methods
     */
    async verifyAccessDenied(): Promise<void> {
        await expect(this.getAccessDeniedMessage()).toBeVisible();
    }

    async verifyAppName(expectedName: string): Promise<void> {
        await expect(this.getAppNameInput()).toHaveValue(expectedName);
    }

    async verifyLogoUrl(expectedUrl: string): Promise<void> {
        await expect(this.getLogoUrlInput()).toHaveValue(expectedUrl);
    }

    async verifyFaviconUrl(expectedUrl: string): Promise<void> {
        await expect(this.getFaviconUrlInput()).toHaveValue(expectedUrl);
    }

    async verifyPrimaryColor(expectedColor: string): Promise<void> {
        await expect(this.getPrimaryColorInput()).toHaveValue(expectedColor);
    }

    async verifySecondaryColor(expectedColor: string): Promise<void> {
        await expect(this.getSecondaryColorInput()).toHaveValue(expectedColor);
    }

    async verifySaveButtonEnabled(): Promise<void> {
        await expect(this.getSaveButton()).toBeEnabled();
    }

    async verifySaveButtonDisabled(): Promise<void> {
        await expect(this.getSaveButton()).toBeDisabled();
    }

    async verifySuccessMessage(): Promise<void> {
        await expect(this.getSuccessMessage()).toBeVisible();
    }

    async verifyNotImplementedMessage(): Promise<void> {
        await expect(this.getNotImplementedMessage()).toBeVisible();
    }

    async verifyShowMarketingContentChecked(checked: boolean): Promise<void> {
        if (checked) {
            await expect(this.getShowMarketingContentCheckbox()).toBeChecked();
        } else {
            await expect(this.getShowMarketingContentCheckbox()).not.toBeChecked();
        }
    }

    async verifyShowPricingPageChecked(checked: boolean): Promise<void> {
        if (checked) {
            await expect(this.getShowPricingPageCheckbox()).toBeChecked();
        } else {
            await expect(this.getShowPricingPageCheckbox()).not.toBeChecked();
        }
    }

    /**
     * Wait for page to be ready
     */
    async waitForPageReady(): Promise<void> {
        // Wait for the main heading to be visible
        await this.page.locator('text=Branding Configuration').waitFor({ state: 'visible' });
    }

    // Public locator accessors for tests
    getShowMarketingContentCheckboxLocator(): Locator {
        return this.getShowMarketingContentCheckbox();
    }

    getShowPricingPageCheckboxLocator(): Locator {
        return this.getShowPricingPageCheckbox();
    }
}

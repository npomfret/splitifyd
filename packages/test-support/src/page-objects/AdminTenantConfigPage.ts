import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the Admin Tenant Config page.
 * Displays current tenant configuration, theme info, and computed CSS variables.
 */
export class AdminTenantConfigPage extends BasePage {
    readonly url = '/admin?tab=tenant-config';

    constructor(page: Page) {
        super(page);
    }

    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
        await expect(this.page).toHaveURL(/\/admin.*tab=tenant-config/);
    }

    // Tenant Overview Card
    protected getTenantOverviewCard(): Locator {
        return this.page.getByTestId('tenant-overview-card');
    }

    protected getTenantIdValue(): Locator {
        return this.getTenantOverviewCard().locator('p:has-text("Tenant ID")').locator('..').locator('p.font-mono');
    }

    protected getAppNameValue(): Locator {
        return this.getTenantOverviewCard().locator('p:has-text("App Name")').locator('..').locator('p.font-medium').last();
    }

    protected getLastUpdatedValue(): Locator {
        return this.getTenantOverviewCard().locator('p:has-text("Last Updated")').locator('..').locator('p.font-medium').last();
    }

    // Theme Artifact Card
    protected getThemeArtifactCard(): Locator {
        return this.page.getByTestId('theme-artifact-card');
    }

    protected getActiveHashValue(): Locator {
        return this.getThemeArtifactCard().locator('p:has-text("Active Hash")').locator('..').locator('p.font-mono');
    }

    // Branding Tokens Card
    protected getBrandingTokensCard(): Locator {
        return this.page.getByTestId('branding-tokens-card');
    }

    // Computed CSS Variables Card
    protected getComputedVarsCard(): Locator {
        return this.page.getByTestId('computed-vars-card');
    }

    // Loading State
    protected getLoadingState(): Locator {
        return this.page.locator('text=Loading tenant configuration');
    }

    // Verification Methods
    async verifyPageLoaded(): Promise<void> {
        await expect(this.getTenantOverviewCard()).toBeVisible();
        await expect(this.getThemeArtifactCard()).toBeVisible();
    }

    async verifyTenantIdValue(expected: string): Promise<void> {
        await expect(this.getTenantIdValue()).toHaveText(expected);
    }

    async verifyTenantIdNotUnknown(): Promise<void> {
        await expect(this.getTenantIdValue()).not.toHaveText('unknown');
    }

    async verifyAppNameValue(expected: string): Promise<void> {
        await expect(this.getAppNameValue()).toHaveText(expected);
    }

    async verifyAppNameNotDefault(): Promise<void> {
        await expect(this.getAppNameValue()).not.toHaveText('Not configured');
    }

    async verifyActiveHashPresent(): Promise<void> {
        const hashText = await this.getActiveHashValue().textContent();
        expect(hashText).toBeTruthy();
        expect(hashText).not.toBe('not published');
    }

    async verifyBrandingTokensCardVisible(): Promise<void> {
        await expect(this.getBrandingTokensCard()).toBeVisible();
    }

    async verifyComputedVarsCardVisible(): Promise<void> {
        await expect(this.getComputedVarsCard()).toBeVisible();
    }

    async verifyLoadingStateHidden(): Promise<void> {
        await expect(this.getLoadingState()).not.toBeVisible();
    }
}

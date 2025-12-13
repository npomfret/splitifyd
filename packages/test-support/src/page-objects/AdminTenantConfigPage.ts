import { expect, Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

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

    // Tenant Overview Card - find heading and go up to parent Card
    protected getTenantOverviewCard(): Locator {
        return this
            .page
            .getByRole('heading', { name: translation.admin.tenantConfig.overview.title })
            .locator('xpath=ancestor::div[contains(@class, "rounded-xl")]')
            .first();
    }

    protected getTenantIdValue(): Locator {
        return this.getTenantOverviewCard().locator(`p:has-text("${translation.admin.tenantConfig.overview.tenantId}")`).locator('..').locator('p.font-mono');
    }

    protected getAppNameValue(): Locator {
        return this.getTenantOverviewCard().locator(`p:has-text("${translation.admin.tenantConfig.overview.appName}")`).locator('..').locator('p.font-medium').last();
    }

    protected getLastUpdatedValue(): Locator {
        return this.getTenantOverviewCard().locator(`p:has-text("${translation.admin.tenantConfig.overview.lastUpdated}")`).locator('..').locator('p.font-medium').last();
    }

    // Theme Artifact Card - find heading and go up to parent Card
    protected getThemeArtifactCard(): Locator {
        return this
            .page
            .getByRole('heading', { name: translation.admin.tenantConfig.theme.title })
            .locator('xpath=ancestor::div[contains(@class, "rounded-xl")]')
            .first();
    }

    protected getActiveHashValue(): Locator {
        return this.getThemeArtifactCard().locator(`p:has-text("${translation.admin.tenantConfig.theme.activeHash}")`).locator('..').locator('p.font-mono');
    }

    // Branding Tokens Card - find heading and go up to parent Card
    protected getBrandingTokensCard(): Locator {
        return this
            .page
            .getByRole('heading', { name: translation.admin.tenantConfig.brandingTokens.title })
            .locator('xpath=ancestor::div[contains(@class, "rounded-xl")]')
            .first();
    }

    // Computed CSS Variables Card - find heading and go up to parent Card
    protected getComputedVarsCard(): Locator {
        return this
            .page
            .getByRole('heading', { name: translation.admin.tenantConfig.computedCss.title })
            .locator('xpath=ancestor::div[contains(@class, "rounded-xl")]')
            .first();
    }

    // Loading State
    protected getLoadingState(): Locator {
        return this.page.getByText(translation.admin.tenantConfig.loading, { exact: false });
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
        await expect(this.getAppNameValue()).not.toHaveText(translation.common.notConfigured);
    }

    async verifyActiveHashPresent(): Promise<void> {
        const hashText = await this.getActiveHashValue().textContent();
        expect(hashText).toBeTruthy();
        expect(hashText).not.toBe(translation.admin.tenantConfig.theme.notPublished);
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

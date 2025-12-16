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

    // Tenant Overview Card - uses semantic region role
    protected getTenantOverviewCard(): Locator {
        return this.page.getByRole('region', { name: translation.admin.tenantConfig.overview.title });
    }

    protected getTenantIdValue(): Locator {
        return this.getTenantOverviewCard().getByLabel(translation.admin.tenantConfig.overview.tenantIdValue);
    }

    protected getAppNameValue(): Locator {
        return this.getTenantOverviewCard().getByLabel(translation.admin.tenantConfig.overview.appNameValue);
    }

    protected getLastUpdatedValue(): Locator {
        return this.getTenantOverviewCard().getByLabel(translation.admin.tenantConfig.overview.lastUpdatedValue);
    }

    // Theme Artifact Card - uses semantic region role
    protected getThemeArtifactCard(): Locator {
        return this.page.getByRole('region', { name: translation.admin.tenantConfig.theme.title });
    }

    protected getActiveHashValue(): Locator {
        return this.getThemeArtifactCard().getByLabel(translation.admin.tenantConfig.theme.activeHashValue);
    }

    // Branding Tokens Card - uses semantic region role
    protected getBrandingTokensCard(): Locator {
        return this.page.getByRole('region', { name: translation.admin.tenantConfig.brandingTokens.title });
    }

    // Computed CSS Variables Card - uses semantic region role
    protected getComputedVarsCard(): Locator {
        return this.page.getByRole('region', { name: translation.admin.tenantConfig.computedCss.title });
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

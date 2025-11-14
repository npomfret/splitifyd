import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for /admin/diagnostics.
 * Gives tests stable access to the white-label diagnostics tooling.
 */
export class AdminDiagnosticsPage extends BasePage {
    readonly url = '/admin/diagnostics';

    constructor(page: Page) {
        super(page);
    }

    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
        await expect(this.page).toHaveURL(/\/admin\/diagnostics/);
    }

    getTenantOverviewCard(): Locator {
        return this.page.getByTestId('tenant-overview-card');
    }

    getThemeArtifactCard(): Locator {
        return this.page.getByTestId('theme-artifact-card');
    }

    getBrandingTokensCard(): Locator {
        return this.page.getByTestId('branding-tokens-card');
    }

    getComputedVarsCard(): Locator {
        return this.page.getByTestId('computed-vars-card');
    }

    getCopyThemeLinkButton(): Locator {
        return this.page.getByTestId('copy-theme-link-button');
    }

    getForceReloadButton(): Locator {
        return this.page.getByTestId('force-reload-theme-button');
    }

    async verifyTenantOverviewVisible(): Promise<void> {
        await expect(this.getTenantOverviewCard()).toBeVisible();
    }

    async verifyThemeArtifactVisible(): Promise<void> {
        await expect(this.getThemeArtifactCard()).toBeVisible();
    }

    async copyThemeLink(): Promise<void> {
        await this.clickButton(this.getCopyThemeLinkButton(), { buttonName: 'Copy Theme Link' });
    }

    async forceReloadTheme(): Promise<void> {
        await this.clickButton(this.getForceReloadButton(), { buttonName: 'Force Reload Theme' });
    }
}

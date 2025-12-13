import { expect, Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

/**
 * Page Object Model for /admin/diagnostics.
 * Gives tests stable access to the white-label diagnostics tooling.
 *
 * Note: The admin tab is now called "Tenant Config" not "diagnostics",
 * but we keep this page object name for backwards compatibility.
 */
export class AdminDiagnosticsPage extends BasePage {
    readonly url = '/admin?tab=diagnostics';

    constructor(page: Page) {
        super(page);
    }

    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
        await expect(this.page).toHaveURL(/\/admin\?tab=diagnostics/);
    }

    /**
     * Get card by its heading text - uses heading-based scoping
     */
    private getCardByHeading(headingText: string): Locator {
        return this.page.locator('section, div').filter({
            has: this.page.getByRole('heading', { name: headingText }),
        });
    }

    protected getTenantOverviewCard(): Locator {
        return this.getCardByHeading(translation.admin.tenantConfig.overview.title);
    }

    protected getThemeArtifactCard(): Locator {
        return this.getCardByHeading(translation.admin.tenantConfig.theme.title);
    }

    protected getBrandingTokensCard(): Locator {
        return this.getCardByHeading(translation.admin.tenantConfig.brandingTokens.title);
    }

    protected getComputedVarsCard(): Locator {
        return this.getCardByHeading(translation.admin.tenantConfig.computedCss.title);
    }

    protected getCopyThemeLinkButton(): Locator {
        return this.page.getByRole('button', { name: translation.admin.tenantConfig.theme.copyLink });
    }

    protected getForceReloadButton(): Locator {
        return this.page.getByRole('button', { name: translation.admin.tenantConfig.theme.forceReload });
    }

    async verifyTenantOverviewVisible(): Promise<void> {
        await expect(this.getTenantOverviewCard()).toBeVisible();
    }

    async verifyThemeArtifactVisible(): Promise<void> {
        await expect(this.getThemeArtifactCard()).toBeVisible();
    }

    async copyThemeLink(): Promise<void> {
        await this.clickButton(this.getCopyThemeLinkButton(), { buttonName: translation.admin.tenantConfig.theme.copyLink });
    }

    async forceReloadTheme(): Promise<void> {
        await this.clickButton(this.getForceReloadButton(), { buttonName: translation.admin.tenantConfig.theme.forceReload });
    }
}

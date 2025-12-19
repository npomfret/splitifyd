import { expect, Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

/**
 * Footer component page object.
 * Footer links are now configurable per tenant via brandingTokens.tokens.footer.links.
 * Used as a component on pages that include the footer via `this.footer`.
 */
export class FooterComponent extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // LOCATORS
    // ============================================================================

    protected getFooter(): Locator {
        return this.page.locator('footer');
    }

    protected getCompanyName(): Locator {
        // .first(): Company name is the first heading in footer, before section headings
        return this.getFooter().getByRole('heading').first();
    }

    protected getLinksSection(): Locator {
        return this.getFooter().getByRole('heading', { name: translation.footer.linksSection });
    }

    protected getCopyright(): Locator {
        return this.getFooter().locator('p').filter({ hasText: '©' });
    }

    /**
     * Get a footer link by its label text.
     * Footer links are external links (open in new tab).
     */
    protected getFooterLinkByLabel(label: string): Locator {
        return this.getFooter().getByRole('link', { name: label });
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    async verifyFooterVisible(): Promise<void> {
        await expect(this.getFooter()).toBeVisible();
    }

    async verifyCompanyNameVisible(): Promise<void> {
        await expect(this.getCompanyName()).toBeVisible();
    }

    async verifyLinksSectionVisible(): Promise<void> {
        await expect(this.getLinksSection()).toBeVisible();
    }

    async verifyCopyrightVisible(): Promise<void> {
        await expect(this.getCopyright()).toBeVisible();
    }

    /**
     * Verify a specific footer link is visible by its label.
     */
    async verifyFooterLinkVisible(label: string): Promise<void> {
        await expect(this.getFooterLinkByLabel(label)).toBeVisible();
    }

    /**
     * Verify a specific footer link is not visible by its label.
     */
    async verifyFooterLinkNotVisible(label: string): Promise<void> {
        await expect(this.getFooterLinkByLabel(label)).not.toBeVisible();
    }

    /**
     * Check if a footer link is visible by its label (without failing if not).
     */
    async isFooterLinkVisible(label: string): Promise<boolean> {
        return await this.getFooterLinkByLabel(label).isVisible();
    }

    /**
     * Verify a footer link has the expected href.
     */
    async verifyFooterLinkHref(label: string, expectedHref: string): Promise<void> {
        await expect(this.getFooterLinkByLabel(label)).toHaveAttribute('href', expectedHref);
    }

    /**
     * Verify a footer link opens in a new tab (has target="_blank").
     */
    async verifyFooterLinkOpensInNewTab(label: string): Promise<void> {
        await expect(this.getFooterLinkByLabel(label)).toHaveAttribute('target', '_blank');
    }

    /**
     * Verify a footer link has rel="noopener noreferrer" for security.
     */
    async verifyFooterLinkHasSecurityRel(label: string): Promise<void> {
        await expect(this.getFooterLinkByLabel(label)).toHaveAttribute('rel', 'noopener noreferrer');
    }

    /**
     * Verify a footer link has all expected attributes for an external link.
     */
    async verifyFooterLinkIsExternal(label: string, expectedHref: string): Promise<void> {
        await this.verifyFooterLinkVisible(label);
        await this.verifyFooterLinkHref(label, expectedHref);
        await this.verifyFooterLinkOpensInNewTab(label);
        await this.verifyFooterLinkHasSecurityRel(label);
    }

    /**
     * Verify the links section is NOT visible (when no links configured).
     */
    async verifyLinksSectionNotVisible(): Promise<void> {
        await expect(this.getLinksSection()).toHaveCount(0);
    }

    /**
     * Verify the app name (company name) displayed in the footer.
     */
    async verifyAppName(expectedName: string): Promise<void> {
        await expect(this.getCompanyName()).toHaveText(expectedName);
    }
}

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
        return this.getFooter().getByRole('heading').first();
    }

    protected getLinksSection(): Locator {
        return this.getFooter().getByRole('heading', { name: translation.footer.linksSection });
    }

    protected getCopyright(): Locator {
        return this.getFooter().locator('p').last();
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
}

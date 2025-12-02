import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Footer component page object.
 * Provides access to footer navigation links for Terms, Privacy, Cookies, and Pricing.
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

    protected getTermsLink(): Locator {
        return this.page.getByTestId('footer-terms-link');
    }

    protected getPrivacyLink(): Locator {
        return this.page.getByTestId('footer-privacy-link');
    }

    protected getCookiesLink(): Locator {
        return this.page.getByTestId('footer-cookies-link');
    }

    protected getPricingLink(): Locator {
        return this.page.getByTestId('footer-pricing-link');
    }

    // ============================================================================
    // NAVIGATION ACTIONS
    // ============================================================================

    /**
     * Click the Terms of Service link in the footer.
     * Navigates to /terms page.
     */
    async clickTermsLink(): Promise<void> {
        await this.getTermsLink().click();
        await expect(this.page).toHaveURL(/\/terms/);
    }

    /**
     * Click the Privacy Policy link in the footer.
     * Navigates to /privacy page.
     */
    async clickPrivacyLink(): Promise<void> {
        await this.getPrivacyLink().click();
        await expect(this.page).toHaveURL(/\/privacy/);
    }

    /**
     * Click the Cookie Policy link in the footer.
     * Navigates to /cookies page.
     */
    async clickCookiesLink(): Promise<void> {
        await this.getCookiesLink().click();
        await expect(this.page).toHaveURL(/\/cookies/);
    }

    /**
     * Click the Pricing link in the footer.
     * Navigates to /pricing page.
     * Note: This link is only visible when showPricingPage marketing flag is enabled.
     */
    async clickPricingLink(): Promise<void> {
        await this.getPricingLink().click();
        await expect(this.page).toHaveURL(/\/pricing/);
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    async verifyFooterVisible(): Promise<void> {
        await expect(this.getFooter()).toBeVisible();
    }

    async verifyTermsLinkVisible(): Promise<void> {
        await expect(this.getTermsLink()).toBeVisible();
    }

    async verifyPrivacyLinkVisible(): Promise<void> {
        await expect(this.getPrivacyLink()).toBeVisible();
    }

    async verifyCookiesLinkVisible(): Promise<void> {
        await expect(this.getCookiesLink()).toBeVisible();
    }

    async verifyPricingLinkVisible(): Promise<void> {
        await expect(this.getPricingLink()).toBeVisible();
    }

    async verifyPricingLinkNotVisible(): Promise<void> {
        await expect(this.getPricingLink()).not.toBeVisible();
    }

    /**
     * Check if the pricing link is visible (without failing if not).
     * Useful for conditional test logic based on marketing flags.
     */
    async isPricingLinkVisible(): Promise<boolean> {
        return await this.getPricingLink().isVisible();
    }
}

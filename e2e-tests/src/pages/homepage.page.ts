import { expect, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class HomepagePage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // Footer links
    getTermsLink() {
        return this.page.getByText('Terms of Service').first();
    }

    getPrivacyLink() {
        return this.page.getByText('Privacy Policy').first();
    }

    // Verification methods
    async clickTermsLink(): Promise<void> {
        await this.getTermsLink().click();
    }

    async clickPrivacyLink(): Promise<void> {
        await this.getPrivacyLink().click();
    }

    async verifyLoadingSpinnerHidden(): Promise<void> {
        const spinner = this.page.locator('.animate-spin');
        await expect(spinner).toBeHidden({ timeout: 5000 });
    }
}

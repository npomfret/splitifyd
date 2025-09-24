import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import { PooledTestUser } from '@splitifyd/shared';

export class HomepagePage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }
    // Navigation
    async navigate() {
        await this.navigateToHomepage();
    }

    // Footer links
    getTermsLink() {
        return this.page.getByText('Terms of Service').first();
    }

    getPrivacyLink() {
        return this.page.getByText('Privacy Policy').first();
    }
}

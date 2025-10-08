import { Page } from '@playwright/test';
import { PooledTestUser } from '@splitifyd/shared';
import { BasePage } from './base.page';

export class PricingPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }
    // Navigation
    async navigate() {
        await this.navigateToPricing();
    }
}

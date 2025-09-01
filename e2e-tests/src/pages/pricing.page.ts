import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import type { RegisteredUser as BaseUser } from '@splitifyd/shared';

export class PricingPage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }
    // Navigation
    async navigate() {
        await this.navigateToPricing();
    }

    // Get heading with specific level
    getHeadingWithLevel(text: string, level: number) {
        return this.page.getByRole('heading', { name: text, level });
    }
}

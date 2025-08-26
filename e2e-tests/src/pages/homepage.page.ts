import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import type { User as BaseUser } from '@splitifyd/shared';

export class HomepagePage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }
    // Navigation
    async navigate() {
        await this.navigateToHomepage();
    }

    // Header elements
    getStartedButton() {
        return this.page.getByRole('button', { name: /get started|start/i });
    }

    getPricingLink() {
        return this.page.getByRole('link', { name: 'Pricing' });
    }

    getLoginLink() {
        return this.page.getByRole('link', { name: 'Login' });
    }

    getSignUpLink() {
        return this.page.getByRole('link', { name: 'Sign Up', exact: true });
    }

    // Content sections
    getMainHeading() {
        return this.page.getByRole('heading', {
            name: 'Effortless Bill Splitting, Simplified & Smart.'
        });
    }
    
    // Footer links
    getTermsLink() {
        return this.page.getByRole('link', { name: 'Terms' });
    }
    
    getPrivacyLink() {
        return this.page.getByRole('link', { name: 'Privacy' });
    }
    
    // Logo
    getLogo() {
        return this.page.getByAltText('Splitifyd');
    }
    
    getLogoLink() {
        return this.page.getByRole('link', { name: /splitifyd|home/i }).first();
    }
    
    // Footer element
    getFooter() {
        return this.page.locator('footer');
    }

    // Additional element accessors for test refactoring
}

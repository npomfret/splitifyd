import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import type { RegisteredUser as BaseUser } from '@splitifyd/shared';

export class HomepagePage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }
    // Navigation
    async navigate() {
        await this.navigateToHomepage();
    }

    getPricingLink() {
        // Pricing link is in the footer, not header
        return this.page.getByText('Pricing').first();
    }

    getLoginLink() {
        // Login appears as a button in header - use test ID for consistency
        return this.page.getByTestId('header-login-link');
    }

    getSignUpLink() {
        // Sign Up appears as a button in header - use test ID to be specific
        return this.page.getByTestId('header-signup-link');
    }

    // Content sections
    getMainHeading() {
        return this.page.getByRole('heading', {
            name: 'Effortless Bill Splitting, Simplified & Smart.',
        });
    }

    // Footer links
    getTermsLink() {
        return this.page.getByText('Terms of Service').first();
    }

    getPrivacyLink() {
        return this.page.getByText('Privacy Policy').first();
    }

    // Logo
    getLogo() {
        return this.page.getByTestId('header-logo-link').locator('img');
    }

    getLogoLink() {
        // Use the test ID added to the logo button
        return this.page.getByTestId('header-logo-link');
    }

    // Footer element
    getFooter() {
        return this.page.locator('footer');
    }

    // Additional element accessors for test refactoring
}

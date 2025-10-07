import { Page } from '@playwright/test';
import { LoginPage as BaseLoginPage } from '@splitifyd/test-support';
import { RegisterPage } from './register.page.ts';

export class LoginPage extends BaseLoginPage {
    constructor(page: Page) {
        super(page);
    }

    // Override navigate method to include e2e-specific error handling
    async navigate() {
        await this.navigateToLogin();

        // Fail fast if we're not on the login page
        // This ensures tests start from a known state
        await this.expectUrl(/\/login/);
    }

    // E2E-specific method using navigation helper from BasePage
    async navigateToLogin() {
        await super.navigateToHomepage();
        await this.page.goto('/login');
        await this.waitForDomContentLoaded();
    }

    // E2E-specific version of clickSignUp that returns e2e RegisterPage
    async navigateToRegisterPage() {
        await this.clickSignUp();
        return new RegisterPage(this.page);
    }
}

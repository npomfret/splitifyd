import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES, HEADINGS, BUTTON_TEXTS } from '../constants/selectors';
import translation from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };
import { PooledTestUser } from '@splitifyd/shared';
import { RegisterPage } from './register.page.ts';

export class LoginPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }
    // Selectors
    readonly url = '/login';
    readonly signInButton = BUTTON_TEXTS.SIGN_IN;

    async navigate() {
        await this.navigateToLogin();

        // Fail fast if we're not on the login page
        // This ensures tests start from a known state
        try {
            await this.expectUrl(/\/login/);
        } catch (error) {
            throw new Error('Expected to navigate to login page but was redirected. Test requires clean authentication state.');
        }
    }

    async navigateToHomepage() {
        await super.navigateToHomepage();
    }

    async fillLoginForm(email: string, password: string, rememberMe = false) {
        await this.fillPreactInput(SELECTORS.EMAIL_INPUT, email);
        await this.fillPreactInput(SELECTORS.PASSWORD_INPUT, password);
        if (rememberMe) {
            await this.page.locator(SELECTORS.CHECKBOX).check();
        }
    }

    async submitForm() {
        // Use standardized button click with proper error handling
        const submitButton = this.getSubmitButton();
        await this.clickButton(submitButton, { buttonName: this.signInButton });
    }

    async login(email: string, password: string, rememberMe = false) {
        await this.expectUrl(/\/login/);
        await this.fillLoginForm(email, password, rememberMe);
        await this.submitForm();

        // Simple approach: just wait for the form submission to complete
        // The AuthenticationWorkflow will handle waiting for dashboard
        await this.waitForDomContentLoaded();
    }

    async clickSignUp() {
        // Use data-testid to ensure we click the correct SignUp button
        const button = this.page.locator('[data-testid="loginpage-signup-button"]');
        // Note: Buttons should be enabled before clicking
        await expect(button).toBeEnabled();
        await button.click();
        // user should be sent to register page (may include returnUrl parameter)
        await expect(this.page).toHaveURL(/\/register/);
        return new RegisterPage(this.page);
    }

    getSubmitButton() {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.signInButton });
    }

    getSignInHeading() {
        return this.page.getByRole(ARIA_ROLES.HEADING, { name: HEADINGS.SIGN_IN });
    }
}

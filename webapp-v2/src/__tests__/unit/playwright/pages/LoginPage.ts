import { expect, Page } from '@playwright/test';
import { BasePage } from '@splitifyd/test-support';
import type { User as BaseUser } from '@splitifyd/shared';

/**
 * LoginPage for webapp-v2 unit tests
 * Simplified version of e2e-tests LoginPage focused on unit test needs
 */
export class LoginPage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }

    // URL and selectors
    readonly url = '/login';

    /**
     * Navigate to login page
     */
    async navigate() {
        await this.navigateToPath(this.url);
        
        // Verify we're on the login page
        await this.expectUrl(/\/login/);
    }

    /**
     * Fill login form with proper async handling
     */
    async fillLoginForm(email: string, password: string, rememberMe = false) {
        await this.fillPreactInput(this.getEmailInput(), email);
        await this.fillPreactInput(this.getPasswordInput(), password);
        
        if (rememberMe) {
            await this.getRememberMeCheckbox().check();
        }
    }

    /**
     * Submit the login form
     */
    async submitForm() {
        const submitButton = this.getSubmitButton();
        await this.clickButton(submitButton, { buttonName: 'Sign In' });
    }

    /**
     * Complete login flow
     */
    async login(email: string, password: string, rememberMe = false) {
        await this.expectUrl(/\/login/);
        await this.fillLoginForm(email, password, rememberMe);
        await this.submitForm();
        await this.waitForDomContentLoaded();
    }

    /**
     * Click sign up button/link
     */
    async clickSignUp() {
        const button = this.getSignUpLink();
        await expect(button).toBeEnabled();
        await button.click();
    }

    /**
     * Click forgot password link
     */
    async clickForgotPassword() {
        const button = this.getForgotPasswordLink();
        await expect(button).toBeEnabled();
        await button.click();
    }

    // Element accessors
    getEmailInput() {
        return this._page.getByRole('textbox', { name: 'Email address' });
    }

    getPasswordInput() {
        return this._page.getByRole('textbox', { name: 'Password' });
    }

    getRememberMeCheckbox() {
        return this._page.locator('input[type="checkbox"]').first();
    }

    getSubmitButton() {
        return this._page.getByRole('button', { name: 'Sign In' });
    }

    getSignUpLink() {
        return this._page.getByRole('button', { name: /sign up/i }).first();
    }

    getForgotPasswordLink() {
        return this._page.getByRole('button', { name: /forgot.*password/i });
    }

    // Form validation helpers
    getSignInHeading() {
        return this._page.getByRole('heading', { name: /sign in/i });
    }

    getErrorMessage() {
        // More specific selector to avoid catching required field asterisks
        return this._page.locator('[data-testid="error-message"], .error-message, .alert-error, .text-red-600').filter({ hasText: /error|failed|invalid|incorrect/i });
    }

    /**
     * Check for form validation errors
     */
    async hasValidationErrors(): Promise<boolean> {
        const errorElements = this.getErrorMessage();
        return (await errorElements.count()) > 0;
    }

    /**
     * Wait for login form to be ready for interaction
     */
    async waitForFormReady(): Promise<void> {
        await this.waitForDomContentLoaded();
        await expect(this.getSubmitButton()).toBeVisible();
        await expect(this.getEmailInput()).toBeVisible();
        await expect(this.getPasswordInput()).toBeVisible();
    }

    /**
     * Verify form submission state
     */
    async verifyFormSubmissionState(expectedEnabled: boolean): Promise<void> {
        const submitButton = this.getSubmitButton();
        if (expectedEnabled) {
            await expect(submitButton).toBeEnabled();
        } else {
            await expect(submitButton).toBeDisabled();
        }
    }
}
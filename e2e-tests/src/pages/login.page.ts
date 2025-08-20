import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES, HEADINGS } from '../constants/selectors';
import type { User as BaseUser } from '@shared/shared-types';

export class LoginPage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }
    // Selectors
    readonly url = '/login';
    readonly signInButton = 'Sign In';
    readonly signUpLink = 'Sign up';
    readonly forgotPasswordLink = 'Forgot your password?';

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
        await this.fillLoginForm(email, password, rememberMe);
        await this.submitForm();

        // Simple approach: just wait for the form submission to complete
        // The AuthenticationWorkflow will handle waiting for dashboard
        await this.waitForNetworkIdle();
    }

    async clickSignUp() {
        const link = this.page.getByRole(ARIA_ROLES.LINK, { name: this.signUpLink }).first();
        // Note: Links aren't buttons, but we can still ensure they're enabled
        await expect(link).toBeEnabled();
        await link.click();
    }

    async clickForgotPassword() {
        const link = this.page.getByRole(ARIA_ROLES.LINK, { name: this.forgotPasswordLink });
        // Note: Links aren't buttons, but we can still ensure they're enabled
        await expect(link).toBeEnabled();
        await link.click();
    }

    // Element accessors for direct interaction in tests
    getEmailInput() {
        return this.page.locator(SELECTORS.EMAIL_INPUT);
    }

    getPasswordInput() {
        return this.page.locator(SELECTORS.PASSWORD_INPUT);
    }

    getRememberMeCheckbox() {
        return this.page.locator(SELECTORS.CHECKBOX);
    }

    getSubmitButton() {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.signInButton });
    }

    getSignUpLink() {
        return this.page.getByRole(ARIA_ROLES.LINK, { name: this.signUpLink });
    }

    getForgotPasswordLink() {
        return this.page.getByRole(ARIA_ROLES.LINK, { name: this.forgotPasswordLink });
    }

    // Form element labels and headings
    getSignInHeading() {
        return this.page.getByRole(ARIA_ROLES.HEADING, { name: HEADINGS.SIGN_IN });
    }

    getEmailLabel() {
        return this.page.getByText('Email address *');
    }

    getPasswordLabel() {
        return this.page.getByText('Password *');
    }

    // Security testing methods
    getLoginForm() {
        return this.page.locator('[data-testid="login-form"]');
    }

    getDashboardElement() {
        return this.page.locator('[data-testid="dashboard"]');
    }

    getEmailInputTestId() {
        return this.page.locator('[data-testid="email-input"]');
    }

    getPasswordInputTestId() {
        return this.page.locator('[data-testid="password-input"]');
    }

    getLoginSubmitTestId() {
        return this.page.locator('[data-testid="login-submit"]');
    }

    getErrorMessage() {
        return this.page.locator('[data-testid="error-message"]');
    }

    // Enhanced methods for form validation testing

    /**
     * Fill individual form fields using page object methods
     */
    async fillFormField(fieldType: 'email' | 'password', value: string): Promise<void> {
        const input = this.getFormField(fieldType);
        await this.fillPreactInput(input, value);
    }

    /**
     * Get form field by type
     */
    getFormField(fieldType: 'email' | 'password'): Locator {
        switch (fieldType) {
            case 'email': return this.getEmailInput();
            case 'password': return this.getPasswordInput();
        }
    }

    /**
     * Clear form fields using page object methods
     */
    async clearFormField(fieldType: 'email' | 'password'): Promise<void> {
        const input = this.getFormField(fieldType);
        await this.fillPreactInput(input, '');
    }

    /**
     * Verify form submission state (enabled/disabled)
     */
    async verifyFormSubmissionState(expectedEnabled: boolean): Promise<void> {
        const submitButton = this.getSubmitButton();
        if (expectedEnabled) {
            await expect(submitButton).toBeEnabled();
        } else {
            await expect(submitButton).toBeDisabled();
        }
    }

    /**
     * Wait for page to be ready for form interaction
     */
    async waitForFormReady(): Promise<void> {
        await this.page.waitForLoadState('domcontentloaded');
        await expect(this.getSubmitButton()).toBeVisible();
        await expect(this.getEmailInput()).toBeVisible();
        await expect(this.getPasswordInput()).toBeVisible();
    }

    /**
     * Enhanced error message detection for various error types
     */
    getFormErrorMessage(pattern?: string | RegExp): Locator {
        if (pattern) {
            return this.page.locator('.error-message, .text-red-500, .text-danger, [data-testid="error"]').filter({ hasText: pattern });
        }
        return this.page.locator('.error-message, .text-red-500, .text-danger, [data-testid="error"]');
    }

    /**
     * Check if form has validation errors
     */
    async hasValidationErrors(): Promise<boolean> {
        const errorElements = this.getFormErrorMessage();
        return (await errorElements.count()) > 0;
    }
}

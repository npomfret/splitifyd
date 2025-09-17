import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES, HEADINGS, BUTTON_TEXTS } from '../constants/selectors';
import { PooledTestUser } from '@splitifyd/shared';
import translation from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class RegisterPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }
    // Selectors
    readonly url = '/register';
    readonly fullNameInput = `input[placeholder="${translation.registerPage.fullNamePlaceholder}"]`;
    readonly emailInput = `input[placeholder="Enter your email"]`;
    readonly passwordInput = `input[placeholder="${translation.registerPage.passwordPlaceholder}"]`;
    readonly confirmPasswordInput = `input[placeholder="${translation.registerPage.confirmPasswordPlaceholder}"]`;
    readonly createAccountButton = BUTTON_TEXTS.CREATE_ACCOUNT;

    async navigate() {
        await this.navigateToRegister();

        // Fail fast if we're not on the register page
        // This ensures tests start from a known state
        try {
            await this.expectUrl(/\/register/);
        } catch (error) {
            throw new Error('Expected to navigate to register page but was redirected. Test requires clean authentication state.');
        }
    }

    async fillRegistrationForm(name: string, email: string, password: string) {
        await this.fillPreactInput(this.fullNameInput, name);
        await this.fillPreactInput(this.emailInput, email);
        await this.fillPreactInput(this.passwordInput, password);
        await this.fillPreactInput(this.confirmPasswordInput, password);
        // Check both required checkboxes using page object methods
        await this.checkTermsCheckbox();
        await this.checkCookieCheckbox();
    }

    async submitForm() {
        // Use standardized button click with proper error handling
        const submitButton = this.getSubmitButton();
        await this.clickButton(submitButton, { buttonName: this.createAccountButton });
    }

    async register(name: string, email: string, password: string) {
        await this.fillRegistrationForm(name, email, password);
        await this.submitForm();

        // Wait for registration to complete
        await this.waitForRegistrationCompletion();
    }

    /**
     * Wait for the registration process to complete
     * Handles both instant registration and slower processing with loading spinner
     */
    async waitForRegistrationCompletion() {
        const submitButton = this.getSubmitButton();

        // The UI shows a loading spinner in the submit button when processing
        // The button should become disabled when clicked

        // Wait for either:
        // 1. Button becomes disabled (indicates processing started)
        // 2. Immediate redirect to dashboard (instant registration)
        await Promise.race([
            // Option 1: Wait for button to become disabled (processing started)
            expect(submitButton).toBeDisabled({ timeout: 2000 }),

            // Option 2: Wait for immediate redirect (so fast button never visibly disables)
            this.page.waitForURL(/\/dashboard/, { timeout: 1000 }),
        ]).catch(() => {
            // It's ok if neither happens immediately, we'll still wait for the final redirect
        });

        // Now wait for the final redirect to dashboard (registration success)
        // This should happen whether we saw the button disable or not
        await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    }

    /**
     * Check if the loading spinner is visible
     */
    async isLoadingSpinnerVisible(): Promise<boolean> {
        const spinner = this.page.locator('button[type="submit"] svg.animate-spin');
        return await spinner.isVisible();
    }

    // Element accessors for direct interaction in tests
    getFullNameInput() {
        return this.page.locator(this.fullNameInput);
    }

    getEmailInput() {
        return this.page.locator(this.emailInput);
    }

    getPasswordInput() {
        return this.page.locator(this.passwordInput);
    }

    getConfirmPasswordInput() {
        return this.page.locator(this.confirmPasswordInput);
    }

    getTermsCheckbox() {
        return this.page.locator(`label:has-text("${translation.registerPage.acceptTerms} ${translation.registerPage.termsOfService}") input[type="checkbox"]`);
    }

    getCookieCheckbox() {
        return this.page.locator(`label:has-text("${translation.registerPage.acceptTerms} ${translation.registerPage.cookiePolicy}") input[type="checkbox"]`);
    }

    getSubmitButton() {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.createAccountButton });
    }

    getTermsText() {
        return this.page.locator(`text=${translation.registerPage.acceptTerms} ${translation.registerPage.termsOfService}`);
    }

    getCookieText() {
        return this.page.locator(`text=${translation.registerPage.acceptTerms} ${translation.registerPage.cookiePolicy}`);
    }

    getTermsLink() {
        return this.page.locator('a[href="/terms"]').first();
    }

    getCookiesLink() {
        return this.page.locator('a[href="/cookies"]').first();
    }

    getCreateAccountButton() {
        return this.page.locator(`button:has-text("${translation.registerPage.submitButton}")`);
    }

    // Helper method to check terms checkbox
    async checkTermsCheckbox() {
        await this.getTermsCheckbox().check();
    }

    // Helper method to check cookie checkbox
    async checkCookieCheckbox() {
        await this.getCookieCheckbox().check();
    }

    getEmailError() {
        return this.page.locator('[role="alert"], [data-testid*="error"], .error-message');
    }

    /**
     * Wait for and handle API response errors during registration
     */
    async waitForRegistrationResponse(expectedStatus?: number): Promise<void> {
        const responsePromise = this.page.waitForResponse((response) => response.url().includes('/api/register') && (expectedStatus ? response.status() === expectedStatus : response.status() >= 400));
        return responsePromise.then(() => {});
    }

    /**
     * Fill individual form fields using page object methods
     */
    async fillFormField(fieldType: 'name' | 'email' | 'password' | 'confirmPassword', value: string): Promise<void> {
        const input = this.getFormField(fieldType);
        await this.fillPreactInput(input, value);
    }

    /**
     * Get form field by type
     */
    getFormField(fieldType: 'name' | 'email' | 'password' | 'confirmPassword'): Locator {
        switch (fieldType) {
            case 'name':
                return this.getFullNameInput();
            case 'email':
                return this.getEmailInput();
            case 'password':
                return this.getPasswordInput();
            case 'confirmPassword':
                return this.getConfirmPasswordInput();
        }
    }

    async waitForFormReady(userInfo?: { displayName?: string; email?: string }): Promise<void> {
        const currentUrl = this.page.url();
        const expectedUrlPattern = /\/register/;

        // Enhanced URL check with better error reporting
        if (!currentUrl.match(expectedUrlPattern)) {
            throw new Error(`Register form URL validation failed - expected /register, got ${currentUrl}`);
        }

        await this.waitForDomContentLoaded();

        await expect(this.getSubmitButton()).toBeVisible({ timeout: 5000 });
        await expect(this.getFullNameInput()).toBeVisible({ timeout: 5000 });
        await expect(this.getEmailInput()).toBeVisible({ timeout: 5000 });
    }
}

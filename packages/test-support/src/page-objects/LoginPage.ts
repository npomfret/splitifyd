import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { loadTranslation } from './translation-loader';
import { DashboardPage } from './DashboardPage';

const translation = loadTranslation();

/**
 * Login Page Object Model for Playwright tests
 * Container-aware selectors using visible headings and semantic elements
 * Reusable across unit tests and e2e tests
 */
export class LoginPage extends BasePage {
    readonly url = '/login';

    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER SELECTORS - Based on visible UI elements users can see
    // ============================================================================

    /**
     * Main login form container - identified by the form element within the login layout
     */
    getLoginFormContainer(): Locator {
        // Find the form that contains login-specific elements
        return this.page.locator('form').filter({
            has: this.page.locator('input[type="email"]')
        });
    }

    /**
     * Login page heading container - helps identify we're on the right page
     */
    getPageHeading(): Locator {
        // Find the heading within the main login area
        return this.getLoginFormContainer().locator('..').getByRole('heading', { name: /log.?in|sign.?in/i }).or(
            this.page.getByRole('heading', { name: /log.?in|sign.?in/i })
        );
    }

    /**
     * Error message container within the login form
     */
    getErrorContainer(): Locator {
        // Use testid selector - most reliable for error messages
        return this.page.getByTestId('error-message');
    }

    // ============================================================================
    // FORM FIELD SELECTORS - Scoped to login form container
    // ============================================================================

    /**
     * Email input field within the login form
     */
    getEmailInput(): Locator {
        return this.getLoginFormContainer().locator('input[type="email"]');
    }

    /**
     * Password input field within the login form
     */
    getPasswordInput(): Locator {
        return this.getLoginFormContainer().locator('input[type="password"]');
    }

    /**
     * Remember me checkbox within the login form
     */
    getRememberMeCheckbox(): Locator {
        return this.getLoginFormContainer().getByTestId('remember-me-checkbox');
    }

    // ============================================================================
    // BUTTON SELECTORS - Scoped to login form container
    // ============================================================================

    /**
     * Primary submit button (Log In)
     */
    getSubmitButton(): Locator {
        // Look for submit button within form container first (scoped), then fall back to page-level
        return this.getLoginFormContainer().getByRole('button', { name: translation.loginPage.submitButton }).or(
            this.getLoginFormContainer().locator('button[type="submit"]')
        );
    }

    /**
     * Forgot password link/button
     */
    getForgotPasswordButton(): Locator {
        return this.getLoginFormContainer().getByRole('button', { name: /forgot.?password/i });
    }

    /**
     * Sign up button/link to navigate to register page
     */
    getSignUpButton(): Locator {
        // Look for visible "Sign Up" or "Create Account" text first, then fall back to testid
        return this.getLoginFormContainer().getByRole('link', { name: /sign.?up|create.*account|register/i }).or(
            this.getLoginFormContainer().getByRole('button', { name: /sign.?up|create.*account|register/i })
        ).or(
            this.getLoginFormContainer().getByTestId('loginpage-signup-button')
        );
    }

    /**
     * Sign in heading
     */
    getSignInHeading(): Locator {
        // Look for heading within the login form area first
        return this.getLoginFormContainer().locator('..').getByRole('heading', { name: translation.loginPage.title }).or(
            this.page.getByRole('heading', { name: translation.loginPage.title })
        );
    }

    /**
     * Default/Demo login button (if present)
     */
    getDefaultLoginButton(): Locator {
        return this.getLoginFormContainer().locator('button').filter({
            hasText: /demo|default/i
        });
    }

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify we're on the login page by checking for key elements
     */
    async verifyLoginPageLoaded(): Promise<void> {
        // Use regex to allow for query parameters
        await expect(this.page).toHaveURL(new RegExp(`^[^?]*${this.url.replace('/', '\\/')}(\\?.*)?$`));
        await expect(this.getLoginFormContainer()).toBeVisible();
        await expect(this.getEmailInput()).toBeVisible();
        await expect(this.getPasswordInput()).toBeVisible();
        await expect(this.getSubmitButton()).toBeVisible();
    }

    /**
     * Check if the form is in a loading state (all inputs disabled)
     */
    async isFormLoading(): Promise<boolean> {
        const emailDisabled = await this.getEmailInput().isDisabled();
        const passwordDisabled = await this.getPasswordInput().isDisabled();
        const submitDisabled = await this.getSubmitButton().isDisabled();

        return emailDisabled && passwordDisabled && submitDisabled;
    }

    /**
     * Check if the submit button is enabled (form is valid)
     */
    async isSubmitEnabled(): Promise<boolean> {
        return await this.getSubmitButton().isEnabled();
    }

    /**
     * Check if an error message is currently displayed
     */
    async hasErrorMessage(): Promise<boolean> {
        return await this.getErrorContainer().isVisible();
    }

    /**
     * Get the current error message text
     */
    async getErrorMessage(): Promise<string> {
        await expect(this.getErrorContainer()).toBeVisible();
        return await this.getErrorContainer().textContent() || '';
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Navigate to the login page
     * Uses Playwright's configured baseURL automatically
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url);
        await this.verifyLoginPageLoaded();
    }

    /**
     * Navigate to homepage (for e2e-tests compatibility)
     */
    async navigateToHomepage(): Promise<void> {
        await this.page.goto('/');
        await this.page.waitForLoadState('domcontentloaded');
    }

    /**
     * Fill the email field using proper Preact handling
     */
    async fillEmail(email: string): Promise<void> {
        await this.fillPreactInput(this.getEmailInput(), email);
    }

    /**
     * Fill the password field using proper Preact handling
     */
    async fillPassword(password: string): Promise<void> {
        await this.fillPreactInput(this.getPasswordInput(), password);
    }

    /**
     * Fill both email and password fields
     */
    async fillCredentials(email: string, password: string): Promise<void> {
        await this.fillEmail(email);
        await this.fillPassword(password);
    }

    /**
     * Fill login form (e2e-tests compatibility method)
     */
    async fillLoginForm(email: string, password: string, rememberMe = false): Promise<void> {
        await this.fillEmail(email);
        await this.fillPassword(password);
        if (rememberMe) {
            await this.toggleRememberMe();
        }
    }

    /**
     * Toggle the remember me checkbox
     */
    async toggleRememberMe(): Promise<void> {
        await this.getRememberMeCheckbox().click();
    }

    /**
     * Submit the login form
     */
    async submitForm(): Promise<void> {
        const submitButton = this.getSubmitButton();
        await this.clickButton(submitButton, { buttonName: 'Log In' });
    }

    /**
     * Complete login process with credentials
     * Non-fluent version - does not verify navigation or return page object
     */
    async login(email: string, password: string): Promise<void> {
        await this.fillCredentials(email, password);
        await this.submitForm();
    }

    /**
     * Complete login process with credentials and navigate to dashboard
     * Fluent version - verifies successful login and returns DashboardPage
     * Use this when you expect login to succeed
     */
    async loginAndNavigateToDashboard(email: string, password: string): Promise<DashboardPage> {
        // Verify form is ready for submission
        await this.fillCredentials(email, password);
        await expect(this.getSubmitButton()).toBeEnabled();

        // Submit form
        await this.submitForm();

        // Wait for navigation to dashboard
        await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 5000 });

        // Return dashboard page object
        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.verifyDashboardPageLoaded();
        return dashboardPage;
    }

    /**
     * Attempt login with credentials that will fail
     * Fluent version - verifies we stay on login page and error appears
     * Use this when you expect login to fail (wrong credentials, network error, etc.)
     */
    async loginExpectingFailure(email: string, password: string): Promise<void> {
        await this.fillCredentials(email, password);
        await this.submitForm();

        // Verify we stay on login page
        await expect(this.page).toHaveURL(/\/login/);

        // Wait for error message to appear
        await expect(this.getErrorContainer()).toBeVisible();
    }

    /**
     * Click the forgot password button
     */
    async clickForgotPassword(): Promise<void> {
        await this.clickButton(this.getForgotPasswordButton(), {
            buttonName: 'Forgot Password'
        });
    }

    /**
     * Click the sign up button to navigate to register page
     * Non-fluent version - does not return page object
     */
    async clickSignUp(): Promise<void> {
        await this.clickSignUpButton();
    }

    /**
     * Click the sign up button and navigate to register page
     * Fluent version - verifies navigation and would return RegisterPage (when created)
     * For now returns void until RegisterPage POM is created
     */
    async clickSignUpAndNavigateToRegister(): Promise<void> {
        const button = this.getSignUpButton();
        await this.clickButton(button, {
            buttonName: 'Sign Up'
        });
        // Wait for navigation to register page
        await expect(this.page).toHaveURL(/\/register/);

        // TODO: Return RegisterPage when it's created
        // import { RegisterPage } from './RegisterPage';
        // const registerPage = new RegisterPage(this.page);
        // await registerPage.verifyRegisterPageLoaded();
        // return registerPage;
    }

    /**
     * Internal method to click the sign up button with proper validation
     */
    protected async clickSignUpButton(): Promise<void> {
        const button = this.getSignUpButton();
        await this.clickButton(button, {
            buttonName: 'Sign Up'
        });
        // Wait for navigation to register page
        await expect(this.page).toHaveURL(/\/register/);
    }

    /**
     * Click the default/demo login button (if available)
     */
    async clickDefaultLogin(): Promise<void> {
        const button = this.getDefaultLoginButton();
        if (await button.count() > 0) {
            await this.clickButton(button, { buttonName: 'Default Login' });
        } else {
            throw new Error('Default login button not found');
        }
    }

    // ============================================================================
    // FORM STATE VERIFICATION
    // ============================================================================

    /**
     * Verify all form elements are enabled (not in loading state)
     */
    async verifyFormEnabled(): Promise<void> {
        await expect(this.getEmailInput()).toBeEnabled();
        await expect(this.getPasswordInput()).toBeEnabled();
        await expect(this.getSubmitButton()).toBeEnabled();
        await expect(this.getRememberMeCheckbox()).toBeEnabled();
    }

    /**
     * Verify all form elements are disabled (in loading state)
     */
    async verifyFormDisabled(): Promise<void> {
        await expect(this.getEmailInput()).toBeDisabled();
        await expect(this.getPasswordInput()).toBeDisabled();
        await expect(this.getSubmitButton()).toBeDisabled();
        await expect(this.getRememberMeCheckbox()).toBeDisabled();
    }

    /**
     * Verify specific error message is displayed
     */
    async verifyErrorMessage(expectedMessage: string): Promise<void> {
        await expect(this.getErrorContainer()).toBeVisible();
        await expect(this.getErrorContainer()).toContainText(expectedMessage);
    }

    /**
     * Verify no error message is displayed
     */
    async verifyNoErrorMessage(): Promise<void> {
        await expect(this.getErrorContainer()).not.toBeVisible();
    }

    /**
     * Verify submit button state based on form validity
     */
    async verifySubmitButtonState(shouldBeEnabled: boolean): Promise<void> {
        if (shouldBeEnabled) {
            await expect(this.getSubmitButton()).toBeEnabled();
        } else {
            await expect(this.getSubmitButton()).toBeDisabled();
        }
    }

    // ============================================================================
    // SESSION STORAGE VERIFICATION
    // ============================================================================

    /**
     * Get email value from sessionStorage
     */
    async getStoredEmail(): Promise<string | null> {
        return await this.page.evaluate(() => sessionStorage.getItem('login-email'));
    }

    /**
     * Get password value from sessionStorage
     */
    async getStoredPassword(): Promise<string | null> {
        return await this.page.evaluate(() => sessionStorage.getItem('login-password'));
    }

    /**
     * Clear login-related sessionStorage items
     */
    async clearStoredCredentials(): Promise<void> {
        await this.page.evaluate(() => {
            sessionStorage.removeItem('login-email');
            sessionStorage.removeItem('login-password');
        });
    }

    /**
     * Verify email field value matches what's stored in sessionStorage
     */
    async verifyEmailRestored(): Promise<void> {
        const storedEmail = await this.getStoredEmail();
        if (storedEmail) {
            await expect(this.getEmailInput()).toHaveValue(storedEmail);
        }
    }

    /**
     * Verify password field value matches what's stored in sessionStorage
     */
    async verifyPasswordRestored(): Promise<void> {
        const storedPassword = await this.getStoredPassword();
        if (storedPassword) {
            await expect(this.getPasswordInput()).toHaveValue(storedPassword);
        }
    }
}
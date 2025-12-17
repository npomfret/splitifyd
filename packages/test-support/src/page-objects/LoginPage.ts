import type { Email } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
import { TEST_ROUTES, TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { DashboardPage } from './DashboardPage';
import { FooterComponent } from './FooterComponent';

const translation = translationEn;

/**
 * Login Page Object Model for Playwright tests
 * Container-aware selectors using visible headings and semantic elements
 * Reusable across unit tests and e2e tests
 */
export class LoginPage extends BasePage {
    readonly url = '/login';
    private _footer?: FooterComponent;

    constructor(page: Page) {
        super(page);
    }

    /**
     * Access footer component for navigation to policy pages
     */
    get footer(): FooterComponent {
        if (!this._footer) {
            this._footer = new FooterComponent(this.page);
        }
        return this._footer;
    }

    // ============================================================================
    // HEADER SELECTORS
    // ============================================================================

    /**
     * Header logo link - navigates to home page for unauthenticated users
     * Uses aria-label for semantic selection
     */
    protected getHeaderLogoLink(): Locator {
        return this.page.getByRole('button', { name: translation.header.goToHome });
    }

    // ============================================================================
    // CONTAINER SELECTORS - Based on visible UI elements users can see
    // ============================================================================

    /**
     * Main login form container - identified by the form element within the login layout
     */
    protected getLoginFormContainer(): Locator {
        // Find the form that contains login-specific elements using semantic selector
        return this.page.locator('form').filter({
            has: this.page.getByLabel(translation.auth.emailInput.label),
        });
    }

    /**
     * Error message container within the login form
     * ErrorMessage component renders with role="alert"
     */
    protected getErrorContainer(): Locator {
        return this.page.getByRole('alert');
    }

    // ============================================================================
    // FORM FIELD SELECTORS - Scoped to login form container
    // ============================================================================

    /**
     * Email input field within the login form - uses label for semantic selection
     */
    protected getEmailInput(): Locator {
        return this.getLoginFormContainer().getByLabel(translation.auth.emailInput.label);
    }

    /**
     * Password input field within the login form - uses label for semantic selection
     */
    protected getPasswordInput(): Locator {
        return this.getLoginFormContainer().getByLabel(translation.auth.passwordInput.label, { exact: true });
    }

    /**
     * Remember me checkbox within the login form
     */
    protected getRememberMeCheckbox(): Locator {
        return this.getLoginFormContainer().getByLabel(translation.loginPage.rememberMe);
    }

    // ============================================================================
    // BUTTON SELECTORS - Scoped to login form container
    // ============================================================================

    /**
     * Primary submit button (Log In)
     */
    protected getSubmitButton(): Locator {
        return this.getLoginFormContainer().getByRole('button', { name: translation.loginPage.submitButton });
    }

    /**
     * Forgot password link/button
     */
    protected getForgotPasswordButton(): Locator {
        return this.getLoginFormContainer().getByRole('button', { name: translation.loginPage.forgotPassword });
    }

    /**
     * Sign up button/link to navigate to register page
     */
    protected getSignUpButton(): Locator {
        return this.getLoginFormContainer().getByRole('button', { name: translation.loginPage.signUp });
    }

    /**
     * Sign in heading - uses role-based selection without DOM traversal
     */
    protected getSignInHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.loginPage.title });
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
     * Get the current error message text
     */
    async getErrorMessage(): Promise<string> {
        await expect(this.getErrorContainer()).toBeVisible();
        return (await this.getErrorContainer().textContent()) || '';
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
     * Click the header logo.
     * For unauthenticated users, this redirects through dashboard back to login.
     * (The root route redirects to /dashboard which requires auth)
     */
    async clickHeaderLogo(): Promise<void> {
        await this.getHeaderLogoLink().click();
        // Unauthenticated users get redirected: / -> /dashboard -> /login
        await expect(this.page).toHaveURL(/\/login/);
    }

    /**
     * Fill the email field using proper Preact handling
     */
    async fillEmail(email: Email | string): Promise<void> {
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
    async fillCredentials(email: Email | string, password: string): Promise<void> {
        await this.fillEmail(email);
        await this.fillPassword(password);
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
    async login(email: Email, password: string): Promise<void> {
        await this.fillCredentials(email, password);
        await this.submitForm();
    }

    /**
     * Complete login process with credentials and navigate to dashboard
     * Fluent version - verifies successful login and returns DashboardPage
     * Use this when you expect login to succeed
     */
    async loginAndNavigateToDashboard(email: Email, password: string): Promise<DashboardPage> {
        await this.fillCredentials(email, password);
        await expect(this.getSubmitButton()).toBeEnabled({ timeout: TEST_TIMEOUTS.BUTTON_STATE });

        await this.submitForm();

        try {
            await expect(this.page).toHaveURL(TEST_ROUTES.DASHBOARD, { timeout: TEST_TIMEOUTS.NAVIGATION });
        } catch (error) {
            const currentUrl = this.page.url();
            const errorVisible = await this.getErrorContainer().isVisible();
            const errorText = errorVisible ? await this.getErrorMessage() : 'No error message';
            throw new Error(`Failed to navigate to dashboard after login. Current URL: ${currentUrl}. ` + `Error displayed: ${errorVisible}. Error message: "${errorText}"`);
        }

        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.verifyDashboardPageLoaded();
        return dashboardPage;
    }

    /**
     * Attempt login with credentials that will fail
     * Fluent version - verifies we stay on login page and error appears
     * Use this when you expect login to fail (wrong credentials, network error, etc.)
     */
    async loginExpectingFailure(email: Email | string, password: string): Promise<void> {
        await this.fillCredentials(email, password);
        await this.submitForm();

        try {
            await expect(this.page).toHaveURL(TEST_ROUTES.LOGIN, { timeout: TEST_TIMEOUTS.NAVIGATION });
            await expect(this.getErrorContainer()).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        } catch (error) {
            const currentUrl = this.page.url();
            const errorVisible = await this.getErrorContainer().isVisible();
            throw new Error(`Login failure behavior not as expected. Current URL: ${currentUrl}, ` + `Error visible: ${errorVisible}. Expected to stay on login page with error message.`);
        }
    }

    /**
     * Click the sign up button
     * Non-fluent version - clicks without verification, for flexibility
     */
    async clickSignUp(): Promise<void> {
        const button = this.getSignUpButton();
        await this.clickButton(button, { buttonName: 'Sign Up' });
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
        const errorContainer = this.getErrorContainer();

        try {
            await expect(errorContainer).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
            await expect(errorContainer).toContainText(expectedMessage, { timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        } catch (error) {
            const isVisible = await errorContainer.isVisible();
            const actualText = isVisible ? await this.getErrorMessage() : 'No error message';
            throw new Error(`Error message verification failed. Expected: "${expectedMessage}", ` + `Actual: "${actualText}", Error visible: ${isVisible}`);
        }
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

    /**
     * Verify sign-in heading is visible
     * @param timeout Optional timeout in milliseconds (default: TEST_TIMEOUTS.ELEMENT_VISIBLE)
     */
    async verifySignInHeadingVisible(timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        await expect(this.getSignInHeading()).toBeVisible({ timeout });
    }

    /**
     * Verify the sign-in button is visible
     */
    async verifySignInButtonVisible(): Promise<void> {
        await expect(this.getSubmitButton()).toBeVisible();
    }
}

import { expect, Locator, Page } from '@playwright/test';
import type { Email } from '@splitifyd/shared';
import { TEST_ROUTES, TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { DashboardPage } from './DashboardPage';

const translation = translationEn;

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
            has: this.page.locator('input[type="email"]'),
        });
    }

    /**
     * Login page heading container - helps identify we're on the right page
     */
    getPageHeading(): Locator {
        return this
            .getLoginFormContainer()
            .locator('..')
            .getByRole('heading', { name: /sign.*in/i });
    }

    /**
     * Error message container within the login form
     * ErrorMessage component renders with role="alert"
     */
    getErrorContainer(): Locator {
        return this.page.getByRole('alert');
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
        return this.getLoginFormContainer().getByRole('button', { name: translation.loginPage.submitButton });
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
        return this.getLoginFormContainer().getByTestId('loginpage-signup-button');
    }

    /**
     * Sign in heading
     */
    getSignInHeading(): Locator {
        return this.getLoginFormContainer().locator('..').getByRole('heading', { name: translation.loginPage.title });
    }

    /**
     * Default/Demo login button (if present)
     */
    getDefaultLoginButton(): Locator {
        return this.getLoginFormContainer().locator('button').filter({
            hasText: /demo/i,
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
     * Navigate to homepage (for e2e-tests compatibility)
     */
    async navigateToHomepage(): Promise<void> {
        await this.page.goto('/');
        await this.page.waitForLoadState('domcontentloaded');
    }

    /**
     * Fill the email field using proper Preact handling
     */
    async fillEmail(email: Email): Promise<void> {
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
    async fillCredentials(email: Email, password: string): Promise<void> {
        await this.fillEmail(email);
        await this.fillPassword(password);
    }

    /**
     * Fill login form (e2e-tests compatibility method)
     */
    async fillLoginForm(email: Email, password: string, rememberMe = false): Promise<void> {
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
    async loginExpectingFailure(email: Email, password: string): Promise<void> {
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
     * Click the forgot password button
     */
    async clickForgotPassword(): Promise<void> {
        await this.clickButton(this.getForgotPasswordButton(), {
            buttonName: 'Forgot Password',
        });
    }

    /**
     * Click the sign up button
     * Non-fluent version - clicks without verification, for flexibility
     */
    async clickSignUp(): Promise<void> {
        const button = this.getSignUpButton();
        await this.clickButton(button, { buttonName: 'Sign Up' });
    }

    /**
     * Click the sign up button and navigate to register page
     * Fluent version - verifies navigation and would return RegisterPage (when created)
     * For now returns void until RegisterPage POM is created
     */
    async clickSignUpAndNavigateToRegister(): Promise<void> {
        await this.clickSignUp();
        await expect(this.page).toHaveURL(/\/register/, { timeout: TEST_TIMEOUTS.NAVIGATION });

        // TODO: Return RegisterPage when it's created
        // import { RegisterPage } from './RegisterPage';
        // const registerPage = new RegisterPage(this.page);
        // await registerPage.verifyRegisterPageLoaded();
        // return registerPage;
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
}

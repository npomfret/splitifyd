import { expect, Locator, Page } from '@playwright/test';
import { TEST_ROUTES, TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';
import { DashboardPage } from './DashboardPage';
import { loadTranslation } from './translation-loader';

const translation = loadTranslation();

/**
 * Register Page Object Model for Playwright tests
 * Container-aware selectors using visible headings and semantic elements
 * Reusable across unit tests and e2e tests
 */
export class RegisterPage extends BasePage {
    readonly url = '/register';

    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER SELECTORS - Based on visible UI elements users can see
    // ============================================================================

    /**
     * Main register form container - identified by the form element within the register layout
     */
    getRegisterFormContainer(): Locator {
        // Find the form that contains registration-specific elements
        return this.page.locator('form').filter({
            has: this.page.locator('input#fullname-input'),
        });
    }

    /**
     * Register page heading container - helps identify we're on the right page
     */
    getPageHeading(): Locator {
        return this.getRegisterFormContainer().locator('..').getByRole('heading', { name: translation.registerPage.title });
    }

    /**
     * Error message container within the register form
     * ErrorMessage component renders with role="alert"
     */
    getErrorContainer(): Locator {
        return this.page.getByRole('alert');
    }

    // ============================================================================
    // FORM FIELD SELECTORS - Scoped to register form container
    // ============================================================================

    /**
     * Full name input field within the register form
     */
    getNameInput(): Locator {
        return this.getRegisterFormContainer().locator('input#fullname-input');
    }

    /**
     * Email input field within the register form
     */
    getEmailInput(): Locator {
        return this.getRegisterFormContainer().locator('input[type="email"]');
    }

    /**
     * Password input field within the register form
     */
    getPasswordInput(): Locator {
        return this.getRegisterFormContainer().locator('input#password-input');
    }

    /**
     * Confirm password input field within the register form
     */
    getConfirmPasswordInput(): Locator {
        return this.getRegisterFormContainer().locator('input#confirm-password-input');
    }

    /**
     * Terms of Service checkbox within the register form
     */
    getTermsCheckbox(): Locator {
        return this.getRegisterFormContainer().getByTestId('terms-checkbox');
    }

    /**
     * Cookie Policy checkbox within the register form
     */
    getCookiesCheckbox(): Locator {
        return this.getRegisterFormContainer().getByTestId('cookies-checkbox');
    }

    // ============================================================================
    // BUTTON SELECTORS - Scoped to register form container
    // ============================================================================

    /**
     * Primary submit button (Create Account)
     */
    getSubmitButton(): Locator {
        return this.getRegisterFormContainer().getByRole('button', { name: translation.registerPage.submitButton });
    }

    /**
     * Sign in button/link to navigate to login page
     */
    getSignInButton(): Locator {
        return this.getRegisterFormContainer().getByRole('button', { name: translation.registerPage.signIn });
    }

    /**
     * Terms of Service link
     */
    getTermsLink(): Locator {
        return this.getRegisterFormContainer().getByRole('link', { name: translation.registerPage.termsOfService });
    }

    /**
     * Cookie Policy link
     */
    getCookiePolicyLink(): Locator {
        return this.getRegisterFormContainer().getByRole('link', { name: translation.registerPage.cookiePolicy });
    }

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify we're on the register page by checking for key elements
     */
    async verifyRegisterPageLoaded(): Promise<void> {
        // Use regex to allow for query parameters
        await expect(this.page).toHaveURL(new RegExp(`^[^?]*${this.url.replace('/', '\\/')}(\\?.*)?$`));
        await expect(this.getRegisterFormContainer()).toBeVisible();
        await expect(this.getNameInput()).toBeVisible();
        await expect(this.getEmailInput()).toBeVisible();
        await expect(this.getPasswordInput()).toBeVisible();
        await expect(this.getConfirmPasswordInput()).toBeVisible();
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
     * Navigate to the register page
     * Uses Playwright's configured baseURL automatically
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url);
        await this.verifyRegisterPageLoaded();
    }

    /**
     * Fill the name field using proper Preact handling
     */
    async fillName(name: string): Promise<void> {
        await this.fillPreactInput(this.getNameInput(), name);
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
     * Fill the confirm password field using proper Preact handling
     */
    async fillConfirmPassword(password: string): Promise<void> {
        await this.fillPreactInput(this.getConfirmPasswordInput(), password);
    }

    /**
     * Fill all registration form fields
     */
    async fillRegistrationForm(name: string, email: string, password: string, confirmPassword: string = password): Promise<void> {
        await this.fillName(name);
        await this.fillEmail(email);
        await this.fillPassword(password);
        await this.fillConfirmPassword(confirmPassword);
    }

    /**
     * Toggle the Terms of Service checkbox
     */
    async toggleTermsCheckbox(): Promise<void> {
        await this.getTermsCheckbox().click();
    }

    /**
     * Toggle the Cookie Policy checkbox
     */
    async toggleCookiesCheckbox(): Promise<void> {
        await this.getCookiesCheckbox().click();
    }

    /**
     * Accept both policy checkboxes
     */
    async acceptAllPolicies(): Promise<void> {
        await this.toggleTermsCheckbox();
        await this.toggleCookiesCheckbox();
    }

    /**
     * Submit the registration form
     */
    async submitForm(): Promise<void> {
        const submitButton = this.getSubmitButton();
        await this.clickButton(submitButton, { buttonName: translation.registerPage.submitButton });
    }

    /**
     * Complete registration process with all fields
     * Non-fluent version - does not verify navigation or return page object
     */
    async register(name: string, email: string, password: string, confirmPassword: string = password): Promise<void> {
        await this.fillRegistrationForm(name, email, password, confirmPassword);
        await this.acceptAllPolicies();
        await this.submitForm();
    }

    /**
     * Complete registration process and navigate to dashboard
     * Fluent version - verifies successful registration and returns DashboardPage
     * Use this when you expect registration to succeed
     */
    async registerAndNavigateToDashboard(name: string, email: string, password: string, confirmPassword: string = password): Promise<DashboardPage> {
        await this.fillRegistrationForm(name, email, password, confirmPassword);
        await this.acceptAllPolicies();

        await expect(this.getSubmitButton()).toBeEnabled({ timeout: TEST_TIMEOUTS.BUTTON_STATE });

        await this.submitForm();

        try {
            await expect(this.page).toHaveURL(TEST_ROUTES.DASHBOARD, { timeout: TEST_TIMEOUTS.NAVIGATION });
        } catch (error) {
            const currentUrl = this.page.url();
            const errorVisible = await this.getErrorContainer().isVisible();
            const errorText = errorVisible ? await this.getErrorMessage() : 'No error message';
            throw new Error(`Failed to navigate to dashboard after registration. Current URL: ${currentUrl}. ` + `Error displayed: ${errorVisible}. Error message: "${errorText}"`);
        }

        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.verifyDashboardPageLoaded();
        return dashboardPage;
    }

    /**
     * Attempt registration with credentials that will fail
     * Fluent version - verifies we stay on register page and error appears
     * Use this when you expect registration to fail (duplicate email, weak password, etc.)
     */
    async registerExpectingFailure(name: string, email: string, password: string, confirmPassword: string = password): Promise<void> {
        await this.fillRegistrationForm(name, email, password, confirmPassword);
        await this.acceptAllPolicies();
        await this.submitForm();

        try {
            await expect(this.page).toHaveURL(TEST_ROUTES.REGISTER, { timeout: TEST_TIMEOUTS.NAVIGATION });
            await expect(this.getErrorContainer()).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        } catch (error) {
            const currentUrl = this.page.url();
            const errorVisible = await this.getErrorContainer().isVisible();
            throw new Error(`Registration failure behavior not as expected. Current URL: ${currentUrl}, ` + `Error visible: ${errorVisible}. Expected to stay on register page with error message.`);
        }
    }

    /**
     * Click the sign in button
     * Non-fluent version - clicks without verification, for flexibility
     */
    async clickSignIn(): Promise<void> {
        const button = this.getSignInButton();
        await this.clickButton(button, { buttonName: translation.registerPage.signIn });
    }

    /**
     * Click the sign in button and navigate to login page
     * Fluent version - verifies navigation and would return LoginPage (when imported)
     */
    async clickSignInAndNavigateToLogin(): Promise<void> {
        await this.clickSignIn();
        await expect(this.page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.NAVIGATION });

        // TODO: Return LoginPage when circular dependency is resolved
        // For now we avoid importing LoginPage to prevent circular dependency
        // import { LoginPage } from './LoginPage';
        // const loginPage = new LoginPage(this.page);
        // await loginPage.verifyLoginPageLoaded();
        // return loginPage;
    }

    // ============================================================================
    // FORM STATE VERIFICATION
    // ============================================================================

    /**
     * Verify all form elements are enabled (not in loading state)
     */
    async verifyFormEnabled(): Promise<void> {
        await expect(this.getNameInput()).toBeEnabled();
        await expect(this.getEmailInput()).toBeEnabled();
        await expect(this.getPasswordInput()).toBeEnabled();
        await expect(this.getConfirmPasswordInput()).toBeEnabled();
        await expect(this.getTermsCheckbox()).toBeEnabled();
        await expect(this.getCookiesCheckbox()).toBeEnabled();
        await expect(this.getSubmitButton()).toBeEnabled();
    }

    /**
     * Verify all form elements are disabled (in loading state)
     */
    async verifyFormDisabled(): Promise<void> {
        await expect(this.getNameInput()).toBeDisabled();
        await expect(this.getEmailInput()).toBeDisabled();
        await expect(this.getPasswordInput()).toBeDisabled();
        await expect(this.getConfirmPasswordInput()).toBeDisabled();
        await expect(this.getTermsCheckbox()).toBeDisabled();
        await expect(this.getCookiesCheckbox()).toBeDisabled();
        await expect(this.getSubmitButton()).toBeDisabled();
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
     * Verify that checkboxes are in the expected state
     */
    async verifyCheckboxStates(termsChecked: boolean, cookiesChecked: boolean): Promise<void> {
        if (termsChecked) {
            await expect(this.getTermsCheckbox()).toBeChecked();
        } else {
            await expect(this.getTermsCheckbox()).not.toBeChecked();
        }

        if (cookiesChecked) {
            await expect(this.getCookiesCheckbox()).toBeChecked();
        } else {
            await expect(this.getCookiesCheckbox()).not.toBeChecked();
        }
    }

    /**
     * Verify form is empty (all fields cleared)
     */
    async verifyFormEmpty(): Promise<void> {
        await expect(this.getNameInput()).toHaveValue('');
        await expect(this.getEmailInput()).toHaveValue('');
        await expect(this.getPasswordInput()).toHaveValue('');
        await expect(this.getConfirmPasswordInput()).toHaveValue('');
        await this.verifyCheckboxStates(false, false);
    }
}

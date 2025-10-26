import { expect, Locator, Page } from '@playwright/test';
import { DisplayName } from '@splitifyd/shared';
import type { Email } from '@splitifyd/shared';
import { TEST_ROUTES, TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { DashboardPage } from './DashboardPage';

const translation = translationEn;

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
     * Fill the confirm password field using proper Preact handling
     */
    async fillConfirmPassword(password: string): Promise<void> {
        await this.fillPreactInput(this.getConfirmPasswordInput(), password);
    }

    /**
     * Fill all registration form fields
     */
    async fillRegistrationForm(name: string, email: Email, password: string, confirmPassword: string = password): Promise<void> {
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
     * Check the Terms of Service checkbox (ensure it's checked)
     */
    async checkTermsCheckbox(): Promise<void> {
        const checkbox = this.getTermsCheckbox();
        await expect(checkbox).toBeVisible();
        await checkbox.check();
    }

    /**
     * Uncheck the Terms of Service checkbox (ensure it's unchecked)
     */
    async uncheckTermsCheckbox(): Promise<void> {
        const checkbox = this.getTermsCheckbox();
        await expect(checkbox).toBeVisible();
        await checkbox.uncheck();
    }

    /**
     * Toggle the Cookie Policy checkbox
     */
    async toggleCookiesCheckbox(): Promise<void> {
        await this.getCookiesCheckbox().click();
    }

    /**
     * Check the Cookie Policy checkbox (ensure it's checked)
     */
    async checkCookieCheckbox(): Promise<void> {
        const checkbox = this.getCookiesCheckbox();
        await expect(checkbox).toBeVisible();
        await checkbox.check();
    }

    /**
     * Uncheck the Cookie Policy checkbox (ensure it's unchecked)
     */
    async uncheckCookieCheckbox(): Promise<void> {
        const checkbox = this.getCookiesCheckbox();
        await expect(checkbox).toBeVisible();
        await checkbox.uncheck();
    }

    /**
     * Accept both policy checkboxes
     */
    async acceptAllPolicies(): Promise<void> {
        await this.checkTermsCheckbox();
        await this.checkCookieCheckbox();
    }

    /**
     * Click the Terms of Service link
     */
    async clickTermsLink(): Promise<void> {
        const link = this.getTermsLink();
        await link.click();
    }

    /**
     * Click the Cookie Policy link
     */
    async clickCookiePolicyLink(): Promise<void> {
        const link = this.getCookiePolicyLink();
        await link.click();
    }

    /**
     * Submit the registration form
     */
    async submitForm(): Promise<void> {
        const submitButton = this.getSubmitButton();
        await this.clickButton(submitButton, { buttonName: translation.registerPage.submitButton });
    }

    /**
     * Attempt to click submit button even when disabled (used for defensive tests).
     */
    async attemptSubmitWhileDisabled(): Promise<void> {
        const submitButton = this.getSubmitButton();
        await submitButton.click({ force: true }).catch(() => undefined);
    }

    /**
     * Complete registration process with all fields
     * Non-fluent version - does not verify navigation or return page object
     */
    async register(name: string, email: Email, password: string, confirmPassword: string = password): Promise<void> {
        await this.fillRegistrationForm(name, email, password, confirmPassword);
        await this.acceptAllPolicies();
        await this.submitForm();
    }

    /**
     * Complete registration process and navigate to dashboard
     * Fluent version - verifies successful registration and returns DashboardPage
     * Use this when you expect registration to succeed
     */
    async registerAndNavigateToDashboard(name: string, email: Email, password: string, confirmPassword: string = password): Promise<DashboardPage> {
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
    async registerExpectingFailure(name: string, email: Email, password: string, confirmPassword: string = password): Promise<void> {
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
     * Verify all form inputs are enabled (not in loading/disabled state)
     * Note: Does not check submit button as its state depends on form validation
     */
    async verifyFormEnabled(): Promise<void> {
        await expect(this.getNameInput()).toBeEnabled();
        await expect(this.getEmailInput()).toBeEnabled();
        await expect(this.getPasswordInput()).toBeEnabled();
        await expect(this.getConfirmPasswordInput()).toBeEnabled();
        await expect(this.getTermsCheckbox()).toBeEnabled();
        await expect(this.getCookiesCheckbox()).toBeEnabled();
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

    /**
     * Verify form has persisted values (after error, form should retain user input)
     */
    async verifyFormPersistedValues(name: string, email: Email): Promise<void> {
        await expect(this.getNameInput()).toHaveValue(name);
        await expect(this.getEmailInput()).toHaveValue(email);
    }

    /**
     * Verify checkboxes are visible
     */
    async verifyTermsCheckboxVisible(): Promise<void> {
        await expect(this.getTermsCheckbox()).toBeVisible();
    }

    async verifyCookiesCheckboxVisible(): Promise<void> {
        await expect(this.getCookiesCheckbox()).toBeVisible();
    }

    /**
     * Verify policy links are visible
     */
    async verifyTermsLinkVisible(): Promise<void> {
        await expect(this.getTermsLink()).toBeVisible();
    }

    async verifyCookiePolicyLinkVisible(): Promise<void> {
        await expect(this.getCookiePolicyLink()).toBeVisible();
    }

    async verifyTermsLinkAttributes(expectedHref: string, expectedTarget: string = '_blank'): Promise<void> {
        const link = this.getTermsLink();
        await expect(link).toHaveAttribute('href', expectedHref);
        await expect(link).toHaveAttribute('target', expectedTarget);
    }

    async verifyCookiePolicyLinkAttributes(expectedHref: string, expectedTarget: string = '_blank'): Promise<void> {
        const link = this.getCookiePolicyLink();
        await expect(link).toHaveAttribute('href', expectedHref);
        await expect(link).toHaveAttribute('target', expectedTarget);
    }

    /**
     * Verify the register page heading contains expected text
     */
    async verifyPageHeadingContains(expectedText: string): Promise<void> {
        await expect(this.getPageHeading()).toContainText(expectedText);
    }

    /**
     * Verify submit button is enabled
     */
    async verifySubmitButtonEnabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeEnabled();
    }

    /**
     * Verify submit button is disabled
     */
    async verifySubmitButtonDisabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeDisabled();
    }

    /**
     * Verify error container is visible
     */
    async verifyErrorContainerVisible(): Promise<void> {
        await expect(this.getErrorContainer()).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
    }

    /**
     * Check if loading spinner is visible (for registration process)
     */
    async isLoadingSpinnerVisible(): Promise<boolean> {
        const spinner = this.page.locator('button[type="submit"] svg.animate-spin');
        return await spinner.isVisible().catch(() => false);
    }

    /**
     * Wait for form to be ready (all inputs visible and enabled)
     */
    async waitForFormReady(): Promise<void> {
        const currentUrl = this.page.url();
        if (!/\/register/.test(currentUrl)) {
            throw new Error(`Register form URL validation failed - expected /register, got ${currentUrl}`);
        }

        await this.waitForDomContentLoaded();

        await expect(this.getSubmitButton()).toBeVisible({ timeout: 5000 });
        await expect(this.getNameInput()).toBeVisible({ timeout: 5000 });
        await expect(this.getEmailInput()).toBeVisible({ timeout: 5000 });
    }

    /**
     * Wait for registration response with specific status code
     */
    async waitForRegistrationResponse(expectedStatusCode?: number): Promise<void> {
        await this.page.waitForResponse(
            (response) => {
                const url = response.url();
                if (!url.includes('/register')) {
                    return false;
                }

                if (expectedStatusCode !== undefined) {
                    return response.status() === expectedStatusCode;
                }

                return response.status() >= 400;
            },
            { timeout: TEST_TIMEOUTS.API_RESPONSE },
        );
    }

    /**
     * Expect current URL to match pattern
     */
    async expectUrl(pattern: RegExp): Promise<void> {
        await expect(this.page).toHaveURL(pattern);
    }

    /**
     * Verify name input has expected value
     */
    async verifyNameInputValue(expectedValue: string): Promise<void> {
        await expect(this.getNameInput()).toHaveValue(expectedValue);
    }

    /**
     * Verify email input has expected value
     */
    async verifyEmailInputValue(expectedValue: string): Promise<void> {
        await expect(this.getEmailInput()).toHaveValue(expectedValue);
    }

    /**
     * Verify password input is visible
     */
    async verifyPasswordInputVisible(): Promise<void> {
        await expect(this.getPasswordInput()).toBeVisible();
    }

    /**
     * Verify password input has expected value
     */
    async verifyPasswordInputValue(expectedValue: string): Promise<void> {
        await expect(this.getPasswordInput()).toHaveValue(expectedValue);
    }

    /**
     * Verify confirm password input has expected value
     */
    async verifyConfirmPasswordInputValue(expectedValue: string): Promise<void> {
        await expect(this.getConfirmPasswordInput()).toHaveValue(expectedValue);
    }

    /**
     * Verify error message matches pattern
     * Uses Playwright's polling to handle async error display
     */
    async verifyErrorMessageMatches(pattern: RegExp): Promise<void> {
        await expect(async () => {
            const errorElement = this.getErrorContainer();
            await expect(errorElement).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
            const errorText = await errorElement.textContent();
            expect(errorText?.toLowerCase()).toMatch(pattern);
        })
            .toPass({ timeout: 5000 });
    }

    /**
     * Verify user display name is visible on page after navigation
     */
    async verifyUserDisplayNameVisible(displayName: DisplayName): Promise<void> {
        await expect(this.page.getByText(displayName).first()).toBeVisible();
    }
}

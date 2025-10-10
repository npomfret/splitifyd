import { expect, Locator, Page } from '@playwright/test';
import { RegisterPage as BaseRegisterPage } from '@splitifyd/test-support';
import { DashboardPage } from './dashboard.page';

/**
 * E2E-specific RegisterPage that extends the shared base class
 * Adds methods for handling registration timing variations and backward compatibility
 */
export class RegisterPage extends BaseRegisterPage {
    constructor(page: Page) {
        super(page);
    }

    /**
     * E2E version: Enhanced navigate with better error messaging
     * Overrides base class method to add fail-fast authentication state check
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url);

        // Fail fast if we're not on the register page
        // This ensures tests start from a known state
        try {
            await this.expectUrl(/\/register/);
        } catch (error) {
            throw new Error(
                'Expected to navigate to register page but was redirected. Test requires clean authentication state.',
            );
        }

        await this.verifyRegisterPageLoaded();
    }

    /**
     * E2E-specific: Complete registration workflow and return e2e DashboardPage
     * Alternative to base class method that returns e2e-specific page object
     */
    async registerAndGoToDashboard(
        name: string,
        email: string,
        password: string,
        confirmPassword: string = password,
    ): Promise<DashboardPage> {
        await this.fillRegistrationForm(name, email, password, confirmPassword);
        await this.acceptAllPolicies();
        await this.submitForm();
        await this.waitForRegistrationCompletion();
        return new DashboardPage(this.page);
    }

    /**
     * E2E-specific: Wait for registration completion with timing variation handling
     * Handles both instant registration and slower processing with loading spinner
     */
    async waitForRegistrationCompletion(): Promise<void> {
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
     * E2E-specific: Check if the loading spinner is visible
     * Used by tests to verify UI loading state
     */
    async isLoadingSpinnerVisible(): Promise<boolean> {
        const spinner = this.page.locator('button[type="submit"] svg.animate-spin');
        return await spinner.isVisible();
    }

    /**
     * E2E-specific: Wait for and handle API response errors during registration
     * Used by network error testing
     */
    async waitForRegistrationResponse(expectedStatus?: number): Promise<void> {
        const responsePromise = this.page.waitForResponse(
            (response) =>
                response.url().includes('/api/register') &&
                (expectedStatus ? response.status() === expectedStatus : response.status() >= 400),
        );
        return responsePromise.then(() => {});
    }

    /**
     * E2E-specific: Wait for form to be ready with enhanced URL validation
     * Provides detailed error messages for debugging test setup issues
     */
    async waitForFormReady(): Promise<void> {
        const currentUrl = this.page.url();
        const expectedUrlPattern = /\/register/;

        // Enhanced URL check with better error reporting
        if (!currentUrl.match(expectedUrlPattern)) {
            throw new Error(`Register form URL validation failed - expected /register, got ${currentUrl}`);
        }

        await this.waitForDomContentLoaded();

        await expect(this.getSubmitButton()).toBeVisible({ timeout: 5000 });
        await expect(this.getNameInput()).toBeVisible({ timeout: 5000 });
        await expect(this.getEmailInput()).toBeVisible({ timeout: 5000 });
    }

    // ============================================================================
    // E2E-SPECIFIC CHECKBOX METHODS - Deterministic state management
    // ============================================================================

    /**
     * E2E-specific: Check terms checkbox (deterministic)
     * Uses .check() instead of base class .click() to ensure checkbox is always checked
     */
    async checkTermsCheckbox(): Promise<void> {
        await this.getTermsCheckbox().check();
    }

    /**
     * E2E-specific: Uncheck terms checkbox (deterministic)
     * Base class only has toggle, this ensures checkbox is always unchecked
     */
    async uncheckTermsCheckbox(): Promise<void> {
        await this.getTermsCheckbox().uncheck();
    }

    /**
     * E2E-specific: Check cookie checkbox (deterministic)
     * Uses .check() instead of base class .click() to ensure checkbox is always checked
     */
    async checkCookieCheckbox(): Promise<void> {
        await this.getCookiesCheckbox().check();
    }

    /**
     * E2E-specific: Accept all policies (deterministic)
     * Overrides base class to use deterministic check() instead of toggle()
     */
    async acceptAllPolicies(): Promise<void> {
        await this.checkTermsCheckbox();
        await this.checkCookieCheckbox();
    }
}

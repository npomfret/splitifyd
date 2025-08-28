import { Page, Locator, expect } from '@playwright/test';
import { EMULATOR_URL } from '../helpers';
import type { User as BaseUser } from '@splitifyd/shared';
import { createErrorHandlingProxy } from '../utils/error-proxy';

export abstract class BasePage {
    protected userInfo?: BaseUser;

    constructor(
        protected _page: Page,
        userInfo?: BaseUser,
    ) {
        this.userInfo = userInfo;

        // Apply automatic error handling proxy to all derived classes
        // This wraps all async methods to automatically capture context on errors
        const className = this.constructor.name;
        return createErrorHandlingProxy(this, className, _page, userInfo, {
            // Configuration options
            captureScreenshot: false, // Can be enabled for debugging
            collectState: true, // Always collect page state on errors
            excludeMethods: [
                // Specific non-async methods
                'page', // Getter for page property
                // Private methods that shouldn't be proxied
                'waitForFocus',
                'getFieldIdentifier',
                'validateInputValue',
                'waitForMembersInExpenseForm',
                // Note: get*, is*, has*, constructor, toString, etc. are handled by DEFAULT_EXCLUDED_METHODS
            ],
        }) as this;
    }

    /**
     * Public getter for the page property
     */
    get page(): Page {
        return this._page;
    }

    // Common element accessors
    getHeading(name: string | RegExp) {
        return this._page.getByRole('heading', { name });
    }

    getHeadingByLevel(level: number) {
        return this._page.getByRole('heading', { level });
    }

    getLink(name: string | RegExp) {
        return this._page.getByRole('link', { name });
    }

    getButton(name: string | RegExp) {
        return this._page.getByRole('button', { name });
    }

    getDialog() {
        return this._page.getByRole('dialog');
    }

    getTextbox() {
        return this._page.getByRole('textbox');
    }

    /**
     * Waits for and validates that an element has focus.
     * Useful for ensuring proper focus state before input operations.
     */
    private async waitForFocus(input: Locator, timeout = 2000): Promise<void> {
        await expect(input).toBeFocused({ timeout });
    }

    /**
     * Helper method to get field identifier for error reporting.
     */
    private async getFieldIdentifier(input: Locator): Promise<string> {
        const fieldName = (await input.getAttribute('name')) || null;
        const fieldId = (await input.getAttribute('id')) || null;
        const placeholder = (await input.getAttribute('placeholder')) || null;

        return fieldName || fieldId || placeholder || 'unknown field';
    }

    /**
     * Validates that an input field contains the expected value.
     * Pure validation method - does not modify DOM state.
     * Allows trimmed values to match (UI may trim whitespace).
     */
    private async validateInputValue(input: Locator, expectedValue: string): Promise<void> {
        const actualValue = await input.inputValue();
        const inputType = await input.getAttribute('type');

        // For number inputs, compare numeric values to handle normalization (e.g., "75.50" -> "75.5")
        if (inputType === 'number') {
            const expectedNum = parseFloat(expectedValue);
            const actualNum = parseFloat(actualValue);

            // Check if both parse as valid numbers and are equal
            if (!isNaN(expectedNum) && !isNaN(actualNum) && expectedNum === actualNum) {
                return; // Values are numerically equal
            }
        }

        // For non-number inputs or if number comparison failed, do string comparison
        // Allow trimmed values to match (UI may trim whitespace from inputs)
        if (actualValue !== expectedValue && actualValue !== expectedValue.trim()) {
            const fieldIdentifier = await this.getFieldIdentifier(input);
            throw new Error(`Input validation failed for field "${fieldIdentifier}": expected "${expectedValue}" but got "${actualValue}"`);
        }
    }

    /**
     * Fill an input field in a way that properly triggers Preact signal updates.
     * This is necessary because Playwright's fill() method doesn't always trigger
     * the onChange events that Preact signals rely on.
     * Uses focus-based waiting with pressSequentially for reliable input.
     * Includes retry logic to handle text truncation which has been observed to happen under high load (typically during parallel test execution).
     */
    async fillPreactInput(selector: string | Locator, value: string, maxRetries = 3) {
        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;

        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Single click and wait for focus
                await input.click();
                await this.waitForFocus(input);

                // Clear and validate
                await input.fill('');
                await this.validateInputValue(input, '');

                // Ensure still focused before typing
                await this.waitForFocus(input);
                await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });

                // Check if this is a number input or has decimal inputMode
                const inputType = await input.getAttribute('type');
                const inputMode = await input.getAttribute('inputMode');

                // Use fill() for number inputs or decimal inputs to handle decimals correctly
                if (inputType === 'number' || inputMode === 'decimal') {
                    await input.fill(value);
                } else {
                    await input.pressSequentially(value);
                }

                // Manually trigger input event to ensure Preact onChange handlers are called
                // This is crucial for Preact components that rely on onChange events to update their state
                await input.dispatchEvent('input');

                // Blur to trigger Preact validation
                await input.blur();

                // Check if input was successful
                const actualValue = await input.inputValue();
                if (actualValue === value) {
                    await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
                    return; // Success!
                }

                // For number/decimal inputs, check if values are numerically equal (handles decimal normalization)
                // This is kept for backward compatibility with any remaining number inputs
                if (inputType === 'number' || inputMode === 'decimal') {
                    const expectedNum = parseFloat(value);
                    const actualNum = parseFloat(actualValue);
                    if (!isNaN(expectedNum) && !isNaN(actualNum) && expectedNum === actualNum) {
                        // Values are numerically equal (e.g., "45.50" and "45.5")
                        // With text inputs, this should no longer happen, but keep for safety
                        await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
                        return; // Success - number normalization is expected!
                    }
                }

                // Log and retry if not final attempt
                if (attempt < maxRetries) {
                    const fieldId = await this.getFieldIdentifier(input);
                    // Only warn if it's not expected number normalization
                    if (inputType !== 'number' || parseFloat(value) !== parseFloat(actualValue)) {
                        console.warn(`Input retry ${attempt}: expected "${value}", got "${actualValue}" for ${fieldId}`);
                    }
                    // Use DOM state waiting instead of arbitrary timeout
                    await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
                }
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                console.warn(`Attempt ${attempt} threw error, retrying:`, error instanceof Error ? error.message : String(error));
                // Use DOM state waiting instead of arbitrary timeout
                await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
            }
        }

        // Final validation after all retries (throws error if still incorrect)
        await this.validateInputValue(input, value);
        await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
    }

    async waitForDomContentLoaded(timeout = 5000) {
        await this._page.waitForLoadState('domcontentloaded', { timeout });
    }

    /**
     * Expects a button to be enabled before clicking.
     * Provides detailed error messages if the button is disabled.
     */
    async expectButtonEnabled(button: Locator, buttonText?: string): Promise<void> {
        const isDisabled = await button.isDisabled();

        if (isDisabled) {
            // Gather validation error messages for better debugging
            const errorMessages = await this._page.locator('.error-message, .text-red-500, [role="alert"]').allTextContents();
            const buttonTitle = await button.getAttribute('title');
            const buttonName = buttonText || (await button.textContent()) || 'Submit';

            let errorDetail = `Button "${buttonName}" is disabled.`;
            if (errorMessages.length > 0) {
                errorDetail += ` Validation errors found: ${errorMessages.join(', ')}`;
            }
            if (buttonTitle) {
                errorDetail += ` Button hint: ${buttonTitle}`;
            }

            throw new Error(errorDetail);
        }
    }

    /**
     * Standard button click method that ensures button is visible and enabled before clicking.
     * Provides clear error messages if the button cannot be clicked.
     * This should be the default way to click any button in tests.
     *
     * @param button - The button locator
     * @param options - Optional configuration
     * @returns Promise that resolves when button is clicked
     */
    async clickButton(
        button: Locator,
        options?: {
            buttonName?: string; // Human-readable name for error messages
            skipEnabledCheck?: boolean; // Skip the enabled check (for special cases)
            timeout?: number; // Custom timeout for visibility check
        },
    ): Promise<void> {
        const { buttonName, skipEnabledCheck = false, timeout = 2000 } = options || {};

        // Get button text for error messages if not provided
        const buttonText = buttonName || (await button.textContent()) || 'button';

        await button.waitFor({ state: 'attached', timeout });

        const exists = (await button.count()) > 0;
        if (!exists) {
            throw new Error(`Button "${buttonText}" not found in the DOM. Check your selector.`);
        }

        // Check visibility with clear error message
        try {
            await expect(button).toBeVisible({ timeout });
        } catch (error) {
            // Button exists but not visible
            const isHidden = await button.isHidden();
            if (isHidden) {
                throw new Error(`Button "${buttonText}" exists but is hidden. It may be behind a modal or collapsed section.`);
            }

            throw new Error(`Button "${buttonText}" is not visible after ${timeout}ms timeout.`);
        }

        // Check if enabled (unless explicitly skipped)
        if (!skipEnabledCheck) {
            try {
                // Use the same timeout for enabled check as we used for visibility
                await expect(button).toBeEnabled({ timeout });
            } catch (error) {
                // Use our detailed error reporting for disabled buttons
                await this.expectButtonEnabled(button, buttonText);
            }
        }

        // Click the button
        await button.click();
    }

    /**
     * Helper specifically for submit buttons with detailed validation error reporting.
     * Use this before clicking submit buttons in forms.
     */
    async expectSubmitButtonEnabled(submitButton?: Locator): Promise<void> {
        const button = submitButton || this._page.getByRole('button', { name: /submit|create|save|sign in|register/i });
        await this.expectButtonEnabled(button, 'Submit');
    }

    /**
     * Click a dropdown button and ensure it opens properly.
     * Uses ARIA attributes to verify dropdown state instead of arbitrary timeouts.
     * @param dropdownButton - The dropdown trigger button
     * @param options - Configuration options
     */
    async clickDropdownButton(
        dropdownButton: Locator,
        options?: {
            buttonName?: string; // Human-readable name for error messages
            dropdownContent?: Locator; // Optional locator for dropdown content to verify it's visible
            maxRetries?: number; // Max retries if dropdown doesn't open (default: 2)
        },
    ): Promise<void> {
        const { buttonName = 'dropdown', dropdownContent, maxRetries = 2 } = options || {};

        // Ensure button is visible and enabled
        await expect(dropdownButton).toBeVisible();
        await expect(dropdownButton).toBeEnabled();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // Click the dropdown button
            await dropdownButton.click();

            // Check if dropdown opened using aria-expanded attribute
            const ariaExpanded = await dropdownButton.getAttribute('aria-expanded');

            if (ariaExpanded === 'true') {
                // If dropdown content locator provided, verify it's visible
                if (dropdownContent) {
                    try {
                        await expect(dropdownContent).toBeVisible({ timeout: 1000 });
                    } catch (error) {
                        if (attempt === maxRetries) {
                            throw new Error(`Dropdown "${buttonName}" button shows aria-expanded="true" but content is not visible`);
                        }
                        continue; // Retry
                    }
                }
                return; // Success!
            }

            // If aria-expanded not available or false, check for dropdown content visibility
            if (!ariaExpanded && dropdownContent) {
                try {
                    await expect(dropdownContent).toBeVisible({ timeout: 1000 });
                    return; // Success!
                } catch (error) {
                    if (attempt === maxRetries) {
                        throw new Error(`Dropdown "${buttonName}" did not open after ${maxRetries} attempts`);
                    }
                    // Wait for DOM to settle before retry
                    await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
                }
            } else if (attempt === maxRetries) {
                throw new Error(`Dropdown "${buttonName}" did not open after ${maxRetries} attempts. aria-expanded="${ariaExpanded}"`);
            }
        }
    }

    /**
     * User Menu Methods - Available on all pages with authenticated users
     */
    getUserMenuButton() {
        return this._page.locator('[data-testid="user-menu-button"]');
    }

    getUserDropdownMenu() {
        return this._page.locator('[data-testid="user-dropdown-menu"]');
    }

    getSignOutButton() {
        return this._page.locator('[data-testid="sign-out-button"]');
    }

    getDashboardLink() {
        return this._page.locator('[data-testid="user-menu-dashboard-link"]');
    }

    getSettingsLink() {
        return this._page.locator('[data-testid="user-menu-settings-link"]');
    }

    /**
     * Wait for the user menu to be available on the page.
     * This indicates the user is authenticated and the page has loaded.
     */
    async waitForUserMenu(): Promise<void> {
        await this.waitForDomContentLoaded();
        await expect(this.getUserMenuButton()).toBeVisible({ timeout: 5000 });
    }

    /**
     * Open the user menu dropdown using reliable ARIA-based state detection.
     */
    async openUserMenu(): Promise<void> {
        const userMenuButton = this.getUserMenuButton();
        const dropdownMenu = this.getUserDropdownMenu();

        await this.clickDropdownButton(userMenuButton, {
            buttonName: 'User Menu',
            dropdownContent: dropdownMenu,
            maxRetries: 3,
        });
    }

    /**
     * Close the user menu dropdown if it's open.
     */
    async closeUserMenu(): Promise<void> {
        const userMenuButton = this.getUserMenuButton();
        const ariaExpanded = await userMenuButton.getAttribute('aria-expanded');

        if (ariaExpanded === 'true') {
            // Click outside to close the menu
            await this._page.locator('body').click({ position: { x: 0, y: 0 } });

            // Wait for menu to close
            await expect(this.getUserDropdownMenu()).not.toBeVisible({ timeout: 1000 });
        }
    }

    /**
     * Navigate to dashboard using the user menu.
     */
    async navigateToDashboardViaMenu(): Promise<void> {
        await this.openUserMenu();
        await this.getDashboardLink().click();
        await expect(this._page).toHaveURL(/\/dashboard/);
    }

    /**
     * Navigate to settings using the user menu.
     */
    async navigateToSettingsViaMenu(): Promise<void> {
        await this.openUserMenu();
        await this.getSettingsLink().click();
        await expect(this._page).toHaveURL(/\/settings/);
    }

    /**
     * Logout the user using the user menu dropdown.
     * This is a common action available on most authenticated pages.
     */
    async logout(): Promise<void> {
        await this.openUserMenu();

        const signOutButton = this.getSignOutButton();

        // Click the sign-out button - clickButton handles visibility and enabled state
        // Note: dropdown items may be briefly disabled during animation, so we use a longer timeout
        await this.clickButton(signOutButton, {
            buttonName: 'Sign Out',
            timeout: 3000, // Longer timeout for dropdown items that may animate in
        });

        // Wait for redirect to login page
        await expect(this._page).toHaveURL(/\/login/, { timeout: 5000 });
    }

    /**
     * Get the displayed user name from the user menu button.
     */
    async getUserDisplayName(): Promise<string> {
        const userMenuButton = this.getUserMenuButton();
        await expect(userMenuButton).toBeVisible();

        // The user name is displayed in the menu button
        const nameElement = userMenuButton.locator('.text-sm.font-medium.text-gray-700').first();
        const textContent = await nameElement.textContent();
        return textContent ?? '';
    }

    /**
     * Check if a user is logged in by checking for the user menu.
     */
    async isUserLoggedIn(): Promise<boolean> {
        try {
            const menuVisible = await this.getUserMenuButton().isVisible({ timeout: 2000 });
            return menuVisible;
        } catch {
            return false;
        }
    }

    /**
     * Expects the page to match a URL pattern
     */
    async expectUrl(pattern: string | RegExp): Promise<void> {
        await expect(this._page).toHaveURL(pattern);
    }

    /**
     * Extracts a parameter from the current URL
     */
    getUrlParam(paramName: string): string | null {
        const url = new URL(this._page.url());
        const pathParts = url.pathname.split('/');
        const paramIndex = pathParts.indexOf(paramName);

        if (paramIndex !== -1 && paramIndex < pathParts.length - 1) {
            return pathParts[paramIndex + 1];
        }

        // For group IDs, extract from /groups/{id} pattern
        if (paramName === 'groupId') {
            const match = url.pathname.match(/\/groups\/([a-zA-Z0-9]+)/);
            return match ? match[1] : null;
        }

        return null;
    }

    /**
     * Navigation helper methods to replace direct page.goto() calls
     */
    async navigateToHomepage(): Promise<void> {
        await this._page.goto(EMULATOR_URL);
        await this.waitForDomContentLoaded();
    }

    async navigateToRoot(): Promise<void> {
        await this._page.goto(EMULATOR_URL);
        await this.waitForDomContentLoaded();
    }

    async navigateToLogin(): Promise<void> {
        await this._page.goto(`${EMULATOR_URL}/login`);
        await this.waitForDomContentLoaded();
    }

    async navigateToRegister(): Promise<void> {
        await this._page.goto(`${EMULATOR_URL}/register`);
        await this.waitForDomContentLoaded();
    }

    async navigateToPricing(): Promise<void> {
        await this._page.goto(`${EMULATOR_URL}/pricing`);
        await this.waitForDomContentLoaded();
    }

    async navigateToDashboard(): Promise<void> {
        await this._page.goto(`${EMULATOR_URL}/dashboard`);
        await this.waitForDomContentLoaded();
    }

    async navigateToShareLink(shareLink: string): Promise<void> {
        await this._page.goto(shareLink);
        await this.waitForDomContentLoaded();
    }

    async navigateToStaticPath(path: string): Promise<void> {
        await this._page.goto(`${EMULATOR_URL}${path}`);
        await this.waitForDomContentLoaded();
    }
}

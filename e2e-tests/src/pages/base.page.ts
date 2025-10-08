import { expect, Locator, Page } from '@playwright/test';
import { PooledTestUser } from '@splitifyd/shared';
import { EMULATOR_URL } from '../helpers';
import { createErrorHandlingProxy } from '../utils/error-proxy';
import { HeaderPage } from './header.page';

export abstract class BasePage {
    private _header?: HeaderPage;

    constructor(
        protected _page: Page,
        protected userInfo?: PooledTestUser,
    ) {
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

    /**
     * Header page object for user menu and navigation functionality.
     * Lazy loaded to avoid circular dependencies.
     */
    get header(): HeaderPage {
        if (!this._header) {
            this._header = new HeaderPage(this._page);
        }
        return this._header;
    }

    getHeadingByLevel(level: number) {
        return this._page.getByRole('heading', { level });
    }

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

            // Handle special case: when clearing a number input, it may default to "0"
            // Accept "0" as equivalent to empty string for number inputs
            if (expectedValue === '' && actualValue === '0') {
                return; // Clearing to "0" is acceptable for number inputs
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

                // Use pressSequentially for text inputs to ensure proper Preact signal updates
                await input.pressSequentially(value);

                // Manually trigger input event to ensure Preact onChange handlers are called
                // This is crucial for Preact components that rely on onChange events to update their state
                await input.dispatchEvent('input');

                // Blur to trigger Preact validation
                await input.blur();

                // Check if input was successful (text inputs only)
                const actualValue = await input.inputValue();
                if (actualValue === value || actualValue === value.trim()) {
                    await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
                    return; // Success!
                }

                // Log and retry if not final attempt
                if (attempt < maxRetries) {
                    const fieldId = await this.getFieldIdentifier(input);
                    console.warn(`Input retry ${attempt}: expected "${value}", got "${actualValue}" for ${fieldId}`);
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

    /**
     * Fill a number input field using fill() method with numeric validation.
     * Handles the "0" default value issue for number inputs.
     */
    async fillNumberInput(selector: string | Locator, value: string, maxRetries = 3) {
        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;

        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await input.click();
                await this.waitForFocus(input);
                await input.fill('');

                // For number inputs, clearing may result in "0" instead of "", which is acceptable
                const clearedValue = await input.inputValue();
                if (clearedValue !== '' && clearedValue !== '0') {
                    const fieldId = await this.getFieldIdentifier(input);
                    throw new Error(`Failed to clear number input "${fieldId}": expected "" or "0" but got "${clearedValue}"`);
                }

                await this.waitForFocus(input);
                await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });

                await input.fill(value);
                await input.dispatchEvent('input');
                await input.blur();

                const actualValue = await input.inputValue();
                const expectedNum = parseFloat(value);
                const actualNum = parseFloat(actualValue);

                // For number inputs, compare numerically to handle normalization (e.g., "45.50" -> "45.5")
                if (!isNaN(expectedNum) && !isNaN(actualNum) && expectedNum === actualNum) {
                    await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
                    return;
                }

                if (attempt < maxRetries) {
                    const fieldId = await this.getFieldIdentifier(input);
                    console.warn(`Number input retry ${attempt}: expected "${value}", got "${actualValue}" for ${fieldId}`);
                    await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
                }
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                console.warn(`Attempt ${attempt} threw error, retrying:`, error instanceof Error ? error.message : String(error));
                await this._page.waitForTimeout(500);
            }
        }

        const fieldId = await this.getFieldIdentifier(input);
        const actualValue = await input.inputValue();
        throw new Error(`Failed to fill number input field "${fieldId}" after ${maxRetries} attempts. Expected: "${value}", Got: "${actualValue}"`);
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

        // Ensure button is attached to DOM before proceeding
        await button.waitFor({ state: 'attached', timeout });

        // Get button text for error messages if not provided
        const buttonText = buttonName || (await button.textContent()) || 'button';

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

    async navigateToRegister(): Promise<void> {
        await this._page.goto(`${EMULATOR_URL}/register`);
        await this.waitForDomContentLoaded();
    }

    async navigateToPricing(): Promise<void> {
        await this._page.goto(`${EMULATOR_URL}/pricing`);
        await this.waitForDomContentLoaded();
    }

    async navigateToStaticPath(path: string): Promise<void> {
        await this._page.goto(`${EMULATOR_URL}${path}`);
        await this.waitForDomContentLoaded();
    }
}

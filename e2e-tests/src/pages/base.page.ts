import { expect, Locator, Page } from '@playwright/test';
import { BasePage as SharedBasePage, HeaderPage, createErrorHandlingProxy } from '@splitifyd/test-support';
import { EMULATOR_URL } from '../helpers';

/**
 * E2E-specific base page that extends the shared BasePage
 * Adds e2e-specific functionality like header navigation and emulator URL helpers
 */
export abstract class BasePage extends SharedBasePage {
    private _header?: HeaderPage;

    constructor(protected _page: Page) {
        super(_page);
        // Apply automatic error handling proxy to all derived classes
        // This wraps all async methods to automatically capture context on errors
        const className = this.constructor.name;

        return createErrorHandlingProxy(this, className, _page, { // todo: we need to make this work with the new POMs
            // Configuration options
            captureScreenshot: false, // Can be enabled for debugging
            collectState: true, // Always collect page state on errors
            excludeMethods: [
                // Specific non-async methods
                'page', // Getter for page property
                // Private methods that shouldn't be proxied
                'waitForFocus',
                'validateInputValue',
                'waitForMembersInExpenseForm',
                // Note: get*, is*, has*, constructor, toString, etc. are handled by DEFAULT_EXCLUDED_METHODS
            ],
        }) as this;
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

    private async waitForFocus(input: Locator, timeout = 2000): Promise<void> {
        await expect(input).toBeFocused({ timeout });
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
            const fieldIdentifier = await this.getInputIdentifier(input);
            throw new Error(`Input validation failed for field "${fieldIdentifier}": expected "${expectedValue}" but got "${actualValue}"`);
        }
    }

    /**
     * E2E-specific fill input implementation with enhanced validation and event dispatch.
     *
     * This is necessary because Playwright's fill() method doesn't always trigger
     * the onChange events that Preact signals rely on.
     *
     * DIFFERENCES FROM SHARED BASE VERSION:
     * 1. Calls dispatchEvent('input') to ensure Preact onChange handlers are triggered
     * 2. Uses validateInputValue() for comprehensive validation (handles number inputs)
     * 3. Includes focus-based waiting to prevent race conditions under high load
     * 4. Has retry logic to handle text truncation during parallel test execution
     *
     * WHY WE NEED BOTH VERSIONS:
     * - Shared base: Simpler, sufficient for unit tests in controlled environments
     * - E2E version: More robust, handles parallel execution and complex validation
     *
     * Uses focus-based waiting with pressSequentially for reliable input.
     * Includes retry logic to handle text truncation which has been observed to happen
     * under high load (typically during parallel test execution).
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
                    const fieldId = await this.getInputIdentifier(input);
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
     * E2E-specific override of expectButtonEnabled with enhanced error gathering.
     *
     * DIFFERENCES FROM SHARED BASE VERSION:
     * 1. Gathers validation error messages from the page (searches for .error-message, .text-red-500, [role="alert"])
     * 2. Includes button title attribute in error message for additional context
     * 3. Provides comprehensive error details to help diagnose why button is disabled
     *
     * WHY THIS OVERRIDE EXISTS:
     * - E2E tests run against the full application with complex form validation
     * - When buttons are disabled, it's crucial to see which validation errors are preventing submission
     * - This helps debug test failures by showing the actual validation state of the page
     *
     * The shared base version checks if button is enabled, but doesn't gather page context.
     * This e2e version scans the page for error messages to provide richer debugging information.
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
     * E2E-specific override of clickButton with enhanced robustness and options.
     *
     * DIFFERENCES FROM SHARED BASE VERSION:
     * 1. Waits for button to be attached to DOM before checking visibility (prevents "not attached" errors)
     * 2. Provides skipEnabledCheck option for special cases (e.g., testing disabled button behavior)
     * 3. Enhanced error messages that distinguish between "not visible" and "hidden" states
     * 4. More granular timeout control at each step
     *
     * WHY THIS OVERRIDE EXISTS:
     * - E2E tests run in parallel with 4 workers, causing timing challenges
     * - Elements can be detached/reattached during real-time updates
     * - Some test scenarios need to click buttons even when disabled (error testing)
     * - Better error messages help diagnose failures in complex multi-user scenarios
     *
     * The shared base version assumes simpler, more controlled test environments.
     * This e2e version handles the complexity of parallel execution and real-time updates.
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
     * Navigation helper methods to replace direct page.goto() calls
     */
    async navigateToHomepage(): Promise<void> {
        await this._page.goto(EMULATOR_URL);
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

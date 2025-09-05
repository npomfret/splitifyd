import { Page, Locator, expect } from '@playwright/test';
import type { RegisteredUser as BaseUser } from '@splitifyd/shared';

/**
 * Base Page Object Model with shared utilities for Playwright tests
 * Extracted from e2e-tests/src/pages/base.page.ts for reuse in unit tests
 */
export abstract class BasePage {
    protected userInfo?: BaseUser;

    constructor(
        protected _page: Page,
        userInfo?: BaseUser,
    ) {
        this.userInfo = userInfo;
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

    /**
     * Wait for focus on an input element
     */
    private async waitForFocus(input: Locator, timeout = 2000): Promise<void> {
        await expect(input).toBeFocused({ timeout });
    }

    /**
     * Validate that input has expected value
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
        
        // For non-number inputs or when numeric comparison fails, use string comparison
        if (actualValue !== expectedValue) {
            throw new Error(`Input validation failed. Expected: "${expectedValue}", Actual: "${actualValue}"`);
        }
    }

    /**
     * Fill input with proper Preact async handling
     * Essential for handling Preact's async nature and onChange events
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
                if (inputType === 'number' || inputMode === 'decimal') {
                    const expectedNum = parseFloat(value);
                    const actualNum = parseFloat(actualValue);
                    if (!isNaN(expectedNum) && !isNaN(actualNum) && expectedNum === actualNum) {
                        await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
                        return; // Success!
                    }
                }
                
                if (attempt === maxRetries) {
                    throw new Error(`Failed to fill input after ${maxRetries} attempts. Expected: "${value}", Got: "${actualValue}"`);
                }
                
                // Wait before retry
                await this._page.waitForTimeout(100);
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retry
                await this._page.waitForTimeout(100);
            }
        }
        
        // Final validation
        await this.validateInputValue(input, value);
        await this._page.waitForLoadState('domcontentloaded', { timeout: 1000 });
    }

    /**
     * Wait for DOM content to be loaded
     */
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
            const text = buttonText || (await button.textContent()) || 'Unknown button';
            throw new Error(`Button "${text}" is disabled and cannot be clicked`);
        }
        await expect(button).toBeEnabled();
    }

    /**
     * Click button with proper error handling
     */
    async clickButton(
        button: Locator,
        options?: {
            buttonName?: string;
            timeout?: number;
        },
    ): Promise<void> {
        const { buttonName = 'button', timeout = 5000 } = options || {};

        // Ensure button is visible and enabled
        await expect(button).toBeVisible({ timeout });
        await this.expectButtonEnabled(button, buttonName);

        // Click the button
        await button.click();
        await this.waitForDomContentLoaded();
    }

    /**
     * Expect URL to match pattern
     */
    async expectUrl(pattern: RegExp | string, timeout = 5000): Promise<void> {
        await expect(this._page).toHaveURL(pattern, { timeout });
    }


    /**
     * Navigation helpers with base URL handling
     */
    async navigateToPath(path: string, baseUrl = 'http://localhost:8005'): Promise<void> {
        const url = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
        await this._page.goto(url);
        await this.waitForDomContentLoaded();
    }
}
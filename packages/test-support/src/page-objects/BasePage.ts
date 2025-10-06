import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model with shared utilities for Playwright tests
 * Extracted from e2e-tests/src/pages/base.page.ts for reuse in unit tests
 */
export abstract class BasePage {

    constructor(protected _page: Page) {
    }

    /**
     * Public getter for the page property
     */
    get page(): Page {
        return this._page;
    }

    /**
     * Fill input with proper handling for Preact controlled inputs
     * Uses direct DOM manipulation to work with Preact's signal-based reactivity
     */
    async fillPreactInput(selector: string | Locator, value: string) {
        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;

        // Focus the input first
        await input.focus();

        // Set value and dispatch events directly in browser context
        // This works better with Preact controlled inputs than Playwright's fill()
        await input.evaluate((el: any, val: string) => {
            el.value = val;
            // Dispatch input event to trigger Preact signal updates
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);

        // Verify value is set (ensures Preact signal has processed)
        await expect(input).toHaveValue(value, { timeout: 2000 });

        // Blur to trigger any onBlur validation
        await input.blur();
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
     * Expects the page to match a URL pattern
     */
    async expectUrl(pattern: string | RegExp): Promise<void> {
        await expect(this._page).toHaveURL(pattern);
    }
}

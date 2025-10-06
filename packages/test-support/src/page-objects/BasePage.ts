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
     * Clear input with proper handling for Preact controlled inputs
     *
     * Tries repeatedly to clear the input until it's actually empty.
     * Preact's controlled inputs don't always respond to the first clear attempt.
     */
    async clearPreactInput(selector: string | Locator) {
        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;

        // Check if already empty
        const initialValue = await input.inputValue();
        if (initialValue === '') {
            return; // Already empty, nothing to do
        }

        const maxAttempts = 10;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await input.focus();
            await input.clear();

            try {
                // Wait for it to actually be empty (with timeout)
                await expect(input).toHaveValue('', { timeout: 1000 });

                if (attempt > 0) {
                    console.log(`✅ clearPreactInput succeeded on attempt ${attempt + 1}`);
                }
                return; // Success!
            } catch (error) {
                console.log(`❌ clearPreactInput attempt ${attempt + 1} timed out waiting for empty value`);
                // Loop continues to next attempt
            }
        }

        // Final verification - will throw if still not empty
        console.log('❌ clearPreactInput exhausted all attempts, throwing error');
        await expect(input).toHaveValue('', { timeout: 2000 });
    }

    /**
     * Fill input with proper handling for Preact controlled inputs
     *
     * Uses pressSequentially() in a retry loop until the value is set correctly.
     *
     * WHY THIS IS NECESSARY:
     * Preact's controlled inputs with signals have proven extremely difficult to reliably
     * fill from Playwright tests. We discovered:
     *
     * 1. Preact uses `onInput` (not `onChange`) for real-time updates
     * 2. Even with `onInput` correctly configured, Playwright's event dispatch timing
     *    doesn't always match what Preact's signal reactivity expects
     * 3. The problem is intermittent - sometimes it works, sometimes it doesn't
     *
     * Rather than chase down every edge case in Preact's event handling, we use a
     * retry approach: keep trying pressSequentially() until the value is correct.
     */
    async fillPreactInput(selector: string | Locator, value: string) {
        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;
        const maxAttempts = 10;

        // Clear once before starting attempts
        await this.clearPreactInput(input);
        // Small delay to let Preact signals stabilize after clear
        await this._page.waitForTimeout(50);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await input.focus();
            await input.pressSequentially(value, { delay: 50, timeout: 2000 });

            const currentValue = await input.inputValue();
            if (currentValue === value) {
                if (attempt > 0) {
                    console.log(`✅ fillPreactInput succeeded on attempt ${attempt + 1}: "${value}"`);
                }
                await input.blur();
                return; // Success!
            }

            console.log(`❌ fillPreactInput attempt ${attempt + 1} failed: value="${currentValue}", expected="${value}"`);

            // Clear for next attempt
            await this.clearPreactInput(input);
            // Small delay to let Preact signals stabilize after clear
            await this._page.waitForTimeout(50);
        }

        // Final verification - will throw if still not set
        console.log(`❌ fillPreactInput exhausted all attempts for value "${value}", throwing error`);
        await expect(input).toHaveValue(value, { timeout: 2000 });
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

    /**
     * Close a modal/dialog by pressing Escape key
     * Properly verifies modal is visible before closing and waits for it to disappear
     *
     * @param modalContainer - The modal container locator
     * @param timeout - Maximum time to wait for modal to close (default: 5000ms)
     */
    async pressEscapeToClose(
        modalContainer: Locator,
        timeout: number = 5000
    ): Promise<void> {
        // Verify the modal is visible before attempting to close
        await expect(modalContainer).toBeVisible({ timeout: 1000 });

        // Press Escape on body element to trigger document-level keyboard handlers
        // Modal containers (divs) are not focusable, so events don't bubble correctly
        // Body is always focusable and events from it reach document listeners
        await this._page.locator('body').press('Escape');

        // Wait for modal to close
        await expect(modalContainer).not.toBeVisible({ timeout });
    }
}

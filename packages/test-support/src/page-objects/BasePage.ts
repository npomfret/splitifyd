import { Page, Locator, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';

/**
 * Base Page Object Model with shared utilities for Playwright tests
 * Extracted from e2e-tests/src/pages/base.page.ts for reuse in unit tests
 */
export abstract class BasePage {
    constructor(protected _page: Page) {}

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

        const inputIdentifier = await this.getInputIdentifier(input);
        const initialValue = await input.inputValue();

        if (initialValue === '') {
            return;
        }

        const maxAttempts = 10;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await input.focus();
            await input.clear();

            try {
                await expect(input).toHaveValue('', { timeout: TEST_TIMEOUTS.INPUT_UPDATE });
                return;
            } catch (error) {
                if (attempt === maxAttempts - 1) {
                    const currentValue = await input.inputValue();
                    throw new Error(
                        `Failed to clear input ${inputIdentifier} after ${maxAttempts} attempts. ` +
                            `Initial value: "${initialValue}", Current value: "${currentValue}"`,
                    );
                }
            }
        }
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
        const inputIdentifier = await this.getInputIdentifier(input);
        const maxAttempts = 10;

        await this.clearPreactInput(input);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                await input.focus();
                await input.pressSequentially(value, { delay: 50, timeout: TEST_TIMEOUTS.INPUT_UPDATE * 2 });

                const currentValue = await input.inputValue();
                if (currentValue === value) {
                    await input.blur();
                    return;
                }

                if (attempt === maxAttempts - 1) {
                    throw new Error(
                        `Failed to fill input ${inputIdentifier} after ${maxAttempts} attempts. ` +
                            `Expected value: "${value}", Current value: "${currentValue}". ` +
                            `This suggests Preact signal reactivity issues.`,
                    );
                }

                await this.clearPreactInput(input);
            } catch (error) {
                // If we're on the last attempt, re-throw the error
                if (attempt === maxAttempts - 1) {
                    throw new Error(
                        `Failed to fill input ${inputIdentifier} after ${maxAttempts} attempts. ` +
                            `Last error: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
                // Otherwise, retry after clearing the input
                await this.clearPreactInput(input);
            }
        }
    }

    /**
     * Wait for DOM content to be loaded
     */
    async waitForDomContentLoaded(timeout: number = TEST_TIMEOUTS.NAVIGATION) {
        await this._page.waitForLoadState('domcontentloaded', { timeout });
    }

    /**
     * Expects a button to be enabled before clicking.
     * Provides detailed error messages if the button is disabled.
     */
    async expectButtonEnabled(button: Locator, buttonText?: string): Promise<void> {
        const text = buttonText || (await button.textContent()) || 'Unknown button';

        try {
            await expect(button).toBeEnabled({ timeout: TEST_TIMEOUTS.BUTTON_STATE });
        } catch (error) {
            const currentUrl = this._page.url();
            const isVisible = await button.isVisible();
            const ariaDisabled = await button.getAttribute('aria-disabled');
            const disabled = await button.getAttribute('disabled');

            throw new Error(
                `Button "${text}" is not enabled. ` +
                    `Visible: ${isVisible}, aria-disabled: ${ariaDisabled}, disabled attribute: ${disabled !== null}, ` +
                    `Current URL: ${currentUrl}`,
            );
        }
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
        const { buttonName = 'button', timeout = TEST_TIMEOUTS.ELEMENT_VISIBLE } = options || {};

        try {
            await expect(button).toBeVisible({ timeout });
            await this.expectButtonEnabled(button, buttonName);
            await button.click();
            await this.waitForDomContentLoaded();
        } catch (error) {
            const currentUrl = this._page.url();
            throw new Error(`Failed to click button "${buttonName}" at URL: ${currentUrl}. Original error: ${error}`);
        }
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
     * @param timeout - Maximum time to wait for modal to close
     */
    async pressEscapeToClose(modalContainer: Locator, timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(modalContainer).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        // CRITICAL FIX: Focus the modal container before pressing Escape
        // This ensures the keydown event will be captured by the modal's event listener
        // See: https://playwright.dev/docs/input#keys-and-shortcuts
        await modalContainer.focus();

        // Wait for focus to be applied and event listeners to be ready
        // This prevents race conditions between Playwright's keyboard.press() and Preact's useEffect
        await this._page.waitForTimeout(100);

        await this._page.keyboard.press('Escape');

        try {
            await expect(modalContainer).not.toBeVisible({ timeout });
        } catch (error) {
            const isStillVisible = await modalContainer.isVisible();
            const currentUrl = this._page.url();
            const focusedElement = await this._page.evaluate(() => {
                // This code runs in browser context where document is available
                const el = document.activeElement;
                return {
                    tag: el?.tagName || 'unknown',
                    id: el?.id || 'none',
                    class: el?.className || 'none',
                };
            });
            throw new Error(
                `Modal failed to close after pressing Escape. ` +
                    `Still visible: ${isStillVisible}, URL: ${currentUrl}, ` +
                    `Focused element: ${focusedElement.tag}#${focusedElement.id}.${focusedElement.class}`,
            );
        }
    }

    /**
     * Get a human-readable identifier for an input field (for error messages)
     */
    private async getInputIdentifier(input: Locator): Promise<string> {
        const id = await input.getAttribute('id');
        if (id) return `#${id}`;

        const name = await input.getAttribute('name');
        if (name) return `[name="${name}"]`;

        const placeholder = await input.getAttribute('placeholder');
        if (placeholder) return `[placeholder="${placeholder}"]`;

        const ariaLabel = await input.getAttribute('aria-label');
        if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

        return '[input]';
    }
}

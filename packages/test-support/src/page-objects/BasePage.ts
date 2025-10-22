import { expect, Locator, Page } from '@playwright/test';
import { createErrorHandlingProxy } from '../error-proxy';
import { TEST_TIMEOUTS } from '../test-constants';

/**
 * Base Page Object Model with shared utilities for Playwright tests
 * Extracted from e2e-tests/src/pages/base.page.ts for reuse in unit tests
 *
 * ## Fluent Interface Pattern
 *
 * All Page Objects follow a consistent fluent interface pattern for actions.
 * This pattern ensures predictable behavior and better test readability.
 *
 * ### Pattern Overview
 *
 * For each major action, provide TWO versions:
 * 1. **Non-fluent version**: Action only, maximum flexibility
 * 2. **Fluent version**: Action + verification + return page object
 *
 * ### 1. Non-Fluent Actions (Action Only)
 * - **Purpose**: Perform an action without verification or navigation tracking
 * - **Naming**: `clickX()`, `fillX()`, `submitForm()`
 * - **Returns**: `Promise<void>`
 * - **Use when**: You need flexibility or want to handle verification yourself
 * - **Example**: `clickGroupCard('My Group')` - clicks the card but doesn't verify navigation
 *
 * ### 2. Fluent Actions (Action + Verification + Page Object)
 * - **Purpose**: Perform action, verify expected outcome, return new page object
 * - **Naming**: `clickXAndNavigateTo...()`, `clickXAndOpen...()`, `performXAndExpect...()`
 * - **Returns**: `Promise<NewPageObject>`
 * - **Use when**: Testing the common happy path and want clean, chainable code
 * - **Example**: `clickGroupCardAndNavigateToDetail('My Group')` - clicks, verifies URL, returns GroupDetailPage
 *
 * ### 3. Fluent Verification Methods (Error Testing)
 * - **Purpose**: Perform action and verify failure/error state
 * - **Naming**: `performXExpectingFailure()`, `submitXExpectingError()`
 * - **Returns**: `Promise<void>` (stays on same page after error)
 * - **Use when**: Testing error handling and validation
 * - **Example**: `loginExpectingFailure('bad@email.com', 'wrongpass')` - tries login, verifies error appears
 *
 * ### 4. Modal/Dialog Opening
 * - **Naming**: `clickXAndOpenModal()`, `clickXAndOpenDialog()`
 * - **Returns**: `Promise<ModalPageObject>`
 * - **Example**: `clickEditGroupAndOpenModal()` - clicks button, verifies modal opens, returns modal page object
 * - **Note**: Modals don't navigate to other pages, so they don't follow the fluent navigation pattern
 *
 * ### Implementation Guidelines
 *
 * 1. **Always provide both versions** for major navigation actions:
 *    ```typescript
 *    // Non-fluent: action only
 *    async clickGroupCard(groupName: string): Promise<void> {
 *        const card = this.getGroupCard(groupName);
 *        await card.click();
 *    }
 *
 *    // Fluent: action + verification + return page object
 *    async clickGroupCardAndNavigateToDetail(groupName: string): Promise<GroupDetailPage> {
 *        await this.clickGroupCard(groupName);  // Reuse non-fluent version
 *        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
 *        const detailPage = new GroupDetailPage(this.page);
 *        await detailPage.verifyGroupDetailPageLoaded(groupName);
 *        return detailPage;
 *    }
 *    ```
 *
 * 2. **Prefer fluent methods in tests** for readability:
 *    ```typescript
 *    // Good (fluent)
 *    const detailPage = await dashboardPage.clickGroupCardAndNavigateToDetail('My Group');
 *    await detailPage.clickAddExpense();
 *
 *    // Acceptable (non-fluent, when you need control)
 *    await dashboardPage.clickGroupCard('My Group');
 *    await expect(page).toHaveURL(/\/groups\/abc123/);
 *    ```
 *
 * 3. **No redundant helper methods**:
 *    - Don't create private helper methods that just call the non-fluent version
 *    - The non-fluent version IS the helper
 *
 * 4. **Modal/dialog page objects** don't navigate, they only open/close:
 *    ```typescript
 *    // Modal page objects return values, not page objects
 *    async copyShareLinkToClipboard(): Promise<string> {
 *        await this.clickCopyLink();
 *        return await this.getShareLink();
 *    }
 *    ```
 *
 * ### Examples
 *
 * @example
 * // Non-fluent (flexible, action only)
 * await dashboardPage.clickGroupCard('My Group');
 * await expect(page).toHaveURL(/\/groups\/abc123/);
 * const groupDetailPage = new GroupDetailPage(page);
 *
 * // Fluent (concise, verified, returns page object)
 * const groupDetailPage = await dashboardPage.clickGroupCardAndNavigateToDetail('My Group');
 * // Navigation already verified, page object ready to use
 *
 * @example
 * // Non-fluent modal opening
 * await groupDetailPage.clickEditGroup();
 * await expect(settingsModal.getModalContainer()).toBeVisible();
 * const settingsModal = new GroupSettingsModalPage(page);
 *
 * // Fluent modal opening (preferred)
 * const settingsModal = await groupDetailPage.clickEditGroupAndOpenModal();
 * // Modal already verified open, ready to interact
 */
export abstract class BasePage {
    constructor(protected _page: Page) {
        // Apply automatic error handling proxy to all derived classes
        // This wraps all async methods to automatically capture context on errors
        const className = this.constructor.name;

        return createErrorHandlingProxy(this, className, _page, {
            captureScreenshot: false,
            collectState: true,
            excludeMethods: [
                'page', // Getter for page property
                'getInputIdentifier', // Private helper method
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
     * Clear input with proper handling for Preact controlled inputs
     *
     * Tries repeatedly to clear the input until it's actually empty.
     * Preact's controlled inputs don't always respond to the first clear attempt.
     */
    async clearPreactInput(selector: string | Locator) {
        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;

        await input.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        const inputIdentifier = await this.getInputIdentifier(input);
        const initialValue = await input.inputValue({ timeout: TEST_TIMEOUTS.INPUT_UPDATE });

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
                    throw new Error(`Failed to clear input ${inputIdentifier} after ${maxAttempts} attempts. ` + `Initial value: "${initialValue}", Current value: "${currentValue}"`);
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
     *
     * NOTE: The e2e BasePage has a more complex version with dispatchEvent('input')
     * and additional validation. That version is kept for e2e test reliability.
     * This version is simpler and sufficient for unit tests.
     */
    async fillPreactInput(selector: string | Locator, value: string) {
        const input = typeof selector === 'string' ? this._page.locator(selector) : selector;
        const inputIdentifier = await this.getInputIdentifier(input);
        const maxAttempts = 3;

        await this.clearPreactInput(input);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                await input.focus();
                await input.pressSequentially(value, { delay: 5, timeout: TEST_TIMEOUTS.INPUT_UPDATE });

                const currentValue = await input.inputValue();
                if (currentValue === value) {
                    await input.blur();
                    return;
                }

                if (attempt === maxAttempts - 1) {
                    throw new Error(
                        `Failed to fill input ${inputIdentifier} after ${maxAttempts} attempts. `
                            + `Expected value: "${value}", Current value: "${currentValue}". `
                            + `This suggests Preact signal reactivity issues.`,
                    );
                }

                await this.clearPreactInput(input);
            } catch (error) {
                // If we're on the last attempt, re-throw the error
                if (attempt === maxAttempts - 1) {
                    throw new Error(`Failed to fill input ${inputIdentifier} after ${maxAttempts} attempts. ` + `Last error: ${error instanceof Error ? error.message : String(error)}`);
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

            throw new Error(`Button "${text}" is not enabled. ` + `Visible: ${isVisible}, aria-disabled: ${ariaDisabled}, disabled attribute: ${disabled !== null}, ` + `Current URL: ${currentUrl}`);
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
                `Modal failed to close after pressing Escape. `
                    + `Still visible: ${isStillVisible}, URL: ${currentUrl}, `
                    + `Focused element: ${focusedElement.tag}#${focusedElement.id}.${focusedElement.class}`,
            );
        }
    }

    /**
     * Get a human-readable identifier for an input field (for error messages)
     * Protected so child classes can use it for enhanced error reporting
     *
     * Resilient to elements disappearing - returns a fallback identifier if element is gone
     */
    protected async getInputIdentifier(input: Locator): Promise<string> {
        try {
            // Short timeout for attribute checks - if element is gone, fail fast
            const id = await input.getAttribute('id', { timeout: 500 });
            if (id) return `#${id}`;

            const name = await input.getAttribute('name', { timeout: 500 });
            if (name) return `[name="${name}"]`;

            const placeholder = await input.getAttribute('placeholder', { timeout: 500 });
            if (placeholder) return `[placeholder="${placeholder}"]`;

            const ariaLabel = await input.getAttribute('aria-label', { timeout: 500 });
            if (ariaLabel) return `[aria-label="${ariaLabel}"]`;
        } catch (error) {
            // Element disappeared or timed out - return a helpful fallback
            return `<input element no longer available - may have been removed from DOM>`;
        }

        return '[input]';
    }

    /**
     * Get heading by semantic level (generic utility)
     * Useful for finding headings without knowing exact text
     */
    getHeadingByLevel(level: number): Locator {
        return this._page.getByRole('heading', { level });
    }
}

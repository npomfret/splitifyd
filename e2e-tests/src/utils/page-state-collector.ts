/**
 * Utility to collect page state information for error context.
 * Gathers relevant debugging information from the current page.
 */

import { Page } from '@playwright/test';

/**
 * Page state information for debugging
 */
interface PageState {
    title: string;
    url: string;
    viewport?: { width: number; height: number };
    visibleButtons: string[];
    visibleHeadings: string[];
    visibleErrors: string[];
    formInputs: Array<{
        name?: string;
        id?: string;
        type?: string;
        value: string;
        placeholder?: string;
    }>;
    dialogOpen: boolean;
    loadingIndicators: boolean;
}

/**
 * Collect visible button texts (limit to avoid huge output)
 */
async function collectVisibleButtons(page: Page, limit = 10): Promise<string[]> {
    try {
        const buttons = page.locator('button:visible, [role="button"]:visible');
        const count = await buttons.count();
        const texts: string[] = [];

        for (let i = 0; i < Math.min(count, limit); i++) {
            const text = await buttons.nth(i).textContent();
            if (text?.trim()) {
                texts.push(text.trim());
            }
        }

        return texts;
    } catch {
        return [];
    }
}

/**
 * Collect visible heading texts
 */
async function collectVisibleHeadings(page: Page, limit = 10): Promise<string[]> {
    try {
        const headings = page.locator('h1:visible, h2:visible, h3:visible');
        const count = await headings.count();
        const texts: string[] = [];

        for (let i = 0; i < Math.min(count, limit); i++) {
            const text = await headings.nth(i).textContent();
            if (text?.trim()) {
                texts.push(text.trim());
            }
        }

        return texts;
    } catch {
        return [];
    }
}

/**
 * Collect visible error messages using semantic selectors to avoid false positives
 * from financial amounts displayed in red
 */
async function collectVisibleErrors(page: Page): Promise<string[]> {
    try {
        const errorSelectors = [
            // Semantic error selectors (preferred)
            '[role="alert"]:visible',
            '[data-testid*="error"]:visible',
            '[data-testid*="validation-error"]:visible',

            // Legacy class-based selectors (deprecated but kept for compatibility)
            '.error-message:visible',
            '.alert-error:visible',
            '.validation-error:visible',

            // Form validation errors (red text near form inputs, excluding financial amounts)
            'input ~ p.text-red-500:visible, input ~ p.text-red-600:visible',
            'textarea ~ p.text-red-500:visible, textarea ~ p.text-red-600:visible',
            'select ~ p.text-red-500:visible, select ~ p.text-red-600:visible',
        ];

        // Financial display exclusion selectors
        const financialSelectors = ['[data-financial-amount]:visible', '[data-balance]:visible', '[data-debt]:visible'];

        const errors: string[] = [];

        for (const selector of errorSelectors) {
            const elements = page.locator(selector);
            const count = await elements.count();

            for (let i = 0; i < count; i++) {
                const element = elements.nth(i);
                const text = await element.textContent();

                if (!text?.trim()) continue;

                // Check if this element is a financial display (skip if so)
                let isFinancialDisplay = false;
                for (const financialSelector of financialSelectors) {
                    const matches = await page.locator(financialSelector).locator(`text="${text.trim()}"`).count();
                    if (matches > 0) {
                        isFinancialDisplay = true;
                        break;
                    }
                }

                if (!isFinancialDisplay && !errors.includes(text.trim())) {
                    errors.push(text.trim());
                }
            }
        }

        return errors;
    } catch {
        return [];
    }
}

/**
 * Collect form input information
 */
async function collectFormInputs(page: Page, limit = 15): Promise<PageState['formInputs']> {
    try {
        const inputs = page.locator('input:visible, textarea:visible, select:visible');
        const count = await inputs.count();
        const inputInfo: PageState['formInputs'] = [];

        for (let i = 0; i < Math.min(count, limit); i++) {
            const input = inputs.nth(i);

            try {
                const name = await input.getAttribute('name');
                const id = await input.getAttribute('id');
                const type = await input.getAttribute('type');
                const placeholder = await input.getAttribute('placeholder');

                // Get value based on input type
                let value = '';
                const tagName = await input.evaluate((el) => el.tagName.toLowerCase());

                if (tagName === 'select') {
                    // For select elements, get selected option text
                    value = (await input.locator('option:checked').textContent()) || '';
                } else if (type === 'checkbox' || type === 'radio') {
                    // For checkboxes/radios, get checked state
                    value = (await input.isChecked()) ? 'checked' : 'unchecked';
                } else {
                    // For regular inputs, get the value
                    value = await input.inputValue();
                }

                inputInfo.push({
                    name: name || undefined,
                    id: id || undefined,
                    type: type || tagName,
                    value: value.length > 50 ? value.substring(0, 50) + '...' : value,
                    placeholder: placeholder || undefined,
                });
            } catch {
                // Skip this input if we can't get its info
            }
        }

        return inputInfo;
    } catch {
        return [];
    }
}

/**
 * Check if any dialogs/modals are open
 */
async function checkDialogOpen(page: Page): Promise<boolean> {
    try {
        const dialogSelectors = ['[role="dialog"]:visible', '.modal:visible', '.dialog:visible', '[data-testid="modal"]:visible'];

        for (const selector of dialogSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
                return true;
            }
        }

        return false;
    } catch {
        return false;
    }
}

/**
 * Check if any loading indicators are visible
 */
async function checkLoadingIndicators(page: Page): Promise<boolean> {
    try {
        const loadingSelectors = ['.spinner:visible', '.loading:visible', '[role="progressbar"]:visible', 'text=Loading:visible', 'text=Saving:visible', 'text=Processing:visible'];

        for (const selector of loadingSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
                return true;
            }
        }

        return false;
    } catch {
        return false;
    }
}

/**
 * Try to identify what element was being interacted with based on method name
 */
async function getInteractionTarget(page: Page, methodName: string): Promise<Record<string, any>> {
    const context: Record<string, any> = {};

    // Try to identify the target based on method name patterns
    if (methodName.toLowerCase().includes('button') || methodName.toLowerCase().includes('click')) {
        // Look for focused button or recently clicked button
        try {
            const focusedElement = page.locator(':focus');
            if ((await focusedElement.count()) > 0) {
                const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
                if (tagName === 'button' || (await focusedElement.getAttribute('role')) === 'button') {
                    context.focusedButton = await focusedElement.textContent();
                    context.focusedButtonEnabled = await focusedElement.isEnabled();
                    context.focusedButtonVisible = await focusedElement.isVisible();
                }
            }
        } catch {
            // Ignore if we can't get focused element
        }
    }

    if (methodName.toLowerCase().includes('input') || methodName.toLowerCase().includes('fill')) {
        // Look for focused input
        try {
            const focusedElement = page.locator(':focus');
            if ((await focusedElement.count()) > 0) {
                const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
                if (tagName === 'input' || tagName === 'textarea') {
                    context.focusedInput = {
                        name: await focusedElement.getAttribute('name'),
                        id: await focusedElement.getAttribute('id'),
                        placeholder: await focusedElement.getAttribute('placeholder'),
                        value: await focusedElement.inputValue(),
                        type: await focusedElement.getAttribute('type'),
                    };
                }
            }
        } catch {
            // Ignore if we can't get focused element
        }
    }

    return context;
}

/**
 * Collect comprehensive page state for error debugging
 *
 * @param page - The Playwright Page instance
 * @param methodName - The method that was being executed (for context)
 * @returns Page state information
 */
export async function collectPageState(page: Page, methodName?: string): Promise<PageState> {
    const state: PageState = {
        title: '',
        url: page.url(),
        visibleButtons: [],
        visibleHeadings: [],
        visibleErrors: [],
        formInputs: [],
        dialogOpen: false,
        loadingIndicators: false,
    };

    try {
        // Get page title
        state.title = await page.title();

        // Get viewport size
        const viewport = page.viewportSize();
        if (viewport) {
            state.viewport = viewport;
        }

        // Collect various page elements in parallel for performance
        const [buttons, headings, errors, inputs, dialogOpen, loading] = await Promise.all([
            collectVisibleButtons(page),
            collectVisibleHeadings(page),
            collectVisibleErrors(page),
            collectFormInputs(page),
            checkDialogOpen(page),
            checkLoadingIndicators(page),
        ]);

        state.visibleButtons = buttons;
        state.visibleHeadings = headings;
        state.visibleErrors = errors;
        state.formInputs = inputs;
        state.dialogOpen = dialogOpen;
        state.loadingIndicators = loading;

        // Add interaction target if method name provided
        if (methodName) {
            const interactionTarget = await getInteractionTarget(page, methodName);
            if (Object.keys(interactionTarget).length > 0) {
                (state as any).interactionTarget = interactionTarget;
            }
        }
    } catch (error) {
        // Add error to state but don't throw
        (state as any).stateCollectionError = String(error);
    }

    return state;
}

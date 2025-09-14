import { Page, expect } from '@playwright/test';
import { TestHelpers, TEST_CONFIG } from './test-helpers';

/**
 * Common test patterns to reduce duplication across test files
 */

/**
 * Standard form testing patterns
 */
export class FormTestPatterns {
    /**
     * Test form field validation with common patterns
     */
    static async testFieldValidation(
        page: Page,
        fieldSelector: string,
        validValue: string,
        invalidValue: string,
        expectedErrorMessage: string
    ): Promise<void> {
        // Test invalid input
        await page.fill(fieldSelector, invalidValue);
        await page.locator(fieldSelector).blur(); // Trigger validation
        
        const errorElement = page.locator('[role="alert"]:visible').first();
        await expect(errorElement).toBeVisible();
        await expect(errorElement).toContainText(expectedErrorMessage);

        // Test valid input clears error
        await page.fill(fieldSelector, validValue);
        await page.locator(fieldSelector).blur();
        await expect(errorElement).toBeHidden();
    }

    /**
     * Test form submission with validation
     */
    static async testFormSubmission(
        page: Page,
        formSelector: string,
        submitButtonSelector: string,
        requiredFields: Array<{ selector: string; value: string }>
    ): Promise<void> {
        const form = page.locator(formSelector);
        const submitButton = page.locator(submitButtonSelector);

        // Test submission with empty form
        await submitButton.click();
        const errorElements = page.locator('[role="alert"]:visible');
        await expect(errorElements.first()).toBeVisible();

        // Fill required fields
        for (const field of requiredFields) {
            await page.fill(field.selector, field.value);
        }

        // Test successful submission
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
    }
}

/**
 * Currency input testing patterns
 */
export class CurrencyTestPatterns {
    /**
     * Test currency selection and amount precision
     */
    static async testCurrencySelection(
        page: Page,
        currencyButtonSelector: string,
        searchInputSelector: string,
        amountInputSelector: string,
        currency: string,
        expectedPrecision: number
    ): Promise<void> {
        // Open currency dropdown
        await page.click(currencyButtonSelector);
        
        // Search for currency
        await page.fill(searchInputSelector, currency);
        
        // Select currency
        await page.click(`[data-testid="currency-${currency.toLowerCase()}"]`);
        
        // Verify currency selection
        await expect(page.locator(currencyButtonSelector)).toContainText(currency);
        
        // Test amount precision
        const testAmount = '123.456789';
        await page.fill(amountInputSelector, testAmount);
        
        const expectedAmount = (123.456789).toFixed(expectedPrecision);
        await expect(page.locator(amountInputSelector)).toHaveValue(expectedAmount);
    }

    /**
     * Test keyboard navigation in currency dropdown
     */
    static async testCurrencyKeyboardNavigation(
        page: Page,
        currencyButtonSelector: string,
        expectedCurrencies: string[]
    ): Promise<void> {
        await page.click(currencyButtonSelector);
        
        // Navigate with arrow keys
        for (let i = 0; i < expectedCurrencies.length; i++) {
            await page.keyboard.press('ArrowDown');
            const highlightedItem = page.locator('.currency-option.highlighted');
            await expect(highlightedItem).toBeVisible();
        }

        // Select with Enter
        await page.keyboard.press('Enter');
        
        // Verify selection
        const selectedCurrency = expectedCurrencies[expectedCurrencies.length - 1];
        await expect(page.locator(currencyButtonSelector)).toContainText(selectedCurrency);
    }
}

/**
 * Real-time update testing patterns
 */
export class RealTimeTestPatterns {
    /**
     * Test real-time data updates with polling
     */
    static async testRealTimeUpdate<T>(
        page: Page,
        dataSelector: string,
        updateTrigger: () => Promise<void>,
        expectedValueMatcher: (value: string) => boolean,
        timeoutMs = TEST_CONFIG.DEFAULT_TIMEOUT
    ): Promise<void> {
        // Trigger the update
        await updateTrigger();

        // Poll for the update with timeout
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            try {
                const element = page.locator(dataSelector);
                await element.waitFor({ state: 'visible', timeout: 1000 });
                const value = await element.textContent();
                
                if (value && expectedValueMatcher(value)) {
                    return; // Success
                }
            } catch {
                // Continue polling
            }
            
            await TestHelpers.wait(200);
        }

        throw new Error(`Real-time update not detected within ${timeoutMs}ms`);
    }

    /**
     * Test connection state indicators
     */
    static async testConnectionState(
        page: Page,
        indicatorSelector: string,
        expectedStates: Array<{ state: string; className: string; text: string }>
    ): Promise<void> {
        for (const { state, className, text } of expectedStates) {
            // Wait for state transition
            await page.locator(indicatorSelector).waitFor({ state: 'visible' });
            
            // Verify visual state
            await expect(page.locator(indicatorSelector)).toHaveClass(new RegExp(className));
            await expect(page.locator(`${indicatorSelector} .status-text`)).toHaveText(text);
            
            console.log(`✓ Verified connection state: ${state}`);
        }
    }
}

/**
 * Dialog and modal testing patterns
 */
export class ModalTestPatterns {
    /**
     * Test modal opening and closing
     */
    static async testModalLifecycle(
        page: Page,
        openTriggerSelector: string,
        modalSelector: string,
        closeButtonSelector?: string
    ): Promise<void> {
        // Test opening
        await page.click(openTriggerSelector);
        await expect(page.locator(modalSelector)).toBeVisible();

        // Test focus management
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(focusedElement || '')).toBe(true);

        // Test closing
        if (closeButtonSelector) {
            await page.click(closeButtonSelector);
        } else {
            await page.keyboard.press('Escape');
        }
        
        await expect(page.locator(modalSelector)).toBeHidden();
    }

    /**
     * Test modal keyboard navigation
     */
    static async testModalKeyboardNavigation(
        page: Page,
        modalSelector: string,
        focusableSelectors: string[]
    ): Promise<void> {
        await expect(page.locator(modalSelector)).toBeVisible();

        // Test Tab navigation
        for (let i = 0; i < focusableSelectors.length; i++) {
            await page.keyboard.press('Tab');
            await expect(page.locator(focusableSelectors[i])).toBeFocused();
        }

        // Test Shift+Tab navigation (reverse)
        for (let i = focusableSelectors.length - 1; i >= 0; i--) {
            await page.keyboard.press('Shift+Tab');
            await expect(page.locator(focusableSelectors[i])).toBeFocused();
        }

        // Test focus trapping (Tab from last element should go to first)
        await page.locator(focusableSelectors[focusableSelectors.length - 1]).focus();
        await page.keyboard.press('Tab');
        await expect(page.locator(focusableSelectors[0])).toBeFocused();
    }
}

/**
 * Performance and loading testing patterns
 */
export class PerformanceTestPatterns {
    /**
     * Test loading states and transitions
     */
    static async testLoadingStates(
        page: Page,
        triggerSelector: string,
        loadingIndicatorSelector: string,
        contentSelector: string
    ): Promise<void> {
        // Trigger loading
        await page.click(triggerSelector);

        // Verify loading state appears
        await expect(page.locator(loadingIndicatorSelector)).toBeVisible();

        // Verify content is hidden during loading
        await expect(page.locator(contentSelector)).toBeHidden();

        // Wait for loading to complete
        await expect(page.locator(loadingIndicatorSelector)).toBeHidden({ timeout: TEST_CONFIG.DEFAULT_TIMEOUT });

        // Verify content appears
        await expect(page.locator(contentSelector)).toBeVisible();
    }

    /**
     * Test component responsiveness under load
     */
    static async testComponentResponsiveness(
        page: Page,
        componentSelector: string,
        interactions: Array<() => Promise<void>>,
        maxResponseTime = 1000
    ): Promise<void> {
        for (const interaction of interactions) {
            const startTime = Date.now();
            
            await interaction();
            
            // Wait for any visual updates to complete
            await page.locator(componentSelector).waitFor({ state: 'visible' });
            
            const responseTime = Date.now() - startTime;
            if (responseTime > maxResponseTime) {
                throw new Error(`Interaction took ${responseTime}ms, expected < ${maxResponseTime}ms`);
            }
        }
    }
}
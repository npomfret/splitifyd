import { Page } from '@playwright/test';

/**
 * Configuration for navigation wait helpers
 */
export interface WaitForURLOptions {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
}

/**
 * Enhanced waitForURL that provides better error messages including the current URL on timeout.
 *
 * @param page - The Playwright page object
 * @param urlPattern - The URL pattern to wait for (string or RegExp)
 * @param options - Options for the wait operation
 * @throws Error with detailed message including current URL on timeout
 */
export async function waitForURLWithContext(page: Page, urlPattern: string | RegExp, options: WaitForURLOptions = {}): Promise<void> {
    const { timeout = 1000, waitUntil } = options;
    const startTime = Date.now();

    try {
        await page.waitForURL(urlPattern, { timeout, waitUntil });
    } catch (error) {
        // Check if it's a timeout error by examining the error message
        if (error instanceof Error && error.message.includes('Timeout')) {
            const currentURL = page.url();
            const elapsedTime = Date.now() - startTime;
            const patternStr = urlPattern instanceof RegExp ? urlPattern.toString() : urlPattern;

            // Collect additional context
            const pageTitle = await page.title().catch(() => 'Unable to get title');
            const isLoading = await page.evaluate(() => document.readyState !== 'complete').catch(() => false);

            // Build detailed error message
            const errorDetails = [
                `Timeout waiting for URL after ${elapsedTime}ms`,
                `Expected URL pattern: ${patternStr}`,
                `Current URL: ${currentURL}`,
                `Page title: ${pageTitle}`,
                `Page still loading: ${isLoading}`,
            ];

            // Check if there are any console errors
            const consoleErrors: string[] = [];
            page.on('console', (msg) => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });

            if (consoleErrors.length > 0) {
                errorDetails.push(`Console errors: ${consoleErrors.join('; ')}`);
            }

            throw new Error(errorDetails.join('\n  '));
        }
        throw error;
    }
}
/**
 * Helper to build a group detail URL pattern
 */
export function groupDetailUrlPattern(groupId?: string): RegExp {
    if (groupId) {
        return new RegExp(`/groups/${groupId}$`);
    }
    return /\/groups\/[a-zA-Z0-9]+$/;
}

/**
 * Helper to build an expense detail URL pattern
 */
export function expenseDetailUrlPattern(groupId?: string, expenseId?: string): RegExp {
    if (groupId && expenseId) {
        return new RegExp(`/groups/${groupId}/expenses/${expenseId}$`);
    } else if (groupId) {
        return new RegExp(`/groups/${groupId}/expenses/[a-zA-Z0-9]+$`);
    }
    return /\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+$/;
}

/**
 * Helper to build an edit expense URL pattern
 * Note: Query parameters can appear in different orders, so we use a more flexible pattern
 */
export function editExpenseUrlPattern(groupId?: string, expenseId?: string): RegExp {
    if (groupId && expenseId) {
        // Match the path and ensure both query params exist (order doesn't matter)
        return new RegExp(`/groups/${groupId}/add-expense\\?.*id=${expenseId}.*edit=true|/groups/${groupId}/add-expense\\?.*edit=true.*id=${expenseId}`);
    } else if (groupId) {
        // Match the path and ensure both query params exist with any ID
        return new RegExp(`/groups/${groupId}/add-expense\\?.*edit=true.*id=[a-zA-Z0-9]+|/groups/${groupId}/add-expense\\?.*id=[a-zA-Z0-9]+.*edit=true`);
    }
    // Generic pattern that matches either query param order
    return /\/groups\/[a-zA-Z0-9]+\/add-expense\?.*((edit=true.*id=[a-zA-Z0-9]+)|(id=[a-zA-Z0-9]+.*edit=true))/;
}

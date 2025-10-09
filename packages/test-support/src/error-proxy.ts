/**
 * Automatic error handling proxy for Page Object Models.
 * Wraps all async methods to automatically capture context on errors.
 */

import { Page } from '@playwright/test';
import { ProxiedMethodError } from './errors/test-errors';
import { collectPageState } from './utils/page-state-collector';

/**
 * Configuration for the error handling proxy
 */
interface ProxyConfig {
    /** Methods to exclude from proxying */
    excludeMethods?: string[];
    /** Whether to capture screenshots on error */
    captureScreenshot?: boolean;
    /** Whether to collect page state on error */
    collectState?: boolean;
}

/**
 * User context extracted from the page at error time
 */
interface UserContext {
    displayName: string;
    browserContextId: string;
}

/**
 * Default methods to exclude from proxying
 */
const DEFAULT_EXCLUDED_METHODS = [
    'constructor',
    'toString',
    'valueOf',
    'toJSON',
    // Private methods starting with underscore
    '_*',
    // Getters that return locators (not async)
    'get*',
    // Other accessor methods
    'is*',
    'has*',
];

/**
 * Check if a method should be excluded from proxying
 */
function shouldExcludeMethod(methodName: string, excludePatterns: string[]): boolean {
    for (const pattern of excludePatterns) {
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            if (methodName.startsWith(prefix)) {
                return true;
            }
        } else if (methodName === pattern) {
            return true;
        }
    }
    return false;
}

/**
 * Extract user context from the page at error time.
 * Attempts to extract display name from the user menu button in the header.
 * Gracefully handles errors - returns "Unknown User" if extraction fails.
 */
async function getUserContextFromPage(page: Page): Promise<UserContext> {
    let displayName = 'Unknown User';

    try {
        // Try to extract display name from user menu button
        // This selector matches HeaderPage.getUserMenuButton() structure
        const userMenuButton = page.locator('[data-testid="user-menu-button"]');
        const nameElement = userMenuButton.locator('.text-sm.font-medium.text-gray-700').first();

        // Use a short timeout - if user menu isn't immediately visible, skip it
        const textContent = await nameElement.textContent({ timeout: 500 });
        if (textContent) {
            displayName = textContent.trim();
        }
    } catch {
        // Silently fail - we don't want to break error reporting if we can't get user info
        // This can happen if:
        // - User is not authenticated
        // - Page is in a bad state
        // - Test is on a page without the header
    }

    // Get browser context ID for multi-browser debugging
    const browserContextId = page.context().browser()?.version() || 'unknown-browser';

    return {
        displayName,
        browserContextId,
    };
}

/**
 * Extract meaningful context from method arguments
 */
function extractArgumentContext(args: any[]): Record<string, any> {
    const context: Record<string, any> = {};

    if (args.length === 0) return context;

    // Extract meaningful values from arguments
    args.forEach((arg, index) => {
        if (arg === null || arg === undefined) {
            return;
        }

        // Handle different argument types
        if (typeof arg === 'string') {
            context[`arg${index}`] = arg.length > 100 ? arg.substring(0, 100) + '...' : arg;
        } else if (typeof arg === 'number' || typeof arg === 'boolean') {
            context[`arg${index}`] = arg;
        } else if (typeof arg === 'object') {
            // Handle specific known types
            if ('name' in arg || 'description' in arg) {
                context[`arg${index}`] = { name: arg.name, description: arg.description };
            } else {
                // Generic object - just capture keys
                context[`arg${index}Type`] = arg.constructor?.name || 'Object';
                context[`arg${index}Keys`] = Object.keys(arg).slice(0, 5).join(', ');
            }
        }
    });

    return context;
}

/**
 * Create a proxy wrapper for a Page Object Model instance
 *
 * @param instance - The page object instance to wrap
 * @param className - The name of the page object class
 * @param page - The Playwright Page instance
 * @param config - Optional proxy configuration
 * @returns Proxied instance with automatic error handling
 */
export function createErrorHandlingProxy<T extends object>(instance: T, className: string, page: Page, config: ProxyConfig = {}): T {
    const { excludeMethods = DEFAULT_EXCLUDED_METHODS, captureScreenshot = false, collectState = true } = config;

    return new Proxy(instance, {
        get(target: any, prop: string | symbol, receiver: any) {
            const value = Reflect.get(target, prop, receiver);

            // Only proxy methods, not properties
            if (typeof value !== 'function') {
                return value;
            }

            // Check if method should be excluded
            if (typeof prop === 'string' && shouldExcludeMethod(prop, excludeMethods)) {
                return value;
            }

            // Return wrapped function
            return function(this: any, ...args: any[]) {
                const methodName = String(prop);

                // Call the original method
                const result = value.apply(this, args);

                // If it doesn't return a promise, return it as-is
                if (!(result instanceof Promise)) {
                    return result;
                }

                // It's a promise, so wrap with error handling
                return result.then(
                    (value) => value,
                    async (originalError: any) => {
                        // Don't double-wrap our own errors
                        if (originalError instanceof ProxiedMethodError) {
                            throw originalError;
                        }

                        // Extract user context from page at error time
                        const userContext = await getUserContextFromPage(page);

                        // Collect context for the error
                        const currentUrl = page.url();
                        const argumentContext = extractArgumentContext(args);

                        // Build error context
                        const errorContext: Record<string, any> = {
                            className,
                            methodName,
                            currentUrl,
                            ...argumentContext,
                            timestamp: new Date().toISOString(),
                            user: userContext.displayName,
                            browserContext: userContext.browserContextId,
                        };

                        // Collect page state if configured
                        if (collectState) {
                            try {
                                errorContext.pageState = await collectPageState(page, methodName);
                            } catch (stateError) {
                                // Don't fail if we can't collect state
                                errorContext.stateCollectionError = String(stateError);
                            }
                        }

                        // Capture screenshot if configured
                        if (captureScreenshot) {
                            try {
                                const screenshotPath = `error-${className}-${methodName}-${Date.now()}.png`;
                                await page.screenshot({ path: screenshotPath, fullPage: true });
                                errorContext.screenshot = screenshotPath;
                            } catch (screenshotError) {
                                // Don't fail if we can't take screenshot
                                errorContext.screenshotError = String(screenshotError);
                            }
                        }

                        // Create and throw enriched error
                        throw new ProxiedMethodError(originalError.message || 'Unknown error', `${className}.${methodName}`, errorContext, originalError);
                    },
                );
            };
        },
    });
}

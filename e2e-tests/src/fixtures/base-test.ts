import { test as base } from '@playwright/test';
import { attachApiInterceptor, attachConsoleHandler, ApiInterceptor } from '../helpers';

// Global counter for browser instances across all tests
let globalBrowserIndex = 0;

// Extend base test to inject Playwright flag, i18n language setting, and console handling
export const baseTest = base.extend<{ apiInterceptor: ApiInterceptor }>({
    apiInterceptor: async ({ page }, use, testInfo) => {
        // Create the API interceptor
        const apiInterceptor = attachApiInterceptor(page, { testInfo });
        await use(apiInterceptor);
        // Cleanup is handled in the page fixture
    },

    page: async ({ page }, use, testInfo) => {
        // Assign unique browser index
        const browserIndex = globalBrowserIndex++;

        // Inject __PLAYWRIGHT__ flag and i18n language setting before any page script executes.
        await page.addInitScript(() => {
            // This flag is used to disable heavy animations (like the Three.js globe)
            // during E2E tests to improve performance and prevent timeouts.
            (window as any).__PLAYWRIGHT__ = true;

            // This sets the language to English for all E2E tests.
            // This prevents tests from breaking when text is translated, ensuring that
            // tests focus on functionality, not on translation accuracy.
            localStorage.setItem('i18nextLng', 'en');
        });

        // Attach console handler for automatic error detection and logging
        const consoleHandler = attachConsoleHandler(page, { testInfo, userIndex: browserIndex });

        try {
            await use(page);
        } finally {
            // Process any errors that occurred during the test
            await consoleHandler.processErrors(testInfo);
            consoleHandler.dispose();
        }
    },
});

export { expect } from '@playwright/test';

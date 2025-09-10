import { test as base } from '@playwright/test';
import { attachConsoleHandler } from '../helpers/unified-console-handler';

// Extend base test to inject Playwright flag, i18n language setting, and unified console handling
export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
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

        // Attach unified console handler for automatic error detection and logging
        const consoleHandler = attachConsoleHandler(page, { testInfo });

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

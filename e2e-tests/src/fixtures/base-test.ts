import { test as base } from '@playwright/test';
import { setupConsoleErrorReporting } from '../helpers';

// Set up console error reporting for all tests
setupConsoleErrorReporting();

// Extend base test to inject Playwright flag and i18n language setting
export const test = base.extend({
    page: async ({ page }, use) => {
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

        await use(page);
    },
});

export { expect } from '@playwright/test';

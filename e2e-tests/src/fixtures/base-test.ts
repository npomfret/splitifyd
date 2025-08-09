import { test as base } from '@playwright/test';
import { setupConsoleErrorReporting } from '../helpers';

// Set up console error reporting for all tests
setupConsoleErrorReporting();

// Extend base test to inject Playwright flag
export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject __PLAYWRIGHT__ flag before any page script executes.
    // This flag is used to disable heavy animations (like the Three.js globe)
    // during E2E tests to improve performance and prevent timeouts.
    // The globe animation causes browser sluggishness which can make tests
    // fail with the strict 1-second action timeout.
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });
    
    await use(page);
  }
});

export { expect } from '@playwright/test';
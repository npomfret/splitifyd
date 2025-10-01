import { test as base, Page } from '@playwright/test';

type BrowserReuseFixtures = {
    reusablePage: Page;
};

export const test = base.extend<BrowserReuseFixtures>({
    // Use the global browser instance instead of creating new ones
    reusablePage: async ({}, use) => {
        const browser = (global as any).__PLAYWRIGHT_BROWSER__;
        if (!browser) {
            throw new Error('Global browser not available. Make sure globalSetup is configured.');
        }

        // Create a new page from the reused browser
        const page = await browser.newPage();

        try {
            await use(page);
        } finally {
            // Close only the page, not the browser
            await page.close();
        }
    },
});

export { expect } from '@playwright/test';
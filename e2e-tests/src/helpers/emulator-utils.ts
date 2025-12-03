import type { Page } from '@playwright/test';

export async function waitForApp(page: Page) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
}

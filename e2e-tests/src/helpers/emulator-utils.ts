import type { Page } from '@playwright/test';
import { getFirebaseEmulatorConfig } from '@splitifyd/test-support';

const config = getFirebaseEmulatorConfig();

export const EMULATOR_URL = `http://localhost:${config.hostingPort}`; // App uses root URLs, not /v2 prefix

export async function waitForApp(page: Page) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
}

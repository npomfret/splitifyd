import {getFirebaseEmulatorConfig} from '@billsplit-wl/test-support';
import type {Page} from '@playwright/test';

export const EMULATOR_URL = getFirebaseEmulatorConfig().emulatorHttpUrl; // App uses root URLs, not /v2 prefix

export async function waitForApp(page: Page) {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
}

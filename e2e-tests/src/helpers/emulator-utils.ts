import type {Page} from '@playwright/test';
import {findProjectRoot, getFirebaseEmulatorConfig} from '@splitifyd/test-support';

const projectRoot = findProjectRoot(process.cwd());
const config = getFirebaseEmulatorConfig(projectRoot);

export const EMULATOR_URL = `http://localhost:${(config.hostingPort)}`; // App uses root URLs, not /v2 prefix

export async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle');
}


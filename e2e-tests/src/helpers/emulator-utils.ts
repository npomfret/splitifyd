import type {Page} from '@playwright/test';
import { getFirebaseEmulatorConfig, findProjectRoot } from '@splitifyd/test-support';

// Get Firebase emulator configuration
const projectRoot = findProjectRoot(process.cwd());
const config = getFirebaseEmulatorConfig(projectRoot);

export const HOSTING_PORT = config.hostingPort;
export const EMULATOR_URL = `http://localhost:${HOSTING_PORT}`; // App uses root URLs, not /v2 prefix

export async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle');
}


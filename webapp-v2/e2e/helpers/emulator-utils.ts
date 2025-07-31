import {readFileSync} from 'fs';
import {dirname, join} from 'path';
import type {Page} from '@playwright/test';

// Find project root by looking for firebase/firebase.json
function findProjectRoot(startPath: string): string {
  let currentPath = startPath;
  
  while (currentPath !== '/') {
    try {
      const firebaseJsonPath = join(currentPath, 'firebase', 'firebase.json');
      readFileSync(firebaseJsonPath);
      return currentPath;
    } catch {
      currentPath = dirname(currentPath);
    }
  }
  
  throw new Error('Could not find project root with firebase/firebase.json');
}

// Get ports from firebase.json
const projectRoot = findProjectRoot(process.cwd());
const firebaseConfigPath = join(projectRoot, 'firebase', 'firebase.json');
const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, 'utf-8'));

export const HOSTING_PORT = firebaseConfig.emulators!.hosting!.port;
export const EMULATOR_URL = `http://localhost:${HOSTING_PORT}`; // App uses root URLs, not /v2 prefix

export async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle');
}


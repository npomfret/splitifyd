import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import type { Page } from '@playwright/test';

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

export const HOSTING_PORT = firebaseConfig.emulators?.hosting?.port || 6002;
export const FUNCTIONS_PORT = firebaseConfig.emulators?.functions?.port || 6001;
export const EMULATOR_URL = `http://localhost:${HOSTING_PORT}`;
export const V2_URL = `${EMULATOR_URL}/v2`;
export const API_URL = `http://localhost:${FUNCTIONS_PORT}`;

export async function waitForEmulator(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function waitForV2App(page: Page) {
  await page.waitForLoadState('networkidle');
}

export function setupConsoleErrorListener(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}
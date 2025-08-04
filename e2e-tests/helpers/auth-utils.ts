import { Page } from '@playwright/test';

export interface TestUser {
  uid: string;
  email: string;
  displayName: string;
  token?: string;
}

/**
 * Fills Preact input fields with proper event handling
 * This ensures Preact signals are triggered correctly
 */
export async function fillPreactInput(input: any, value: string, page: Page): Promise<void> {
  await input.click();
  await input.fill('');
  for (const char of value) {
    await input.type(char);
  }
  await input.blur();
  await page.waitForLoadState('domcontentloaded');
}
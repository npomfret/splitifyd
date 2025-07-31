import { test, expect } from '@playwright/test';
import { EMULATOR_URL, waitForApp, setupConsoleErrorReporting } from '../helpers';

setupConsoleErrorReporting();

// Simplified navigation tests - just verify pages load without errors
test.describe('Navigation E2E', () => {
  test('should load key pages without console errors', async ({ page }) => {
    
    // Test key pages load correctly
    const pages = [
      { url: EMULATOR_URL, heading: 'Effortless Bill Splitting, Simplified & Smart.' },
      { url: `${EMULATOR_URL}/pricing`, heading: 'Pricing', level: 1 },
    ];
    
    for (const { url, heading, level } of pages) {
      await page.goto(url);
      await waitForApp(page);
      const selector = level 
        ? page.getByRole('heading', { name: heading, level })
        : page.getByRole('heading', { name: heading });
      await expect(selector).toBeVisible();
    }
    
    // No console errors
  });
});
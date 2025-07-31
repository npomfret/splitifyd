import { test, expect } from '@playwright/test';
import { EMULATOR_URL, waitForV2App, setupConsoleErrorReporting } from './helpers';

setupConsoleErrorReporting();

// Simplified SEO test - just verify pages have titles and no errors
test.describe('SEO E2E', () => {
  test('should set page titles without console errors', async ({ page }) => {
    
    // Just check that key pages load with titles
    const pages = [
      { path: '/', titleContains: 'Splitifyd' },
      { path: '/pricing', titleContains: 'Splitifyd' },
    ];
    
    for (const { path, titleContains } of pages) {
      await page.goto(`${EMULATOR_URL}${path}`);
      await waitForV2App(page);
      
      const title = await page.title();
      expect(title).toContain(titleContains);
    }
    
    // No console errors
  });
});
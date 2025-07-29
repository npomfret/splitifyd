import { test, expect } from '@playwright/test';
import { V2_URL, waitForV2App, setupConsoleErrorListener } from './helpers';

// Simplified SEO test - just verify pages have titles and no errors
test.describe('SEO E2E', () => {
  test('should set page titles without console errors', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    // Just check that key pages load with titles
    const pages = [
      { path: '/', titleContains: 'Splitifyd' },
      { path: '/pricing', titleContains: 'Splitifyd' },
    ];
    
    for (const { path, titleContains } of pages) {
      await page.goto(`${V2_URL}${path}`);
      await waitForV2App(page);
      
      const title = await page.title();
      expect(title).toContain(titleContains);
    }
    
    // No console errors
    expect(errors).toHaveLength(0);
  });
});
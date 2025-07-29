import { test, expect } from '@playwright/test';
import { V2_URL, waitForV2App, setupConsoleErrorListener } from './helpers';

// Simplified navigation tests - just verify pages load without errors
test.describe('Navigation E2E', () => {
  test('should load key pages without console errors', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    // Test key pages load correctly
    const pages = [
      { url: V2_URL, heading: 'Effortless Bill Splitting, Simplified & Smart.' },
      { url: `${V2_URL}/pricing`, heading: 'Pricing', level: 1 },
    ];
    
    for (const { url, heading, level } of pages) {
      await page.goto(url);
      await waitForV2App(page);
      const selector = level 
        ? page.getByRole('heading', { name: heading, level })
        : page.getByRole('heading', { name: heading });
      await expect(selector).toBeVisible();
    }
    
    // No console errors
    expect(errors).toHaveLength(0);
  });
});
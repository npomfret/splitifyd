import { test, expect } from '@playwright/test';
import { EMULATOR_URL, waitForApp, setupConsoleErrorReporting } from '../helpers';
import { HomepagePage } from '../pages';

setupConsoleErrorReporting();

// Simplified performance test - just basic load time check
test.describe('Performance Tests', () => {
  test('should load within reasonable time', async ({ page }) => {
    
    const startTime = Date.now();
    const homepagePage = new HomepagePage(page);
    await homepagePage.navigate();
    await waitForApp(page);
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for emulator)
    expect(loadTime).toBeLessThan(5000);
    
    // No console errors
  });
});
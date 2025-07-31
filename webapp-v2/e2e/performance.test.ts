import { test, expect } from '@playwright/test';
import { EMULATOR_URL, waitForV2App, setupConsoleErrorReporting } from './helpers';

setupConsoleErrorReporting();

// Simplified performance test - just basic load time check
test.describe('Performance Tests', () => {
  test('should load within reasonable time', async ({ page }) => {
    
    const startTime = Date.now();
    await page.goto(EMULATOR_URL);
    await waitForV2App(page);
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for emulator)
    expect(loadTime).toBeLessThan(5000);
    
    // No console errors
  });
});
import { test, expect } from '@playwright/test';
import { V2_URL, waitForV2App, setupConsoleErrorListener } from './helpers';

// Simplified performance test - just basic load time check
test.describe('Performance Tests', () => {
  test('should load within reasonable time', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    const startTime = Date.now();
    await page.goto(V2_URL);
    await waitForV2App(page);
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for emulator)
    expect(loadTime).toBeLessThan(5000);
    
    // No console errors
    expect(errors).toHaveLength(0);
  });
});
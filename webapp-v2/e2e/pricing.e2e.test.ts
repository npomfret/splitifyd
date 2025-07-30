import { test, expect } from '@playwright/test';
import { V2_URL, waitForV2App, setupConsoleErrorReporting } from './helpers';

setupConsoleErrorReporting();

// Simplified E2E test for pricing page - just verify it loads without errors
test.describe('Pricing Page E2E', () => {
  test('should load pricing page without console errors', async ({ page }) => {
    
    await page.goto(`${V2_URL}/pricing`);
    await waitForV2App(page);
    
    // Basic smoke test - page loads with expected heading
    await expect(page.getByRole('heading', { name: 'Pricing', level: 1 })).toBeVisible();
    
    // No console errors
  });
});
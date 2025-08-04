import { test, expect } from '@playwright/test';
import { setupConsoleErrorReporting } from '../helpers';
import { PricingPage } from '../pages';

setupConsoleErrorReporting();

// Simplified E2E test for pricing page - just verify it loads without errors
test.describe('Pricing Page E2E', () => {
  test('should load pricing page without console errors', async ({ page }) => {
    const pricingPage = new PricingPage(page);
    
    await pricingPage.navigate();
    
    // Basic smoke test - page loads with expected heading
    await expect(page.getByRole('heading', { name: 'Pricing', level: 1 })).toBeVisible();
    
    // No console errors
  });
});
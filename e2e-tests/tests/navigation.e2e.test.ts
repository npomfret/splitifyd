import { test, expect } from '@playwright/test';
import { setupConsoleErrorReporting } from '../helpers';
import { HomepagePage, PricingPage } from '../pages';

setupConsoleErrorReporting();

// Simplified navigation tests - just verify pages load without errors
test.describe('Navigation E2E', () => {
  test('should load key pages without console errors', async ({ page }) => {
    const homepagePage = new HomepagePage(page);
    const pricingPage = new PricingPage(page);
    
    // Test homepage loads correctly
    await homepagePage.navigate();
    await expect(page.getByRole('heading', { name: 'Effortless Bill Splitting, Simplified & Smart.' })).toBeVisible();
    
    // Test pricing page loads correctly
    await pricingPage.navigate();
    await expect(page.getByRole('heading', { name: 'Pricing', level: 1 })).toBeVisible();
    
    // No console errors
  });
});
import { pageTest as test, expect } from '../fixtures/page-fixtures';
import { setupConsoleErrorReporting } from '../helpers';

setupConsoleErrorReporting();

// Simplified navigation tests - just verify pages load without errors
test.describe('Navigation E2E', () => {
  test('should load key pages without console errors', async ({ page, homepagePage, pricingPage }) => {
    
    // Test homepage loads correctly
    await homepagePage.navigate();
    await expect(page.getByRole('heading', { name: 'Effortless Bill Splitting, Simplified & Smart.' })).toBeVisible();
    
    // Test pricing page loads correctly
    await pricingPage.navigate();
    await expect(page.getByRole('heading', { name: 'Pricing', level: 1 })).toBeVisible();
    
    // No console errors
  });
});
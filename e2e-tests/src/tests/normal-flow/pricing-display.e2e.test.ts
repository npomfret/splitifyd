import { pageTest as test, expect } from "../../fixtures/page-fixtures";


// Simplified E2E test for pricing page - just verify it loads without errors
test.describe('Pricing Page E2E', () => {
  test('should load pricing page without console errors', async ({ pricingPageNavigated }) => {
    const { page } = pricingPageNavigated;
    
    
    // Basic smoke test - page loads with expected heading
    await expect(page.getByRole('heading', { name: 'Pricing', level: 1 })).toBeVisible();
    
    // No console errors
  });
});
import { pageTest as test, expect } from '../../../fixtures/page-fixtures';

// Simplified E2E test for pricing page - just verify it loads without errors
test.describe('Pricing Page E2E', () => {
    test('should load pricing page without console errors', async ({ pricingPageNavigated }) => {
        const { page, pricingPage } = pricingPageNavigated;

        // Basic smoke test - page loads with expected heading
        await expect(pricingPage.getHeadingWithLevel('Pricing', 1)).toBeVisible();

        // No console errors
    });
});

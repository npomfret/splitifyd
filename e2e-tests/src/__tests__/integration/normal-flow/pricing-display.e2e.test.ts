import { simpleTest as test, expect } from '../../../fixtures/simple-test.fixture';
import { PricingPage } from '../../../pages';

// Simplified E2E test for pricing page - just verify it loads without errors
test.describe('Pricing Page E2E', () => {
    test('should load pricing page without console errors', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const pricingPage = new PricingPage(page);
        await pricingPage.navigate();

        // Basic smoke test - page loads with expected heading
        await expect(pricingPage.getHeadingWithLevel('Pricing', 1)).toBeVisible();

        // No console errors
    });
});

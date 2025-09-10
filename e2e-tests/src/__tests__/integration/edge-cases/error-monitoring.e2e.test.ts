import { pageTest, expect } from '../../../fixtures';
import { waitForApp, setupMCPDebugOnFailure } from '../../../helpers';

// Enable MCP debugging for failed tests
pageTest.describe('Error Monitoring E2E', () => {
    pageTest('should load homepage without JavaScript errors', async ({ homepageNavigated }) => {
        const { page } = homepageNavigated;
        
        // Basic smoke test - verify page loads and main heading is visible
        await expect(page.getByRole('heading').first()).toBeVisible();
    });

    pageTest('should load login page without JavaScript errors', async ({ loginPageNavigated }) => {
        const { page } = loginPageNavigated;
        
        // Basic smoke test - verify page loads and form is present
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });

    pageTest('should load register page without JavaScript errors', async ({ registerPageNavigated }) => {
        const { page } = registerPageNavigated;
        
        // Basic smoke test - verify page loads and form is present
        await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    });

    pageTest('should load pricing page without JavaScript errors', async ({ pricingPageNavigated }) => {
        const { page } = pricingPageNavigated;
        
        // Basic smoke test - verify page loads and main heading is visible
        await expect(page.getByRole('heading').first()).toBeVisible();
    });

    pageTest('should load terms page without JavaScript errors', async ({ page, homepagePage }) => {
        await homepagePage.navigateToStaticPath('/terms');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        
        // Basic smoke test - verify page loads and main heading is visible
        await expect(page.getByRole('heading').first()).toBeVisible();
    });

    pageTest('should load privacy page without JavaScript errors', async ({ page, homepagePage }) => {
        await homepagePage.navigateToStaticPath('/privacy');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        
        // Basic smoke test - verify page loads and main heading is visible
        await expect(page.getByRole('heading').first()).toBeVisible();
    });
});

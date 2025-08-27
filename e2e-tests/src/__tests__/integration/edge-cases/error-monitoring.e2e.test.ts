import { pageTest } from '../../../fixtures';
import { waitForApp, setupMCPDebugOnFailure } from '../../../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

pageTest.describe('Error Monitoring E2E', () => {
    pageTest('should load homepage without JavaScript errors', async ({ homepageNavigated }) => {
        const { page } = homepageNavigated;
    });

    pageTest('should load login page without JavaScript errors', async ({ loginPageNavigated }) => {
        const { page } = loginPageNavigated;
    });

    pageTest('should load register page without JavaScript errors', async ({ registerPageNavigated }) => {
        const { page } = registerPageNavigated;
    });

    pageTest('should load pricing page without JavaScript errors', async ({ pricingPageNavigated }) => {
        const { page } = pricingPageNavigated;
    });

    pageTest('should load terms page without JavaScript errors', async ({ page, homepagePage }) => {
        await homepagePage.navigateToStaticPath('/terms');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    });

    pageTest('should load privacy page without JavaScript errors', async ({ page, homepagePage }) => {
        await homepagePage.navigateToStaticPath('/privacy');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    });
});

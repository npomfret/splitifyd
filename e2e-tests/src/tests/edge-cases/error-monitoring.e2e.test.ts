import { pageTest } from '../../fixtures/page-fixtures';
import { waitForApp, setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

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
  });

  pageTest('should load privacy page without JavaScript errors', async ({ page, homepagePage }) => {
    await homepagePage.navigateToStaticPath('/privacy');
    await waitForApp(page);
  });

});
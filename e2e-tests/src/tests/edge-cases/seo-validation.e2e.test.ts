import { pageTest as test, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting } from '../../helpers';

setupConsoleErrorReporting();

// Simplified SEO test - just verify pages have titles and no errors
test.describe('SEO E2E', () => {
  test('should set page titles without console errors', async ({ page, homepagePage, pricingPage }) => {
    
    // Check homepage title
    await homepagePage.navigate();
    const homeTitle = await page.title();
    expect(homeTitle).toContain('Splitifyd');
    
    // Check pricing page title
    await pricingPage.navigate();
    const pricingTitle = await page.title();
    expect(pricingTitle).toContain('Splitifyd');
    
    // No console errors
  });
});
import { test, expect } from '@playwright/test';
import { setupConsoleErrorReporting } from '../helpers';
import { HomepagePage, PricingPage } from '../pages';

setupConsoleErrorReporting();

// Simplified SEO test - just verify pages have titles and no errors
test.describe('SEO E2E', () => {
  test('should set page titles without console errors', async ({ page }) => {
    const homepagePage = new HomepagePage(page);
    const pricingPage = new PricingPage(page);
    
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
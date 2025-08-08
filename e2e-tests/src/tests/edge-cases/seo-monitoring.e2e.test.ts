import { pageTest, expect } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('SEO Monitoring E2E', () => {
  pageTest('should have proper meta tags for SEO', async ({ page, homepagePage }) => {
    await homepagePage.navigate();
    
    // Check for essential meta tags
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(10);
    
    // Check for description meta tag
    const description = await page.locator(SELECTORS.META_DESCRIPTION).getAttribute('content');
    expect(description).toBeTruthy();
    
    // Check for viewport meta tag (mobile responsiveness)
    const viewport = await page.locator(SELECTORS.META_VIEWPORT).getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });
});
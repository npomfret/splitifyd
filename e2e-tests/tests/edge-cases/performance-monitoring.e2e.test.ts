import { test } from '@playwright/test';
import { pageTest, expect } from '../../fixtures/page-fixtures';
import { waitForApp, setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';
import { TIMEOUTS } from '../../config/timeouts';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Performance Monitoring E2E', () => {
  pageTest('should load pages within acceptable time', async ({ page, homepagePage }) => {
    const startTime = Date.now();
    
    await homepagePage.navigate();
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for CI)
    expect(loadTime).toBeLessThan(5000);
  });

  pageTest('should maintain functionality with slow network', async ({ page, context, loginPage }) => {
    
    // Simulate slow 3G
    await context.route('**/*', route => {
      setTimeout(() => route.continue(), TIMEOUTS.QUICK / 5);
    });
    
    await loginPage.navigate();
    
    // Page should still be functional on slow network
    await waitForApp(page);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Form should be interactive
    const emailInput = page.locator(SELECTORS.EMAIL_INPUT);
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // No console errors
    // Console errors are automatically captured by setupConsoleErrorReporting
  });
});
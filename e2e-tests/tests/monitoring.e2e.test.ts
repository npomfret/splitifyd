import { test } from '@playwright/test';
import { pageTest, expect } from '../fixtures/page-fixtures';
import { waitForApp, setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { SELECTORS } from '../constants/selectors';
import { TIMEOUTS } from '../config/timeouts';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Performance and Error Monitoring E2E', () => {
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

  pageTest('should not have any 404 resources', async ({ page, homepagePage, loginPage, registerPage }) => {
    const failed404s: string[] = [];
    
    // Listen for failed requests
    page.on('response', response => {
      if (response.status() === 404) {
        failed404s.push(`${response.status()} - ${response.url()}`);
      }
    });

    // Visit main pages using page objects
    
    await homepagePage.navigate();
    await loginPage.navigate();
    await registerPage.navigate();
    
    // No 404s should have occurred
    expect(failed404s).toHaveLength(0);
  });

  pageTest('should load pages within acceptable time', async ({ page, homepagePage }) => {
    const startTime = Date.now();
    
    await homepagePage.navigate();
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for CI)
    expect(loadTime).toBeLessThan(5000);
  });

  pageTest('should handle network errors gracefully', async ({ page, context, loginPage }) => {
    test.info().annotations.push({ type: 'skip-error-checking' });
    // Block API calls to simulate network failure
    await context.route('**/api/**', route => route.abort());
    
    // Try to load login page (which might make API calls)
    await loginPage.navigate();
    
    // Page should still render even if API calls fail
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Should not have unhandled errors (handled network errors are ok)
    // This is a basic check - app should handle network failures gracefully
  });

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

  pageTest('should not expose sensitive information in console', async ({ page, loginPage, registerPage }) => {
    const consoleLogs: string[] = [];
    
    // Capture all console messages
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });
    
    // Navigate through auth pages using page objects
    
    await loginPage.navigate();
    await registerPage.navigate();
    
    // Check logs don't contain sensitive patterns
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /api[_-]?key/i,
      /secret/i,
      /credential/i
    ];
    
    const sensitiveLogs = consoleLogs.filter(log => 
      sensitivePatterns.some(pattern => pattern.test(log))
    );
    
    // Should not log sensitive information
    expect(sensitiveLogs).toHaveLength(0);
  });

  pageTest('should handle rapid navigation without errors', async ({ page, homepagePage, loginPage, registerPage }) => {
    
    // Rapidly navigate between pages using page objects
    
    for (let i = 0; i < 5; i++) {
      await loginPage.navigate();
      await registerPage.navigate();
      await homepagePage.navigate();
    }
    
    // Final page should load correctly
    await waitForApp(page);
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // No console errors from rapid navigation
    // Console errors are automatically captured by setupConsoleErrorReporting
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
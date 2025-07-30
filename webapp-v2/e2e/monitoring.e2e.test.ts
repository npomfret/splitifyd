import { test, expect } from '@playwright/test';
import { V2_URL, waitForV2App, setupConsoleErrorReporting, setupMCPDebugOnFailure } from './helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Performance and Error Monitoring E2E', () => {
  test('should load all pages without JavaScript errors', async ({ page }) => {
    const pagesToTest = [
      { path: '', name: 'Homepage' },
      { path: '/login', name: 'Login' },
      { path: '/register', name: 'Register' },
      { path: '/pricing', name: 'Pricing' },
      { path: '/terms', name: 'Terms' },
      { path: '/privacy', name: 'Privacy' }
    ];

    for (const pageInfo of pagesToTest) {
      
      await page.goto(`${V2_URL}${pageInfo.path}`);
      await waitForV2App(page);
      
      // Check for any console errors
    }
  });

  test('should not have any 404 resources', async ({ page }) => {
    const failed404s: string[] = [];
    
    // Listen for failed requests
    page.on('response', response => {
      if (response.status() === 404) {
        failed404s.push(`${response.status()} - ${response.url()}`);
      }
    });

    // Visit main pages
    await page.goto(V2_URL);
    await waitForV2App(page);
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    await page.goto(`${V2_URL}/register`);
    await waitForV2App(page);
    
    // No 404s should have occurred
    expect(failed404s).toHaveLength(0);
  });

  test('should load pages within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(V2_URL);
    await waitForV2App(page);
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for CI)
    expect(loadTime).toBeLessThan(5000);
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    // Block API calls to simulate network failure
    await context.route('**/api/**', route => route.abort());
    
    // Try to load login page (which might make API calls)
    await page.goto(`${V2_URL}/login`);
    
    // Page should still render even if API calls fail
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Should not have unhandled errors (handled network errors are ok)
    // This is a basic check - app should handle network failures gracefully
  });

  test('should have proper meta tags for SEO', async ({ page }) => {
    await page.goto(V2_URL);
    await waitForV2App(page);
    
    // Check for essential meta tags
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(10);
    
    // Check for description meta tag
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    
    // Check for viewport meta tag (mobile responsiveness)
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('should not expose sensitive information in console', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    // Capture all console messages
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });
    
    // Navigate through auth pages
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    await page.goto(`${V2_URL}/register`);
    await waitForV2App(page);
    
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

  test('should handle rapid navigation without errors', async ({ page }) => {
    
    // Rapidly navigate between pages
    for (let i = 0; i < 5; i++) {
      await page.goto(`${V2_URL}/login`);
      await page.goto(`${V2_URL}/register`);
      await page.goto(V2_URL);
    }
    
    // Final page should load correctly
    await waitForV2App(page);
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // No console errors from rapid navigation
    // Console errors are automatically captured by setupConsoleErrorReporting
  });

  test('should maintain functionality with slow network', async ({ page, context }) => {
    
    // Simulate slow 3G
    await context.route('**/*', route => {
      setTimeout(() => route.continue(), 100);
    });
    
    await page.goto(`${V2_URL}/login`);
    
    // Page should still be functional on slow network
    await waitForV2App(page);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Form should be interactive
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // No console errors
    // Console errors are automatically captured by setupConsoleErrorReporting
  });
});
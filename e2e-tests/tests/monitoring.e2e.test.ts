import { test, expect } from '@playwright/test';
import { waitForApp, setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { HomepagePage, LoginPage, RegisterPage, PricingPage } from '../pages';

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

    const homepagePage = new HomepagePage(page);
    const loginPage = new LoginPage(page);
    const registerPage = new RegisterPage(page);
    const pricingPage = new PricingPage(page);

    for (const pageInfo of pagesToTest) {
      
      // Navigate using page objects
      if (pageInfo.path === '') {
        await homepagePage.navigate();
      } else if (pageInfo.path === '/login') {
        await loginPage.navigate();
      } else if (pageInfo.path === '/register') {
        await registerPage.navigate();
      } else if (pageInfo.path === '/pricing') {
        await pricingPage.navigate();
      } else {
        // For static pages (terms, privacy), use base navigation
        await homepagePage.navigateToHomepage();
        await page.goto(page.url() + pageInfo.path);
        await waitForApp(page);
      }
      
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

    // Visit main pages using page objects
    const homepagePage = new HomepagePage(page);
    const loginPage = new LoginPage(page);
    const registerPage = new RegisterPage(page);
    
    await homepagePage.navigate();
    await loginPage.navigate();
    await registerPage.navigate();
    
    // No 404s should have occurred
    expect(failed404s).toHaveLength(0);
  });

  test('should load pages within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    const homepagePage = new HomepagePage(page);
    await homepagePage.navigate();
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for CI)
    expect(loadTime).toBeLessThan(5000);
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    test.info().annotations.push({ type: 'skip-error-checking' });
    // Block API calls to simulate network failure
    await context.route('**/api/**', route => route.abort());
    
    // Try to load login page (which might make API calls)
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    
    // Page should still render even if API calls fail
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Should not have unhandled errors (handled network errors are ok)
    // This is a basic check - app should handle network failures gracefully
  });

  test('should have proper meta tags for SEO', async ({ page }) => {
    const homepagePage = new HomepagePage(page);
    await homepagePage.navigate();
    
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
    
    // Navigate through auth pages using page objects
    const loginPage = new LoginPage(page);
    const registerPage = new RegisterPage(page);
    
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

  test('should handle rapid navigation without errors', async ({ page }) => {
    
    // Rapidly navigate between pages using page objects
    const homepagePage = new HomepagePage(page);
    const loginPage = new LoginPage(page);
    const registerPage = new RegisterPage(page);
    
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

  test('should maintain functionality with slow network', async ({ page, context }) => {
    
    // Simulate slow 3G
    await context.route('**/*', route => {
      setTimeout(() => route.continue(), 100);
    });
    
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    
    // Page should still be functional on slow network
    await waitForApp(page);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Form should be interactive
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // No console errors
    // Console errors are automatically captured by setupConsoleErrorReporting
  });
});
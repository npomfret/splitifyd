import { test, expect } from '@playwright/test';
import { V2_URL, waitForEmulator, waitForV2App, setupConsoleErrorListener } from './helpers';

// E2E tests for navigation flows - critical user journeys
test.describe('Navigation E2E', () => {
  test('should navigate between static pages successfully', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    // Start at v2 home page
    await page.goto(V2_URL);
    await waitForEmulator(page);
    await waitForV2App(page);
    
    await expect(page).toHaveTitle(/Splitifyd/);
    await expect(page.getByRole('heading', { name: 'Effortless Bill Splitting, Simplified & Smart.', level: 1 })).toBeVisible();
    
    // Navigate to pricing page
    await page.getByRole('link', { name: 'Login' }).hover();
    await page.getByRole('link', { name: 'Sign Up' }).hover();
    
    // Note: In a real app, we'd click navigation links, but these don't exist on home page
    // Instead, test direct navigation
    await page.goto(`${V2_URL}/pricing`);
    await waitForEmulator(page);
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByText('Simple, Transparent Pricing')).toBeVisible();
    
    // Navigate to terms page
    await page.goto('/terms-of-service');
    await waitForEmulator(page);
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
    
    // Navigate to privacy page
    await page.goto('/privacy-policy');
    await waitForEmulator(page);
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    
    // Navigate to cookies page
    await page.goto('/cookies-policy');
    await waitForEmulator(page);
    await expect(page.getByRole('heading', { name: 'Cookie Policy' })).toBeVisible();
    
    // Check for console errors
    expect(await errors).toHaveLength(0);
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(`${V2_URL}/non-existent-page`);
    await waitForEmulator(page);
    
    // Check for 404 page content - v2 app may show the home page for non-existent routes
    // or display a 404 message
    const has404 = await page.getByRole('heading', { name: '404' }).isVisible().catch(() => false);
    if (has404) {
      await expect(page.getByText('Page not found')).toBeVisible();
      // Should provide way back home
      const goHomeLink = page.getByRole('link', { name: 'Go Home' });
      await expect(goHomeLink).toBeVisible();
      
      await goHomeLink.click();
      await waitForEmulator(page);
      await expect(page.getByRole('heading', { name: 'Effortless Bill Splitting, Simplified & Smart.', level: 1 })).toBeVisible();
    } else {
      // v2 app shows home page for non-existent routes
      await expect(page.getByRole('heading', { name: 'Effortless Bill Splitting, Simplified & Smart.', level: 1 })).toBeVisible();
    }
    
    // Check for console errors
    expect(await errors).toHaveLength(0);
  });

  test('should have consistent header navigation on static pages', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto('/pricing');
    await waitForEmulator(page);
    
    // Check for header navigation (logo and pricing links)
    await expect(page.getByRole('link', { name: 'Splitifyd' }).first()).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Pricing' })).toBeVisible();
    
    // Click home link (it's actually the Splitifyd logo link)
    await page.getByRole('link', { name: 'Splitifyd' }).first().click();
    await waitForEmulator(page);
    await expect(page.getByRole('heading', { name: 'Effortless Bill Splitting, Simplified & Smart.', level: 1 })).toBeVisible();
    
    // Check for console errors
    expect(await errors).toHaveLength(0);
  });

  test('should have functional footer links on static pages', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto('/pricing');
    await waitForEmulator(page);
    
    // Check footer legal links
    const termsLink = page.getByRole('link', { name: 'Terms of Service' });
    const privacyLink = page.getByRole('link', { name: 'Privacy Policy' });
    const cookieLink = page.getByRole('link', { name: 'Cookie Policy' });
    
    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
    await expect(cookieLink).toBeVisible();
    
    // Test one of the footer links
    await termsLink.click();
    await waitForEmulator(page);
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
    
    // Check for console errors
    expect(await errors).toHaveLength(0);
  });

  test('should display consistent branding across pages', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    const pages = [V2_URL, '/pricing', '/terms-of-service', '/privacy-policy', '/cookies-policy'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await waitForEmulator(page);
      
      // Should have Splitifyd branding
      const splitifydText = page.getByText('Splitifyd').first();
      await expect(splitifydText).toBeVisible();
      
      // Check page title
      await expect(page).toHaveTitle(/Splitifyd/);
    }
    
    // Check for console errors
    expect(await errors).toHaveLength(0);
  });
});
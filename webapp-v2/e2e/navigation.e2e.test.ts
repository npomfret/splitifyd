import { test, expect } from '@playwright/test';

// E2E tests for navigation flows - critical user journeys
test.describe('Navigation E2E', () => {
  test('should navigate between static pages successfully', async ({ page }) => {
    // Start at home page
    await page.goto('/');
    
    await expect(page).toHaveTitle(/Splitifyd/);
    await expect(page.getByRole('heading', { name: 'Welcome to Splitifyd v2' })).toBeVisible();
    
    // Navigate to pricing page
    await page.getByRole('link', { name: 'Login' }).hover();
    await page.getByRole('link', { name: 'Sign Up' }).hover();
    
    // Note: In a real app, we'd click navigation links, but these don't exist on home page
    // Instead, test direct navigation
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByText('Simple, Transparent Pricing')).toBeVisible();
    
    // Navigate to terms page
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
    
    // Navigate to privacy page
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    
    // Navigate to cookies page
    await page.goto('/cookies');
    await expect(page.getByRole('heading', { name: 'Cookie Policy' })).toBeVisible();
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByText('Page not found')).toBeVisible();
    
    // Should provide way back home
    const goHomeLink = page.getByRole('link', { name: 'Go Home' });
    await expect(goHomeLink).toBeVisible();
    
    await goHomeLink.click();
    await expect(page.getByRole('heading', { name: 'Welcome to Splitifyd v2' })).toBeVisible();
  });

  test('should have consistent header navigation on static pages', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check for header navigation
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
    
    // Click home link
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to Splitifyd v2' })).toBeVisible();
  });

  test('should have functional footer links on static pages', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check footer legal links
    const termsLink = page.getByRole('link', { name: 'Terms of Service' });
    const privacyLink = page.getByRole('link', { name: 'Privacy Policy' });
    const cookieLink = page.getByRole('link', { name: 'Cookie Policy' });
    
    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
    await expect(cookieLink).toBeVisible();
    
    // Test one of the footer links
    await termsLink.click();
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  });

  test('should display consistent branding across pages', async ({ page }) => {
    const pages = ['/', '/pricing', '/terms', '/privacy', '/cookies'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      
      // Should have Splitifyd branding
      const splitifydText = page.getByText('Splitifyd').first();
      await expect(splitifydText).toBeVisible();
      
      // Check page title
      await expect(page).toHaveTitle(/Splitifyd/);
    }
  });
});
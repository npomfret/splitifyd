import { test, expect } from '@playwright/test';

// E2E tests for SEO functionality - testing actual browser behavior
test.describe('SEO E2E', () => {
  test('should set correct page titles for all pages', async ({ page }) => {
    const pages = [
      { path: '/', title: /Welcome to Splitifyd v2.*Splitifyd/ },
      { path: '/pricing', title: /Pricing.*Splitifyd/ },
      { path: '/terms', title: /Terms of Service.*Splitifyd/ },
      { path: '/privacy', title: /Privacy Policy.*Splitifyd/ },
      { path: '/cookies', title: /Cookie Policy.*Splitifyd/ },
    ];
    
    for (const { path, title } of pages) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
    }
  });

  test('should have proper meta description tags', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check that meta description is set
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /Simple, transparent pricing/);
  });

  test('should have Open Graph tags for social sharing', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check Open Graph meta tags
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Pricing.*Splitifyd/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Splitifyd');
  });

  test('should have Twitter Card tags', async ({ page }) => {
    await page.goto('/pricing');
    
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /Pricing.*Splitifyd/);
  });

  test('should have structured data for pricing page', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check for structured data script
    const structuredDataScript = page.locator('script[type="application/ld+json"]');
    await expect(structuredDataScript).toBeAttached();
    
    // Verify structured data content
    const structuredDataContent = await structuredDataScript.textContent();
    expect(structuredDataContent).toBeTruthy();
    
    const structuredData = JSON.parse(structuredDataContent!);
    expect(structuredData['@context']).toBe('https://schema.org');
    expect(structuredData['@type']).toBe('WebPage');
  });

  test('should set canonical URLs correctly', async ({ page }) => {
    await page.goto('/pricing');
    
    const canonicalLink = page.locator('link[rel="canonical"]');
    await expect(canonicalLink).toHaveAttribute('href', 'https://splitifyd.com/v2/pricing');
  });

  test('should handle 404 page SEO correctly', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    // 404 pages should still have proper meta tags
    await expect(page).toHaveTitle(/404.*Splitifyd/);
    
    // Should not have canonical URL for 404 pages
    const canonicalLink = page.locator('link[rel="canonical"]');
    await expect(canonicalLink).not.toBeAttached();
  });

  test('should update page title dynamically when navigating', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Welcome to Splitifyd v2.*Splitifyd/);
    
    await page.goto('/pricing');
    await expect(page).toHaveTitle(/Pricing.*Splitifyd/);
    
    await page.goto('/terms');
    await expect(page).toHaveTitle(/Terms of Service.*Splitifyd/);
  });
});
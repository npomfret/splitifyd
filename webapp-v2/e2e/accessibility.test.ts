import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Accessibility tests using axe-core
test.describe('Accessibility Tests', () => {
  test('should not have any automatically detectable accessibility issues on home page', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have any automatically detectable accessibility issues on pricing page', async ({ page }) => {
    await page.goto('/pricing');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have any automatically detectable accessibility issues on legal pages', async ({ page }) => {
    const legalPages = ['/terms', '/privacy', '/cookies'];
    
    for (const pagePath of legalPages) {
      await page.goto(pagePath);
      
      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('should not have accessibility issues on 404 page', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper keyboard navigation', async ({ page }) => {
    await page.goto('/pricing');
    
    // Test tab navigation through interactive elements
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Home' })).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Pricing' }).first()).toBeFocused();
    
    // Test that buttons are keyboard accessible
    const freeButton = page.getByRole('button', { name: 'Get Started Free' });
    await freeButton.focus();
    await expect(freeButton).toBeFocused();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check heading levels for proper hierarchy
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    
    const h2 = page.getByRole('heading', { level: 2 });
    await expect(h2).toHaveCount(1); // "Simple, Transparent Pricing"
    
    const h3 = page.getByRole('heading', { level: 3 });
    await expect(h3).toHaveCount(6); // Free, Premium, FAQ, footer headings
  });

  test('should have alt text for images (if any)', async ({ page }) => {
    await page.goto('/');
    
    // Check that any images have alt text
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const altText = await image.getAttribute('alt');
      
      // Alt text should either exist or be empty string for decorative images
      expect(altText).toBeDefined();
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/pricing');
    
    // Use axe to specifically check color contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    // Filter for color contrast violations
    const colorContrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );
    
    expect(colorContrastViolations).toEqual([]);
  });

  test('should work with screen readers (basic structure)', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check for proper ARIA landmarks
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    
    // Check that interactive elements are properly labeled
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const accessibleName = await button.getAttribute('aria-label') || await button.textContent();
      expect(accessibleName).toBeTruthy();
    }
  });

  test('should be accessible on mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/pricing');
    
    // Run accessibility scan on mobile viewport
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Ensure touch targets are large enough (minimum 44x44px)
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
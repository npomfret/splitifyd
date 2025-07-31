import {expect, test} from '@playwright/test';
import {HOSTING_PORT, setupConsoleErrorReporting, setupMCPDebugOnFailure, EMULATOR_URL, waitForApp} from './helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Homepage E2E', () => {
  test('should load homepage with all key elements', async ({ page }) => {
    
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Verify main heading
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // Verify navigation links
    await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign Up', exact: true })).toBeVisible();
    
    // No console errors
  });

  test('should navigate to pricing page from homepage', async ({ page }) => {
    
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Click pricing link
    await page.getByRole('link', { name: 'Pricing' }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    
    // No console errors
  });

  test('should navigate to login from homepage header', async ({ page }) => {
    
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Click login link in header
    await page.getByRole('link', { name: 'Login' }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // No console errors
  });

  test('should navigate to register from homepage header', async ({ page }) => {
    
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Click sign up link in header (exact match to avoid ambiguity)
    await page.getByRole('link', { name: 'Sign Up', exact: true }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    
    // No console errors
  });

  test('should have working footer links', async ({ page }) => {
    
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Check footer exists
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    
    // Check terms link
    const termsLink = footer.getByRole('link', { name: 'Terms' });
    await expect(termsLink).toBeVisible();
    
    // Check privacy link
    const privacyLink = footer.getByRole('link', { name: 'Privacy' });
    await expect(privacyLink).toBeVisible();
    
    // No console errors
  });

  test('should scroll to pricing section if exists', async ({ page }) => {
    
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Look for pricing section on homepage
    const pricingSection = page.locator('#pricing').or(page.locator('[data-section="pricing"]'));
    
    // If pricing section exists on homepage, check if it's visible after scroll
    const sectionExists = await pricingSection.count() > 0;
    if (sectionExists) {
      await pricingSection.scrollIntoViewIfNeeded();
      await expect(pricingSection).toBeInViewport();
    }
    
    // No console errors
  });

  test('should have responsive navigation on mobile', async ({ page }) => {
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Check if mobile menu exists (hamburger icon)
    const mobileMenuButton = page.getByRole('button', { name: /menu/i }).or(
      page.locator('[aria-label*="menu"]').or(
        page.locator('.hamburger, .mobile-menu-toggle')
      )
    );
    
    // If mobile menu exists, it should be visible
    const hasMobileMenu = await mobileMenuButton.count() > 0;
    if (hasMobileMenu) {
      await expect(mobileMenuButton).toBeVisible();
    }
    
    // Main heading should still be visible on mobile
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // No console errors
  });

  test('should handle logo click navigation', async ({ page }) => {
    
    // Start from a different page
    await page.goto(`http://localhost:${HOSTING_PORT}/pricing`);
    await waitForApp(page);
    
    // Click on logo/home link
    const logoLink = page.getByRole('link', { name: /splitifyd|home/i }).first();
    await logoLink.click();
    
    // Should be back on homepage
    await expect(page).toHaveURL(EMULATOR_URL);
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // No console errors
  });
});
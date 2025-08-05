
import { pageTest as test, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, EMULATOR_URL } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Homepage E2E', () => {
  test('should load homepage with all key elements', async ({ homepageNavigated }) => {
    const { page } = homepageNavigated;
    
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

  test('should navigate to pricing page from homepage', async ({ homepageNavigated }) => {
    const { page } = homepageNavigated;
    
    // Click pricing link
    await page.getByRole('link', { name: 'Pricing' }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    
    // No console errors
  });

  test('should navigate to login from homepage header', async ({ homepageNavigated }) => {
    const { page } = homepageNavigated;
    
    // Click login link in header
    await page.getByRole('link', { name: 'Login' }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // No console errors
  });

  test('should navigate to register from homepage header', async ({ homepageNavigated }) => {
    const { page } = homepageNavigated;
    
    // Click sign up link in header (exact match to avoid ambiguity)
    await page.getByRole('link', { name: 'Sign Up', exact: true }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    
    // No console errors
  });

  test('should have working footer links', async ({ homepageNavigated }) => {
    const { page } = homepageNavigated;
    
    // Check footer exists
    const footer = page.locator(SELECTORS.FOOTER);
    await expect(footer).toBeVisible();
    
    // Check terms link
    const termsLink = footer.getByRole('link', { name: 'Terms' });
    await expect(termsLink).toBeVisible();
    
    // Check privacy link
    const privacyLink = footer.getByRole('link', { name: 'Privacy' });
    await expect(privacyLink).toBeVisible();
    
    // No console errors
  });

  test('should handle logo click navigation', async ({ page, pricingPage }) => {
    // Start from a different page
    
    await pricingPage.navigate();
    
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
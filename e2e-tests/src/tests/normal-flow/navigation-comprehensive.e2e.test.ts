import { pageTest as test, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, EMULATOR_URL } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Comprehensive Navigation E2E', () => {
  test('should navigate between all main pages', async ({ page, homepagePage, loginPage, registerPage, pricingPage }) => {
    // Start from homepage
    await homepagePage.navigate();
    
    // Verify homepage loads with key elements
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign Up', exact: true })).toBeVisible();
    
    // Navigate to Pricing
    await page.getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    
    // Navigate to Login from header
    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Navigate back to home via logo
    await page.getByAltText('Splitifyd').click();
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // Navigate to Register
    await page.getByRole('link', { name: 'Sign Up', exact: true }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    
    // Test logo navigation from pricing page
    await pricingPage.navigate();
    const logoLink = page.getByRole('link', { name: /splitifyd|home/i }).first();
    await logoLink.click();
    await expect(page).toHaveURL(EMULATOR_URL);
  });

  test('should navigate to static pages from footer', async ({ page, loginPage }) => {
    await loginPage.navigate();
    
    // Navigate to Terms
    await page.getByRole('link', { name: 'Terms' }).click();
    await expect(page).toHaveURL(/\/terms/);
    
    // Navigate back to login
    await loginPage.navigate();
    
    // Navigate to Privacy
    await page.getByRole('link', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(/\/privacy/);
  });

  test('should verify footer links exist on homepage', async ({ page, homepagePage }) => {
    await homepagePage.navigate();
    
    // Check footer exists and has required links
    const footer = page.locator(SELECTORS.FOOTER);
    await expect(footer).toBeVisible();
    
    const termsLink = footer.getByRole('link', { name: 'Terms' });
    await expect(termsLink).toBeVisible();
    
    const privacyLink = footer.getByRole('link', { name: 'Privacy' });
    await expect(privacyLink).toBeVisible();
  });
});
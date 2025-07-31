import { test, expect } from '@playwright/test';
import { EMULATOR_URL, waitForApp, setupConsoleErrorReporting, setupMCPDebugOnFailure } from './helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Static Pages E2E', () => {
  test('should navigate to terms of service', async ({ page }) => {
    
    await page.goto(`${EMULATOR_URL}/login`);
    await waitForApp(page);
    
    // Click Terms link in footer
    await page.getByRole('link', { name: 'Terms' }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/terms/);
    
    // No console errors
  });

  test('should navigate to privacy policy', async ({ page }) => {
    
    await page.goto(`${EMULATOR_URL}/login`);
    await waitForApp(page);
    
    // Click Privacy link in footer
    await page.getByRole('link', { name: 'Privacy' }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/privacy/);
    
    // No console errors
  });

  test('should navigate from login back to home', async ({ page }) => {
    
    await page.goto(`${EMULATOR_URL}/login`);
    await waitForApp(page);
    
    // Click logo to go back to home (logo serves as home link)
    await page.getByAltText('Splitifyd').click();
    
    // Verify we're on home page with main heading
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // No console errors
  });

  test('should have working links on homepage', async ({ page }) => {
    
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Test Login link
    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/login/);
    
    // Go back to home
    await page.goto(EMULATOR_URL);
    await waitForApp(page);
    
    // Test Sign Up link (use exact match to avoid ambiguity)
    await page.getByRole('link', { name: 'Sign Up', exact: true }).click();
    await expect(page).toHaveURL(/\/register/);
    
    // No console errors
  });
});
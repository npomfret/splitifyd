import { test, expect } from '@playwright/test';
import { V2_URL, waitForV2App, setupConsoleErrorListener } from './helpers';

test.describe('Static Pages E2E', () => {
  test('should navigate to terms of service', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Click Terms link in footer
    await page.getByRole('link', { name: 'Terms' }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/terms/);
    
    // No console errors
    expect(errors).toHaveLength(0);
  });

  test('should navigate to privacy policy', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Click Privacy link in footer
    await page.getByRole('link', { name: 'Privacy' }).click();
    
    // Verify navigation
    await expect(page).toHaveURL(/\/privacy/);
    
    // No console errors
    expect(errors).toHaveLength(0);
  });

  test('should navigate from login back to home', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Click Back to Home link
    await page.getByRole('link', { name: 'Back to Home' }).click();
    
    // Verify we're on home page with main heading
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // No console errors
    expect(errors).toHaveLength(0);
  });

  test('should have working links on homepage', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(V2_URL);
    await waitForV2App(page);
    
    // Test Login link
    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/login/);
    
    // Go back to home
    await page.goto(V2_URL);
    await waitForV2App(page);
    
    // Test Sign Up link (use exact match to avoid ambiguity)
    await page.getByRole('link', { name: 'Sign Up', exact: true }).click();
    await expect(page).toHaveURL(/\/register/);
    
    // No console errors
    expect(errors).toHaveLength(0);
  });
});
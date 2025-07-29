import { test, expect } from '@playwright/test';
import { V2_URL, waitForV2App, setupConsoleErrorListener } from './helpers';

test.describe('Auth Flow E2E', () => {
  test('should navigate between login and register pages', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    // Go to login page
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Verify login page loaded
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    
    // Click "Sign up" link
    await page.getByRole('link', { name: 'Sign up' }).click();
    
    // Verify register page loaded
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    
    // Click "Sign in" link
    await page.getByRole('link', { name: 'Sign in' }).click();
    
    // Back on login page
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // No console errors
    expect(errors).toHaveLength(0);
  });

  test('should show form fields on login page', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Verify form fields are present
    await expect(page.getByText('Email address *')).toBeVisible();
    await expect(page.getByText('Password *')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    
    // No console errors
    expect(errors).toHaveLength(0);
  });

  test('should show form fields on register page', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(`${V2_URL}/register`);
    await waitForV2App(page);
    
    // Verify form fields are present
    await expect(page.getByText('Full Name *')).toBeVisible();
    await expect(page.getByText('Email address *')).toBeVisible();
    await expect(page.getByText('Password *', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm Password *')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    
    // No console errors
    expect(errors).toHaveLength(0);
  });
});
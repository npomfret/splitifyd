import { test, expect } from '@playwright/test';
import { V2_URL, waitForV2App, setupConsoleErrorReporting, setupMCPDebugOnFailure } from './helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Auth Flow E2E', () => {
  test('should navigate between login and register pages', async ({ page }) => {
    
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
  });

  test('should show form fields on login page', async ({ page }) => {
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Verify form fields are present
    await expect(page.getByText('Email address *')).toBeVisible();
    await expect(page.getByText('Password *')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should show form fields on register page', async ({ page }) => {
    
    await page.goto(`${V2_URL}/register`);
    await waitForV2App(page);
    
    // Verify form fields are present
    await expect(page.getByText('Full Name *')).toBeVisible();
    await expect(page.getByText('Email address *')).toBeVisible();
    await expect(page.getByText('Password *', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm Password *')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('should disable submit button with empty form on login', async ({ page }) => {
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Clear any pre-filled data
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.clear();
    await passwordInput.clear();
    
    // The Sign In button should be disabled when form is empty
    const submitButton = page.getByRole('button', { name: 'Sign In' });
    await expect(submitButton).toBeDisabled();
    
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle empty form submission on register', async ({ page }) => {
    
    await page.goto(`${V2_URL}/register`);
    await waitForV2App(page);
    
    // The Create Account button should be disabled when form is empty
    const submitButton = page.getByRole('button', { name: 'Create Account' });
    await expect(submitButton).toBeDisabled();
    
    // Should still be on register page
    await expect(page).toHaveURL(/\/register/);
    
    // Form fields should still be visible
    await expect(page.getByText('Full Name *')).toBeVisible();
    await expect(page.getByText('Email address *')).toBeVisible();
  });

  test('should allow typing in login form fields', async ({ page }) => {
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Find and fill email input
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // Find and fill password input
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('TestPassword123');
    await expect(passwordInput).toHaveValue('TestPassword123');
  });

  test('should allow typing in register form fields', async ({ page }) => {
    
    await page.goto(`${V2_URL}/register`);
    await waitForV2App(page);
    
    // Find and fill name input
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('Test User');
    await expect(nameInput).toHaveValue('Test User');
    
    // Find and fill email input
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // Find and fill password inputs
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill('TestPassword123');
    await expect(passwordInputs.first()).toHaveValue('TestPassword123');
    
    await passwordInputs.last().fill('TestPassword123');
    await expect(passwordInputs.last()).toHaveValue('TestPassword123');
  });

  test('should show forgot password link on login page', async ({ page }) => {
    
    await page.goto(`${V2_URL}/login`);
    await waitForV2App(page);
    
    // Check for forgot password link
    const forgotPasswordLink = page.getByRole('link', { name: /forgot.*password/i });
    await expect(forgotPasswordLink).toBeVisible();
    
    // Click it and verify navigation
    await forgotPasswordLink.click();
    
    // Should navigate away from login page
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
import { test, expect } from '@playwright/test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { LoginPage, RegisterPage } from '../pages';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Auth Flow E2E', () => {
  test('should navigate between login and register pages', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Go to login page
    await loginPage.navigate();
    
    // Verify login page loaded
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    
    // Click "Sign up" link
    await loginPage.clickSignUp();
    
    // Verify register page loaded
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    
    // Click "Sign in" link using page object method
    await page.getByRole('link', { name: 'Sign in' }).click();
    
    // Back on login page
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('should show form fields on login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.navigate();
    
    // Verify form fields are present
    await expect(page.getByText('Email address *')).toBeVisible();
    await expect(page.getByText('Password *')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should show form fields on register page', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    
    await registerPage.navigate();
    
    // Verify form fields are present
    await expect(page.getByText('Full Name *')).toBeVisible();
    await expect(page.getByText('Email address *')).toBeVisible();
    await expect(page.getByText('Password *', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm Password *')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('should disable submit button with empty form on login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.navigate();
    
    // Clear any pre-filled data using page object methods
    const emailInput = loginPage.getEmailInput();
    const passwordInput = loginPage.getPasswordInput();
    await emailInput.clear();
    await passwordInput.clear();
    
    // The Sign In button should be disabled when form is empty
    const submitButton = loginPage.getSubmitButton();
    await expect(submitButton).toBeDisabled();
    
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle empty form submission on register', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    
    await registerPage.navigate();
    
    // The Create Account button should be disabled when form is empty
    const submitButton = registerPage.getSubmitButton();
    await expect(submitButton).toBeDisabled();
    
    // Should still be on register page
    await expect(page).toHaveURL(/\/register/);
    
    // Form fields should still be visible
    await expect(page.getByText('Full Name *')).toBeVisible();
    await expect(page.getByText('Email address *')).toBeVisible();
  });

  test('should allow typing in login form fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.navigate();
    
    // Find and fill email input using page object methods
    const emailInput = loginPage.getEmailInput();
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // Find and fill password input using page object methods
    const passwordInput = loginPage.getPasswordInput();
    await passwordInput.fill('TestPassword123');
    await expect(passwordInput).toHaveValue('TestPassword123');
  });

  test('should allow typing in register form fields', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    
    await registerPage.navigate();
    
    // Find and fill name input using page object methods
    const nameInput = registerPage.getFullNameInput();
    await nameInput.fill('Test User');
    await expect(nameInput).toHaveValue('Test User');
    
    // Find and fill email input using page object methods
    const emailInput = registerPage.getEmailInput();
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // Find and fill password inputs using page object methods
    const passwordInput = registerPage.getPasswordInput();
    await passwordInput.fill('TestPassword123');
    await expect(passwordInput).toHaveValue('TestPassword123');
    
    const confirmPasswordInput = registerPage.getConfirmPasswordInput();
    await confirmPasswordInput.fill('TestPassword123');
    await expect(confirmPasswordInput).toHaveValue('TestPassword123');
  });

  test('should show forgot password link on login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    await loginPage.navigate();
    
    // Check for forgot password link
    const forgotPasswordLink = page.getByRole('link', { name: /forgot.*password/i });
    await expect(forgotPasswordLink).toBeVisible();
    
    // Click it and verify navigation
    await loginPage.clickForgotPassword();
    
    // Should navigate away from login page
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
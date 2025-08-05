import { pageTest, expect } from '../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Auth Flow E2E', () => {
  pageTest('should navigate between login and register pages', async ({ page, loginPage, registerPage }) => {

    // Go to login page
    await loginPage.navigate();
    
    // Verify login page loaded
    await expect(loginPage.getSignInHeading()).toBeVisible();
    await expect(loginPage.getSubmitButton()).toBeVisible();
    
    // Click "Sign up" link
    await loginPage.clickSignUp();
    
    // Verify register page loaded
    await expect(registerPage.getCreateAccountHeading()).toBeVisible();
    await expect(registerPage.getSubmitButton()).toBeVisible();
    
    // Click "Sign in" link using page object method
    await registerPage.getSignInLink().click();
    
    // Back on login page
    await expect(loginPage.getSignInHeading()).toBeVisible();
  });

  pageTest('should show form fields on login page', async ({ loginPageNavigated }) => {
    const { loginPage } = loginPageNavigated;
    
    // Verify form fields are present
    await expect(loginPage.getEmailLabel()).toBeVisible();
    await expect(loginPage.getPasswordLabel()).toBeVisible();
    await expect(loginPage.getSubmitButton()).toBeVisible();
  });

  pageTest('should show form fields on register page', async ({ registerPageNavigated }) => {
    const { registerPage } = registerPageNavigated;
    
    // Verify form fields are present
    await expect(registerPage.getFullNameLabel()).toBeVisible();
    await expect(registerPage.getEmailLabel()).toBeVisible();
    await expect(registerPage.getPasswordLabel()).toBeVisible();
    await expect(registerPage.getConfirmPasswordLabel()).toBeVisible();
    await expect(registerPage.getSubmitButton()).toBeVisible();
  });

  pageTest('should disable submit button with empty form on login', async ({ loginPageNavigated }) => {
    const { page, loginPage } = loginPageNavigated;
    
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

  pageTest('should handle empty form submission on register', async ({ registerPageNavigated }) => {
    const { page, registerPage } = registerPageNavigated;
    
    // The Create Account button should be disabled when form is empty
    const submitButton = registerPage.getSubmitButton();
    await expect(submitButton).toBeDisabled();
    
    // Should still be on register page
    await expect(page).toHaveURL(/\/register/);
    
    // Form fields should still be visible
    await expect(registerPage.getFullNameLabel()).toBeVisible();
    await expect(registerPage.getEmailLabel()).toBeVisible();
  });

  pageTest('should allow typing in login form fields', async ({ loginPageNavigated }) => {
    const { loginPage } = loginPageNavigated;
    
    // Find and fill email input using page object methods
    const emailInput = loginPage.getEmailInput();
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // Find and fill password input using page object methods
    const passwordInput = loginPage.getPasswordInput();
    await passwordInput.fill('TestPassword123');
    await expect(passwordInput).toHaveValue('TestPassword123');
  });

  pageTest('should allow typing in register form fields', async ({ registerPageNavigated }) => {
    const { registerPage } = registerPageNavigated;
    
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

  pageTest('should show forgot password link on login page', async ({ loginPageNavigated }) => {
    const { page, loginPage } = loginPageNavigated;
    
    // Check for forgot password link
    await expect(loginPage.getForgotPasswordLink()).toBeVisible();
    
    // Click it and verify navigation
    await loginPage.clickForgotPassword();
    
    // Should navigate away from login page
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
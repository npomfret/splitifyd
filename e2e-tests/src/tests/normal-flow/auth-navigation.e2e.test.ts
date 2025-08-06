import { pageTest, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { generateTestEmail, generateTestUserName } from '../../utils/test-helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Auth Navigation E2E', () => {
  pageTest('should navigate between login and register pages', async ({ loginPage, registerPage }) => {

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

  pageTest('should allow typing in login form fields', async ({ loginPageNavigated }) => {
    const { loginPage } = loginPageNavigated;
    
    // Find and fill email input using page object methods
    const emailInput = loginPage.getEmailInput();
    const testEmail = generateTestEmail();
    await emailInput.fill(testEmail);
    await expect(emailInput).toHaveValue(testEmail);
    
    // Find and fill password input using page object methods
    const passwordInput = loginPage.getPasswordInput();
    await passwordInput.fill('TestPassword123');
    await expect(passwordInput).toHaveValue('TestPassword123');
  });

  pageTest('should allow typing in register form fields', async ({ registerPageNavigated }) => {
    const { registerPage } = registerPageNavigated;
    
    // Find and fill name input using page object methods
    const nameInput = registerPage.getFullNameInput();
    const testName = generateTestUserName();
    await nameInput.fill(testName);
    await expect(nameInput).toHaveValue(testName);
    
    // Find and fill email input using page object methods
    const emailInput = registerPage.getEmailInput();
    const testEmail2 = generateTestEmail();
    await emailInput.fill(testEmail2);
    await expect(emailInput).toHaveValue(testEmail2);
    
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
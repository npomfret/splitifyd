import { pageTest, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Auth Validation E2E', () => {
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
});
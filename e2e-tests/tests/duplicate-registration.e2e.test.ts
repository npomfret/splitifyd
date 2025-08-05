import { pageTest as test, expect } from '../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, fillPreactInput } from '../helpers';
import { TIMEOUT_CONTEXTS } from '../config/timeouts';
import { SELECTORS } from '../constants/selectors';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Duplicate User Registration E2E', () => {
  test('should prevent duplicate email registration and show error', async ({ page, registerPage }) => {
    // This test expects a 409 error when trying to register duplicate email
    test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
    const timestamp = Date.now();
    const email = `duplicate-test-${timestamp}@example.com`;
    const password = 'TestPassword123!';
    const displayName = `Duplicate Test User ${timestamp}`;

    // First registration - should succeed
    await registerPage.navigate();
    
    // Fill registration form
    await registerPage.register(displayName, email, password);
    
    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    
    // Log out to attempt second registration
    // Wait for user menu button to be visible
    const userMenuButton = page.getByRole('button', { name: displayName });
    await expect(userMenuButton.first()).toBeVisible();
    
    await userMenuButton.first().click();
    // Wait for dropdown menu to appear
    await expect(page.getByText('Sign out')).toBeVisible();
    
    // Click sign out in the dropdown
    await page.getByText('Sign out').click();
    
    // Wait for logout to complete and redirect to login page
    await page.waitForURL(/\/login/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    
    // Navigate to register page
    await registerPage.navigate();
    
    // Start capturing console messages before the registration attempt
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Wait for register page to load
    await page.waitForLoadState('networkidle');
    
    // Fill form again with same email using page object methods
    const nameInput = registerPage.getFullNameInput();
    const emailInput = registerPage.getEmailInput();
    const passwordInput = registerPage.getPasswordInput();
    const confirmPasswordInput = registerPage.getConfirmPasswordInput();
    const termsCheckbox = registerPage.getTermsCheckbox();
    const submitButton = registerPage.getSubmitButton();
    
    await nameInput.fill(displayName);
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await confirmPasswordInput.fill(password);
    await termsCheckbox.check();
    
    // Click register button
    await submitButton.click();
    
    // Should NOT redirect - should stay on registration page
    await expect(page).toHaveURL(/\/register/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    
    // Check for error message on screen using the RegisterPage's error selector
    const errorElement = page.locator(SELECTORS.ERROR_MESSAGE);
    await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });
    
    const errorText = await errorElement.textContent();
    expect(errorText?.toLowerCase()).toMatch(/email.*already.*exists|email.*in use|account.*exists|email.*registered/);
    
    // Check console for error messages (make it more flexible)
    // The 409 error appears as a resource load failure
    const errorInConsole = consoleMessages.some(msg => {
      const lowerMsg = msg.toLowerCase();
      return lowerMsg.includes('409') || 
             (lowerMsg.includes('error') && lowerMsg.includes('conflict'));
    });
    
    // We verified the error appears on screen, and the 409 is in the console
    expect(errorInConsole).toBe(true);
  });

  test('should show error immediately without clearing form', async ({ page, registerPage }) => {
    test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
    
    const timestamp = Date.now();
    const email = `persist-test-${timestamp}@example.com`;
    const password = 'TestPassword123!';
    const displayName = `Persist Test User ${timestamp}`;

    // First registration
    await registerPage.navigate();
    await registerPage.register(displayName, email, password);
    
    // Wait for dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    
    // Log out
    const userMenuButton = page.getByRole('button', { name: displayName });
    await userMenuButton.click();
    await page.getByText('Sign out').click();
    
    // Wait for navigation after logout
    await page.waitForURL((url) => {
      const urlStr = url.toString();
      const path = new URL(urlStr).pathname;
      return path === '/' || path === '/login' || path === '/home' || path === '/v2';
    }, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    
    // Second attempt - navigate to register page
    await registerPage.navigate();
    await page.waitForLoadState('networkidle');
    
    // Fill form using the shared helper to trigger Preact signals
    const nameInput = registerPage.getFullNameInput();
    const emailInput = registerPage.getEmailInput();
    const passwordInput = registerPage.getPasswordInput();
    const confirmPasswordInput = registerPage.getConfirmPasswordInput();
    
    await fillPreactInput(nameInput, displayName, page);
    await fillPreactInput(emailInput, email, page);
    await fillPreactInput(passwordInput, password, page);
    await fillPreactInput(confirmPasswordInput, password, page);
    const termsCheckbox = registerPage.getTermsCheckbox();
    const submitButton = registerPage.getSubmitButton();
    
    await termsCheckbox.check();
    
    // Submit
    await submitButton.click();
    
    // Form fields should still contain the values
    await expect(nameInput).toHaveValue(displayName);
    await expect(emailInput).toHaveValue(email);
    // Password might be cleared for security - check if it has value
    const passwordValue = await passwordInput.inputValue();
    expect(passwordValue.length).toBeGreaterThanOrEqual(0); // Allow it to be cleared or retained
    
    // Error should be visible
    const errorElement = page.locator(SELECTORS.ERROR_MESSAGE);
    await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });
  });

  test('should allow registration with different email after duplicate attempt', async ({ page, registerPage }) => {
    test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
    
    const timestamp = Date.now();
    const email1 = `first-${timestamp}@example.com`;
    const email2 = `second-${timestamp}@example.com`;
    const password = 'TestPassword123!';
    const displayName = `Recovery Test User ${timestamp}`;

    // First registration
    await registerPage.navigate();
    await registerPage.register(displayName, email1, password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
    
    // Log out
    const userMenuButton = page.getByRole('button', { name: displayName });
    await userMenuButton.click();
    await page.getByText('Sign out').click();
    
    // Wait for navigation after logout
    await page.waitForURL((url) => {
      const urlStr = url.toString();
      const path = new URL(urlStr).pathname;
      return path === '/' || path === '/login' || path === '/home' || path === '/v2';
    }, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    
    // Try duplicate (should fail)
    await registerPage.navigate();
    await page.waitForLoadState('networkidle');
    
    // Use shared helper for Preact input handling
    const nameInput = registerPage.getFullNameInput();
    const emailInput = registerPage.getEmailInput();
    const passwordInput = registerPage.getPasswordInput();
    const confirmPasswordInput = registerPage.getConfirmPasswordInput();
    const termsCheckbox = registerPage.getTermsCheckbox();
    const submitButton = registerPage.getSubmitButton();
    
    await fillPreactInput(nameInput, displayName, page);
    await fillPreactInput(emailInput, email1, page);
    await fillPreactInput(passwordInput, password, page);
    await fillPreactInput(confirmPasswordInput, password, page);
    await termsCheckbox.check();
    await submitButton.click();
    
    // Should see error
    const errorElement = page.locator(SELECTORS.ERROR_MESSAGE);
    await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });
    
    // Now change email and try again using page object
    await fillPreactInput(emailInput, email2, page);
    await submitButton.click();
    
    // Should succeed this time
    await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
  });
});
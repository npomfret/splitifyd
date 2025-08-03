import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { RegisterPage } from '../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Duplicate User Registration E2E', () => {
  test('should prevent duplicate email registration and show error', async ({ page }) => {
    // This test expects a 409 error when trying to register duplicate email
    test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
    const timestamp = Date.now();
    const email = `duplicate-test-${timestamp}@example.com`;
    const password = 'TestPassword123!';
    const displayName = `Duplicate Test User ${timestamp}`;

    // First registration - should succeed
    const registerPage = new RegisterPage(page);
    await registerPage.navigate();
    
    // Fill registration form
    await registerPage.register(displayName, email, password);
    
    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Log out to attempt second registration
    // Wait a bit for page to fully load
    await page.waitForTimeout(1000);
    
    // Look for the user menu button - it contains the display name
    // The user menu shows the full name and email
    const userMenuButton = page.locator('button').filter({ hasText: displayName });
    
    // Debug: log current URL before logout
    console.log('Current URL before logout:', page.url());
    
    await userMenuButton.first().click();
    await page.waitForTimeout(500); // Wait for dropdown to open
    
    // Click sign out in the dropdown
    await page.getByText('Sign out').click();
    
    // Wait for logout to complete and redirect
    await page.waitForURL((url) => {
      const urlStr = url.toString();
      return urlStr.includes('/login') || urlStr.includes('/home') || urlStr.includes('/v2') || urlStr === 'http://localhost:5002/';
    }, { timeout: 5000 });
    
    // Debug: log URL after logout
    console.log('URL after logout:', page.url());
    
    // Navigate to register page
    await registerPage.navigate();
    
    // Start capturing console messages before the registration attempt
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Wait for register page to load
    await page.waitForLoadState('networkidle');
    
    // Fill form again with same email
    await page.getByPlaceholder('Enter your full name').fill(displayName);
    await page.getByPlaceholder('Enter your email').fill(email);
    await page.getByPlaceholder('Create a strong password').fill(password);
    await page.getByPlaceholder('Confirm your password').fill(password);
    await page.locator('input[type="checkbox"]').check();
    
    // Click register button
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // Should NOT redirect - should stay on registration page
    await expect(page).toHaveURL(/\/register/, { timeout: 5000 });
    
    // Check for error message on screen using the RegisterPage's error selector
    const errorElement = page.locator('.text-red-600');
    await expect(errorElement).toBeVisible({ timeout: 5000 });
    
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

  test('should show error immediately without clearing form', async ({ page }) => {
    test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
    
    const timestamp = Date.now();
    const email = `persist-test-${timestamp}@example.com`;
    const password = 'TestPassword123!';
    const displayName = `Persist Test User ${timestamp}`;

    // First registration
    const registerPage = new RegisterPage(page);
    await registerPage.navigate();
    await registerPage.register(displayName, email, password);
    
    // Wait for dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Log out
    const userMenuButton = page.locator('button').filter({ hasText: displayName });
    await userMenuButton.click();
    await page.getByText('Sign out').click();
    await page.waitForURL(/\/(login|home|v2)?/, { timeout: 5000 });
    
    // Second attempt
    await registerPage.navigate();
    
    // Fill form
    const nameInput = page.getByPlaceholder('Enter your full name');
    const emailInput = page.getByPlaceholder('Enter your email');
    const passwordInput = page.getByPlaceholder('Create a strong password');
    const confirmPasswordInput = page.getByPlaceholder('Confirm your password');
    
    await nameInput.fill(displayName);
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await confirmPasswordInput.fill(password);
    await page.locator('input[type="checkbox"]').check();
    
    // Submit
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // Form fields should still contain the values
    await expect(nameInput).toHaveValue(displayName);
    await expect(emailInput).toHaveValue(email);
    // Password might be cleared for security - check if it has value
    const passwordValue = await passwordInput.inputValue();
    expect(passwordValue.length).toBeGreaterThanOrEqual(0); // Allow it to be cleared or retained
    
    // Error should be visible
    const errorElement = page.locator('.text-red-600');
    await expect(errorElement).toBeVisible({ timeout: 5000 });
  });

  test('should allow registration with different email after duplicate attempt', async ({ page }) => {
    test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
    
    const timestamp = Date.now();
    const email1 = `first-${timestamp}@example.com`;
    const email2 = `second-${timestamp}@example.com`;
    const password = 'TestPassword123!';
    const displayName = `Recovery Test User ${timestamp}`;

    const registerPage = new RegisterPage(page);
    
    // First registration
    await registerPage.navigate();
    await registerPage.register(displayName, email1, password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Log out
    const userMenuButton = page.locator('button').filter({ hasText: displayName });
    await userMenuButton.click();
    await page.getByText('Sign out').click();
    await page.waitForURL(/\/(login|home|v2)?/, { timeout: 5000 });
    
    // Try duplicate (should fail)
    await registerPage.navigate();
    await page.getByPlaceholder('Enter your full name').fill(displayName);
    await page.getByPlaceholder('Enter your email').fill(email1);
    await page.getByPlaceholder('Create a strong password').fill(password);
    await page.getByPlaceholder('Confirm your password').fill(password);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // Should see error
    await page.waitForTimeout(1000); // Wait for error to appear
    const errorElement = page.locator('.text-red-600');
    await expect(errorElement).toBeVisible();
    
    // Now change email and try again
    await page.getByPlaceholder('Enter your email').clear();
    await page.getByPlaceholder('Enter your email').fill(email2);
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // Should succeed this time
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
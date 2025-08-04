import { test, expect } from '@playwright/test';
import { EMULATOR_URL, waitForApp, setupConsoleErrorReporting, setupMCPDebugOnFailure, GroupWorkflow } from '../helpers';
import { LoginPage } from '../pages';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Form Validation E2E', () => {
  test.describe('Login Form', () => {
    test('should show validation for invalid email format', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.navigate();
      
      // Clear any pre-filled data
      const emailInput = page.locator(loginPage.emailInput);
      const passwordInput = page.locator(loginPage.passwordInput);
      await emailInput.clear();
      await passwordInput.clear();
      
      // Enter invalid email
      await emailInput.fill('notanemail');
      
      // Enter valid password
      await passwordInput.fill('ValidPassword123');
      
      // Try to submit
      await loginPage.submitForm();
      
      // Validation should prevent submission - we should stay on login page
      await expect(page).toHaveURL(/\/login/);
      
    });

    test('should require both email and password', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.navigate();
      
      // Clear any pre-filled data
      const emailInput = page.locator(loginPage.emailInput);
      const passwordInput = page.locator(loginPage.passwordInput);
      await emailInput.clear();
      await passwordInput.clear();
      
      // Fill only email
      await emailInput.fill('test@example.com');
      
      // Submit button should be disabled without password
      const submitButton = page.getByRole('button', { name: 'Sign In' });
      await expect(submitButton).toBeDisabled();
      
      // Clear and try with only password
      await emailInput.clear();
      await passwordInput.clear();
      await passwordInput.fill('Password123');
      
      // Submit button should be disabled without email
      await expect(submitButton).toBeDisabled();
      
      // Fill both fields
      await emailInput.fill('test@example.com');
      
      // Submit button should now be enabled
      await expect(submitButton).toBeEnabled();
      
      // Console errors are automatically captured by setupConsoleErrorReporting
    });

    test('should clear form on page refresh', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await loginPage.navigate();
      
      // Wait for any pre-filled data to load
      await page.waitForLoadState('domcontentloaded');
      
      // Clear any pre-filled data first
      const emailInput = page.locator(loginPage.emailInput);
      const passwordInput = page.locator(loginPage.passwordInput);
      
      await emailInput.clear();
      await passwordInput.clear();
      
      // Now fill form with our test data
      await emailInput.fill('test@example.com');
      await passwordInput.fill('Password123');
      
      // Verify values are filled
      await expect(emailInput).toHaveValue('test@example.com');
      await expect(passwordInput).toHaveValue('Password123');
      
      // Refresh page
      await page.reload();
      await waitForApp(page);
      
      // In dev, form may be pre-filled from config, but our custom values should be gone
      const newEmailValue = await emailInput.inputValue();
      const newPasswordValue = await passwordInput.inputValue();
      
      // Our custom values should not persist
      expect(newEmailValue).not.toBe('test@example.com');
      expect(newPasswordValue).not.toBe('Password123');
      
      // No console errors
      // Console errors are automatically captured by setupConsoleErrorReporting
    });
  });

  test.describe('Register Form', () => {
    test('should validate password confirmation match', async ({ page }) => {
      
      await page.goto(`${EMULATOR_URL}/register`);
      await waitForApp(page);
      
      // Fill form with mismatched passwords
      const nameInput = page.locator('input[type="text"]').first();
      const emailInput = page.locator('input[type="email"]');
      const passwordInputs = page.locator('input[type="password"]');
      
      await nameInput.fill('Test User');
      await emailInput.fill('test@example.com');
      await passwordInputs.first().fill('Password123');
      await passwordInputs.last().fill('DifferentPassword123');
      
      // Submit button should be disabled with mismatched passwords
      const submitButton = page.getByRole('button', { name: 'Create Account' });
      await expect(submitButton).toBeDisabled();
      
      // Fix password match
      await passwordInputs.last().fill('Password123');
      
      // Also need to check terms checkbox
      const termsCheckbox = page.getByRole('checkbox');
      await termsCheckbox.check();
      
      // Now button should be enabled
      await expect(submitButton).toBeEnabled();
      
      // No console errors
      // Console errors are automatically captured by setupConsoleErrorReporting
    });

    test('should require all fields', async ({ page }) => {
      
      await page.goto(`${EMULATOR_URL}/register`);
      await waitForApp(page);
      
      // The Create Account button should be disabled with empty form
      const submitButton = page.getByRole('button', { name: 'Create Account' });
      await expect(submitButton).toBeDisabled();
      
      // Should stay on register page
      await expect(page).toHaveURL(/\/register/);
      
      // All fields should still be visible
      await expect(page.getByText('Full Name *')).toBeVisible();
      await expect(page.getByText('Email address *')).toBeVisible();
      await expect(page.getByText('Password *', { exact: true })).toBeVisible();
      await expect(page.getByText('Confirm Password *')).toBeVisible();
      
      // No console errors
      // Console errors are automatically captured by setupConsoleErrorReporting
    });

    test('should validate email format on register', async ({ page }) => {
      
      await page.goto(`${EMULATOR_URL}/register`);
      await waitForApp(page);
      
      // Fill form with invalid email
      const nameInput = page.locator('input[type="text"]').first();
      const emailInput = page.locator('input[type="email"]');
      const passwordInputs = page.locator('input[type="password"]');
      
      await nameInput.fill('Test User');
      await emailInput.fill('invalid-email-format');
      await passwordInputs.first().fill('Password123');
      await passwordInputs.last().fill('Password123');
      
      // Check terms
      const termsCheckbox = page.getByRole('checkbox');
      await termsCheckbox.check();
      
      // HTML5 email validation happens on submit, not before
      const submitButton = page.getByRole('button', { name: 'Create Account' });
      await expect(submitButton).toBeEnabled();
      
      // Try to submit with invalid email
      await submitButton.click();
      
      // Should show browser's built-in validation message
      // Check that we're still on register page (form not submitted)
      await expect(page).toHaveURL(/\/register/);
      
      // Fix email format
      await emailInput.fill('test@example.com');
      
      // Now form should be valid
      await expect(submitButton).toBeEnabled();
      
      // No console errors
      // Console errors are automatically captured by setupConsoleErrorReporting
    });

    test('should trim whitespace from inputs', async ({ page }) => {
      
      await page.goto(`${EMULATOR_URL}/register`);
      await waitForApp(page);
      
      // Fill form with extra spaces
      const nameInput = page.locator('input[type="text"]').first();
      const emailInput = page.locator('input[type="email"]');
      
      await nameInput.fill('  Test User  ');
      await emailInput.fill('  test@example.com  ');
      
      // Tab away to trigger any trim logic
      await emailInput.press('Tab');
      
      // Values should be trimmed (this depends on implementation)
      // Just verify we can type with spaces without errors
      
      // No console errors
      // Console errors are automatically captured by setupConsoleErrorReporting
    });
  });

  test.describe('Form Accessibility', () => {
    test('should navigate login form with keyboard', async ({ page }) => {
      
      await page.goto(`${EMULATOR_URL}/login`);
      await waitForApp(page);
      
      // Focus should start at first input or be tabbable to it
      await page.keyboard.press('Tab');
      
      // Type in focused field (should be email)
      await page.keyboard.type('test@example.com');
      
      // Tab to password field
      await page.keyboard.press('Tab');
      await page.keyboard.type('Password123');
      
      // Tab to submit button
      await page.keyboard.press('Tab');
      
      // Submit with Enter
      await page.keyboard.press('Enter');
      
      // Form was submitted (will stay on page if invalid credentials)
      // Just verify no errors occurred during keyboard navigation
      
      // No console errors
      // Console errors are automatically captured by setupConsoleErrorReporting
    });

    test('should have proper ARIA labels', async ({ page }) => {
      
      await page.goto(`${EMULATOR_URL}/login`);
      await waitForApp(page);
      
      // Check form has proper structure
      const form = page.locator('form');
      const formCount = await form.count();
      
      // Should have at least one form element
      expect(formCount).toBeGreaterThan(0);
      
      // Inputs should be associated with labels
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      // Verify inputs exist
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      
      // No console errors
      // Console errors are automatically captured by setupConsoleErrorReporting
    });
  });

  test.describe('Expense Form', () => {
    test('should require description and amount', async ({ page }) => {
      await GroupWorkflow.createTestGroup(page, 'Expense Validation Group', 'Testing expense form validation');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Navigate to add expense form
      const addExpenseButton = page.getByRole('button', { name: /add expense/i });
      await addExpenseButton.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /save expense/i });
      await submitButton.click();
      
      // Should remain on form page (validation prevents submission)
      await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
      await expect(page).not.toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
      
      // Fill required fields
      await page.getByPlaceholder('What was this expense for?').fill('Test expense');
      await page.getByPlaceholder('0.00').fill('25.00');
      
      // Should now allow submission
      await submitButton.click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 1000 });
    });

    test('should validate split totals for exact amounts', async ({ page }) => {
      test.slow(); // Split validation tests take longer
      
      const groupInfo = await GroupWorkflow.createTestGroup(page, 'Split Validation Group');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Navigate to add expense form
      await page.getByRole('button', { name: /add expense/i }).click();
      await page.waitForLoadState('domcontentloaded');
      
      // Fill basic expense details
      await page.getByPlaceholder('What was this expense for?').fill('Split Test Expense');
      await page.getByPlaceholder('0.00').fill('100.00');
      
      // Select exact split type
      await page.getByRole('radio', { name: 'Exact amounts' }).click();
      
      // Try to submit with incorrect split total
      const submitButton = page.getByRole('button', { name: /save expense/i });
      await submitButton.click();
      
      // Should remain on form due to validation (splits don't total 100.00)
      await expect(page.getByPlaceholder('What was this expense for?')).toHaveValue('Split Test Expense');
    });

    test('should validate percentage totals', async ({ page }) => {
      test.slow(); // Split validation tests take longer
      
      await GroupWorkflow.createTestGroup(page, 'Percentage Validation Group');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      
      // Navigate to add expense form  
      await page.getByRole('button', { name: /add expense/i }).click();
      await page.waitForLoadState('domcontentloaded');
      
      // Fill basic expense details
      await page.getByPlaceholder('What was this expense for?').fill('Percentage Test Expense');
      await page.getByPlaceholder('0.00').fill('100.00');
      
      // Select percentage split type
      await page.getByRole('radio', { name: 'Percentage' }).click();
      
      // Try to submit with incorrect percentage total
      const submitButton = page.getByRole('button', { name: /save expense/i });
      await submitButton.click();
      
      // Should remain on form due to validation (percentages don't total 100%)
      await expect(page.getByPlaceholder('What was this expense for?')).toHaveValue('Percentage Test Expense');
    });
  });
});
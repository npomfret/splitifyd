import { test } from '@playwright/test';
import { pageTest, expect } from '../../fixtures/page-fixtures';
import { authenticatedPageTest } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Form Validation E2E', () => {
  test.describe('Login Form', () => {
    pageTest('should show validation for invalid email format', async ({ loginPageNavigated }) => {
      const { page, loginPage } = loginPageNavigated;
      
      // Clear any pre-filled data
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
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

    pageTest('should require both email and password', async ({ loginPageNavigated }) => {
      const { loginPage } = loginPageNavigated;
      
      // Clear any pre-filled data
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
      await emailInput.clear();
      await passwordInput.clear();
      
      // Fill only email
      await emailInput.fill('test@example.com');
      
      // Submit button should be disabled without password
      const submitButton = loginPage.getSubmitButton();
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
  });

  test.describe('Register Form', () => {
    pageTest('should validate password confirmation match', async ({ registerPageNavigated }) => {
      const { registerPage } = registerPageNavigated;
      
      // Fill form with mismatched passwords
      const nameInput = registerPage.getNameInputByType();
      const emailInput = registerPage.getEmailInputByType();
      const passwordInputs = registerPage.getPasswordInputs();
      
      await nameInput.fill('Test User');
      await emailInput.fill('test@example.com');
      await passwordInputs.first().fill('Password123');
      await passwordInputs.last().fill('DifferentPassword123');
      
      // Submit button should be disabled with mismatched passwords
      const submitButton = registerPage.getSubmitButton();
      await expect(submitButton).toBeDisabled();
      
      // Fix password match
      await passwordInputs.last().fill('Password123');
      
      // Also need to check terms checkbox
      const termsCheckbox = registerPage.getTermsCheckbox();
      await termsCheckbox.check();
      
      // Now button should be enabled
      await expect(submitButton).toBeEnabled();
      
      // No console errors
      // Console errors are automatically captured by setupConsoleErrorReporting
    });

    pageTest('should require all fields', async ({ registerPageNavigated }) => {
      const { page, registerPage } = registerPageNavigated;
      
      // The Create Account button should be disabled with empty form
      const submitButton = registerPage.getSubmitButton();
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

    pageTest('should validate email format on register', async ({ registerPageNavigated }) => {
      const { page, registerPage } = registerPageNavigated;
      
      // Fill form with invalid email
      const nameInput = registerPage.getNameInputByType();
      const emailInput = registerPage.getEmailInputByType();
      const passwordInputs = registerPage.getPasswordInputs();
      
      await nameInput.fill('Test User');
      await emailInput.fill('invalid-email-format');
      await passwordInputs.first().fill('Password123');
      await passwordInputs.last().fill('Password123');
      
      // Check terms
      const termsCheckbox = registerPage.getTermsCheckbox();
      await termsCheckbox.check();
      
      // HTML5 email validation happens on submit, not before
      const submitButton = registerPage.getSubmitButton();
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
  });

  test.describe('Expense Form', () => {
    authenticatedPageTest('should require description and amount', async ({ authenticatedPage, dashboardPage }) => {
      const { page } = authenticatedPage;
      
      // Verify we start on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Create a group
      await dashboardPage.createGroupAndNavigate('Expense Validation Group', 'Testing expense form validation');
      
      // Assert we're on the correct group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      await expect(page.getByText('Expense Validation Group')).toBeVisible();
      
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
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    });

    authenticatedPageTest('should validate split totals for exact amounts', async ({ authenticatedPage, dashboardPage }) => {
      const { page } = authenticatedPage;
      
      // Verify we start on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Create a group
      await dashboardPage.createGroupAndNavigate('Split Validation Group', 'Testing split validation');
      
      // Assert we're on the correct group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      await expect(page.getByText('Split Validation Group')).toBeVisible();
      
      // Navigate to add expense form
      await page.getByRole('button', { name: /add expense/i }).click();
      await page.waitForLoadState('domcontentloaded');
      
      // Fill basic expense details
      await page.getByPlaceholder('What was this expense for?').fill('Split Test Expense');
      await page.getByPlaceholder('0.00').fill('100.00');
      
      // Select exact split type
      await page.getByText('Exact amounts').click();
      
      // Try to submit with incorrect split total
      const submitButton = page.getByRole('button', { name: /save expense/i });
      await submitButton.click();
      
      // Should remain on form due to validation (splits don't total 100.00)
      await expect(page.getByPlaceholder('What was this expense for?')).toHaveValue('Split Test Expense');
    });

    authenticatedPageTest('should validate percentage totals', async ({ authenticatedPage, dashboardPage }) => {
      const { page } = authenticatedPage;
      
      // Verify we start on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Create a group
      await dashboardPage.createGroupAndNavigate('Percentage Validation Group', 'Testing percentage validation');
      
      // Assert we're on the correct group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
      await expect(page.getByText('Percentage Validation Group')).toBeVisible();
      
      // Navigate to add expense form  
      await page.getByRole('button', { name: /add expense/i }).click();
      await page.waitForLoadState('domcontentloaded');
      
      // Fill basic expense details
      await page.getByPlaceholder('What was this expense for?').fill('Percentage Test Expense');
      await page.getByPlaceholder('0.00').fill('100.00');
      
      // Select percentage split type
      await page.getByText('Percentage', { exact: true }).click();
      
      // Try to submit with incorrect percentage total
      const submitButton = page.getByRole('button', { name: /save expense/i });
      await submitButton.click();
      
      // Should remain on form due to validation (percentages don't total 100%)
      await expect(page.getByPlaceholder('What was this expense for?')).toHaveValue('Percentage Test Expense');
    });
  });
});
import {authenticatedPageTest, expect, pageTest} from '../../fixtures';
import {setupMCPDebugOnFailure} from '../../helpers';
import {TIMEOUT_CONTEXTS} from '../../config/timeouts';
import {generateTestEmail, generateTestGroupName, generateTestUserName} from '../../utils/test-helpers';
import {GroupDetailPage} from '../../pages';
import {GroupWorkflow} from '../../workflows';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

pageTest.describe('Form Validation E2E', () => {
  pageTest.describe('Login Form', () => {
    pageTest('should show validation for invalid email format', async ({ loginPageNavigated }) => {
      const { page, loginPage } = loginPageNavigated;
      
      // Clear any pre-filled data
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
      await loginPage.fillPreactInput(emailInput, '');
      await loginPage.fillPreactInput(passwordInput, '');
      
      // Enter invalid email
      await loginPage.fillPreactInput(emailInput, 'notanemail');
      
      // Enter valid password
      await loginPage.fillPreactInput(passwordInput, 'ValidPassword123');
      
      // Try to submit
      await loginPage.submitForm();
      
      // Validation should prevent submission - we should stay on login page
      await expect(page).toHaveURL(/\/login/);
      
    });

    pageTest('should require both email and password', async ({ loginPageNavigated }) => {
      const { loginPage } = loginPageNavigated;
      
      // Get form elements
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
      const submitButton = loginPage.getSubmitButton();
      
      // Start fresh - clear any pre-filled data (including browser autofill)
      await loginPage.fillPreactInput(emailInput, '');
      await expect(emailInput).toHaveValue('');

      await loginPage.fillPreactInput(passwordInput, '');
      await expect(passwordInput).toHaveValue('');
      
      // Now verify button is disabled with empty form
      await expect(submitButton).toBeDisabled();
      
      // Test 1: Fill only email - button should stay disabled
      await loginPage.fillPreactInput(emailInput, generateTestEmail());
      await passwordInput.focus(); // Move focus to password field to trigger email validation
      
      // Button should be disabled (password is empty)
      await expect(submitButton).toBeDisabled();
      
      // Test 2: Clear email, fill only password - button should stay disabled
      await loginPage.fillPreactInput(emailInput, '');
      await loginPage.fillPreactInput(passwordInput, 'Password123');
      await emailInput.focus(); // Move focus back to email field to trigger password validation
      
      // Button should be disabled (email is empty)
      await expect(submitButton).toBeDisabled();
      
      // Test 3: Fill both fields - button should be enabled
      await loginPage.fillPreactInput(emailInput, generateTestEmail());
      await submitButton.focus(); // Move focus to submit button to trigger all validations
      
      // Now button should be enabled
      await expect(submitButton).toBeEnabled();
      
      // Console errors are automatically captured by 
    });
  });

  pageTest.describe('Register Form', () => {
    pageTest('should validate password confirmation match', async ({ registerPageNavigated }) => {
      const { registerPage } = registerPageNavigated;
      
      // Fill form with mismatched passwords
      const nameInput = registerPage.getNameInputByType();
      const emailInput = registerPage.getEmailInputByType();
      const passwordInputs = registerPage.getPasswordInputs();
      
      await registerPage.fillPreactInput(nameInput, generateTestUserName());
      await registerPage.fillPreactInput(emailInput, generateTestEmail());
      await registerPage.fillPreactInput(passwordInputs.first(), 'Password123');
      await registerPage.fillPreactInput(passwordInputs.last(), 'DifferentPassword123');
      
      // Submit button should be disabled with mismatched passwords
      const submitButton = registerPage.getSubmitButton();
      await expect(submitButton).toBeDisabled();
      
      // Fix password match
      await registerPage.fillPreactInput(passwordInputs.last(), 'Password123');
      
      // Also need to check both required checkboxes
      const termsCheckbox = registerPage.getTermsCheckbox();
      const cookieCheckbox = registerPage.getCookieCheckbox();
      await termsCheckbox.check();
      await cookieCheckbox.check();
      
      // Now button should be enabled
      await expect(submitButton).toBeEnabled();
      
      // No console errors
      // Console errors are automatically captured by 
    });

    pageTest('should require all fields', async ({ registerPageNavigated }) => {
      const { page, registerPage } = registerPageNavigated;
      
      // The Create Account button should be disabled with empty form
      const submitButton = registerPage.getSubmitButton();
      await expect(submitButton).toBeDisabled();
      
      // Should stay on register page
      await expect(page).toHaveURL(/\/register/);
      
      // All fields should still be visible
      await expect(registerPage.getFullNameLabel()).toBeVisible();
      await expect(registerPage.getEmailLabel()).toBeVisible();
      await expect(registerPage.getPasswordLabel()).toBeVisible();
      await expect(registerPage.getConfirmPasswordLabel()).toBeVisible();
      
      // No console errors
      // Console errors are automatically captured by 
    });

    pageTest('should validate email format on register', async ({ registerPageNavigated }) => {
      const { page, registerPage } = registerPageNavigated;
      
      // Fill form with invalid email
      const nameInput = registerPage.getNameInputByType();
      const emailInput = registerPage.getEmailInputByType();
      const passwordInputs = registerPage.getPasswordInputs();
      
      await registerPage.fillPreactInput(nameInput, generateTestUserName());
      await registerPage.fillPreactInput(emailInput, 'invalid-email-format');
      await registerPage.fillPreactInput(passwordInputs.first(), 'Password123');
      await registerPage.fillPreactInput(passwordInputs.last(), 'Password123');
      
      // Check both required checkboxes
      const termsCheckbox = registerPage.getTermsCheckbox();
      const cookieCheckbox = registerPage.getCookieCheckbox();
      await termsCheckbox.check();
      await cookieCheckbox.check();
      
      // HTML5 email validation happens on submit, not before
      const submitButton = registerPage.getSubmitButton();
      await expect(submitButton).toBeEnabled();
      
      // Try to submit with invalid email
      await submitButton.click();
      
      // Should show browser's built-in validation message
      // Check that we're still on register page (form not submitted)
      await expect(page).toHaveURL(/\/register/);
      
      // Fix email format
      await registerPage.fillPreactInput(emailInput, generateTestEmail());
      
      // Now form should be valid
      await expect(submitButton).toBeEnabled();
      
      // No console errors
      // Console errors are automatically captured by 
    });
  });

  authenticatedPageTest.describe('Expense Form', () => {
    authenticatedPageTest('should require description and amount', async ({ authenticatedPage, dashboardPage }) => {
      const { page } = authenticatedPage;
      const groupDetailPage = new GroupDetailPage(page);
      const memberCount = 1;

      // Verify we start on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Use helper method to create group and prepare for expenses
      const groupId = await GroupWorkflow.createGroup(page, 'Expense Validation Group', 'Testing expense form validation');

      // Navigate to expense form with proper waiting
      const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
      
      // Submit button should be disabled when required fields are empty
      const submitButton = expenseFormPage.getSaveButtonForValidation();
      await expect(submitButton).toBeDisabled();
      
      // Form should remain on expense page
      await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
      await expect(page).not.toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
      
      // Fill required fields
      await expenseFormPage.fillDescription('Test expense');
      await expenseFormPage.fillAmount('25');
      
      // Should now enable submission
      await expect(submitButton).toBeEnabled();
      await submitButton.click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    });

    authenticatedPageTest('should validate split totals for exact amounts', async ({ authenticatedPage, dashboardPage }) => {
      const { page } = authenticatedPage;
      const groupDetailPage = new GroupDetailPage(page);
      const memberCount = 1;
      
      // Verify we start on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Use helper method to create group and prepare for expenses
      const groupId = await GroupWorkflow.createGroup(page, 'Split Validation Group', 'Testing split validation');

      // Navigate to expense form with proper waiting
      const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
      
      // Fill basic expense details
      await expenseFormPage.fillDescription('Split Test Expense');
      await expenseFormPage.fillAmount('100');
      
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
      const groupDetailPage = new GroupDetailPage(page);
      const memberCount = 1;

      // Verify we start on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Use helper method to create group and prepare for expenses
      const groupId = await GroupWorkflow.createGroup(page, 'Percentage Validation Group', 'Testing percentage validation');

      // Navigate to expense form with proper waiting
      const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
      
      // Fill basic expense details
      await expenseFormPage.fillDescription('Percentage Test Expense');
      await expenseFormPage.fillAmount('100');
      
      // Select percentage split type
      await page.getByText('Percentage', { exact: true }).click();
      
      // Try to submit with incorrect percentage total
      const submitButton = page.getByRole('button', { name: /save expense/i });
      await submitButton.click();
      
      // Should remain on form due to validation (percentages don't total 100%)
      await expect(page.getByPlaceholder('What was this expense for?')).toHaveValue('Percentage Test Expense');
    });
  });

  authenticatedPageTest.describe('Create Group Modal', () => {
    authenticatedPageTest('should validate group form fields', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
      const { page } = authenticatedPage;
      
      // Open the create group modal
      await dashboardPage.openCreateGroupModal();
      await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
      
      const submitButton = createGroupModalPage.getSubmitButton();
      
      // Submit button should be disabled with empty form
      await expect(submitButton).toBeDisabled();
      
      // Test minimum length validation - single character should not be enough
      const nameInput = createGroupModalPage.getGroupNameInput();
      await nameInput.click();
      await createGroupModalPage.fillPreactInput(nameInput, 'T');
      await page.keyboard.press('Tab');
      await page.waitForLoadState('domcontentloaded');
      
      // Should still be disabled with too short name
      await expect(submitButton).toBeDisabled();
      
      // Fill with valid group name
      await createGroupModalPage.fillPreactInput(nameInput, generateTestGroupName());
      await page.keyboard.press('Tab');
      await page.waitForLoadState('domcontentloaded');
      
      // Now button should be enabled
      await expect(submitButton).toBeEnabled();
    });

    authenticatedPageTest('should prevent form submission with invalid data', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
      const { page } = authenticatedPage;
      
      // Open modal and test validation behavior
      await dashboardPage.openCreateGroupModal();
      await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
      
      const submitButton = page.locator('form').getByRole('button', { name: 'Create Group' });
      await expect(submitButton).toBeVisible();
      
      // Submit button should be disabled for empty form
      await expect(submitButton).toBeDisabled();
      
      // Fill with valid data and verify form can be submitted
      await createGroupModalPage.fillGroupForm(generateTestGroupName(), 'Valid description');
      
      // Button should now be enabled
      await expect(submitButton).toBeEnabled();
      
      // Submit and verify navigation to new group
      await submitButton.click();
      await page.waitForURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
    });
  });
});
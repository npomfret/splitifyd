import { pageTest, authenticatedPageTest, expect } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { generateTestEmail, generateTestUserName, generateTestGroupName } from '../../utils/test-helpers';
import { GroupWorkflow } from '../../workflows';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

/**
 * Comprehensive Form Validation Test Suite
 * Consolidates validation testing from:
 * - form-validation.e2e.test.ts
 * - auth-validation.e2e.test.ts  
 * - negative-value-validation.e2e.test.ts (partial)
 */
pageTest.describe('Comprehensive Form Validation E2E', () => {
  
  pageTest.describe('Authentication Forms', () => {
    pageTest('Login form validation', async ({ loginPageNavigated }) => {
      const { page, loginPage } = loginPageNavigated;
      
      // Clear any pre-filled data using Preact-compatible method
      const emailInput = loginPage.getEmailInput();
      const passwordInput = loginPage.getPasswordInput();
      await loginPage.fillPreactInput(emailInput, '');
      await loginPage.fillPreactInput(passwordInput, '');
      
      // Test 1: Empty form - submit disabled
      const submitButton = loginPage.getSubmitButton();
      await expect(submitButton).toBeDisabled();
      
      // Test 2: Invalid email format
      await loginPage.fillPreactInput(emailInput, 'notanemail');
      await loginPage.fillPreactInput(passwordInput, 'ValidPassword123');
      await loginPage.submitForm();
      // Should stay on login page due to validation
      await expect(page).toHaveURL(/\/login/);
      
      // Test 3: Only email filled - submit disabled
      await loginPage.fillPreactInput(emailInput, '');
      await loginPage.fillPreactInput(passwordInput, '');
      await loginPage.fillPreactInput(emailInput, generateTestEmail());
      await expect(submitButton).toBeDisabled();
      
      // Test 4: Only password filled - submit disabled  
      await loginPage.fillPreactInput(emailInput, '');
      await loginPage.fillPreactInput(passwordInput, 'Password123');
      await expect(submitButton).toBeDisabled();
      
      // Test 5: Both fields filled - submit enabled
      await loginPage.fillPreactInput(emailInput, generateTestEmail());
      await expect(submitButton).toBeEnabled();
    });

    pageTest('Register form validation', async ({ registerPageNavigated }) => {
      const { page, registerPage } = registerPageNavigated;
      
      // Test 1: Empty form - submit disabled
      const submitButton = registerPage.getSubmitButton();
      await expect(submitButton).toBeDisabled();
      
      // Test 2: All fields visible
      await expect(registerPage.getFullNameLabel()).toBeVisible();
      await expect(registerPage.getEmailLabel()).toBeVisible();
      await expect(registerPage.getPasswordLabel()).toBeVisible();
      await expect(registerPage.getConfirmPasswordLabel()).toBeVisible();
      
      // Test 3: Password mismatch
      const nameInput = registerPage.getNameInputByType();
      const emailInput = registerPage.getEmailInputByType();
      const passwordInputs = registerPage.getPasswordInputs();
      
      await registerPage.fillPreactInput(nameInput, generateTestUserName());
      await registerPage.fillPreactInput(emailInput, generateTestEmail());
      await registerPage.fillPreactInput(passwordInputs.first(), 'Password123');
      await registerPage.fillPreactInput(passwordInputs.last(), 'DifferentPassword123');
      
      // Submit should be disabled with mismatched passwords
      await expect(submitButton).toBeDisabled();
      
      // Test 4: Fix password match and check required checkboxes
      await registerPage.fillPreactInput(passwordInputs.last(), 'Password123');
      const termsCheckbox = registerPage.getTermsCheckbox();
      const cookieCheckbox = registerPage.getCookieCheckbox();
      await termsCheckbox.check();
      await cookieCheckbox.check();
      
      // Now button should be enabled
      await expect(submitButton).toBeEnabled();
      
      // Test 5: Uncheck a required checkbox - submit disabled
      await termsCheckbox.uncheck();
      await expect(submitButton).toBeDisabled();
    });
  });

  authenticatedPageTest.describe('Expense Form Validation', () => {
    authenticatedPageTest('Expense form required fields and negative values', async ({ authenticatedPage, groupDetailPage }) => {
      const { page } = authenticatedPage;
      
      // Use helper method to create group and prepare for expenses
      const groupId = await groupDetailPage.createGroupAndPrepareForExpenses(generateTestGroupName('Validation'), 'Testing form validation');
      const memberCount = 1;

      // Navigate to expense form with proper waiting
      const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
      
      // Test 1: Empty form - submit disabled
      const submitButton = expenseFormPage.getSaveExpenseButton();
      await expect(submitButton).toBeDisabled();
      
      // Test 2: Negative amount validation
      const amountField = expenseFormPage.getAmountInput();
      const minValue = await amountField.getAttribute('min');
      expect(minValue).toBe('0.01');
      
      // Fill description to enable the button (required field)
      await expenseFormPage.fillDescription('Test description');
      
      // Try to enter negative amount
      await amountField.fill('-50');
      
      // Try to submit with negative value
      await submitButton.click();
      
      // Form should not submit - still on add expense page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
      
      // Browser validation message should exist
      const validationMessage = await amountField.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
      
      // Test 3: Valid positive amount enables submission
      await expenseFormPage.fillAmount('50');
      await expenseFormPage.fillDescription('Valid expense');
      
      // Select participants if needed
      await expenseFormPage.selectAllParticipants();
      
      // Should now be able to submit
      await expect(submitButton).toBeEnabled();
    });

    authenticatedPageTest('Exact split validation', async ({ authenticatedPage, groupDetailPage }) => {
      const { page } = authenticatedPage;
      
      // Use helper method to create group and prepare for expenses
      const groupId = await groupDetailPage.createGroupAndPrepareForExpenses(generateTestGroupName('ExactSplit'), 'Testing exact split validation');
      const memberCount = 1;

      // Navigate to expense form with proper waiting
      const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
      
      // Fill basic expense details
      await expenseFormPage.fillDescription('Split Test Expense');
      await expenseFormPage.fillAmount('100');
      
      // Switch to exact amounts
      await page.getByText('Exact amounts').click();
      
      // Manually modify one split amount to create invalid total
      const splitInputs = page.locator('input[type="number"][step]').filter({ hasText: '' });
      const firstSplitInput = splitInputs.first();
      await firstSplitInput.fill('60'); // Make total = 160 instead of 100
      
      // Submit should be disabled when exact amounts don't add up correctly
      const submitButton = expenseFormPage.getSaveExpenseButton();
      await expect(submitButton).toBeDisabled();
    });

    authenticatedPageTest('Percentage split validation', async ({ authenticatedPage, groupDetailPage }) => {
      const { page } = authenticatedPage;
      
      // Use helper method to create group and prepare for expenses
      const groupId = await groupDetailPage.createGroupAndPrepareForExpenses(generateTestGroupName('PercentSplit'), 'Testing percentage split validation');
      const memberCount = 1;

      // Navigate to expense form with proper waiting
      const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
      
      // Fill basic expense details
      await expenseFormPage.fillDescription('Percentage Test Expense');
      await expenseFormPage.fillAmount('200');
      
      // Switch to percentage
      await page.getByText('Percentage', { exact: true }).click();
      
      // For a single member, percentage split should be valid by default (100%)
      // Submit should remain enabled since all required fields are filled and percentages are valid
      const submitButton = expenseFormPage.getSaveExpenseButton();
      await expect(submitButton).toBeEnabled();
    });
  });

  authenticatedPageTest.describe('Group Creation Validation', () => {
    authenticatedPageTest('Create group form validation', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
      const { page } = authenticatedPage;
      
      await dashboardPage.openCreateGroupModal();
      await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
      
      // Test 1: Empty form - submit disabled
      const submitButton = createGroupModalPage.getCreateGroupFormButton();
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeDisabled();
      
      // Test 2: Name is required
      await createGroupModalPage.fillGroupForm('', 'Optional description');
      await expect(submitButton).toBeDisabled();
      
      // Test 3: Valid name enables submit
      await createGroupModalPage.fillGroupForm('Valid Group Name');
      await expect(submitButton).toBeEnabled();
    });
  });
});
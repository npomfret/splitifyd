import { expect, simpleTest } from '../../../fixtures/simple-test.fixture';
import { CreateGroupModalPage } from '../../../pages';
import { LoginPage, RegisterPage } from '../../../pages';
import { generateTestEmail, generateTestGroupName, generateTestUserName } from '@splitifyd/test-support';
/**
 * Comprehensive Form Validation Test Suite
 * Consolidates validation testing from:
 * - form-validation.e2e.test.ts
 * - auth-validation.e2e.test.ts
 * - negative-value-validation.e2e.test.ts (partial)
 */
simpleTest.describe('Comprehensive Form Validation E2E', () => {
    simpleTest.describe('Authentication Forms', () => {
        simpleTest('Login form validation', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            const loginPage = new LoginPage(page);
            await loginPage.navigate();

            // Wait for form to be ready
            await loginPage.waitForFormReady();

            // Clear any pre-filled data using page object method
            await loginPage.clearFormField('email');
            await loginPage.clearFormField('password');

            // Test 1: Empty form - submit disabled
            await loginPage.verifyFormSubmissionState(false);

            // Test 2: Invalid email format
            await loginPage.fillFormField('email', 'notanemail');
            await loginPage.fillFormField('password', 'ValidPassword123');
            await loginPage.submitForm();
            // Should stay on login page due to validation
            await expect(page).toHaveURL(/\/login/);

            // Test 3: Only email filled - submit disabled
            await loginPage.clearFormField('email');
            await loginPage.clearFormField('password');
            await loginPage.fillFormField('email', generateTestEmail());
            await loginPage.verifyFormSubmissionState(false);

            // Test 4: Only password filled - submit disabled
            await loginPage.clearFormField('email');
            await loginPage.fillFormField('password', 'Password123');
            await loginPage.verifyFormSubmissionState(false);

            // Test 5: Both fields filled - submit enabled
            await loginPage.fillFormField('email', generateTestEmail());
            await loginPage.verifyFormSubmissionState(true);
        });

        simpleTest('Register form validation', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            const registerPage = new RegisterPage(page);
            await registerPage.navigate();

            // Wait for form to be ready
            await registerPage.waitForFormReady();

            // Test 1: Empty form - submit disabled
            await registerPage.verifyFormSubmissionState(false);

            // Test 2: All fields visible
            await expect(registerPage.getFullNameLabel()).toBeVisible();
            await expect(registerPage.getEmailLabel()).toBeVisible();
            await expect(registerPage.getPasswordLabel()).toBeVisible();
            await expect(registerPage.getConfirmPasswordLabel()).toBeVisible();

            // Test 3: Password mismatch using page object methods
            await registerPage.fillFormField('name', generateTestUserName());
            await registerPage.fillFormField('email', generateTestEmail());
            await registerPage.fillFormField('password', 'Password123');
            await registerPage.fillFormField('confirmPassword', 'DifferentPassword123');

            // Submit should be disabled with mismatched passwords
            await registerPage.verifyFormSubmissionState(false);

            // Test 4: Fix password match and check required checkboxes
            await registerPage.fillFormField('confirmPassword', 'Password123');
            await registerPage.checkTermsCheckbox();
            await registerPage.checkCookieCheckbox();

            // Now button should be enabled
            await registerPage.verifyFormSubmissionState(true);

            // Test 5: Uncheck a required checkbox - submit disabled
            await registerPage.toggleTermsCheckbox();
            await registerPage.verifyFormSubmissionState(false);
        });
    });

    simpleTest.describe('Expense Form Validation', () => {
        simpleTest('Expense form required fields and negative values', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('Validation'), 'Testing form validation');
            const groupId = groupDetailPage.inferGroupId();
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Test 1: Empty form - submit disabled
            const submitButton = expenseFormPage.getSaveButtonForValidation();
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

        simpleTest('Exact split validation', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('ExactSplit'), 'Testing exact split validation');
            const groupId = groupDetailPage.inferGroupId();
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Fill basic expense details using page object methods
            await expenseFormPage.fillDescription('Split Test Expense');
            await expenseFormPage.fillAmount('100');

            // Switch to exact amounts using page object method
            await expenseFormPage.selectExactAmountsSplit();

            // Modify split amount to create invalid total using page object method
            await expenseFormPage.fillSplitAmount(0, '60'); // Make total = 160 instead of 100

            // Submit should be disabled when exact amounts don't add up correctly
            await expect(expenseFormPage.getSaveButtonForValidation()).toBeDisabled();
        });

        simpleTest('Percentage split validation', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('PercentSplit'), 'Testing percentage split validation');
            const groupId = groupDetailPage.inferGroupId();
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Fill basic expense details using page object methods
            await expenseFormPage.fillDescription('Percentage Test Expense');
            await expenseFormPage.fillAmount('200');

            // Switch to percentage using page object method
            await expenseFormPage.selectPercentageSplit();

            // For a single member, percentage split should be valid by default (100%)
            // Submit should remain enabled since all required fields are filled and percentages are valid
            await expect(expenseFormPage.getSaveButtonForValidation()).toBeEnabled();
        });
    });

    simpleTest.describe('Group Creation Validation', () => {
        simpleTest('Create group form validation', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();
            const createGroupModalPage = new CreateGroupModalPage(page, user);

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

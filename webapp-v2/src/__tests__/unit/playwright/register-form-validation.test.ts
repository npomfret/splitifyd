import { RegisterPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Registration Form Validation', () => {
    test('should show validation error for empty name field', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields except name
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because name is empty
        await expect(registerPage.getSubmitButton()).toBeDisabled();
    });

    test('should show validation error for empty email field', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields except email
        await registerPage.fillName('John Doe');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because email is empty
        await expect(registerPage.getSubmitButton()).toBeDisabled();
    });

    test('should show validation error for empty password field', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields except password
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because password is empty
        await expect(registerPage.getSubmitButton()).toBeDisabled();
    });

    test('should show validation error for empty confirm password field', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields except confirm password
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because confirm password is empty
        await expect(registerPage.getSubmitButton()).toBeDisabled();
    });

    test('should show validation error when passwords do not match', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form with mismatched passwords
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('DifferentPassword456');
        await registerPage.acceptAllPolicies();

        // Submit should be enabled (client-side validation allows submit)
        await expect(registerPage.getSubmitButton()).toBeEnabled();

        // Submit form to trigger validation
        await registerPage.submitForm();

        // Verify password mismatch error appears
        await registerPage.verifyErrorMessage('Passwords do not match');
    });

    test('should show validation error for password too short', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form with short password (less than 6 characters)
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('12345');
        await registerPage.fillConfirmPassword('12345');
        await registerPage.acceptAllPolicies();

        // Submit should be enabled (client-side validation allows submit)
        await expect(registerPage.getSubmitButton()).toBeEnabled();

        // Submit form to trigger validation
        await registerPage.submitForm();

        // Verify password length error appears
        await registerPage.verifyErrorMessage('Password must be at least 6 characters');
    });

    test('should require Terms of Service checkbox to be checked', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields but don't check Terms checkbox
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.toggleCookiesCheckbox(); // Only check cookies

        // Submit should be disabled
        await expect(registerPage.getSubmitButton()).toBeDisabled();

        // Verify terms checkbox is not checked
        await registerPage.verifyCheckboxStates(false, true);
    });

    test('should require Cookie Policy checkbox to be checked', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields but don't check Cookie Policy checkbox
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.toggleTermsCheckbox(); // Only check terms

        // Submit should be disabled
        await expect(registerPage.getSubmitButton()).toBeDisabled();

        // Verify cookies checkbox is not checked
        await registerPage.verifyCheckboxStates(true, false);
    });

    test('should require both policy checkboxes to be checked', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields but don't check any checkboxes
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');

        // Submit should be disabled
        await expect(registerPage.getSubmitButton()).toBeDisabled();

        // Verify both checkboxes are not checked
        await registerPage.verifyCheckboxStates(false, false);
    });

    test('should accept valid minimum length password (6 characters)', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form with minimum valid password length
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Pass12'); // Exactly 6 characters
        await registerPage.fillConfirmPassword('Pass12');
        await registerPage.acceptAllPolicies();

        // Submit should be enabled
        await expect(registerPage.getSubmitButton()).toBeEnabled();
    });

    test('should enable submit when all validation requirements are met', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        const submitButton = registerPage.getSubmitButton();

        // Initially disabled
        await expect(submitButton).toBeDisabled();

        // Fill name
        await registerPage.fillName('John Doe');
        await expect(submitButton).toBeDisabled();

        // Fill email
        await registerPage.fillEmail('john@example.com');
        await expect(submitButton).toBeDisabled();

        // Fill password
        await registerPage.fillPassword('Password123');
        await expect(submitButton).toBeDisabled();

        // Fill confirm password
        await registerPage.fillConfirmPassword('Password123');
        await expect(submitButton).toBeDisabled();

        // Check terms
        await registerPage.toggleTermsCheckbox();
        await expect(submitButton).toBeDisabled();

        // Check cookies - should now be enabled
        await registerPage.toggleCookiesCheckbox();
        await expect(submitButton).toBeEnabled();
    });

    test('should disable submit when required field is cleared', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        const submitButton = registerPage.getSubmitButton();

        // Fill entire form - button should be enabled
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();
        await expect(submitButton).toBeEnabled();

        // Clear name field - should disable submit
        await registerPage.fillName('');
        await expect(submitButton).toBeDisabled();

        // Refill name - should enable submit
        await registerPage.fillName('John Doe');
        await expect(submitButton).toBeEnabled();

        // Clear email - should disable submit
        await registerPage.fillEmail('');
        await expect(submitButton).toBeDisabled();
    });

    test('should disable submit when checkbox is unchecked', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        const submitButton = registerPage.getSubmitButton();

        // Fill entire form - button should be enabled
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();
        await expect(submitButton).toBeEnabled();

        // Uncheck terms - should disable submit
        await registerPage.toggleTermsCheckbox();
        await expect(submitButton).toBeDisabled();

        // Check terms again - should enable submit
        await registerPage.toggleTermsCheckbox();
        await expect(submitButton).toBeEnabled();

        // Uncheck cookies - should disable submit
        await registerPage.toggleCookiesCheckbox();
        await expect(submitButton).toBeDisabled();
    });

    test('should validate whitespace-only name as invalid', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form with whitespace-only name
        await registerPage.fillName('   ');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because name is effectively empty
        await expect(registerPage.getSubmitButton()).toBeDisabled();
    });

    // NOTE: Whitespace-only email test removed because HTML5 input[type="email"]
    // automatically trims whitespace, making it impossible to test. The empty email
    // validation is already covered by "should show validation error for empty email field".
});

test.describe('Registration Form Field Interactions', () => {
    test('should allow typing in all fields', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Type in all fields and verify values
        await registerPage.fillName('Jane Doe');
        await expect(registerPage.getNameInput()).toHaveValue('Jane Doe');

        await registerPage.fillEmail('jane@example.com');
        await expect(registerPage.getEmailInput()).toHaveValue('jane@example.com');

        await registerPage.fillPassword('SecurePass123');
        await expect(registerPage.getPasswordInput()).toHaveValue('SecurePass123');

        await registerPage.fillConfirmPassword('SecurePass123');
        await expect(registerPage.getConfirmPasswordInput()).toHaveValue('SecurePass123');
    });

    test('should allow changing field values', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill initial values
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');

        // Change values
        await registerPage.fillName('Jane Smith');
        await expect(registerPage.getNameInput()).toHaveValue('Jane Smith');

        await registerPage.fillEmail('jane@example.com');
        await expect(registerPage.getEmailInput()).toHaveValue('jane@example.com');
    });

    test('should allow toggling checkboxes multiple times', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Initially unchecked
        await registerPage.verifyCheckboxStates(false, false);

        // Check both
        await registerPage.toggleTermsCheckbox();
        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifyCheckboxStates(true, true);

        // Uncheck terms
        await registerPage.toggleTermsCheckbox();
        await registerPage.verifyCheckboxStates(false, true);

        // Check terms again
        await registerPage.toggleTermsCheckbox();
        await registerPage.verifyCheckboxStates(true, true);

        // Uncheck both
        await registerPage.toggleTermsCheckbox();
        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifyCheckboxStates(false, false);
    });
});

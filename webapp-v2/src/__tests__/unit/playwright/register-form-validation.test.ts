import { RegisterPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Registration Form Validation', () => {
    test('should show validation error for empty name field', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields except name
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because name is empty
        await registerPage.verifySubmitButtonDisabled();
    });

    test('should show validation error for empty email field', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields except email
        await registerPage.fillName('John Doe');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because email is empty
        await registerPage.verifySubmitButtonDisabled();
    });

    test('should show validation error for empty password field', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields except password
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because password is empty
        await registerPage.verifySubmitButtonDisabled();
    });

    test('should show validation error for empty confirm password field', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields except confirm password
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because confirm password is empty
        await registerPage.verifySubmitButtonDisabled();
    });

    test('should show validation error when passwords do not match', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        await mockFirebase.mockRegisterFailure({
            code: 'auth/passwords-mismatch',
            message: 'Passwords do not match',
        });

        // Attempt registration with mismatched passwords
        await registerPage.registerExpectingFailure('John Doe', 'test@example.com', 'Password123', 'DifferentPassword456');

        // Verify password mismatch error appears
        await registerPage.verifyErrorMessage('Passwords do not match');
    });

    test('should show validation error for password too short', async ({ pageWithLogging: page, mockFirebase }) => {
        const registerPage = new RegisterPage(page);

        await registerPage.navigate();

        await mockFirebase.mockRegisterFailure({
            code: 'auth/weak-password',
            message: 'Password must be at least 6 characters',
        });

        // Attempt registration with short password
        await registerPage.registerExpectingFailure('John Doe', 'test@example.com', '12345');

        // Verify password length error appears
        await registerPage.verifyErrorMessage('Password must be at least 6 characters');
    });

    test('should require Terms of Service checkbox to be checked', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields but don't check Terms checkbox
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.toggleCookiesCheckbox(); // Only check cookies

        // Submit should be disabled
        await registerPage.verifySubmitButtonDisabled();

        // Verify terms checkbox is not checked
        await registerPage.verifyCheckboxStates(false, true);
    });

    test('should require Cookie Policy checkbox to be checked', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields but don't check Cookie Policy checkbox
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.toggleTermsCheckbox(); // Only check terms

        // Submit should be disabled
        await registerPage.verifySubmitButtonDisabled();

        // Verify cookies checkbox is not checked
        await registerPage.verifyCheckboxStates(true, false);
    });

    test('should require both policy checkboxes to be checked', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill all fields but don't check any checkboxes
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');

        // Submit should be disabled
        await registerPage.verifySubmitButtonDisabled();

        // Verify both checkboxes are not checked
        await registerPage.verifyCheckboxStates(false, false);
    });

    test('should accept valid minimum length password (6 characters)', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form with minimum valid password length
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Pass12'); // Exactly 6 characters
        await registerPage.fillConfirmPassword('Pass12');
        await registerPage.acceptAllPolicies();

        // Submit should be enabled
        await registerPage.verifySubmitButtonEnabled();
    });

    test('should enable submit when all validation requirements are met', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Initially disabled
        await registerPage.verifySubmitButtonDisabled();

        // Fill name
        await registerPage.fillName('John Doe');
        await registerPage.verifySubmitButtonDisabled();

        // Fill email
        await registerPage.fillEmail('john@example.com');
        await registerPage.verifySubmitButtonDisabled();

        // Fill password
        await registerPage.fillPassword('Password123');
        await registerPage.verifySubmitButtonDisabled();

        // Fill confirm password
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.verifySubmitButtonDisabled();

        // Check terms
        await registerPage.toggleTermsCheckbox();
        await registerPage.verifySubmitButtonDisabled();

        // Check cookies - should now be enabled
        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifySubmitButtonEnabled();
    });

    test('should disable submit when required field is cleared', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill entire form - button should be enabled
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();
        await registerPage.verifySubmitButtonEnabled();

        // Clear name field - should disable submit
        await registerPage.fillName('');
        await registerPage.verifySubmitButtonDisabled();

        // Refill name - should enable submit
        await registerPage.fillName('John Doe');
        await registerPage.verifySubmitButtonEnabled();

        // Clear email - should disable submit
        await registerPage.fillEmail('');
        await registerPage.verifySubmitButtonDisabled();
    });

    test('should disable submit when checkbox is unchecked', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill entire form - button should be enabled
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();
        await registerPage.verifySubmitButtonEnabled();

        // Uncheck terms - should disable submit
        await registerPage.toggleTermsCheckbox();
        await registerPage.verifySubmitButtonDisabled();

        // Check terms again - should enable submit
        await registerPage.toggleTermsCheckbox();
        await registerPage.verifySubmitButtonEnabled();

        // Uncheck cookies - should disable submit
        await registerPage.toggleCookiesCheckbox();
        await registerPage.verifySubmitButtonDisabled();
    });

    test('should validate whitespace-only name as invalid', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form with whitespace-only name
        await registerPage.fillName('   ');
        await registerPage.fillEmail('test@example.com');
        await registerPage.fillPassword('Password123');
        await registerPage.fillConfirmPassword('Password123');
        await registerPage.acceptAllPolicies();

        // Submit should be disabled because name is effectively empty
        await registerPage.verifySubmitButtonDisabled();
    });

    // NOTE: Whitespace-only email test removed because HTML5 input[type="email"]
    // automatically trims whitespace, making it impossible to test. The empty email
    // validation is already covered by "should show validation error for empty email field".
});

test.describe('Registration Form Field Interactions', () => {
    test('should allow typing in all fields', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Type in all fields and verify values
        await registerPage.fillName('Jane Doe');
        await registerPage.verifyNameInputValue('Jane Doe');

        await registerPage.fillEmail('jane@example.com');
        await registerPage.verifyEmailInputValue('jane@example.com');

        await registerPage.fillPassword('SecurePass123');
        await registerPage.verifyPasswordInputValue('SecurePass123');

        await registerPage.fillConfirmPassword('SecurePass123');
        await registerPage.verifyConfirmPasswordInputValue('SecurePass123');
    });

    test('should allow changing field values', async ({ pageWithLogging: page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill initial values
        await registerPage.fillName('John Doe');
        await registerPage.fillEmail('john@example.com');

        // Change values
        await registerPage.fillName('Jane Smith');
        await registerPage.verifyNameInputValue('Jane Smith');

        await registerPage.fillEmail('jane@example.com');
        await registerPage.verifyEmailInputValue('jane@example.com');
    });

    test('should allow toggling checkboxes multiple times', async ({ pageWithLogging: page }) => {
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

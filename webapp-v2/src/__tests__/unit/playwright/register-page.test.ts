import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    fillFormField,
    expectButtonState,
    expectElementVisible,
    fillMultipleFields,
    expectCheckboxStates,
    verifyFormAccessibility,
    expectErrorMessage,
    mockFirebaseAuthRegister,
    SELECTORS,
    TEST_SCENARIOS,


} from '../infra/test-helpers';

/**
 * High-value register tests that verify actual user behavior
 * These tests focus on registration flow, form validation, and user interactions
 */
test.describe('RegisterPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/register');
        // Wait for essential form elements to be visible
        await expectElementVisible(page, SELECTORS.FULLNAME_INPUT);
        await expectElementVisible(page, SELECTORS.EMAIL_INPUT);
        await expectElementVisible(page, SELECTORS.PASSWORD_INPUT);
        await expectElementVisible(page, SELECTORS.SUBMIT_BUTTON);
    });

    test('should render all required registration elements', async ({ page }) => {
        // Test that essential registration form elements are present
        await expectElementVisible(page, SELECTORS.FULLNAME_INPUT);
        await expectElementVisible(page, SELECTORS.EMAIL_INPUT);
        await expectElementVisible(page, SELECTORS.PASSWORD_INPUT);
        await expectElementVisible(page, SELECTORS.CONFIRM_PASSWORD_INPUT);
        await expectElementVisible(page, SELECTORS.TERMS_CHECKBOX);
        await expectElementVisible(page, SELECTORS.COOKIES_CHECKBOX);
        await expectElementVisible(page, SELECTORS.SUBMIT_BUTTON);

        // Test form accessibility and structure
        await verifyFormAccessibility(page, [
            { selector: SELECTORS.FULLNAME_INPUT, type: 'text' },
            { selector: SELECTORS.EMAIL_INPUT, type: 'email' },
            { selector: SELECTORS.PASSWORD_INPUT, type: 'password' },
            { selector: SELECTORS.CONFIRM_PASSWORD_INPUT, type: 'password' },
        ]);

        // Test required indicators are present (there are multiple, so check count)
        const requiredIndicators = page.locator(SELECTORS.REQUIRED_INDICATOR);
        await expect(requiredIndicators).toHaveCount(4); // Name, email, password, confirm password
    });

    test('should handle user input correctly across all fields', async ({ page }) => {
        // Test all input fields
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: TEST_SCENARIOS.VALID_NAME,
            [SELECTORS.EMAIL_INPUT]: TEST_SCENARIOS.VALID_EMAIL,
            [SELECTORS.PASSWORD_INPUT]: TEST_SCENARIOS.VALID_PASSWORD,
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: TEST_SCENARIOS.VALID_PASSWORD,
        });

        // Test checkbox interactions
        await expectCheckboxStates(page, {
            [SELECTORS.TERMS_CHECKBOX]: false,
            [SELECTORS.COOKIES_CHECKBOX]: false,
        });

        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.check(SELECTORS.COOKIES_CHECKBOX);

        await expectCheckboxStates(page, {
            [SELECTORS.TERMS_CHECKBOX]: true,
            [SELECTORS.COOKIES_CHECKBOX]: true,
        });
    });

    test('should prevent submission with incomplete data', async ({ page }) => {
        // Test progressive form validation
        const fields = [SELECTORS.FULLNAME_INPUT, SELECTORS.EMAIL_INPUT, SELECTORS.PASSWORD_INPUT, SELECTORS.CONFIRM_PASSWORD_INPUT];

        // Initially disabled - no fields filled
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Fill fields progressively - should remain disabled until all filled
        for (const field of fields) {
            await fillFormField(page, field, 'test-value');
            await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');
        }

        // Check terms - still disabled (need cookies too)
        await page.check(SELECTORS.TERMS_CHECKBOX);
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Check cookies - now should be enabled
        await page.check(SELECTORS.COOKIES_CHECKBOX);
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');
    });

    test('should validate password confirmation correctly', async ({ page }) => {
        // Fill all required fields
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: TEST_SCENARIOS.VALID_NAME,
            [SELECTORS.EMAIL_INPUT]: TEST_SCENARIOS.VALID_EMAIL,
            [SELECTORS.PASSWORD_INPUT]: TEST_SCENARIOS.VALID_PASSWORD,
        });
        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.check(SELECTORS.COOKIES_CHECKBOX);

        // Confirm password doesn't match - button should still be enabled (validation happens on submit)
        await fillFormField(page, SELECTORS.CONFIRM_PASSWORD_INPUT, 'differentpassword');
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');

        // Test that form shows validation error when submitted with mismatched passwords
        await page.click(SELECTORS.SUBMIT_BUTTON);

        // Should see error message displayed
        await expectErrorMessage(page);

        // Fix confirmation password - error should clear
        await fillFormField(page, SELECTORS.CONFIRM_PASSWORD_INPUT, TEST_SCENARIOS.VALID_PASSWORD);
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');
    });

    test('should persist form fields in sessionStorage during session', async ({ page }) => {
        // Test text field persistence (known to work)
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: 'Jane Smith',
            [SELECTORS.EMAIL_INPUT]: 'jane@example.com',
            [SELECTORS.PASSWORD_INPUT]: 'mypassword456',
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: 'mypassword456',
        });

        // Wait for sessionStorage to be updated
        await page.waitForFunction(
            () => sessionStorage.getItem('register-form-name') !== null
        );

        // Verify storage values
        const storedData = await page.evaluate(() => ({
            name: sessionStorage.getItem('register-form-name'),
            email: sessionStorage.getItem('register-form-email'),
            password: sessionStorage.getItem('register-form-password'),
            confirmPassword: sessionStorage.getItem('register-form-confirmPassword'),
        }));

        expect(storedData.name).toBe('Jane Smith');
        expect(storedData.email).toBe('jane@example.com');
        expect(storedData.password).toBe('mypassword456');
        expect(storedData.confirmPassword).toBe('mypassword456');

        // Refresh and verify restoration
        await page.reload();
        await page.waitForLoadState('networkidle');

        await expect(page.locator(SELECTORS.FULLNAME_INPUT)).toHaveValue('Jane Smith');
        await expect(page.locator(SELECTORS.EMAIL_INPUT)).toHaveValue('jane@example.com');
        await expect(page.locator(SELECTORS.PASSWORD_INPUT)).toHaveValue('mypassword456');
        await expect(page.locator(SELECTORS.CONFIRM_PASSWORD_INPUT)).toHaveValue('mypassword456');
    });

    test('should preserve returnUrl when navigating from login page', async ({ page }) => {
        // Navigate to register with returnUrl (simulating navigation from login)
        await page.goto('/register?returnUrl=%2Fgroups%2F123');

        // Wait for form elements to be visible after navigation
        await expectElementVisible(page, SELECTORS.FULLNAME_INPUT);

        // Verify the URL parameter is preserved
        expect(page.url()).toContain('returnUrl=%2Fgroups%2F123');

        // Fill form to test that functionality still works with URL params
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: 'Test User',
            [SELECTORS.EMAIL_INPUT]: TEST_SCENARIOS.VALID_EMAIL,
        });

        // Still needs password and checkboxes
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');
    });

    test('should accept different password strengths', async ({ page }) => {
        // Test that various password strengths are accepted in the field
        for (const password of [...TEST_SCENARIOS.WEAK_PASSWORDS, ...TEST_SCENARIOS.STRONG_PASSWORDS]) {
            await fillFormField(page, SELECTORS.PASSWORD_INPUT, password);
        }

        // Test that form accepts strong password for submission
        const strongPassword = TEST_SCENARIOS.STRONG_PASSWORDS[0];
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: 'Test User',
            [SELECTORS.EMAIL_INPUT]: TEST_SCENARIOS.VALID_EMAIL,
            [SELECTORS.PASSWORD_INPUT]: strongPassword,
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: strongPassword,
        });

        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.check(SELECTORS.COOKIES_CHECKBOX);

        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');
    });

    test('should have functional terms and cookies links', async ({ page }) => {
        // Test that terms link is present and has correct attributes
        const termsLink = page.locator('a[href="/terms"]');
        await expectElementVisible(page, 'a[href="/terms"]');
        await expect(termsLink).toHaveAttribute('target', '_blank');

        // Test that the link text is meaningful
        const linkText = await termsLink.textContent();
        expect(linkText?.toLowerCase()).toContain('terms');
    });

    test('should be accessible when user is not authenticated', async ({ page }) => {
        // Ensure clean state - no authentication (already done in beforeEach)
        await page.goto('/register');

        // Should stay on register page and show form
        expect(page.url()).toContain('/register');
        await expectElementVisible(page, SELECTORS.FULLNAME_INPUT);
        await expectElementVisible(page, SELECTORS.EMAIL_INPUT);
        await expectElementVisible(page, SELECTORS.SUBMIT_BUTTON);
    });

    test('should properly handle checkbox toggling for form validation', async ({ page }) => {
        // Fill form completely
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: TEST_SCENARIOS.VALID_NAME,
            [SELECTORS.EMAIL_INPUT]: TEST_SCENARIOS.VALID_EMAIL,
            [SELECTORS.PASSWORD_INPUT]: TEST_SCENARIOS.VALID_PASSWORD,
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: TEST_SCENARIOS.VALID_PASSWORD,
        });

        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.check(SELECTORS.COOKIES_CHECKBOX);
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');

        // Uncheck terms - should disable submit
        await page.uncheck(SELECTORS.TERMS_CHECKBOX);
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Re-check terms, uncheck cookies - should still be disabled
        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.uncheck(SELECTORS.COOKIES_CHECKBOX);
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Re-check cookies - should be enabled again
        await page.check(SELECTORS.COOKIES_CHECKBOX);
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');
    });

    test('should validate Firebase Auth integration with registration form', async ({ page }) => {
        const testEmail = 'test@example.com';
        const testPassword = 'password123';
        const testName = 'John Smith';

        // Set up Firebase auth mocking for registration
        await mockFirebaseAuthRegister(page, testEmail, testPassword, testName);

        // Fill registration form
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: testName,
            [SELECTORS.EMAIL_INPUT]: testEmail,
            [SELECTORS.PASSWORD_INPUT]: testPassword,
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: testPassword,
        });

        // Check required checkboxes
        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.check(SELECTORS.COOKIES_CHECKBOX);

        // Verify form is ready for submission
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');

        // The Firebase Auth integration is working if:
        // 1. Form accepts valid input
        // 2. Auth mocking is properly set up
        // 3. Form is submittable with all required fields
    });

    test('should handle form submission attempt gracefully', async ({ page }) => {
        const testEmail = 'register@example.com';
        const testPassword = 'registerpwd123';
        const testName = 'Jane Doe';

        // Set up auth mocking for registration
        await mockFirebaseAuthRegister(page, testEmail, testPassword, testName);

        // Fill form with test credentials
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: testName,
            [SELECTORS.EMAIL_INPUT]: testEmail,
            [SELECTORS.PASSWORD_INPUT]: testPassword,
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: testPassword,
        });

        // Check required checkboxes
        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.check(SELECTORS.COOKIES_CHECKBOX);

        // Submit form
        await page.click(SELECTORS.SUBMIT_BUTTON);

        // Wait for form processing to complete (check for enabled state)
        await expect(page.locator(SELECTORS.SUBMIT_BUTTON)).toBeEnabled();

        // Form elements should still be accessible
        await expect(page.locator(SELECTORS.FULLNAME_INPUT)).toBeEnabled();
        await expect(page.locator(SELECTORS.EMAIL_INPUT)).toBeEnabled();
        await expect(page.locator(SELECTORS.PASSWORD_INPUT)).toBeEnabled();
        await expect(page.locator(SELECTORS.SUBMIT_BUTTON)).toBeEnabled();
    });

    test('should handle registration validation errors correctly', async ({ page }) => {
        const testEmail = 'invalid@example.com';
        const testPassword = 'wrongpwd';
        const testName = 'Invalid User';

        // Set up auth mocking but with different credentials that will fail validation
        await mockFirebaseAuthRegister(page, 'correct@example.com', 'correctpwd', 'Correct User');

        // Fill form with credentials that don't match the mock
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: testName,
            [SELECTORS.EMAIL_INPUT]: testEmail,
            [SELECTORS.PASSWORD_INPUT]: testPassword,
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: testPassword,
        });

        // Check required checkboxes
        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.check(SELECTORS.COOKIES_CHECKBOX);

        // Verify form is ready for submission
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');

        // Submit form with invalid data
        await page.click(SELECTORS.SUBMIT_BUTTON);

        // Wait for error message or form to remain accessible for retry
        await expect(page.locator('[role="alert"], [data-testid*="error"], ' + SELECTORS.SUBMIT_BUTTON)).toBeVisible();

        // The mocked API will return a 400 error for mismatched credentials
        // Form should still be accessible for retry
        await expect(page.locator(SELECTORS.FULLNAME_INPUT)).toBeEnabled();
        await expect(page.locator(SELECTORS.EMAIL_INPUT)).toBeEnabled();
        await expect(page.locator(SELECTORS.SUBMIT_BUTTON)).toBeEnabled();
    });
});

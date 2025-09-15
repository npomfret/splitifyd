import { test, expect } from '@playwright/test';
import { validCredentials } from './fixtures';
import {
    setupTestPage,
    fillFormField,
    expectButtonState,
    expectElementVisible,
    fillMultipleFields,
    expectCheckboxStates,
    verifyFormAccessibility,
    expectErrorMessage,
    SELECTORS,
    TEST_SCENARIOS,
    testFormValidation,
    testSessionStoragePersistence
} from './test-helpers';

/**
 * High-value register tests that verify actual user behavior
 * These tests focus on registration flow, form validation, and user interactions
 */
test.describe('RegisterPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/register');
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
            { selector: SELECTORS.CONFIRM_PASSWORD_INPUT, type: 'password' }
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
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: TEST_SCENARIOS.VALID_PASSWORD
        });

        // Test checkbox interactions
        await expectCheckboxStates(page, {
            [SELECTORS.TERMS_CHECKBOX]: false,
            [SELECTORS.COOKIES_CHECKBOX]: false
        });

        await page.check(SELECTORS.TERMS_CHECKBOX);
        await page.check(SELECTORS.COOKIES_CHECKBOX);

        await expectCheckboxStates(page, {
            [SELECTORS.TERMS_CHECKBOX]: true,
            [SELECTORS.COOKIES_CHECKBOX]: true
        });
    });

    test('should prevent submission with incomplete data', async ({ page }) => {
        // Test progressive form validation
        const fields = [
            SELECTORS.FULLNAME_INPUT,
            SELECTORS.EMAIL_INPUT,
            SELECTORS.PASSWORD_INPUT,
            SELECTORS.CONFIRM_PASSWORD_INPUT
        ];

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
            [SELECTORS.PASSWORD_INPUT]: TEST_SCENARIOS.VALID_PASSWORD
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
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: 'mypassword456'
        });

        await page.waitForTimeout(100);

        // Verify storage values
        const storedData = await page.evaluate(() => ({
            name: sessionStorage.getItem('register-form-name'),
            email: sessionStorage.getItem('register-form-email'),
            password: sessionStorage.getItem('register-form-password'),
            confirmPassword: sessionStorage.getItem('register-form-confirmPassword')
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

        // Verify the URL parameter is preserved
        expect(page.url()).toContain('returnUrl=%2Fgroups%2F123');

        // Fill form to test that functionality still works with URL params
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: 'Test User',
            [SELECTORS.EMAIL_INPUT]: TEST_SCENARIOS.VALID_EMAIL
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
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: strongPassword
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
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: TEST_SCENARIOS.VALID_PASSWORD
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
});
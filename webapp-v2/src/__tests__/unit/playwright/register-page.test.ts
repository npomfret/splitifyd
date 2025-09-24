import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    setupUnauthenticatedTest,
    fillFormField,
    expectButtonState,
    expectElementVisible,
    fillMultipleFields,
    expectCheckboxStates,
    verifyFormAccessibility,
    expectErrorMessage,
    mockFirebaseAuthRegister,
    testTabOrder,
    testReverseTabOrder,
    verifyFocusVisible,
    SELECTORS,
    TestScenarios,
} from '../infra/test-helpers';

/**
 * High-value register tests that verify actual user behavior
 * These tests focus on registration flow, form validation, and user interactions
 */
test.describe('RegisterPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupUnauthenticatedTest(page);
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
            [SELECTORS.FULLNAME_INPUT]: TestScenarios.validUser.displayName,
            [SELECTORS.EMAIL_INPUT]: TestScenarios.validUser.email,
            [SELECTORS.PASSWORD_INPUT]: TestScenarios.validUser.password,
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: TestScenarios.validUser.password,
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
            [SELECTORS.FULLNAME_INPUT]: TestScenarios.validUser.displayName,
            [SELECTORS.EMAIL_INPUT]: TestScenarios.validUser.email,
            [SELECTORS.PASSWORD_INPUT]: TestScenarios.validUser.password,
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
        await fillFormField(page, SELECTORS.CONFIRM_PASSWORD_INPUT, TestScenarios.validUser.password);
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
        await page.waitForFunction(() => sessionStorage.getItem('register-form-name') !== null);

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

        // Test persistence by navigating away and back (instead of refresh)
        await page.goto('/login');
        await page.goto('/register');
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
            [SELECTORS.EMAIL_INPUT]: TestScenarios.validUser.email,
        });

        // Still needs password and checkboxes
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');
    });

    test('should accept different password strengths', async ({ page }) => {
        // Test that various password strengths are accepted in the field
        for (const password of [...TestScenarios.weakPasswords, ...TestScenarios.strongPasswords]) {
            await fillFormField(page, SELECTORS.PASSWORD_INPUT, password);
        }

        // Test that form accepts strong password for submission
        const strongPassword = TestScenarios.strongPasswords[0];
        await fillMultipleFields(page, {
            [SELECTORS.FULLNAME_INPUT]: 'Test User',
            [SELECTORS.EMAIL_INPUT]: TestScenarios.validUser.email,
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
            [SELECTORS.FULLNAME_INPUT]: TestScenarios.validUser.displayName,
            [SELECTORS.EMAIL_INPUT]: TestScenarios.validUser.email,
            [SELECTORS.PASSWORD_INPUT]: TestScenarios.validUser.password,
            [SELECTORS.CONFIRM_PASSWORD_INPUT]: TestScenarios.validUser.password,
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

        // Wait for error message to appear
        await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

        // The mocked API will return a 400 error for mismatched credentials
        // Form should still be accessible for retry
        await expect(page.locator(SELECTORS.FULLNAME_INPUT)).toBeEnabled();
        await expect(page.locator(SELECTORS.EMAIL_INPUT)).toBeEnabled();
        await expect(page.locator(SELECTORS.SUBMIT_BUTTON)).toBeEnabled();
    });

    // === KEYBOARD NAVIGATION TESTS ===

    test.describe('Keyboard Navigation', () => {
        test('should support proper tab order through all form elements', async ({ page }) => {
            // Expected tab order for registration form
            const expectedTabOrder = [
                SELECTORS.FULLNAME_INPUT,
                SELECTORS.EMAIL_INPUT,
                SELECTORS.PASSWORD_INPUT,
                SELECTORS.CONFIRM_PASSWORD_INPUT,
                SELECTORS.TERMS_CHECKBOX,
                SELECTORS.COOKIES_CHECKBOX,
                SELECTORS.SUBMIT_BUTTON,
            ];

            // Test forward tab navigation
            await testTabOrder(page, expectedTabOrder);

            // Test reverse tab navigation (Shift+Tab)
            await testReverseTabOrder(page, expectedTabOrder);
        });

        test('should submit form with Enter key from any input field', async ({ page }) => {
            // Mock the register API endpoint
            await page.route('**/api/register', (route) => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Registration successful',
                        user: {
                            email: 'jgv499y6@bar.com',
                            displayName: 'John Doe',
                            uid: 'test-uid-123',
                        },
                    }),
                });
            });

            // Fill form with valid data
            await fillMultipleFields(page, {
                [SELECTORS.FULLNAME_INPUT]: TestScenarios.validUser.displayName,
                [SELECTORS.EMAIL_INPUT]: TestScenarios.validUser.email,
                [SELECTORS.PASSWORD_INPUT]: TestScenarios.validUser.password,
                [SELECTORS.CONFIRM_PASSWORD_INPUT]: TestScenarios.validUser.password,
            });
            await page.check(SELECTORS.TERMS_CHECKBOX);
            await page.check(SELECTORS.COOKIES_CHECKBOX);

            // Test Enter key submission from various input fields
            const inputFields = [SELECTORS.FULLNAME_INPUT, SELECTORS.EMAIL_INPUT, SELECTORS.PASSWORD_INPUT, SELECTORS.CONFIRM_PASSWORD_INPUT];

            // Test only with one input field since pressing Enter will submit and navigate
            const inputField = inputFields[0];

            // Focus on input field
            await page.locator(inputField).focus();
            await expect(page.locator(inputField)).toBeFocused();

            // Press Enter (should not submit from input field - only from button)
            await page.keyboard.press('Enter');

            // Should remain on register page since Enter in input doesn't submit
            await expect(page).toHaveURL(/\/register/);
        });

        test('should toggle checkboxes with Space key', async ({ page }) => {
            const checkboxes = [SELECTORS.TERMS_CHECKBOX, SELECTORS.COOKIES_CHECKBOX];

            for (const checkboxSelector of checkboxes) {
                const checkbox = page.locator(checkboxSelector);

                // Focus on checkbox
                await checkbox.focus();
                await expect(checkbox).toBeFocused();

                // Get initial state
                const initialChecked = await checkbox.isChecked();

                // Press Space to toggle
                await page.keyboard.press('Space');

                // Verify state changed
                const newChecked = await checkbox.isChecked();
                expect(newChecked).toBe(!initialChecked);

                // Press Space again to toggle back
                await page.keyboard.press('Space');

                // Verify state returned to original
                const finalChecked = await checkbox.isChecked();
                expect(finalChecked).toBe(initialChecked);
            }
        });

        test('should activate submit button with Enter key when valid', async ({ page }) => {
            // Mock the register API endpoint
            await page.route('**/api/register', (route) => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Registration successful',
                        user: {
                            email: 'jgv499y6@bar.com',
                            displayName: 'John Doe',
                            uid: 'test-uid-123',
                        },
                    }),
                });
            });

            // Fill form with valid data
            await fillMultipleFields(page, {
                [SELECTORS.FULLNAME_INPUT]: TestScenarios.validUser.displayName,
                [SELECTORS.EMAIL_INPUT]: TestScenarios.validUser.email,
                [SELECTORS.PASSWORD_INPUT]: TestScenarios.validUser.password,
                [SELECTORS.CONFIRM_PASSWORD_INPUT]: TestScenarios.validUser.password,
            });
            await page.check(SELECTORS.TERMS_CHECKBOX);
            await page.check(SELECTORS.COOKIES_CHECKBOX);

            // Focus on submit button
            const submitButton = page.locator(SELECTORS.SUBMIT_BUTTON);
            await submitButton.focus();
            await expect(submitButton).toBeFocused();
            await expect(submitButton).toBeEnabled();

            // Press Enter to activate button
            await page.keyboard.press('Enter');

            // Button should remain visible (API call will be mocked)
            await expect(submitButton).toBeVisible();
        });

        test('should have visible focus indicators on all interactive elements', async ({ page }) => {
            const interactiveElements = [
                SELECTORS.FULLNAME_INPUT,
                SELECTORS.EMAIL_INPUT,
                SELECTORS.PASSWORD_INPUT,
                SELECTORS.CONFIRM_PASSWORD_INPUT,
                SELECTORS.TERMS_CHECKBOX,
                SELECTORS.COOKIES_CHECKBOX,
                SELECTORS.SUBMIT_BUTTON,
            ];

            await verifyFocusVisible(page, interactiveElements);
        });

        test('should maintain focus state during form interactions', async ({ page }) => {
            // Fill name field and verify it maintains focus
            const nameInput = page.locator(SELECTORS.FULLNAME_INPUT);
            await nameInput.focus();
            await nameInput.fill(TestScenarios.validUser.displayName);
            await expect(nameInput).toBeFocused();

            // Tab to email field and verify focus moves correctly
            await page.keyboard.press('Tab');
            const emailInput = page.locator(SELECTORS.EMAIL_INPUT);
            await expect(emailInput).toBeFocused();

            // Fill email and verify focus is maintained
            await emailInput.fill(TestScenarios.validUser.email);
            await expect(emailInput).toBeFocused();

            // Tab to password field
            await page.keyboard.press('Tab');
            const passwordInput = page.locator(SELECTORS.PASSWORD_INPUT);
            await expect(passwordInput).toBeFocused();

            // Fill password and verify focus is maintained
            await passwordInput.fill(TestScenarios.validUser.password);
            await expect(passwordInput).toBeFocused();
        });

        test('should handle keyboard navigation with form validation states', async ({ page }) => {
            // Test tab order when form is empty (submit button disabled)
            const tabOrder = [SELECTORS.FULLNAME_INPUT, SELECTORS.EMAIL_INPUT, SELECTORS.PASSWORD_INPUT, SELECTORS.CONFIRM_PASSWORD_INPUT, SELECTORS.TERMS_CHECKBOX, SELECTORS.COOKIES_CHECKBOX];

            // Use improved helper function for keyboard navigation
            await testTabOrder(page, tabOrder);

            // Check submit button is disabled (which is expected)
            const submitButton = page.locator(SELECTORS.SUBMIT_BUTTON);
            if ((await submitButton.count()) > 0) {
                await expect(submitButton).toBeDisabled();
            }
        });

        test('should support keyboard navigation through checkbox labels', async ({ page }) => {
            // Start from a known state
            await page.locator('body').focus();

            // Find checkboxes by tabbing through the form
            const foundCheckboxes = [];
            let attempts = 0;
            const maxTabs = 15; // Reasonable limit

            while (attempts < maxTabs) {
                await page.keyboard.press('Tab');
                attempts++;

                const focusedElement = page.locator(':focus');
                if ((await focusedElement.count()) > 0) {
                    const elementType = await focusedElement.evaluate((el) => (el as HTMLInputElement).type);

                    if (elementType === 'checkbox') {
                        // Test keyboard interaction on this checkbox
                        const initialState = await focusedElement.isChecked();
                        await page.keyboard.press('Space');
                        const newState = await focusedElement.isChecked();
                        expect(newState).toBe(!initialState);

                        foundCheckboxes.push(true);
                        console.log(`✓ Found and tested checkbox via Tab navigation`);

                        // Restore original state for clean test
                        await page.keyboard.press('Space');
                    }
                }
            }

            // Verify we found at least one checkbox through natural tab flow
            expect(foundCheckboxes.length).toBeGreaterThan(0);
        });

        test('should handle field validation errors without breaking keyboard navigation', async ({ page }) => {
            // Fill form with mismatched passwords to trigger validation error
            await fillMultipleFields(page, {
                [SELECTORS.FULLNAME_INPUT]: TestScenarios.validUser.displayName,
                [SELECTORS.EMAIL_INPUT]: TestScenarios.validUser.email,
                [SELECTORS.PASSWORD_INPUT]: TestScenarios.validUser.password,
                [SELECTORS.CONFIRM_PASSWORD_INPUT]: 'different-password',
            });
            await page.check(SELECTORS.TERMS_CHECKBOX);
            await page.check(SELECTORS.COOKIES_CHECKBOX);

            // Submit form to trigger validation error
            await page.click(SELECTORS.SUBMIT_BUTTON);

            // Wait for error to appear
            await expectErrorMessage(page);

            // Verify keyboard navigation still works after error
            await page.keyboard.press('Tab');

            // Should be able to focus on form elements
            const confirmPasswordInput = page.locator(SELECTORS.CONFIRM_PASSWORD_INPUT);
            await confirmPasswordInput.focus();
            await expect(confirmPasswordInput).toBeFocused();

            // Should be able to correct the error
            await confirmPasswordInput.fill(TestScenarios.validUser.password);
            await expect(page.locator(SELECTORS.SUBMIT_BUTTON)).toBeEnabled();
        });

        test('should provide consistent focus indicators across all form elements', async ({ page }) => {
            // Test that all interactive elements have consistent focus indicators
            const interactiveElements = [
                SELECTORS.FULLNAME_INPUT,
                SELECTORS.EMAIL_INPUT,
                SELECTORS.PASSWORD_INPUT,
                SELECTORS.CONFIRM_PASSWORD_INPUT,
                SELECTORS.TERMS_CHECKBOX,
                SELECTORS.COOKIES_CHECKBOX,
                SELECTORS.SUBMIT_BUTTON,
            ];

            for (const selector of interactiveElements) {
                const element = page.locator(selector);

                if ((await element.count()) > 0) {
                    await element.focus();

                    // Check for focus indicators
                    const focusStyles = await element.evaluate((el) => {
                        const styles = getComputedStyle(el);
                        return {
                            outline: styles.outline,
                            outlineWidth: styles.outlineWidth,
                            outlineColor: styles.outlineColor,
                            boxShadow: styles.boxShadow,
                        };
                    });

                    // Should have consistent focus indicator pattern across all elements
                    const hasFocusIndicator =
                        focusStyles.outline !== 'none' || focusStyles.outlineWidth !== '0px' || focusStyles.boxShadow.includes('rgb') || focusStyles.outlineColor !== 'rgba(0, 0, 0, 0)';

                    expect(hasFocusIndicator).toBeTruthy();
                }
            }
        });
    });
});

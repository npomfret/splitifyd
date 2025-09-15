import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    fillFormField,
    expectButtonState,
    verifyNavigation,
    expectElementVisible,
    verifyFormAccessibility,
    expectErrorMessage,
    SELECTORS,
    TEST_SCENARIOS
} from './test-helpers';

/**
 * TODO: Add tests for success state transition and Firebase integration
 * Currently missing core reset password journey:
 * - Form submission → Success state transition
 * - Email confirmation display in success state
 * - "Send to different email" → Form state transition
 * - State clearing and error handling between states
 * Requires proper Firebase mocking or emulator setup
 */

/**
 * High-value reset password tests that verify actual user behavior
 * These tests focus on form validation, state transitions, and user interactions
 */
test.describe('ResetPasswordPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/reset-password');
    });

    test('should render all required form elements', async ({ page }) => {
        // Test that essential form elements are present
        await expectElementVisible(page, 'input[type="email"]');
        await expectElementVisible(page, SELECTORS.SUBMIT_BUTTON);
        await expectElementVisible(page, SELECTORS.BACK_TO_LOGIN_BUTTON);

        // Test form accessibility
        await verifyFormAccessibility(page, [
            { selector: 'input[type="email"]', type: 'email' }
        ]);

        // Test form attributes
        await expect(page.locator('input[type="email"]')).toHaveAttribute('placeholder', 'Enter your email address');
        await expect(page.locator('input[type="email"]')).toHaveAttribute('required');
        await expect(page.locator('input[type="email"]')).toHaveAttribute('autofocus');

        // Test submit button is initially disabled
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Test descriptive text is present
        await expect(page.locator('text=Enter the email address associated with your account')).toBeVisible();
    });

    test('should handle email input correctly', async ({ page }) => {
        const emailSelector = 'input[type="email"]';

        // Initially submit button should be disabled
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Test email input functionality
        await fillFormField(page, emailSelector, TEST_SCENARIOS.VALID_EMAIL);

        // Submit button should be enabled with valid email
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');

        // Test clearing email disables button again
        await fillFormField(page, emailSelector, '');
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Test whitespace-only email keeps button disabled
        await fillFormField(page, emailSelector, '   ');
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');
    });

    test('should prevent submission with empty email', async ({ page }) => {
        // Button should be disabled initially
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Fill with whitespace only - should remain disabled
        await fillFormField(page, 'input[type="email"]', '   ');
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'disabled');

        // Fill with actual email - should become enabled
        await fillFormField(page, 'input[type="email"]', TEST_SCENARIOS.VALID_EMAIL);
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');
    });

    test('should accept various email formats', async ({ page }) => {
        const emailSelector = 'input[type="email"]';
        const testEmails = ['invalid-email', 'user@domain', TEST_SCENARIOS.VALID_EMAIL];

        // Test various email formats (button enabled based on presence, not validation)
        for (const email of testEmails) {
            await fillFormField(page, emailSelector, email);
            await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');
        }
    });

    test('should have correct submit button text', async ({ page }) => {
        const submitButton = page.locator(SELECTORS.SUBMIT_BUTTON);

        // Check initial button text
        await expect(submitButton).toContainText('Send Reset Instructions');
    });

    test('should show error message when submission fails', async ({ page }) => {
        const emailSelector = 'input[type="email"]';

        // Fill email and submit (will fail due to no Firebase setup in tests)
        await fillFormField(page, emailSelector, TEST_SCENARIOS.VALID_EMAIL);
        await page.click(SELECTORS.SUBMIT_BUTTON);

        // Wait for error to appear (Firebase will fail and show error)
        await expectErrorMessage(page, undefined, 10000);

        // Should remain in form state (not transition to success)
        await expectElementVisible(page, emailSelector);

        // Email should still be in the field
        await expect(page.locator(emailSelector)).toHaveValue(TEST_SCENARIOS.VALID_EMAIL);

        // Should be able to try again
        await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');
    });

    test('should navigate back to sign in correctly', async ({ page }) => {
        // Test navigation from form state
        await page.click(SELECTORS.BACK_TO_LOGIN_BUTTON);
        await verifyNavigation(page, '/login');
    });

    test('should have correct form structure and accessibility', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');

        // Check accessibility attributes
        await expect(emailInput).toHaveAttribute('required');
        await expect(emailInput).toHaveAttribute('autofocus');
        await expect(emailInput).toHaveAttribute('autocomplete', 'email');
        await expect(emailInput).toHaveAttribute('aria-required', 'true');

        // Check form structure
        await expectElementVisible(page, 'form');
        await expectElementVisible(page, 'fieldset');
    });


    test('should accept various valid email formats', async ({ page }) => {
        const emailSelector = 'input[type="email"]';
        const validEmails = [
            'user@example.com',
            'user.name@example.com',
            'user+tag@example-domain.co.uk',
            'test123@sub.domain.org'
        ];

        // Test different email formats
        for (const email of validEmails) {
            await fillFormField(page, emailSelector, email);
            await expectButtonState(page, SELECTORS.SUBMIT_BUTTON, 'enabled');
        }
    });

    test('should maintain email values during input interactions', async ({ page }) => {
        const emailSelector = 'input[type="email"]';

        // Test various input patterns
        await fillFormField(page, emailSelector, TEST_SCENARIOS.VALID_EMAIL);
        await fillFormField(page, emailSelector, '');
        await fillFormField(page, emailSelector, 'newuser@domain.com');

        // Test incremental typing
        await page.locator(emailSelector).fill('');
        await page.locator(emailSelector).type('typed@example.org');
        await expect(page.locator(emailSelector)).toHaveValue('typed@example.org');
    });
});
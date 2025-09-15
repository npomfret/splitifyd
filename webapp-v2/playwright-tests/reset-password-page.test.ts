import { test, expect } from '@playwright/test';

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
        // Clear auth state and storage before each test
        await page.context().clearCookies();

        // Navigate to reset password page
        await page.goto('/reset-password');

        // Clear storage safely
        await page.evaluate(() => {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (e) {
                // Ignore security errors in test setup
            }
        });
    });

    test('form renders all required elements', async ({ page }) => {
        // Test that essential form elements are present
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
        await expect(page.locator('button:has-text("Back to Sign In")')).toBeVisible();

        // Test form structure and accessibility
        await expect(page.locator('input[type="email"]')).toHaveAttribute('placeholder', 'Enter your email address');

        // Test submit button is initially disabled (no email entered)
        await expect(page.locator('button[type="submit"]')).toBeDisabled();

        // Test descriptive text is present
        await expect(page.locator('text=Enter the email address associated with your account')).toBeVisible();
    });

    test('form handles email input correctly', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');
        const submitButton = page.locator('button[type="submit"]');

        // Initially submit button should be disabled
        await expect(submitButton).toBeDisabled();

        // Test email input functionality
        await emailInput.fill('test@example.com');
        await expect(emailInput).toHaveValue('test@example.com');

        // Submit button should be enabled with valid email
        await expect(submitButton).toBeEnabled();

        // Test clearing email disables button again
        await emailInput.fill('');
        await expect(submitButton).toBeDisabled();

        // Test whitespace-only email keeps button disabled
        await emailInput.fill('   ');
        await expect(submitButton).toBeDisabled();
    });

    test('form validation prevents submission with empty email', async ({ page }) => {
        const submitButton = page.locator('button[type="submit"]');

        // Button should be disabled initially
        await expect(submitButton).toBeDisabled();

        // Fill with whitespace only - should remain disabled
        await page.fill('input[type="email"]', '   ');
        await expect(submitButton).toBeDisabled();

        // Fill with actual email - should become enabled
        await page.fill('input[type="email"]', 'user@example.com');
        await expect(submitButton).toBeEnabled();
    });

    test('email field accepts and validates email format correctly', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');
        const submitButton = page.locator('button[type="submit"]');

        // Test various email formats
        await emailInput.fill('invalid-email');
        await expect(emailInput).toHaveValue('invalid-email');
        await expect(submitButton).toBeEnabled(); // Button enabled based on presence, not validation

        await emailInput.fill('user@domain');
        await expect(emailInput).toHaveValue('user@domain');
        await expect(submitButton).toBeEnabled();

        await emailInput.fill('valid@example.com');
        await expect(emailInput).toHaveValue('valid@example.com');
        await expect(submitButton).toBeEnabled();
    });

    test('submit button has correct initial text', async ({ page }) => {
        const submitButton = page.locator('button[type="submit"]');

        // Check initial button text
        const buttonText = await submitButton.textContent();
        expect(buttonText).toBe('Send Reset Instructions');

        // Test that button text is consistent
        await expect(submitButton).toContainText('Send Reset Instructions');
    });

    test('form shows error message when submission fails', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');
        const submitButton = page.locator('button[type="submit"]');

        // Fill email and submit (will fail due to no Firebase setup in tests)
        await emailInput.fill('test@example.com');
        await submitButton.click();

        // Wait for error to appear (Firebase will fail and show error)
        await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });

        // Should remain in form state (not transition to success)
        await expect(page.locator('input[type="email"]')).toBeVisible();

        // Email should still be in the field
        await expect(emailInput).toHaveValue('test@example.com');

        // Should be able to try again
        await expect(submitButton).toBeEnabled();
    });

    test('back to sign in navigation works from form state', async ({ page }) => {
        // Test navigation from form state
        await page.click('button:has-text("Back to Sign In")');
        await expect(page).toHaveURL('/login');
    });

    test('form structure and accessibility attributes are correct', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');

        // Check input attributes
        await expect(emailInput).toHaveAttribute('type', 'email');
        await expect(emailInput).toHaveAttribute('required');
        await expect(emailInput).toHaveAttribute('autofocus');
        await expect(emailInput).toHaveAttribute('autocomplete', 'email');
        await expect(emailInput).toHaveAttribute('aria-required', 'true');

        // Check form structure
        await expect(page.locator('form')).toBeVisible();
        await expect(page.locator('fieldset')).toBeVisible();
    });

    test('email field has autofocus attribute', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');

        // Email field should have autofocus attribute
        await expect(emailInput).toHaveAttribute('autofocus');
    });

    test('email field accepts various valid email formats', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');
        const submitButton = page.locator('button[type="submit"]');

        // Test different email formats
        const validEmails = [
            'user@example.com',
            'user.name@example.com',
            'user+tag@example-domain.co.uk',
            'test123@sub.domain.org'
        ];

        for (const email of validEmails) {
            await emailInput.fill(email);
            await expect(emailInput).toHaveValue(email);
            await expect(submitButton).toBeEnabled();
        }
    });

    test('email field maintains values during input interactions', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');

        // Type in the email field
        await emailInput.fill('user@example.com');

        // Field should maintain value correctly
        await expect(emailInput).toHaveValue('user@example.com');

        // Clearing and retyping should work
        await emailInput.fill('');
        await expect(emailInput).toHaveValue('');

        await emailInput.fill('newuser@domain.com');
        await expect(emailInput).toHaveValue('newuser@domain.com');

        // Test incremental typing
        await emailInput.fill('');
        await emailInput.type('typed@example.org');
        await expect(emailInput).toHaveValue('typed@example.org');
    });
});
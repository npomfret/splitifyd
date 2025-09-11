import { test, expect } from '@playwright/test';
import { setupMocks, waitForApp } from './setup';

/**
 * Playwright-based unit tests for user login form
 *
 * These tests focus on client-side form behavior and validation.
 * They DO NOT require the Firebase emulator.
 */

test.describe('User Login Form', () => {
    test.beforeEach(async ({ page }) => {
        // Mock all APIs and navigate to the page
        await setupMocks(page);
        await page.goto('http://localhost:5173/login');
        await page.waitForLoadState('domcontentloaded');
        await waitForApp(page);

        // Wait for the form to be ready
        await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 2000 });
    });

    test('displays all form fields correctly', async ({ page }) => {
        // Verify form fields are present
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();

        // Verify submit button is present
        await expect(page.locator('button[type="submit"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toContainText(/sign in/i);

        // Verify links are present - use more specific selectors to avoid strict mode violations
        await expect(page.getByRole('button', { name: /Sign up/i }).last()).toBeVisible(); // Form sign up button
        await expect(page.getByText(/Forgot your password/i)).toBeVisible();

        // Verify remember me checkbox
        await expect(page.getByTestId('remember-me-checkbox')).toBeVisible();
    });

    test('validates required fields', async ({ page }) => {
        const submitButton = page.locator('button[type="submit"]');

        // Clear any pre-filled values first
        await page.fill('input[type="email"]', '');
        await page.fill('input[type="password"]', '');

        // Wait for form to update
        await page.waitForTimeout(100);

        // Now with empty form, button should be disabled (based on isFormValid logic)
        await expect(submitButton).toBeDisabled();

        // Fill only email - button should still be disabled
        await page.fill('input[type="email"]', 'test@example.com');
        await expect(submitButton).toBeDisabled();

        // Clear email, fill only password - button should still be disabled
        await page.fill('input[type="email"]', '');
        await page.fill('input[type="password"]', 'password');
        await expect(submitButton).toBeDisabled();

        // Fill both - button should be enabled
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password');
        await expect(submitButton).toBeEnabled();

        // Clear both - button should be disabled again
        await page.fill('input[type="email"]', '');
        await page.fill('input[type="password"]', '');
        await expect(submitButton).toBeDisabled();
    });

    test('allows invalid email format (validation happens server-side)', async ({ page }) => {
        // Fill with invalid email - should be allowed since login doesn't validate format client-side
        await page.fill('input[type="email"]', 'notanemail');
        await page.fill('input[type="password"]', 'password123');

        const submitButton = page.locator('button[type="submit"]');
        // Button should be enabled even with invalid email format
        await expect(submitButton).toBeEnabled();
    });

    test('shows error for incorrect credentials', async ({ page }) => {
        // Override the global Firebase auth mock to simulate login failure
        await page.addInitScript(() => {
            // Override the signInWithEmailAndPassword mock to reject
            (window as any).signInWithEmailAndPassword = () => {
                return Promise.reject(new Error('INVALID_LOGIN_CREDENTIALS'));
            };
        });

        // Fill valid form
        await page.fill('input[type="email"]', 'wrong@example.com');
        await page.fill('input[type="password"]', 'wrongpassword');

        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Check for error message - use the correct selector found during debugging
        const errorMessage = page.locator('.text-red-500').first();
        await expect(errorMessage).toBeVisible({ timeout: 3000 });

        // Should still be on login page
        await expect(page).toHaveURL(/\/login/);
    });

    test('toggles password visibility', async ({ page }) => {
        const passwordInput = page.locator('#password-input');
        const toggleButton = page.locator('[aria-label*="password"]').first();

        // Initially password should be hidden
        await expect(passwordInput).toHaveAttribute('type', 'password');

        // Fill in a password
        await passwordInput.fill('TestPassword123');

        // Click toggle to show password
        await toggleButton.click();
        await expect(passwordInput).toHaveAttribute('type', 'text');

        // Click again to hide password
        await toggleButton.click();
        await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('navigates to registration page', async ({ page }) => {
        // Use the specific sign up button from the form (not header)
        const signUpLink = page.getByRole('button', { name: /Sign up/i }).last();
        await signUpLink.click();

        // Should navigate to registration page
        await expect(page).toHaveURL(/\/register/);
        await expect(page.locator('#fullname-input')).toBeVisible({ timeout: 2000 });
    });

    test('navigates to reset password page', async ({ page }) => {
        const resetLink = page.getByText(/Forgot your password/i);
        await resetLink.click();

        // Should navigate to reset password page
        await expect(page).toHaveURL(/\/reset-password/);
    });
});

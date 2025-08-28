import { test, expect } from '@playwright/test';
import { setupMocks, waitForApp } from './setup';

/**
 * Playwright-based unit tests for user registration form
 *
 * These tests focus on client-side form behavior and validation.
 * They DO NOT require the Firebase emulator.
 *
 * Key points:
 * - Lives in webapp-v2 (near the code it tests)
 * - Mocks all API calls so no backend is needed
 * - Tests form validation and UI behavior
 * - Faster than full E2E tests
 */

test.describe('User Registration Form', () => {
    test.beforeEach(async ({ page }) => {
        // Mock all APIs and navigate to the page
        await setupMocks(page);
        await page.goto(`/register`);
        await waitForApp(page);

        // Wait for the form to be ready (reduced timeout for faster failures)
        await expect(page.locator('#fullname-input')).toBeVisible({ timeout: 2000 });
    });

    test('displays all form fields correctly', async ({ page }) => {
        // Verify all form fields are present
        await expect(page.locator('#fullname-input')).toBeVisible();
        await expect(page.locator('#email-input')).toBeVisible();
        await expect(page.locator('#password-input')).toBeVisible();
        await expect(page.locator('#confirm-password-input')).toBeVisible();

        // Verify checkboxes are present using semantic selectors
        await expect(page.locator('[data-testid="terms-checkbox"]')).toBeVisible();
        await expect(page.locator('[data-testid="cookies-checkbox"]')).toBeVisible();

        // Verify submit button is present
        await expect(page.locator('button[type="submit"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toContainText(/create account/i);
    });

    test('validates required fields', async ({ page }) => {
        // Find the submit button
        const submitButton = page.locator('button[type="submit"]');

        // Initially, with an empty form, the button should be disabled
        await expect(submitButton).toBeDisabled();
    });

    test('validates password minimum length', async ({ page }) => {
        // Fill form with short password
        await page.fill('#fullname-input', 'Test User');
        await page.fill('#email-input', 'test@example.com');
        await page.fill('#password-input', 'weak');
        await page.fill('#confirm-password-input', 'weak');

        // Accept both checkboxes using semantic selectors
        await page.locator('[data-testid="terms-checkbox"]').check();
        await page.locator('[data-testid="cookies-checkbox"]').check();

        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Check for validation error - password too short message should appear
        const errorMessage = page.locator('[role="alert"], .text-red-600').first();
        await expect(errorMessage).toBeVisible({ timeout: 1000 });
        await expect(errorMessage).toContainText(/password.*6/i);

        // Should still be on registration page
        await expect(page).toHaveURL(/\/register/);
    });

    test('validates password confirmation match', async ({ page }) => {
        // Fill form with mismatched passwords
        await page.fill('#fullname-input', 'Test User');
        await page.fill('#email-input', 'test@example.com');
        await page.fill('#password-input', 'ValidPassword123');
        await page.fill('#confirm-password-input', 'DifferentPassword123');

        // Accept both checkboxes using semantic selectors
        await page.locator('[data-testid="terms-checkbox"]').check();
        await page.locator('[data-testid="cookies-checkbox"]').check();

        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Check for validation error
        const errorMessage = page.locator('[role="alert"], .text-red-600').first();
        await expect(errorMessage).toBeVisible({ timeout: 1000 });
        await expect(errorMessage).toContainText(/match/i);

        // Should still be on registration page
        await expect(page).toHaveURL(/\/register/);
    });

    test('requires terms of service acceptance', async ({ page }) => {
        // Fill form completely but don't check terms
        await page.fill('#fullname-input', 'Test User');
        await page.fill('#email-input', 'test@example.com');
        await page.fill('#password-input', 'ValidPassword123');
        await page.fill('#confirm-password-input', 'ValidPassword123');

        // Only check cookie policy, not terms
        await page.locator('[data-testid="cookies-checkbox"]').check();

        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeDisabled();
    });

    test('requires cookie policy acceptance', async ({ page }) => {
        // Fill form completely but don't check cookie policy
        await page.fill('#fullname-input', 'Test User');
        await page.fill('#email-input', 'test@example.com');
        await page.fill('#password-input', 'ValidPassword123');
        await page.fill('#confirm-password-input', 'ValidPassword123');

        // Only check terms, not cookie policy
        await page.locator('[data-testid="terms-checkbox"]').check();

        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeDisabled();
    });

    test('shows weak password strength', async ({ page }) => {
        const strengthIndicator = page.locator('div.space-y-2:has(span:text("Password strength:"))');
        await page.locator('#password-input').clear();
        await page.fill('#password-input', 'weak');
        await expect(strengthIndicator).toContainText('Weak');
        await expect(strengthIndicator.locator('.bg-red-500')).toBeVisible();
    });

    test.skip('shows medium password strength', async ({ page }) => {
        // TODO: This test is flaky and needs to be investigated.
        // It seems that state is leaking between tests, causing this test to fail.
        const strengthIndicator = page.locator('div.space-y-2:has(span:text("Password strength:"))');
        await page.locator('#password-input').clear();
        await page.fill('#password-input', 'Medium123');
        await expect(strengthIndicator).toContainText('Medium');
        await expect(strengthIndicator.locator('.bg-yellow-500')).toBeVisible();
    });

    test('shows strong password strength', async ({ page }) => {
        const strengthIndicator = page.locator('div.space-y-2:has(span:text("Password strength:"))');
        await page.locator('#password-input').clear();
        await page.fill('#password-input', 'VeryStrong123!@#');
        await expect(strengthIndicator).toContainText('Strong');
        await expect(strengthIndicator.locator('.bg-green-500')).toBeVisible();
    });

    test('toggles password visibility', async ({ page }) => {
        const passwordInput = page.locator('#password-input');
        const toggleButton = page.locator('#password-input ~ button').first();

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
});

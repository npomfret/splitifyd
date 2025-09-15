import { test, expect } from '@playwright/test';
import { validCredentials } from './fixtures';

/**
 * High-value register tests that verify actual user behavior
 * These tests focus on registration flow, form validation, and user interactions
 */
test.describe('RegisterPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Clear auth state and storage before each test
        await page.context().clearCookies();

        // Navigate to register page
        await page.goto('/register');

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

    test('form renders all required registration elements', async ({ page }) => {
        // Test that essential registration form elements are present
        await expect(page.locator('#fullname-input')).toBeVisible();
        await expect(page.locator('#email-input')).toBeVisible();
        await expect(page.locator('#password-input')).toBeVisible();
        await expect(page.locator('#confirm-password-input')).toBeVisible();
        await expect(page.locator('[data-testid="terms-checkbox"]')).toBeVisible();
        await expect(page.locator('[data-testid="cookies-checkbox"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // Test form accessibility and structure
        await expect(page.locator('#fullname-input')).toHaveAttribute('type', 'text');
        await expect(page.locator('#email-input')).toHaveAttribute('type', 'email');
        await expect(page.locator('#password-input')).toHaveAttribute('type', 'password');
        await expect(page.locator('#confirm-password-input')).toHaveAttribute('type', 'password');

        // Test required indicators are present (there are multiple, so check count)
        const requiredIndicators = page.locator('[data-testid="required-indicator"]');
        await expect(requiredIndicators).toHaveCount(4); // Name, email, password, confirm password
    });

    test('form handles user input correctly across all fields', async ({ page }) => {
        // Test name input
        const nameInput = page.locator('#fullname-input');
        await nameInput.fill('John Doe');
        await expect(nameInput).toHaveValue('John Doe');

        // Test email input
        const emailInput = page.locator('#email-input');
        await emailInput.fill('john@example.com');
        await expect(emailInput).toHaveValue('john@example.com');

        // Test password inputs
        const passwordInput = page.locator('#password-input');
        const confirmPasswordInput = page.locator('#confirm-password-input');

        await passwordInput.fill('mypassword123');
        await expect(passwordInput).toHaveValue('mypassword123');

        await confirmPasswordInput.fill('mypassword123');
        await expect(confirmPasswordInput).toHaveValue('mypassword123');

        // Test checkbox interactions
        const termsCheckbox = page.locator('[data-testid="terms-checkbox"]');
        const cookiesCheckbox = page.locator('[data-testid="cookies-checkbox"]');

        await expect(termsCheckbox).not.toBeChecked();
        await expect(cookiesCheckbox).not.toBeChecked();

        await termsCheckbox.check();
        await cookiesCheckbox.check();

        await expect(termsCheckbox).toBeChecked();
        await expect(cookiesCheckbox).toBeChecked();
    });

    test('form validation prevents submission with incomplete data', async ({ page }) => {
        const submitButton = page.locator('button[type="submit"]');

        // Initially disabled - no fields filled
        await expect(submitButton).toBeDisabled();

        // Fill name only - still disabled
        await page.fill('#fullname-input', 'John Doe');
        await expect(submitButton).toBeDisabled();

        // Add email - still disabled
        await page.fill('#email-input', 'john@example.com');
        await expect(submitButton).toBeDisabled();

        // Add password - still disabled
        await page.fill('#password-input', 'password123');
        await expect(submitButton).toBeDisabled();

        // Add confirm password - still disabled (no checkboxes)
        await page.fill('#confirm-password-input', 'password123');
        await expect(submitButton).toBeDisabled();

        // Check terms - still disabled (need cookies too)
        await page.check('[data-testid="terms-checkbox"]');
        await expect(submitButton).toBeDisabled();

        // Check cookies - now should be enabled
        await page.check('[data-testid="cookies-checkbox"]');
        await expect(submitButton).toBeEnabled();
    });

    test('password confirmation validation works correctly', async ({ page }) => {
        const submitButton = page.locator('button[type="submit"]');

        // Fill all required fields
        await page.fill('#fullname-input', 'John Doe');
        await page.fill('#email-input', 'john@example.com');
        await page.fill('#password-input', 'password123');
        await page.check('[data-testid="terms-checkbox"]');
        await page.check('[data-testid="cookies-checkbox"]');

        // Confirm password doesn't match - button should still be enabled (validation happens on submit)
        await page.fill('#confirm-password-input', 'differentpassword');
        await expect(submitButton).toBeEnabled();

        // Test that form shows validation error when submitted with mismatched passwords
        await submitButton.click();

        // Should see error message displayed
        await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

        // Fix confirmation password - error should clear
        await page.fill('#confirm-password-input', 'password123');
        await expect(submitButton).toBeEnabled();
    });

    test('all form fields persist in sessionStorage during session', async ({ page }) => {
        // Fill all form fields
        await page.fill('#fullname-input', 'Jane Smith');
        await page.fill('#email-input', 'jane@example.com');
        await page.fill('#password-input', 'mypassword456');
        await page.fill('#confirm-password-input', 'mypassword456');
        await page.check('[data-testid="terms-checkbox"]');
        await page.check('[data-testid="cookies-checkbox"]');

        // Wait for sessionStorage to update
        await page.waitForTimeout(100);

        // Verify all values are stored in sessionStorage
        const storedData = await page.evaluate(() => ({
            name: sessionStorage.getItem('register-form-name'),
            email: sessionStorage.getItem('register-form-email'),
            password: sessionStorage.getItem('register-form-password'),
            confirmPassword: sessionStorage.getItem('register-form-confirmPassword'),
            terms: sessionStorage.getItem('register-form-agreeToTerms'),
            cookies: sessionStorage.getItem('register-form-agreeToCookies')
        }));

        expect(storedData.name).toBe('Jane Smith');
        expect(storedData.email).toBe('jane@example.com');
        expect(storedData.password).toBe('mypassword456');
        expect(storedData.confirmPassword).toBe('mypassword456');
        expect(storedData.terms).toBe('true');
        expect(storedData.cookies).toBe('true');

        // Refresh page and verify fields are restored
        await page.reload();

        await expect(page.locator('#fullname-input')).toHaveValue('Jane Smith');
        await expect(page.locator('#email-input')).toHaveValue('jane@example.com');
        await expect(page.locator('#password-input')).toHaveValue('mypassword456');
        await expect(page.locator('#confirm-password-input')).toHaveValue('mypassword456');
        await expect(page.locator('[data-testid="terms-checkbox"]')).toBeChecked();
        await expect(page.locator('[data-testid="cookies-checkbox"]')).toBeChecked();
    });

    test('returnUrl is preserved when navigating from login page', async ({ page }) => {
        // Navigate to register with returnUrl (simulating navigation from login)
        await page.goto('/register?returnUrl=%2Fgroups%2F123');

        // Verify the URL parameter is preserved
        expect(page.url()).toContain('returnUrl=%2Fgroups%2F123');

        // Fill form to test that functionality still works with URL params
        await page.fill('#fullname-input', 'Test User');
        await page.fill('#email-input', 'test@example.com');

        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeDisabled(); // Still needs password and checkboxes
    });

    test('password input accepts different password strengths', async ({ page }) => {
        const passwordInput = page.locator('#password-input');

        // Test that weak password is accepted in the field
        await passwordInput.fill('weak');
        await expect(passwordInput).toHaveValue('weak');

        // Test that strong password is accepted
        await passwordInput.fill('StrongPassword123!');
        await expect(passwordInput).toHaveValue('StrongPassword123!');

        // Test that form accepts strong password for submission
        await page.fill('#fullname-input', 'Test User');
        await page.fill('#email-input', 'test@example.com');
        await page.fill('#confirm-password-input', 'StrongPassword123!');
        await page.check('[data-testid="terms-checkbox"]');
        await page.check('[data-testid="cookies-checkbox"]');

        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeEnabled();
    });

    test('terms and cookies links are functional', async ({ page }) => {
        // Test that terms link is present and has correct attributes
        const termsLink = page.locator('a[href="/terms"]');
        await expect(termsLink).toBeVisible();
        await expect(termsLink).toHaveAttribute('target', '_blank');

        // Test that the link text is meaningful (not just testing for link existence)
        const linkText = await termsLink.textContent();
        expect(linkText?.toLowerCase()).toContain('terms');
    });

    test('register form is accessible when user is not authenticated', async ({ page }) => {
        // Ensure clean state - no authentication
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });

        await page.goto('/register');

        // Should stay on register page and show form
        expect(page.url()).toContain('/register');
        await expect(page.locator('#fullname-input')).toBeVisible();
        await expect(page.locator('#email-input')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('form clearing works when unchecking required fields', async ({ page }) => {
        // Fill form completely
        await page.fill('#fullname-input', 'John Doe');
        await page.fill('#email-input', 'john@example.com');
        await page.fill('#password-input', 'password123');
        await page.fill('#confirm-password-input', 'password123');
        await page.check('[data-testid="terms-checkbox"]');
        await page.check('[data-testid="cookies-checkbox"]');

        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeEnabled();

        // Uncheck terms - should disable submit
        await page.uncheck('[data-testid="terms-checkbox"]');
        await expect(submitButton).toBeDisabled();

        // Re-check terms, uncheck cookies - should still be disabled
        await page.check('[data-testid="terms-checkbox"]');
        await page.uncheck('[data-testid="cookies-checkbox"]');
        await expect(submitButton).toBeDisabled();

        // Re-check cookies - should be enabled again
        await page.check('[data-testid="cookies-checkbox"]');
        await expect(submitButton).toBeEnabled();
    });
});
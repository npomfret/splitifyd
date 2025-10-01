import { test, expect } from './console-logging-fixture';
import { createMockFirebase, setupSuccessfulApiMocks } from './mock-firebase-service';
import { ClientUserBuilder } from '@splitifyd/test-support';

test.describe('Authentication Flow', () => {
    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        // Set up mock Firebase (start logged out)
        mockFirebase = await createMockFirebase(page, null);
    });

    test.afterEach(async () => {
        await mockFirebase.dispose();
    });

    test('should log in successfully and navigate to dashboard', async ({ pageWithLogging: page }) => {
        // 1. Create test user using existing builder
        const testUser = ClientUserBuilder.validUser()
            .build();

        // 2. Configure mock Firebase for this test
        mockFirebase.mockLoginSuccess(testUser);

        // 4. Navigate to login page and verify form elements
        await page.goto('/login');

        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // 5. Fill and submit login form
        await page.fill('input[type="email"]', testUser.email);
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');

        // 6. Verify successful login and navigation
        await expect(page).toHaveURL('/dashboard');
        await expect(page.getByTestId('user-menu-button')).toContainText(testUser.displayName);
        await expect(page.getByText('Your Groups')).toBeVisible();
    });

    test('should show error message for invalid credentials', async ({ pageWithLogging: page }) => {
        // 1. Navigate to login page first to ensure clean state
        await page.goto('/login');

        // 2. Configure mock Firebase for login failure
        mockFirebase.mockLoginFailure({
            code: 'auth/wrong-password',
            message: 'Invalid email or password.',
        });

        // 3. Fill and submit login form
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'wrong-password');
        await page.click('button[type="submit"]');

        // 4. Verify error handling
        await expect(page.getByTestId('error-message')).toContainText('Invalid email or password.');
        await expect(page).toHaveURL('/login');
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ pageWithLogging: page }) => {
        // 1. Navigate to login page first to ensure clean state
        await page.goto('/login');

        // Ensure page is fully loaded and form is ready
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // 2. Configure mock Firebase for network error
        mockFirebase.mockLoginFailure({
            code: 'auth/network-request-failed',
            message: 'Network error. Please check your connection.',
        });

        // 3. Fill and submit login form
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');

        // Wait for form validation and ensure submit button is enabled
        await expect(page.locator('button[type="submit"]')).toBeEnabled();
        await page.click('button[type="submit"]');

        // 4. Verify network error handling - wait for the error to appear
        await expect(page.getByTestId('error-message')).toBeVisible();
        await expect(page.getByTestId('error-message')).toContainText('Network error. Please check your connection.');
        await expect(page).toHaveURL('/login');
    });

});

test.describe('Authentication Flow - Already Authenticated', () => {
    let mockFirebase: any = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        // Create authenticated user for this test group
        const testUser = ClientUserBuilder.validUser()
            .withDisplayName('Test User')
            .build();

        await setupSuccessfulApiMocks(page);

        // Set up mock Firebase with authenticated user from the start
        mockFirebase = await createMockFirebase(page, testUser);
    });

    test.afterEach(async () => {
        await mockFirebase.dispose();
    });

    test('should redirect already authenticated user from login page', async ({ pageWithLogging: page }) => {
        // Try to navigate to login page - should redirect immediately
        await page.goto('/login');

        // Should be redirected to dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByTestId('user-menu-button')).toContainText('Test User');
    });
});
/**
 * Shared test helpers and utilities for Playwright behavioral tests
 *
 * These utilities provide consistent, reliable test patterns across all page tests.
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * Standard page setup with authentication and storage clearing
 */
export async function setupTestPage(page: Page, url: string): Promise<void> {
    // Clear auth state and storage before each test
    await page.context().clearCookies();

    // Navigate to page first to ensure localStorage is available
    await page.goto(url);

    // Clear storage safely
    await page.evaluate(() => {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (e) {
            // Ignore security errors in test setup
        }
    });
}

/**
 * Type-safe form field filling with validation
 * Note: For whitespace-only values, the browser may trim them to empty string
 */
export async function fillFormField(page: Page, selector: string, value: string): Promise<void> {
    const field = page.locator(selector);
    await field.fill(value);

    // For whitespace-only strings, browsers typically trim to empty
    const expectedValue = value.trim() === '' ? '' : value;
    await expect(field).toHaveValue(expectedValue);
}

/**
 * Consistent button state assertions
 */
export async function expectButtonState(page: Page, selector: string, state: 'enabled' | 'disabled'): Promise<void> {
    const button = page.locator(selector);
    if (state === 'enabled') {
        await expect(button).toBeEnabled();
    } else {
        await expect(button).toBeDisabled();
    }
}

/**
 * Navigation verification with timeout handling
 */
export async function verifyNavigation(page: Page, expectedUrl: string | RegExp, timeout = 5000): Promise<void> {
    if (typeof expectedUrl === 'string') {
        await expect(page).toHaveURL(expectedUrl, { timeout });
    } else {
        await expect(page).toHaveURL(expectedUrl, { timeout });
    }
}

/**
 * Wait for storage to be updated (replaces hardcoded timeouts)
 */
export async function waitForStorageUpdate(page: Page, key: string, expectedValue?: string): Promise<void> {
    await page.waitForFunction(
        ({ key, expectedValue }) => {
            const value = sessionStorage.getItem(key);
            return expectedValue ? value === expectedValue : value !== null;
        },
        { key, expectedValue },
        { timeout: 2000 }
    );
}

/**
 * Check if an element is visible and accessible
 */
export async function expectElementVisible(page: Page, selector: string): Promise<void> {
    const element = page.locator(selector);
    await expect(element).toBeVisible();
}

/**
 * Fill multiple form fields at once
 */
export async function fillMultipleFields(page: Page, fields: Record<string, string>): Promise<void> {
    for (const [selector, value] of Object.entries(fields)) {
        await fillFormField(page, selector, value);
    }
}

/**
 * Check multiple checkbox states
 */
export async function expectCheckboxStates(page: Page, checkboxes: Record<string, boolean>): Promise<void> {
    for (const [selector, shouldBeChecked] of Object.entries(checkboxes)) {
        const checkbox = page.locator(selector);
        if (shouldBeChecked) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }
}

/**
 * Verify form accessibility attributes
 */
export async function verifyFormAccessibility(page: Page, fields: { selector: string; type: string; ariaLabel?: string }[]): Promise<void> {
    for (const field of fields) {
        const element = page.locator(field.selector);
        await expect(element).toHaveAttribute('type', field.type);

        if (field.ariaLabel) {
            await expect(element).toHaveAttribute('aria-label', field.ariaLabel);
        }
    }
}

/**
 * Wait for error message to appear
 */
export async function expectErrorMessage(page: Page, expectedMessage?: string, timeout = 5000): Promise<void> {
    const errorElement = page.locator('[data-testid="error-message"]');
    await expect(errorElement).toBeVisible({ timeout });

    if (expectedMessage) {
        await expect(errorElement).toContainText(expectedMessage);
    }
}

/**
 * Mock Firebase authentication state
 */
export async function mockAuthState(page: Page, isAuthenticated: boolean, userId?: string): Promise<void> {
    await page.evaluate(({ isAuthenticated, userId }) => {
        if (isAuthenticated && userId) {
            localStorage.setItem('USER_ID', userId);
        } else {
            localStorage.removeItem('USER_ID');
        }
    }, { isAuthenticated, userId });
}

/**
 * Set up network-level Firebase Auth mocking for password reset
 */
export async function setupPasswordResetMocking(page: Page, scenario: 'success' | 'user-not-found' | 'network-error' | 'invalid-email'): Promise<void> {
    await page.route('**/**', (route) => {
        const url = route.request().url();

        // Mock Firebase config API that's needed for initialization
        if (url.includes('/api/config')) {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    firebase: {
                        apiKey: 'test-api-key',
                        authDomain: 'test-project.firebaseapp.com',
                        projectId: 'test-project',
                        storageBucket: 'test-project.appspot.com',
                        messagingSenderId: '123456789',
                        appId: 'test-app-id'
                    },
                    // No emulator URLs - we want to use production Firebase URLs that we can mock
                    firebaseAuthUrl: null,
                    firebaseFirestoreUrl: null
                })
            });
            return;
        }

        // Mock Firebase Auth REST API calls
        if (url.includes('identitytoolkit.googleapis.com') && url.includes('sendOobCode')) {
            switch (scenario) {
                case 'success':
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ email: 'test@example.com' })
                    });
                    break;
                case 'user-not-found':
                    route.fulfill({
                        status: 400,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            error: {
                                code: 400,
                                message: 'EMAIL_NOT_FOUND',
                                errors: [{
                                    message: 'EMAIL_NOT_FOUND',
                                    domain: 'global',
                                    reason: 'invalid'
                                }]
                            }
                        })
                    });
                    break;
                case 'network-error':
                    route.abort('failed');
                    break;
                case 'invalid-email':
                    route.fulfill({
                        status: 400,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            error: {
                                code: 400,
                                message: 'INVALID_EMAIL',
                                errors: [{
                                    message: 'INVALID_EMAIL',
                                    domain: 'global',
                                    reason: 'invalid'
                                }]
                            }
                        })
                    });
                    break;
                default:
                    route.continue();
            }
        } else {
            route.continue();
        }
    });
}

/**
 * Set up Firebase auth redirect simulation
 */
export async function setupAuthRedirect(page: Page): Promise<void> {
    await page.addInitScript(() => {
        // Simulate redirect behavior for authenticated users
        if (window.location.pathname === '/login' && localStorage.getItem('USER_ID')) {
            window.location.href = '/dashboard';
        }
    });
}

/**
 * Common selectors used across tests
 */
export const SELECTORS = {
    // Form inputs
    EMAIL_INPUT: '#email-input',
    PASSWORD_INPUT: '#password-input',
    CONFIRM_PASSWORD_INPUT: '#confirm-password-input',
    FULLNAME_INPUT: '#fullname-input',

    // Buttons
    SUBMIT_BUTTON: 'button[type="submit"]',
    SIGNUP_BUTTON: '[data-testid="loginpage-signup-button"]',
    FORGOT_PASSWORD_BUTTON: 'button:has-text("Forgot")',
    BACK_TO_LOGIN_BUTTON: 'button:has-text("Back to Sign In")',

    // Checkboxes
    REMEMBER_ME_CHECKBOX: '[data-testid="remember-me-checkbox"]',
    TERMS_CHECKBOX: '[data-testid="terms-checkbox"]',
    COOKIES_CHECKBOX: '[data-testid="cookies-checkbox"]',

    // Error states
    ERROR_MESSAGE: '[data-testid="error-message"]',
    REQUIRED_INDICATOR: '[data-testid="required-indicator"]',

    // Warnings
    INVALID_LINK_WARNING: '[data-testid="invalid-link-warning"]',
    UNABLE_JOIN_WARNING: '[data-testid="unable-join-warning"]',

    // Join group specific
    JOIN_GROUP_ERROR: '[data-testid="join-group-error-message"]',

    // Reset password success state
    SUCCESS_ICON: 'svg',
    SUCCESS_TITLE: 'text=Email Sent Successfully',
    SUCCESS_EMAIL_DISPLAY: 'p.font-medium.text-gray-900',
    NEXT_STEPS_SECTION: '.bg-blue-50',
    SEND_TO_DIFFERENT_EMAIL_BUTTON: 'button:has-text("Send to Different Email")',
    BACK_TO_LOGIN_FROM_SUCCESS: 'button:has-text("← Back to Sign In")',
} as const;

/**
 * Common test scenarios for reuse
 */
export const TEST_SCENARIOS = {
    VALID_EMAIL: 'test@example.com',
    VALID_PASSWORD: 'password123',
    VALID_NAME: 'John Doe',

    INVALID_EMAILS: ['invalid-email', 'user@domain', '@example.com', 'user@'],
    WEAK_PASSWORDS: ['weak', '123', 'password'],
    STRONG_PASSWORDS: ['StrongPassword123!', 'MySecureP@ssw0rd', 'Complex!Pass123'],

    EMPTY_VALUES: ['', '   ', '\t\n'],
} as const;

/**
 * Form validation helper for common patterns
 */
export async function testFormValidation(
    page: Page,
    requiredFields: string[],
    submitSelector = SELECTORS.SUBMIT_BUTTON
): Promise<void> {
    const submitButton = page.locator(submitSelector);

    // Initially button should be disabled
    await expect(submitButton).toBeDisabled();

    // Fill fields one by one and check button state
    for (let i = 0; i < requiredFields.length - 1; i++) {
        await fillFormField(page, requiredFields[i], 'test-value');
        await expect(submitButton).toBeDisabled();
    }

    // Fill last field - button should be enabled
    await fillFormField(page, requiredFields[requiredFields.length - 1], 'test-value');
    await expect(submitButton).toBeEnabled();
}

/**
 * Session storage persistence test helper
 */
export async function testSessionStoragePersistence(
    page: Page,
    testData: Record<string, { selector: string; value: string; storageKey: string }>
): Promise<void> {
    // Fill all fields
    for (const [field, data] of Object.entries(testData)) {
        await fillFormField(page, data.selector, data.value);
    }

    // Wait for storage update
    await page.waitForTimeout(100); // TODO: Replace with proper wait condition

    // Verify storage values
    const storedValues = await page.evaluate((keys) => {
        const result: Record<string, string | null> = {};
        keys.forEach(key => {
            result[key] = sessionStorage.getItem(key);
        });
        return result;
    }, Object.values(testData).map(d => d.storageKey));

    // Verify each stored value
    for (const [field, data] of Object.entries(testData)) {
        expect(storedValues[data.storageKey]).toBe(data.value);
    }

    // Refresh and verify restoration
    await page.reload();

    for (const [field, data] of Object.entries(testData)) {
        await expect(page.locator(data.selector)).toHaveValue(data.value);
    }
}
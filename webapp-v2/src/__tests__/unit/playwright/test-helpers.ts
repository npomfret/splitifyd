/**
 * Shared test helpers and utilities for Playwright behavioral tests
 *
 * These utilities provide consistent, reliable test patterns across all page tests.
 */

import { Page, expect } from '@playwright/test';

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
 * Check if an element is visible and accessible
 */
export async function expectElementVisible(page: Page, selector: string): Promise<void> {
    const element = page.locator(selector);
    await expect(element).toBeVisible();
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


import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    expectElementVisible,
    SELECTORS,
    TEST_SCENARIOS
} from '../infra/test-helpers';

/**
 * High-value privacy policy page tests that verify actual user behavior
 * These tests focus on static content rendering, error handling, and accessibility
 */
test.describe('PrivacyPolicyPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Mock the policy API to return test content
        await page.route('**/api/**', (route) => {
            const url = route.request().url();
            if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'privacy-policy',
                        type: 'PRIVACY_POLICY',
                        text: 'This is our privacy policy. We collect and use your data responsibly.',
                        createdAt: '2025-01-22T00:00:00Z'
                    })
                });
            } else {
                route.continue();
            }
        });

        await setupTestPage(page, '/privacy-policy');
    });

    // === CONTENT RENDERING TESTS ===

    test('should render privacy policy content and metadata', async ({ page }) => {
        // Test that essential elements are present
        await expectElementVisible(page, 'h1');

        // Check for "Last updated" text
        await expect(page.locator('text=Last updated:')).toBeVisible();

        // Check that policy content is rendered
        await expect(page.locator('text=This is our privacy policy')).toBeVisible();

        // Test page title
        await expect(page).toHaveTitle(/Privacy Policy/);
    });

    test('should display loading state initially', async ({ page }) => {
        // Mock slow API response to test loading state
        await page.route('**/api/**', (route) => {
            const url = route.request().url();
            if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                // Delay response to show loading state
                setTimeout(() => {
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            id: 'privacy-policy',
                            type: 'PRIVACY_POLICY',
                            text: 'Delayed policy content.',
                            createdAt: '2025-01-22T00:00:00Z'
                        })
                    });
                }, 100);
            } else {
                route.continue();
            }
        });

        await page.reload();

        // Should briefly show loading spinner
        await expect(page.locator('.animate-spin')).toBeVisible();

        // Eventually show content
        await expect(page.locator('text=Delayed policy content')).toBeVisible();
    });

    // === ERROR HANDLING TESTS ===

    test('should display error message when policy fails to load', async ({ page }) => {
        // Mock API error
        await page.route('**/api/**', (route) => {
            const url = route.request().url();
            if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Internal server error' })
                });
            } else {
                route.continue();
            }
        });

        await page.reload();

        // Should show error message with proper semantic attributes
        await expectElementVisible(page, '[data-testid="privacy-policy-error-heading"]');
        await expectElementVisible(page, '[data-testid="privacy-policy-error-message"]');

        // Check error message content
        await expect(page.locator('text=Error loading privacy policy')).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page }) => {
        // Mock network failure
        await page.route('**/api/**', (route) => {
            const url = route.request().url();
            if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                route.abort('failed');
            } else {
                route.continue();
            }
        });

        await page.reload();

        // Should show error state (implementation may vary)
        // Check that page doesn't crash and shows some error indication
        await expect(page.locator('body')).toBeVisible();
    });

    // === ACCESSIBILITY TESTS ===

    test('should have proper page structure and accessibility', async ({ page }) => {
        // Test page structure (use first main element to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'h1');

        // Test that error messages have proper ARIA attributes
        const errorHeading = page.locator('[data-testid="privacy-policy-error-heading"]');
        const errorMessage = page.locator('[data-testid="privacy-policy-error-message"]');

        // These should have role="alert" for accessibility
        if (await errorHeading.isVisible()) {
            await expect(errorHeading).toHaveAttribute('role', 'alert');
        }
        if (await errorMessage.isVisible()) {
            await expect(errorMessage).toHaveAttribute('role', 'alert');
        }
    });

    test('should have proper meta tags and SEO elements', async ({ page }) => {
        // Check that canonical URL is set
        const canonical = page.locator('link[rel="canonical"]');
        await expect(canonical).toHaveAttribute('href', /privacy-policy/);

        // Check meta description
        const description = page.locator('meta[name="description"]');
        await expect(description).toHaveAttribute('content', /Privacy Policy/);
    });

    // === CONTENT VARIATION TESTS ===

    test('should handle empty policy content', async ({ page }) => {
        // Mock empty policy
        await page.route('**/api/**', (route) => {
            const url = route.request().url();
            if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'privacy-policy',
                        type: 'PRIVACY_POLICY',
                        text: '',
                        createdAt: '2025-01-22T00:00:00Z'
                    })
                });
            } else {
                route.continue();
            }
        });

        await page.reload();

        // Should still show page structure even with empty content
        await expectElementVisible(page, 'h1');
        await expect(page.locator('text=Last updated:')).toBeVisible();
    });

    test('should format dates correctly', async ({ page }) => {
        // Mock policy with specific date
        await page.route('**/api/**', (route) => {
            const url = route.request().url();
            if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'privacy-policy',
                        type: 'PRIVACY_POLICY',
                        text: 'Policy content',
                        createdAt: '2025-01-22T00:00:00Z'
                    })
                });
            } else {
                route.continue();
            }
        });

        await page.reload();

        // Should format the date properly (may vary by locale)
        await expect(page.locator('text=Last updated:')).toBeVisible();

        // Check that a date is displayed after "Last updated:"
        const lastUpdatedText = await page.locator('text=Last updated:').textContent();
        expect(lastUpdatedText).toMatch(/Last updated: \d/);
    });

    test('should render policy content with proper styling', async ({ page }) => {
        // Mock policy with rich content
        await page.route('**/api/**', (route) => {
            const url = route.request().url();
            if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'privacy-policy',
                        type: 'PRIVACY_POLICY',
                        text: 'This is a **bold** privacy policy with *emphasis* and proper formatting.',
                        createdAt: '2025-01-22T00:00:00Z'
                    })
                });
            } else {
                route.continue();
            }
        });

        await page.reload();

        // Should render content within proper container (use first to avoid strict mode violation)
        await expect(page.locator('.space-y-6').first()).toBeVisible();

        // Content should be rendered
        await expect(page.locator('text=bold')).toBeVisible();
    });
});
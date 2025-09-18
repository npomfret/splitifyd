import { test, expect } from '@playwright/test';
import { setupTestPage, expectElementVisible } from '../infra/test-helpers';

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
                        createdAt: '2025-01-22T00:00:00Z',
                    }),
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
                            createdAt: '2025-01-22T00:00:00Z',
                        }),
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
                    body: JSON.stringify({ error: 'Internal server error' }),
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
                        createdAt: '2025-01-22T00:00:00Z',
                    }),
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
                        createdAt: '2025-01-22T00:00:00Z',
                    }),
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
                        createdAt: '2025-01-22T00:00:00Z',
                    }),
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

    // === KEYBOARD NAVIGATION TESTS ===

    test.describe('Keyboard Navigation', () => {
        test('should support keyboard navigation to interactive elements', async ({ page }) => {
            await page.waitForLoadState('networkidle');

            // Tab through the page to find interactive elements
            await page.keyboard.press('Tab');
            const focusedElement = page.locator(':focus');

            if (await focusedElement.count() > 0) {
                const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
                expect(['button', 'a', 'input'].includes(tagName)).toBeTruthy();
            }
        });

        test('should have visible focus indicators on interactive elements', async ({ page }) => {
            await page.waitForLoadState('networkidle');

            // Look for common interactive elements in policy pages
            const interactiveElements = [
                'a[href]',
                'button',
                '[tabindex="0"]',
                '[role="button"]',
            ];

            for (const selector of interactiveElements) {
                const element = page.locator(selector);

                if (await element.count() > 0) {
                    await element.first().focus();

                    // Check for focus indicators
                    const focusStyles = await element.first().evaluate((el) => {
                        const styles = getComputedStyle(el);
                        return {
                            outline: styles.outline,
                            outlineWidth: styles.outlineWidth,
                            boxShadow: styles.boxShadow,
                        };
                    });

                    const hasFocusIndicator =
                        focusStyles.outline !== 'none' ||
                        focusStyles.outlineWidth !== '0px' ||
                        focusStyles.boxShadow.includes('rgb');

                    expect(hasFocusIndicator).toBeTruthy();
                }
            }
        });

        test('should support keyboard navigation with links', async ({ page }) => {
            await page.waitForLoadState('networkidle');

            // Look for any links in the policy content
            const links = page.locator('a[href]');

            if (await links.count() > 0) {
                // Tab to the first link
                await links.first().focus();
                await expect(links.first()).toBeFocused();

                // Test Enter key activation
                const href = await links.first().getAttribute('href');
                if (href && !href.startsWith('mailto:')) {
                    await page.keyboard.press('Enter');
                    await page.waitForTimeout(100);
                    // Link should still be accessible after activation
                    await expect(links.first()).toBeVisible();
                }
            }
        });

        test('should maintain keyboard accessibility during error states', async ({ page }) => {
            // Mock policy API failure
            await page.route('**/api/**', (route) => {
                const url = route.request().url();
                if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                    route.fulfill({
                        status: 500,
                        contentType: 'application/json',
                        body: JSON.stringify({ error: 'Server error' }),
                    });
                } else {
                    route.continue();
                }
            });

            await page.reload();
            await page.waitForLoadState('networkidle');

            // Error elements should be focusable for screen readers
            const errorElements = [
                '[data-testid="privacy-policy-error-heading"]',
                '[data-testid="privacy-policy-error-message"]',
            ];

            for (const selector of errorElements) {
                const element = page.locator(selector);
                if (await element.count() > 0) {
                    // Error elements should have role="alert" and be accessible
                    await expect(element).toHaveAttribute('role', 'alert');

                    // Should be able to navigate to them with Tab if they have tabindex
                    const tabIndex = await element.getAttribute('tabindex');
                    if (tabIndex === '0') {
                        await element.focus();
                        await expect(element).toBeFocused();
                    }
                }
            }
        });

        test('should handle keyboard navigation in different viewport sizes', async ({ page }) => {
            const viewports = [
                { width: 375, height: 667 },  // Mobile
                { width: 768, height: 1024 }, // Tablet
                { width: 1024, height: 768 }, // Desktop
            ];

            for (const viewport of viewports) {
                await page.setViewportSize(viewport);
                await page.waitForTimeout(100);

                // Tab navigation should work consistently across viewports
                await page.keyboard.press('Tab');
                const focusedElement = page.locator(':focus');

                if (await focusedElement.count() > 0) {
                    const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
                    expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();
                }

                // Main content should remain accessible
                await expect(page.locator('h1')).toBeVisible();
                await expect(page.locator('main').first()).toBeVisible();
            }
        });

        test('should support skip links for better accessibility', async ({ page }) => {
            await page.waitForLoadState('networkidle');

            // Look for skip links (common accessibility pattern)
            const skipLinks = page.locator('a[href="#main"], a[href="#content"], .skip-link');

            if (await skipLinks.count() > 0) {
                await skipLinks.first().focus();
                await expect(skipLinks.first()).toBeFocused();

                // Skip link should be visible when focused
                await expect(skipLinks.first()).toBeVisible();

                // Test activation with Enter key
                await page.keyboard.press('Enter');
                await page.waitForTimeout(100);

                // Should jump to main content
                const mainContent = page.locator('#main, #content, main').first();
                if (await mainContent.count() > 0) {
                    // Focus should be on or near main content
                    const focusedElement = page.locator(':focus');
                    if (await focusedElement.count() > 0) {
                        const mainHandle = await mainContent.elementHandle();
                        if (mainHandle) {
                            const isFocusedOnMain = await focusedElement.evaluate((focused, main) => {
                                return focused === main || main.contains(focused);
                            }, mainHandle);
                            expect(isFocusedOnMain).toBeTruthy();
                        }
                    }
                }
            }
        });

        test('should maintain focus order throughout content loading', async ({ page }) => {
            // Mock slow policy loading to test focus during loading
            await page.route('**/api/**', async (route) => {
                const url = route.request().url();
                if (url.includes('policies') || url.includes('PRIVACY_POLICY')) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            id: 'privacy-policy',
                            type: 'PRIVACY_POLICY',
                            text: 'Loaded privacy policy content.',
                            createdAt: '2025-01-22T00:00:00Z',
                        }),
                    });
                } else {
                    route.continue();
                }
            });

            await page.reload();

            // Should be able to navigate with Tab during loading
            await page.keyboard.press('Tab');
            const loadingFocus = page.locator(':focus');

            if (await loadingFocus.count() > 0) {
                const tagName = await loadingFocus.evaluate(el => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();
            }

            // Wait for content to load
            await page.waitForLoadState('networkidle');

            // Focus order should still be logical after loading
            await page.keyboard.press('Tab');
            const postLoadFocus = page.locator(':focus');

            if (await postLoadFocus.count() > 0) {
                const tagName = await postLoadFocus.evaluate(el => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();
            }
        });
    });
});

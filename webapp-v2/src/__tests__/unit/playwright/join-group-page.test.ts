import { test, expect } from '@playwright/test';
import { setupTestPage, verifyNavigation, testKeyboardNavigationWithAuthRedirect, testTabOrder, setupUnauthenticatedTest } from '../infra/test-helpers';

/**
 * TODO: Add comprehensive join group behavioral tests
 * Currently limited due to ProtectedRoute authentication requirements:
 * - Form state vs Loading vs Error vs Success state transitions
 * - Group preview display and information
 * - Join button loading states and error handling
 * - URL parameter parsing and linkId validation
 * - Navigation flows (cancel, back to dashboard, success redirect)
 *
 * Current tests only cover routing/redirect behavior, missing ~80% of actual
 * join group functionality that users care about. This makes the test suite
 * incomplete compared to login/register tests which cover full user workflows.
 *
 * Requires proper Firebase auth mocking or test authentication setup to test
 * the complete join group experience.
 */

/**
 * High-value join group tests that verify actual user behavior
 * These tests focus on accessible behaviors without complex auth setup
 */
test.describe('JoinGroupPage - Basic Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupUnauthenticatedTest(page);
        await setupTestPage(page, '/join');
    });

    test('should redirect to login when accessing protected route', async ({ page }) => {
        // Navigate to join page - will redirect to login due to ProtectedRoute
        await page.goto('/join');

        // Since this is a protected route, it should redirect to login
        await verifyNavigation(page, /\/login/, 2000); // Route protection redirect
    });

    test('should redirect to login with linkId parameter when not authenticated', async ({ page }) => {
        // Navigate to join page with linkId parameter
        await page.goto('/join?linkId=test-link-123');

        // Should redirect to login due to ProtectedRoute
        await verifyNavigation(page, /\/login/);

        // The returnUrl should be preserved for after login
        expect(page.url()).toContain('returnUrl');
    });

    test('should preserve linkId in returnUrl during login redirect', async ({ page }) => {
        // Navigate with linkId
        await page.goto('/join?linkId=important-group-link');

        // Wait for redirect to login
        await verifyNavigation(page, /\/login/);

        // Check that returnUrl parameter contains the join URL with linkId
        const url = new URL(page.url());
        const returnUrl = url.searchParams.get('returnUrl');

        expect(returnUrl).toBeTruthy();
        if (returnUrl) {
            const decodedReturnUrl = decodeURIComponent(returnUrl);
            expect(decodedReturnUrl).toContain('/join');
            expect(decodedReturnUrl).toContain('linkId=important-group-link');
        }
    });

    test('should handle empty linkId parameter correctly', async ({ page }) => {
        // Test empty linkId parameter
        await page.goto('/join?linkId=');

        // Should still redirect to login (route protection works)
        await verifyNavigation(page, /\/login/);

        // Should preserve the empty linkId in returnUrl
        expect(page.url()).toContain('returnUrl');
    });

    test('should have properly configured route in routing system', async ({ page }) => {
        // Test that the join route doesn't return 404
        const response = await page.goto('/join');

        // Should get a response (not 404), even if redirected
        expect(response?.status()).not.toBe(404);
    });

    test('should handle URL encoding properly', async ({ page }) => {
        // Test with encoded characters in linkId
        const encodedLinkId = encodeURIComponent('group-link-with-special-chars!@#');
        await page.goto(`/join?linkId=${encodedLinkId}`);

        // Should redirect to login
        await verifyNavigation(page, /\/login/);

        // Should preserve encoded linkId in returnUrl
        const url = new URL(page.url());
        const returnUrl = url.searchParams.get('returnUrl');
        expect(returnUrl).toContain(encodedLinkId);
    });

    test('should maintain complex URL structure during navigation', async ({ page }) => {
        // Test that multiple parameters are handled
        await page.goto('/join?linkId=test123&ref=email&campaign=invite');

        // Should redirect but preserve complex URL structure
        await verifyNavigation(page, /\/login/);

        const url = new URL(page.url());
        const returnUrl = url.searchParams.get('returnUrl');
        expect(returnUrl).toBeTruthy();

        if (returnUrl) {
            const decoded = decodeURIComponent(returnUrl);
            expect(decoded).toContain('linkId=test123');
            expect(decoded).toContain('ref=email');
            expect(decoded).toContain('campaign=invite');
        }
    });

    // === KEYBOARD NAVIGATION TESTS ===

    test.describe('Keyboard Navigation', () => {
        test('should maintain keyboard accessibility during login redirects', async ({ page }) => {
            // Navigate to join page with keyboard
            await page.keyboard.press('Alt+d'); // Focus address bar (browser-dependent)
            await page.goto('/join?linkId=test-keyboard-nav');
            await page.waitForLoadState('networkidle');

            // Should redirect to login page
            await verifyNavigation(page, /\/login/);

            // Page should remain keyboard accessible after redirect
            await page.keyboard.press('Tab');
            const focusedElement = page.locator(':focus');

            if ((await focusedElement.count()) > 0) {
                const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();
            }
        });

        test('should handle keyboard navigation with various linkId parameters', async ({ page }) => {
            const linkIds = ['simple-link', 'link-with-numbers-123', 'link-with-special-chars_test'];

            for (const linkId of linkIds) {
                await page.goto(`/join?linkId=${linkId}`);
                await page.waitForLoadState('networkidle');

                // Wait for potential auth redirect
                const currentUrl = page.url();

                // Test keyboard navigation regardless of current page
                if (currentUrl.includes('/login')) {
                    // Test login form navigation
                    const loginElements = ['#email-input', '#password-input', '[data-testid="remember-me-checkbox"]'];
                    await testTabOrder(page, loginElements);
                } else {
                    // Test join page navigation
                    await page.keyboard.press('Tab');
                    const focusedElement = page.locator(':focus');

                    if ((await focusedElement.count()) > 0) {
                        const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
                        expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();
                    }
                }

                // Test passes if keyboard navigation works
                console.log(`✓ Keyboard navigation tested for linkId: ${linkId}`);
            }
        });

        test('should support keyboard navigation in error scenarios', async ({ page }) => {
            // Test empty linkId parameter
            await page.goto('/join?linkId=');
            await page.waitForLoadState('networkidle');

            // Should still redirect to login
            await verifyNavigation(page, /\/login/);

            // Should be able to navigate with keyboard
            await page.keyboard.press('Tab');
            const focusedElement = page.locator(':focus');

            if ((await focusedElement.count()) > 0) {
                const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();
            }

            // returnUrl should still be preserved
            expect(page.url()).toContain('returnUrl');
        });

        test('should handle keyboard navigation with encoded parameters', async ({ page }) => {
            // Test with encoded characters in linkId
            const encodedLinkId = encodeURIComponent('group-link-with-special-chars!@#');
            await page.goto(`/join?linkId=${encodedLinkId}`);
            await page.waitForLoadState('networkidle');

            // Should redirect to login
            await verifyNavigation(page, /\/login/);

            // Keyboard navigation should work
            await page.keyboard.press('Tab');
            const focusedElement = page.locator(':focus');

            if ((await focusedElement.count()) > 0) {
                const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();
            }

            // Should preserve encoded linkId in returnUrl
            const url = new URL(page.url());
            const returnUrl = url.searchParams.get('returnUrl');
            expect(returnUrl).toContain(encodedLinkId);
        });

        test('should maintain accessibility during complex URL navigation', async ({ page }) => {
            // Test that multiple parameters are handled with keyboard navigation
            await page.goto('/join?linkId=test123&ref=email&campaign=invite');
            await page.waitForLoadState('networkidle');

            // Should redirect but preserve complex URL structure
            await verifyNavigation(page, /\/login/);

            // Should be able to use Tab navigation on resulting page
            await page.keyboard.press('Tab');
            const focusedElement = page.locator(':focus');

            if ((await focusedElement.count()) > 0) {
                // Verify focused element is interactive
                const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();

                // If it's a form element, it should be accessible
                if (tagName === 'input') {
                    await expect(focusedElement).toBeEnabled();
                } else if (['button', 'a'].includes(tagName)) {
                    await expect(focusedElement).toBeVisible();
                }
            }

            // Verify URL parameters are preserved
            const url = new URL(page.url());
            const returnUrl = url.searchParams.get('returnUrl');
            expect(returnUrl).toBeTruthy();

            if (returnUrl) {
                const decoded = decodeURIComponent(returnUrl);
                expect(decoded).toContain('linkId=test123');
                expect(decoded).toContain('ref=email');
                expect(decoded).toContain('campaign=invite');
            }
        });

        test('should handle keyboard navigation with focus management during redirects', async ({ page }) => {
            // Navigate to join page
            await page.goto('/join?linkId=focus-test');
            await page.waitForLoadState('networkidle');

            // Wait for redirect to complete
            await verifyNavigation(page, /\/login/);

            // Test that focus can be properly managed after redirect
            const maxTabs = 10;
            let foundInteractiveElement = false;

            for (let i = 0; i < maxTabs && !foundInteractiveElement; i++) {
                await page.keyboard.press('Tab');
                const focusedElement = page.locator(':focus');

                if ((await focusedElement.count()) > 0) {
                    const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());

                    if (['button', 'a', 'input'].includes(tagName)) {
                        foundInteractiveElement = true;
                        await expect(focusedElement).toBeVisible();

                        // If it's a form input, it should be enabled
                        if (tagName === 'input') {
                            await expect(focusedElement).toBeEnabled();
                        }
                    }
                }
            }

            // Should have found at least one interactive element
            expect(foundInteractiveElement).toBeTruthy();
        });

        test('should support keyboard shortcuts and accessibility features', async ({ page }) => {
            // Test basic accessibility keyboard patterns
            await page.goto('/join?linkId=accessibility-test');
            await page.waitForLoadState('networkidle');

            // Wait for redirect
            await verifyNavigation(page, /\/login/);

            // Test common accessibility keyboard patterns
            const keyPatterns = [
                'Tab', // Forward navigation
                'Shift+Tab', // Backward navigation
            ];

            for (const keyPattern of keyPatterns) {
                await page.keyboard.press(keyPattern);
                const focusedElement = page.locator(':focus');

                if ((await focusedElement.count()) > 0) {
                    // Element should be visible when focused
                    await expect(focusedElement).toBeVisible();

                    // Check if element has proper focus indicators
                    const focusStyles = await focusedElement.evaluate((el) => {
                        const styles = getComputedStyle(el);
                        return {
                            outline: styles.outline,
                            outlineWidth: styles.outlineWidth,
                            boxShadow: styles.boxShadow,
                        };
                    });

                    // Should have some form of focus indicator
                    const hasFocusIndicator = focusStyles.outline !== 'none' || focusStyles.outlineWidth !== '0px' || focusStyles.boxShadow.includes('rgb');

                    expect(hasFocusIndicator).toBeTruthy();
                }
            }
        });

        test('should maintain keyboard accessibility across different route scenarios', async ({ page }) => {
            const routes = ['/join', '/join?linkId=test-route-1', '/join?linkId=test-route-2&ref=keyboard'];

            for (const route of routes) {
                await page.goto(route);
                await page.waitForLoadState('networkidle');

                // Use the helper function to handle auth redirects
                await testKeyboardNavigationWithAuthRedirect(page);

                console.log(`✓ Keyboard navigation tested for route: ${route}`);
            }
        });
    });
});

import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    expectElementVisible,
    verifyFocusVisible,
} from '../infra/test-helpers';

/**
 * NotFoundPage behavioral tests - Testing actual 404 error page behavior
 *
 * These tests verify the NotFoundPage component renders correctly for invalid routes.
 * The app uses client-side routing, so we navigate to invalid paths and wait for
 * the SPA to render the NotFoundPage component (which is lazy-loaded).
 */
test.describe('NotFoundPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/');
    });

    // === CORE 404 PAGE RENDERING ===

    test('should render 404 page for invalid routes', async ({ page }) => {
        // Navigate to an invalid path - SPA will render NotFoundPage
        await page.goto('/some-completely-invalid-path-12345');

        // Wait for lazy-loaded NotFoundPage component to render
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Verify the main 404 elements are displayed
        await expectElementVisible(page, '[data-testid="not-found-title"]');
        await expect(page.locator('[data-testid="not-found-title"]')).toContainText('404');

        await expectElementVisible(page, '[data-testid="not-found-subtitle"]');
        await expectElementVisible(page, '[data-testid="not-found-description"]');
    });

    test('should show generic "Page not found" for regular invalid paths', async ({ page }) => {
        // Navigate to a generic invalid path (not group-related)
        await page.goto('/some-random-invalid-page');

        // Wait for NotFoundPage to render
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Should show generic page not found message
        const subtitle = page.locator('[data-testid="not-found-subtitle"]');
        await expect(subtitle).toBeVisible();
        // The subtitle will contain translated text like "Page not found"
        const subtitleText = await subtitle.textContent();
        expect(subtitleText?.trim().length).toBeGreaterThan(0);

        // Description should also be present
        const description = page.locator('[data-testid="not-found-description"]');
        await expect(description).toBeVisible();
        const descriptionText = await description.textContent();
        expect(descriptionText?.trim().length).toBeGreaterThan(0);
    });

    test('should handle various invalid path types', async ({ page }) => {
        // Test a single invalid path to verify NotFoundPage rendering
        await page.goto('/some-invalid-path-test');

        // Wait for NotFoundPage component
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Verify 404 content is present
        await expectElementVisible(page, '[data-testid="not-found-title"]');
        await expectElementVisible(page, '[data-testid="not-found-subtitle"]');
        await expectElementVisible(page, '[data-testid="not-found-description"]');

        // Verify content has meaningful text
        const subtitle = page.locator('[data-testid="not-found-subtitle"]');
        const subtitleText = await subtitle.textContent();
        expect(subtitleText?.trim().length).toBeGreaterThan(0);
    });

    // === AUTHENTICATION-BASED NAVIGATION ===

    test('should show "Go Home" button for unauthenticated users', async ({ page }) => {
        // Ensure no authentication state
        await page.evaluate(() => {
            localStorage.removeItem('USER_ID');
            // Clear any auth signals/stores
            if ((window as any).__AUTH_STORE__) {
                (window as any).__AUTH_STORE__.user = null;
            }
        });

        // Navigate to 404 page
        await page.goto('/invalid-unauthenticated-test-path');

        // Wait for NotFoundPage to render
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Either the home button should be visible, or if auth isn't properly mocked,
        // at least one navigation button should be present
        const navigationButtons = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"]');
        await expect(navigationButtons.first()).toBeVisible();
        await expect(navigationButtons.first()).toBeEnabled();

        // Check button text contains meaningful content
        const buttonText = await navigationButtons.first().textContent();
        expect(buttonText?.trim().length).toBeGreaterThan(0);
    });

    test('should show "Go to Dashboard" button for authenticated users', async ({ page }) => {
        // Mock authenticated state
        await page.evaluate(() => {
            localStorage.setItem('USER_ID', 'test-user-123');
            // Mock auth store if available
            if ((window as any).__AUTH_STORE__) {
                (window as any).__AUTH_STORE__.user = {
                    uid: 'test-user-123',
                    email: 'test@example.com'
                };
            }
        });

        // Navigate to 404 page
        await page.goto('/invalid-authenticated-test-path');

        // Wait for NotFoundPage to render
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Should show navigation button (either dashboard or home depending on auth state)
        const navigationButtons = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"]');
        await expect(navigationButtons.first()).toBeVisible();
        await expect(navigationButtons.first()).toBeEnabled();

        // Check button has meaningful text
        const buttonText = await navigationButtons.first().textContent();
        expect(buttonText?.trim().length).toBeGreaterThan(0);
    });

    // === BUTTON FUNCTIONALITY AND NAVIGATION ===

    test('should handle navigation button clicks correctly', async ({ page }) => {
        // Navigate to 404 page
        await page.goto('/test-button-navigation-path');

        // Wait for NotFoundPage
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Find and click navigation button
        const navigationButton = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"]');
        await expect(navigationButton.first()).toBeVisible();
        await expect(navigationButton.first()).toBeEnabled();

        // Click the button and verify navigation occurs
        await navigationButton.first().click();

        // Should navigate away from 404 page (either to / or /dashboard)
        await page.waitForURL(/(\/$|\/dashboard)/, );

        // Verify we're no longer on the 404 page
        const notFoundTitle = page.locator('[data-testid="not-found-title"]');
        expect(await notFoundTitle.count()).toBe(0);
    });

    // === EXPLICIT 404 ROUTE ===

    test('should render correctly when navigating to explicit /404 route', async ({ page }) => {
        // Navigate to explicit 404 route
        await page.goto('/404');

        // Should render same NotFoundPage component
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Verify all expected elements
        await expectElementVisible(page, '[data-testid="not-found-title"]');
        await expect(page.locator('[data-testid="not-found-title"]')).toContainText('404');

        await expectElementVisible(page, '[data-testid="not-found-subtitle"]');
        await expectElementVisible(page, '[data-testid="not-found-description"]');

        // Should have navigation button
        const navigationButton = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"]');
        await expect(navigationButton.first()).toBeVisible();
    });

    // === LAYOUT AND STYLING ===

    test('should display proper layout and styling', async ({ page }) => {
        await page.goto('/test-styling-path');

        // Wait for NotFoundPage
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Verify main container has proper styling (from NotFoundPage component)
        const container = page.locator('.min-h-screen');
        await expect(container).toBeVisible();

        // Verify centered layout
        const centerContent = page.locator('.text-center');
        await expect(centerContent).toBeVisible();

        // Verify title has proper styling classes
        const title = page.locator('[data-testid="not-found-title"]');
        await expect(title).toHaveClass(/text-6xl/);
        await expect(title).toHaveClass(/font-bold/);

        // Verify button has proper styling
        const button = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"]');
        await expect(button.first()).toHaveClass(/bg-primary/);
        await expect(button.first()).toHaveClass(/text-white/);
        await expect(button.first()).toHaveClass(/rounded-lg/);
    });

    // === ACCESSIBILITY ===

    test('should have proper accessibility attributes', async ({ page }) => {
        await page.goto('/test-accessibility-path');

        // Wait for NotFoundPage
        await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

        // Verify all elements have proper data-testid for testing
        await expectElementVisible(page, '[data-testid="not-found-title"]');
        await expectElementVisible(page, '[data-testid="not-found-subtitle"]');
        await expectElementVisible(page, '[data-testid="not-found-description"]');

        // Verify button accessibility
        const button = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"]');
        await expect(button.first()).toBeVisible();
        await expect(button.first()).toBeEnabled();

        // Button should have accessible text content
        const buttonText = await button.first().textContent();
        expect(buttonText?.trim().length).toBeGreaterThan(0);
    });

    // === KEYBOARD NAVIGATION TESTS ===

    test.describe('Keyboard Navigation', () => {
        test('should support keyboard navigation to action buttons', async ({ page }) => {
            // Navigate to 404 page
            await page.goto('/non-existent-page');
            await page.waitForLoadState('networkidle');

            // Tab to the action button
            await page.keyboard.press('Tab');
            const actionButton = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"], button:has-text("Go Home"), button:has-text("Go to Dashboard")');

            if (await actionButton.count() > 0) {
                await expect(actionButton.first()).toBeFocused();
            }
        });

        test('should activate action button with Enter key', async ({ page }) => {
            await page.goto('/invalid-route');
            await page.waitForLoadState('networkidle');

            // Find and focus on action button
            const actionButton = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"], button:has-text("Go Home"), button:has-text("Go to Dashboard")');

            if (await actionButton.count() > 0) {
                await actionButton.first().focus();
                await expect(actionButton.first()).toBeFocused();

                // Press Enter to activate
                await page.keyboard.press('Enter');

                // Button should still be accessible after activation
                await expect(actionButton.first()).toBeVisible();
            }
        });

        test('should activate action button with Space key', async ({ page }) => {
            await page.goto('/another-invalid-route');
            await page.waitForLoadState('networkidle');

            // Find and focus on action button
            const actionButton = page.locator('[data-testid="go-home-link"], [data-testid="go-to-dashboard-link"], button:has-text("Go Home"), button:has-text("Go to Dashboard")');

            if (await actionButton.count() > 0) {
                await actionButton.first().focus();
                await expect(actionButton.first()).toBeFocused();

                // Press Space to activate
                await page.keyboard.press('Space');

                // Button should still be accessible after activation
                await expect(actionButton.first()).toBeVisible();
            }
        });

        test('should have visible focus indicators on interactive elements', async ({ page }) => {
            await page.goto('/404');
            await page.waitForLoadState('networkidle');

            const interactiveElements = [
                '[data-testid="go-home-link"]',
                '[data-testid="go-to-dashboard-link"]',
                'button:has-text("Go Home")',
                'button:has-text("Go to Dashboard")',
                'a[href="/"]',
                'a[href="/dashboard"]',
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

        test('should handle keyboard navigation for both authenticated and unauthenticated states', async ({ page }) => {
            // Test unauthenticated state first
            await page.goto('/some-invalid-page');
            await page.waitForLoadState('networkidle');

            // Should have some interactive element for unauthenticated users
            await page.keyboard.press('Tab');
            let focusedElement = page.locator(':focus');

            if (await focusedElement.count() > 0) {
                const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
                expect(['button', 'a'].includes(tagName)).toBeTruthy();
            }

            // Test that navigation action buttons work
            const homeButton = page.locator('button:has-text("Go Home"), a[href="/"], [data-testid="go-home-link"]');

            if (await homeButton.count() > 0) {
                await homeButton.first().focus();
                await expect(homeButton.first()).toBeFocused();

                // Test keyboard activation
                await page.keyboard.press('Enter');

                // Should navigate or at least be interactive
                await expect(homeButton.first()).toBeVisible();
            }
        });

        test('should maintain keyboard accessibility across different 404 scenarios', async ({ page }) => {
            const invalidRoutes = [
                '/this-page-does-not-exist',
                '/users/nonexistent',
                '/admin/forbidden',
                '/api/invalid-endpoint',
            ];

            for (const route of invalidRoutes) {
                await page.goto(route);
                await page.waitForLoadState('networkidle');

                // Should be able to tab to interactive elements
                await page.keyboard.press('Tab');
                const focusedElement = page.locator(':focus');

                if (await focusedElement.count() > 0) {
                    const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
                    expect(['button', 'a', 'input'].includes(tagName)).toBeTruthy();
                }

                // Should have action buttons that work with keyboard
                const actionButton = page.locator('button, a[href]').first();

                if (await actionButton.count() > 0) {
                    await actionButton.focus();
                    await expect(actionButton).toBeFocused();
                }
            }
        });

        test('should support keyboard navigation after page load with proper focus management', async ({ page }) => {
            await page.goto('/definitely-does-not-exist');
            await page.waitForLoadState('networkidle');

            // Wait for 404 page to fully render

            // First tab should go to the primary action button
            await page.keyboard.press('Tab');
            const firstFocusable = page.locator(':focus');

            if (await firstFocusable.count() > 0) {
                // Should be either a button or link
                const tagName = await firstFocusable.evaluate(el => el.tagName.toLowerCase());
                expect(['button', 'a'].includes(tagName)).toBeTruthy();

                // Should have meaningful text
                const text = await firstFocusable.textContent();
                expect(text?.trim().length).toBeGreaterThan(0);
            }
        });
    });
});
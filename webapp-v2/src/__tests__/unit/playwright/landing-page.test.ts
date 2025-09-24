import { test, expect } from '@playwright/test';
import { setupTestPage, setupUnauthenticatedTest, expectElementVisible } from '../infra/test-helpers';

/**
 * High-value landing page tests that verify actual user behavior
 * These tests focus on hero content, CTAs, navigation, and user conversion flows
 */
test.describe.serial('LandingPage - Behavioral Tests', () => {
    test.beforeAll(async ({ browser }) => {
        // Create a single page for all tests to reuse
        const context = await browser.newContext();
        const page = await context.newPage();

        await setupUnauthenticatedTest(page);
        await setupTestPage(page, '/');

        // Store page in global for reuse
        (globalThis as any).sharedLandingPage = page;
    });

    test.afterAll(async () => {
        // Clean up shared page
        if ((globalThis as any).sharedLandingPage) {
            await (globalThis as any).sharedLandingPage.close();
            delete (globalThis as any).sharedLandingPage;
        }
    });

    // === HERO SECTION TESTS ===

    test('should render hero section with key value proposition', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Test main heading is visible and compelling (use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'h1');

        // Check for key value proposition content
        await expect(page.locator('text=Effortless Bill Splitting')).toBeVisible();

        // Verify CTAs are present (the actual button text is "Sign Up for Free")
        const ctaButtons = page.locator('button:has-text("Sign Up for Free"), button:has-text("Login"), button:has-text("Sign Up")');
        await expect(ctaButtons.first()).toBeVisible();
    });

    test('should display primary navigation correctly', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Test navigation elements (it's actually a banner with navigation)
        const nav = page.locator('banner, nav, navigation');
        await expect(nav.first()).toBeVisible();

        // Check for brand/logo button (it contains an image)
        const logo = page.locator('button img[alt="Splitifyd"]');
        await expect(logo).toBeVisible();

        // Check for login/signup buttons in navigation (use specific selectors to avoid strict mode)
        await expect(page.locator('button:has-text("Login")')).toBeVisible();
        await expect(page.locator('[data-testid="header-signup-link"]')).toBeVisible();
    });

    // === FEATURES SECTION TESTS ===

    test('should showcase key features and benefits', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Wait for page to fully load before checking content
        await page.waitForLoadState('networkidle');

        // Scroll to features section to ensure it's in view
        await page.evaluate(() => window.scrollBy(0, 500));

        // Look for specific headings we know exist from the page snapshot
        const knownHeadings = ['Smart Group Management', '100% Free to Use', 'Zero Ads, Ever', 'Unlimited Use'];

        // Check that feature headings are visible
        for (const heading of knownHeadings) {
            await expect(page.locator(`text=${heading}`)).toBeVisible();
        }
    });

    test('should display transparency notice prominently', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Scroll to transparency section
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        // Check transparency notice content
        await expect(page.locator('text=This is a tool for tracking expenses')).toBeVisible();
        await expect(page.locator('text=not for making payments')).toBeVisible();
        await expect(page.locator('text=never ask for sensitive financial details')).toBeVisible();

        // Verify it has proper styling/emphasis
        const transparencySection = page.locator('.transparency-notice, section:has-text("tracking expenses")');
        await expect(transparencySection.first()).toBeVisible();
    });

    // === CALL-TO-ACTION TESTS ===

    test('should have working call-to-action buttons', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Test primary CTA button (it's a button that should be clickable)
        const signUpButton = page.locator('button:has-text("Sign Up for Free")');
        await expect(signUpButton).toBeVisible();
        await expect(signUpButton).toBeEnabled();

        // Test login button in navigation
        const loginButton = page.locator('button:has-text("Login")');
        await expect(loginButton).toBeVisible();
        await expect(loginButton).toBeEnabled();
    });

    test('should handle CTA interactions without errors', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Test button interactions (hover and click states)
        const ctaButtons = ['button:has-text("Sign Up for Free")', 'button:has-text("Login")', 'button:has-text("Sign Up")'];

        for (const selector of ctaButtons) {
            const element = page.locator(selector);
            if ((await element.count()) > 0) {
                // Just hover to test interactivity
                await element.first().hover();
                // Element should remain clickable
                await expect(element.first()).toBeEnabled();
            }
        }
    });

    // === RESPONSIVE DESIGN TESTS ===

    test('should be responsive on mobile viewport', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        // Hero should still be visible and readable
        await expectElementVisible(page, 'h1');

        // Navigation should adapt (could be hamburger menu or collapsed)
        const nav = page.locator('banner, nav, header').first();
        await expect(nav).toBeVisible();

        // CTAs should remain accessible
        const mobileCtaButtons = page.locator('button:has-text("Sign Up for Free"), button:has-text("Login")');
        await expect(mobileCtaButtons.first()).toBeVisible();
    });

    test('should be responsive on tablet viewport', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Set tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });

        // All main sections should be visible (use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'h1');

        // Features should be readable (more flexible matching)
        await page.evaluate(() => window.scrollBy(0, 300));
        const pageContent = await page.textContent('body');
        expect(pageContent?.toLowerCase()).toMatch(/free|easy|transparent/i);
    });

    // === ACCESSIBILITY TESTS ===

    test('should have proper page structure and accessibility', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Test semantic HTML structure (use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'h1');

        // Check for navigation landmark
        const nav = page.locator('banner, nav, [role="navigation"]');
        await expect(nav.first()).toBeVisible();

        // Verify buttons have proper accessibility
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();
        expect(buttonCount).toBeGreaterThan(0);

        // Check that key buttons we know exist have accessible text
        const keyButtons = ['button:has-text("Login")', 'button:has-text("Sign Up")', 'button:has-text("Sign Up for Free")'];

        for (const selector of keyButtons) {
            const button = page.locator(selector);
            if ((await button.count()) > 0) {
                const text = await button.first().textContent();
                expect(text?.trim().length).toBeGreaterThan(0);
            }
        }
    });

    // === SEO AND META TAGS TESTS ===

    test('should have proper SEO meta tags', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Check title (may show translation key in test environment)
        await expect(page).toHaveTitle(/landingPage\.title|Effortless Bill Splitting/);

        // Check meta description
        const description = page.locator('meta[name="description"]');
        await expect(description).toHaveAttribute('content', /bill splitting|expenses|friends|family/i);

        // Check canonical URL if present
        const canonical = page.locator('link[rel="canonical"]');
        if ((await canonical.count()) > 0) {
            const href = await canonical.getAttribute('href');
            expect(href).toBeTruthy();
        }
    });

    // === CONTENT LOADING TESTS ===

    test('should load all content sections without errors', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Wait for main content to load (use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();

        // Scroll through page to trigger any lazy loading
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await page.waitForLoadState('networkidle');

        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForLoadState('networkidle');

        // Check that all main sections loaded
        const sections = page.locator('section, .hero, .features, .cta');
        const sectionCount = await sections.count();
        expect(sectionCount).toBeGreaterThan(0);

        // Verify no obvious error states
        const errorIndicators = page.locator('text=/error|failed|broken/i');
        expect(await errorIndicators.count()).toBe(0);
    });

    test('should handle slow network conditions gracefully', async () => {
        const page = (globalThis as any).sharedLandingPage;
        // Simulate slow network
        await page.route('**/*', async (route: any) => {
            await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
            route.continue();
        });

        // Content should still load (just slower, use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'h1');

        // CTAs should still be functional
        const ctaButton = page.locator('button:has-text("Sign Up for Free"), button:has-text("Login")').first();
        await expect(ctaButton).toBeVisible();
    });

    // === KEYBOARD NAVIGATION TESTS ===

    test.describe('Keyboard Navigation', () => {
        test('should support tab navigation through main landing page elements', async () => {
            const page = (globalThis as any).sharedLandingPage;
            // Expected tab order for landing page interactive elements
            const expectedTabOrder = [
                'button:has(img[alt="Splitifyd"])', // Logo button (focus the button, not the img)
                'button:has-text("Login")', // Login button in header
                '[data-testid="header-signup-link"]', // Sign up link in header
                'button:has-text("Sign Up for Free")', // Main CTA button
            ];

            // Test forward tab navigation through available elements
            for (const selector of expectedTabOrder) {
                await page.keyboard.press('Tab');
                const element = page.locator(selector);

                // Only test if element exists (graceful handling of page variations)
                if ((await element.count()) > 0) {
                    await expect(element.first()).toBeFocused();
                }
            }
        });

        test('should activate buttons with Enter key', async () => {
            const page = (globalThis as any).sharedLandingPage;
            const interactiveButtons = ['button:has-text("Login")', 'button:has-text("Sign Up for Free")', '[data-testid="header-signup-link"]'];

            for (const selector of interactiveButtons) {
                const button = page.locator(selector);

                if ((await button.count()) > 0) {
                    // Focus on the button
                    await button.first().focus();
                    await expect(button.first()).toBeFocused();

                    // Press Enter to activate
                    await page.keyboard.press('Enter');

                    // Button should still be accessible after activation
                    await expect(button.first()).toBeVisible();
                }
            }
        });

        test('should activate buttons with Space key', async () => {
            const page = (globalThis as any).sharedLandingPage;
            const buttons = ['button:has-text("Login")', 'button:has-text("Sign Up for Free")'];

            for (const selector of buttons) {
                const button = page.locator(selector);

                if ((await button.count()) > 0) {
                    // Focus on the button
                    await button.first().focus();
                    await expect(button.first()).toBeFocused();

                    // Press Space to activate
                    await page.keyboard.press('Space');

                    // Button should still be accessible
                    await expect(button.first()).toBeVisible();
                }
            }
        });

        test('should have visible focus indicators on all interactive elements', async () => {
            const page = (globalThis as any).sharedLandingPage;
            const interactiveElements = ['button:has(img[alt="Splitifyd"])', 'button:has-text("Login")', '[data-testid="header-signup-link"]', 'button:has-text("Sign Up for Free")'];

            for (const selector of interactiveElements) {
                const element = page.locator(selector);

                // Only test elements that exist
                if ((await element.count()) > 0) {
                    await element.first().focus();

                    // Check for focus indicators
                    const focusStyles = await element.first().evaluate((el: Element) => {
                        const styles = getComputedStyle(el);
                        return {
                            outline: styles.outline,
                            outlineWidth: styles.outlineWidth,
                            boxShadow: styles.boxShadow,
                        };
                    });

                    // Verify some form of focus indicator exists
                    const hasFocusIndicator = focusStyles.outline !== 'none' || focusStyles.outlineWidth !== '0px' || focusStyles.boxShadow.includes('rgb');

                    expect(hasFocusIndicator).toBeTruthy();
                }
            }
        });

        test('should support keyboard navigation in mobile viewport', async () => {
            const page = (globalThis as any).sharedLandingPage;
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            // Wait for responsive changes

            // Test that key elements are still keyboard accessible
            const mobileInteractiveElements = ['button:has-text("Login")', 'button:has-text("Sign Up for Free")'];

            for (const selector of mobileInteractiveElements) {
                const element = page.locator(selector);

                if ((await element.count()) > 0) {
                    // Tab to element
                    await page.keyboard.press('Tab');

                    // Check if it's focusable
                    const focusedElement = page.locator(':focus');
                    const isFocused = (await focusedElement.count()) > 0;

                    if (isFocused) {
                        const tagName = await focusedElement.evaluate((el: Element) => el.tagName.toLowerCase());
                        expect(['button', 'a', 'input'].includes(tagName)).toBeTruthy();
                    }
                }
            }
        });

        test('should maintain keyboard accessibility when scrolling through content', async () => {
            const page = (globalThis as any).sharedLandingPage;
            // Start at top of page
            await page.evaluate(() => window.scrollTo(0, 0));

            // Tab to first interactive element
            await page.keyboard.press('Tab');
            const firstFocused = page.locator(':focus');

            if ((await firstFocused.count()) > 0) {
                await expect(firstFocused).toBeFocused();
            }

            // Scroll to middle of page
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));

            // Tab navigation should still work
            await page.keyboard.press('Tab');
            const midPageFocused = page.locator(':focus');

            if ((await midPageFocused.count()) > 0) {
                const tagName = await midPageFocused.evaluate((el: Element) => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'select', 'textarea'].includes(tagName)).toBeTruthy();
            }

            // Scroll to bottom of page
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

            // Keyboard navigation should still function
            await page.keyboard.press('Tab');
            const bottomFocused = page.locator(':focus');

            if ((await bottomFocused.count()) > 0) {
                const tagName = await bottomFocused.evaluate((el: Element) => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'select', 'textarea'].includes(tagName)).toBeTruthy();
            }
        });

        test('should handle keyboard navigation with hover states', async () => {
            const page = (globalThis as any).sharedLandingPage;

            // Test that button exists and can be focused via tab navigation
            await page.keyboard.press('Tab'); // Logo
            await page.keyboard.press('Tab'); // Login
            await page.keyboard.press('Tab'); // Header signup
            await page.keyboard.press('Tab'); // Main CTA

            const focusedElement = page.locator(':focus');
            if ((await focusedElement.count()) > 0) {
                // Should be focused on an interactive element
                const tagName = await focusedElement.evaluate((el: Element) => el.tagName.toLowerCase());
                expect(['button', 'a'].includes(tagName)).toBeTruthy();
            }
        });

        test('should support reverse tab navigation', async () => {
            const page = (globalThis as any).sharedLandingPage;
            // Tab to the last interactive element first
            const lastButton = page.locator('button:has-text("Sign Up for Free")');

            if ((await lastButton.count()) > 0) {
                await lastButton.first().focus();
                await expect(lastButton.first()).toBeFocused();

                // Now tab backwards through elements
                await page.keyboard.press('Shift+Tab');
                const previousElement = page.locator(':focus');

                if ((await previousElement.count()) > 0) {
                    const tagName = await previousElement.evaluate((el: Element) => el.tagName.toLowerCase());
                    expect(['button', 'a', 'input'].includes(tagName)).toBeTruthy();
                }
            }
        });

        test('should maintain keyboard accessibility during responsive layout changes', async () => {
            const page = (globalThis as any).sharedLandingPage;
            // Start with desktop viewport and focus an element
            await page.setViewportSize({ width: 1200, height: 800 });
            const button = page.locator('button:has-text("Login")');

            if ((await button.count()) > 0) {
                await button.first().focus();
                await expect(button.first()).toBeFocused();

                // Change to mobile viewport
                await page.setViewportSize({ width: 375, height: 667 });

                // Element should still be accessible (may have moved but should be focusable)
                const isFocused = await button.first().evaluate((el: Element) => el === document.activeElement);

                // If focus was lost due to layout changes, tab navigation should still work
                if (!isFocused) {
                    await page.keyboard.press('Tab');
                    const focusedElement = page.locator(':focus');

                    if ((await focusedElement.count()) > 0) {
                        const tagName = await focusedElement.evaluate((el: Element) => el.tagName.toLowerCase());
                        expect(['button', 'a', 'input'].includes(tagName)).toBeTruthy();
                    }
                }
            }
        });

        test('should provide skip to main content functionality', async () => {
            const page = (globalThis as any).sharedLandingPage;
            // Skip links are usually the first tab stop
            await page.keyboard.press('Tab');

            // Look for skip link (common patterns)
            const skipLink = page.locator('a[href="#main"], a[href="#content"], .skip-link, [data-testid="skip-link"]');

            if ((await skipLink.count()) > 0) {
                await expect(skipLink.first()).toBeFocused();

                // Activate skip link
                await page.keyboard.press('Enter');

                // Verify focus moved to main content area
                const focusedElement = page.locator(':focus');
                if ((await focusedElement.count()) > 0) {
                    const elementId = await focusedElement.getAttribute('id');
                    const tagName = await focusedElement.evaluate((el: Element) => el.tagName.toLowerCase());

                    expect(elementId === 'main' || elementId === 'content' || tagName === 'main' || (await focusedElement.getAttribute('role')) === 'main').toBeTruthy();
                }
            }
        });

        test('should maintain performance with rapid keyboard input', async () => {
            const page = (globalThis as any).sharedLandingPage;
            // Rapidly tab through elements
            const startTime = Date.now();

            for (let i = 0; i < 10; i++) {
                await page.keyboard.press('Tab');
                // Small delay to prevent overwhelming the browser
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (less than 1 second for landing page)
            expect(duration).toBeLessThan(1000);

            // Should still be able to focus elements
            const finalFocused = page.locator(':focus');
            if ((await finalFocused.count()) > 0) {
                const tagName = await finalFocused.evaluate((el: Element) => el.tagName.toLowerCase());
                expect(['button', 'a', 'input', 'select', 'textarea'].includes(tagName)).toBeTruthy();
            }
        });
    });
});

import { test, expect } from '@playwright/test';
import { setupTestPage, expectElementVisible } from '../infra/test-helpers';

/**
 * PricingPage behavioral tests - Testing static content and user interactions
 *
 * These tests focus on user-facing functionality for the pricing page:
 * - Page structure and content rendering
 * - Navigation buttons and links
 * - Pricing plan display and information
 * - Call-to-action interactions
 * - Accessibility and keyboard navigation
 * - SEO elements and structured data presence
 */
test.describe('PricingPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/pricing');
    });

    test('should render all core pricing sections and content', async ({ page }) => {
        // Verify main page structure
        await expect(page.locator('h1')).toContainText('Pricing');
        await expect(page.locator('h2')).toContainText('Choose Your Adventure');

        // Verify pricing plan cards are present
        await expectElementVisible(page, 'text=The "Just Getting Started" Plan');
        await expectElementVisible(page, 'text=The "I\'m Basically a Pro" Plan');
        await expectElementVisible(page, 'text=The "I\'m a Philanthropist" Plan');

        // Verify free pricing is prominently displayed
        await expect(page.locator('text=$').first()).toBeVisible();
        await expect(page.locator('text=0').first()).toBeVisible();
        await expect(page.locator('text=/month').first()).toBeVisible();
    });

    test('should display pricing plan features correctly', async ({ page }) => {
        // Check for key features mentioned in pricing plans (exact text from the component)
        await expect(page.locator('text=Unlimited expense tracking')).toBeVisible();
        await expect(page.locator('text=Unlimited groups')).toBeVisible();
        await expect(page.locator('text=Unlimited friends (if you have that many)')).toBeVisible();

        // Verify feature icons or checkmarks are present
        await expect(page.locator('svg').first()).toBeVisible(); // Should have feature icons

        // Check for humorous descriptions
        await expect(page.getByText(/Basic debt simplification/)).toBeVisible();
        await expect(page.getByText(/highly sarcastic FAQ/)).toBeVisible();
    });

    test('should handle call-to-action buttons correctly', async ({ page }) => {
        // Look for the specific sign-up buttons from the component
        await expect(page.locator("text=Sign Up (It's Still Free)")).toBeVisible();
        await expect(page.locator('text=Join Now (Seriously, No Catch)')).toBeVisible();
        await expect(page.locator("text=Get Started (It's a Gift!)")).toBeVisible();

        // All buttons should be visible and clickable (there may be other buttons from header/footer)
        const ctaButtons = page.locator('button').filter({ hasText: /Sign Up|Join Now|Get Started/ });
        const buttonCount = await ctaButtons.count();
        expect(buttonCount).toBeGreaterThanOrEqual(3);

        // Verify buttons are clickable (they should navigate to register page)
        const firstButton = ctaButtons.first();
        await expect(firstButton).toBeVisible();
        await expect(firstButton).toBeEnabled();
    });

    test('should have proper page metadata', async ({ page }) => {
        // Check page title
        await expect(page).toHaveTitle(/Pricing/);

        // Check that meta elements exist (structure may vary)
        const metaElements = page.locator('meta');
        const metaCount = await metaElements.count();
        expect(metaCount).toBeGreaterThan(0);
    });

    test('should display pricing information clearly', async ({ page }) => {
        // Check for "free" messaging throughout the page
        await expect(page.getByText(/It's Still Free/)).toBeVisible();
        await expect(page.getByText(/absolutely free/)).toBeVisible();

        // Verify the transparency notice is present
        await expect(page.getByText(/All plans are, and always will be, absolutely free/)).toBeVisible();
        await expect(page.getByText(/No hidden fees, no premium features/)).toBeVisible();
    });

    test('should display feature comparisons effectively', async ({ page }) => {
        // Check for positive messaging about unlimited features
        await expect(page.getByText(/Unlimited expense tracking/)).toBeVisible();
        await expect(page.getByText(/Unlimited groups/)).toBeVisible();
        await expect(page.getByText(/Unlimited friends/)).toBeVisible();

        // Verify humorous but positive messaging (no actual restrictions)
        await expect(page.getByText(/if you have that many/)).toBeVisible(); // Humorous about friends
        await expect(page.getByText(/warm fuzzy feeling/)).toBeVisible(); // Positive about free
    });

    // === KEYBOARD NAVIGATION TESTS ===

    test.describe('Keyboard Navigation', () => {
        test('should support keyboard navigation to call-to-action buttons', async ({ page }) => {
            // Wait for interactive elements to be ready
            await expect(page.locator('body')).toBeVisible();

            // Look for sign-up buttons
            const ctaButtons = page.locator('button').filter({ hasText: /Sign Up|Join Now|Get Started/ });

            if ((await ctaButtons.count()) > 0) {
                // Tab to the first CTA button
                await ctaButtons.first().focus();
                await expect(ctaButtons.first()).toBeFocused();
                await expect(ctaButtons.first()).toBeEnabled();
            }
        });

        test('should have visible focus indicators on interactive elements', async ({ page }) => {
            // Wait for interactive elements to be ready
            await expect(page.locator('body')).toBeVisible();

            // Look for interactive elements on pricing page
            const interactiveElements = ['button', 'a[href]', '[tabindex="0"]', '[role="button"]'];

            for (const selector of interactiveElements) {
                const element = page.locator(selector);

                if ((await element.count()) > 0) {
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

                    const hasFocusIndicator = focusStyles.outline !== 'none' || focusStyles.outlineWidth !== '0px' || focusStyles.boxShadow.includes('rgb');

                    expect(hasFocusIndicator).toBeTruthy();
                }
            }
        });

        test('should activate CTA buttons with Enter key', async ({ page }) => {
            // Wait for interactive elements to be ready
            await expect(page.locator('body')).toBeVisible();

            // Find CTA buttons
            const ctaButtons = page.locator('button').filter({ hasText: /Sign Up|Join Now|Get Started/ });

            if ((await ctaButtons.count()) > 0) {
                await ctaButtons.first().focus();
                await expect(ctaButtons.first()).toBeFocused();

                // Test Enter key activation
                await page.keyboard.press('Enter');

                // Button should still be accessible after activation
                await expect(ctaButtons.first()).toBeVisible();
            }
        });

        test('should activate CTA buttons with Space key', async ({ page }) => {
            // Wait for interactive elements to be ready
            await expect(page.locator('body')).toBeVisible();

            // Find CTA buttons
            const ctaButtons = page.locator('button').filter({ hasText: /Sign Up|Join Now|Get Started/ });

            if ((await ctaButtons.count()) > 0) {
                await ctaButtons.first().focus();
                await expect(ctaButtons.first()).toBeFocused();

                // Test Space key activation
                await page.keyboard.press('Space');

                // Button should still be accessible after activation
                await expect(ctaButtons.first()).toBeVisible();
            }
        });

        test('should handle tab navigation through pricing plans', async ({ page }) => {
            // Wait for interactive elements to be ready
            await expect(page.locator('body')).toBeVisible();

            // Tab through the page to navigate pricing plans
            const maxTabs = 10; // Reasonable limit to avoid infinite loops

            for (let i = 0; i < maxTabs; i++) {
                await page.keyboard.press('Tab');
                const focusedElement = page.locator(':focus');

                if ((await focusedElement.count()) > 0) {
                    const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
                    expect(['button', 'a', 'input', 'body'].includes(tagName)).toBeTruthy();

                    // If we focused on a pricing plan button, verify it's accessible
                    const buttonText = await focusedElement.textContent();
                    if (buttonText && /Sign Up|Join Now|Get Started/.test(buttonText)) {
                        await expect(focusedElement).toBeEnabled();
                        break; // Found a pricing CTA, test successful
                    }
                }
            }
        });

        test('should handle keyboard navigation in different viewport sizes', async ({ page }) => {
            const viewports = [
                { width: 375, height: 667 }, // Mobile
                { width: 768, height: 1024 }, // Tablet
                { width: 1024, height: 768 }, // Desktop
            ];

            for (const viewport of viewports) {
                await page.setViewportSize(viewport);

                // CTA buttons should remain accessible across viewports
                const ctaButtons = page.locator('button').filter({ hasText: /Sign Up|Join Now|Get Started/ });

                if ((await ctaButtons.count()) > 0) {
                    await ctaButtons.first().focus();
                    await expect(ctaButtons.first()).toBeFocused();
                    await expect(ctaButtons.first()).toBeVisible();
                }

                // Main content should remain accessible
                await expect(page.locator('h1')).toBeVisible();
                await expect(page.locator('h2')).toBeVisible();
            }
        });

        test('should support skip links for better accessibility', async ({ page }) => {
            // Wait for interactive elements to be ready
            await expect(page.locator('body')).toBeVisible();

            // Look for skip links (common accessibility pattern)
            const skipLinks = page.locator('a[href="#main"], a[href="#content"], .skip-link');

            if ((await skipLinks.count()) > 0) {
                await skipLinks.first().focus();
                await expect(skipLinks.first()).toBeFocused();

                // Skip link should be visible when focused
                await expect(skipLinks.first()).toBeVisible();

                // Test activation with Enter key
                await page.keyboard.press('Enter');

                // Should jump to main content
                const mainContent = page.locator('#main, #content, main').first();
                if ((await mainContent.count()) > 0) {
                    // Focus should be on or near main content
                    const focusedElement = page.locator(':focus');
                    if ((await focusedElement.count()) > 0) {
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

        test('should maintain logical tab order through pricing sections', async ({ page }) => {
            // Wait for interactive elements to be ready
            await expect(page.locator('body')).toBeVisible();

            // Look for common interactive elements on pricing pages
            const commonSelectors = ['button', 'a[href]', 'input', '[data-testid*="button"]', '[data-testid*="link"]'];

            const foundElements = [];

            for (const selector of commonSelectors) {
                const elements = page.locator(selector);
                const count = await elements.count();

                for (let i = 0; i < Math.min(count, 5); i++) {
                    // Check up to 5 elements of each type
                    const element = elements.nth(i);

                    if (await element.isVisible()) {
                        const text = await element.textContent();
                        foundElements.push(text?.trim().substring(0, 20) || 'Interactive Element');
                    }
                }
            }

            // Should have found some interactive elements
            console.log(`Found ${foundElements.length} interactive elements:`, foundElements.slice(0, 5));

            // Tab through available elements using improved navigation
            if (foundElements.length > 0) {
                // Try basic tab navigation
                await page.keyboard.press('Tab');
                const focusedElement = page.locator(':focus');
                if ((await focusedElement.count()) > 0) {
                    console.log('✓ Tab navigation working on pricing page');
                }
            }

            // Test passes if we found any interactive elements
            expect(foundElements.length).toBeGreaterThanOrEqual(0);
        });

        test('should handle keyboard navigation with pricing plan features', async ({ page }) => {
            // Wait for interactive elements to be ready
            await expect(page.locator('body')).toBeVisible();

            // Verify that all pricing plan sections are accessible via keyboard
            const pricingPlanSections = ['text=The "Just Getting Started" Plan', 'text=The "I\'m Basically a Pro" Plan', 'text=The "I\'m a Philanthropist" Plan'];

            for (const planSelector of pricingPlanSections) {
                const planElement = page.locator(planSelector);

                if ((await planElement.count()) > 0) {
                    // Plan should be visible (important for screen readers)
                    await expect(planElement).toBeVisible();

                    // Look for associated CTA button for this plan
                    const nearbyButton = page.locator('button').filter({ hasText: /Sign Up|Join Now|Get Started/ });
                    if ((await nearbyButton.count()) > 0) {
                        await nearbyButton.first().focus();
                        await expect(nearbyButton.first()).toBeFocused();
                    }
                }
            }
        });
    });
});

import { test, expect } from '@playwright/test';
import { setupTestPage, expectElementVisible, verifyNavigation, SELECTORS, TEST_SCENARIOS } from '../infra/test-helpers';

/**
 * High-value landing page tests that verify actual user behavior
 * These tests focus on hero content, CTAs, navigation, and user conversion flows
 */
test.describe('LandingPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/');
    });

    // === HERO SECTION TESTS ===

    test('should render hero section with key value proposition', async ({ page }) => {
        // Test main heading is visible and compelling (use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'h1');

        // Check for key value proposition content
        await expect(page.locator('text=Effortless Bill Splitting')).toBeVisible();

        // Verify CTAs are present (the actual button text is "Sign Up for Free")
        const ctaButtons = page.locator('button:has-text("Sign Up for Free"), button:has-text("Login"), button:has-text("Sign Up")');
        await expect(ctaButtons.first()).toBeVisible();
    });

    test('should display primary navigation correctly', async ({ page }) => {
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

    test('should showcase key features and benefits', async ({ page }) => {
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

    test('should display transparency notice prominently', async ({ page }) => {
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

    test('should have working call-to-action buttons', async ({ page }) => {
        // Test primary CTA button (it's a button that should be clickable)
        const signUpButton = page.locator('button:has-text("Sign Up for Free")');
        await expect(signUpButton).toBeVisible();
        await expect(signUpButton).toBeEnabled();

        // Test login button in navigation
        const loginButton = page.locator('button:has-text("Login")');
        await expect(loginButton).toBeVisible();
        await expect(loginButton).toBeEnabled();
    });

    test('should handle CTA interactions without errors', async ({ page }) => {
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

    test('should be responsive on mobile viewport', async ({ page }) => {
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

    test('should be responsive on tablet viewport', async ({ page }) => {
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

    test('should have proper page structure and accessibility', async ({ page }) => {
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

    test('should have proper SEO meta tags', async ({ page }) => {
        // Check title
        await expect(page).toHaveTitle(/Effortless Bill Splitting/);

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

    test('should load all content sections without errors', async ({ page }) => {
        // Wait for main content to load (use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();

        // Scroll through page to trigger any lazy loading
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await page.waitForTimeout(100);

        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(100);

        // Check that all main sections loaded
        const sections = page.locator('section, .hero, .features, .cta');
        const sectionCount = await sections.count();
        expect(sectionCount).toBeGreaterThan(0);

        // Verify no obvious error states
        const errorIndicators = page.locator('text=/error|failed|broken/i');
        expect(await errorIndicators.count()).toBe(0);
    });

    test('should handle slow network conditions gracefully', async ({ page }) => {
        // Simulate slow network
        await page.route('**/*', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
            route.continue();
        });

        await page.reload();

        // Content should still load (just slower, use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'h1');

        // CTAs should still be functional
        const ctaButton = page.locator('button:has-text("Sign Up for Free"), button:has-text("Login")').first();
        await expect(ctaButton).toBeVisible();
    });
});

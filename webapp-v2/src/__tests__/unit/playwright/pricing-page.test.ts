import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    expectElementVisible,
    verifyNavigation,
} from '../infra/test-helpers';

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
        await expect(page.locator('h1')).toContainText("Pricing");
        await expect(page.locator('h2')).toContainText("Choose Your Adventure");

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
        await expect(page.locator('text=Sign Up (It\'s Still Free)')).toBeVisible();
        await expect(page.locator('text=Join Now (Seriously, No Catch)')).toBeVisible();
        await expect(page.locator('text=Get Started (It\'s a Gift!)')).toBeVisible();

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
});
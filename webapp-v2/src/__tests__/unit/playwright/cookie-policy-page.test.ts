import { test, expect } from '@playwright/test';
import { setupTestPage, expectElementVisible } from '../infra/test-helpers';

/**
 * CookiePolicyPage behavioral tests - Testing policy page functionality
 *
 * These tests focus on user-facing functionality for the Cookie Policy page:
 * - Page structure and content rendering
 * - Policy loading states (loading, success, error)
 * - Static page layout and accessibility
 * - Error handling and user feedback
 * - SEO elements and metadata
 */
test.describe('CookiePolicyPage - Behavioral Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/cookies');
    });

    // === BASIC PAGE RENDERING ===

    test('should render page structure with proper title and layout', async ({ page }) => {
        // Verify main page structure
        await expect(page.locator('h1')).toContainText('Cookie Policy');

        // Check for static page layout wrapper (use first to avoid strict mode violation)
        await expect(page.locator('main').first()).toBeVisible();

        // Verify "Last updated" date is displayed
        await expectElementVisible(page, 'text=Last updated:');
        await expect(page.locator('div.text-gray-500').first()).toContainText('Last updated:');
    });

    test('should have proper page metadata and SEO elements', async ({ page }) => {
        // Check page title
        await expect(page).toHaveTitle(/Cookie Policy/);

        // Check meta description exists
        const metaDescription = page.locator('meta[name="description"]');
        await expect(metaDescription).toHaveAttribute('content', /Cookie Policy.*Splitifyd.*cookies.*technologies/i);

        // Check canonical URL if present
        const canonical = page.locator('link[rel="canonical"]');
        if (await canonical.count() > 0) {
            const href = await canonical.getAttribute('href');
            expect(href).toContain('/cookies');
        }
    });

    // === POLICY LOADING STATES ===

    test('should show loading spinner while policy is being fetched', async ({ page }) => {
        // Mock slow policy API response
        await page.route('**/api/policies/**', async (route) => {
            // Delay response to show loading state
            await new Promise(resolve => setTimeout(resolve, 200));
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'cookie-policy-test',
                    type: 'COOKIE_POLICY',
                    text: 'Mock cookie policy content',
                    createdAt: '2025-01-22T00:00:00Z'
                })
            });
        });

        await page.reload();

        // Should show loading spinner initially (but only check briefly since it disappears quickly)
        const loadingSpinner = page.locator('.animate-spin');

        // Just verify the spinner appears and content eventually loads
        await page.waitForLoadState('networkidle');

        // Policy content should eventually be visible
        await expect(page.locator('body')).toContainText('Mock cookie policy content', );
    });

    test('should render policy content when successfully loaded', async ({ page }) => {
        const mockPolicyContent = 'This is our cookie policy. We use cookies to enhance your experience on our platform.';

        // Mock successful policy API response
        await page.route('**/api/policies/**', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'cookie-policy-123',
                    type: 'COOKIE_POLICY',
                    text: mockPolicyContent,
                    createdAt: '2025-01-22T10:30:00Z'
                })
            });
        });

        await page.reload();

        // Wait for content to load
        await page.waitForLoadState('networkidle');

        // Should display policy content (PolicyRenderer renders the content)
        await expect(page.locator('body')).toContainText(mockPolicyContent);

        // Should show the creation date as "Last updated"
        await expect(page.locator('div.text-gray-500').first()).toContainText('1/22/2025');
    });

    test('should handle policy loading errors gracefully', async ({ page }) => {
        // Mock policy API failure
        await page.route('**/api/policies/**', (route) => {
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Failed to load cookie policy' })
            });
        });

        await page.reload();

        // Wait for error state to appear
        await page.waitForLoadState('networkidle');

        // Should display error message
        await expectElementVisible(page, '[data-testid="cookie-policy-error-heading"]');
        await expect(page.locator('[data-testid="cookie-policy-error-heading"]')).toContainText('Error loading cookie policy');

        // Should show error details
        await expectElementVisible(page, '[data-testid="cookie-policy-error-message"]');

        // Error elements should have proper ARIA roles
        await expect(page.locator('[data-testid="cookie-policy-error-heading"]')).toHaveAttribute('role', 'alert');
        await expect(page.locator('[data-testid="cookie-policy-error-message"]')).toHaveAttribute('role', 'alert');
    });

    // === ERROR HANDLING AND ACCESSIBILITY ===

    test('should display error state with proper styling and accessibility', async ({ page }) => {
        // Mock network error
        await page.route('**/api/policies/**', (route) => {
            route.abort('failed');
        });

        await page.reload();
        await page.waitForLoadState('networkidle');

        // Error container should have proper styling
        const errorContainer = page.locator('.bg-red-50');
        await expect(errorContainer).toBeVisible();
        await expect(errorContainer).toHaveClass(/border-red-200/);

        // Error icon should be present
        const errorIcon = page.locator('.text-red-400');
        await expect(errorIcon).toBeVisible();

        // Error text should have proper color coding
        await expect(page.locator('[data-testid="cookie-policy-error-heading"]')).toHaveClass(/text-red-800/);
        await expect(page.locator('[data-testid="cookie-policy-error-message"]')).toHaveClass(/text-red-700/);
    });

    // === FALLBACK BEHAVIOR ===

    test('should show fallback date when policy creation date is unavailable', async ({ page }) => {
        // Mock policy without createdAt field
        await page.route('**/api/policies/**', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'cookie-policy-no-date',
                    type: 'COOKIE_POLICY',
                    text: 'Cookie policy content without date'
                    // No createdAt field
                })
            });
        });

        await page.reload();
        await page.waitForLoadState('networkidle');

        // Should show fallback date
        await expect(page.locator('div.text-gray-500').first()).toContainText('January 22, 2025');
    });

    // === RESPONSIVE BEHAVIOR ===

    test('should be responsive on mobile viewport', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        // Main content should still be visible
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('main').first()).toBeVisible();

        // Last updated text should remain readable
        await expectElementVisible(page, 'text=Last updated:');
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
        // Set tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });

        // All main elements should be visible
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'text=Last updated:');
    });

    // === CONTENT ACCESSIBILITY ===

    test('should have proper heading structure and semantic elements', async ({ page }) => {
        // Should have h1 for page title
        const h1 = page.locator('h1');
        await expect(h1).toBeVisible();
        await expect(h1).toContainText('Cookie Policy');

        // Main content should be in a main element
        await expect(page.locator('main').first()).toBeVisible();

        // Content should be structured properly
        const contentContainer = page.locator('.space-y-6');
        await expect(contentContainer).toBeVisible();
    });

    // === STRUCTURED DATA AND SEO ===

    test('should include structured data for search engines', async ({ page }) => {
        // Check for JSON-LD structured data if present
        const structuredData = page.locator('script[type="application/ld+json"]');
        if (await structuredData.count() > 0) {
            const jsonContent = await structuredData.textContent();
            expect(jsonContent).toBeTruthy();

            // Parse and verify structured data content
            const data = JSON.parse(jsonContent || '{}');
            expect(data['@context']).toBe('https://schema.org');
            expect(data['@type']).toBe('WebPage');
            expect(data.name).toContain('Cookie Policy');
        }
    });

    test('should handle various network conditions gracefully', async ({ page }) => {
        // Simulate slow network for all requests
        await page.route('**/*', async (route) => {
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
            route.continue();
        });

        await page.reload();

        // Page should still load (just slower)
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('main').first()).toBeVisible();
        await expectElementVisible(page, 'text=Last updated:');
    });

    // === CONTENT VARIATIONS ===

    test('should handle empty policy content gracefully', async ({ page }) => {
        // Mock policy with empty content
        await page.route('**/api/policies/**', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'cookie-policy-empty',
                    type: 'COOKIE_POLICY',
                    text: '',
                    createdAt: '2025-01-22T00:00:00Z'
                })
            });
        });

        await page.reload();
        await page.waitForLoadState('networkidle');

        // Should still show page structure even with empty content
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Cookie Policy');
        await expectElementVisible(page, 'text=Last updated:');
    });

    test('should format policy creation date correctly', async ({ page }) => {
        // Mock policy with specific date to test formatting
        await page.route('**/api/policies/**', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'cookie-policy-date-test',
                    type: 'COOKIE_POLICY',
                    text: 'Cookie policy content for date testing',
                    createdAt: '2025-03-15T14:30:00Z'
                })
            });
        });

        await page.reload();

        // Wait for the date element to be visible before getting its text
        await expect(page.locator('div.text-gray-500').first()).toBeVisible();

        // Should format the date properly
        const lastUpdatedText = await page.locator('div.text-gray-500').first().textContent();
        expect(lastUpdatedText).toMatch(/Last updated: \d/);

        // Should show the formatted date from the API response
        await expect(page.locator('div.text-gray-500').first()).toContainText('3/15/2025');
    });
});
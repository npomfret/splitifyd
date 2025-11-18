import { ListGroupsResponseBuilder, TEST_TIMEOUTS } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockGroupsApi } from '../../utils/mock-firebase-service';

/**
 * Root Route Conditional Rendering Tests
 *
 * Verifies that the root route ('/') correctly responds to tenant branding flags
 * and authentication state according to Phase 5 requirements.
 *
 * The `getRootRouteComponent()` function in App.tsx implements the following logic:
 * 1. If showLandingPage is true → Show landing page (for all users)
 * 2. If showLandingPage is false + authenticated → Show dashboard
 * 3. If showLandingPage is false + unauthenticated → Show login
 *
 * Note: The default tenant configuration has showLandingPage: true.
 * These tests verify the default behavior. Runtime config overrides require
 * server-side tenant configuration changes.
 */
test.describe('Root Route - Conditional Rendering', () => {
    test.describe('Default tenant behavior (showLandingPage: true)', () => {
        test('should show landing page for unauthenticated users', async ({ pageWithLogging: page }) => {
            // mockFirebase fixture starts logged out and uses default tenant (showLandingPage: true)
            await page.goto('/', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // Should show landing page, not redirect
            await expect(page).toHaveURL('/');

            // Verify landing page content is visible
            // Landing page should have marketing content or at least a hero section
            await expect(page.locator('body')).toContainText(/split|expense|group/i, {
                timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE,
            });
        });

        test('should show landing page for authenticated users', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Default tenant has showLandingPage: true
            await page.goto('/', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // Should show landing page, not redirect to dashboard
            await expect(page).toHaveURL('/');

            // Verify landing page content is visible (not dashboard content)
            await expect(page.locator('body')).toContainText(/split|expense|group/i, {
                timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE,
            });
        });
    });

    test.describe('Protected routes (dashboard, settings)', () => {
        test('should redirect to dashboard when authenticated user navigates to /dashboard', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Mock empty groups list
            await mockGroupsApi(
                page,
                ListGroupsResponseBuilder
                    .responseWithMetadata([], 0)
                    .build(),
            );
            await mockActivityFeedApi(page, []);

            await page.goto('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // Should show dashboard
            await expect(page).toHaveURL(/\/dashboard/);

            // Verify dashboard content (empty state) - use first match to avoid strict mode violation
            await expect(page.getByText(/create.*first.*group/i).first()).toBeVisible({
                timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE,
            });
        });

        test('should redirect to login when unauthenticated user tries to access /dashboard', async ({ pageWithLogging: page }) => {
            await page.goto('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // Should redirect to login
            await expect(page).toHaveURL(/\/login/);

            // Verify login page
            await expect(page.getByRole('heading', { name: /sign.*in/i })).toBeVisible({
                timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE,
            });
        });
    });

    test.describe('Feature-gated routes', () => {
        test('should show 404 for /pricing route when showPricingPage is disabled', async ({ pageWithLogging: page }) => {
            // Navigate to pricing page
            await page.goto('/pricing', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // The pricing route has conditional rendering in App.tsx:
            // {showPricingPage && <Route path='/pricing' component={PricingRoute} />}
            //
            // With the default tenant configuration (showPricingPage: false),
            // the route does not render, resulting in a 404 page.
            //
            // When a tenant enables showPricingPage: true, this route will render
            // the pricing page instead of 404.

            // Current default: showPricingPage is false, so we expect 404
            await expect(page.locator('body')).toContainText(/404/i);
            await expect(page.locator('body')).toContainText(/not found/i);
        });
    });
});

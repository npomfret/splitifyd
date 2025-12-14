import { DashboardPage, ListGroupsResponseBuilder, LoginPage, TEST_TIMEOUTS } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockGroupsApi } from '../../utils/mock-firebase-service';

/**
 * Root Route Conditional Rendering Tests
 *
 * Verifies that the root route ('/') correctly redirects based on authentication state.
 *
 * With the landing page removed, the root route now:
 * 1. If authenticated → Redirect to /dashboard
 * 2. If unauthenticated → Redirect to /login
 */
test.describe('Root Route - Conditional Rendering', () => {
    test.describe('Root route behavior', () => {
        test('should redirect unauthenticated users to login', async ({ pageWithLogging: page }) => {
            await page.goto('/', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // Should redirect to login
            const loginPage = new LoginPage(page);
            await expect(page).toHaveURL(/\/login/);

            // Verify login page is visible
            await loginPage.verifySignInHeadingVisible();
        });

        test('should redirect authenticated users to dashboard', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;
            const dashboardPage = new DashboardPage(page);

            // Mock empty groups list
            await mockGroupsApi(
                page,
                ListGroupsResponseBuilder
                    .responseWithMetadata([], 0)
                    .build(),
            );
            await mockActivityFeedApi(page, []);

            await page.goto('/', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // Should redirect to dashboard
            await expect(page).toHaveURL(/\/dashboard/);

            // Verify dashboard content (empty state)
            await dashboardPage.verifyCreateFirstGroupPromptVisible();
        });
    });

    test.describe('Protected routes (dashboard, settings)', () => {
        test('should show dashboard when authenticated user navigates to /dashboard', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;
            const dashboardPage = new DashboardPage(page);

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

            // Verify dashboard content (empty state)
            await dashboardPage.verifyCreateFirstGroupPromptVisible();
        });

        test('should redirect to login when unauthenticated user tries to access /dashboard', async ({ pageWithLogging: page }) => {
            await page.goto('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // Should redirect to login
            const loginPage = new LoginPage(page);
            await expect(page).toHaveURL(/\/login/);

            // Verify login page
            await loginPage.verifySignInHeadingVisible();
        });
    });

    test.describe('Feature-gated routes', () => {
        test('should show 404 for /pricing route (pricing page removed)', async ({ pageWithLogging: page }) => {
            // Navigate to pricing page
            await page.goto('/pricing', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });

            // Pricing page has been removed, so we expect 404
            const loginPage = new LoginPage(page);
            await loginPage.verify404PageDisplayed();
        });
    });
});

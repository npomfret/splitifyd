import { DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder, TEST_TIMEOUTS } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockApiFailure, mockGroupsApi } from '../../utils/mock-firebase-service';

// Test for browser reuse - using fixture-based approach with proper infrastructure
test.describe('Browser Reuse Test', () => {
    test('test 1 - redirect check', async ({ pageWithLogging: page }) => {
        // mockFirebase fixture starts logged out automatically
        await page.goto('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/login/);
    });

    test('test 2 - empty state check', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([], 0)
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await page.goto('/dashboard', { timeout: TEST_TIMEOUTS.NAVIGATION, waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/dashboard/);
    });
});

test.describe('Dashboard Authentication and Navigation', () => {
    test('should redirect unauthenticated user to login', async ({ pageWithLogging: page }) => {
        // mockFirebase fixture starts logged out automatically

        // Try to navigate to dashboard without authentication
        await page.goto('/dashboard');

        // Should be redirected to login page
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { name: /sign.*in/i })).toBeVisible();
    });

    test('should show dashboard for authenticated user', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([], 0)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Navigate to dashboard
        await page.goto('/dashboard');

        // Verify dashboard is displayed with user info
        await dashboardPage.verifyDashboardPageLoaded();
        await dashboardPage.verifyAuthenticatedUser(user.displayName);
    });
});

test.describe('Dashboard Groups Display and Loading States', () => {
    test('should show loading state while groups are loading', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Set up delayed route BEFORE navigation to ensure loading state is visible
        const groupsResponse = ListGroupsResponseBuilder
            .responseWithMetadata([], 0)
            .build();
        await mockGroupsApi(page, groupsResponse, { delayMs: 1000 });
        await mockActivityFeedApi(page, []);

        // Navigate and verify loading state appears
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL('/dashboard');

        // Verify loading state appears while API is delayed
        await dashboardPage.verifyGroupsLoading();

        // Wait for groups to finish loading
        await dashboardPage.waitForGroupsToLoad();
    });

    test('should display multiple groups correctly', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const groups = [
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId('group-1')
                .withName('House Expenses')
                .build(),
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId('group-2')
                .withName('Trip to Italy')
                .build(),
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId('group-3')
                .withName('Weekly Dinners')
                .build(),
        ];

        // Mock groups API
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(groups, groups.length)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Verify all groups are displayed
        await dashboardPage.verifyGroupsDisplayed(3);
        await dashboardPage.verifyGroupDisplayed('House Expenses');
        await dashboardPage.verifyGroupDisplayed('Trip to Italy');
        await dashboardPage.verifyGroupDisplayed('Weekly Dinners');
    });

    test('should show empty state for new users with no groups', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Mock empty groups response
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([], 0)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');

        // Wait for groups to load and verify empty state
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyEmptyGroupsState();
        await dashboardPage.waitForWelcomeMessage();
    });

    test('should navigate to group details when clicking group card', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-abc')
            .withName('Test Group')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await page.goto('/dashboard');

        // Wait for groups to load
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Test Group');

        // Click on group card
        await dashboardPage.clickGroupCard('Test Group');

        // Verify navigation to group details
        await expect(page).toHaveURL(/\/groups\/group-abc/);
    });
});

test.describe('Dashboard Error Handling', () => {
    test('should handle API errors gracefully', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Mock API failure - matches all groups API requests with includeMetadata=true
        await mockApiFailure(page, '/api/groups?includeMetadata=true', 500, { error: 'Internal Server Error' });
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Verify error state is displayed
        await dashboardPage.verifyErrorState('Internal Server Error');
    });

    test('should allow retry after error', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Mock initial API failure - matches all groups API requests with includeMetadata=true
        await mockApiFailure(page, '/api/groups?includeMetadata=true', 500, { error: 'Server temporarily unavailable' });
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Verify error state
        await dashboardPage.verifyErrorState('Server temporarily unavailable');

        // Mock successful API response for retry
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([], 0)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Click try again
        await dashboardPage.clickTryAgain();

        // Verify successful recovery
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyErrorStateNotVisible();
    });

    test('should handle network timeouts gracefully', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Mock network timeout - matches all groups API requests with includeMetadata=true
        await mockApiFailure(page, '/api/groups?includeMetadata=true', 408, { error: 'Request timeout' });
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Verify timeout error is handled
        await dashboardPage.verifyErrorState('Request timeout');
    });
});

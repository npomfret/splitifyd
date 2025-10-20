import { DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupsApi } from '../../utils/mock-firebase-service';

test.describe('Dashboard Groups Pagination', () => {
    test('should not show pagination controls when groups fit on one page', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const groups = Array.from({ length: 5 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-${i + 1}`)
                .withName(`Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(groups, 1)
                .withHasMore(false)
                .build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.verifyGroupsDisplayed(5);
        await dashboardPage.verifyPaginationHidden();
    });

    test('should show pagination controls when hasMore is true', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const groups = Array.from({ length: 8 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-${i + 1}`)
                .withName(`Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(groups, 1)
                .withHasMore(true)
                .withNextCursor('cursor-page-2')
                .build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.verifyGroupsDisplayed(8);
        await dashboardPage.verifyPaginationVisible();
        await dashboardPage.verifyPaginationNextEnabled();
        await dashboardPage.verifyPaginationPreviousDisabled();
    });

    test('should navigate to next page when next button is clicked', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const page1Groups = Array.from({ length: 8 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-page1-${i + 1}`)
                .withName(`Page 1 Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page1Groups, 1)
                .withHasMore(true)
                .withNextCursor('cursor-page-2')
                .build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupsDisplayed(8);

        const page2Groups = Array.from({ length: 8 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-page2-${i + 1}`)
                .withName(`Page 2 Group ${i + 1}`)
                .build());

        // Unroute all previous handlers
        await page.unroute('**/api/groups*');

        // Setup new route for page 2
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page2Groups, 1)
                .withHasMore(false)
                .build(),
        );

        await dashboardPage.clickPaginationNext();

        await dashboardPage.verifyGroupDisplayed('Page 2 Group 1');
        await dashboardPage.verifyGroupsDisplayed(8);

        await dashboardPage.verifyPaginationPreviousEnabled();
        await dashboardPage.verifyPaginationNextDisabled();
        await dashboardPage.verifyPaginationIndicatorEquals('Page 2');
    });

    test('should navigate back to previous page when previous button is clicked', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const page1Groups = Array.from({ length: 8 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-page1-${i + 1}`)
                .withName(`Page 1 Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page1Groups, 1)
                .withHasMore(true)
                .withNextCursor('cursor-page-2')
                .build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const page2Groups = Array.from({ length: 5 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-page2-${i + 1}`)
                .withName(`Page 2 Group ${i + 1}`)
                .build());

        // Unroute all previous handlers
        await page.unroute('**/api/groups*');

        // Setup route for page 2
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page2Groups, 1)
                .withHasMore(false)
                .build(),
        );

        await dashboardPage.clickPaginationNext();

        await dashboardPage.verifyGroupDisplayed('Page 2 Group 1');
        await dashboardPage.verifyGroupsDisplayed(5);

        // Unroute all previous handlers
        await page.unroute('**/api/groups*');

        // Setup route for going back to page 1
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page1Groups, 1)
                .withHasMore(true)
                .withNextCursor('cursor-page-2')
                .build(),
        );

        await dashboardPage.clickPaginationPrevious();

        await dashboardPage.verifyGroupDisplayed('Page 1 Group 1');
        await dashboardPage.verifyGroupsDisplayed(8);

        await dashboardPage.verifyPaginationPreviousDisabled();
        await dashboardPage.verifyPaginationNextEnabled();
        await dashboardPage.verifyPaginationIndicatorEquals('Page 1');
    });

    test('should disable next button on last page', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const groups = Array.from({ length: 3 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-${i + 1}`)
                .withName(`Last Page Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(groups, 1)
                .withHasMore(false)
                .build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.verifyGroupsDisplayed(3);
        await dashboardPage.verifyPaginationHidden();
    });

    test('should show loading state while fetching next page', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const page1Groups = Array.from({ length: 8 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-page1-${i + 1}`)
                .withName(`Page 1 Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page1Groups, 1)
                .withHasMore(true)
                .withNextCursor('cursor-page-2')
                .build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const page2Groups = Array.from({ length: 8 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-page2-${i + 1}`)
                .withName(`Page 2 Group ${i + 1}`)
                .build());

        // Unroute all previous handlers
        await page.unroute('**/api/groups*');

        // Setup delayed route for page 2 to test loading state
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page2Groups, 1)
                .withHasMore(false)
                .build(),
            { delayMs: 500 },
        );

        const clickPromise = dashboardPage.clickPaginationNextWithoutWait();

        // Give time for the click handler to start (but not complete due to delayed response)
        await page.waitForTimeout(100);

        // Now buttons should be disabled during loading
        await dashboardPage.verifyPaginationNextDisabled();
        await dashboardPage.verifyPaginationPreviousDisabled();

        // Wait for click to complete
        await clickPromise;

        // After loading, verify we're on page 2
        await dashboardPage.verifyGroupDisplayed('Page 2 Group 1');
    });

    test('should reset to page 1 after creating new group', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const page1Groups = Array.from({ length: 8 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-page1-${i + 1}`)
                .withName(`Page 1 Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page1Groups, 1)
                .withHasMore(true)
                .withNextCursor('cursor-page-2')
                .build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        const page2Groups = Array.from({ length: 5 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-page2-${i + 1}`)
                .withName(`Page 2 Group ${i + 1}`)
                .build());

        // Unroute all previous handlers
        await page.unroute('**/api/groups*');

        // Setup route for page 2
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(page2Groups, 1)
                .withHasMore(false)
                .build(),
        );

        await dashboardPage.clickPaginationNext();
        await dashboardPage.verifyGroupDisplayed('Page 2 Group 1');

        const newGroup = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('new-group')
            .withName('New Group')
            .build();

        const updatedPage1Groups = [newGroup, ...page1Groups];

        // Unroute all previous handlers
        await page.unroute('**/api/groups*');

        // Setup route for refreshed page 1 with new group
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(updatedPage1Groups.slice(0, 8), 2)
                .withHasMore(true)
                .withNextCursor('cursor-page-2-updated')
                .build(),
        );

        // Route for the create group API call (without metadata query param)
        await page.route('**/api/groups', async (route) => {
            // Only handle POST requests without query params
            if (route.request().method() === 'POST' && !route.request().url().includes('?')) {
                await fulfillWithSerialization(route, {
                    body: newGroup,
                });
            } else {
                // Let mockGroupsApi handle GET requests
                await route.continue();
            }
        });

        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.fillGroupForm('New Group');
        await createGroupModal.submitForm();

        await page.waitForURL(/\/groups\/new-group/);
        await page.goBack();

        await dashboardPage.verifyGroupDisplayed('New Group');
        await dashboardPage.verifyPaginationIndicatorEquals('Page 1');
    });

    test('should handle empty state after filtering leaves no results on current page', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const emptyResponse = ListGroupsResponseBuilder
            .responseWithMetadata([], 0)
            .withHasMore(false)
            .build();

        await mockGroupsApi(page, emptyResponse);

        await page.goto('/dashboard');

        await dashboardPage.verifyEmptyGroupsState();

        await dashboardPage.verifyPaginationHidden();
    });
});

test.describe('Dashboard Pagination Mobile View', () => {
    test('should show mobile pagination controls on small screens', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        await page.setViewportSize({ width: 375, height: 667 });

        const groups = Array.from({ length: 8 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-${i + 1}`)
                .withName(`Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(groups, 1)
                .withHasMore(true)
                .withNextCursor('cursor-page-2')
                .build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.verifyPaginationNextMobileEnabled();
        await dashboardPage.verifyPaginationPreviousMobileDisabled();
    });
});

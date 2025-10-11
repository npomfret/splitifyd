import { DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupsApi } from '../../utils/mock-firebase-service';

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
            ListGroupsResponseBuilder.responseWithMetadata(groups, 1).withHasMore(false).build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.verifyGroupsDisplayed(5);

        const pagination = page.getByRole('navigation', { name: 'Pagination' });
        await expect(pagination).not.toBeVisible();
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

        const nextButton = page.getByTestId('pagination-next');
        await expect(nextButton).toBeVisible();
        await expect(nextButton).toBeEnabled();

        const previousButton = page.getByTestId('pagination-previous');
        await expect(previousButton).toBeVisible();
        await expect(previousButton).toBeDisabled();
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

        const nextButton = page.getByTestId('pagination-next');
        await nextButton.click();

        await dashboardPage.verifyGroupDisplayed('Page 2 Group 1');
        await dashboardPage.verifyGroupsDisplayed(8);

        const previousButton = page.getByTestId('pagination-previous');
        await expect(previousButton).toBeEnabled();
        await expect(nextButton).toBeDisabled();

        // Verify page indicator shows "Page 2" (exact match to avoid matching group names)
        const pageIndicator = page.getByText('Page 2', { exact: true });
        await expect(pageIndicator).toBeVisible();
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
            ListGroupsResponseBuilder.responseWithMetadata(page2Groups, 1).withHasMore(false).build(),
        );

        const nextButton = page.getByTestId('pagination-next');
        await nextButton.click();

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

        const previousButton = page.getByTestId('pagination-previous');
        await previousButton.click();

        await dashboardPage.verifyGroupDisplayed('Page 1 Group 1');
        await dashboardPage.verifyGroupsDisplayed(8);

        await expect(previousButton).toBeDisabled();
        await expect(nextButton).toBeEnabled();

        // Verify page indicator shows "Page 1" (exact match to avoid matching group names)
        const pageIndicator = page.getByText('Page 1', { exact: true });
        await expect(pageIndicator).toBeVisible();
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
            ListGroupsResponseBuilder.responseWithMetadata(groups, 1).withHasMore(false).build(),
        );

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.verifyGroupsDisplayed(3);

        const pagination = page.getByRole('navigation', { name: 'Pagination' });
        await expect(pagination).not.toBeVisible();
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
            ListGroupsResponseBuilder.responseWithMetadata(page2Groups, 1).withHasMore(false).build(),
            { delayMs: 500 },
        );

        const nextButton = page.getByTestId('pagination-next');

        // Click next button - loading state should appear during delay
        const clickPromise = nextButton.click();

        // Give time for the click handler to start (but not complete due to delayed response)
        await page.waitForTimeout(100);

        // Now buttons should be disabled during loading
        await expect(nextButton).toBeDisabled();
        const previousButton = page.getByTestId('pagination-previous');
        await expect(previousButton).toBeDisabled();

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
            ListGroupsResponseBuilder.responseWithMetadata(page2Groups, 1).withHasMore(false).build(),
        );

        const nextButton = page.getByTestId('pagination-next');
        await nextButton.click();
        await dashboardPage.verifyGroupDisplayed('Page 2 Group 1');

        const newGroup = GroupDTOBuilder.groupForUser(user.uid).withId('new-group').withName('New Group').build();

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
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(newGroup),
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
        // Verify page indicator shows "Page 1" (exact match to avoid matching group names)
        const pageIndicator = page.getByText('Page 1', { exact: true });
        await expect(pageIndicator).toBeVisible();
    });

    test('should handle empty state after filtering leaves no results on current page', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const emptyResponse = ListGroupsResponseBuilder.responseWithMetadata([], 0).withHasMore(false).build();

        await mockGroupsApi(page, emptyResponse);

        await page.goto('/dashboard');

        await dashboardPage.verifyEmptyGroupsState();

        const pagination = page.getByRole('navigation', { name: 'Pagination' });
        await expect(pagination).not.toBeVisible();
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

        const mobileNextButton = page.getByTestId('pagination-next-mobile');
        await expect(mobileNextButton).toBeVisible();
        await expect(mobileNextButton).toBeEnabled();

        const mobilePreviousButton = page.getByTestId('pagination-previous-mobile');
        await expect(mobilePreviousButton).toBeVisible();
        await expect(mobilePreviousButton).toBeDisabled();
    });
});

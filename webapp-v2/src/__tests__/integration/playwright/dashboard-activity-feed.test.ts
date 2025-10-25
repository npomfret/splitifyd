import { ActivityFeedItemDTOBuilder, DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder } from '@splitifyd/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockGroupsApi } from '../../utils/mock-firebase-service';

// ============================================================================
// Dashboard Activity Feed Browser Unit Tests
// ============================================================================
// These are browser-based unit tests for the activity feed component.
// They mock the API responses to test UI behavior in isolation.

test.describe('Activity Feed - Display & Content', () => {
    test('should display activity feed on dashboard', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [
            ActivityFeedItemDTOBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Lunch').build(),
            ActivityFeedItemDTOBuilder.memberJoined('item-2', user.uid, 'group-1', 'Test Group', 'Bob', 'Charlie').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedVisible();
        await dashboardPage.verifyActivityFeedItemCount(2);
        await dashboardPage.verifyActivityFeedContainsText('Alice added "Lunch" in Test Group');
        await dashboardPage.verifyActivityFeedContainsText('Bob added Charlie to Test Group');
    });

    test('should display empty state when no activity exists', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedVisible();
        await dashboardPage.verifyActivityFeedEmptyState();
        await dashboardPage.verifyActivityFeedItemCount(0);
    });

    test('should show "You" when current user is the actor', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [
            ActivityFeedItemDTOBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', user.uid, 'My Expense').withActorId(user.uid).build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedContainsText('You added "My Expense" in Test Group');
    });
});

test.describe('Activity Feed - Event Types', () => {
    test('should display expense-created events correctly', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemDTOBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Dinner').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedContainsText('Alice added "Dinner" in Test Group');
    });

    test('should display member-joined events correctly', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemDTOBuilder.memberJoined('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Bob').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedContainsText('Alice added Bob to Test Group');
    });

    test('should display comment-added events with preview', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemDTOBuilder.commentAdded('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Looks good!', 'Groceries').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        const commentTarget = translationEn.activityFeed.labels.commentOnExpense.replace('{{description}}', 'Groceries');
        const expectedDescription = translationEn
            .activityFeed
            .events['comment-added']
            .replace('{{actor}}', 'Alice')
            .replace('{{target}}', commentTarget)
            .replace('{{group}}', 'Test Group');

        await dashboardPage.verifyActivityFeedContainsText(expectedDescription);
        await dashboardPage.verifyActivityFeedContainsPreview('Looks good!');
    });
});

test.describe('Activity Feed - Error Handling', () => {
    test('should display error message when feed fails to load', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        // Mock activity feed API to fail
        await page.route('**/api/activity-feed?*', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal Server Error' }),
            });
        });

        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedError();
    });

    test('should allow retry after error', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemDTOBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Lunch').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        let requestCount = 0;
        await page.route('**/api/activity-feed?*', async (route) => {
            requestCount++;
            if (requestCount === 1) {
                // First request fails
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Internal Server Error' }),
                });
            } else {
                // Second request succeeds
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ items: activityItems, hasMore: false, nextCursor: undefined }),
                });
            }
        });

        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedError();
        await dashboardPage.clickActivityFeedRetry();
        await dashboardPage.verifyActivityFeedContainsText('Alice added "Lunch" in Test Group');
    });
});

test.describe('Activity Feed - Pagination', () => {
    test('should show load more button when there are more items', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemDTOBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Lunch').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        // Mock initial response with hasMore=true
        await page.route('**/api/activity-feed?*', async (route) => {
            const url = new URL(route.request().url());
            const cursor = url.searchParams.get('cursor');

            if (!cursor) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: activityItems,
                        hasMore: true,
                        nextCursor: 'item-1',
                    }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [],
                        hasMore: false,
                        nextCursor: undefined,
                    }),
                });
            }
        });

        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedLoadMoreVisible();
    });

    test('should load more items when button clicked', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const firstPageItems = [ActivityFeedItemDTOBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'First').build()];
        const secondPageItems = [ActivityFeedItemDTOBuilder.expenseCreated('item-2', user.uid, 'group-1', 'Test Group', 'Bob', 'Second').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.route('**/api/activity-feed?*', async (route) => {
            const url = new URL(route.request().url());
            const cursor = url.searchParams.get('cursor');

            if (!cursor) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: firstPageItems,
                        hasMore: true,
                        nextCursor: 'item-1',
                    }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: secondPageItems,
                        hasMore: false,
                        nextCursor: undefined,
                    }),
                });
            }
        });

        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedContainsText('Alice added "First" in Test Group');
        await dashboardPage.clickActivityFeedLoadMore();
        await dashboardPage.verifyActivityFeedContainsText('Bob added "Second" in Test Group');
        await dashboardPage.verifyActivityFeedItemCount(2);
        await dashboardPage.verifyActivityFeedLoadMoreHidden();
    });

    test('should not show load more button when no more items', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemDTOBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Lunch').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedLoadMoreHidden();
    });
});

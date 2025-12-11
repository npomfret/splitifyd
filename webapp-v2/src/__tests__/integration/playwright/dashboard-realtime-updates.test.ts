import { ActivityFeedActions, ActivityFeedEventTypes } from '@billsplit-wl/shared';
import { ActivityFeedItemBuilder, DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockGroupsApi } from '../../utils/mock-firebase-service';

// ============================================================================
// Dashboard Real-time Updates & Notifications (Consolidated)
// ============================================================================
// All notification types (balance, transaction, group details) trigger the same
// refresh mechanism. These tests verify the core notification system works correctly.
test.describe('Dashboard Real-time Notifications', () => {
    test('should refresh dashboard when activity feed update arrives (covers balance/transaction/group changes)', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const initialGroup = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-test')
            .withName('Test Group')
            .build();
        const updatedGroup = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-test')
            .withName('Updated Group')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([initialGroup], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await page.goto('/dashboard');
        await dashboardPage.waitForGroupToAppear('Test Group');

        // Setup updated response
        await page.unroute((routeUrl) => {
            if (routeUrl.pathname !== '/api/groups') return false;
            const searchParams = new URL(routeUrl.href).searchParams;
            return searchParams.get('includeMetadata') === 'true';
        });
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([updatedGroup], 2)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Trigger change notification via activity feed (could be balance, transaction, or group details - all trigger same refresh)
        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemBuilder
                    .forEvent(
                        'activity-group-test-update',
                        user.uid,
                        'group-test',
                        'Updated Group',
                        ActivityFeedEventTypes.GROUP_UPDATED,
                        ActivityFeedActions.UPDATE,
                        'System',
                        {},
                    )
                    .build(),
            ],
        );

        // Verify dashboard refreshed
        await dashboardPage.waitForGroupToAppear('Updated Group');
    });

    test('should handle rapid concurrent notifications without race conditions', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group1 = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-1')
            .withName('Group One')
            .build();
        const group2 = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-2')
            .withName('Group Two')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group1, group2], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await page.goto('/dashboard');
        await dashboardPage.waitForGroupToAppear('Group One');
        await dashboardPage.waitForGroupToAppear('Group Two');

        // Send multiple rapid notifications
        await page.unroute((routeUrl) => {
            if (routeUrl.pathname !== '/api/groups') return false;
            const searchParams = new URL(routeUrl.href).searchParams;
            return searchParams.get('includeMetadata') === 'true';
        });
        for (let i = 2; i <= 5; i++) {
            await mockGroupsApi(
                page,
                ListGroupsResponseBuilder
                    .responseWithMetadata([group1, group2], i)
                    .build(),
            );
            await mockActivityFeedApi(page, []);
            await mockFirebase.emitActivityFeedItems(
                user.uid,
                [
                    ActivityFeedItemBuilder
                        .forEvent(
                            `activity-${i}-group-1`,
                            user.uid,
                            'group-1',
                            'Group One',
                            ActivityFeedEventTypes.GROUP_UPDATED,
                            ActivityFeedActions.UPDATE,
                            'System',
                            {},
                        )
                        .build(),
                    ActivityFeedItemBuilder
                        .forEvent(
                            `activity-${i}-group-2`,
                            user.uid,
                            'group-2',
                            'Group Two',
                            ActivityFeedEventTypes.GROUP_UPDATED,
                            ActivityFeedActions.UPDATE,
                            'System',
                            {},
                        )
                        .build(),
                ],
            );
        }

        // Verify dashboard remains stable after rapid updates
        await dashboardPage.verifyGroupsDisplayed(2);
    });

    test('should handle invalid notifications gracefully', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('valid-group')
            .withName('Valid Group')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await page.goto('/dashboard');
        await dashboardPage.waitForGroupToAppear('Valid Group');

        // Send initial activity to ensure subscription is active
        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemBuilder
                    .forEvent(
                        'activity-valid-baseline',
                        user.uid,
                        'valid-group',
                        'Valid Group',
                        ActivityFeedEventTypes.GROUP_UPDATED,
                        ActivityFeedActions.UPDATE,
                        'System',
                        {},
                    )
                    .build(),
            ],
        );

        // Send malformed activity feed document (missing required fields)
        await mockFirebase.emitRawActivityFeedDocuments(user.uid, [
            {
                data: {
                    userId: user.uid,
                    eventType: ActivityFeedEventTypes.GROUP_UPDATED,
                    timestamp: new Date().toISOString(),
                    details: {},
                },
            },
        ]);

        // Send activity update referencing invalid group ID
        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemBuilder
                    .forEvent(
                        'activity-invalid-group',
                        user.uid,
                        'non-existent-id',
                        'Ghost Group',
                        ActivityFeedEventTypes.GROUP_UPDATED,
                        ActivityFeedActions.UPDATE,
                        'System',
                        {},
                    )
                    .build(),
            ],
        );

        // Verify dashboard remains stable despite malformed/invalid notifications
        await dashboardPage.waitForGroupToAppear('Valid Group');
    });
});

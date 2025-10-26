import {
    DashboardPage,
    GroupDTOBuilder,
    GroupFullDetailsBuilder,
    GroupMemberBuilder,
    HeaderPage,
    ListGroupsResponseBuilder,
    ThemeBuilder,
    ActivityFeedItemBuilder,
} from '@splitifyd/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockGroupCommentsApi, mockGroupDetailApi, mockGroupsApi } from '../../utils/mock-firebase-service';

test.describe('Dashboard User Interface and Responsiveness', () => {
    test('should display user menu and allow interaction', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const headerPage = new HeaderPage(page);

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([], 0)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');

        // Verify user menu is displayed with user info
        await dashboardPage.verifyAuthenticatedUser(user.displayName);

        // Open user menu
        await dashboardPage.openUserMenu();

        await headerPage.verifyUserDropdownVisible();
        await headerPage.verifyDashboardMenuItemVisible();
        await headerPage.verifySettingsMenuItemVisible();
        await headerPage.verifySignOutMenuItemVisible();
    });
});

test.describe('Dashboard Groups Grid Layout and Interactions', () => {
    test('should display groups in responsive grid layout', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Create multiple groups to test grid layout
        const groups = Array.from({ length: 6 }, (_, i) =>
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withId(`group-${i + 1}`)
                .withName(`Test Group ${i + 1}`)
                .build());

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(groups, groups.length)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify grid layout
        await dashboardPage.verifyGroupsGridVisible();
        await dashboardPage.verifyGroupsGridResponsiveLayout();

        // Verify all groups are displayed
        await dashboardPage.verifyGroupsDisplayed(6);
    });

    test('should handle group card hover and click interactions', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('interactive-group')
            .withName('Interactive Group')
            .build();

        // Mock dashboard groups list API
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Mock group detail API for when we navigate to the group page
        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];
        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, 'interactive-group', fullDetails);
        await mockGroupCommentsApi(page, 'interactive-group');

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        await dashboardPage.verifyGroupDisplayed('Interactive Group');
        await dashboardPage.hoverGroupCard('Interactive Group');

        // Test click interaction and verify navigation using fluent method
        // The fluent method automatically verifies URL and page load
        const groupDetailPage = await dashboardPage.clickGroupCardAndNavigateToDetail('Interactive Group');
        await groupDetailPage.waitForPage(group.id, 1);
    });
});

test.describe('Dashboard Group Removal and Deletion', () => {
    test('should remove group from dashboard when user is removed from group', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group1 = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-to-remove')
            .withName('Will Be Removed')
            .build();

        const group2 = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-to-keep')
            .withName('Will Stay')
            .build();

        // Start with two groups
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group1, group2], 2)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify both groups are displayed
        await dashboardPage.verifyGroupsDisplayed(2);
        await dashboardPage.verifyGroupDisplayed('Will Be Removed');
        await dashboardPage.verifyGroupDisplayed('Will Stay');

        // Setup new response without the removed group
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group2], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Simulate user being removed from group via activity feed
        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemBuilder.memberLeft(
                    'activity-group-to-remove',
                    user.uid,
                    'group-to-remove',
                    'Will Be Removed',
                    'System',
                    user.displayName ?? 'You',
                    user.uid,
                ).build(),
            ],
        );

        // Verify removed group disappears
        await dashboardPage.waitForGroupToDisappear('Will Be Removed');
        await dashboardPage.verifyGroupDisplayed('Will Stay');
        await dashboardPage.verifyGroupsDisplayed(1);
    });

    test('should remove group from dashboard when group is deleted', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group1 = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-to-delete')
            .withName('Will Be Deleted')
            .build();

        const group2 = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-to-survive')
            .withName('Will Survive')
            .build();

        // Start with two groups
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group1, group2], 2)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify both groups are displayed
        await dashboardPage.verifyGroupsDisplayed(2);
        await dashboardPage.verifyGroupDisplayed('Will Be Deleted');
        await dashboardPage.verifyGroupDisplayed('Will Survive');

        // Setup new response without the deleted group
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group2], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Simulate group deletion via activity feed
        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemBuilder.memberLeft(
                    'activity-group-to-delete',
                    user.uid,
                    'group-to-delete',
                    'Will Be Deleted',
                    'System',
                    user.displayName ?? 'You',
                    user.uid,
                ).build(),
            ],
        );

        // Verify deleted group disappears
        await dashboardPage.waitForGroupToDisappear('Will Be Deleted');
        await dashboardPage.verifyGroupDisplayed('Will Survive');
        await dashboardPage.verifyGroupsDisplayed(1);
    });

    test('should show empty state after last group is removed', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('only-group')
            .withName('Only Group')
            .build();

        // Start with one group
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify group is displayed
        await dashboardPage.verifyGroupsDisplayed(1);
        await dashboardPage.verifyGroupDisplayed('Only Group');

        // Setup empty groups response
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([], 0)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Simulate removal from last group via activity feed
        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemBuilder.memberLeft(
                    'activity-only-group',
                    user.uid,
                    'only-group',
                    'Only Group',
                    'System',
                    user.displayName ?? 'You',
                    user.uid,
                ).build(),
            ],
        );

        // Verify empty state appears
        await dashboardPage.waitForGroupToDisappear('Only Group');
        await dashboardPage.verifyEmptyGroupsState();
        await dashboardPage.waitForWelcomeMessage();
    });

    test('should handle multiple groups being removed simultaneously', async ({ authenticatedPage }) => {
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

        const group3 = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-3')
            .withName('Group Three')
            .build();

        // Start with three groups
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group1, group2, group3], 3)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Verify all groups are displayed
        await dashboardPage.verifyGroupsDisplayed(3);

        // Setup response with only one group remaining
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group3], 1)
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Simulate two groups being removed simultaneously via activity feed
        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemBuilder.memberLeft(
                    'activity-group-1-left',
                    user.uid,
                    'group-1',
                    'Group One',
                    'System',
                    user.displayName ?? 'You',
                    user.uid,
                ).build(),
                ActivityFeedItemBuilder.memberLeft(
                    'activity-group-2-left',
                    user.uid,
                    'group-2',
                    'Group Two',
                    'System',
                    user.displayName ?? 'You',
                    user.uid,
                ).build(),
            ],
        );

        // Verify removed groups disappear
        await dashboardPage.waitForGroupToDisappear('Group One');
        await dashboardPage.waitForGroupToDisappear('Group Two');
        await dashboardPage.verifyGroupDisplayed('Group Three');
        await dashboardPage.verifyGroupsDisplayed(1);
    });
});

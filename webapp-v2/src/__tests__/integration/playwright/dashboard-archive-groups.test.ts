import { expect } from '@playwright/test';
import { MemberStatuses } from '@splitifyd/shared';
import { ActivityFeedActions, ActivityFeedEventTypes } from '@splitifyd/shared';
import { ActivityFeedItemDTOBuilder, DashboardPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ListGroupsResponseBuilder, ThemeBuilder } from '@splitifyd/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockArchiveGroupApi, mockGroupCommentsApi, mockGroupDetailApi, mockGroupsApi, mockUnarchiveGroupApi } from '../../utils/mock-firebase-service';

test.describe('Dashboard group archiving', () => {
    test('should archive and unarchive a group from group detail quick actions', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId('group-archive-demo')
            .withName('Archive Demo Group')
            .withLastActivity('Just now')
            .build();

        const activeResponse = ListGroupsResponseBuilder
            .responseWithMetadata([group], 1)
            .build();
        const emptyResponse = ListGroupsResponseBuilder
            .responseWithMetadata([], 0)
            .build();

        const memberTheme = ThemeBuilder.blue().build();
        const activeMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withTheme(memberTheme)
            .withStatus(MemberStatuses.ACTIVE)
            .build();
        const archivedMember = { ...activeMember, memberStatus: MemberStatuses.ARCHIVED };

        const fullDetailsActive = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([activeMember])
            .build();
        const fullDetailsArchived = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([archivedMember])
            .build();

        const activeQueryParams = { limit: '8', statusFilter: MemberStatuses.ACTIVE } as const;
        const archivedQueryParams = { limit: '8', statusFilter: MemberStatuses.ARCHIVED } as const;

        const queueActive = async (response = activeResponse, options: { once?: boolean; } = { once: true }) => {
            await mockGroupsApi(page, response, { query: activeQueryParams, ...options });
            await mockActivityFeedApi(page, []);
            await mockActivityFeedApi(page, []);
        };

        const queueArchived = async (response = emptyResponse, options: { once?: boolean; } = { once: true }) => {
            await mockGroupsApi(page, response, { query: archivedQueryParams, ...options });
            await mockActivityFeedApi(page, []);
            await mockActivityFeedApi(page, []);
        };

        // Initial active dashboard load shows the group
        await queueActive(activeResponse);

        await mockArchiveGroupApi(page, group.id, undefined, { once: true });
        await mockUnarchiveGroupApi(page, group.id, undefined, { once: true });

        await mockGroupCommentsApi(page, group.id);
        await mockGroupDetailApi(page, group.id, fullDetailsActive, { once: false });

        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Archive Demo Group');
        await expect(page).toHaveURL(/\/dashboard$/);

        // Baseline handlers for subsequent refreshes
        await queueActive(activeResponse, { once: false });
        await queueArchived(emptyResponse, { once: false });

        // Open group detail and archive via quick action
        const groupDetailPage = await dashboardPage.clickGroupCardAndNavigateToDetail('Archive Demo Group', {
            expectedGroupId: group.id,
            expectedMemberCount: 1,
            waitForReady: true,
        });
        await expect(page).toHaveURL(/\/groups\/group-archive-demo$/);

        // Queue responses before triggering archive (store refreshes immediately)
        await queueActive(emptyResponse);
        await queueArchived(activeResponse);
        await mockGroupDetailApi(page, group.id, fullDetailsArchived, { once: false });

        await groupDetailPage.clickArchiveGroup({ expectedGroupId: group.id });
        await expect(page).toHaveURL(/\/groups\/group-archive-demo$/);
        await groupDetailPage.ensureUnarchiveActionVisible({ expectedGroupId: group.id });

        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemDTOBuilder.forEvent(
                    'activity-archive-demo-archived',
                    user.uid,
                    group.id,
                    group.name,
                    ActivityFeedEventTypes.GROUP_UPDATED,
                    ActivityFeedActions.UPDATE,
                    'System',
                    {},
                ).build(),
            ],
        );

        // Return to dashboard and verify archived/active filters reflect new state
        await page.goBack();
        await dashboardPage.waitForGroupsToLoad();
        await expect(page).toHaveURL(/\/dashboard$/);

        // Maintain fallbacks reflecting archived state
        await queueActive(emptyResponse, { once: false });
        await queueArchived(activeResponse, { once: false });

        await dashboardPage.showArchivedGroups();
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Archive Demo Group');
        await dashboardPage.verifyGroupHasArchivedBadge('Archive Demo Group');
        await dashboardPage.verifyGroupHasNoArchiveQuickActions('Archive Demo Group');

        await dashboardPage.showActiveGroups();
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.waitForGroupToDisappear('Archive Demo Group', 10_000);

        // Switch back to archived tab to open the archived group
        await queueArchived(activeResponse);
        await mockGroupDetailApi(page, group.id, fullDetailsArchived, { once: false });
        await dashboardPage.showArchivedGroups();
        await dashboardPage.waitForGroupsToLoad();

        // Unarchive from group detail and confirm archived list clears
        const archivedDetailPage = await dashboardPage.clickGroupCardAndNavigateToDetail('Archive Demo Group', {
            expectedGroupId: group.id,
            expectedMemberCount: 1,
            waitForReady: true,
        });
        await expect(page).toHaveURL(/\/groups\/group-archive-demo$/);
        await archivedDetailPage.ensureUnarchiveActionVisible({ expectedGroupId: group.id });

        // Queue responses before unarchiving
        await queueActive(activeResponse);
        await queueArchived(emptyResponse);
        await mockGroupDetailApi(page, group.id, fullDetailsActive, { once: false });

        await archivedDetailPage.clickUnarchiveGroup({ expectedGroupId: group.id });
        await archivedDetailPage.ensureArchiveActionVisible({ expectedGroupId: group.id });

        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemDTOBuilder.forEvent(
                    'activity-archive-demo-unarchived',
                    user.uid,
                    group.id,
                    group.name,
                    ActivityFeedEventTypes.GROUP_UPDATED,
                    ActivityFeedActions.UPDATE,
                    'System',
                    {},
                ).build(),
            ],
        );

        await queueActive(activeResponse, { once: false });
        await queueArchived(emptyResponse, { once: false });
        await mockGroupDetailApi(page, group.id, fullDetailsActive, { once: false });

        // Refresh dashboard views
        await page.goBack();
        await dashboardPage.waitForGroupsToLoad();
        await expect(page).toHaveURL(/\/dashboard$/);
        await dashboardPage.showActiveGroups();
        await dashboardPage.verifyGroupDisplayed('Archive Demo Group');
        await dashboardPage.showArchivedGroups();
        await dashboardPage.waitForArchivedGroupsEmptyState(10_000);
    });
});

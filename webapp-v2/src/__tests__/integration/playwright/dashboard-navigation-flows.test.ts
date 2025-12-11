import { DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockGenerateShareLinkApi, mockGroupsApi } from '../../utils/mock-firebase-service';

test.describe('Dashboard Navigation Flows', () => {
    test('should navigate to group detail when clicking group card', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupToAppear('Test Group');

        // Click group card
        await dashboardPage.clickGroupCard('Test Group');

        // Verify navigation to group detail
        await expect(page).toHaveURL(/\/groups\/group-123/);
    });

    test('should return to dashboard from group detail', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('group-123')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupToAppear('Test Group');

        // Navigate to group detail
        await dashboardPage.clickGroupCard('Test Group');
        await expect(page).toHaveURL(/\/groups\/group-123/);

        // Go back to dashboard
        await page.goBack();

        // Verify back on dashboard
        await dashboardPage.verifyDashboardPageLoaded();
    });

    test('should maintain dashboard state after modal interactions', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const groups = [
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withName('Group 1')
                .withId('group-1')
                .build(),
            GroupDTOBuilder
                .groupForUser(user.uid)
                .withName('Group 2')
                .withId('group-2')
                .build(),
        ];

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata(groups)
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'group-1');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupToAppear('Group 1');
        await dashboardPage.waitForGroupToAppear('Group 2');

        // Open and close share modal
        const shareModal = await dashboardPage.clickGroupCardInviteButton('Group 1');
        await shareModal.verifyModalOpen();
        await shareModal.clickClose();

        // Verify dashboard still shows all groups
        await dashboardPage.verifyGroupsDisplayed(2);
        await dashboardPage.waitForGroupToAppear('Group 1');
        await dashboardPage.waitForGroupToAppear('Group 2');
    });

    test('should update URL correctly when navigating', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([])
                .build(),
        );
        await mockActivityFeedApi(page, []);

        // Navigate to dashboard
        await dashboardPage.navigate();

        // Verify URL is correct
        await expect(page).toHaveURL('/dashboard');

        // Verify dashboard loaded
        await dashboardPage.verifyDashboardPageLoaded();
    });
});

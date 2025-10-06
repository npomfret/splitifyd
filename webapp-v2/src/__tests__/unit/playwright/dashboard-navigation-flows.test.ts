import { expect, test } from '../../utils/console-logging-fixture';
import { createMockFirebase, MockFirebase, mockFullyAcceptedPoliciesApi, mockGenerateShareLinkApi, mockGroupsApi } from '../../utils/mock-firebase-service';
import { ClientUserBuilder, DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder } from '@splitifyd/test-support';

test.describe('Dashboard Navigation Flows', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should navigate to group detail when clicking group card', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Click group card
        await dashboardPage.clickGroupCard('Test Group');

        // Verify navigation to group detail
        await expect(page).toHaveURL(/\/groups\/group-123/);
    });

    test('should return to dashboard from group detail', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Navigate to group detail
        await dashboardPage.clickGroupCard('Test Group');
        await expect(page).toHaveURL(/\/groups\/group-123/);

        // Go back to dashboard
        await page.goBack();

        // Verify back on dashboard
        await dashboardPage.verifyDashboardPageLoaded();
    });

    test('should maintain dashboard state after modal interactions', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const groups = [GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 1').withId('group-1').build(), GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 2').withId('group-2').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata(groups).build());
        await mockGenerateShareLinkApi(page, 'group-1');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Open and close share modal
        await dashboardPage.clickGroupCardInviteButton('Group 1');
        await dashboardPage.verifyShareModalOpen();
        await dashboardPage.closeShareModal();

        // Verify dashboard still shows all groups
        await dashboardPage.verifyGroupsDisplayed(2);
        await dashboardPage.verifyGroupDisplayed('Group 1');
        await dashboardPage.verifyGroupDisplayed('Group 2');
    });

    test('should update URL correctly when navigating', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([]).build());

        // Navigate to dashboard
        await dashboardPage.navigate();

        // Verify URL is correct
        await expect(page).toHaveURL('/dashboard');

        // Verify dashboard loaded
        await dashboardPage.verifyDashboardPageLoaded();
    });
});

import { expect, test } from '../../utils/console-logging-fixture';
import { createMockFirebase, MockFirebase, mockFullyAcceptedPoliciesApi, mockGenerateShareLinkApi, mockGroupsApi } from '../../utils/mock-firebase-service';
import {ClientUserBuilder, DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder, UserNotificationDocumentBuilder} from '@splitifyd/test-support';

test.describe('Dashboard Stats Display', () => {
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

    test('should display loading skeleton while groups are loading', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Mock delayed API response to see loading state
        await page.route('/api/groups?includeMetadata=true', async (route) => {
            await page.waitForTimeout(1000);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(ListGroupsResponseBuilder.responseWithMetadata([]).build()),
            });
        });

        await dashboardPage.navigate();

        // Verify stats show loading skeleton
        await dashboardPage.verifyStatsLoading();

        // Wait for loading to complete
        await dashboardPage.waitForGroupsToLoad();
    });

    test('should display correct group counts with zero groups', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([]).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Verify stats display
        await dashboardPage.verifyStatsDisplayed(0, 0);
    });

    test('should display correct group counts with multiple groups', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const groups = [
            GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 1').withId('group-1').build(),
            GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 2').withId('group-2').build(),
            GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 3').withId('group-3').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata(groups).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Verify stats display 3 groups
        await dashboardPage.verifyStatsDisplayed(3, 3);
    });

    test('should update stats when group is added', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Start with 2 groups
        const initialGroups = [
            GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 1').withId('group-1').build(),
            GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 2').withId('group-2').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata(initialGroups).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Verify initial count
        await dashboardPage.verifyStatsDisplayed(2, 2);

        // Establish baseline notification state for both existing groups
        await mockFirebase!.triggerNotificationUpdate(testUser.uid, new UserNotificationDocumentBuilder().withChangeVersion(1).withGroupDetails('group-1', 1).withGroupDetails('group-2', 1).build());

        // Simulate adding a new group via notification
        const newGroup = GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 3').withId('group-3').build();
        const updatedGroups = [...initialGroups, newGroup];

        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata(updatedGroups, 2).build());

        // Trigger notification for new group
        await mockFirebase!.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder().withChangeVersion(2).withGroupDetails('group-1', 1).withGroupDetails('group-2', 1).withGroupDetails('group-3', 1).build(),
        );

        // Verify updated count - assertions automatically retry until condition is met
        await dashboardPage.verifyStatsDisplayed(3, 3);
    });

    test('should update stats when group is removed', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        // Start with 3 groups
        const initialGroups = [
            GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 1').withId('group-1').build(),
            GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 2').withId('group-2').build(),
            GroupDTOBuilder.groupForUser(testUser.uid).withName('Group 3').withId('group-3').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata(initialGroups).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Verify initial count
        await dashboardPage.verifyStatsDisplayed(3, 3);

        // Establish baseline notification state for all groups
        await mockFirebase!.triggerNotificationUpdate(
            testUser.uid,
            new UserNotificationDocumentBuilder().withChangeVersion(1).withGroupDetails('group-1', 1).withGroupDetails('group-2', 1).withGroupDetails('group-3', 1).build(),
        );

        // Simulate removing a group
        const remainingGroups = initialGroups.slice(0, 2);

        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata(remainingGroups, 2).build());

        // Trigger notification to refresh the dashboard
        // When a group is deleted, we trigger a notification with updated change version
        await mockFirebase!.triggerNotificationUpdate(testUser.uid, new UserNotificationDocumentBuilder().withChangeVersion(2).withGroupDetails('group-1', 1).withGroupDetails('group-2', 1).build());

        // Verify updated count - assertions automatically retry until condition is met
        await dashboardPage.verifyStatsDisplayed(2, 2);
    });
});

test.describe('Dashboard Quick Actions', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([]).build());
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should display quick actions card', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        await dashboardPage.navigate();

        // Verify quick actions displayed
        await dashboardPage.verifyQuickActionsDisplayed();
    });

    test('should open create group modal from quick actions', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        await dashboardPage.navigate();

        // Click quick actions create button
        const createModal = await dashboardPage.clickQuickActionsCreateGroup();

        // Verify modal opened
        await createModal.verifyModalOpen();
    });
});

test.describe('Dashboard Group Card Actions', () => {
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

    test('should show action buttons on group card hover', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Verify action buttons visible on hover
        await dashboardPage.verifyGroupCardActionsVisible('Test Group');
    });

    test('should open share modal when clicking invite button', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Click invite button
        await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Verify share modal opened
        await dashboardPage.verifyShareModalOpen();
    });

    test('should navigate to add expense form when clicking add expense button', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Click add expense button
        await dashboardPage.clickGroupCardAddExpenseButton('Test Group');

        // Verify navigation to add expense page
        await expect(page).toHaveURL(/\/groups\/group-123\/add-expense/);
    });

    test('should not navigate when clicking action buttons', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Test Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());
        await mockGenerateShareLinkApi(page, 'group-123');

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Click invite button (should not navigate to group detail)
        await dashboardPage.clickGroupCardInviteButton('Test Group');

        // Verify still on dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Close modal
        await dashboardPage.closeShareModal();
    });

    test('should display "settled up" when no debts exist', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withName('Settled Group').withId('group-123').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Verify settled up message
        await dashboardPage.verifyGroupCardBalance('Settled Group', 'Settled up');
    });

    test('should display correct balance for owed money', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withName('Owed Group')
            .withId('group-123')
            .withBalance({
                USD: {
                    currency: 'USD',
                    netBalance: 50.0,
                    owes: {},
                    owedBy: {},
                },
            })
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Verify owed balance display - contains check to handle "$50.00" formatting
        const balanceBadge = dashboardPage.getGroupCardBalance('Owed Group');
        await expect(balanceBadge).toBeVisible();
        await expect(balanceBadge).toContainText("You're owed");
    });

    test('should display correct balance for owing money', async ({ pageWithLogging: page }) => {
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(testUser.uid)
            .withName('Owing Group')
            .withId('group-123')
            .withBalance({
                USD: {
                    currency: 'USD',
                    netBalance: -50.0,
                    owes: {},
                    owedBy: {},
                },
            })
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group]).build());

        await dashboardPage.navigate();
        await dashboardPage.waitForGroupsToLoad();

        // Verify owing balance display - contains check to handle "$50.00" formatting
        const balanceBadge = dashboardPage.getGroupCardBalance('Owing Group');
        await expect(balanceBadge).toBeVisible();
        await expect(balanceBadge).toContainText('You owe');
    });
});


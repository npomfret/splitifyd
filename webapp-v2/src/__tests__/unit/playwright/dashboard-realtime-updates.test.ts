import { DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder, UserNotificationDocumentBuilder } from '@splitifyd/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockGroupsApi } from '../../utils/mock-firebase-service';

// ============================================================================
// Dashboard Real-time Updates & Notifications (Consolidated)
// ============================================================================
// All notification types (balance, transaction, group details) trigger the same
// refresh mechanism. These tests verify the core notification system works correctly.
test.describe('Dashboard Real-time Notifications', () => {
    test('should refresh dashboard when notification received (covers balance/transaction/group changes)', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const initialGroup = GroupDTOBuilder.groupForUser(user.uid).withId('group-test').withName('Test Group').build();
        const updatedGroup = GroupDTOBuilder.groupForUser(user.uid).withId('group-test').withName('Updated Group').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([initialGroup], 1).build());
        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();
        await dashboardPage.verifyGroupDisplayed('Test Group');

        // Send baseline notification
        await mockFirebase.triggerNotificationUpdate(user.uid, UserNotificationDocumentBuilder.withBaseline('group-test', 1).withLastModified(new Date()).build());

        // Setup updated response
        await page.unroute('/api/groups?includeMetadata=true');
        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([updatedGroup], 2).build());

        // Trigger change notification (could be balance, transaction, or group details - all trigger same refresh)
        await mockFirebase.triggerNotificationUpdate(user.uid, UserNotificationDocumentBuilder.withGroupDetailsChange('group-test', 2).withLastModified(new Date()).build());

        // Verify dashboard refreshed
        await dashboardPage.waitForGroupToAppear('Updated Group');
    });

    test('should handle rapid concurrent notifications without race conditions', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group1 = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Group One').build();
        const group2 = GroupDTOBuilder.groupForUser(user.uid).withId('group-2').withName('Group Two').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group1, group2], 1).build());
        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Send baseline
        await mockFirebase.triggerNotificationUpdate(user.uid, new UserNotificationDocumentBuilder().withChangeVersion(1).withGroupDetails('group-1', 1).withGroupDetails('group-2', 1).build());

        // Send multiple rapid notifications
        await page.unroute('/api/groups?includeMetadata=true');
        for (let i = 2; i <= 5; i++) {
            await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group1, group2], i).build());
            await mockFirebase.triggerNotificationUpdate(
                user.uid,
                new UserNotificationDocumentBuilder()
                    .withChangeVersion(i)
                    .withGroupChangeCounts('group-1', { groupDetailsChangeCount: 1, transactionChangeCount: i - 1, balanceChangeCount: i - 1, commentChangeCount: 0 })
                    .build(),
            );
        }

        // Verify dashboard remains stable after rapid updates
        await dashboardPage.verifyGroupsDisplayed(2);
    });

    test('should handle invalid notifications gracefully', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('valid-group').withName('Valid Group').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await page.goto('/dashboard');
        await dashboardPage.waitForGroupsToLoad();

        // Send baseline
        await mockFirebase.triggerNotificationUpdate(user.uid, new UserNotificationDocumentBuilder().withChangeVersion(1).withGroupDetails('valid-group', 1).build());

        // Send malformed notification (missing required fields)
        await mockFirebase.triggerNotificationUpdate(user.uid, { changeVersion: 2, groups: { 'valid-group': { lastGroupDetailsChange: new Date() } } });

        // Send notification with invalid group ID
        await mockFirebase.triggerNotificationUpdate(
            user.uid,
            new UserNotificationDocumentBuilder().withChangeVersion(3).withGroupDetails('non-existent-id', 1).withGroupDetails('valid-group', 1).build(),
        );

        // Verify dashboard remains stable despite malformed/invalid notifications
        await dashboardPage.verifyGroupDisplayed('Valid Group');
    });
});

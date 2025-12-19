import { DashboardPage, GroupDetailPage } from '@billsplit-wl/test-support';
import { expect, simpleTest } from '../../fixtures';

async function navigateToDashboardFromGroup(groupDetailPage: GroupDetailPage): Promise<DashboardPage> {
    await groupDetailPage.header.navigateToDashboard();
    const dashboardPage = new DashboardPage(groupDetailPage.page);
    await dashboardPage.waitForDashboard();
    return dashboardPage;
}

/**
 * Group Locking E2E Tests
 *
 * Tests the group locking feature which allows admins to lock a group,
 * making it read-only for all members. When locked, no new expenses,
 * settlements, member changes, or settings modifications are permitted.
 */

simpleTest.describe('Group Locking - Admin Flow', () => {
    simpleTest('admin should be able to lock and unlock a group', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: adminDashboardPage }] = await createLoggedInBrowsers(1);

        // Create a group as admin
        const [groupDetailPage] = await adminDashboardPage.createMultiUserGroup();

        // Open settings and verify lock toggle is visible (admin only)
        const settingsModal = await groupDetailPage.clickEditGroupAndOpenModal('general');
        await settingsModal.verifyGroupLockToggleVisible();

        // Verify group starts unlocked
        await settingsModal.verifyGroupUnlocked();

        // Lock the group
        await settingsModal.lockGroup();
        await settingsModal.verifyGroupLocked();
        await settingsModal.verifyGroupLockSuccessVisible();

        // Close modal and verify locked banner appears
        await settingsModal.clickFooterClose();
        await groupDetailPage.waitForLockedGroupBanner();
        await groupDetailPage.verifyLockedGroupBannerVisible();

        // Verify action buttons are disabled when locked
        await groupDetailPage.verifyAllActionButtonsDisabled();

        // Reopen settings and unlock the group
        const settingsModal2 = await groupDetailPage.clickEditGroupAndOpenModal('general');
        await settingsModal2.verifyGroupLocked();
        await settingsModal2.unlockGroup();
        await settingsModal2.verifyGroupUnlocked();
        await settingsModal2.verifyGroupLockSuccessVisible();

        // Close modal and verify banner disappears
        await settingsModal2.clickFooterClose();
        await groupDetailPage.verifyLockedGroupBannerNotVisible();

        // Verify action buttons are re-enabled
        await groupDetailPage.verifyAllActionButtonsEnabled();
    });

    simpleTest('locked state should persist after page refresh', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage: adminDashboardPage }] = await createLoggedInBrowsers(1);

        // Create and lock a group
        const [groupDetailPage] = await adminDashboardPage.createMultiUserGroup();
        const groupId = groupDetailPage.inferGroupId();

        const settingsModal = await groupDetailPage.clickEditGroupAndOpenModal('general');
        await settingsModal.lockGroup();
        await settingsModal.verifyGroupLocked();
        await settingsModal.clickFooterClose();

        // Verify locked state
        await groupDetailPage.verifyLockedGroupBannerVisible();
        await groupDetailPage.verifyAllActionButtonsDisabled();

        // Refresh the page
        await page.reload();
        await groupDetailPage.waitForPage(groupId, 1);

        // Verify locked state persists
        await groupDetailPage.verifyLockedGroupBannerVisible();
        await groupDetailPage.verifyAllActionButtonsDisabled();
    });
});

simpleTest.describe('Group Locking - Member Experience', () => {
    simpleTest('member should see locked state and disabled actions in real-time', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: adminDashboardPage }, { dashboardPage: memberDashboardPage }] = await createLoggedInBrowsers(2);

        // Admin creates group with member
        const [adminGroupDetailPage, memberGroupDetailPage] = await adminDashboardPage.createMultiUserGroup(memberDashboardPage);

        // Verify member starts with enabled buttons
        await memberGroupDetailPage.verifyAllActionButtonsEnabled();
        await memberGroupDetailPage.verifyLockedGroupBannerNotVisible();

        // Admin locks the group
        const settingsModal = await adminGroupDetailPage.clickEditGroupAndOpenModal('general');
        await settingsModal.lockGroup();
        await settingsModal.verifyGroupLocked();
        await settingsModal.clickFooterClose();

        // Member should see locked state in real-time (via activity feed SSE)
        await memberGroupDetailPage.waitForLockedGroupBanner();
        await memberGroupDetailPage.verifyLockedGroupBannerVisible();
        await memberGroupDetailPage.verifyAllActionButtonsDisabled();

        // Admin unlocks the group
        const settingsModal2 = await adminGroupDetailPage.clickEditGroupAndOpenModal('general');
        await settingsModal2.unlockGroup();
        await settingsModal2.verifyGroupUnlocked();
        await settingsModal2.clickFooterClose();

        // Member should see unlocked state in real-time
        await memberGroupDetailPage.verifyLockedGroupBannerNotVisible();
        await memberGroupDetailPage.verifyAllActionButtonsEnabled();
    });

    simpleTest('non-admin member should not see lock toggle in settings', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: adminDashboardPage }, { dashboardPage: memberDashboardPage }] = await createLoggedInBrowsers(2);

        // Admin creates group with member
        const [, memberGroupDetailPage] = await adminDashboardPage.createMultiUserGroup(memberDashboardPage);

        // Member opens settings (if they have access to identity tab)
        // Note: Members may not have access to the general tab at all with default permissions
        // This test verifies that if they do have settings access, they don't see the lock toggle
        const settingsModal = await memberGroupDetailPage.clickEditGroupAndOpenModal('identity');

        // Verify lock toggle is not visible (it's in the general tab which members don't have access to)
        await settingsModal.verifyGroupLockToggleNotVisible();
        await settingsModal.clickFooterClose();
    });
});

simpleTest.describe('Group Locking - Dashboard Activity', () => {
    simpleTest('locking and unlocking should show in dashboard activity feed', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: adminDashboardPage }] = await createLoggedInBrowsers(1);

        // Create a group
        const [groupDetailPage] = await adminDashboardPage.createMultiUserGroup();
        const groupName = await groupDetailPage.getGroupNameText();

        // Lock the group
        const settingsModal = await groupDetailPage.clickEditGroupAndOpenModal('general');
        await settingsModal.lockGroup();
        await settingsModal.clickFooterClose();

        // Navigate to dashboard and verify activity shows lock event
        const dashboardPage = await navigateToDashboardFromGroup(groupDetailPage);
        await dashboardPage.verifyActivityFeedShows('locked');
        // Close the notifications dropdown to avoid it blocking group card clicks
        await dashboardPage.header.closeNotificationsDropdown();

        // Return to group and unlock
        const groupDetailPage2 = await dashboardPage.clickGroupCardAndNavigateToDetail(groupName);
        // Wait for locked state to be fully loaded before opening settings
        // This ensures permissions are loaded and General tab will be available
        await groupDetailPage2.waitForLockedGroupBanner();
        const settingsModal2 = await groupDetailPage2.clickEditGroupAndOpenModal('general');
        await settingsModal2.unlockGroup();
        await settingsModal2.clickFooterClose();

        // Navigate to dashboard and verify activity shows unlock event
        const dashboardPage2 = await navigateToDashboardFromGroup(groupDetailPage2);
        await dashboardPage2.verifyActivityFeedShows('unlocked');
    });
});

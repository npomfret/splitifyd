import { expect, simpleTest } from '../../fixtures';
import { generateShortId } from '@splitifyd/test-support';
import { GroupDetailPage, JoinGroupPage } from '../../pages';

simpleTest.describe('Multi-User Group Deletion Real-Time Updates', () => {
    simpleTest('should update both dashboards when owner deletes group', async ({ newLoggedInBrowser }) => {
        // No error checking skip needed - immediate redirect after delete confirmation prevents 404s

        // Create two browser instances - owner (user1) and member (user2)
        let { dashboardPage: dashboardPage1 } = await newLoggedInBrowser();
        let { page: page2, dashboardPage: dashboardPage2 } = await newLoggedInBrowser();

        // Setup 2-person group with unique ID
        const groupName = `Owner Delete Test ${generateShortId()}`;
        let groupDetailPageUser1 = await dashboardPage1.createGroupAndNavigate(groupName, 'Testing owner deletion');
        const groupId = groupDetailPageUser1.inferGroupId();

        // Get share link and have User2 join
        const shareLink = await groupDetailPageUser1.getShareLink();

        // User2 joins using robust JoinGroupPage
        const groupDetailPage2 = await JoinGroupPage.joinGroupViaShareLink(page2, shareLink, groupId);

        // Wait for synchronization - both users should see 2 members total
        await groupDetailPageUser1.waitForMemberCount(2);
        await groupDetailPage2.waitForMemberCount(2);

        // Both users navigate to dashboard to see the group
        dashboardPage1 = await groupDetailPageUser1.navigateToDashboard();
        dashboardPage2 = await groupDetailPage2.navigateToDashboard();

        // Verify both users can see the group on dashboard
        await dashboardPage1.waitForGroupToAppear(groupName);
        await dashboardPage2.waitForGroupToAppear(groupName);

        // User1 (owner) clicks on the group from dashboard to navigate to it
        groupDetailPageUser1 = await dashboardPage1.clickGroupCard(groupName);

        // Delete the group
        const editModal = await groupDetailPageUser1.openEditGroupModal();
        await editModal.clickDeleteGroup();
        dashboardPage1 = await editModal.handleDeleteConfirmDialog(groupName);

        // CRITICAL TEST: Both dashboards should update in real-time WITHOUT reload
        // User1's dashboard should not show the deleted group
        await dashboardPage1.waitForGroupToNotBePresent(groupName);

        // User2's dashboard should also update in real-time (this tests the bug fix)
        await dashboardPage2.waitForGroupToNotBePresent(groupName);
    });

    simpleTest('should redirect member to dashboard when group is deleted while viewing group detail page', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - some console errors may occur during the redirect process
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Console errors may occur during redirect when group is deleted while member viewing it' });

        // Create two browser instances - owner (user1) and member (user2)
        let { dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, user: member } = await newLoggedInBrowser();

        // Setup 2-person group with unique ID
        const groupName = `Member On Detail Test ${generateShortId()}`;

        let ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing deletion while member on detail page');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Get share link and have member join
        const shareLink = await ownerGroupDetailPage.getShareLink();

        // Member joins using robust JoinGroupPage
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Wait for synchronization - both users should see 2 members total
        await ownerGroupDetailPage.waitForMemberCount(2);
        await memberGroupDetailPage.waitForMemberCount(2);

        // CRITICAL TEST SETUP:
        // Owner: Will navigate to dashboard and delete the group
        // Member: Stays on group detail page (should get redirected to 404)

        // Owner navigates to dashboard to delete the group
        ownerDashboardPage = await ownerDashboardPage.navigateToDashboard();
        await ownerDashboardPage.waitForDashboard();
        await ownerDashboardPage.waitForGroupToAppear(groupName);

        // Owner clicks on the group from dashboard to delete it
        ownerGroupDetailPage = await ownerDashboardPage.clickGroupCard(groupName);

        // Owner deletes the group while member is still viewing it
        const editModal = await ownerGroupDetailPage.openEditGroupModal();
        await editModal.clickDeleteGroup();
        ownerDashboardPage = await editModal.handleDeleteConfirmDialog(groupName);

        // CRITICAL TEST: Member should be redirected to dashboard when group is deleted
        // The member should be automatically redirected to the dashboard when they detect removal
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Note: We don't check if the group disappears from owner's dashboard immediately
        // because deletion now happens in background for better UX
    });
});

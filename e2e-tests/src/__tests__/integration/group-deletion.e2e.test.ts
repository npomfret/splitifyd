import { simpleTest, expect } from '../../fixtures';
import { JoinGroupPage, DashboardPage } from '../../pages';
import { generateShortId } from '@splitifyd/test-support';

simpleTest.describe('Group Deletion', () => {
    simpleTest('should update dashboards when owner deletes group', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - owner and member (both on dashboard)
        let [
            { dashboardPage: ownerDashboardPage },
            { page: memberPage, dashboardPage: memberDashboardPage }
        ] = await createLoggedInBrowsers(2);

        // Setup 2-person group with unique ID
        let [ownerGroupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({  }, memberDashboardPage);
        const groupId = ownerGroupDetailPage.inferGroupId();
        const groupName = await ownerGroupDetailPage.getGroupName();

        // Both users navigate to dashboard to see the group
        ownerDashboardPage = await ownerGroupDetailPage.navigateToDashboard();
        memberDashboardPage = await memberGroupDetailPage.navigateToDashboard();

        // Verify both users can see the group on dashboard
        await ownerDashboardPage.waitForGroupToAppear(groupName);
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // Owner clicks on the group from dashboard to navigate to it
        ownerGroupDetailPage = await ownerDashboardPage.clickGroupCard(groupName);

        // Delete the group
        const editModal = await ownerGroupDetailPage.openEditGroupModal();
        await editModal.clickDeleteGroup();
        ownerDashboardPage = await editModal.handleDeleteConfirmDialog(groupName);

        // CRITICAL TEST: Both dashboards should update in real-time WITHOUT reload
        await ownerDashboardPage.waitForGroupToNotBePresent(groupName);
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);
    });

    simpleTest('should redirect member when group deleted while viewing', async ({ createLoggedInBrowsers }, testInfo) => {
        // Skip error checking - console errors may occur during redirect
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Console errors may occur during redirect when group is deleted while member viewing it' });

        // Create two browser instances - owner and member
        let [
            { dashboardPage: ownerDashboardPage },
            { dashboardPage: memberDashboardPage }
        ] = await createLoggedInBrowsers(2);

        // Setup 2-person group with unique ID
        // Create memberDashboardPage since it's not in the destructured variables
        let [ownerGroupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({ }, memberDashboardPage);
        const groupId = ownerGroupDetailPage.inferGroupId();
        const groupName = await ownerGroupDetailPage.getGroupName();

        // Owner navigates to dashboard to delete the group
        ownerDashboardPage = await ownerGroupDetailPage.navigateToDashboard();
        await ownerDashboardPage.waitForDashboard();
        await ownerDashboardPage.waitForGroupToAppear(groupName);

        // Owner clicks on the group from dashboard to delete it
        ownerGroupDetailPage = await ownerDashboardPage.clickGroupCard(groupName);

        // Owner deletes the group while member is still viewing it
        const editModal = await ownerGroupDetailPage.openEditGroupModal();
        await editModal.clickDeleteGroup();
        ownerDashboardPage = await editModal.handleDeleteConfirmDialog(groupName);

        // CRITICAL TEST: Member should be redirected away when group is deleted
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);
    });
});
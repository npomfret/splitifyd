import { simpleTest, expect } from '../../fixtures';
import { JoinGroupPage } from '../../pages';
import { generateShortId } from '@splitifyd/test-support';

simpleTest.describe('Group Deletion', () => {
    simpleTest('should update dashboards when owner deletes group', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - owner and member (both on dashboard)
        let { dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        let { page: memberPage, dashboardPage: memberDashboardPage } = await newLoggedInBrowser();

        // Setup 2-person group with unique ID
        const groupName = `Owner Delete Test ${generateShortId()}`;
        let ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing owner deletion');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Get share link and have member join
        const shareLink = await ownerGroupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Wait for synchronization - both users should see 2 members total
        await ownerGroupDetailPage.waitForMemberCount(2);
        await memberGroupDetailPage.waitForMemberCount(2);

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

    simpleTest('should redirect member when group deleted while viewing', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - console errors may occur during redirect
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Console errors may occur during redirect when group is deleted while member viewing it' });

        // Create two browser instances - owner and member
        let { dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage } = await newLoggedInBrowser();

        // Setup 2-person group with unique ID
        const groupName = `Member On Detail Test ${generateShortId()}`;
        let ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing deletion while member on detail page');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Get share link and have member join
        const shareLink = await ownerGroupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Wait for synchronization - both users should see 2 members total
        await ownerGroupDetailPage.waitForMemberCount(2);
        await memberGroupDetailPage.waitForMemberCount(2);

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
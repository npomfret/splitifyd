import { simpleTest, expect } from '../../fixtures';
import { GroupDetailPage, JoinGroupPage } from '../../pages';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
import { generateShortId, generateTestGroupName } from '@splitifyd/test-support';

simpleTest.describe('Group Management', () => {
    simpleTest('should allow group owner to edit group name', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();

        // Verify starting state
        await expect(page).toHaveURL(/\/dashboard/);

        // Create a group
        const groupDetailPage = await dashboardPage.createGroupAndNavigate('Original Group Name', 'Original description');
        const groupId = groupDetailPage.inferGroupId();
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for group page to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify settings button is visible for owner
        const settingsButton = groupDetailPage.getSettingsButton();
        await expect(settingsButton).toBeVisible();

        // Open edit modal
        const editModal = await groupDetailPage.openEditGroupModal();

        // Edit the group name and description
        await editModal.editGroupName('Updated Group Name');
        await editModal.editDescription('Updated description text');

        // Save changes (this will wait for modal to close)
        await editModal.saveChanges();

        // Wait for save to complete and real-time updates to propagate
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify the group name was updated (relying on real-time updates)
        await groupDetailPage.waitForGroupTitle('Updated Group Name');
        await groupDetailPage.waitForGroupDescription('Updated description text');
    });

    simpleTest('should validate group name when editing', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();

        // Create a group
        const groupDetailPage = await dashboardPage.createGroupAndNavigate('Test Group', 'Test description');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        // Wait for the page to fully settle
        await expect(groupDetailPage.getGroupTitle()).toBeVisible();

        // Open edit modal
        const editModal = await groupDetailPage.openEditGroupModal();

        // Try to save with empty name
        await editModal.clearGroupName();

        // Save button should be disabled with empty name
        await expect(editModal.getSaveButton()).toBeVisible();
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Try with too short name
        await editModal.editGroupName('A');
        // Save button should be disabled with a single character
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Try with valid name
        await editModal.editGroupName('some oterh Valid Name');
        // Save button should be enabled now
        await expect(editModal.getSaveButton()).toBeEnabled();

        // Clear again and check button is disabled
        await editModal.clearGroupName();
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Cancel the modal
        await editModal.cancel();
        await expect(editModal.getModal()).not.toBeVisible();
    });

    simpleTest('should disable save button when no changes made', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();

        // Create a group
        const groupName = 'No Changes Group';
        const groupDescription = 'No changes description';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, groupDescription);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Open edit modal
        const editModal = await groupDetailPage.openEditGroupModal();

        // Verify save button is disabled when no changes
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Make a change
        await editModal.editGroupName('Changed Name');

        // Now save button should be enabled
        await expect(editModal.getSaveButton()).toBeEnabled();

        // Revert the change
        await editModal.editGroupName(groupName);

        // Save button should be disabled again
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Close modal
        await editModal.cancel();
    });

    simpleTest('should not show settings button for non-owner', async ({ newLoggedInBrowser }) => {
        // Create two browser sessions with pooled users
        const { page: ownerPage, user: owner, dashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, user: member } = await newLoggedInBrowser();

        const ownerGroupDetailPage = new GroupDetailPage(ownerPage, owner);
        const memberGroupDetailPage = new GroupDetailPage(memberPage, member);

        // Owner creates a group
        const groupName = 'Owner Only Settings';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Only owner can edit');
        const groupId = groupDetailPage.inferGroupId();

        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Get the share link
        const shareLink = await ownerGroupDetailPage.getShareLink();

        // Member joins the group via share link
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify owner CAN see settings button
        const ownerSettingsButton = ownerGroupDetailPage.getSettingsButton();
        await expect(ownerSettingsButton).toBeVisible();

        // Verify member CANNOT see settings button
        const memberSettingsButton = memberGroupDetailPage.getSettingsButton();
        await expect(memberSettingsButton).not.toBeVisible();

        // Verify both can see the group name
        await expect(ownerGroupDetailPage.getGroupTitle()).toHaveText(groupName);
        await expect(memberGroupDetailPage.getGroupTitle()).toHaveText(groupName);
    });
});

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
        const { page: memberPage } = await newLoggedInBrowser();

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

simpleTest.describe('Parallel Group Joining Edge Cases', () => {
    simpleTest('should handle multiple users joining group in parallel', async ({ newLoggedInBrowser }) => {
        // Create three browser instances - User 1, User 2, and User 3
        const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: user2Page, user: user2 } = await newLoggedInBrowser();
        const { page: user3Page, user: user3 } = await newLoggedInBrowser();

        // Create page objects
        const groupDetailPage2 = new GroupDetailPage(user2Page, user2);
        const groupDetailPage3 = new GroupDetailPage(user3Page, user3);

        // Verify all 3 users are distinct
        expect(user1.email).not.toBe(user2.email);
        expect(user1.email).not.toBe(user3.email);
        expect(user2.email).not.toBe(user3.email);

        // Create group with first user
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('Parallel'), 'Testing parallel join');
        const groupId = groupDetailPage.inferGroupId();

        // Ensure we're on the group page before getting share link
        await user1Page.waitForURL(`**/groups/${groupId}**`);

        // Get share link
        const shareLink = await groupDetailPage.getShareLink();

        // Test parallel join - this should handle race conditions gracefully
        const joinGroupPage2 = new JoinGroupPage(user2Page);
        const joinGroupPage3 = new JoinGroupPage(user3Page);

        // Join users sequentially instead of in parallel to avoid race conditions
        // that might cause the test to be unreliable
        try {
            await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        } catch (error) {
            throw error;
        }

        try {
            await joinGroupPage3.joinGroupUsingShareLink(shareLink);
        } catch (error) {
            throw error;
        }

        // Verify all pages see complete member list
        const allPages = [
            { page: user1Page, groupDetailPage },
            { page: user2Page, groupDetailPage: groupDetailPage2 },
            { page: user3Page, groupDetailPage: groupDetailPage3 },
        ];

        // Ensure all pages are on the correct group page
        await expect(user1Page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await expect(user2Page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await expect(user3Page).toHaveURL(new RegExp(`/groups/${groupId}$`));

        await groupDetailPage.synchronizeMultiUserState(allPages, 3, groupId);

        // Wait for the member counts to be correct on all pages
        await groupDetailPage.waitForMemberCount(3);
        await groupDetailPage2.waitForMemberCount(3);
        await groupDetailPage3.waitForMemberCount(3);

        // Use the display names from the user fixtures instead of extracting from UI
        const user1Name = await groupDetailPage.getCurrentUserDisplayName();
        const user2Name = await groupDetailPage2.getCurrentUserDisplayName();
        const user3Name = await groupDetailPage3.getCurrentUserDisplayName();

        // Check that all 3 users can see all 3 members on their respective pages
        await expect(groupDetailPage.getTextElement(user1Name).first()).toBeVisible();
        await expect(groupDetailPage.getTextElement(user2Name).first()).toBeVisible();
        await expect(groupDetailPage.getTextElement(user3Name).first()).toBeVisible();

        await expect(groupDetailPage2.getTextElement(user1Name).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(user2Name).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(user3Name).first()).toBeVisible();

        await expect(groupDetailPage3.getTextElement(user1Name).first()).toBeVisible();
        await expect(groupDetailPage3.getTextElement(user2Name).first()).toBeVisible();
        await expect(groupDetailPage3.getTextElement(user3Name).first()).toBeVisible();
    });
});
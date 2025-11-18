import { DashboardPage, ExpenseFormDataBuilder, ExpenseFormPage, generateShortId, GroupDetailPage, JoinGroupPage } from '@billsplit-wl/test-support';
import { Page } from '@playwright/test';
import { expect, simpleTest } from '../../fixtures';

async function navigateToDashboardFromGroup(groupDetailPage: GroupDetailPage): Promise<DashboardPage> {
    await groupDetailPage.header.navigateToDashboard();
    const dashboardPage = new DashboardPage(groupDetailPage.page);
    await dashboardPage.waitForDashboard();
    return dashboardPage;
}

/**
 * Consolidated Core Features E2E Tests
 *
 * CONSOLIDATION: Merged overlapping tests from:
 * - group-management.e2e.test.ts (member management, group settings, deletion)
 *
 * This file covers all core group and member management functionality:
 * - Member operations (adding, removing, leaving)
 * - Group settings and editing
 * - Balance restrictions for member operations
 * - Real-time updates across multiple users
 * - Group deletion scenarios
 */

simpleTest.describe('Member Management - Core Operations', () => {
    simpleTest('group owner should not see leave button and should see settings with member UI elements', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage }] = await createLoggedInBrowsers(1);

        // Create a group as owner
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup();

        // Verify Leave Group button is NOT visible for owner
        await groupDetailPage.verifyLeaveButtonNotVisible();

        // But Settings button should be visible
        await groupDetailPage.verifyEditButtonVisible();

        // UI Components validation: Member count and expense split options
        await groupDetailPage.verifyMemberCountElementVisible();

        const currentUserDisplayName = await dashboardPage.header.getCurrentUserDisplayName();

        // Test member visibility in expense split options
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );
        await expenseFormPage.verifySplitBetweenHeadingVisible();

        await expenseFormPage.verifySplitOptionsFirstCheckboxVisible();
        await expenseFormPage.verifySplitOptionsFirstCheckboxChecked();
        const isUserInSplit = await expenseFormPage.isUserInSplitOptions(currentUserDisplayName);
        expect(isUserInSplit).toBe(true);
    });

    simpleTest('non-owner member should be able to leave group', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, memberGroupDetailPage] = await user1DashboardPage.createMultiUserGroup(user2DashboardPage);

        // Verify member sees Leave Group button
        await groupDetailPage.waitForMemberCount(2); // sanity check
        await memberGroupDetailPage.verifyLeaveGroupButtonVisible();

        // Member clicks Leave Group
        const leaveModal = await memberGroupDetailPage.clickLeaveGroupButton();

        // Confirm in the dialog
        const memberDashboardPage = await leaveModal.confirmLeaveGroup((page: Page) => new DashboardPage(page));
        await expect(memberDashboardPage.page).toHaveURL(/\/dashboard/);

        // Owner should see updated member count (only 1 member now)
        await groupDetailPage.waitForMemberCount(1);

        // Verify the member who left is no longer in the list
        await groupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    simpleTest('group owner should be able to remove member', async ({ createLoggedInBrowsers }, testInfo) => {
        // Skip error checking - removed members will get expected 404s when trying to access group
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create two browser instances - Owner and Member
        const [{ dashboardPage: ownerDashboardPage }, { dashboardPage: memberDashboardPage }] = await createLoggedInBrowsers(2);

        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

        // Owner creates group
        const [groupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup(memberDashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Owner removes the member
        await groupDetailPage.waitForMemberCount(2);
        const removeMemberModal = await groupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Verify Member gets 404 (since they're viewing the group page)
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Owner should see updated member count (only 1 member: the owner)
        await groupDetailPage.waitForMemberCount(1);
        await groupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    simpleTest('should handle edge case of removing last non-owner member', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [{ page: ownerPage, dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup(user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();
        const groupName = await groupDetailPage.getGroupNameText();

        await navigateToDashboardFromGroup(groupDetailPage2); // move away from the page to avoid 404 errors in console after the removal happens

        // Owner removes the only other member
        const removeMemberModal = await groupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Owner should still be in the group
        await expect(ownerPage).toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId));

        // Group should show only 1 member (the owner)
        await groupDetailPage.waitForMemberCount(1);

        // Group title should still be visible
        await groupDetailPage.verifyGroupNameText(groupName);
    });
});

simpleTest.describe('Member Management - Balance Restrictions', () => {
    simpleTest('should prevent leaving/removing members with outstanding balance', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const ownerDisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Owner creates group
        const [groupDetailPage, memberGroupDetailPage] = await user1DashboardPage.createMultiUserGroup(user2DashboardPage);

        // Owner adds an expense that creates a balance
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );
        const expenseDescription = 'Test expense for balance';
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(100, 'JPY')
                .withPaidByDisplayName(ownerDisplayName)
                .withSplitType('equal')
                .withParticipants([ownerDisplayName, memberDisplayName])
                .build(),
        );

        // Wait for expense to be processed and balances to update
        await groupDetailPage.waitForExpense(expenseDescription);
        await groupDetailPage.verifyDebtRelationship(memberDisplayName, ownerDisplayName, '¥50');

        await memberGroupDetailPage.waitForExpense(expenseDescription);
        await memberGroupDetailPage.verifyDebtRelationship(memberDisplayName, ownerDisplayName, '¥50');

        // Member tries to leave group
        await memberGroupDetailPage.verifyLeaveGroupButtonVisible();
        const leaveModalWithBalance = await memberGroupDetailPage.clickLeaveGroupButton();

        // Should see error message about outstanding balance
        await leaveModalWithBalance.verifyLeaveErrorMessage();

        // Cancel the leave attempt
        await leaveModalWithBalance.cancelLeaveGroup();

        // Owner tries to remove member - button should be disabled
        await groupDetailPage.ensureMembersSectionExpanded();
        await groupDetailPage.verifyRemoveMemberButtonDisabled(memberDisplayName);
    });

    simpleTest('should allow leaving/removing after settlement clears balance', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [{ dashboardPage: user1DashboardPage }, { page: memberPage, dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const ownerDisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, memberGroupDetailPage] = await user1DashboardPage.createMultiUserGroup(user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Create expense that creates a balance
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription('Test expense for balance validation')
                .withAmount(60, 'JPY')
                .withPaidByDisplayName(ownerDisplayName)
                .withSplitType('equal')
                .withParticipants([ownerDisplayName, memberDisplayName])
                .build(),
        );

        // Wait for balances to update
        await groupDetailPage.waitForPage(groupId, 2);
        await memberGroupDetailPage.waitForPage(groupId, 2);

        // Member records a settlement to clear the balance
        const settlementFormPage = await memberGroupDetailPage.clickSettleUpButton(2);

        // Fill and submit settlement for the full owed amount (¥30 JPY in this case)
        await settlementFormPage.fillAndSubmitSettlement(ownerDisplayName, '30', 'JPY');

        // Wait for settlement to process and balances to update
        await groupDetailPage.verifyAllSettledUp(groupId);
        await memberGroupDetailPage.verifyAllSettledUp(groupId);

        // Now member should be able to leave
        const leaveModalAfterSettlement = await memberGroupDetailPage.clickLeaveGroupButton();
        await leaveModalAfterSettlement.confirmLeaveGroup();

        // Member should be redirected to dashboard
        await expect(memberPage).toHaveURL(/\/dashboard/);
    });
});

simpleTest.describe('Member Management - Real-time Updates', () => {
    simpleTest('should show member removal in real-time to all viewers', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create three users - Owner (removing), Member1 (being removed), Member2 (watching)
        const [{ dashboardPage: ownerDashboardPage }, { page: member1Page, dashboardPage: member1DashboardPage }, { dashboardPage: member2DashboardPage }] = await createLoggedInBrowsers(3);

        // Get display names
        const member1DisplayName = await member1DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, member1GroupDetailPage, member2GroupDetailPage] = await ownerDashboardPage.createMultiUserGroup(
            member1DashboardPage,
            member2DashboardPage,
        );

        // Owner removes Member1
        const removeMember1Modal = await groupDetailPage.clickRemoveMember(member1DisplayName);
        await removeMember1Modal.confirmRemoveMember();

        // CRITICAL TESTS:

        // 1. Member1 (being removed) should get 404 when accessing group
        await expect(async () => {
            const currentUrl = member1Page.url();
            if (currentUrl.includes('/404')) return;
            await member1Page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
            const newUrl = member1Page.url();
            if (newUrl.includes('/404')) return;
            throw new Error(`Expected 404 after removal, got: ${currentUrl}`);
        })
            .toPass({ timeout: 10000, intervals: [1000] });

        // 2. Member2 (watching group) should see member count decrease to 2 WITHOUT refresh
        await member2GroupDetailPage.waitForMemberCount(2);
        await member2GroupDetailPage.verifyMemberNotVisible(member1DisplayName);

        // 3. Owner should see updated member count
        await groupDetailPage.waitForMemberCount(2);
        await groupDetailPage.verifyMemberNotVisible(member1DisplayName);
    });

    simpleTest('should handle user leaving during expense operations', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Edge case testing may generate expected transient errors and 404s' });

        // Create three users - Creator, LeavingUser, WatchingUser
        const [{ dashboardPage: creatorDashboardPage }, { dashboardPage: leavingDashboardPage }, { dashboardPage: watchingDashboardPage }] = await createLoggedInBrowsers(3);

        const creatorDisplayName = await creatorDashboardPage.header.getCurrentUserDisplayName();
        const leavingDisplayName = await leavingDashboardPage.header.getCurrentUserDisplayName();

        // Setup group
        const [creatorGroupDetailPage, leavingGroupDetailPage, watchingGroupDetailPage] = await creatorDashboardPage.createMultiUserGroup(
            leavingDashboardPage,
            watchingDashboardPage,
        );
        const groupId = creatorGroupDetailPage.inferGroupId();

        // LeavingUser leaves
        const leaveModal = await leavingGroupDetailPage.clickLeaveGroupButton();
        await leaveModal.confirmLeaveGroup();

        // Wait for removal to propagate
        await creatorGroupDetailPage.waitForPage(groupId, 2);
        await watchingGroupDetailPage.waitForPage(groupId, 2);

        // Creator creates expense after user has left
        const expenseFormPage = await creatorGroupDetailPage.clickAddExpenseAndOpenForm(
            await creatorGroupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );
        const expenseDescription = `Edge Leave Test ${generateShortId()}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(60, 'JPY')
                .withPaidByDisplayName(creatorDisplayName)
                .withSplitType('equal')
                .withParticipants([creatorDisplayName])
                .build(),
        );

        // Verify expense appears for remaining users
        await creatorGroupDetailPage.waitForExpense(expenseDescription);
        await watchingGroupDetailPage.waitForExpense(expenseDescription);

        // Verify leaving user is on dashboard and removed from group
        await leavingDashboardPage.waitForDashboard();
        await creatorGroupDetailPage.verifyMemberNotVisible(leavingDisplayName);
        await watchingGroupDetailPage.verifyMemberNotVisible(leavingDisplayName);
    });
});

simpleTest.describe('Group Settings & Management', () => {
    simpleTest('should comprehensively test group editing validation and functionality', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

        // Verify starting state
        await expect(page).toHaveURL(/\/dashboard/);

        // Create a group
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup();
        const groupId = groupDetailPage.inferGroupId();
        await expect(page).toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId));

        // Wait for group page to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify settings button is visible for owner
        await groupDetailPage.verifyEditGroupButtonVisible();

        // === Test 1: Basic editing functionality ===
        let editModal = await groupDetailPage.clickEditGroupAndOpenModal();

        // Edit the group name and description
        await editModal.editGroupName('Updated Group Name');
        await editModal.editDescription('Updated description text');

        // Save changes (modal stays open until we close it)
        await editModal.saveChanges();
        await editModal.verifyGeneralSuccessAlertVisible();
        await editModal.clickClose();

        // Wait for save to complete and real-time updates to propagate
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify the group name was updated (relying on real-time updates)
        await groupDetailPage.waitForGroupTitle('Updated Group Name');
        await groupDetailPage.waitForGroupDescription('Updated description text');

        // === Test 2: Validation scenarios ===
        editModal = await groupDetailPage.clickEditGroupAndOpenModal();

        // Try to save with empty name
        await editModal.clearGroupName();
        await editModal.verifySaveButtonDisabled();

        // Try with too short name
        await editModal.editGroupName('A');
        await editModal.verifySaveButtonDisabled();

        // Try with valid name
        await editModal.editGroupName('Valid Name');
        await editModal.verifySaveButtonEnabled();

        // Clear again and check button is disabled
        await editModal.clearGroupName();
        await editModal.verifySaveButtonDisabled();

        // === Test 3: No changes detection ===
        // Reset to original values
        await editModal.editGroupName('Updated Group Name');
        await editModal.editDescription('Updated description text');

        // Save button should be disabled when no changes from current state
        await editModal.verifySaveButtonDisabled();

        // Make a change
        await editModal.editGroupName('Changed Name');
        await editModal.verifySaveButtonEnabled();

        // Revert the change
        await editModal.editGroupName('Updated Group Name');
        await editModal.verifySaveButtonDisabled();

        // Cancel the modal
        await editModal.cancel();
        await editModal.verifyModalNotVisible();
    });

    simpleTest('should show settings button based on permissions', async ({ createLoggedInBrowsers }) => {
        // Create two browser sessions with pooled users
        const [{ page: ownerPage, dashboardPage }, { page: memberPage, dashboardPage: memberDashboardPage }] = await createLoggedInBrowsers(2);

        // Owner creates a group with member
        // With default permissions (memberApproval: 'automatic'), members can approve new members
        // and therefore should see the Settings button to access the Security tab
        const [ownerGroupDetailPage, memberGroupDetailPage] = await dashboardPage.createMultiUserGroup(memberDashboardPage);
        const groupId = ownerGroupDetailPage.inferGroupId();
        const groupName = await ownerGroupDetailPage.getGroupNameText();

        await expect(ownerPage).toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId));
        await expect(memberPage).toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId));

        // Verify owner CAN see settings button
        await ownerGroupDetailPage.verifyEditGroupButtonVisible();

        // Verify member CAN ALSO see settings button (because memberApproval: 'automatic' gives them canApproveMembers)
        // This allows them to access the Security tab for approving pending members
        await memberGroupDetailPage.verifyEditGroupButtonVisible();

        // Verify both can see the group name
        await ownerGroupDetailPage.verifyGroupNameText(groupName);
        await memberGroupDetailPage.verifyGroupNameText(groupName);
    });

    simpleTest('admins can approve and reject pending members from the security settings modal', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: ownerDashboardPage },
            { dashboardPage: approverDashboardPage, user: approverUser },
            { dashboardPage: rejectDashboardPage, user: rejectUser },
        ] = await createLoggedInBrowsers(3);

        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate();
        const groupName = await ownerGroupDetailPage.getGroupNameText();
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Owner switches the group to the managed preset so that admin approval is required
        let settingsModal = await ownerGroupDetailPage.clickEditGroupAndOpenModal('security');
        await settingsModal.selectPreset('managed');
        await settingsModal.verifySecurityUnsavedBannerVisible();
        await settingsModal.saveSecuritySettings();
        await settingsModal.verifySecuritySuccessAlertVisible();
        await settingsModal.clickFooterClose();

        // Share the invite link with other members
        const shareModal = await ownerGroupDetailPage.clickShareGroupAndOpenModal();
        await shareModal.waitForShareLink();
        const shareLink = await shareModal.getShareLink();
        await shareModal.closeModal();

        // First additional user joins and waits for approval
        const approverJoinPage = new JoinGroupPage(approverDashboardPage.page);
        await approverJoinPage.navigateToShareLink(shareLink);
        await approverJoinPage.verifyJoinGroupHeadingVisible();
        await approverJoinPage.verifyJoinButtonEnabled();
        await approverJoinPage.clickJoinGroupButton();
        // Handle the display name modal
        await approverJoinPage.waitForDisplayNameModal();
        await approverJoinPage.submitDisplayNameModal();
        await approverJoinPage.verifyPendingApprovalAlertVisible(groupName);
        await approverJoinPage.verifyJoinButtonDisabled();

        // Owner reviews pending list and approves the user
        settingsModal = await ownerGroupDetailPage.clickEditGroupAndOpenModal('security');
        await settingsModal.waitForPendingMember(approverUser.uid);
        await settingsModal.approveMember(approverUser.uid); // This waits for button to disappear
        await settingsModal.verifyNoPendingRequestsMessageVisible();
        await settingsModal.clickFooterClose();

        // Approved user can now see the group on their dashboard
        await approverDashboardPage.navigate();
        await approverDashboardPage.waitForGroupToAppear(groupName);

        // Second additional user requests to join and gets rejected
        const rejectJoinPage = new JoinGroupPage(rejectDashboardPage.page);
        await rejectJoinPage.navigateToShareLink(shareLink);
        await rejectJoinPage.verifyJoinGroupHeadingVisible();
        await rejectJoinPage.verifyJoinButtonEnabled();
        await rejectJoinPage.clickJoinGroupButton();
        // Handle the display name modal
        await rejectJoinPage.waitForDisplayNameModal();
        await rejectJoinPage.submitDisplayNameModal();
        await rejectJoinPage.verifyPendingApprovalAlertVisible(groupName);
        await rejectJoinPage.verifyJoinButtonDisabled();

        settingsModal = await ownerGroupDetailPage.clickEditGroupAndOpenModal('security');
        await settingsModal.waitForPendingMember(rejectUser.uid);
        await settingsModal.rejectMember(rejectUser.uid); // This waits for button to disappear
        await settingsModal.verifyNoPendingRequestsMessageVisible();
        await settingsModal.clickFooterClose();

        // Rejected user can attempt to join again (no longer pending) and sees enabled join button
        await rejectJoinPage.navigateToShareLink(shareLink);
        await rejectJoinPage.verifyJoinButtonEnabled();

        // Owner confirms approved user is listed as admin and group remains accessible
        const refreshedSettingsModal = await ownerGroupDetailPage.clickEditGroupAndOpenModal('security');
        await refreshedSettingsModal.waitForSecurityTab();
        await refreshedSettingsModal.verifyPendingApproveButtonNotVisible(approverUser.uid);
        await refreshedSettingsModal.clickFooterClose();

        await approverDashboardPage.navigate();
        const approverGroupDetailPage = await approverDashboardPage.clickGroupCardAndNavigateToDetail(groupName);
        await approverGroupDetailPage.waitForPage(groupId, 2);
    });
});

simpleTest.describe('Group Deletion', () => {
    simpleTest('comprehensive group deletion scenarios with dashboard updates and member redirects', async ({ createLoggedInBrowsers }, testInfo) => {
        // Skip error checking - console errors may occur during redirect
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Console errors may occur during redirect when group is deleted while member viewing it' });

        // Create three browser instances to test different deletion scenarios
        let [{ dashboardPage: ownerDashboardPage }, { dashboardPage: memberDashboardPage1 }, { dashboardPage: memberDashboardPage2 }] = await createLoggedInBrowsers(3);

        // Scenario 1: Dashboard real-time updates when group is deleted
        let [ownerGroupDetailPage, member1GroupDetailPage] = await ownerDashboardPage.createMultiUserGroup(memberDashboardPage1);
        const groupName1 = await ownerGroupDetailPage.getGroupNameText();
        const groupId1 = ownerGroupDetailPage.inferGroupId();

        // Both users navigate to dashboard to see the group
        ownerDashboardPage = await navigateToDashboardFromGroup(ownerGroupDetailPage);
        memberDashboardPage1 = await navigateToDashboardFromGroup(member1GroupDetailPage);

        // Verify both users can see the group on dashboard
        await ownerDashboardPage.waitForGroupToAppear(groupName1);
        await memberDashboardPage1.waitForGroupToAppear(groupName1);

        // Owner clicks on the group from dashboard to navigate to it
        ownerGroupDetailPage = await ownerDashboardPage.clickGroupCardAndNavigateToDetail(groupName1);
        await ownerGroupDetailPage.waitForPage(groupId1, 2);

        // Delete the group
        const editModal1 = await ownerGroupDetailPage.clickEditGroupAndOpenModal();
        await editModal1.clickDeleteGroup();
        ownerDashboardPage = await editModal1.handleDeleteConfirmDialog(groupName1, (page: Page) => new DashboardPage(page));

        // CRITICAL TEST: Both dashboards should update in real-time WITHOUT reload
        await ownerDashboardPage.waitForGroupToDisappear(groupName1);
        await memberDashboardPage1.waitForGroupToDisappear(groupName1);

        // Scenario 2: Member redirect when group deleted while viewing
        let [ownerGroupDetailPage2, member2GroupDetailPage] = await ownerDashboardPage.createMultiUserGroup(memberDashboardPage2);
        const groupId2 = ownerGroupDetailPage2.inferGroupId();
        const groupName2 = await ownerGroupDetailPage2.getGroupNameText();

        // Owner navigates to dashboard to delete the group
        ownerDashboardPage = await navigateToDashboardFromGroup(ownerGroupDetailPage2);
        await ownerDashboardPage.waitForDashboard();
        await ownerDashboardPage.waitForGroupToAppear(groupName2);

        // Owner clicks on the group from dashboard to delete it
        ownerGroupDetailPage2 = await ownerDashboardPage.clickGroupCardAndNavigateToDetail(groupName2);
        await ownerGroupDetailPage2.waitForPage(groupId2, 2);

        // Owner deletes the group while member is still viewing it
        const editModal2 = await ownerGroupDetailPage2.clickEditGroupAndOpenModal();
        await editModal2.clickDeleteGroup();
        ownerDashboardPage = await editModal2.handleDeleteConfirmDialog(groupName2, (page) => new DashboardPage(page));

        // CRITICAL TEST: Member should be redirected away when group is deleted
        await member2GroupDetailPage.waitForRedirectAwayFromGroup(groupId2);
    });
});

simpleTest.describe('Group Comments - Real-time Communication', () => {
    simpleTest('should support real-time group-level comments between multiple users', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: aliceDashboardPage }, { dashboardPage: bobDashboardPage }] = await createLoggedInBrowsers(2);

        // Create a group with Alice as owner and Bob as member
        const [aliceGroupDetailPage, bobGroupDetailPage] = await aliceDashboardPage.createMultiUserGroup(bobDashboardPage);

        // Verify both users can see the comments section
        await aliceGroupDetailPage.verifyCommentsSection();
        await bobGroupDetailPage.verifyCommentsSection();

        // Alice adds the first comment
        const comment1 = `First comment from Alice - ${generateShortId()}`;
        await aliceGroupDetailPage.addComment(comment1);

        // Bob should see Alice's comment in real-time
        await bobGroupDetailPage.waitForCommentToAppear(comment1);

        // Bob adds a reply comment
        const comment2 = `Reply from Bob - ${generateShortId()}`;
        await bobGroupDetailPage.addComment(comment2);

        // Alice should see Bob's comment in real-time
        await aliceGroupDetailPage.waitForCommentToAppear(comment2);

        // Both users should now see 2 comments total
        await aliceGroupDetailPage.waitForCommentCount(2);
        await bobGroupDetailPage.waitForCommentCount(2);

        // Verify both comments are visible on both pages
        await aliceGroupDetailPage.verifyCommentVisible(comment1);
        await aliceGroupDetailPage.verifyCommentVisible(comment2);
        await bobGroupDetailPage.verifyCommentVisible(comment1);
        await bobGroupDetailPage.verifyCommentVisible(comment2);

        const aliceDashboard = await navigateToDashboardFromGroup(aliceGroupDetailPage);
        await aliceDashboard.verifyActivityFeedShows('commented on');
        await aliceDashboard.verifyActivityFeedShows(comment2);

        const bobDashboard = await navigateToDashboardFromGroup(bobGroupDetailPage);
        await bobDashboard.verifyActivityFeedShows('commented on');
        await bobDashboard.verifyActivityFeedShows(comment1);
    });
});

import { simpleTest, expect } from '../../fixtures';
import { JoinGroupPage } from '../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';

simpleTest.describe('Member Management - Owner Restrictions', () => {
    simpleTest('group owner should not see leave button and should see settings', async ({ newLoggedInBrowser }) => {
        const { page, user, dashboardPage } = await newLoggedInBrowser();

        // Create a group as owner
        const groupName = generateTestGroupName('Owner Test');
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Testing owner restrictions');

        // Wait for group to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);

        // Verify Leave Group button is NOT visible for owner
        await expect(groupDetailPage.getLeaveGroupButton()).not.toBeVisible();

        // But Settings button should be visible
        await expect(groupDetailPage.getSettingsButton()).toBeVisible();
    });
});

simpleTest.describe('Member Management - Multi-User Operations', () => {
    simpleTest('non-owner member should be able to leave group', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member
        const { page: ownerPage, dashboardPage: user1DashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: user2DashboardPage, user: member } = await newLoggedInBrowser();

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Leave Test');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing member leave functionality');
        const groupId = groupDetailPage.inferGroupId();

        // Get share link
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
        const shareLink = await groupDetailPage.getShareLink();

        // Member joins the group
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId)

        // Wait for both users to see each other in the member list
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Verify member sees Leave Group button
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();

        // Member clicks Leave Group
        const leaveModal = await memberGroupDetailPage.clickLeaveGroup();

        // Confirm in the dialog
        await leaveModal.confirmLeaveGroup();

        // Member should be redirected to dashboard
        await expect(memberPage).toHaveURL(/\/dashboard/);

        // Owner should see updated member count (only 1 member now)
        await groupDetailPage.waitForMemberCount(1);

        // Verify the member who left is no longer in the list
        await groupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    simpleTest('group owner should be able to remove multiple members', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - removed members will get expected 404s when trying to access group
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create three browser instances - Owner, Member1 (on group page), Member2 (on dashboard)
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: member1Page, dashboardPage: member1DashboardPage, user: member1 } = await newLoggedInBrowser();
        const { page: member2Page, dashboardPage: member2DashboardPage, user: member2 } = await newLoggedInBrowser();

        // Create page objects

        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const member1DisplayName = await member1DashboardPage.getCurrentUserDisplayName();
        const member2DisplayName = await member2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Multi Remove Test');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing multiple member removal scenarios');
        const groupId = groupDetailPage.inferGroupId();

        // Get share link
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
        const shareLink = await groupDetailPage.getShareLink();

        // Both members join the group
        const member1GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(member1Page, shareLink, groupId)
        const member2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(member2Page, shareLink, groupId)

        // Wait for all users to see each other (3 members total)
        await groupDetailPage.waitForMemberCount(3);
        await member1GroupDetailPage.waitForMemberCount(3);

        // Position users for different removal scenarios:
        // - Member1 stays on group page (will get 404 errors)
        // - Member2 goes to dashboard (will see group disappear from list)
        await member2GroupDetailPage.navigateToDashboard();
        await member2DashboardPage.waitForGroupToAppear(groupName);

        // Owner removes Member1 first (who is on the group page)
        const removeMember1Modal = await groupDetailPage.clickRemoveMember(member1DisplayName);
        await removeMember1Modal.confirmRemoveMember();

        // Verify Member1 gets 404 (since they're viewing the group page)
        await member1GroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Owner should see updated member count (2 members remaining: owner + member2)
        await groupDetailPage.waitForMemberCount(2);
        await groupDetailPage.verifyMemberNotVisible(member1DisplayName);

        // Now remove Member2 (who is on dashboard)
        const removeMember2Modal = await groupDetailPage.clickRemoveMember(member2DisplayName);
        await removeMember2Modal.confirmRemoveMember();

        // Verify Member2 can no longer access the group (should get 404)
        await member2Page.goto(`/groups/${groupId}`);
        await member2GroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Owner should see final member count (only 1 member: the owner)
        await groupDetailPage.waitForMemberCount(1);
        await groupDetailPage.verifyMemberNotVisible(member2DisplayName);

        // Verify group title is still visible for owner (group still exists)
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
    });

    simpleTest('should prevent leaving group with outstanding balance', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member
        const { page: ownerPage, dashboardPage: user1DashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: user2DashboardPage, user: member } = await newLoggedInBrowser();

        // Create page objects

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Balance Test');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing balance restrictions');
        const groupId = groupDetailPage.inferGroupId();

        // Get share link and have member join
        const shareLink = await groupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId)

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Owner adds an expense that creates a balance
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Test expense for balance',
            amount: 100,
            currency: 'USD',
            paidByDisplayName: ownerDisplayName,
            splitType: 'equal',
        });

        // Wait for expense to be processed and balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Member tries to leave group
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        const leaveModalWithBalance = await memberGroupDetailPage.clickLeaveGroup();

        // Should see error message about outstanding balance
        await leaveModalWithBalance.verifyLeaveErrorMessage();

        // Cancel the leave attempt
        await leaveModalWithBalance.cancelLeaveGroup();

        // Member records a settlement to clear the balance
        const settlementFormPage = await memberGroupDetailPage.clickSettleUpButton(2);

        // Fill and submit settlement for the full owed amount (50 in this case)
        await settlementFormPage.fillAndSubmitSettlement('50', ownerDisplayName);

        // Wait for settlement to process and balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Now member should be able to leave
        const leaveModalAfterSettlement = await memberGroupDetailPage.clickLeaveGroup();
        await leaveModalAfterSettlement.confirmLeaveGroup();

        // Member should be redirected to dashboard
        await expect(memberPage).toHaveURL(/\/dashboard/);
    });

    simpleTest('should prevent owner from removing member with outstanding balance', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member
        const { page: ownerPage, dashboardPage: user1DashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: user2DashboardPage, user: member } = await newLoggedInBrowser();

        // Create page objects

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Remove Balance');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing removal with balance');
        const groupId = groupDetailPage.inferGroupId();

        // Member joins
        const shareLink = await groupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId)

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Member adds expense creating a balance
        const expenseFormPage = await memberGroupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Member expense',
            amount: 60,
            currency: 'USD',
            paidByDisplayName: memberDisplayName,
            splitType: 'equal',
        });

        // Wait for balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Owner tries to remove member - button should be disabled
        const removeButton = groupDetailPage.getRemoveMemberButton(memberDisplayName);
        await expect(removeButton).toBeDisabled({ timeout: 5000 });
    });

    simpleTest('should handle edge case of removing last non-owner member', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member
        const { page: ownerPage, dashboardPage: user1DashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: user2DashboardPage, user: member } = await newLoggedInBrowser();

        // Create page objects

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Last Member');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing last member removal');
        const groupId = groupDetailPage.inferGroupId();

        // Member joins
        const shareLink = await groupDetailPage.getShareLink();
        const groupDetailPage2 = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId)

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await groupDetailPage2.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await groupDetailPage2.navigateToDashboard();// move away from the page to avoid 404 errors in console after the removal happens

        // Owner removes the only other member
        const removeMemberModal = await groupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Owner should still be in the group
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Group should show only 1 member (the owner)
        await groupDetailPage.waitForMemberCount(1);

        // Group title should still be visible
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
    });
});

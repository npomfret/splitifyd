import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';
import { GroupDetailPage, JoinGroupPage } from '../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';

test.describe('Leave Group E2E', () => {
    test('user should be able to leave group and no longer access it', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - 404 errors and console errors are expected when trying to access removed group
        testInfo.annotations.push({ type: 'skip-error-checking', description: '404 errors and console errors expected when accessing removed group' });

        // Create two browser instances - owner and member
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        let { page: memberPage, dashboardPage: memberDashboardPage, user: member } = await newLoggedInBrowser();

        // Verify users are distinct
        expect(owner.email).not.toBe(member.email);

        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();
        expect(ownerDisplayName).not.toBe(memberDisplayName);

        // =============================================================
        // SETUP PHASE: Create group and add member
        // =============================================================

        const groupName = generateTestGroupName('LeaveTest');
        // Owner creates group
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing leave group functionality');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Get share link for member to join
        const shareLink = await ownerGroupDetailPage.getShareLink();

        // Member joins the group
        let memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Verify both users can see the group
        await ownerGroupDetailPage.synchronizeMultiUserState(
            [
                { page: ownerPage, groupDetailPage: ownerGroupDetailPage },
                { page: memberPage, groupDetailPage: memberGroupDetailPage },
            ],
            2,
            groupId,
        );

        // Member navigates to dashboard to verify group is visible
        memberDashboardPage = await memberGroupDetailPage.navigateToDashboard();

        // Verify member can see the group on their dashboard
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // Member navigates back to the group
        memberGroupDetailPage = await memberDashboardPage.clickGroupCard(groupName, groupId);

        // Member leaves the group
        const leaveModal = await memberGroupDetailPage.clickLeaveGroup();
        memberDashboardPage = await leaveModal.confirmLeaveGroup();

        // Verify the group is no longer visible on member's dashboard
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);

        // Member tries to access the group URL directly - should get 404 and console errors (expected)
        await memberPage.goto(`/groups/${groupId}`);

        // Should be redirected to 404 or error page since they're no longer a member
        // Console errors are expected here as the app tries to load group data that no longer exists for this user
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId)); // sanity check
        // Wait for member count to update (should now be 1 - just the owner)
        await ownerGroupDetailPage.waitForMemberCount(1);

        // Owner should still be able to access the group
        await ownerGroupDetailPage.page.reload();
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
    });

    test('user with outstanding balance cannot leave group until settled', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - owner and member
        const { page: ownerPage, user: owner, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        let { page: memberPage, user: member, dashboardPage: memberDashboardPage } = await newLoggedInBrowser();

        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();

        // Create group and add member
        const groupName = generateTestGroupName('BalanceLeaveTest');
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing leave with balance');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Add member to group
        const shareLink = await ownerGroupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Create an expense where owner paid and member owes money (member should be blocked from leaving)
        const expenseFormPage = await ownerGroupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription('Test expense for balance validation')
                .withAmount(60)
                .withCurrency('USD')
                .withPaidByDisplayName(ownerDisplayName)
                .withSplitType('equal')
                .build(),
        );

        // Wait for balances to update
        await ownerGroupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Member tries to leave group but should be blocked due to outstanding balance
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        const leaveModal = await memberGroupDetailPage.clickLeaveGroup();

        // Expect leave to be blocked and modal to be cancelled
        await leaveModal.expectLeaveBlockedAndCancel();

        // Verify member is still in the group (leave was blocked)
        await ownerGroupDetailPage.page.reload();
        await ownerGroupDetailPage.waitForMemberCount(2);
    });

    test('member removed while on group page should get 404 on refresh', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - 404 errors and console errors are expected when member is removed
        testInfo.annotations.push({ type: 'skip-error-checking', description: '404 errors and console errors expected when member removed from group' });

        // Create owner and member browsers
        const { page: ownerPage, user: owner, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, user: member, dashboardPage: memberDashboardPage } = await newLoggedInBrowser();

        // Get display names for member removal
        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();

        // Create group and add member
        const groupName = generateTestGroupName('RemoveFromGroupPage');
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing member removal while on group page');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Member joins group
        const shareLink = await ownerGroupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Synchronize both users to ensure member is properly added
        await ownerGroupDetailPage.synchronizeMultiUserState(
            [
                { page: ownerPage, groupDetailPage: ownerGroupDetailPage },
                { page: memberPage, groupDetailPage: memberGroupDetailPage },
            ],
            2,
            groupId,
        );

        // Member stays on group page while owner removes them
        // Owner removes the member using the remove member feature
        const removeMemberModal = await ownerGroupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Member should automatically get redirected away from group (since they lost access)
        // Console errors are expected as the app tries to handle the removed access
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Owner should see member count updated to 1
        await ownerGroupDetailPage.waitForMemberCount(1);
        await ownerGroupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    test('member removed while on dashboard should see group disappear cleanly', async ({ newLoggedInBrowser }) => {
        // Create owner and member browsers
        const { page: ownerPage, user: owner, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        let { page: memberPage, dashboardPage: memberDashboardPage, user: member } = await newLoggedInBrowser();

        // Get display names for member removal
        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();

        // Create group and add member
        const groupName = generateTestGroupName('RemoveFromDashboard');
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing member removal while on dashboard');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Member joins group
        const shareLink = await ownerGroupDetailPage.getShareLink();
        let memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Synchronize both users to ensure member is properly added
        await ownerGroupDetailPage.synchronizeMultiUserState(
            [
                { page: ownerPage, groupDetailPage: ownerGroupDetailPage },
                { page: memberPage, groupDetailPage: memberGroupDetailPage },
            ],
            2,
            groupId,
        );

        // Member navigates to dashboard and verifies group is visible
        memberDashboardPage = await memberGroupDetailPage.navigateToDashboard();
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // Owner removes member using the remove member feature
        const removeMemberModal = await ownerGroupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Group should no longer be visible on member's dashboard - this should happen cleanly without errors
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);

        // Owner should see member count updated to 1
        await ownerGroupDetailPage.waitForMemberCount(1);
        await ownerGroupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });
});

import { ExpenseFormDataBuilder } from '../../../pages/expense-form.page';
import { simpleTest as test, expect } from '../../../fixtures/simple-test.fixture';
import { JoinGroupPage, GroupDetailPage } from '../../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

test.describe('Leave Group E2E', () => {
    test('user should be able to leave group and no longer access it', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - 404 errors and console errors are expected when trying to access removed group
        testInfo.annotations.push({ type: 'skip-error-checking', description: '404 errors and console errors expected when accessing removed group' });
        // Create two browser instances - owner and member
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: memberDashboardPage, user: member } = await newLoggedInBrowser();

        // Create page objects
        const memberGroupDetailPage = new GroupDetailPage(memberPage, member);

        // Verify users are distinct
        expect(owner.email).not.toBe(member.email);

        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();
        expect(ownerDisplayName).not.toBe(memberDisplayName);

        // =============================================================
        // SETUP PHASE: Create group and add member
        // =============================================================

        const groupName = generateTestGroupName('LeaveTest');
        const groupDescription = 'Testing leave group functionality';

        // Owner creates group
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, groupDescription);
        const groupId = groupDetailPage.inferGroupId();
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Get share link for member to join
        const shareLink = await groupDetailPage.getShareLink();

        // Member joins the group
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify both users can see the group
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page: ownerPage, groupDetailPage },
                { page: memberPage, groupDetailPage: memberGroupDetailPage },
            ],
            2,
            groupId,
        );

        // =============================================================
        // VERIFY INITIAL STATE: Group appears on member's dashboard
        // =============================================================

        // Member navigates to dashboard to verify group is visible
        await memberDashboardPage.navigate();
        await expect(memberPage).toHaveURL(/\/dashboard/);

        // Verify member can see the group on their dashboard
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // =============================================================
        // LEAVE GROUP ACTION: Member leaves the group
        // =============================================================

        // Member navigates back to the group
        await memberPage.goto(`/groups/${groupId}`);
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Member leaves the group
        await memberGroupDetailPage.leaveGroup();

        // Verify member gets redirected to dashboard after leaving
        await expect(memberPage).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // =============================================================
        // VERIFY DASHBOARD REMOVAL: Group no longer on dashboard
        // =============================================================

        // Verify the group is no longer visible on member's dashboard
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);

        // =============================================================
        // VERIFY ACCESS DENIED: Notification + refresh + 404 flow
        // =============================================================

        // Member tries to access the group URL directly - should get 404 and console errors (expected)
        await memberPage.goto(`/groups/${groupId}`);

        // Should be redirected to 404 or error page since they're no longer a member
        // Console errors are expected here as the app tries to load group data that no longer exists for this user
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // =============================================================
        // VERIFY OWNER STATE: Owner still has access and sees updated member count
        // =============================================================

        // Owner should still be able to access the group and see updated member count
        await ownerPage.goto(`/groups/${groupId}`);
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for member count to update (should now be 1 - just the owner)
        await groupDetailPage.waitForMemberCount(1);

        // Verify owner can still see group details
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
        await expect(groupDetailPage.getGroupDescription()).toHaveText(groupDescription);
    });

    test('user with outstanding balance cannot leave group until settled', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - owner and member
        const { page: ownerPage, user: owner, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, user: member } = await newLoggedInBrowser();

        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();

        // Create page objects
        const memberGroupDetailPage = new GroupDetailPage(memberPage, member);

        // Create group and add member
        const groupName = generateTestGroupName('BalanceLeaveTest');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing leave with balance');
        const groupId = groupDetailPage.inferGroupId();

        // Add member to group
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Create an expense where owner paid and member owes money (member should be blocked from leaving)
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription('Test expense for balance validation')
            .withAmount(60)
            .withCurrency('USD')
            .withPaidByDisplayName(ownerDisplayName)
            .withSplitType('equal')
            .build()
        );

        // Wait for balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Member tries to leave group but should be blocked due to outstanding balance
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        await memberGroupDetailPage.clickLeaveGroup();

        // todo: this is flawed - the app is working, it doesn't let you leave.  but instead of (or as well as) a console error, the user should be told why they cannot leave

        // Click confirm button - but leave action should fail due to validation
        await memberGroupDetailPage.confirmLeaveGroup();

        // User should stay on the group page (validation working)
        await expect(memberPage).toHaveURL(/\/groups\//, { timeout: 5000 });

        // Verify member is still in the group (leave was blocked)
        await ownerPage.goto(`/groups/${groupId}`);
        await groupDetailPage.waitForMemberCount(2);
    });

    test('member removed while on group page should get 404 on refresh', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - 404 errors and console errors are expected when member is removed
        testInfo.annotations.push({ type: 'skip-error-checking', description: '404 errors and console errors expected when member removed from group' });
        
        // Create owner and member browsers
        const { page: ownerPage, user: owner, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, user: member } = await newLoggedInBrowser();

        const ownerGroupDetailPage = new GroupDetailPage(ownerPage, owner);
        const memberGroupDetailPage = new GroupDetailPage(memberPage, member);

        // Create group and add member
        const groupName = generateTestGroupName('RemoveFromGroupPage');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing member removal while on group page');
        const groupId = groupDetailPage.inferGroupId();

        // Member joins group
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Synchronize both users to ensure member is properly added
        await ownerGroupDetailPage.synchronizeMultiUserState([
            { page: ownerPage, groupDetailPage: ownerGroupDetailPage },
            { page: memberPage, groupDetailPage: memberGroupDetailPage }
        ], 2, groupId);

        // Member stays on group page while owner removes them
        // (In real app, this would happen via owner clicking "Remove member" in settings)
        
        // TODO: For now, we'll simulate this by having the member leave and then try to access
        // In a real implementation, the owner would remove the member through group settings
        
        // Member stays on the group page, but we'll simulate removal by having them leave via API
        // and then trying to refresh/access the page
        await memberGroupDetailPage.leaveGroup(); // This simulates being removed
        
        // Member tries to refresh the page - should get 404 and console errors (expected)
        await memberPage.reload();
        
        // Should be redirected away from group or show error state
        // Console errors are expected as the app tries to reload group data that no longer exists
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);
        
        // Owner should see member count updated to 1
        await ownerPage.goto(`/groups/${groupId}`);
        await ownerGroupDetailPage.waitForMemberCount(1);
    });

    test('member removed while on dashboard should see group disappear cleanly', async ({ newLoggedInBrowser }) => {
        // Create owner and member browsers
        const { page: ownerPage, user: owner, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: memberDashboardPage, user: member } = await newLoggedInBrowser();

        const ownerGroupDetailPage = new GroupDetailPage(ownerPage, owner);
        const memberGroupDetailPage = new GroupDetailPage(memberPage, member);

        // Create group and add member
        const groupName = generateTestGroupName('RemoveFromDashboard');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing member removal while on dashboard');
        const groupId = groupDetailPage.inferGroupId();

        // Member joins group
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Member navigates to dashboard and verifies group is visible
        await memberDashboardPage.navigate();
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // Owner removes member (simulated by member leaving via API)
        // In real app, owner would do this through group settings UI
        await memberPage.goto(`/groups/${groupId}`);
        await memberGroupDetailPage.leaveGroup(); // Simulate removal

        // Member goes back to dashboard - group should disappear cleanly with no errors
        await memberDashboardPage.navigate();
        await memberDashboardPage.waitForDashboard(); // Ensure dashboard loads properly
        
        // Group should no longer be visible on dashboard - this should happen cleanly without errors
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);
        
        // No navigation errors or console errors should occur on dashboard
        // (unlike when trying to access group page directly)
        await expect(memberPage).toHaveURL(/\/dashboard/);
    });
});

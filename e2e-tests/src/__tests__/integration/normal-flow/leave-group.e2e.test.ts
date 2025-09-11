import { ExpenseFormDataBuilder } from '../../../pages/expense-form.page';
import { simpleTest as test, expect } from '../../../fixtures/simple-test.fixture';
import { GroupWorkflow } from '../../../workflows';
import { JoinGroupPage, GroupDetailPage } from '../../../pages';
import { generateTestGroupName } from '../../../../../packages/test-support/src/test-helpers.ts';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

test.describe('Leave Group E2E', () => {
    test('user should be able to leave group and no longer access it', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - owner and member
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: memberDashboardPage, user: member } = await newLoggedInBrowser();

        // Create page objects
        const groupDetailPage = new GroupDetailPage(ownerPage, owner);
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
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, groupDescription);
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
        // VERIFY ACCESS DENIED: Direct URL access should fail
        // =============================================================

        // Member tries to access the group URL directly
        await memberPage.goto(`/groups/${groupId}`);

        // Should be redirected to 404 or error page since they're no longer a member
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
        const { page: ownerPage, user: owner, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, user: member, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

        const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Create page objects
        const groupDetailPage = new GroupDetailPage(ownerPage, owner);
        const memberGroupDetailPage = new GroupDetailPage(memberPage, member);

        // Create group and add member
        const groupName = generateTestGroupName('BalanceLeaveTest');
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing leave with balance');

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
            .withPaidByDisplayName(user1DisplayName)
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
});

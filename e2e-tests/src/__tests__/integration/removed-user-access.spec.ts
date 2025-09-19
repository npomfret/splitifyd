import { expect, simpleTest } from '../../fixtures/simple-test.fixture';
import { generateShortId, generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page';
import { DashboardPage, JoinGroupPage, GroupDetailPage } from '../../pages';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';

simpleTest.describe('Multi-User Group Access', () => {
    simpleTest('multiple users can collaborate in shared group', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - User 1 and User 2
        const [
            { page: user1Page, dashboardPage: user1DashboardPage },
            { page: user2Page, user: user2, dashboardPage: user2DashboardPage },
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Verify both users start on dashboard
        await expect(user1Page).toHaveURL(/\/dashboard/);
        await expect(user2Page).toHaveURL(/\/dashboard/);

        // User 1 creates a group with user 2
        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({ }, user2DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        // Verify both users are visible in the group
        await expect(groupDetailPage1.getTextElement(user1DisplayName).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(user2DisplayName).first()).toBeVisible();

        // User 2 adds an expense using ExpenseBuilder pattern with unique identifier
        const expenseFormPage = await groupDetailPage2.clickAddExpenseButton(2);
        await expect(user2Page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        const expenseDescription = `Shared Expense ${generateShortId()}`;
        const sharedExpense = new ExpenseFormDataBuilder()
            .withDescription(expenseDescription)
            .withAmount(25.5)
            .withCurrency('USD')
            .withPaidByDisplayName(user2DisplayName)
            .withSplitType('equal')
            .withParticipants([user2DisplayName]) // 2-user group but only user2DisplayName captured
            .build();

        await expenseFormPage.submitExpense(sharedExpense);

        // Verify expense was created and we're back on group page
        await expect(user2Page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage2.getTextElement(expenseDescription).first()).toBeVisible();

        // Verify user 1 can also see the expense (wait for real-time sync)
        await groupDetailPage1.waitForBalancesToLoad(groupId);
        await expect(groupDetailPage1.getTextElement(expenseDescription).first()).toBeVisible();
    });

    simpleTest('should redirect removed user to dashboard when viewing group page', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member (to be removed)
        // Using only 2 users to avoid complications and focus on the core removal behavior
        const [
            { page: ownerPage, dashboardPage: ownerDashboardPage },
            { page: memberPage, dashboardPage: memberDashboardPage, user: memberUser }
        ] = await createLoggedInBrowsers(2);

        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

        // Create group with unique identifier
        const [createdGroupPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({ }, memberDashboardPage);
        const groupId = createdGroupPage.inferGroupId();

        // Owner removes the member while member is viewing the group page
        // Note: This should work with no expenses/balances in the group
        const removeMemberModal = await createdGroupPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // CRITICAL TEST 1: Member should be immediately redirected to dashboard
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);
        await expect(memberPage).toHaveURL(/\/dashboard/);

        // CRITICAL TEST 2: Owner should see member count decrease to 1
        await createdGroupPage.waitForMemberCount(1);
        await createdGroupPage.verifyMemberNotVisible(memberDisplayName);
    });

    simpleTest('should remove group from removed user dashboard in real-time', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member (to be removed)
        // Simplified to focus on core dashboard behavior without complications
        let [
            { page: ownerPage, dashboardPage: ownerDashboardPage },
            { page: memberPage, dashboardPage: memberDashboardPage }
        ] = await createLoggedInBrowsers(2);

        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

        // Create group with unique identifier
        const [ownerGroupDetailPage, memberGruopDetailPage] = await ownerDashboardPage.createMultiUserGroup({  }, memberDashboardPage);
        const groupName = await ownerGroupDetailPage.getGroupName();

        // Both users navigate to their dashboards to see the group
        ownerDashboardPage = await ownerGroupDetailPage.navigateToDashboard();
        memberDashboardPage = await memberGruopDetailPage.navigateToDashboard();

        // Verify both users can see the group on their dashboards
        await ownerDashboardPage.waitForGroupToAppear(groupName);
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // Owner goes back to group page to remove member
        const ownerGroupPage = await ownerDashboardPage.clickGroupCard(groupName);

        // Owner removes the member while member is on dashboard
        const removeMemberModal = await ownerGroupPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // CRITICAL TEST 1: Member's dashboard should no longer show the group (real-time update)
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);

        // CRITICAL TEST 2: Owner's dashboard should still show the group (they're still in it)
        const ownerDashboardFinal = await ownerGroupPage.navigateToDashboard();
        await ownerDashboardFinal.waitForGroupToAppear(groupName);
    });
});

import { expect, simpleTest } from '../../fixtures/simple-test.fixture';

import { MultiUserWorkflow } from '../../workflows';
import { generateShortId, generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
import { DashboardPage, JoinGroupPage, GroupDetailPage } from '../../pages';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';

simpleTest.describe('Multi-User Group Access', () => {
    simpleTest('multiple users can collaborate in shared group', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - User 1 and User 2
        const { page: user1Page, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
        const { page: user2Page, user: user2 } = await newLoggedInBrowser();

        // Create page objects
        const groupDetailPage2 = new GroupDetailPage(user2Page);

        // Verify both users start on dashboard
        await expect(user1Page).toHaveURL(/\/dashboard/);
        await expect(user2Page).toHaveURL(/\/dashboard/);

        // User 1 creates a group with unique identifier
        const uniqueId = generateShortId();
        const groupName = generateTestGroupName(`Collaboration-${uniqueId}`);
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Multi-user testing with removed access scenarios');
        const groupId = groupDetailPage.inferGroupId();
        await expect(user1Page).toHaveURL(groupDetailUrlPattern(groupId));

        // User 2 joins via share link using proper workflow
        const multiUserWorkflow = new MultiUserWorkflow();
        const shareLink = await multiUserWorkflow.getShareLink(user1Page);

        // Use JoinGroupPage directly instead of deprecated joinGroupViaShareLink
        const joinGroupPage = new JoinGroupPage(user2Page);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Verify user 2 is in the group
        await expect(user2Page).toHaveURL(groupDetailUrlPattern(groupId));
        await groupDetailPage2.waitForMemberCount(2);

        // Verify both users are visible in the group
        await expect(groupDetailPage2.getTextElement(await new DashboardPage(user1Page).header.getCurrentUserDisplayName()).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(await groupDetailPage2.header.getCurrentUserDisplayName()).first()).toBeVisible();

        // User 2 adds an expense using ExpenseBuilder pattern with unique identifier
        const expenseFormPage = await groupDetailPage2.clickAddExpenseButton(2);
        await expect(user2Page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        // Get the actual display name from the dashboard page
        const user2DashboardPage = new DashboardPage(user2Page, user2);
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const sharedExpense = new ExpenseFormDataBuilder()
            .withDescription(`Shared Expense ${uniqueId}`)
            .withAmount(25.5)
            .withCurrency('USD')
            .withPaidByDisplayName(user2DisplayName)
            .withSplitType('equal')
            .build();

        await expenseFormPage.submitExpense(sharedExpense);

        // Verify expense was created and we're back on group page
        await expect(user2Page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage2.getTextElement(`Shared Expense ${uniqueId}`).first()).toBeVisible();

        // Verify user 1 can also see the expense (wait for real-time sync)
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await expect(groupDetailPage.getTextElement(`Shared Expense ${uniqueId}`).first()).toBeVisible();
    });

    simpleTest('should redirect removed user to dashboard when viewing group page', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member (to be removed)
        // Using only 2 users to avoid complications and focus on the core removal behavior
        const { page: ownerPage, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, user: memberUser } = await newLoggedInBrowser();

        // Create page objects
        const memberGroupDetailPage = new GroupDetailPage(memberPage);
        const memberDashboardPage = new DashboardPage(memberPage, memberUser);

        // Create group with unique identifier
        const uniqueId = generateShortId();
        const groupName = generateTestGroupName(`UserRemoval-${uniqueId}`);
        const createdGroupPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing user removal from group page');
        const groupId = createdGroupPage.inferGroupId();

        // Add member to group
        const multiUserWorkflow = new MultiUserWorkflow();
        const shareLink = await multiUserWorkflow.getShareLink(ownerPage);

        // Member joins
        const memberJoinGroupPage = new JoinGroupPage(memberPage);
        await memberJoinGroupPage.joinGroupUsingShareLink(shareLink);
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for both users to see 2 members
        await createdGroupPage.waitForMemberCount(2);
        await memberGroupDetailPage.waitForMemberCount(2);

        // Get member display name for removal
        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

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

    simpleTest('should remove group from removed user dashboard in real-time', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member (to be removed)
        // Simplified to focus on core dashboard behavior without complications
        let { page: ownerPage, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, user: memberUser } = await newLoggedInBrowser();

        // Create group with unique identifier
        const uniqueId = generateShortId();
        const groupName = generateTestGroupName(`DashboardRemoval-${uniqueId}`);
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing user removal from dashboard perspective');

        // Add member to group
        const multiUserWorkflow = new MultiUserWorkflow();
        const shareLink = await multiUserWorkflow.getShareLink(ownerPage);

        // Member joins
        const memberGruopDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink);

        // Both users navigate to their dashboards to see the group
        ownerDashboardPage = await ownerGroupDetailPage.navigateToDashboard();
        const memberDashboardPage = await memberGruopDetailPage.navigateToDashboard();

        // Verify both users can see the group on their dashboards
        await ownerDashboardPage.waitForGroupToAppear(groupName);
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // Owner goes back to group page to remove member
        const ownerGroupPage = await ownerDashboardPage.clickGroupCard(groupName);
        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

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

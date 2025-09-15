import {expect, simpleTest} from '../../fixtures/simple-test.fixture';

import {MultiUserWorkflow} from '../../workflows';
import {generateShortId, generateTestGroupName} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page.ts';
import {DashboardPage, JoinGroupPage, GroupDetailPage} from '../../pages';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';

simpleTest.describe('Multi-User Group Access', () => {
    simpleTest('multiple users can collaborate in shared group', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - User 1 and User 2
        const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: user2Page, user: user2 } = await newLoggedInBrowser();

        // Create page objects
        const groupDetailPage2 = new GroupDetailPage(user2Page, user2);

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
        await expect(groupDetailPage2.getTextElement(await new DashboardPage(user1Page).getCurrentUserDisplayName()).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(await groupDetailPage2.getCurrentUserDisplayName()).first()).toBeVisible();

        // User 2 adds an expense using ExpenseBuilder pattern with unique identifier
        const expenseFormPage = await groupDetailPage2.clickAddExpenseButton(2);
        await expect(user2Page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        // Get the actual display name from the dashboard page
        const user2DashboardPage = new DashboardPage(user2Page, user2);
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();
        
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

    simpleTest('should handle user access correctly after group member removal', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Admin and Member
        const { page: adminPage, dashboardPage: adminDashboardPage, user: adminUser } = await newLoggedInBrowser();
        const { page: memberPage, user: memberUser } = await newLoggedInBrowser();

        // Create page objects
        const groupDetailPage = new GroupDetailPage(adminPage, adminUser);
        const memberGroupDetailPage = new GroupDetailPage(memberPage, memberUser);

        // Create group and add second user (similar setup)
        const uniqueId = generateShortId();
        const groupName = generateTestGroupName(`RemovalTest-${uniqueId}`);
        const adminGroupDetailPage = await adminDashboardPage.createGroupAndNavigate(groupName, 'Testing user removal scenarios');
        const groupId = adminGroupDetailPage.inferGroupId();

        // Get share link and have second user join
        const multiUserWorkflow = new MultiUserWorkflow();
        const shareLink = await multiUserWorkflow.getShareLink(adminPage);
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Verify both users are in group
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));
        await memberGroupDetailPage.waitForMemberCount(2);

        // Both users add expenses to create some activity
        const adminDisplayName = await adminDashboardPage.getCurrentUserDisplayName();
        
        const adminExpenseForm = await groupDetailPage.clickAddExpenseButton(2);
        await adminExpenseForm.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(`Admin Expense ${uniqueId}`)
            .withAmount(50.0)
            .withCurrency('USD')
            .withPaidByDisplayName(adminDisplayName)
            .withSplitType('equal')
            .build());

        await groupDetailPage.waitForBalancesToLoad(groupId);

        // Member adds expense
        const memberDashboardPage = new DashboardPage(memberPage, memberUser);
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();

        const memberExpenseForm = await memberGroupDetailPage.clickAddExpenseButton(2);
        await memberExpenseForm.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(`Member Expense ${uniqueId}`)
            .withAmount(30.0)
            .withCurrency('USD')
            .withPaidByDisplayName(memberDisplayName)
            .withSplitType('equal')
            .build());

        // Verify both expenses are visible to both users
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        await expect(groupDetailPage.getTextElement(`Admin Expense ${uniqueId}`).first()).toBeVisible();
        await expect(groupDetailPage.getTextElement(`Member Expense ${uniqueId}`).first()).toBeVisible();
        await expect(memberGroupDetailPage.getTextElement(`Admin Expense ${uniqueId}`).first()).toBeVisible();
        await expect(memberGroupDetailPage.getTextElement(`Member Expense ${uniqueId}`).first()).toBeVisible();

        // TODO: Implement user removal functionality
        // This would require admin controls to remove users from groups
        // For now, we verify the setup works correctly

        // Verify member can still access group (until removal is implemented)
        await memberPage.reload();
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(memberGroupDetailPage.getTextElement(`Admin Expense ${uniqueId}`).first()).toBeVisible();
    });
});

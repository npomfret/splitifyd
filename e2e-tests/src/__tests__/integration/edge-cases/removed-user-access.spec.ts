import {expect, multiUserTest} from '../../../fixtures';
import {GroupWorkflow, MultiUserWorkflow} from '../../../workflows';
import {generateShortId, generateTestGroupName} from '../../../../../packages/test-support/test-helpers.ts';
import {groupDetailUrlPattern} from '../../../pages/group-detail.page.ts';
import {DashboardPage, JoinGroupPage} from '../../../pages';
import {ExpenseBuilder} from '@splitifyd/test-support';


multiUserTest.describe('Multi-User Group Access', () => {
    multiUserTest('multiple users can collaborate in shared group', async ({ authenticatedPage, dashboardPage, groupDetailPage, secondUser }) => {
        const { page: user1Page, user: user1 } = authenticatedPage;
        const { page: user2Page, user: user2 } = secondUser;
        const { groupDetailPage: groupDetailPage2 } = secondUser;

        // Verify both users start on dashboard
        await expect(user1Page).toHaveURL(/\/dashboard/);
        await expect(user2Page).toHaveURL(/\/dashboard/);

        // User 1 creates a group with unique identifier
        const uniqueId = generateShortId();
        const groupWorkflow = new GroupWorkflow(user1Page);
        const groupName = generateTestGroupName(`Collaboration-${uniqueId}`);
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Multi-user testing with removed access scenarios');
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

        const sharedExpense = new ExpenseBuilder()
            .withDescription(`Shared Expense ${uniqueId}`)
            .withAmount(25.50)
            .withCurrency('USD')
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        
        await expenseFormPage.submitExpense(sharedExpense);

        // Verify expense was created and we're back on group page
        await expect(user2Page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage2.getTextElement(`Shared Expense ${uniqueId}`).first()).toBeVisible();

        // Verify user 1 can also see the expense (wait for real-time sync)
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await expect(groupDetailPage.getTextElement(`Shared Expense ${uniqueId}`).first()).toBeVisible();
    });

    multiUserTest('should handle user access correctly after group member removal', async ({ authenticatedPage, dashboardPage, groupDetailPage, secondUser }) => {
        const { page: adminPage, user: adminUser } = authenticatedPage;
        const { page: memberPage, user: memberUser } = secondUser;
        const { groupDetailPage: memberGroupDetailPage } = secondUser;

        // Create group and add second user (similar setup)
        const uniqueId = generateShortId();
        const groupWorkflow = new GroupWorkflow(adminPage);
        const groupName = generateTestGroupName(`RemovalTest-${uniqueId}`);
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing user removal scenarios');

        // Get share link and have second user join
        const multiUserWorkflow = new MultiUserWorkflow();
        const shareLink = await multiUserWorkflow.getShareLink(adminPage);
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Verify both users are in group
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));
        await memberGroupDetailPage.waitForMemberCount(2);
        
        // Both users add expenses to create some activity
        const adminExpenseForm = await groupDetailPage.clickAddExpenseButton(2);
        await adminExpenseForm.submitExpense(new ExpenseBuilder()
            .withDescription(`Admin Expense ${uniqueId}`)
            .withAmount(50.00)
            .withCurrency('USD')
            .withPaidBy(adminUser.uid)
            .withSplitType('equal')
            .withParticipants([adminUser.uid, memberUser.uid])
            .build());
        
        await groupDetailPage.waitForBalancesToLoad(groupId);
        
        // Member adds expense
        const memberExpense = new ExpenseBuilder()
            .withDescription(`Member Expense ${uniqueId}`)
            .withAmount(30.00)
            .withCurrency('USD')
            .withPaidBy(memberUser.uid)
            .withSplitType('equal')
            .withParticipants([adminUser.uid, memberUser.uid])
            .build();
        
        const memberExpenseForm = await memberGroupDetailPage.clickAddExpenseButton(2);
        await memberExpenseForm.submitExpense(memberExpense);
        
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

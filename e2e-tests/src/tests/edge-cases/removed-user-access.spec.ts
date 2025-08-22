import { multiUserTest, expect } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow, MultiUserWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

multiUserTest.describe('Multi-User Group Access', () => {
    multiUserTest('multiple users can collaborate in shared group', async ({ authenticatedPage, dashboardPage, groupDetailPage, secondUser }) => {
        const { page: user1Page, user: user1 } = authenticatedPage;
        const { page: user2Page, user: user2 } = secondUser;
        const { groupDetailPage: groupDetailPage2 } = secondUser;

        // Verify both users start on dashboard
        await expect(user1Page).toHaveURL(/\/dashboard/);
        await expect(user2Page).toHaveURL(/\/dashboard/);

        // User 1 creates a group
        const groupWorkflow = new GroupWorkflow(user1Page);
        const groupName = generateTestGroupName('Collaboration');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Multi-user testing');
        await expect(user1Page).toHaveURL(`/groups/${groupId}`);

        // User 2 joins via share link using proper workflow
        const multiUserWorkflow = new MultiUserWorkflow();
        const shareLink = await multiUserWorkflow.getShareLink(user1Page);
        
        // Use JoinGroupPage directly instead of deprecated joinGroupViaShareLink
        const { JoinGroupPage } = await import('../../pages');
        const joinGroupPage = new JoinGroupPage(user2Page);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Verify user 2 is in the group
        await expect(user2Page).toHaveURL(`/groups/${groupId}`);
        await groupDetailPage2.waitForMemberCount(2);

        // Verify both users are visible in the group
        await expect(groupDetailPage2.getTextElement(user1.displayName).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(user2.displayName).first()).toBeVisible();

        // User 2 adds an expense using new ExpenseFormPage pattern
        const expenseFormPage = await groupDetailPage2.clickAddExpenseButton(2);
        await user2Page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        await expenseFormPage.fillDescription('Shared Expense');
        await expenseFormPage.fillAmount('25.50');
        await expenseFormPage.selectAllParticipants();

        // Submit the expense (handles button visibility, enable check and spinner wait)
        await expenseFormPage.clickSaveExpenseButton();

        // Verify expense was created and we're back on group page
        await expect(user2Page).toHaveURL(`/groups/${groupId}`);
        await expect(groupDetailPage2.getTextElement('Shared Expense').first()).toBeVisible();

        // Verify user 1 can also see the expense (wait for real-time sync)
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await expect(groupDetailPage.getTextElement('Shared Expense').first()).toBeVisible();
    });
});

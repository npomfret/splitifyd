import { multiUserTest, expect } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow, MultiUserWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

multiUserTest.describe('Multi-User Group Access', () => {
  multiUserTest('multiple users can collaborate in shared group', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage,
    secondUser
  }) => {
    const { page: user1Page, user: user1 } = authenticatedPage;
    const { page: user2Page, user: user2 } = secondUser;
    const { 
      groupDetailPage: groupDetailPage2
    } = secondUser;

    // Verify both users start on dashboard
    await expect(user1Page).toHaveURL(/\/dashboard/);
    await expect(user2Page).toHaveURL(/\/dashboard/);

    // User 1 creates a group
    const groupWorkflow = new GroupWorkflow(user1Page);
    const groupName = generateTestGroupName('Collaboration');
    const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Multi-user testing');
    await expect(user1Page).toHaveURL(`/groups/${groupId}`);
    
    // User 2 joins via share link using proper workflow
    const multiUserWorkflow = new MultiUserWorkflow(null);
    const shareLink = await multiUserWorkflow.getShareLink(user1Page);
    await multiUserWorkflow.joinGroupViaShareLink(user2Page, shareLink, user2);
    
    // Verify user 2 is in the group
    await expect(user2Page).toHaveURL(`/groups/${groupId}`);
    await groupDetailPage2.waitForMemberCount(2);
    
    // Verify both users are visible in the group
    await expect(groupDetailPage2.getTextElement(user1.displayName).first()).toBeVisible();
    await expect(groupDetailPage2.getTextElement(user2.displayName).first()).toBeVisible();

    // User 2 adds an expense using existing page object methods
    await groupDetailPage2.clickAddExpenseButton();
    await user2Page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    const descriptionField = groupDetailPage2.getExpenseDescriptionField();
    const amountField = groupDetailPage2.getExpenseAmountField();
    
    await groupDetailPage2.fillPreactInput(descriptionField, 'Shared Expense');
    await groupDetailPage2.fillPreactInput(amountField, '25.50');
    
    const submitButton = groupDetailPage2.getSaveExpenseButton();
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    // Verify expense was created and we're back on group page
    await expect(user2Page).toHaveURL(`/groups/${groupId}`);
    await expect(groupDetailPage2.getTextElement('Shared Expense').first()).toBeVisible();
    
    // Verify user 1 can also see the expense (after refresh)
    await user1Page.reload();
    await expect(groupDetailPage.getTextElement('Shared Expense').first()).toBeVisible();
  });
});
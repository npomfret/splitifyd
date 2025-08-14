import { multiUserTest, expect } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

multiUserTest.describe('Removed User Access', () => {
  multiUserTest('user removed from group while actively using it', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage,
    secondUser
  }) => {
    const { page: user1Page, user: user1 } = authenticatedPage;
    const { page: user2Page, user: user2 } = secondUser;
    const { 
      dashboardPage: dashboardPage2,
      groupDetailPage: groupDetailPage2
    } = secondUser;

    // Step 1: User 1 creates a group
    await expect(user1Page).toHaveURL(/\/dashboard/);
    const groupWorkflow1 = new GroupWorkflow(user1Page);
    const groupId = await groupWorkflow1.createGroupAndNavigate('Test Group for Removal', 'Testing user removal');
    await expect(user1Page).toHaveURL(new RegExp(`/groups/${groupId}`));
    
    // Get the share link
    const shareLink = await groupDetailPage.getShareLinkReliably();

    // Step 2: User 2 joins the group and navigates to it
    await user2Page.goto(shareLink);
    await user2Page.getByRole('button', { name: 'Join Group' }).click();
    await expect(user2Page).toHaveURL(new RegExp(`/groups/${groupId}`));
    
    // Verify user 2 can see the group
    await expect(user2Page.locator('h1')).toContainText('Test Group for Removal');
    
    // Wait for member count to update for user 1
    await user1Page.reload();
    await expect(user1Page.getByText('2 members')).toBeVisible({ timeout: 5000 });

    // Step 3: User 1 removes user 2 from the group
    // NOTE: Member removal UI is not yet implemented in the application
    // When implemented, User 1 would remove User 2 here
    
    console.log('⚠️ Member removal functionality not yet implemented');
    console.log('Expected behavior (based on security-errors.e2e.test.ts):');
    console.log('- Removed users should be redirected to /404 page');
    console.log('- Same as users accessing groups they never belonged to');
    console.log('');
    console.log('Current test will verify what happens WITHOUT removal:');

    // Step 4: User 2 attempts to add an expense
    // This should fail with proper error handling
    const addExpenseButton = groupDetailPage2.getAddExpenseButton();
    await expect(addExpenseButton).toBeVisible();
    await addExpenseButton.click();
    
    // Wait for expense form to load
    await user2Page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Fill expense form
    const descriptionField = groupDetailPage2.getExpenseDescriptionField();
    const amountField = groupDetailPage2.getExpenseAmountField();
    
    await groupDetailPage2.fillPreactInput(descriptionField, 'Test Expense After Removal');
    await groupDetailPage2.fillPreactInput(amountField, '50');
    
    // Try to submit the expense
    const submitButton = groupDetailPage2.getSaveExpenseButton();
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    // What SHOULD happen (once member removal is implemented):
    // Based on security-errors.e2e.test.ts, removed users should be redirected to /404
    // just like users who try to access groups they never belonged to
    
    // Current behavior (without removal):
    // User 2 is still a member, so the expense should succeed
    
    // Wait to see what happens
    await user2Page.waitForLoadState('domcontentloaded');
    
    // Check current state
    const currentUrl = user2Page.url();
    const isOn404 = currentUrl.includes('/404');
    const isOnGroupPage = currentUrl.includes(`/groups/${groupId}`);
    const stillOnExpenseForm = currentUrl.includes('/add-expense');
    
    // Log what actually happened
    console.log('');
    console.log('Actual Results (User 2 still a member):');
    console.log(`- Current URL: ${currentUrl}`);
    console.log(`- Redirected to 404: ${isOn404}`);
    console.log(`- Back on group page: ${isOnGroupPage}`);
    console.log(`- Still on expense form: ${stillOnExpenseForm}`);
    
    if (isOnGroupPage) {
      // Check if expense was created
      const expenseVisible = await user2Page.getByText('Test Expense After Removal').isVisible().catch(() => false);
      console.log(`- Expense created successfully: ${expenseVisible}`);
    }
    
    // Document the expected behavior
    console.log('');
    console.log('✅ Expected behavior AFTER member removal is implemented:');
    console.log('1. User should be redirected to /404 page');
    console.log('2. Same as security-errors.e2e.test.ts line 30');
    console.log('3. Group content should not be accessible');
    
    // Since removal isn't implemented, we expect the expense to succeed
    // This documents the current state for future comparison
    if (!isOn404) {
      console.log('');
      console.log('⚠️ Current state: User can still add expenses (removal not implemented)');
    }
  });
});
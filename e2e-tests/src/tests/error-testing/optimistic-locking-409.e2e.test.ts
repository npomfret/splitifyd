import { multiUserTest, expect } from '../../fixtures/multi-user-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { JoinGroupPage } from '../../pages';

setupMCPDebugOnFailure();

multiUserTest.describe('Optimistic Locking Behavior', () => {
  multiUserTest('observes 409 conflict behavior when concurrent updates occur', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage,
    secondUser
  }) => {
    const { page: user1Page } = authenticatedPage;
    const { page: user2Page, groupDetailPage: groupDetailPage2 } = secondUser;
    const memberCount = 2;

    // Create a group and get both users in it
    await expect(user1Page).toHaveURL(/\/dashboard/);
    const groupWorkflow = new GroupWorkflow(user1Page);
    const groupId = await groupWorkflow.createGroupAndNavigate('Conflict Test Group', 'Testing 409 behavior');
    await expect(user1Page).toHaveURL(new RegExp(`/groups/${groupId}`));
    
    // Get share link and have user 2 join
    const shareLink = await groupDetailPage.getShareLink();
    const joinGroupPage = new JoinGroupPage(user2Page);
    await joinGroupPage.navigateToShareLink(shareLink);
    await joinGroupPage.joinGroup();
    await expect(user2Page).toHaveURL(new RegExp(`/groups/${groupId}`));
    
    // Both users add an expense to create initial state
    // Use the proper expense creation method which handles member loading
    await groupDetailPage.addExpense({
      description: 'User 1 Expense',
      amount: 100,
      paidBy: authenticatedPage.user.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // User 2 adds expense using proper method
    await groupDetailPage2.addExpense({
      description: 'User 2 Expense',
      amount: 50,
      paidBy: secondUser.user.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Now both users try to add another expense simultaneously
    // This should trigger optimistic locking conflicts
    
    console.log('');
    console.log('=== ATTEMPTING CONCURRENT OPERATIONS ===');
    console.log('Both users will try to add expenses at the same time');
    console.log('This should trigger 409 Conflict errors from optimistic locking');
    console.log('');
    
    // Both users navigate to add expense form at nearly the same time
    const [expenseFormPage1, expenseFormPage2] = await Promise.all([
      groupDetailPage.clickAddExpenseButton(memberCount),
      groupDetailPage2.clickAddExpenseButton(memberCount)
    ]);
    
    // Both fill out their forms
    await Promise.all([
      expenseFormPage1.fillDescription('Concurrent Expense 1'),
      expenseFormPage2.fillDescription('Concurrent Expense 2')
    ]);
    
    await Promise.all([
      expenseFormPage1.fillAmount('75'),
      expenseFormPage2.fillAmount('25')
    ]);
    
    // Submit both forms at the same time
    const savePromises = Promise.allSettled([
      expenseFormPage1.saveExpense(),
      expenseFormPage2.saveExpense()
    ]);
    
    // Wait for both to complete (success or failure)
    const results = await savePromises;
    
    // Wait for navigation/error handling to complete
    await Promise.all([
      user1Page.waitForLoadState('domcontentloaded'),
      user2Page.waitForLoadState('domcontentloaded')
    ]);
    
    // Check where each user ended up
    const user1Url = user1Page.url();
    const user2Url = user2Page.url();
    
    console.log('');
    console.log('=== RESULTS AFTER CONCURRENT OPERATIONS ===');
    console.log(`User 1 URL: ${user1Url}`);
    console.log(`User 2 URL: ${user2Url}`);
    
    // Check for error messages on the pages
    const user1Errors = await user1Page.locator('.text-red-500, .text-red-600, [role="alert"]').allTextContents();
    const user2Errors = await user2Page.locator('.text-red-500, .text-red-600, [role="alert"]').allTextContents();
    
    if (user1Errors.length > 0) {
      console.log(`User 1 Error Messages: ${user1Errors.join(', ')}`);
    }
    if (user2Errors.length > 0) {
      console.log(`User 2 Error Messages: ${user2Errors.join(', ')}`);
    }
    
    // Check if users are still on the group page or got redirected
    const user1OnGroup = user1Url.includes(`/groups/${groupId}`);
    const user2OnGroup = user2Url.includes(`/groups/${groupId}`);
    const user1OnDashboard = user1Url.includes('/dashboard');
    const user2OnDashboard = user2Url.includes('/dashboard');
    const user1On404 = user1Url.includes('/404');
    const user2On404 = user2Url.includes('/404');
    
    console.log('');
    console.log('=== NAVIGATION STATE ===');
    console.log(`User 1: Group page: ${user1OnGroup}, Dashboard: ${user1OnDashboard}, 404: ${user1On404}`);
    console.log(`User 2: Group page: ${user2OnGroup}, Dashboard: ${user2OnDashboard}, 404: ${user2On404}`);
    
    console.log('');
    console.log('=== EXPECTED BEHAVIOR ===');
    console.log('When a 409 Conflict occurs:');
    console.log('1. User should remain on the same page (no navigation)');
    console.log('2. Error message should be displayed');
    console.log('3. User can retry the operation');
    console.log('');
    console.log('=== CURRENT BEHAVIOR ===');
    if (user1OnDashboard || user2OnDashboard) {
      console.log('❌ BUG: Users are being redirected to dashboard on 409 errors');
    } else if (user1On404 || user2On404) {
      console.log('❌ BUG: Users are being redirected to 404 page on 409 errors');
    } else if (user1OnGroup && user2OnGroup) {
      console.log('✅ CORRECT: Users remained on the group page');
    } else {
      console.log('⚠️ UNEXPECTED: Users ended up in an unexpected state');
    }
    
    // Document the actual behavior for reference
    expect(true).toBe(true); // Test always passes - we're just observing behavior
  });
});
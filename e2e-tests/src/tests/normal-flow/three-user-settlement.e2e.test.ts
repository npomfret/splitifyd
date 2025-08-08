import { threeUserTest as test, expect } from '../../fixtures/three-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

// Increase timeout for this complex multi-user test
test.setTimeout(30000);

test.describe('Three User Settlement Management', () => {
  test('should handle partial settlement with 3 users correctly', async ({ 
    authenticatedPage, 
    groupDetailPage, 
    secondUser, 
    thirdUser 
  }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const { page: page3, user: user3 } = thirdUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    
    // Verify all 3 users are distinct to prevent flaky test failures
    
    // Assert all users have different emails
    expect(user1.email).not.toBe(user2.email);
    expect(user1.email).not.toBe(user3.email);
    expect(user2.email).not.toBe(user3.email);
    
    // Assert all users have different display names
    expect(user1.displayName).not.toBe(user2.displayName);
    expect(user1.displayName).not.toBe(user3.displayName);
    expect(user2.displayName).not.toBe(user3.displayName);
    
    // Verify correct users are shown in UI (top-right corner)
    await expect(groupDetailPage.getUserDisplayButton(user1.displayName)).toBeVisible();
    await expect(secondUser.groupDetailPage.getUserDisplayButton(user2.displayName)).toBeVisible();
    await expect(thirdUser.groupDetailPage.getUserDisplayButton(user3.displayName)).toBeVisible();
    
    
    // 1. Create a group with 3 users
    await groupWorkflow.createGroup(generateTestGroupName('3UserSettle'), 'Testing 3-user settlement');

    // Get share link and have users join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    // Second user joins
    const groupDetailPage2 = secondUser.groupDetailPage;
    await page2.goto(shareLink);
    await expect(groupDetailPage2.getJoinGroupHeading()).toBeVisible();
    await groupDetailPage2.getJoinGroupButton().click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Synchronize to see the second member
    await groupDetailPage.synchronizeMultiUserState([
      { page, groupDetailPage }
    ], 2);
    
    // Third user joins
    const groupDetailPage3 = thirdUser.groupDetailPage;
    await page3.goto(shareLink);
    await expect(groupDetailPage3.getJoinGroupHeading()).toBeVisible();
    await groupDetailPage3.getJoinGroupButton().click();
    await page3.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Synchronize all pages to see all 3 members
    await groupDetailPage.synchronizeMultiUserState([
      { page, groupDetailPage },
      { page: page2, groupDetailPage: groupDetailPage2 },
      { page: page3, groupDetailPage: groupDetailPage3 }
    ], 3);
    
    
    // 2. User 1 makes a expense for 120, split equally
    const allPages = [
      { page, groupDetailPage },
      { page: page2, groupDetailPage: groupDetailPage2 },
      { page: page3, groupDetailPage: groupDetailPage3 }
    ];
    
    await groupDetailPage.addExpenseAndSync({
      description: 'Group dinner expense',
      amount: 120,
      paidBy: user1.displayName,
      splitType: 'equal'
    }, allPages);
    
    // Verify expense appears across all pages
    await groupDetailPage.verifyExpenseAcrossPages(allPages, 'Group dinner expense', '$120.00');
    
    
    // 3. Assert initial balances: user1 owed 80, user2 & user3 each owe 40
    // Math: $120 / 3 = $40 per person
    // User1 paid $120, owes $40 → Net: owed $80
    // User2 paid $0, owes $40 → Net: owes $40
    // User3 paid $0, owes $40 → Net: owes $40
    
    // Verify both debts exist across all pages
    await groupDetailPage.verifyDebtAcrossPages(allPages, user2.displayName, user1.displayName, '$40.00');
    await groupDetailPage.verifyDebtAcrossPages(allPages, user3.displayName, user1.displayName, '$40.00');
    
    
    // 4. User 2 makes partial settlement of 30
    
    await groupDetailPage.recordSettlementAndSync({
      payerName: user2.displayName,
      payeeName: user1.displayName,
      amount: '30',
      note: 'Partial payment from user2'
    }, allPages);
    
    // Verify settlement appears in history across all pages
    await groupDetailPage.verifySettlementInHistory(allPages, 'Partial payment from user2');
    
    
    // 5. Assert updated balances after $30 payment
    // User2 debt: $40 - $30 = $10
    // User3 debt: $40 (unchanged)
    // User1 owed: $80 - $30 = $50
    
    // Verify updated debts across all pages
    await groupDetailPage.verifyDebtAcrossPages(allPages, user2.displayName, user1.displayName, '$10.00');
    await groupDetailPage.verifyDebtAcrossPages(allPages, user3.displayName, user1.displayName, '$40.00');
    
    
    // 6. User 2 makes final settlement of remaining $10
    
    await groupDetailPage.recordSettlementAndSync({
      payerName: user2.displayName,
      payeeName: user1.displayName,
      amount: '10',
      note: 'Final payment from user2 - all settled!'
    }, allPages);
    
    // 7. Assert final state: User2 is settled up, User3 still owes $40
    
    // User2 should no longer appear in debt list (settled up)
    const balancesSection1 = groupDetailPage.getBalancesSection();
    
    await expect(groupDetailPage.getDebtInfo(user2.displayName, user1.displayName)).not.toBeVisible();
    
    // User3 should still owe $40
    await groupDetailPage.verifyDebtAcrossPages(allPages, user3.displayName, user1.displayName, '$40.00');
    
    // Verify both settlements appear in history
    await groupDetailPage.openHistory();
    await expect(groupDetailPage.getTextElement(/Partial payment from user2/i)).toBeVisible();
    await expect(groupDetailPage.getTextElement(/Final payment from user2 - all settled!/i)).toBeVisible();
    
  });
});
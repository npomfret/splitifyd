import { threeUserTest as test, expect } from '../../fixtures/three-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { GroupWorkflow } from '../../workflows/index';
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
    
    console.log('🧪 Starting 3-user partial settlement test');
    
    // Verify all 3 users are distinct to prevent flaky test failures
    console.log(`🔍 Verifying user distinctness:`);
    console.log(`User 1: ${user1.email} (${user1.displayName})`);
    console.log(`User 2: ${user2.email} (${user2.displayName})`);
    console.log(`User 3: ${user3.email} (${user3.displayName})`);
    
    // Assert all users have different emails
    expect(user1.email).not.toBe(user2.email);
    expect(user1.email).not.toBe(user3.email);
    expect(user2.email).not.toBe(user3.email);
    
    // Assert all users have different display names
    expect(user1.displayName).not.toBe(user2.displayName);
    expect(user1.displayName).not.toBe(user3.displayName);
    expect(user2.displayName).not.toBe(user3.displayName);
    
    // Verify correct users are shown in UI (top-right corner)
    await expect(page.getByRole('button', { name: user1.displayName })).toBeVisible();
    await expect(page2.getByRole('button', { name: user2.displayName })).toBeVisible();
    await expect(page3.getByRole('button', { name: user3.displayName })).toBeVisible();
    
    console.log('✅ All 3 users are distinct - proceeding with test');
    
    // 1. Create a group with 3 users
    await groupWorkflow.createGroup(generateTestGroupName('3UserSettle'), 'Testing 3-user settlement');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
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
    
    // Refresh first user's page to see the second member
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForMemberCount(2);
    
    // Third user joins
    const groupDetailPage3 = thirdUser.groupDetailPage;
    await page3.goto(shareLink);
    await expect(groupDetailPage3.getJoinGroupHeading()).toBeVisible();
    await groupDetailPage3.getJoinGroupButton().click();
    await page3.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Refresh all pages to see all 3 members
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await page3.reload();
    await page3.waitForLoadState('networkidle');
    
    // Wait for synchronization - all 3 users should see each other
    await groupDetailPage.waitForMemberCount(3);
    await groupDetailPage2.waitForMemberCount(3);
    await groupDetailPage3.waitForMemberCount(3);
    
    console.log('✅ Created group with 3 users');
    
    // 2. User 1 makes a expense for 120, split equally
    await groupDetailPage.addExpense({
      description: 'Group dinner expense',
      amount: 120,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    console.log('✅ Created $120 expense paid by user1, split equally among 3 users');
    
    // Wait for expense to appear on all pages and verify all users see it
    await groupDetailPage.waitForBalanceCalculation();
    await page2.reload();
    await page3.reload();
    await groupDetailPage2.waitForBalanceCalculation();
    await groupDetailPage3.waitForBalanceCalculation();
    
    // All users should see the expense
    await expect(page.getByText('Group dinner expense')).toBeVisible();
    await expect(page2.getByText('Group dinner expense')).toBeVisible();
    await expect(page3.getByText('Group dinner expense')).toBeVisible();
    
    // All users should see $120.00 amount
    await expect(page.getByText('$120.00')).toBeVisible();
    await expect(page2.getByText('$120.00')).toBeVisible();
    await expect(page3.getByText('$120.00')).toBeVisible();
    
    console.log('✅ All users can see the expense');
    
    // 3. Assert initial balances: user1 owed 80, user2 & user3 each owe 40
    // Math: $120 / 3 = $40 per person
    // User1 paid $120, owes $40 → Net: owed $80
    // User2 paid $0, owes $40 → Net: owes $40
    // User3 paid $0, owes $40 → Net: owes $40
    
    // User1's view
    const balancesSection1 = page.locator('.bg-white').filter({ 
      has: page.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    await expect(balancesSection1.getByText(`${user2.displayName} owes ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection1.getByText(`${user3.displayName} owes ${user1.displayName}`)).toBeVisible();
    
    // User2's view
    const balancesSection2 = page2.locator('.bg-white').filter({ 
      has: page2.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    await expect(balancesSection2.getByText(`${user2.displayName} owes ${user1.displayName}`)).toBeVisible();
    
    // User3's view
    const balancesSection3 = page3.locator('.bg-white').filter({ 
      has: page3.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    await expect(balancesSection3.getByText(`${user3.displayName} owes ${user1.displayName}`)).toBeVisible();
    
    // Check the amounts - there should be two $40.00 entries on user1's page
    const fortyDollarElements = balancesSection1.locator('.text-red-600').filter({ hasText: '$40.00' });
    await expect(fortyDollarElements).toHaveCount(2);
    
    console.log('✅ Verified initial debts: User2 owes $40, User3 owes $40');
    
    // 4. User 2 makes partial settlement of 30
    console.log('💳 User2 making partial settlement of $30');
    
    await groupDetailPage2.recordSettlement({
      payerIndex: 2, // user2 (based on dropdown order)
      payeeIndex: 1, // user1
      amount: '30',
      note: 'Partial payment from user2'
    });
    
    // Wait for settlement to propagate and refresh all pages
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page2.reload();
    await page3.reload();
    await groupDetailPage.waitForBalanceCalculation();
    await groupDetailPage2.waitForBalanceCalculation();
    await groupDetailPage3.waitForBalanceCalculation();
    
    console.log('✅ Settlement of $30 recorded');
    
    // All users should see the settlement in history
    const showHistoryButton1 = page.getByRole('button', { name: 'Show History' });
    await showHistoryButton1.click();
    await expect(page.getByText(/Partial payment from user2/i)).toBeVisible();
    await page.keyboard.press('Escape'); // Close history modal if it's a modal
    
    const showHistoryButton2 = page2.getByRole('button', { name: 'Show History' });
    await showHistoryButton2.click();
    await expect(page2.getByText(/Partial payment from user2/i)).toBeVisible();
    await page2.keyboard.press('Escape');
    
    const showHistoryButton3 = page3.getByRole('button', { name: 'Show History' });
    await showHistoryButton3.click();
    await expect(page3.getByText(/Partial payment from user2/i)).toBeVisible();
    await page3.keyboard.press('Escape');
    
    console.log('✅ All users can see the settlement in history');
    
    // 5. Assert updated balances after $30 payment
    // User2 debt: $40 - $30 = $10
    // User3 debt: $40 (unchanged)
    // User1 owed: $80 - $30 = $50
    
    // Refresh balance sections after closing history
    const updatedBalancesSection1 = page.locator('.bg-white').filter({ 
      has: page.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    // User2 should now owe $10
    await expect(updatedBalancesSection1.getByText(`${user2.displayName} owes ${user1.displayName}`)).toBeVisible();
    const tenDollarElement = updatedBalancesSection1.locator('.text-red-600').filter({ hasText: '$10.00' });
    await expect(tenDollarElement).toBeVisible();
    
    // User3 should still owe $40
    await expect(updatedBalancesSection1.getByText(`${user3.displayName} owes ${user1.displayName}`)).toBeVisible();
    const fortyDollarElement = updatedBalancesSection1.locator('.text-red-600').filter({ hasText: '$40.00' });
    await expect(fortyDollarElement).toBeVisible();
    
    console.log('✅ Verified balances after partial payment: User2 owes $10, User3 owes $40');
    
    // 6. User 2 makes final settlement of remaining $10
    console.log('💳 User2 making final settlement of $10');
    
    await groupDetailPage2.recordSettlement({
      payerIndex: 2, // user2
      payeeIndex: 1, // user1
      amount: '10',
      note: 'Final payment from user2 - all settled!'
    });
    
    // Wait for settlement to propagate and refresh all pages
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page2.reload();
    await page3.reload();
    await groupDetailPage.waitForBalanceCalculation();
    await groupDetailPage2.waitForBalanceCalculation();
    await groupDetailPage3.waitForBalanceCalculation();
    
    console.log('✅ Final settlement of $10 recorded');
    
    // 7. Assert final state: User2 is settled up, User3 still owes $40
    const finalBalancesSection1 = page.locator('.bg-white').filter({ 
      has: page.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    // User2 should no longer appear in the debt list (settled up)
    // We should NOT see "User2 owes User1" anymore
    await expect(finalBalancesSection1.getByText(`${user2.displayName} owes ${user1.displayName}`)).not.toBeVisible();
    
    // User3 should still owe $40
    await expect(finalBalancesSection1.getByText(`${user3.displayName} owes ${user1.displayName}`)).toBeVisible();
    await expect(finalBalancesSection1.locator('.text-red-600').filter({ hasText: '$40.00' })).toBeVisible();
    
    // User2's view should show they're settled up with User1
    const finalBalancesSection2 = page2.locator('.bg-white').filter({ 
      has: page2.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    // User2 should no longer have any debt to User1
    await expect(finalBalancesSection2.getByText(`${user2.displayName} owes ${user1.displayName}`)).not.toBeVisible();
    
    console.log('✅ User2 is now settled up with User1!');
    console.log('✅ User3 still owes $40 to User1');
    
    // Verify both settlements appear in history
    const finalHistoryButton = page.getByRole('button', { name: 'Show History' });
    await finalHistoryButton.click();
    await expect(page.getByText(/Partial payment from user2/i)).toBeVisible();
    await expect(page.getByText(/Final payment from user2 - all settled!/i)).toBeVisible();
    
    console.log('🎉 Three-user partial and full settlement test completed successfully');
  });
});
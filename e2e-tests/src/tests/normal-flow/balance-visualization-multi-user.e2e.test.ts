import { multiUserTest, expect } from '../../fixtures';
import { GroupWorkflow } from '../../workflows';
import { MultiUserWorkflow } from '../../workflows';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import {generateShortId} from "../../utils/test-helpers.ts";
import { GroupDetailPage } from '../../pages';
import { JoinGroupPage } from '../../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

multiUserTest.describe('Multi-User Balance Visualization - Deterministic States', () => {
  multiUserTest('should show settled up when both users pay equal amounts', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = new GroupDetailPage(page2);
    const groupWorkflow = new GroupWorkflow(page);
    const multiUserWorkflow = new MultiUserWorkflow(null);
    
    // Setup 2-person group with unique ID
    const uniqueId = generateShortId();
    await groupWorkflow.createGroup(`Equal Payment Test ${uniqueId}`, 'Testing equal payments');

    // Get share link using direct method like working tests
    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    // User2 joins using robust JoinGroupPage
    const joinGroupPage = new JoinGroupPage(page2);
    const joinResult = await joinGroupPage.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult.success) {
      throw new Error(`Failed to join group: ${joinResult.reason}`);
    }
    
    // Wait for synchronization on BOTH pages after join
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // SEQUENTIAL EXPENSES: User1 adds expense first
    // Key insight: If both users add equal expenses → ALWAYS settled up
    await groupDetailPage.addExpense({
      description: 'User1 Equal Payment',
      amount: 100,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for first expense to be fully processed and synced
    await groupDetailPage.waitForBalanceUpdate();
    await page.reload();
    await page2.reload();
    await page.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    // Verify first expense is visible to both users before adding second
    await expect(page.getByText('User1 Equal Payment')).toBeVisible();
    await expect(page2.getByText('User1 Equal Payment')).toBeVisible();

    // SEQUENTIAL: User2 adds expense ONLY AFTER User1's is synchronized
    await groupDetailPage2.addExpense({
      description: 'User2 Equal Payment', 
      amount: 100,
      paidBy: user2.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for second expense to be fully processed
    await groupDetailPage2.waitForBalanceUpdate();
    
    // Refresh to ensure all balance calculations are complete and visible
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Verify settled up state
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText('All settled up!')).toBeVisible();
    
    // Verify NO debt messages are present
    await expect(balancesSection.getByText(`${user1.displayName} → ${user2.displayName}`)).not.toBeVisible();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).not.toBeVisible();
    
    await expect(page.getByText('User1 Equal Payment')).toBeVisible();
    await expect(page.getByText('User2 Equal Payment')).toBeVisible();
  });

  multiUserTest('should show specific debt when only one person pays', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = new GroupDetailPage(page2);
    const groupWorkflow = new GroupWorkflow(page);
    const multiUserWorkflow = new MultiUserWorkflow(null);
    
    const uniqueId = generateShortId();
    await groupWorkflow.createGroup(`Single Payer Debt Test ${uniqueId}`, 'Testing single payer debt');

    // Get share link using reliable method
    const shareLink = await multiUserWorkflow.getShareLink(page);
    
    // User2 joins using robust JoinGroupPage
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Wait for synchronization on BOTH pages after join
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // Only User1 pays $200 → User2 MUST owe User1 $100 (never settled up)
    // Key insight: In 2-person groups, if only 1 person adds expense → NEVER settled up
    await groupDetailPage.addExpense({
      description: 'One Person Pays',
      amount: 200,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for expense to be fully processed and balance to update
    await groupDetailPage.waitForBalanceUpdate();
    
    // Also reload to ensure data is fresh
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Verify debt exists with exact amount: $200 / 2 = $100
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$100.00' })).toBeVisible();
    
    await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
    await expect(groupDetailPage.getCurrencyAmount('200.00')).toBeVisible();
  });
  
  multiUserTest('should calculate complex debts correctly', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = new GroupDetailPage(page2);
    const groupWorkflow = new GroupWorkflow(page);
    const multiUserWorkflow = new MultiUserWorkflow(null);
    
    const uniqueId = generateShortId();
    await groupWorkflow.createGroup(`Complex Debt Test ${uniqueId}`, 'Testing complex debt calculation');

    // Get share link using reliable method
    const shareLink = await multiUserWorkflow.getShareLink(page);
    
    // User2 joins using robust JoinGroupPage
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Wait for synchronization on BOTH pages after join
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // SEQUENTIAL EXPENSES: User1 pays $300 first
    // Complex but predictable: User1 paid $300, User2 paid $100
    // Total: $400, each owes $200, net: User2 owes User1 $100
    await groupDetailPage.addExpense({
      description: 'Large User1 Payment',
      amount: 300,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for first expense to be fully processed and synced
    await groupDetailPage.waitForBalanceUpdate();
    await page.reload();
    await page2.reload();
    await page.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    // Verify first expense is visible before adding second
    await expect(page.getByText('Large User1 Payment')).toBeVisible();
    await expect(page2.getByText('Large User1 Payment')).toBeVisible();

    // SEQUENTIAL: User2 adds expense AFTER User1's is synchronized
    await groupDetailPage2.addExpense({
      description: 'Small User2 Payment',
      amount: 100,
      paidBy: user2.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for second expense to be fully processed
    await groupDetailPage2.waitForBalanceUpdate();
    
    // Reload to ensure all balance calculations are complete and visible
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Verify complex debt calculation: (300-100)/2 = 100
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$100.00' })).toBeVisible();
    
    await expect(page.getByText('Large User1 Payment')).toBeVisible();
    await expect(page.getByText('Small User2 Payment')).toBeVisible();
  });
  
  multiUserTest('should transition from settled to debt to settled predictably', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = new GroupDetailPage(page2);
    const groupWorkflow = new GroupWorkflow(page);
    const multiUserWorkflow = new MultiUserWorkflow(null);
    
    const uniqueId = generateShortId();
    await groupWorkflow.createGroup(`State Transition Test ${uniqueId}`, 'Testing state transitions');

    // Get share link using reliable method
    const shareLink = await multiUserWorkflow.getShareLink(page);
    
    // User2 joins using robust JoinGroupPage
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Wait for synchronization on BOTH pages after join
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // State 1: Empty group → ALWAYS settled up
    await expect(groupDetailPage.getBalancesSection().getByText('All settled up!')).toBeVisible();
    
    // State 2: User1 pays $100 → User2 MUST owe $50
    await groupDetailPage.addExpense({
      description: 'Create Debt',
      amount: 100,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Reload to ensure the expense and balance updates are visible
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Verify debt exists with amount $50.00
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$50.00' })).toBeVisible();
    
    // State 3: User2 pays $100 → MUST be settled up
    // SEQUENTIAL: User2 adds balancing expense
    await groupDetailPage2.addExpense({
      description: 'Balance Debt',
      amount: 100,
      paidBy: user2.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Refresh to ensure balance calculations are updated
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Guaranteed settled up: both paid $100
    await expect(groupDetailPage.getBalancesSection().getByText('All settled up!')).toBeVisible();
    
    // Verify NO debt messages remain by checking specific debt doesn't exist
    await expect(groupDetailPage.getBalancesSection().getByText(`${user2.displayName} → ${user1.displayName}`)).not.toBeVisible();
    
    await expect(page.getByText('Create Debt')).toBeVisible();
    await expect(page.getByText('Balance Debt')).toBeVisible();
  });
  
  multiUserTest('should handle currency formatting in debt amounts', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = new GroupDetailPage(page2);
    const groupWorkflow = new GroupWorkflow(page);
    const multiUserWorkflow = new MultiUserWorkflow(null);
    
    const uniqueId = generateShortId();
    const groupId = await groupWorkflow.createGroup(`Currency Format Test ${uniqueId}`, 'Testing currency formatting');

    // Get share link using reliable method
    const shareLink = await multiUserWorkflow.getShareLink(page);
    
    // User2 joins using robust JoinGroupPage
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Wait for synchronization on BOTH pages after join
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // User1 pays $123.45 → User2 owes exactly $61.73
    await groupDetailPage.addExpense({
      description: 'Currency Test',
      amount: 123.45,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Reload to ensure the expense and balance updates are visible
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Verify debt with calculated amount: $123.45 / 2 = $61.73
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    const expectedDebt = groupDetailPage.calculateEqualSplitDebt(123.45, 2);
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: `$${expectedDebt}` })).toBeVisible();
    
    // Verify the original expense amount is visible
    await expect(groupDetailPage.getCurrencyAmount('123.45')).toBeVisible();
  });
});

multiUserTest.describe('Balance with Settlement Calculations', () => {
  multiUserTest('should update debt correctly after partial settlement', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = secondUser.groupDetailPage;
    const groupWorkflow = new GroupWorkflow(page);
    const multiUserWorkflow = new MultiUserWorkflow(null);
    
    // Step 1: Create group and verify
    const uniqueId = generateShortId();
    const groupId = await groupWorkflow.createGroup(`Partial Settlement Test ${uniqueId}`, 'Testing partial settlements');
    await expect(groupDetailPage.getMemberCountText(1)).toBeVisible();
    
    // Step 2: Get share link using reliable method
    const shareLink = await multiUserWorkflow.getShareLink(page);
    
    // Step 3: User 2 joins using robust JoinGroupPage
    const joinGroupPageStep3 = new JoinGroupPage(page2);
    const joinResultStep3 = await joinGroupPageStep3.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResultStep3.success) {
      throw new Error(`Failed to join group: ${joinResultStep3.reason}`);
    }
    
    // Step 4: Synchronize both users and verify member count
    // Need to reload pages to see the join
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await groupDetailPage.waitForMemberCount(2);
    await expect(page.getByText(user1.displayName)).toBeVisible();
    await expect(page.getByText(user2.displayName)).toBeVisible();
    
    await groupDetailPage2.waitForMemberCount(2);
    await expect(page2.getByText(user1.displayName)).toBeVisible();
    await expect(page2.getByText(user2.displayName)).toBeVisible();
    
    // Step 5: Verify no expenses yet
    await expect(groupDetailPage.getNoExpensesText()).toBeVisible();
    
    // Step 6: Create expense directly
    await groupDetailPage.addExpense({
      description: 'Test Expense for Settlement',
      amount: 200,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Step 7: Verify expense appears for User 1
    await expect(page.getByText('Test Expense for Settlement')).toBeVisible();
    await expect(groupDetailPage.getCurrencyAmount('200.00')).toBeVisible();
    
    // Step 8: Verify User 2 sees expense
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await expect(page2.getByText('Test Expense for Settlement')).toBeVisible();
    await expect(page2.getByText('$200.00')).toBeVisible();
    
    // Step 9: Verify initial debt (User 2 owes User 1 $100)
    await groupDetailPage.waitForBalancesToLoad(groupId);
    const balancesSection = groupDetailPage.getBalancesSection();
    
    // Verify debt relationship is shown
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$100.00' })).toBeVisible();
    
    // Step 10: Record partial settlement of $60
    // Use the recordSettlement helper with display names
    await groupDetailPage.recordSettlementByUser({
      payerName: user2.displayName,  // User who owes money pays
      payeeName: user1.displayName,  // User who is owed receives
      amount: '60',
      note: 'Partial payment of $60'
    });
    
    // Step 13: Wait for settlement to propagate and refresh all pages
    // This pattern is from the working three-user test
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForBalancesToLoad(groupId);
    await groupDetailPage2.waitForBalancesToLoad(groupId);
    
    // Step 14: Verify settlement appears in history for both users
    const showHistoryButton = groupDetailPage.getShowHistoryButton();
    await showHistoryButton.click();
    await expect(page.getByText('Partial payment of $60')).toBeVisible();
    await page.keyboard.press('Escape');
    
    const showHistoryButton2 = groupDetailPage2.getShowHistoryButton();
    await showHistoryButton2.click();
    await expect(page2.getByText('Partial payment of $60')).toBeVisible();
    await page2.keyboard.press('Escape');
    
    // Step 16: Assert final balance ($100 - $60 = $40 remaining)
    const updatedBalancesSection = page.locator('.bg-white').filter({ 
      has: page.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    // Verify updated debt relationship and amount after partial settlement
    await expect(updatedBalancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(updatedBalancesSection.locator('.text-red-600').filter({ hasText: '$40.00' })).toBeVisible();
    
    // Step 17: Verify User 2 also sees updated balance
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    
    const balancesSection2 = page2.locator('.bg-white').filter({ 
      has: page2.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    // Verify debt from user2's perspective
    await expect(balancesSection2.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection2.locator('.text-red-600').filter({ hasText: '$40.00' })).toBeVisible();
  });

  multiUserTest('should show settled up after exact settlement', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = secondUser.groupDetailPage;
    const groupWorkflow = new GroupWorkflow(page);
    const multiUserWorkflow = new MultiUserWorkflow(null);
    
    const uniqueId = generateShortId();
    const groupId = await groupWorkflow.createGroup(`Exact Settlement Test ${uniqueId}`, 'Testing exact settlements');

    // Get share link using reliable method
    const shareLink = await multiUserWorkflow.getShareLink(page);
    
    // User2 joins using robust JoinGroupPage
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Critical: Ensure both users are synchronized before creating expenses
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // Also ensure user2 sees both members
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // Create known debt: User1 pays $150 → User2 owes $75
    // In 2-person group: debt = amount / 2
    await groupDetailPage.addExpense({
      description: 'One Person Pays',
      amount: 150,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for expense to be fully processed and synced to both users
    await groupDetailPage.waitForBalanceUpdate();
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    await groupDetailPage2.waitForBalancesToLoad(groupId);
    
    // Reload to ensure data is fresh
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for expense to appear and balance to calculate
    await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
    await groupDetailPage.waitForBalancesToLoad(groupId);
    
    // Verify debt exists with exact amount: $150 / 2 = $75
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    const expectedDebtAmount = '75.00';
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$75.00' })).toBeVisible();
    
    // User2 pays User1 the exact debt amount ($75) → MUST be settled up
    // Use the new recordSettlementByUser method with display names
    await groupDetailPage.recordSettlementByUser({
      payerName: user2.displayName,  // User who owes money pays
      payeeName: user1.displayName,  // User who is owed receives
      amount: expectedDebtAmount,
      note: 'Full settlement payment'
    });
    
    // Wait for settlement to propagate and refresh all pages
    // This pattern is from the working three-user test
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForBalancesToLoad(groupId);
    await secondUser.groupDetailPage.waitForBalancesToLoad(groupId);
    
    // Check if settlement was recorded by looking at payment history
    const showHistoryButton = groupDetailPage.getShowHistoryButton();
    await showHistoryButton.click();
    
    const settlementEntry = page.getByText(/Full settlement payment/i);
    await expect(settlementEntry).toBeVisible();
    await page.keyboard.press('Escape'); // Close history modal
    
    // Also verify user2 can see the settlement
    const showHistoryButton2 = groupDetailPage2.getShowHistoryButton();
    await showHistoryButton2.click();
    await expect(page2.getByText(/Full settlement payment/i)).toBeVisible();
    await page2.keyboard.press('Escape');
    
    // Test user1's browser (page)
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Use more specific selector for the balance section
    const balanceSection = page.locator('.bg-white').filter({
      has: page.getByRole('heading', { name: 'Balances' })
    }).first();

    // Should be settled up after paying the full debt amount
    await expect(balanceSection.getByText('All settled up!')).toBeVisible();
    
    // Verify expenses still appear after settlement in user1's browser
    await expect(groupDetailPage.getExpensesHeading()).toBeVisible();
    await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
    await expect(groupDetailPage.getCurrencyAmount('150.00')).toBeVisible();
    
    // Test user2's browser (page2) - should show same data
    await expect(secondUser.groupDetailPage.getBalancesHeading()).toBeVisible();
    
    await expect(secondUser.groupDetailPage.getLoadingBalancesText()).not.toBeVisible();
    
    // Both users should see settled up
    const balanceSection2 = secondUser.groupDetailPage.getBalancesSection();
    await expect(balanceSection2.getByText('All settled up!')).toBeVisible();
    
    // Both users should see the expenses
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    
    await expect(secondUser.groupDetailPage.getExpensesHeading()).toBeVisible();
    await expect(page2.getByText('One Person Pays')).toBeVisible();
    await expect(page2.getByText('$150.00')).toBeVisible();
  });
});
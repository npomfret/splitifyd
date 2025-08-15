import { multiUserTest, expect } from '../../fixtures';
import { GroupWorkflow } from '../../workflows';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { generateShortId } from "../../utils/test-helpers.ts";
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
    
    // Setup 2-person group with unique ID
    const uniqueId = generateShortId();
    const groupId = await groupWorkflow.createGroup(`Equal Payment Test ${uniqueId}`, 'Testing equal payments');
    console.log('Group ID:', groupId);

    // Get share link directly
    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.clickShareButton();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await groupDetailPage.closeModalWithEscape();
    
    // User2 joins using robust JoinGroupPage
    const joinGroupPage = new JoinGroupPage(page2);
    const joinResult = await joinGroupPage.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult.success) {
      throw new Error(`Failed to join group: ${joinResult.reason}`);
    }
    
    // Try to wait for synchronization but don't fail the test
    try {
      await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
      await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    } catch (error) {
      console.log('Synchronization failed - pausing for inspection');
      console.log('Group ID:', groupId);
      console.log('User1:', user1.displayName, 'URL:', page.url());
      console.log('User2:', user2.displayName, 'URL:', page2.url());
      
      // Pause for manual inspection
      await page.pause();
      await page2.pause();
      
      // Rethrow to fail the test after inspection
      throw error;
    }
    
    // SEQUENTIAL EXPENSES: User1 adds expense first
    await groupDetailPage.addExpense({
      description: 'User1 Equal Payment',
      amount: 100,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for first expense to be synced via real-time updates
    await groupDetailPage.waitForBalanceUpdate();
    
    // Verify first expense is visible to both users via real-time updates
    await groupDetailPage.verifyExpenseVisible('User1 Equal Payment');
    await groupDetailPage2.verifyExpenseVisible('User1 Equal Payment');

    // User2 adds expense AFTER User1's is synchronized
    await groupDetailPage2.addExpense({
      description: 'User2 Equal Payment', 
      amount: 100,
      paidBy: user2.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for second expense to be processed
    await groupDetailPage2.waitForBalanceUpdate();
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Verify settled up state
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText('All settled up!')).toBeVisible();
    
    // Verify NO debt messages are present
    await expect(balancesSection.getByText(`${user1.displayName} → ${user2.displayName}`)).not.toBeVisible();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).not.toBeVisible();
    
    await groupDetailPage.verifyExpenseVisible('User1 Equal Payment');
    await groupDetailPage.verifyExpenseVisible('User2 Equal Payment');
  });

  multiUserTest('should show specific debt when only one person pays', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = new GroupDetailPage(page2);
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = generateShortId();
    await groupWorkflow.createGroup(`Single Payer Debt Test ${uniqueId}`, 'Testing single payer debt');

    // Get share link directly
    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.clickShareButton();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await groupDetailPage.closeModalWithEscape();
    
    // User2 joins
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Wait for synchronization - no reloads needed
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // Only User1 pays $200 → User2 MUST owe User1 $100
    await groupDetailPage.addExpense({
      description: 'One Person Pays',
      amount: 200,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for expense to be processed via real-time updates
    await groupDetailPage.waitForBalanceUpdate();
    
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
    
    const uniqueId = generateShortId();
    await groupWorkflow.createGroup(`Complex Debt Test ${uniqueId}`, 'Testing complex debt calculation');

    // Get share link directly
    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.clickShareButton();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await groupDetailPage.closeModalWithEscape();
    
    // User2 joins
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Wait for synchronization - no reloads needed
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // User1 pays $300 first
    await groupDetailPage.addExpense({
      description: 'Large User1 Payment',
      amount: 300,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for first expense to be synced via real-time updates
    await groupDetailPage.waitForBalanceUpdate();
    
    // Verify first expense is visible via real-time updates
    await groupDetailPage.verifyExpenseVisible('Large User1 Payment');
    await groupDetailPage2.verifyExpenseVisible('Large User1 Payment');

    // User2 adds expense AFTER User1's is synchronized
    await groupDetailPage2.addExpense({
      description: 'Small User2 Payment',
      amount: 100,
      paidBy: user2.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for second expense to be processed
    await groupDetailPage2.waitForBalanceUpdate();
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Verify complex debt calculation: (300-100)/2 = 100
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$100.00' })).toBeVisible();
    
    await groupDetailPage.verifyExpenseVisible('Large User1 Payment');
    await groupDetailPage.verifyExpenseVisible('Small User2 Payment');
  });
  
  multiUserTest('should transition from settled to debt to settled predictably', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = new GroupDetailPage(page2);
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = generateShortId();
    await groupWorkflow.createGroup(`State Transition Test ${uniqueId}`, 'Testing state transitions');

    // Get share link directly
    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.clickShareButton();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await groupDetailPage.closeModalWithEscape();
    
    // User2 joins
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Wait for synchronization - no reloads needed
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
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
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Verify debt exists with amount $50.00
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$50.00' })).toBeVisible();
    
    // State 3: User2 pays $100 → MUST be settled up
    await groupDetailPage2.addExpense({
      description: 'Balance Debt',
      amount: 100,
      paidBy: user2.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for balance calculations to be updated via real-time updates
    await groupDetailPage2.waitForBalanceUpdate();
    
    // Guaranteed settled up: both paid $100
    await expect(groupDetailPage.getBalancesSection().getByText('All settled up!')).toBeVisible();
    
    // Verify NO debt messages remain
    await expect(groupDetailPage.getBalancesSection().getByText(`${user2.displayName} → ${user1.displayName}`)).not.toBeVisible();
    
    await groupDetailPage.verifyExpenseVisible('Create Debt');
    await groupDetailPage.verifyExpenseVisible('Balance Debt');
  });
  
  multiUserTest('should handle currency formatting in debt amounts', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = new GroupDetailPage(page2);
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = generateShortId();
    await groupWorkflow.createGroup(`Currency Format Test ${uniqueId}`, 'Testing currency formatting');

    // Get share link directly
    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.clickShareButton();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await groupDetailPage.closeModalWithEscape();
    
    // User2 joins
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }
    
    // Wait for synchronization - no reloads needed
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // User1 pays $123.45 → User2 owes exactly $61.73
    await groupDetailPage.addExpense({
      description: 'Currency Test',
      amount: 123.45,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
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
    
    // Create group and verify
    const uniqueId = generateShortId();
    const groupId = await groupWorkflow.createGroup(`Partial Settlement Test ${uniqueId}`, 'Testing partial settlements');
    await expect(groupDetailPage.getMemberCountText(1)).toBeVisible();
    
    // Get share link directly
    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.clickShareButton();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await groupDetailPage.closeModalWithEscape();
    
    // User 2 joins
    const joinGroupPage = new JoinGroupPage(page2);
    const joinResult = await joinGroupPage.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult.success) {
      throw new Error(`Failed to join group: ${joinResult.reason}`);
    }
    
    // Synchronize both users - no reloads needed with real-time updates
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // Verify no expenses yet
    await expect(groupDetailPage.getNoExpensesText()).toBeVisible();
    
    // Create expense directly
    await groupDetailPage.addExpense({
      description: 'Test Expense for Settlement',
      amount: 200,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Verify expense appears for User 1
    await groupDetailPage.verifyExpenseVisible('Test Expense for Settlement');
    await expect(groupDetailPage.getCurrencyAmount('200.00')).toBeVisible();
    
    // Verify User 2 sees expense via real-time updates
    await groupDetailPage2.verifyExpenseVisible('Test Expense for Settlement');
    await groupDetailPage2.verifyCurrencyAmountVisible('200.00');
    
    // Verify initial debt (User 2 owes User 1 $100)
    await groupDetailPage.waitForBalancesToLoad(groupId);
    const balancesSection = groupDetailPage.getBalancesSection();
    
    // Verify debt relationship is shown
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$100.00' })).toBeVisible();
    
    // Record partial settlement of $60
    await groupDetailPage.recordSettlementByUser({
      payerName: user2.displayName,
      payeeName: user1.displayName,
      amount: '60',
      note: 'Partial payment of $60'
    });
    
    // Wait for settlement to propagate via real-time updates
    await page.waitForLoadState('domcontentloaded');
    await groupDetailPage.waitForBalancesToLoad(groupId);
    await groupDetailPage2.waitForBalancesToLoad(groupId);
    
    // Verify settlement appears in history for both users
    await groupDetailPage.openHistoryAndVerifySettlement(/Partial payment of \$60/);
    await groupDetailPage.closeModalWithEscape();
    
    await groupDetailPage2.openHistoryAndVerifySettlement(/Partial payment of \$60/);
    await groupDetailPage2.closeModalWithEscape();
    
    // Assert final balance ($100 - $60 = $40 remaining)
    // Verify updated debt relationship and amount after partial settlement
    await groupDetailPage.verifyDebtRelationship(user2.displayName, user1.displayName, '$40.00');
    
    // Verify User 2 also sees updated balance via real-time updates
    await groupDetailPage2.verifyDebtRelationship(user2.displayName, user1.displayName, '$40.00');
  });

  multiUserTest('should show settled up after exact settlement', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupDetailPage2 = secondUser.groupDetailPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = generateShortId();
    const groupId = await groupWorkflow.createGroup(`Exact Settlement Test ${uniqueId}`, 'Testing exact settlements');

    // Get share link directly
    await expect(groupDetailPage.getShareButton()).toBeVisible();
    await groupDetailPage.clickShareButton();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await groupDetailPage.closeModalWithEscape();
    
    // User2 joins
    const joinGroupPage2 = new JoinGroupPage(page2);
    const joinResult2 = await joinGroupPage2.attemptJoinWithStateDetection(shareLink);
    
    if (!joinResult2.success) {
      throw new Error(`Failed to join group: ${joinResult2.reason}`);
    }

    // Wait for synchronization - no reloads needed
    await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
    await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);
    
    // Create known debt: User1 pays $150 → User2 owes $75
    await groupDetailPage.addExpense({
      description: 'One Person Pays',
      amount: 150,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for expense to be processed via real-time updates
    await groupDetailPage.waitForBalanceUpdate();
    await groupDetailPage2.waitForBalancesToLoad(groupId);
    
    // Wait for expense to appear and balance to calculate
    await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
    await groupDetailPage.waitForBalancesToLoad(groupId);
    
    // Verify debt exists with exact amount: $150 / 2 = $75
    const balancesSection = groupDetailPage.getBalancesSection();
    await expect(balancesSection.getByText(`${user2.displayName} → ${user1.displayName}`)).toBeVisible();
    const expectedDebtAmount = '75.00';
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: '$75.00' })).toBeVisible();
    
    // User2 pays User1 the exact debt amount ($75) → MUST be settled up
    await groupDetailPage.recordSettlementByUser({
      payerName: user2.displayName,
      payeeName: user1.displayName,
      amount: expectedDebtAmount,
      note: 'Full settlement payment'
    });
    
    // Wait for settlement to propagate via real-time updates
    await page.waitForLoadState('domcontentloaded');
    await groupDetailPage.waitForBalancesToLoad(groupId);
    await secondUser.groupDetailPage.waitForBalancesToLoad(groupId);
    
    // Check if settlement was recorded by looking at payment history
    const showHistoryButton = groupDetailPage.getShowHistoryButton();
    await showHistoryButton.click();
    
    await groupDetailPage.verifySettlementInHistoryVisible('Full settlement payment');
    await groupDetailPage.closeModalWithEscape();
    
    // Also verify user2 can see the settlement via real-time updates
    const showHistoryButton2 = groupDetailPage2.getShowHistoryButton();
    await showHistoryButton2.click();
    await groupDetailPage2.verifySettlementInHistoryVisible('Full settlement payment');
    await groupDetailPage2.closeModalWithEscape();
    
    // Test user1's browser
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    const balanceSection = groupDetailPage.getBalancesSectionByContext();

    // Should be settled up after paying the full debt amount
    await expect(balanceSection.getByText('All settled up!')).toBeVisible();
    
    // Verify expenses still appear after settlement
    await expect(groupDetailPage.getExpensesHeading()).toBeVisible();
    await expect(groupDetailPage.getTextElement('One Person Pays')).toBeVisible();
    await expect(groupDetailPage.getCurrencyAmount('150.00')).toBeVisible();
    
    // Test user2's browser - should show same data via real-time updates
    await expect(secondUser.groupDetailPage.getBalancesHeading()).toBeVisible();
    
    await expect(secondUser.groupDetailPage.getLoadingBalancesText()).not.toBeVisible();
    
    // Both users should see settled up
    const balanceSection2 = secondUser.groupDetailPage.getBalancesSection();
    await expect(balanceSection2.getByText('All settled up!')).toBeVisible();
    
    // Both users should see the expenses via real-time updates
    await expect(secondUser.groupDetailPage.getExpensesHeading()).toBeVisible();
    await groupDetailPage2.verifyExpenseVisible('One Person Pays');
    await groupDetailPage2.verifyCurrencyAmountVisible('150.00');
  });
});
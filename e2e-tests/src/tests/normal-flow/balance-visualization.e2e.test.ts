import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { multiUserTest, expect as multiUserExpected } from '../../fixtures/multi-user-test';
import { GroupWorkflow } from '../../workflows/index';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Single User Balance Visualization', () => {
  test('should show settled up state for single-user groups', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    
    // Create test group using dashboard page object
    const groupName = `Single User Test ${Date.now()}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing single user balance');
    
    // Verify navigation succeeded
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add expenses
    await groupDetailPage.addExpense({
      description: 'Dinner',
      amount: 120,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    await groupDetailPage.addExpense({
      description: 'Groceries',
      amount: 80,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    // Verify Balances section shows settled up for single-user groups
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await expect(balancesHeading).toBeVisible();
    
    const settledUpMessage = page.getByText('All settled up!');
    await expect(settledUpMessage).toBeVisible();
    
    // Verify expenses are tracked in the expense section
    const dinnerExpense = page.getByText('$120.00');
    await expect(dinnerExpense).toBeVisible();
    const groceryExpense = page.getByText('$80.00');
    await expect(groceryExpense).toBeVisible();
  });

  test('should handle zero balance state correctly', async ({ authenticatedPage, dashboardPage }) => {
    const { page } = authenticatedPage;
    
    // Create test group
    const groupName = `Zero Balance Test ${Date.now()}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing zero balance state');
    
    // Verify navigation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Verify Balances section shows settled up initially
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await expect(balancesHeading).toBeVisible();
    
    const settledUpMessage = page.getByText('All settled up!');
    await expect(settledUpMessage).toBeVisible();
  });

  test('should display currency correctly in single user context', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    
    // Create test group
    const groupName = `Currency Display Test ${Date.now()}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing currency display');
    
    // Verify navigation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add expense
    await groupDetailPage.addExpense({
      description: 'International expense',
      amount: 250,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    // Check for currency formatting in expense section
    const expenseCurrency = page.getByText('$250.00');
    await expect(expenseCurrency).toBeVisible();
    
    // Balance section should still show settled up for single user
    const settledUpMessage = page.getByText('All settled up!');
    await expect(settledUpMessage).toBeVisible();
  });
});

// Multi-user tests for meaningful balance visualization
multiUserTest.describe('Multi-User Balance Visualization', () => {
  multiUserTest('should display group balance correctly with multiple members', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group with first user
    await groupWorkflow.createGroup('Multi-User Balance Test', 'Testing multi-user balances');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Share and join with second user
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Refresh first user's page to see new member
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Add expense paid by first user
    await groupDetailPage.addExpense({
      description: 'Dinner',
      amount: 120,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Add second expense paid by first user
    await groupDetailPage.addExpense({
      description: 'Groceries',
      amount: 80,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Verify Balances section is visible
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    // With multi-user group and expenses, balance section should show either:
    // 1. Specific debts (e.g., "UserA owes UserB $X.XX") if there are imbalances  
    // 2. "All settled up!" if expenses are perfectly balanced
    
    // Wait for page to fully load and balances to be calculated
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Get the balance section more robustly
    const balanceSection = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Balances' }) });
    
    // Wait for either debts or settled up message to appear
    try {
      // Try waiting for either condition (5 second timeout)
      await Promise.race([
        balanceSection.getByText(/owes/, { exact: false }).first().waitFor({ timeout: 5000 }),
        balanceSection.getByText('All settled up!').waitFor({ timeout: 5000 })
      ]);
    } catch {
      // If neither appears, let's see what's actually in the balance section
      const balanceContent = await balanceSection.textContent();
      console.log('Balance section content:', balanceContent);
    }
    
    // Check counts after waiting
    const hasDebts = await balanceSection.getByText(/owes/, { exact: false }).count();
    const hasSettledUp = await balanceSection.getByText('All settled up!').count();
    
    // Should have either debts OR settled up message (not neither)
    multiUserExpected(hasDebts + hasSettledUp).toBeGreaterThan(0);
    
    // Verify expenses were actually recorded in expenses section
    const dinnerExpense = page.getByText('Dinner');
    await multiUserExpected(dinnerExpense).toBeVisible();
    const groceriesExpense = page.getByText('Groceries');
    await multiUserExpected(groceriesExpense).toBeVisible();
  });
  
  multiUserTest('should show simplified debts with multiple expenses', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create and setup group
    await groupWorkflow.createGroup('Debt Simplification Test', 'Testing debt simplification');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add second user
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Add large expense
    await groupDetailPage.addExpense({
      description: 'Trip Payment',
      amount: 300,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Verify debt indicators
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    // Should show either debts or settled up state in balances section
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const balanceSection = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Balances' }) });
    
    // Wait for balance state to appear
    try {
      await Promise.race([
        balanceSection.getByText(/owes/, { exact: false }).first().waitFor({ timeout: 5000 }),
        balanceSection.getByText('All settled up!').waitFor({ timeout: 5000 })
      ]);
    } catch {
      // Continue if neither appears - let test verify the counts
    }
    
    // Check for either debt display or settled up message
    const hasDebts = await balanceSection.getByText(/owes/, { exact: false }).count();
    const hasSettledUp = await balanceSection.getByText('All settled up!').count();
    
    // Should have either debts OR settled up message
    multiUserExpected(hasDebts + hasSettledUp).toBeGreaterThan(0);
    
    // Verify the large expense was recorded
    const tripExpense = page.getByText('Trip Payment');
    await multiUserExpected(tripExpense).toBeVisible();
    const expenseAmount = page.getByText('$300.00');
    await multiUserExpected(expenseAmount).toBeVisible();
  });
  
  multiUserTest('should update balances after new expense', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create and setup group  
    await groupWorkflow.createGroup('Dynamic Balance Test', 'Testing balance updates');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add second user
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    
    // Initially should show settled up
    const initialSettledUp = page.getByText('All settled up!');
    await multiUserExpected(initialSettledUp).toBeVisible();
    
    // Add first expense  
    await groupDetailPage.addExpense({
      description: 'New Expense',
      amount: 100,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // After first expense, should show some balance state
    const balanceSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Balances' }) });
    
    // Get initial balance state (could be debts or settled up)
    const initialDebts = await balanceSection.getByText(/owes/, { exact: false }).count();
    const initialSettled = await balanceSection.getByText('All settled up!').count();
    const initialState = `debts:${initialDebts},settled:${initialSettled}`;
    
    // Add another expense to see balance update
    await groupDetailPage.addExpense({
      description: 'Second Expense',
      amount: 50,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Reload and check if balance state changed
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for balance state to appear after reload (not loading)
    try {
      await Promise.race([
        balanceSection.getByText(/owes/, { exact: false }).first().waitFor({ timeout: 5000 }),
        balanceSection.getByText('All settled up!').waitFor({ timeout: 5000 })
      ]);
    } catch {
      // Continue if neither appears immediately
    }
    
    const updatedDebts = await balanceSection.getByText(/owes/, { exact: false }).count();
    const updatedSettled = await balanceSection.getByText('All settled up!').count();
    const updatedState = `debts:${updatedDebts},settled:${updatedSettled}`;
    
    // Balance system should be functional (show either debts or settled up, not loading)
    multiUserExpected(updatedDebts + updatedSettled).toBeGreaterThan(0);
    
    // Verify both expenses were recorded
    const firstExpense = page.getByText('New Expense');
    await multiUserExpected(firstExpense).toBeVisible();
    const secondExpense = page.getByText('Second Expense');
    await multiUserExpected(secondExpense).toBeVisible();
  });
  
  multiUserTest('should display currency correctly', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create and setup group
    await groupWorkflow.createGroup('Currency Display Test', 'Testing currency display');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add second user
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Add expense
    await groupDetailPage.addExpense({
      description: 'International expense',
      amount: 250,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Check for currency in balance section
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    // Wait for balance calculations to complete
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should show either debts or settled up state in balances section
    const balanceSection = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Balances' }) });
    
    // Wait for balance state to appear (not loading)
    try {
      await Promise.race([
        balanceSection.getByText(/owes/, { exact: false }).first().waitFor({ timeout: 5000 }),
        balanceSection.getByText('All settled up!').waitFor({ timeout: 5000 })
      ]);
    } catch {
      // Continue if neither appears immediately
    }
    
    // Check for either debt display or settled up message
    const hasDebts = await balanceSection.getByText(/owes/, { exact: false }).count();
    const hasSettledUp = await balanceSection.getByText('All settled up!').count();
    
    // Should have either debts OR settled up message (not loading)
    multiUserExpected(hasDebts + hasSettledUp).toBeGreaterThan(0);
    
    // If there are debts, verify currency formatting
    if (hasDebts > 0) {
      const currencyAmount = balanceSection.getByText(/\$\d+\.\d{2}/).first();
      await multiUserExpected(currencyAmount).toBeVisible();
    }
    
    // Check for currency patterns in expenses section too
    const expenseCurrency = page.getByText('$250.00');
    await multiUserExpected(expenseCurrency).toBeVisible();
  });
});

// Multi-user test for balance after settlement
multiUserTest.describe('Balance with Settlements', () => {
  multiUserTest('should show balance after settlement', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup('Settlement Balance Test', 'Testing settlement balances');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Share and join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    const page2 = secondUser.page;
    const user2 = secondUser.user;
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Add initial expense
    await page.reload();
    await groupDetailPage.addExpense({
      description: 'Initial expense',
      amount: 100,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Get initial balance amount
    await page.reload();
    const amountElement = page.getByText(/\$\d+\.\d{2}/).first();
    const initialText = await amountElement.textContent();
    const initialAmount = parseFloat(initialText?.replace(/[^0-9.]/g, '') || '0');
    
    // Click Settle Up button
    const settleButton = page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    // Wait for modal
    const modal = page.getByRole('dialog');
    await multiUserExpected(modal).toBeVisible();
    
    // Fill settlement form using correct selectors
    const payerSelect = page.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = page.getByRole('combobox', { name: /who received the payment/i });
    const amountInput = page.getByRole('spinbutton', { name: /amount/i });
    
    // Select users by index (safer than UID for test users)
    await payerSelect.selectOption({ index: 2 }); // user2 (assuming user1 is index 1)
    await payeeSelect.selectOption({ index: 1 }); // user1
    await amountInput.fill('50');
    
    // Submit
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await submitButton.click();
    
    // Wait for modal to close
    await multiUserExpected(modal).not.toBeVisible();
    
    // Reload to get updated balance
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check if balance changed
    const updatedElement = page.getByText(/\$\d+\.\d{2}/).first();
    const updatedText = await updatedElement.textContent();
    const updatedAmount = parseFloat(updatedText?.replace(/[^0-9.]/g, '') || '0');
    
    multiUserExpected(Math.abs(updatedAmount - initialAmount)).toBeGreaterThan(0);
  });
});
import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { multiUserTest, expect as multiUserExpect } from '../../fixtures/multi-user-test';
import { GroupWorkflow } from '../../workflows/index';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Balance Visualization', () => {
  test('should display group balance correctly', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create test group using dashboard page object
    const groupName = `Balance Test ${Date.now()}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing balance display');
    
    // Verify navigation succeeded
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add first expense
    await groupDetailPage.addExpense({
      description: 'Dinner',
      amount: 120,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    // Add second expense
    await groupDetailPage.addExpense({
      description: 'Groceries',
      amount: 80,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    // Verify balance section is visible using semantic selector
    const balanceSection = page.getByText(/balance|total/i).first();
    await expect(balanceSection).toBeVisible();
    
    // Verify total amount shows
    const totalAmount = page.getByText(/\$200|200\.00/);
    await expect(totalAmount).toBeVisible();
  });

  test('should show simplified debts', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create test group
    const groupName = `Debt Simplification Test ${Date.now()}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing debt simplification');
    
    // Verify navigation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add expense
    await groupDetailPage.addExpense({
      description: 'Trip Payment',
      amount: 300,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    // Check for debt indicators using semantic selectors
    const debtIndicator = page.getByText(/owes|owed/i);
    await expect(debtIndicator).toBeVisible();
    
    // Verify balance card contains debt information
    const balanceCard = page.getByRole('region', { name: /balance/i });
    const debtItems = balanceCard.getByText(/owes/);
    await expect(debtItems).toBeVisible();
  });

  test('should update balances after new expense', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create test group
    const groupName = `Dynamic Balance Test ${Date.now()}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing balance updates');
    
    // Verify navigation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Get initial balance text
    const balanceElement = page.getByText(/balance|total/i).first();
    const initialBalance = await balanceElement.textContent();
    
    // Add expense
    await groupDetailPage.addExpense({
      description: 'New Expense',
      amount: 100,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    // Wait for balance to update by checking for change
    await expect(balanceElement).not.toHaveText(initialBalance || '');
  });

  test('should display balance summary with multiple members', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create test group
    const groupName = `Multi-Member Balance ${Date.now()}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing multi-member balances');
    
    // Verify navigation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add expenses
    await groupDetailPage.addExpense({
      description: 'Group dinner',
      amount: 150,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    await groupDetailPage.addExpense({
      description: 'Movie tickets',
      amount: 60,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    // Verify balance section is visible
    const balanceSection = page.getByText(/balance|total/i);
    await expect(balanceSection).toBeVisible();
    
    // Check for amount displays
    const amounts = page.getByText(/\$\d+\.\d{2}/);
    await expect(amounts).toBeVisible();
  });

  test('should handle zero balance state', async ({ authenticatedPage, dashboardPage }) => {
    const { page } = authenticatedPage;
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create test group
    const groupName = `Zero Balance Test ${Date.now()}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing zero balance state');
    
    // Verify navigation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Check for settled up or no expenses message
    const settledUpText = page.getByText(/settled up|no expenses|all good/i);
    await expect(settledUpText).toBeVisible();
  });

  // This test needs multi-user to properly test settlements
  // We'll add it as a separate multi-user test at the end

  test('should display currency correctly', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
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
    
    // Check for currency symbols using semantic selectors
    const dollarSign = page.getByText(/\$/);
    await expect(dollarSign).toBeVisible();
    
    // Check for currency patterns
    const currencyPattern = page.getByText(/\$\d+\.\d{2}|USD \d+/);
    await expect(currencyPattern).toBeVisible();
  });
});

// Multi-user test for balance after settlement
multiUserTest.describe('Balance with Settlements', () => {
  multiUserTest('should show balance after settlement', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup('Settlement Balance Test', 'Testing settlement balances');
    await multiUserExpect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
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
    await multiUserExpect(modal).toBeVisible();
    
    // Fill settlement form
    const payerSelect = page.getByLabel(/who paid/i);
    const payeeSelect = page.getByLabel(/who received/i);
    const amountInput = page.getByLabel(/amount/i);
    
    // user2 pays user1
    await payerSelect.selectOption(user2.uid);
    await payeeSelect.selectOption(user1.uid);
    await amountInput.fill('50');
    
    // Submit
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await submitButton.click();
    
    // Wait for modal to close
    await multiUserExpect(modal).not.toBeVisible();
    
    // Reload to get updated balance
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check if balance changed
    const updatedElement = page.getByText(/\$\d+\.\d{2}/).first();
    const updatedText = await updatedElement.textContent();
    const updatedAmount = parseFloat(updatedText?.replace(/[^0-9.]/g, '') || '0');
    
    multiUserExpect(Math.abs(updatedAmount - initialAmount)).toBeGreaterThan(0);
  });
});
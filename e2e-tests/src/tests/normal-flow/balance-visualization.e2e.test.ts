import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { multiUserTest, expect as multiUserExpected } from '../../fixtures/multi-user-test';
import { GroupWorkflow } from '../../workflows/index';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

/**
 * Balance Test Scenario Builder - Creates precise, deterministic balance states
 * Key insight: In 2-person groups, if only 1 person adds expense → NEVER settled up
 * If both add equal expenses → ALWAYS settled up
 */
class BalanceTestScenarios {
  constructor(private page: any, private groupDetailPage: any, private user1: any, private user2: any) {}

  /**
   * Creates guaranteed settled scenario: both users pay equal amounts
   */
  async createSettledScenario() {
    await this.groupDetailPage.addExpense({
      description: 'User1 Equal Payment',
      amount: 100,
      paidBy: this.user1.displayName,
      splitType: 'equal'
    });
    
    // Wait for first expense to be fully processed
    await this.groupDetailPage.waitForBalanceUpdate();

    await this.groupDetailPage.addExpense({
      description: 'User2 Equal Payment', 
      amount: 100,
      paidBy: this.user2.displayName,
      splitType: 'equal'
    });
    
    // Wait for second expense to be fully processed
    await this.groupDetailPage.waitForBalanceUpdate();

    return { expectedState: 'settled' };
  }

  /**
   * Creates guaranteed debt scenario: only 1 person pays
   * In 2-person group: debt = amount / 2
   */
  async createDebtScenario(amount: number, payer: any) {
    await this.groupDetailPage.addExpense({
      description: 'One Person Pays',
      amount: amount,
      paidBy: payer.displayName,
      splitType: 'equal'
    });
    
    // Wait for expense to be fully processed and balance to update
    await this.groupDetailPage.waitForBalanceUpdate();

    const debtor = payer === this.user1 ? this.user2 : this.user1;
    const creditor = payer;

    return {
      expectedState: 'owes',
      expectedAmount: amount / 2,
      expectedDebtor: debtor.displayName,
      expectedCreditor: creditor.displayName
    };
  }

  /**
   * Creates complex but predictable debt scenario
   */
  async createComplexDebtScenario() {
    // User1 pays $300, User2 pays $100
    // User1 owes: $200 (half of total $400)
    // User2 owes: $200 (half of total $400)  
    // User1 paid: $300, User2 paid: $100
    // Net: User2 owes User1 $100
    await this.groupDetailPage.addExpense({
      description: 'Large User1 Payment',
      amount: 300,
      paidBy: this.user1.displayName,
      splitType: 'equal'
    });
    
    // Wait for first expense to be fully processed
    await this.groupDetailPage.waitForBalanceUpdate();

    await this.groupDetailPage.addExpense({
      description: 'Small User2 Payment',
      amount: 100,
      paidBy: this.user2.displayName,
      splitType: 'equal'
    });
    
    // Wait for second expense to be fully processed
    await this.groupDetailPage.waitForBalanceUpdate();

    return {
      expectedState: 'owes',
      expectedAmount: 100, // (300-100)/2 = 100
      expectedDebtor: this.user2.displayName,
      expectedCreditor: this.user1.displayName
    };
  }
}

test.describe('Single User Balance Visualization', () => {
  test('should show settled up state for single-user groups', async ({ authenticatedPage, dashboardPage, groupDetailPage }, testInfo) => {
    const { page, user } = authenticatedPage;
    
    // Create test group using dashboard page object with unique ID
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    const groupName = `Single User Test ${uniqueId}`;
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
    
    const settledUpMessage = groupDetailPage.getSettledUpMessageInBalanceSection();
    await expect(settledUpMessage).toBeVisible();
    
    // Verify expenses are tracked in the expense section
    const dinnerExpense = page.getByText('$120.00');
    await expect(dinnerExpense).toBeVisible();
    const groceryExpense = page.getByText('$80.00');
    await expect(groceryExpense).toBeVisible();
  });

  test('should handle zero balance state correctly', async ({ authenticatedPage, dashboardPage, groupDetailPage }, testInfo) => {
    const { page } = authenticatedPage;
    
    // Create test group with unique ID
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    const groupName = `Zero Balance Test ${uniqueId}`;
    await dashboardPage.createGroupAndNavigate(groupName, 'Testing zero balance state');
    
    // Verify navigation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Verify Balances section shows settled up initially
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await expect(balancesHeading).toBeVisible();
    
    const settledUpMessage = groupDetailPage.getSettledUpMessageInBalanceSection();
    await expect(settledUpMessage).toBeVisible();
  });

  test('should display currency correctly in single user context', async ({ authenticatedPage, dashboardPage, groupDetailPage }, testInfo) => {
    const { page, user } = authenticatedPage;
    
    // Create test group with unique ID
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    const groupName = `Currency Display Test ${uniqueId}`;
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
    const settledUpMessage = groupDetailPage.getSettledUpMessageInBalanceSection();
    await expect(settledUpMessage).toBeVisible();
  });
});

multiUserTest.describe('Multi-User Balance Visualization - Deterministic States', () => {
  multiUserTest('should show settled up when both users pay equal amounts', async ({ authenticatedPage, groupDetailPage, secondUser }, testInfo) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Setup 2-person group with unique ID
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    await groupWorkflow.createGroup(`Equal Payment Test ${uniqueId}`, 'Testing equal payments');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Both users pay equal amounts → GUARANTEED settled up
    const scenarios = new BalanceTestScenarios(page, groupDetailPage, user1, user2);
    await scenarios.createSettledScenario();
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    // No Promise.race() needed - we KNOW this will be settled up
    const settledUpMessage = page.getByText('All settled up!');
    await multiUserExpected(settledUpMessage).toBeVisible();
    
    await multiUserExpected(page.getByText('User1 Equal Payment')).toBeVisible();
    await multiUserExpected(page.getByText('User2 Equal Payment')).toBeVisible();
  });

  multiUserTest('should show specific debt when only one person pays', async ({ authenticatedPage, groupDetailPage, secondUser }, testInfo) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    await groupWorkflow.createGroup(`Single Payer Debt Test ${uniqueId}`, 'Testing single payer debt');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Only User1 pays $200 → User2 MUST owe User1 $100 (never settled up)
    const scenarios = new BalanceTestScenarios(page, groupDetailPage, user1, user2);
    await scenarios.createDebtScenario(200, user1);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    // No race condition - we KNOW there will be debt
    const debtMessage = page.getByText(`${user2.displayName} owes ${user1.displayName}`);
    await multiUserExpected(debtMessage).toBeVisible();
    
    // We KNOW the exact amount: $200 / 2 = $100
    const debtAmount = groupDetailPage.getDebtAmountInBalanceSection("$100.00");
    await multiUserExpected(debtAmount).toBeVisible();
    
    await multiUserExpected(page.getByText('One Person Pays')).toBeVisible();
    await multiUserExpected(page.getByText('$200.00')).toBeVisible();
  });
  
  multiUserTest('should calculate complex debts correctly', async ({ authenticatedPage, groupDetailPage, secondUser }, testInfo) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    await groupWorkflow.createGroup(`Complex Debt Test ${uniqueId}`, 'Testing complex debt calculation');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // User1 pays $300, User2 pays $100 → User2 owes User1 exactly $100
    const scenarios = new BalanceTestScenarios(page, groupDetailPage, user1, user2);
    await scenarios.createComplexDebtScenario();
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    // Predictable outcome: (300-100)/2 = 100
    const debtMessage = page.getByText(`${user2.displayName} owes ${user1.displayName}`);
    await multiUserExpected(debtMessage).toBeVisible();
    
    const debtAmount = groupDetailPage.getDebtAmountInBalanceSection("$100.00");
    await multiUserExpected(debtAmount).toBeVisible();
    
    await multiUserExpected(page.getByText('Large User1 Payment')).toBeVisible();
    await multiUserExpected(page.getByText('Small User2 Payment')).toBeVisible();
  });
  
  multiUserTest('should transition from settled to debt to settled predictably', async ({ authenticatedPage, groupDetailPage, secondUser }, testInfo) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    await groupWorkflow.createGroup(`State Transition Test ${uniqueId}`, 'Testing state transitions');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    
    // State 1: Empty group → ALWAYS settled up
    await multiUserExpected(page.getByText('All settled up!')).toBeVisible();
    
    // State 2: User1 pays $100 → User2 MUST owe $50
    await groupDetailPage.addExpense({
      description: 'Create Debt',
      amount: 100,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    await multiUserExpected(page.getByText(`${user2.displayName} owes ${user1.displayName}`)).toBeVisible();
    await multiUserExpected(page.getByText('$50.00')).toBeVisible();
    
    // State 3: User2 pays $100 → MUST be settled up
    await groupDetailPage.addExpense({
      description: 'Balance Debt',
      amount: 100,
      paidBy: user2.displayName,
      splitType: 'equal'
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Guaranteed settled up: both paid $100
    await multiUserExpected(page.getByText('All settled up!')).toBeVisible();
    
    await multiUserExpected(page.getByText('Create Debt')).toBeVisible();
    await multiUserExpected(page.getByText('Balance Debt')).toBeVisible();
  });
  
  multiUserTest('should handle currency formatting in debt amounts', async ({ authenticatedPage, groupDetailPage, secondUser }, testInfo) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    await groupWorkflow.createGroup(`Currency Format Test ${uniqueId}`, 'Testing currency formatting');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // User1 pays $123.45 → User2 owes exactly $61.73 (or $61.72 depending on rounding)
    await groupDetailPage.addExpense({
      description: 'Currency Test',
      amount: 123.45,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    const debtMessage = page.getByText(`${user2.displayName} owes ${user1.displayName}`);
    await multiUserExpected(debtMessage).toBeVisible();
    
    // Allow for rounding: $123.45 / 2 could be $61.72 or $61.73
    const balancesSection = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Balances" }) });
    const formattedAmount = balancesSection.getByText(/\$61\.7[23]/);
    await multiUserExpected(formattedAmount).toBeVisible();
    
    await multiUserExpected(page.getByText('$123.45')).toBeVisible();
  });
});

multiUserTest.describe('Balance with Settlement Calculations', () => {
  multiUserTest('should update debt correctly after partial settlement', async ({ authenticatedPage, groupDetailPage, secondUser }, testInfo) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    await groupWorkflow.createGroup(`Partial Settlement Test ${uniqueId}`, 'Testing partial settlements');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Create known debt: User1 pays $200 → User2 owes $100
    const scenarios = new BalanceTestScenarios(page, groupDetailPage, user1, user2);
    await scenarios.createDebtScenario(200, user1);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify initial debt: $100
    await multiUserExpected(page.getByText(`${user2.displayName} owes ${user1.displayName}`)).toBeVisible();
    await multiUserExpected(page.getByText('$100.00')).toBeVisible();
    
    // User2 pays User1 $60 → Remaining debt = $40
    const settleButton = page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    const modal = page.getByRole('dialog');
    await multiUserExpected(modal).toBeVisible();
    
    const payerSelect = page.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = page.getByRole('combobox', { name: /who received the payment/i });
    const amountInput = page.getByRole('spinbutton', { name: /amount/i });
    
    await payerSelect.selectOption({ index: 2 }); // user2
    await payeeSelect.selectOption({ index: 1 }); // user1  
    await amountInput.fill('60');
    
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await submitButton.click();
    
    await multiUserExpected(modal).not.toBeVisible();
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    // Predictable: $100 - $60 = $40 remaining
    await multiUserExpected(page.getByText(`${user2.displayName} owes ${user1.displayName}`)).toBeVisible();
    await multiUserExpected(page.getByText('$40.00')).toBeVisible();
  });

  multiUserTest('should show settled up after exact settlement', async ({ authenticatedPage, groupDetailPage, secondUser }, testInfo) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
    await groupWorkflow.createGroup(`Exact Settlement Test ${uniqueId}`, 'Testing exact settlements');
    await multiUserExpected(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Create known debt: User1 pays $150 → User2 owes $75
    const scenarios = new BalanceTestScenarios(page, groupDetailPage, user1, user2);
    await scenarios.createDebtScenario(150, user1);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify initial debt: $75
    await multiUserExpected(page.getByText(`${user2.displayName} owes ${user1.displayName}`)).toBeVisible();
    await multiUserExpected(page.getByText('$75.00')).toBeVisible();
    
    // User2 pays User1 exactly $75 → MUST be settled up
    const settleButton = page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    const modal = page.getByRole('dialog');
    await multiUserExpected(modal).toBeVisible();
    
    const payerSelect = page.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = page.getByRole('combobox', { name: /who received the payment/i });
    const amountInput = page.getByRole('spinbutton', { name: /amount/i });
    
    await payerSelect.selectOption({ index: 2 }); // user2
    await payeeSelect.selectOption({ index: 1 }); // user1
    await amountInput.fill('75');
    
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await submitButton.click();
    
    await multiUserExpected(modal).not.toBeVisible();
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const balancesHeading = page.getByRole('heading', { name: 'Balances' });
    await multiUserExpected(balancesHeading).toBeVisible();
    
    // Guaranteed settled up: $75 - $75 = $0
    const settledUpMessage = page.getByText('All settled up!');
    await multiUserExpected(settledUpMessage).toBeVisible();
  });
});
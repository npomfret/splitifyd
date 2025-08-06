import { expect } from '@playwright/test';
import { BasePage } from './base.page';

interface ExpenseData {
  description: string;
  amount: number;
  paidBy: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants?: string[]; // Optional: if not provided, selects all members
}

export class GroupDetailPage extends BasePage {
  // Element accessors for group information
  getGroupTitle() {
    return this.page.getByRole('heading').first();
  }

  getGroupTitleByName(name: string) {
    return this.page.getByRole('heading', { name });
  }

  getGroupTextByName(name: string) {
    return this.page.getByText(name);
  }

  getGroupDescription() {
    return this.page.getByText(/test|description/i).first();
  }

  getMembersCount() {
    return this.page.getByText(/\d+ member/i);
  }

  getBalancesHeading() {
    return this.page.getByRole('heading', { name: /balances/i });
  }

  // Element accessors for expenses
  getAddExpenseButton() {
    return this.page.getByRole('button', { name: /add expense/i });
  }

  getNoExpensesMessage() {
    return this.page.getByText(/no expenses yet/i);
  }

  getExpenseByDescription(description: string) {
    return this.page.getByText(description);
  }

  getExpenseAmount(amount: string) {
    return this.page.getByText(amount);
  }

  // Element accessors for expense form
  getExpenseDescriptionField() {
    return this.page.getByPlaceholder('What was this expense for?');
  }

  getExpenseAmountField() {
    return this.page.getByPlaceholder('0.00');
  }

  getCategorySelect() {
    return this.page.getByRole('combobox').first();
  }

  getSaveExpenseButton() {
    return this.page.getByRole('button', { name: /save expense/i });
  }

  // Split type accessors
  getSplitSection() {
    return this.page.locator('text=Split between').locator('..');
  }

  getEqualRadio() {
    return this.page.getByRole('radio', { name: 'Equal' });
  }

  getExactAmountsRadio() {
    return this.page.getByRole('radio', { name: 'Exact amounts' });
  }

  getPercentageRadio() {
    return this.page.getByRole('radio', { name: 'Percentage' });
  }

  getExactAmountsText() {
    return this.page.getByText('Exact amounts');
  }

  getPercentageText() {
    return this.page.getByText('Percentage', { exact: true });
  }

  getEqualText() {
    return this.page.getByText('Equal');
  }

  getExactAmountsInstructions() {
    return this.page.getByText('Enter exact amounts for each person:');
  }

  getPercentageInstructions() {
    return this.page.getByText('Enter percentage for each person:');
  }

  getExactAmountInput() {
    return this.page.locator('input[type="number"][step="0.01"]').first();
  }

  getPercentageInput() {
    return this.page.locator('input[type="number"][max="100"]').first();
  }

  // Share functionality accessors
  getShareButton() {
    return this.page.getByRole('button', { name: /share/i });
  }

  getShareModal() {
    return this.page.getByRole('dialog', { name: /share group/i });
  }

  getShareLinkInput() {
    return this.getShareModal().getByRole('textbox');
  }

  getJoinGroupHeading() {
    return this.page.getByRole('heading', { name: 'Join Group' });
  }

  getJoinGroupButton() {
    return this.page.getByRole('button', { name: 'Join Group' });
  }

  // User-related accessors
  getUserName(displayName: string) {
    return this.page.getByText(displayName).first();
  }

  // CONTEXT-SPECIFIC SELECTORS TO FIX STRICT MODE VIOLATIONS
  
  /**
   * Gets debt amount specifically from the balance/debt summary section.
   * This avoids strict mode violations when the same amount appears in expense history.
   */
  getDebtAmountInBalanceSection(amount: string) {
    // Look for the debt amount within the context of the balances section
    const balancesSection = this.page.locator('section, div').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    });
    return balancesSection.getByText(amount).first();
  }

  /**
   * Gets expense amount specifically from the expense history section.
   * This avoids confusion with debt amounts in balance section.
   */
  getExpenseAmountInHistorySection(amount: string) {
    // Look for the expense amount within the context of the expenses/history section
    const expensesSection = this.page.locator('section, div').filter({ 
      has: this.page.getByRole('heading', { name: /expenses|history/i }) 
    });
    return expensesSection.getByText(amount).first();
  }

  /**
   * Gets a specific debt message in the balance section (e.g., "User A owes User B")
   */
  getDebtMessageInBalanceSection(debtorName: string, creditorName: string) {
    const balancesSection = this.page.locator('section, div').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    });
    return balancesSection.getByText(`${debtorName} owes ${creditorName}`).first();
  }

  /**
   * Gets the "All settled up!" message specifically from balance section
   */
  getSettledUpMessageInBalanceSection() {
    const balancesSection = this.page.locator('section, div').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    });
    return balancesSection.getByText('All settled up!');
  }

  /**
   * Gets group name/title from the specific header context, accounting for dynamic names
   */
  getGroupNameInHeader() {
    // Get the actual group title from the header, not a hardcoded expectation
    return this.page.getByRole('heading').first();
  }

  /**
   * Waits for and gets a group name that matches a pattern (for dynamic names)
   */
  async getGroupNameContaining(pattern: string) {
    // Wait for any heading that contains the pattern
    const heading = this.page.getByRole('heading').filter({ hasText: new RegExp(pattern, 'i') }).first();
    await expect(heading).toBeVisible();
    return heading;
  }

  async waitForBalanceUpdate(): Promise<void> {
    // Wait for the balance section to be stable
    const balanceSection = this.page.getByRole('heading', { name: 'Balances' }).locator('..');
    await expect(balanceSection).toBeVisible();
    
    // Wait for network requests to complete
    await this.page.waitForLoadState('networkidle');
  }

  async addExpense(expense: ExpenseData): Promise<void> {
    // Wait for add expense button to be available and click it
    const addExpenseButton = this.getAddExpenseButton();
    await expect(addExpenseButton).toBeVisible();
    await addExpenseButton.click();
    
    // Wait for navigation to add expense page
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for form to be fully loaded
    await this.page.waitForLoadState('networkidle');
    const descriptionField = this.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible();
    
    // Wait for all form sections to be loaded
    await expect(this.page.getByRole('heading', { name: 'Expense Details' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: /Who paid/ })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: /Split between/ })).toBeVisible();
    
    // Fill expense form
    await this.fillPreactInput(descriptionField, expense.description);
    
    const amountField = this.getExpenseAmountField();
    await this.fillNumericInput(amountField, expense.amount.toString());
    
    // Handle paidBy field - select who paid for the expense
    // The "Who paid?" section uses radio buttons inside label elements
    // Structure: <label><input type="radio" name="paidBy"/><Avatar/><span>{displayName}</span></label>
    
    // For pool users, match by the prewarm index since names are long and dynamic
    // Pool users have format: "Pool User 123456789-xxxx-xxxx-prewarm-0"
    const payerLabel = expense.paidBy.includes('prewarm-0')
      ? this.page.locator('label').filter({
          has: this.page.locator('input[type="radio"][name="paidBy"]')
        }).nth(0)
      : expense.paidBy.includes('prewarm-1')
      ? this.page.locator('label').filter({
          has: this.page.locator('input[type="radio"][name="paidBy"]')
        }).nth(1)
      : this.page.locator('label').filter({
          has: this.page.locator('input[type="radio"][name="paidBy"]')
        }).filter({
          hasText: expense.paidBy
        }).first();
    
    await expect(payerLabel).toBeVisible();
    await payerLabel.click();
    
    // CRITICAL: Select participants (who is involved in the split)
    // By default in the UI, all members are selected, but in tests we need to ensure this
    // Always click "Select all" to ensure deterministic state
    const selectAllButton = this.page.getByRole('button', { name: 'Select all' });
    await expect(selectAllButton).toBeVisible();
    await selectAllButton.click();
    
    // Submit form
    const submitButton = this.getSaveExpenseButton();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    
    // Wait for navigation back to group page
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Verify expense was created by checking it appears in the list
    await expect(this.page.getByText(expense.description)).toBeVisible();
    
    // Wait for balance calculation to complete
    await this.page.waitForLoadState('networkidle');
  }
}

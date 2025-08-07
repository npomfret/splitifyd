import { expect, Locator } from '@playwright/test';
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

  getCategoryInput() {
    return this.page.getByRole('combobox').first();
  }

  getCategorySuggestion(text: string) {
    return this.page.getByRole('option', { name: new RegExp(text, 'i') });
  }

  async selectCategoryFromSuggestions(categoryText: string) {
    const categoryInput = this.getCategoryInput();
    await categoryInput.focus();
    await this.page.waitForSelector('[role="listbox"]');
    const suggestion = this.getCategorySuggestion(categoryText);
    await suggestion.click();
  }

  async typeCategoryText(text: string) {
    const categoryInput = this.getCategoryInput();
    await categoryInput.fill(text);
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

  /**
   * Waits for the group to have the expected number of members
   */
  async waitForMemberCount(expectedCount: number, timeout = 10000): Promise<void> {
    await expect(this.page.getByText(`${expectedCount} member${expectedCount !== 1 ? 's' : ''}`))
      .toBeVisible({ timeout });
  }

  /**
   * Waits for both users to be properly synchronized in the group
   */
  async waitForUserSynchronization(user1Name: string, user2Name: string): Promise<void> {
    // Wait for member count to be 2
    await this.waitForMemberCount(2);
    
    // Verify both users are visible in the group
    await expect(this.page.getByText(user1Name).first()).toBeVisible();
    await expect(this.page.getByText(user2Name).first()).toBeVisible();
    
    // Wait for any async operations to complete
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Enhanced method to wait for balance updates with proper timing
   */
  async waitForBalanceCalculation(): Promise<void> {
    // More specific locator to avoid strict mode violation
    const balancesSection = this.page.locator('.bg-white').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    // Wait for balances section to be visible
    await expect(balancesSection).toBeVisible();
    
    // Wait for loading to disappear
    await expect(balancesSection.getByText('Loading balances...')).not.toBeVisible({ timeout: 1000 });
    
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Reliably get debt amount from balance section
   */
  async getDebtAmount(): Promise<string> {
    await this.waitForBalanceCalculation();
    
    const debtElement = this.page.locator('.text-red-600').first();
    await expect(debtElement).toBeVisible();
    
    const debtText = await debtElement.textContent();
    return debtText?.replace(/[$,]/g, '') || '0';
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
    
    // Find the payer label by looking for the display name text
    const payerLabel = this.page.locator('label').filter({
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

  /**
   * Enhanced settlement form handling for reliable settlement recording
   */
  async recordSettlement(options: {
    payerIndex: number;  // 1-based index in dropdown
    payeeIndex: number;  // 1-based index in dropdown
    amount: string;
    note: string;
  }): Promise<void> {
    // Click settle up button
    const settleButton = this.page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    // Wait for modal
    const modal = this.page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Fill form with more reliable selectors
    const payerSelect = modal.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = modal.getByRole('combobox', { name: /who received the payment/i });
    const amountInput = modal.getByRole('spinbutton', { name: /amount/i });
    const noteInput = modal.getByRole('textbox', { name: /note/i });
    
    // Make selections
    await payerSelect.selectOption({ index: options.payerIndex });
    await payeeSelect.selectOption({ index: options.payeeIndex });
    await this.fillNumericInput(amountInput, options.amount);
    await this.fillPreactInput(noteInput, options.note);
    
    // Submit
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    
    // Wait for modal to close
    await expect(modal).not.toBeVisible();
    
    // Wait for settlement to be processed
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Helper method to wait for dropdown options to be populated with user data
   */
  private async waitForDropdownOptions(selectElement: Locator, minOptions = 2, timeout = 250): Promise<void> {
    await expect(async () => {
      const options = await selectElement.locator('option').all();
      const validOptions = [];
      
      for (const option of options) {
        const value = await option.getAttribute('value');
        const text = await option.textContent();
        // Skip empty or placeholder options
        if (value && value !== '' && text && text.trim() !== 'Select...' && text.trim() !== '') {
          validOptions.push(option);
        }
      }
      
      if (validOptions.length < minOptions) {
        throw new Error(`Expected at least ${minOptions} valid options, but found ${validOptions.length}`);
      }
    }).toPass({ timeout });
  }

  /**
   * Helper method to wait for payee dropdown to update after payer selection
   */
  private async waitForPayeeDropdownUpdate(payeeSelect: Locator, payerName: string, timeout = 250): Promise<void> {
    await expect(async () => {
      const options = await payeeSelect.locator('option').all();
      let hasValidPayeeOptions = false;
      
      for (const option of options) {
        const value = await option.getAttribute('value');
        const text = await option.textContent();
        // Check if we have valid options that are not the payer and not placeholder
        if (value && value !== '' && text && text.trim() !== 'Select...' && 
            text.trim() !== '' && !text.includes(payerName)) {
          hasValidPayeeOptions = true;
          break;
        }
      }
      
      if (!hasValidPayeeOptions) {
        throw new Error(`Payee dropdown has not updated with valid options after selecting payer: ${payerName}`);
      }
    }).toPass({ timeout });
  }

  /**
   * Synchronize group state across multiple users by refreshing pages and waiting for updates.
   * This replaces manual reload() calls scattered throughout multi-user tests.
   */
  async synchronizeMultiUserState(pages: Array<{ page: any; groupDetailPage: any }>, expectedMemberCount?: number): Promise<void> {
    // Refresh all pages to get latest state
    for (const { page } of pages) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    
    // If member count is specified, wait for all pages to show correct count
    if (expectedMemberCount) {
      for (const { groupDetailPage } of pages) {
        await groupDetailPage.waitForMemberCount(expectedMemberCount);
      }
    }
    
    // Additional wait for balance calculations to complete
    for (const { groupDetailPage } of pages) {
      await groupDetailPage.waitForBalanceCalculation();
    }
  }

  /**
   * Record settlement by user display name - more reliable than index-based selection
   */
  async recordSettlementByUser(options: {
    payerName: string;  // Display name of who paid
    payeeName: string;  // Display name of who received payment
    amount: string;
    note: string;
  }): Promise<void> {
    // Click settle up button
    const settleButton = this.page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    // Wait for modal
    const modal = this.page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Fill form with display name-based selection
    const payerSelect = modal.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = modal.getByRole('combobox', { name: /who received the payment/i });
    const amountInput = modal.getByRole('spinbutton', { name: /amount/i });
    const noteInput = modal.getByRole('textbox', { name: /note/i });
    
    // Wait for payer dropdown to be populated with user data
    await this.waitForDropdownOptions(payerSelect);
    
    // Select by display name text - more reliable than value since we don't have real Firebase UIDs
    // Find options that contain the display names
    const payerOptions = await payerSelect.locator('option').all();
    let payerValue = '';
    for (const option of payerOptions) {
      const text = await option.textContent();
      const value = await option.getAttribute('value');
      if (text && text.includes(options.payerName)) {
        payerValue = value || '';
        break;
      }
    }
    
    if (!payerValue) {
      throw new Error(`Could not find payer in dropdown. Looking for: ${options.payerName}`);
    }
    
    await payerSelect.selectOption(payerValue);
    
    // Wait for payee dropdown to update dynamically after payer selection
    await this.waitForPayeeDropdownUpdate(payeeSelect, options.payerName);
    
    const payeeOptions = await payeeSelect.locator('option').all();
    let payeeValue = '';
    for (const option of payeeOptions) {
      const text = await option.textContent();
      const value = await option.getAttribute('value');
      if (text && text.includes(options.payeeName)) {
        payeeValue = value || '';
        break;
      }
    }
    
    if (!payeeValue) {
      throw new Error(`Could not find payee in dropdown. Looking for: ${options.payeeName}`);
    }
    
    await payeeSelect.selectOption(payeeValue);
    await this.fillNumericInput(amountInput, options.amount);
    await this.fillPreactInput(noteInput, options.note);
    
    // Submit
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    
    // Wait for modal to close
    await expect(modal).not.toBeVisible();
    
    // Wait for settlement to be processed
    await this.page.waitForLoadState('networkidle');
  }
}

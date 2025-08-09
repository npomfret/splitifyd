import { expect, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { HEADINGS, BUTTON_TEXTS, MESSAGES, FORM_LABELS, ARIA_ROLES } from '../constants/selectors';

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
    await this.fillPreactInput(categoryInput, text);
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
   * Gets a specific debt message in the balance section
   * UI now uses arrow notation: "User A → User B" instead of "owes"
   */
  getDebtMessageInBalanceSection(debtorName: string, creditorName: string) {
    const balancesSection = this.page.locator('section, div').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    });
    // Try both formats - arrow notation (new UI) and "owes" (legacy)
    return balancesSection.getByText(`${debtorName} → ${creditorName}`)
      .or(balancesSection.getByText(`${debtorName} owes ${creditorName}`))
      .first();
  }

  /**
   * Gets the "All settled up!" message specifically from balance section
   */
  getSettledUpMessageInBalanceSection() {
    const balancesSection = this.page.locator('section, div').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    });
    // Use .first() to get the first occurrence since there might be multiple
    return balancesSection.getByText('All settled up!').first();
  }

  /**
   * Checks if "All settled up!" exists in the balance section (regardless of visibility)
   * Use this when the balance section might be collapsed on mobile
   */
  async hasSettledUpMessage(): Promise<boolean> {
    const count = await this.page.getByText('All settled up!').count();
    return count > 0;
  }

  /**
   * Checks if debt message exists in the DOM (regardless of visibility)
   * Use this when the balance section might be collapsed on mobile
   */
  async hasDebtMessage(debtorName: string, creditorName: string): Promise<boolean> {
    // Check for arrow notation (new UI)
    const arrowCount = await this.page.getByText(`${debtorName} → ${creditorName}`).count();
    if (arrowCount > 0) return true;
    
    // Fallback to "owes" notation (legacy)
    const owesCount = await this.page.getByText(`${debtorName} owes ${creditorName}`).count();
    return owesCount > 0;
  }

  /**
   * Checks if debt amount exists in the DOM (regardless of visibility)
   * Use this when checking for amounts that might be in hidden sections
   */
  async hasDebtAmount(amount: string): Promise<boolean> {
    // Look for the amount in red text (debt indicator) or as general text
    const redTextCount = await this.page.locator('.text-red-600').filter({ hasText: amount }).count();
    if (redTextCount > 0) return true;
    
    // Also check if the amount exists as regular text (in case styling changed)
    const textCount = await this.page.getByText(amount).count();
    return textCount > 0;
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
   * Waits for the group to have the expected number of members.
   * Tests the current value, refreshes if incorrect, repeats until it matches or times out.
   */
  async waitForMemberCount(expectedCount: number, timeout = 5000): Promise<void> {
    const startTime = Date.now();
    const expectedText = `${expectedCount} member${expectedCount !== 1 ? 's' : ''}`;
    
    while (Date.now() - startTime < timeout) {
      try {
        // Check if the expected member count is already visible
        const memberCountElement = this.page.getByText(expectedText);
        const isVisible = await memberCountElement.isVisible();
        
        if (isVisible) {
          // Success! The count matches
          return;
        }
      } catch (error) {
        // Element not found, continue to refresh
      }
      
      // The count doesn't match, refresh the page
      await this.page.reload();
      await this.page.waitForLoadState('networkidle');
    }
    
    // Final attempt - throw error if still not matching after timeout
    await expect(this.page.getByText(expectedText))
      .toBeVisible({ timeout: 1000 });
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
    await this.fillPreactInput(amountField, expense.amount.toString());
    
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
   * Verify that settlement appears in history for all provided pages
   */
  async verifySettlementInHistory(pages: Array<{ page: any }>, settlementNote: string): Promise<void> {
    for (const { page } of pages) {
      const showHistoryButton = page.getByRole('button', { name: 'Show History' });
      await showHistoryButton.click();
      await expect(page.getByText(new RegExp(settlementNote, 'i'))).toBeVisible();
      await page.keyboard.press('Escape');
    }
  }

  /**
   * Verify debt amount in balance section across multiple pages
   */
  async verifyDebtAcrossPages(pages: Array<{ page: any; groupDetailPage: any }>, debtorName: string, creditorName: string, amount?: string): Promise<void> {
    for (const { page } of pages) {
      const balancesSection = page.locator('.bg-white').filter({ 
        has: page.getByRole('heading', { name: 'Balances' }) 
      }).first();
      
      // UI now uses arrow notation: "User A → User B" instead of "owes"
      const debtText = balancesSection.getByText(`${debtorName} → ${creditorName}`)
        .or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
      await expect(debtText).toBeVisible();
      
      if (amount) {
        // Find the debt amount that's specifically associated with this debt relationship
        // Look for the amount within the same container as the debt message
        const debtRow = balancesSection.locator('div').filter({ 
          hasText: new RegExp(`${debtorName}.*→.*${creditorName}|${debtorName}.*owes.*${creditorName}`) 
        });
        await expect(debtRow.locator('.text-red-600').filter({ hasText: amount }).first()).toBeVisible();
      }
    }
  }

  /**
   * Verify expense appears on all provided pages
   */
  async verifyExpenseAcrossPages(pages: Array<{ page: any }>, expenseDescription: string, expenseAmount?: string): Promise<void> {
    for (const { page } of pages) {
      await expect(page.getByText(expenseDescription)).toBeVisible();
      if (expenseAmount) {
        await expect(page.getByText(expenseAmount)).toBeVisible();
      }
    }
  }

  /**
   * Create expense and synchronize across multiple users
   */
  async addExpenseAndSync(
    expense: ExpenseData, 
    pages: Array<{ page: any; groupDetailPage: any }>,
    expectedMemberCount?: number
  ): Promise<void> {
    await this.addExpense(expense);
    await this.synchronizeMultiUserState(pages, expectedMemberCount);
  }

  /**
   * Record settlement and synchronize across multiple users
   */
  async recordSettlementAndSync(
    settlementOptions: {
      payerName: string;
      payeeName: string; 
      amount: string;
      note: string;
    },
    pages: Array<{ page: any; groupDetailPage: any }>
  ): Promise<void> {
    await this.recordSettlementByUser(settlementOptions);
    await this.synchronizeMultiUserState(pages);
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
    await this.fillPreactInput(amountInput, options.amount);
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
   * New getter methods using centralized constants
   */
  
  // Headings
  getExpensesHeading() {
    return this.page.getByRole(ARIA_ROLES.HEADING, { name: HEADINGS.EXPENSES });
  }

  // Buttons
  getSettleUpButton() {
    return this.page.getByRole(ARIA_ROLES.BUTTON, { name: BUTTON_TEXTS.SETTLE_UP });
  }

  getShowHistoryButton() {
    return this.page.getByRole(ARIA_ROLES.BUTTON, { name: BUTTON_TEXTS.SHOW_HISTORY });
  }

  getSelectAllButton() {
    return this.page.getByRole(ARIA_ROLES.BUTTON, { name: BUTTON_TEXTS.SELECT_ALL });
  }

  getRecordPaymentButton() {
    return this.page.getByRole(ARIA_ROLES.BUTTON, { name: BUTTON_TEXTS.RECORD_PAYMENT });
  }

  // Modal and form elements
  getSettlementModal() {
    return this.page.getByRole(ARIA_ROLES.DIALOG);
  }

  getSettlementAmountInput() {
    return this.page.getByRole('spinbutton', { name: FORM_LABELS.AMOUNT });
  }

  getPayerSelect() {
    return this.page.getByRole(ARIA_ROLES.COMBOBOX, { name: FORM_LABELS.WHO_PAID });
  }

  getPayeeSelect() {
    return this.page.getByRole(ARIA_ROLES.COMBOBOX, { name: FORM_LABELS.WHO_RECEIVED_PAYMENT });
  }

  getNoteInput() {
    return this.page.getByRole(ARIA_ROLES.TEXTBOX, { name: FORM_LABELS.NOTE });
  }

  // Messages
  getSettledUpMessage() {
    return this.page.getByText(MESSAGES.ALL_SETTLED_UP);
  }

  getNoExpensesText() {
    return this.page.getByText(MESSAGES.NO_EXPENSES_YET);
  }

  getLoadingBalancesText() {
    return this.page.getByText(MESSAGES.LOADING_BALANCES);
  }

  // Utility method for member count
  getMemberCountText(count: number) {
    const memberText = count === 1 ? 'member' : 'members';
    return this.page.getByText(`${count} ${memberText}`);
  }

  // Utility method for currency amounts
  getCurrencyAmount(amount: string) {
    return this.page.getByText(`$${amount}`);
  }

  // Utility method for debt messages
  getDebtMessage(debtorName: string, creditorName: string) {
    // UI now uses arrow notation: "User A → User B" instead of "owes"
    // On desktop (lg breakpoint), balance is shown in sidebar
    // On mobile, it's shown in main content but hidden on desktop with lg:hidden
    // We need to find ALL instances and filter for the visible one
    const debtText = `${debtorName} → ${creditorName}`;
    const legacyText = `${debtorName} owes ${creditorName}`;
    
    // Look for all instances of the debt text
    return this.page.getByText(debtText).or(this.page.getByText(legacyText));
  }

  /**
   * Shares the group and waits for another user to join.
   * This encapsulates the entire share/join flow to avoid code duplication.
   * 
   * @param joinerPage - The Page object for the user who will join the group
   * @returns The share link URL
   */
  async shareGroupAndWaitForJoin(joinerPage: any): Promise<string> {
    // Click share button and get the share link
    await this.getShareButton().click();
    const shareLink = await this.getShareLinkInput().inputValue();
    
    // Close the share modal
    await this.page.keyboard.press('Escape');
    
    // Have the second user navigate to share link and join
    await joinerPage.goto(shareLink);
    await joinerPage.getByRole('button', { name: /join group/i }).click();
    await joinerPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Refresh the original page to see updated members
    await this.page.reload();
    
    return shareLink;
  }

  // ==============================
  // ADDITIONAL METHODS TO FIX SELECTOR VIOLATIONS
  // ==============================

  /**
   * Gets the "Split between" text element
   * Used in advanced-splitting tests
   */
  getSplitBetweenText() {
    return this.page.getByText('Split between');
  }

  /**
   * Gets the balances section using the complex locator
   * This replaces repeated complex locator chains in tests
   */
  getBalancesSection() {
    return this.page.locator('.bg-white').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    }).first();
  }

  /**
   * Gets a user display button by display name
   * Replaces direct getByRole calls in tests
   */
  getUserDisplayButton(displayName: string) {
    return this.page.getByRole('button', { name: displayName });
  }

  /**
   * Gets any text element - centralizes getByText calls
   */
  getTextElement(text: string | RegExp) {
    return this.page.getByText(text);
  }

  /**
   * Gets the delete button for an expense
   */
  getExpenseDeleteButton() {
    return this.page.getByRole('button', { name: /delete/i });
  }

  /**
   * Gets the confirmation delete button (second delete button in dialog)
   */
  getDeleteConfirmButton() {
    return this.page.getByRole('button', { name: 'Delete' }).nth(1);
  }

  /**
   * Clicks on an expense by its description to view details
   */
  async clickExpenseToView(description: string) {
    const expense = this.getExpenseByDescription(description);
    await expense.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Deletes an expense with confirmation
   */
  async deleteExpense() {
    const deleteButton = this.getExpenseDeleteButton();
    await deleteButton.click();
    
    // Confirm deletion
    const confirmButton = this.getDeleteConfirmButton();
    await confirmButton.click();
    
    // Wait for deletion to complete
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Gets the join group button on share link page
   * This is the most frequently violated selector
   */
  getJoinGroupButtonOnSharePage() {
    return this.page.getByRole('button', { name: /join group/i });
  }

  /**
   * Clicks the join group button and waits for navigation
   */
  async clickJoinGroup() {
    const joinButton = this.getJoinGroupButtonOnSharePage();
    await joinButton.click();
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
  }

  /**
   * Gets heading by exact or partial text match
   */
  getHeading(name: string | RegExp) {
    return this.page.getByRole('heading', { name });
  }

  /**
   * Gets the first visible heading (for dynamic group names)
   */
  getFirstHeading() {
    return this.page.getByRole('heading').first();
  }

  /**
   * Helper to check if expense is visible
   */
  async isExpenseVisible(description: string): Promise<boolean> {
    return await this.getExpenseByDescription(description).isVisible();
  }

  /**
   * Helper to check if text is visible
   */
  async isTextVisible(text: string | RegExp): Promise<boolean> {
    return await this.getTextElement(text).isVisible();
  }

  /**
   * Gets the show history button
   */
  getHistoryButton() {
    return this.page.getByRole('button', { name: 'Show History' });
  }

  /**
   * Opens the history modal
   */
  async openHistory() {
    const historyButton = this.getHistoryButton();
    await historyButton.click();
  }

  /**
   * Closes any open modal using Escape
   */
  async closeModal() {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Gets debt information from balances section
   */
  getDebtInfo(debtorName: string, creditorName: string) {
    const balancesSection = this.getBalancesSection();
    // UI now uses arrow notation: "User A → User B" instead of "owes"
    return balancesSection.getByText(`${debtorName} → ${creditorName}`)
      .or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
  }

  /**
   * Checks if users are settled up
   */
  async areUsersSettledUp(): Promise<boolean> {
    const balancesSection = this.getBalancesSection();
    const settledMessage = balancesSection.getByText('All settled up!');
    return await settledMessage.isVisible();
  }

  /**
   * Gets the admin badge element specifically.
   * This targets the small badge text, not the group heading or description.
   */
  getAdminBadge() {
    // Target the admin badge which is typically a small text element with specific styling
    // Use exact match and look for the element with the smallest font size (text-xs class)
    return this.page.locator('.text-xs').filter({ hasText: 'Admin' }).first();
  }

  // ==============================
  // ADDITIONAL METHODS FOR TEST REFACTORING
  // ==============================

  /**
   * Count all "All settled up!" elements in the DOM
   */
  async getAllSettledUpElementsCount(): Promise<number> {
    return await this.page.getByText('All settled up!').count();
  }

  /**
   * Get the main section of the page
   */
  getMainSection() {
    return this.page.getByRole('main');
  }

  /**
   * Get balances section with specific filter
   */
  getBalancesSectionByFilter() {
    return this.page.locator("section, div").filter({ 
      has: this.page.getByRole("heading", { name: "Balances" }) 
    });
  }

  /**
   * Get debt amount by regex pattern (e.g., for amounts with rounding variations)
   */
  getDebtAmountPattern(pattern: RegExp) {
    const balancesSection = this.getBalancesSectionByFilter();
    return balancesSection.getByText(pattern).first();
  }

  /**
   * Check if a debt amount matching a pattern exists in the DOM
   */
  async hasDebtAmountPattern(pattern: RegExp): Promise<boolean> {
    const count = await this.page.getByText(pattern).count();
    return count > 0;
  }

  /**
   * Get the amount input field (for expense or settlement forms)
   */
  getAmountInput() {
    return this.page.getByPlaceholder('0.00');
  }

  /**
   * Get the expense description input field
   */
  getDescriptionInput() {
    return this.page.getByPlaceholder('What was this expense for?');
  }

  /**
   * Get the settings button
   */
  getSettingsButton() {
    return this.page.getByRole('button', { name: /settings/i });
  }

  /**
   * Get the edit button
   */
  getEditButton() {
    return this.page.getByRole('button', { name: /edit/i });
  }

  /**
   * Get the update expense button
   */
  getUpdateExpenseButton() {
    return this.page.getByRole('button', { name: /update expense/i });
  }

  /**
   * Get the settle up button (already exists but adding for clarity)
   */
  getSettleUpButtonDirect() {
    return this.page.getByRole('button', { name: /settle up/i });
  }

  /**
   * Get the settlement dialog/modal
   */
  getSettlementDialog() {
    return this.page.getByRole('dialog');
  }

  /**
   * Get the settlement amount input (spinbutton)
   */
  getSettlementAmountSpinbutton() {
    return this.page.getByRole('spinbutton', { name: /amount/i });
  }

  /**
   * Get the currency combobox in settlement form
   */
  getCurrencyCombobox() {
    return this.page.getByRole('combobox', { name: /currency/i });
  }

  /**
   * Get the note textbox in settlement form
   */
  getNoteTextbox() {
    return this.page.getByRole('textbox', { name: /note/i });
  }

  /**
   * Wait for listbox (dropdown options) to appear
   */
  async waitForListbox(timeout = 5000) {
    await this.page.waitForSelector('[role="listbox"]', { timeout });
  }

  /**
   * Get all options in a listbox
   */
  async getListboxOptions() {
    return await this.page.locator('[role="option"]').all();
  }

  /**
   * Get a specific input by its minimum value attribute
   */
  getInputWithMinValue(minValue: string) {
    return this.page.locator(`input[type="number"][step="0.01"][min="${minValue}"]`);
  }

  /**
   * Get member count text by regex
   */
  getMemberCountByRegex(pattern: RegExp) {
    return this.page.getByText(pattern);
  }

  /**
   * Get the split between heading
   */
  getSplitBetweenHeading() {
    return this.page.getByRole('heading', { name: /split between/i });
  }

  /**
   * Get the split card (parent of split between heading)
   */
  async getSplitCard() {
    const heading = this.getSplitBetweenHeading();
    return heading.locator('..').locator('..');
  }

  /**
   * Get checkboxes within the split card
   */
  async getSplitCardCheckbox() {
    const splitCard = await this.getSplitCard();
    return splitCard.locator('input[type="checkbox"]').first();
  }

  /**
   * Get admin text element
   */
  getAdminText() {
    return this.page.getByText(/admin/i).first();
  }

  /**
   * Get share modal dialog
   */
  getShareModalDialog() {
    return this.page.getByRole('dialog', { name: /share group/i });
  }

  /**
   * Get textbox within share modal
   */
  async getShareModalTextbox() {
    const modal = this.getShareModalDialog();
    return modal.getByRole('textbox');
  }

  /**
   * Get exact amounts text element
   */
  getExactAmountsTextElement() {
    return this.page.getByText('Exact amounts');
  }

  /**
   * Get percentage text element (exact match)
   */
  getPercentageTextElement() {
    return this.page.getByText('Percentage', { exact: true });
  }

  /**
   * Get form element
   */
  getForm() {
    return this.page.locator('form');
  }

  /**
   * Get create group button within form context
   */
  getFormCreateGroupButton() {
    return this.getForm().getByRole('button', { name: 'Create Group' });
  }
}

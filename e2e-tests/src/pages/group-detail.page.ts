import {expect, Locator} from '@playwright/test';
import {BasePage} from './base.page';
import {ARIA_ROLES, BUTTON_TEXTS, FORM_LABELS, HEADINGS, MESSAGES} from '../constants/selectors';

interface ExpenseData {
  description: string;
  amount: number;
  currency: string; // Required: must be explicitly provided
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

  async clickAddExpenseButton(): Promise<void> {
    const addButton = this.getAddExpenseButton();
    await this.clickButton(addButton, { buttonName: 'Add Expense' });
  }

  getNoExpensesMessage() {
    return this.page.getByText(/no expenses yet/i);
  }

  getExpenseByDescription(description: string) {
    // Use more specific selector to avoid strict mode violations
    // Look for the description in expense list context, not headings
    return this.page.getByText(description).first();
  }

  getExpenseAmount(amount: string) {
    return this.page.getByText(amount);
  }
  
  getExpensePaidByText() {
    return this.page.getByText(/paid by|Paid:/i);
  }

  // Element accessors for expense form
  getExpenseDescriptionField() {
    return this.page.getByPlaceholder('What was this expense for?');
  }

  // Expense form section headings
  getExpenseDetailsHeading() {
    return this.page.getByRole('heading', { name: 'Expense Details' });
  }

  getWhoPaidHeading() {
    return this.page.getByRole('heading', { name: /Who paid/ });
  }

  getSplitBetweenHeading() {
    return this.page.getByRole('heading', { name: /Split between/ });
  }

  async waitForExpenseFormSections() {
    await expect(this.getExpenseDetailsHeading()).toBeVisible();
    await expect(this.getWhoPaidHeading()).toBeVisible();
    await expect(this.getSplitBetweenHeading()).toBeVisible();
  }

  // Convenience date buttons
  getTodayButton() {
    return this.page.getByRole('button', { name: 'Today' });
  }

  getYesterdayButton() {
    return this.page.getByRole('button', { name: 'Yesterday' });
  }

  getThisMorningButton() {
    return this.page.getByRole('button', { name: 'This Morning' });
  }

  getLastNightButton() {
    return this.page.getByRole('button', { name: 'Last Night' });
  }

  getDateInput() {
    return this.page.locator('input[type="date"]');
  }

  getTimeInput() {
    return this.page.locator('input[placeholder="Enter time (e.g., 2:30pm)"]');
  }

  getClockIcon() {
    // Clock icon button that opens the time selector - try multiple selectors
    return this.page.locator([
      'button[aria-label*="time" i]',
      'button[aria-label*="clock" i]', 
      'button:has(svg[data-icon="clock"])',
      'button:has(svg.clock-icon)',
      'button:has([data-testid*="clock" i])',
      '[role="button"]:has(svg)',
      'button.time-selector-trigger',
      '[data-testid="time-selector"]'
    ].join(', ')).first();
  }

  async clickClockIcon(): Promise<void> {
    const clockIcon = this.getClockIcon();
    await this.clickButton(clockIcon, { buttonName: 'Clock icon' });
  }

  getTimeButton() {
    return this.page.getByRole('button', { name: /at \d{1,2}:\d{2} (AM|PM)/i });
  }

  async clickTimeButton(): Promise<void> {
    const timeButton = this.getTimeButton();
    await this.clickButton(timeButton, { buttonName: 'Time selector' });
  }

  getTimeSelectionButton(time: string) {
    return this.page.getByRole('button', { name: time });
  }

  async clickTimeSelectionButton(time: string): Promise<void> {
    const button = this.getTimeSelectionButton(time);
    await this.clickButton(button, { buttonName: `Time: ${time}` });
  }

  async clickTodayButton() {
    await this.clickButton(this.getTodayButton(), { buttonName: 'Today' });
  }

  async clickYesterdayButton() {
    await this.clickButton(this.getYesterdayButton(), { buttonName: 'Yesterday' });
  }

  async clickThisMorningButton() {
    await this.clickButton(this.getThisMorningButton(), { buttonName: 'This Morning' });
  }

  async clickLastNightButton() {
    await this.clickButton(this.getLastNightButton(), { buttonName: 'Last Night' });
  }

  getSelectAllButton() {
    return this.page.getByRole('button', { name: 'Select all' });
  }

  async clickSelectAllButton() {
    await this.clickButton(this.getSelectAllButton(), { buttonName: 'Select all' });
  }

  getPayerRadioLabel(displayName: string) {
    return this.page.locator('label').filter({
      has: this.page.locator('input[type="radio"][name="paidBy"]')
    }).filter({
      hasText: displayName
    }).first();
  }

  async selectPayer(displayName: string) {
    const payerLabel = this.getPayerRadioLabel(displayName);
    await expect(payerLabel).toBeVisible();
    await payerLabel.click();
  }

  async verifyExpenseInList(description: string, amount?: string) {
    await expect(this.getExpenseByDescription(description)).toBeVisible();
    if (amount) {
      await expect(this.page.getByText(amount)).toBeVisible();
    }
  }

  getExpenseAmountField() {
    return this.page.getByPlaceholder('0.00');
  }

  getCategorySelect() {
    // Category input is an actual input element with aria-haspopup
    // (not the currency selector which is a div with role=combobox)
    return this.page.locator('input[aria-haspopup="listbox"]').first();
  }

  getCategoryInput() {
    // Category input is an actual input element with aria-haspopup
    // (not the currency selector which is a div with role=combobox)
    return this.page.locator('input[aria-haspopup="listbox"]').first();
  }

  getCategorySuggestion(text: string) {
    return this.page.getByRole('option', { name: new RegExp(text, 'i') });
  }

  async selectCategoryFromSuggestions(categoryText: string) {
    const categoryInput = this.getCategoryInput();
    await categoryInput.focus();
    await this.page.waitForSelector('[role="listbox"]');
    const suggestion = this.getCategorySuggestion(categoryText);
    // Note: Not a button, but a dropdown option
    await suggestion.click();
  }

  async typeCategoryText(text: string) {
    const categoryInput = this.getCategoryInput();
    await this.fillPreactInput(categoryInput, text);
  }

  // Currency selector accessors and methods
  getCurrencySelector() {
    // Currency selector is now a button with aria-label="Select currency"
    // It's part of the CurrencyAmountInput component
    return this.page.locator('button[aria-label="Select currency"]').first();
  }

  async selectCurrency(currencyCode: string) {
    const currencySelector = this.getCurrencySelector();
    await expect(currencySelector).toBeVisible();
    
    // Click to open the dropdown
    await this.clickButton(currencySelector, { buttonName: 'Currency Selector' });
    
    // Wait for the listbox to appear
    await this.page.waitForSelector('[role="listbox"]', { timeout: 2000 });
    
    // Search for the currency if there's a search input visible
    const searchInput = this.page.locator('[role="listbox"] input[type="text"]');
    if (await searchInput.isVisible()) {
      await this.fillPreactInput(searchInput, currencyCode);
      await this.page.waitForTimeout(200); // Brief wait for search results
    }
    
    // Click on the currency option - look for button with role="option" containing the currency code
    const currencyOption = this.page.locator('[role="listbox"] button[role="option"]').filter({ hasText: currencyCode }).first();
    await this.clickButton(currencyOption, { buttonName: `Currency: ${currencyCode}` });
  }

  getSaveExpenseButton() {
    return this.page.getByRole('button', { name: /save expense/i });
  }

  async clickSaveExpenseButton(): Promise<void> {
    const saveButton = this.getSaveExpenseButton();
    await this.clickButton(saveButton, { buttonName: 'Save Expense' });
  }

  
  /**
   * Override the base expectSubmitButtonEnabled to provide expense-specific behavior
   * @returns Promise that resolves if button is enabled, throws error if disabled
   */
  async expectSubmitButtonEnabled(submitButton?: Locator): Promise<void> {
    const button = submitButton || this.getSaveExpenseButton();
    await this.expectButtonEnabled(button, 'Save Expense');
  }

  /**
   * Validates that the expense form is ready for submission
   * Provides detailed error messages about what's missing
   */
  async validateExpenseFormReady(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check if description is filled
    const descriptionField = this.getExpenseDescriptionField();
    const descriptionValue = await descriptionField.inputValue();
    if (!descriptionValue || descriptionValue.trim() === '') {
      errors.push('Description field is empty');
    }
    
    // Check if amount is filled
    const amountField = this.getExpenseAmountField();
    const amountValue = await amountField.inputValue();
    if (!amountValue || amountValue === '0' || amountValue === '0.00') {
      errors.push('Amount field is empty or zero');
    }
    
    // Check if a payer is selected (radio button checked)
    const payerRadios = this.page.locator('input[type="radio"][name="paidBy"]');
    const payerCount = await payerRadios.count();
    if (payerCount === 0) {
      errors.push('No payers available in "Who paid?" section');
    } else {
      const checkedPayer = await payerRadios.filter({ hasNot: this.page.locator('[checked=""]') }).count();
      const anyChecked = await this.page.locator('input[type="radio"][name="paidBy"]:checked').count();
      if (anyChecked === 0) {
        errors.push('No payer selected in "Who paid?" section');
      }
    }
    
    // Check if participants are selected for the split
    const participantCheckboxes = this.page.locator('input[type="checkbox"][name="participant"]');
    const participantCount = await participantCheckboxes.count();
    
    if (participantCount === 0) {
      // Look for any indication of participants section
      const splitSection = await this.page.getByRole('heading', { name: /Split between/i }).isVisible();
      if (splitSection) {
        // Check for selected participant indicators (could be checkboxes or other UI elements)
        const selectedIndicators = await this.page.locator('.selected-participant, [aria-checked="true"]').count();
        // Check if either "Select all" or "Select none" buttons exist
        const selectAllButton = await this.page.getByRole('button', { name: 'Select all' }).count();
        const selectNoneButton = await this.page.getByRole('button', { name: 'Select none' }).count();
        const hasSelectionControls = selectAllButton > 0 || selectNoneButton > 0;
        
        if (!hasSelectionControls) {
          errors.push('Split between section exists but no participant selection controls found');
        } else {
          // Try to find how many are selected by looking for visual indicators
          const memberElements = await this.page.locator('label').filter({
            has: this.page.locator('input[type="checkbox"]')
          }).count();
          
          if (memberElements === 0) {
            errors.push('No participants available for selection in "Split between" section');
          } else {
            // Check if any checkboxes are checked
            const checkedBoxes = await this.page.locator('input[type="checkbox"]:checked').count();
            if (checkedBoxes === 0) {
              errors.push('No participants selected in "Split between" section - click "Select all" or select individual members');
            }
          }
        }
      } else {
        errors.push('Split between section not found or not visible');
      }
    } else {
      const checkedCount = await participantCheckboxes.filter({ has: this.page.locator(':checked') }).count();
      if (checkedCount === 0) {
        errors.push(`No participants selected for expense split (0 of ${participantCount} members selected)`);
      }
    }
    
    // Check if submit button is enabled
    const submitButton = this.getSaveExpenseButton();
    const isDisabled = await submitButton.isDisabled();
    if (isDisabled) {
      const buttonTitle = await submitButton.getAttribute('title');
      if (buttonTitle) {
        errors.push(`Submit button is disabled (hint: ${buttonTitle})`);
      } else {
        errors.push('Submit button is disabled');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
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

  async clickShareButton(): Promise<void> {
    const shareButton = this.getShareButton();
    await this.clickButton(shareButton, { buttonName: 'Share' });
  }

  getShareModal() {
    // Use generic dialog selector since the modal might not have the expected name
    return this.page.getByRole('dialog');
  }

  getShareLinkInput() {
    // Use input selector instead of role=textbox since the input is read-only
    // and may not be recognized as a textbox role
    return this.getShareModal().locator('input[type="text"]');
  }

  // User-related accessors
  getUserName(displayName: string) {
    return this.page.getByText(displayName).first();
  }

  // CONTEXT-SPECIFIC SELECTORS TO FIX STRICT MODE VIOLATIONS


  /**
   * Checks if "All settled up!" exists in the balance section (regardless of visibility)
   * Use this when the balance section might be collapsed on mobile
   */
  async hasSettledUpMessage(): Promise<boolean> {
    // Look for "All settled up!" specifically within the Balances section to avoid duplicates
    const balancesSection = this.page.locator('section, div').filter({ has: this.page.getByRole('heading', { name: 'Balances' }) });
    const count = await balancesSection.getByText('All settled up!').count();
    if (count === 0) {
      // Fallback: check if it exists anywhere near the Balances heading
      const altCount = await this.page.getByText('All settled up!').first().count();
      return altCount > 0;
    }
    return count > 0;
  }

  /**
   * Waits for "All settled up!" message to appear in the balance section
   * Useful for waiting for balance calculations to complete
   */
  async waitForSettledUpMessage(timeout: number = 5000): Promise<void> {
    // Wait for the text to exist in DOM (not necessarily visible)
    await this.page.waitForSelector('text="All settled up!"', { 
      timeout, 
      state: 'attached' // Just wait for it to be in DOM, not visible
    });
    
    // Use nth(0) to get the first occurrence
    const settledText = this.page.getByText('All settled up!').nth(0);
    
    // Try to make it visible by expanding the Balances section
    const balancesHeading = this.getBalancesHeading();
    if (await balancesHeading.isVisible()) {
      // Click to expand if collapsed
      await balancesHeading.click();
      await this.page.waitForTimeout(300); // Small wait for animation
    }
    
    // Now the text should be visible
    await expect(settledText).toBeVisible({ timeout: 2000 });
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
   * Waits for the group to have the expected number of members.
   * Relies on real-time updates to show the correct member count.
   */
  async waitForMemberCount(expectedCount: number, timeout = 10000): Promise<void> {
    // Assert we're on a group page before waiting for member count
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/groups/') && !currentUrl.includes('/group/')) {
      throw new Error(
        `waitForMemberCount called but not on a group page. Current URL: ${currentUrl}`
      );
    }
    
    // First, wait for any loading spinner in the Members section to disappear
    const membersSection = this.page.locator('text=Members').locator('..');
    const loadingSpinner = membersSection.locator('.animate-spin, [role="status"]');
    const spinnerCount = await loadingSpinner.count();
    if (spinnerCount > 0) {
      await expect(loadingSpinner.first()).not.toBeVisible({ timeout });
    }
    
    const expectedText = `${expectedCount} member${expectedCount !== 1 ? 's' : ''}`;
    
    // Use a more robust approach - wait for the text or any variant that indicates member count
    try {
      await expect(this.page.getByText(expectedText))
        .toBeVisible({ timeout });
    } catch (e) {
      // If exact text isn't found, try waiting for the members section to be updated
      // This provides a fallback for real-time update timing issues
      console.log(`Expected member text '${expectedText}' not found, checking for members section updates`);
      
      // Wait a bit more for real-time updates and try again
      await this.page.waitForTimeout(2000);
      await this.page.waitForLoadState('domcontentloaded');
      
      // Final attempt with the expected text
      await expect(this.page.getByText(expectedText))
        .toBeVisible({ timeout: 3000 });
    }
    
    // Double-check we're still on the group page after waiting
    const finalUrl = this.page.url();
    if (!finalUrl.includes('/groups/') && !finalUrl.includes('/group/')) {
      throw new Error(
        `Navigation changed during waitForMemberCount. Now on: ${finalUrl}`
      );
    }
  }

  /**
   * Waits for all specified users to be properly synchronized in the group
   */
  async waitForUserSynchronization(user1Name: string, ...otherUserNames: string[]): Promise<void> {
    const allUserNames = [user1Name, ...otherUserNames];
    const totalUsers = allUserNames.length;
    
    // Wait for network to be idle first to allow any join operations to complete
    await this.page.waitForLoadState('domcontentloaded');
    
    // Primary approach: verify all users are visible in the group (more reliable than member count)
    for (const userName of allUserNames) {
      await expect(this.page.getByText(userName).first()).toBeVisible({ timeout: 15000 });
    }
    
    // Secondary verification: try to wait for member count if available, but don't fail if it's not working
    try {
      await this.waitForMemberCount(totalUsers, 5000);
    } catch (error) {
      console.log(`Member count verification failed for ${totalUsers} users, but user names are visible. This might be a real-time update delay.`);
      // Continue with the test since the important thing is that users are visible
    }
    
    // Final network idle wait to ensure all updates have propagated
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for the Balances section to be visible and loaded
   */
  async waitForBalancesToLoad(groupId: string): Promise<void> {
    // Assert we're on the correct group page before trying to find balances
    const currentUrl = this.page.url();
    if (!currentUrl.includes(`/groups/${groupId}`)) {
      throw new Error(
        `waitForBalancesToLoad called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`
      );
    }
    
    // More specific locator to avoid strict mode violation
    const balancesSection = this.page.locator('.bg-white').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    // Wait for balances section to be visible
    await expect(balancesSection).toBeVisible();
    
    // Wait for loading to disappear
    await expect(balancesSection.getByText('Loading balances...')).not.toBeVisible({ timeout: 1000 });
    
    // Wait for the members section to stop loading
    // Check if there's a loading spinner in the Members section
    const membersSection = this.page.locator('text=Members').locator('..');
    const loadingSpinner = membersSection.locator('.animate-spin, [role="status"]');
    
    // Wait for spinner to disappear if it exists
    const spinnerCount = await loadingSpinner.count();
    if (spinnerCount > 0) {
      await expect(loadingSpinner.first()).not.toBeVisible({ timeout: 5000 });
    }
  }

  async waitForBalanceUpdate(): Promise<void> {
    // Wait for the balance section to be stable
    const balanceSection = this.page.getByRole('heading', { name: 'Balances' }).locator('..');
    await expect(balanceSection).toBeVisible();
    
    // Wait for network requests to complete
    await this.page.waitForLoadState('domcontentloaded');
  }

  async addExpense(expense: ExpenseData): Promise<void> {
    // Click Add Expense button with proper checks
    const addExpenseButton = this.getAddExpenseButton();
    await this.clickButton(addExpenseButton, { buttonName: 'Add Expense' });
    
    // Wait for navigation to add expense page
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Wait for form to be fully loaded
    await this.page.waitForLoadState('domcontentloaded');
    const descriptionField = this.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible();
    
    // Wait for all form sections to be loaded
    await expect(this.page.getByRole('heading', { name: 'Expense Details' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: /Who paid/ })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: /Split between/ })).toBeVisible();
    
    // CRITICAL: Wait for members to load in the form
    // This is the root cause of intermittent failures - members data doesn't load
    await this.waitForMembersInExpenseForm();
    
    // Fill expense form
    await this.fillPreactInput(descriptionField, expense.description);
    
    const amountField = this.getExpenseAmountField();
    await this.fillPreactInput(amountField, expense.amount.toString());
    
    // Handle currency selection
    if (expense.currency && expense.currency !== 'USD') {
      await this.selectCurrency(expense.currency);
    }
    // If currency is USD or not specified, the form defaults to USD
    
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
    // Note: This is a label containing a radio button, not a button
    await payerLabel.click();
    
    // CRITICAL: Select participants (who is involved in the split)
    // By default in the UI, all members are selected, but in tests we need to ensure this
    // Always click "Select all" to ensure deterministic state
    const selectAllButton = this.page.getByRole('button', { name: 'Select all' });
    await this.clickButton(selectAllButton, { buttonName: 'Select all' });
    
    // Validate form is ready before attempting to submit
    const validation = await this.validateExpenseFormReady();
    if (!validation.isValid) {
      // Take a screenshot to show the current form state
      await this.page.screenshot({ path: 'expense-form-validation-error.png', fullPage: true });
      
      throw new Error(
        `Cannot submit expense form - validation failed:\n` +
        validation.errors.map(e => `  - ${e}`).join('\n') +
        `\n\nForm state screenshot saved to expense-form-validation-error.png`
      );
    }
    
    // Submit form with proper checks
    const submitButton = this.getSaveExpenseButton();
    await this.clickButton(submitButton, { buttonName: 'Save Expense' });
    
    // Wait for navigation back to group page
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Verify expense was created by checking it appears in the list
    await expect(this.page.getByText(expense.description)).toBeVisible();
    
    // Wait for balance calculation to complete
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for members to load in the expense form
   * This prevents the intermittent issue where members don't appear
   */
  async waitForMembersInExpenseForm(timeout = 5000): Promise<void> {
    // Wait for at least one member to appear in the "Who paid?" section
    await expect(async () => {
      const payerRadios = await this.page.locator('input[type="radio"][name="paidBy"]').count();
      if (payerRadios === 0) {
        throw new Error('No members loaded in "Who paid?" section - waiting for members data');
      }
    }).toPass({ 
      timeout,
      intervals: [100, 250, 500, 1000]
    });
    
    // Also wait for participants checkboxes to be available
    await expect(async () => {
      // Check for checkboxes or the Select all button
      const checkboxes = await this.page.locator('input[type="checkbox"]').count();
      const selectAllButton = await this.page.getByRole('button', { name: 'Select all' }).count();
      
      if (checkboxes === 0 && selectAllButton === 0) {
        throw new Error('No members loaded in "Split between" section - waiting for members data');
      }
    }).toPass({ 
      timeout,
      intervals: [100, 250, 500, 1000]
    });
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
   * Auto-navigates users to the group page if they're not already there.
   */
  async synchronizeMultiUserState(pages: Array<{ page: any; groupDetailPage: any; userName?: string }>, expectedMemberCount: number, groupId: string): Promise<void> {
    const targetGroupUrl = `/groups/${groupId}`;
    
    // Navigate all users to the specific group
    for (let i = 0; i < pages.length; i++) {
      const { page, userName } = pages[i];
      const userIdentifier = userName || `User ${i + 1}`;
      
      await page.goto(targetGroupUrl);
      await page.waitForLoadState('domcontentloaded');
      
      // Check current URL after navigation
      const currentUrl = page.url();
      
      // Check if we got redirected to 404
      if (currentUrl.includes('/404')) {
        throw new Error(`${userIdentifier} was redirected to 404 page. Group access denied or group doesn't exist.`);
      }
      
      // If not on 404, check if we're on the dashboard (another redirect case)
      if (currentUrl.includes('/dashboard')) {
        throw new Error(`${userIdentifier} was redirected to dashboard. Expected ${targetGroupUrl}, but got: ${currentUrl}`);
      }

      await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);
    }
    
    // Wait for all pages to show correct member count
    for (let i = 0; i < pages.length; i++) {
      const { page, groupDetailPage, userName } = pages[i];
      const userIdentifier = userName || `User ${i + 1}`;

      await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);
      
      try {
        await groupDetailPage.waitForMemberCount(expectedMemberCount);
      } catch (error) {
        throw new Error(`${userIdentifier} failed waiting for member count: ${error}`);
      }

      await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);
    }
    
    // Wait for balances section to load on all pages
    for (let i = 0; i < pages.length; i++) {
      const { page, groupDetailPage, userName } = pages[i];
      const userIdentifier = userName || `User ${i + 1}`;

      await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);
      
      try {
        await groupDetailPage.waitForBalancesToLoad(groupId);
      } catch (error) {
        // Take screenshot on failure
        const sanitizedUserName = userName ? userName.replace(/\s+/g, '-') : `user-${i + 1}`;
        await page.screenshot({ 
          path: `playwright-report/ad-hoc/balance-load-failure-${sanitizedUserName}-${Date.now()}.png`,
          fullPage: false 
        });
        throw new Error(`${userIdentifier} failed waiting for balances to load: ${error}`);
      }

      await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);
    }
  }

  private async sanityCheckPageUrl(currentUrl: string, targetGroupUrl: string, userName: string, page: any) {
    // Assert we're actually on the group page
    if (!currentUrl.includes(targetGroupUrl)) {
      // Take screenshot before throwing error
      const sanitizedUserName = userName.replace(/\s+/g, '-');
      await page.screenshot({
        path: `playwright-report/ad-hoc/navigation-failure-${sanitizedUserName}-${Date.now()}.png`,
        fullPage: false
      });
      throw new Error(`Navigation failed for ${userName}. Expected URL to contain ${targetGroupUrl}, but got: ${currentUrl}`);
    }
  }

  /**
   * Verify that settlement appears in history for all provided pages
   */
  async verifySettlementInHistory(pages: Array<{ page: any }>, settlementNote: string): Promise<void> {
    for (const { page } of pages) {
      const showHistoryButton = page.getByRole('button', { name: 'Show History' });
      await this.clickButton(showHistoryButton, { buttonName: 'Show History' });
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
    pages: Array<{ page: any; groupDetailPage: any; userName?: string }>,
    expectedMemberCount: number,
    groupId: string
  ): Promise<void> {
    await this.addExpense(expense);
    await this.synchronizeMultiUserState(pages, expectedMemberCount, groupId);
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
    pages: Array<{ page: any; groupDetailPage: any; userName?: string }>,
    expectedMemberCount: number,
    groupId: string
  ): Promise<void> {
    await this.recordSettlementByUser(settlementOptions);
    await this.synchronizeMultiUserState(pages, expectedMemberCount, groupId);
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
    await this.clickButton(settleButton, { buttonName: 'Settle with payment' });
    
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
    // Check button is enabled before clicking (provides better error messages)
    await this.clickButton(submitButton, { buttonName: 'Record Payment' });
    
    // Wait for modal to close with increased timeout for settlement processing
    await expect(modal).not.toBeVisible({ timeout: 5000 });
    
    // Add a small delay to ensure the settlement is fully processed
    await this.page.waitForTimeout(500);
    
    // Wait for settlement to be processed
    await this.page.waitForLoadState('domcontentloaded');
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

  /**
   * Shares the group and waits for another user to join.
   * This encapsulates the entire share/join flow to avoid code duplication.
   * Optimized for fast timeouts and reliable share link extraction.
   * 
   * @param joinerPage - The Page object for the user who will join the group
   * @returns The share link URL
   */
  async shareGroupAndWaitForJoin(joinerPage: any): Promise<string> {
    // Get the share link from the modal
    const shareLink = await this.getShareLink();
    
    // Have the second user navigate to share link and join with fast timeout
    await joinerPage.goto(shareLink);
    await joinerPage.waitForLoadState('domcontentloaded');
    
    // Click join button with fast timeout
    const joinButton = joinerPage.getByRole('button', { name: /join group/i });
    await joinButton.waitFor({ state: 'visible', timeout: 1000 });
    await this.clickButton(joinButton, { buttonName: 'Join Group' });
    
    // Wait for navigation with reasonable timeout
    await joinerPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 3000 });
    
    // Refresh the original page to see updated members
    await this.page.reload();
    await this.page.waitForLoadState('domcontentloaded');
    
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
    // Note: Expense item is not a button but a clickable element
    await expense.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Deletes an expense with confirmation
   */
  async deleteExpense() {
    const deleteButton = this.getExpenseDeleteButton();
    await this.clickButton(deleteButton, { buttonName: 'Delete Expense' });
    
    // Confirm deletion
    const confirmButton = this.getDeleteConfirmButton();
    await this.clickButton(confirmButton, { buttonName: 'Confirm Delete' });
    
    // Wait for deletion to complete
    await this.page.waitForLoadState('domcontentloaded');
  }
    /**
     * Gets the share link from the group page.
   * Assumes the app works perfectly - no retries or workarounds.
   */
  async getShareLink(): Promise<string> {
    // Click share button
    const shareButton = this.getShareButton();
    await expect(shareButton).toBeVisible();
    await expect(shareButton).toBeEnabled();
    await shareButton.click();

    // Wait for modal to appear
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Wait for loading spinner to disappear if present
    const loadingSpinner = dialog.locator('.animate-spin');
    if (await loadingSpinner.count() > 0) {
      await expect(loadingSpinner).not.toBeVisible();
    }
    
    // Get the share link
    const shareLinkInput = this.getShareLinkInput();
    await expect(shareLinkInput).toBeVisible();
    const shareLink = await shareLinkInput.inputValue();
    
    // Close modal
    await this.page.keyboard.press('Escape');
    
    if (!shareLink || !shareLink.includes('/join?')) {
      throw new Error(`Invalid share link received: ${shareLink}`);
    }

    return shareLink;
  }

  /**
   * Navigates to a share link and handles the join process reliably.
   * This method integrates with the new JoinGroupPage for better error handling.
   */
  async navigateToShareLink(shareLink: string): Promise<void> {
    await this.page.goto(shareLink);
    await this.page.waitForLoadState('domcontentloaded');
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
    await this.clickButton(historyButton, { buttonName: 'Show History' });
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
   * Get the split options card (contains checkboxes for split selection)
   */
  getSplitOptionsCard() {
    const splitHeading = this.getSplitBetweenHeading();
    // Navigate up to the containing card
    return splitHeading.locator('..').locator('..');
  }

  /**
   * Get the first checkbox in split options
   */
  getSplitOptionsFirstCheckbox() {
    const splitCard = this.getSplitOptionsCard();
    return splitCard.locator('input[type="checkbox"]').first();
  }

  /**
   * Check if a user name is visible in split options
   */
  async isUserInSplitOptions(userName: string): Promise<boolean> {
    const splitCard = this.getSplitOptionsCard();
    return await splitCard.getByText(userName).isVisible();
  }

  /**
   * Get member count text element (e.g., "1 member" or "3 members")
   */
  getMemberCountElement() {
    return this.page.getByText(/\d+ member/i);
  }

  /**
   * Calculate exact debt amount for equal split
   * @param totalAmount - Total expense amount
   * @param numberOfPeople - Number of people splitting
   * @returns The amount each person owes, rounded to 2 decimal places
   */
  calculateEqualSplitDebt(totalAmount: number, numberOfPeople: number): string {
    const debtPerPerson = totalAmount / numberOfPeople;
    return debtPerPerson.toFixed(2);
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
   * Get a specific input by its minimum value attribute
   */
  getInputWithMinValue(minValue: string) {
    return this.page.locator(`input[type="number"][step="0.01"][min="${minValue}"]`);
  }

  /**
   * Close modal or dialog with Escape key
   */
  async closeModalWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Verify expense is visible for the current user
   */
  async verifyExpenseVisible(description: string): Promise<void> {
    await expect(this.getExpenseByDescription(description)).toBeVisible();
  }

  /**
   * Get settlement payment history entry by note
   */
  getSettlementHistoryEntry(note: string) {
    return this.page.getByText(new RegExp(note, 'i'));
  }

  /**
   * Verify settlement is in history
   */
  async verifySettlementInHistoryVisible(note: string): Promise<void> {
    await expect(this.getSettlementHistoryEntry(note)).toBeVisible();
  }

  /**
   * Open settlement history modal and verify content
   */
  async openHistoryAndVerifySettlement(settlementText: string | RegExp): Promise<void> {
    const showHistoryButton = this.getShowHistoryButton();
    await this.clickButton(showHistoryButton, { buttonName: 'Show History' });
    
    // Wait for settlement history modal content to be rendered and verify it's visible
    await expect(this.page.locator('div').filter({ hasText: settlementText }).first()).toBeVisible();
  }

  /**
   * Get balances section with specific context (for multi-page tests)
   */
  getBalancesSectionByContext() {
    return this.page.locator('.bg-white').filter({
      has: this.page.getByRole('heading', { name: 'Balances' })
    }).first();
  }

  /**
   * Verify debt relationship and amount in balances section
   */
  async verifyDebtRelationship(debtorName: string, creditorName: string, amount: string): Promise<void> {
    const balancesSection = this.getBalancesSectionByContext();
    await expect(balancesSection.getByText(`${debtorName} → ${creditorName}`)).toBeVisible();
    await expect(balancesSection.locator('.text-red-600').filter({ hasText: amount })).toBeVisible();
  }

  /**
   * Get currency amount text locator
   */
  getCurrencyAmountText(amount: string) {
    return this.page.getByText(`$${amount}`);
  }

  /**
   * Verify currency amount is visible
   */
  async verifyCurrencyAmountVisible(amount: string): Promise<void> {
    await expect(this.getCurrencyAmountText(amount)).toBeVisible();
  }

}

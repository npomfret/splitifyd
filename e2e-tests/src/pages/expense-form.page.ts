import {expect, Locator, Page} from '@playwright/test';
import {BasePage} from './base.page';

// Match the ExpenseData interface from GroupDetailPage
interface ExpenseData {
  description: string;
  amount: number;
  currency: string; // Required: must be explicitly provided
  paidBy: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants?: string[]; // Optional: if not provided, selects all members
}

export class ExpenseFormPage extends BasePage {
  readonly url = '/groups/[id]/add-expense';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Waits for the expense form to be fully ready with all members loaded.
   * This is called automatically by clickAddExpenseButton() so forms are always ready.
   */
  async waitForFormReady(expectedMemberCount: number): Promise<void> {
    // Wait for basic form structure
    await expect(this.getExpenseDescriptionField()).toBeVisible();
    await this.waitForExpenseFormSections();
    
    // Wait for ALL members to load in form sections
    await this.waitForMembersInExpenseForm(expectedMemberCount);
  }

  /**
   * Wait for all main form sections to be visible
   */
  async waitForExpenseFormSections(): Promise<void> {
    await expect(this.page.getByText('Description')).toBeVisible();
    await expect(this.page.getByText('Amount*')).toBeVisible();
    await expect(this.page.getByText('Who paid?')).toBeVisible();
    await expect(this.page.getByText('Split between')).toBeVisible();
  }

  /**
   * Wait for ALL members to load in the expense form
   * This prevents the intermittent issue where members don't appear and ensures ALL group members are represented
   */
  async waitForMembersInExpenseForm(expectedMemberCount: number, timeout = 5000): Promise<void> {
    // Wait for ALL members to appear in the "Who paid?" section
    await expect(async () => {
      const payerRadios = await this.page.locator('input[type="radio"][name="paidBy"]').count();
      if (payerRadios < expectedMemberCount) {
        throw new Error(`Only ${payerRadios} members loaded in "Who paid?" section, expected ${expectedMemberCount} - waiting for all members data`);
      }
    }).toPass({ 
      timeout,
      intervals: [100, 250, 500, 1000]
    });
    
    // Wait for ALL members to appear in "Split between" section
    await expect(async () => {
      // Check for checkboxes (one per member) or the Select all button
      const checkboxes = await this.page.locator('input[type="checkbox"]').count();
      const selectAllButton = await this.page.getByRole('button', { name: 'Select all' }).count();
      
      if (checkboxes === 0 && selectAllButton === 0) {
        throw new Error('No members loaded in "Split between" section - waiting for members data');
      }
      
      if (checkboxes > 0 && checkboxes < expectedMemberCount) {
        throw new Error(`Only ${checkboxes} member checkboxes found in "Split between", expected ${expectedMemberCount} - waiting for all members data`);
      }
    }).toPass({ 
      timeout,
      intervals: [100, 250, 500, 1000]
    });
  }

  // Form field locators
  getExpenseDescriptionField(): Locator {
    return this.page.getByPlaceholder('What was this expense for?');
  }

  getExpenseAmountField(): Locator {
    return this.page.locator('input[type="number"]').first();
  }

  getAmountInput(): Locator {
    return this.page.locator('input[type="number"]').first();
  }

  getDescriptionInput(): Locator {
    return this.page.getByPlaceholder('What was this expense for?');
  }

  private getSaveExpenseButton(): Locator {
    return this.page.getByRole('button', { name: /save expense/i });
  }

  // Split type controls
  getExactAmountsText(): Locator {
    return this.page.getByText('Exact amounts');
  }

  getSelectAllButton(): Locator {
    return this.page.getByRole('button', { name: 'Select all' });
  }

  getInputWithMinValue(minValue: string): Locator {
    return this.page.locator(`input[min="${minValue}"]`);
  }

  // Form actions
  async fillDescription(description: string): Promise<void> {
    await this.fillPreactInput(this.getDescriptionInput(), description);
  }

  async fillAmount(amount: string): Promise<void> {
    await this.fillPreactInput(this.getAmountInput(), amount);
  }

  async selectAllParticipants(): Promise<void> {
    await this.getSelectAllButton().click();
  }

  async switchToExactAmounts(): Promise<void> {
    await this.getExactAmountsText().click();
  }

   /**
   * Clicks the save expense button and waits for any spinner to disappear.
   * This properly handles the async save operation.
   */
  async clickSaveExpenseButton(): Promise<void> {
    const saveButton = this.getSaveExpenseButton();
    
    // Wait for button to be enabled
    await expect(saveButton).toBeEnabled({ timeout: 500 });
    
    // Click the button
    await this.clickButton(saveButton, { buttonName: 'Save Expense' });
    
    // Wait for spinner to disappear if present
    const spinner = this.page.locator('.animate-spin, [role="status"]');
    if (await spinner.count() > 0) {
      await expect(spinner).not.toBeVisible({ timeout: 3000 });// give it some time to save
    }
  }

  /**
   * Gets a locator for the save expense button for validation testing.
   * Use this only when you need to assert button state (disabled/enabled).
   * For clicking the button, use clickSaveExpenseButton() instead.
   */
  getSaveButtonForValidation(): Locator {
    return this.getSaveExpenseButton();
  }

  /**
   * Submit a complete expense with all required fields.
   * This method handles the full expense creation flow.
   */
  async submitExpense(expense: ExpenseData): Promise<void> {
    // Fill expense description
    await this.fillDescription(expense.description);
    
    // Fill amount
    await this.fillAmount(expense.amount.toString());
    
    // Handle currency selection
    // The currency selector is a button that shows the currency symbol
    // Get the currency button
    const currencyButton = this.page.getByRole('button', { name: /select currency/i });
    
    // Get the current currency from the button text
    const currentButtonText = await currencyButton.textContent();
    
    // Map common currency codes to their symbols
    const currencySymbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€', 
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$'
    };
    
    const expectedSymbol = currencySymbols[expense.currency] || expense.currency;
    
    // Only change currency if current selection doesn't match what we need
    // Check both symbol and code since button might show either
    if (!currentButtonText?.includes(expectedSymbol) && !currentButtonText?.includes(expense.currency)) {
      // Click the currency button to open the dropdown
      await currencyButton.click();
      
      // Wait for the dropdown to open
      const searchInput = this.page.getByPlaceholder('Search by symbol, code, or country...');
      await expect(searchInput).toBeVisible();
      
      // Type the currency code to filter the list
      await searchInput.fill(expense.currency);
      
      // Wait a moment for the search to filter results
      // Look for a button that contains the currency code
      // The format is "symbol CODE name" e.g., "€ EUR Euro"
      const currencyOption = this.page.locator('button').filter({ 
        hasText: expense.currency // Just look for the currency code anywhere in the text
      }).first();
      
      // Wait for it to be visible and click it
      await expect(currencyOption).toBeVisible({ timeout: 3000 });
      await currencyOption.click();
      
      // Wait for dropdown to close
      await expect(searchInput).not.toBeVisible();
    }
    
    // Select who paid - find the payer radio button by display name
    const payerLabel = this.page.locator('label').filter({
      has: this.page.locator('input[type="radio"][name="paidBy"]')
    }).filter({
      hasText: expense.paidBy
    }).first();
    
    await expect(payerLabel).toBeVisible();
    await payerLabel.click();
    
    // Handle split type
    if (expense.splitType === 'equal') {
      // For equal split, click "Select all" to ensure all members are selected
      await this.selectAllParticipants();
    } else if (expense.splitType === 'exact') {
      // Switch to exact amounts
      await this.switchToExactAmounts();
      // Additional logic for exact amounts would go here if needed
    }
    // Note: percentage split would need additional implementation
    
    // Save the expense
    await this.clickSaveExpenseButton();
    
    // Wait for navigation back to group page
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Verify expense was created by checking it appears in the list
    await expect(this.page.getByText(expense.description)).toBeVisible();
    
    // Wait for page to stabilize after expense creation
    await this.page.waitForLoadState('domcontentloaded');
  }

}
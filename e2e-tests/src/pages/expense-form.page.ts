import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

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

  getSaveExpenseButton(): Locator {
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

  async saveExpense(): Promise<void> {
    const saveButton = this.getSaveExpenseButton();
    await this.clickButton(saveButton, { buttonName: 'Save Expense' });
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
    
    // Handle currency selection (if not USD)
    if (expense.currency && expense.currency !== 'USD') {
      const currencySelector = this.page.getByRole('combobox').filter({ hasText: 'USD' }).first();
      await currencySelector.selectOption(expense.currency);
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
    await this.saveExpense();
    
    // Wait for navigation back to group page
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Verify expense was created by checking it appears in the list
    await expect(this.page.getByText(expense.description)).toBeVisible();
    
    // Wait for page to stabilize after expense creation
    await this.page.waitForLoadState('domcontentloaded');
  }

}
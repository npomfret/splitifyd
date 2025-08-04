import { expect } from '@playwright/test';
import { BasePage } from './base.page';

interface ExpenseData {
  description: string;
  amount: number;
  paidBy: string;
  splitType: 'equal' | 'exact' | 'percentage';
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

  async addExpense(expense: ExpenseData): Promise<void> {
    // Click add expense button
    const addExpenseButton = this.getAddExpenseButton();
    await addExpenseButton.click();
    
    // Wait for form to be visible
    await this.page.waitForLoadState('domcontentloaded');
    const descriptionField = this.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible();
    
    // Fill expense form
    await this.fillPreactInput(descriptionField, expense.description);
    
    const amountField = this.getExpenseAmountField();
    await this.fillPreactInput(amountField, expense.amount.toString());
    
    // Handle split type if not equal
    if (expense.splitType !== 'equal') {
      // Click on split type selector
      const splitTypeButton = this.page.getByRole('button', { name: /split|divide/i });
      await splitTypeButton.click();
      await this.page.getByText(expense.splitType, { exact: false }).click();
    }
    
    // Submit form
    const submitButton = this.getSaveExpenseButton();
    await submitButton.click();
    
    // Wait for navigation back to group page
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
  }
}
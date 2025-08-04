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
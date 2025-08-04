import { expect } from '@playwright/test';
import { BasePage } from './base.page';

interface ExpenseData {
  description: string;
  amount: number;
  paidBy: string;
  splitType: 'equal' | 'exact' | 'percentage';
}

export class GroupDetailPage extends BasePage {
  async addExpense(expense: ExpenseData): Promise<void> {
    // Click add expense button
    const addExpenseButton = this.page.getByRole('button', { name: /add expense/i });
    await addExpenseButton.click();
    
    // Wait for form to be visible
    await this.page.waitForLoadState('domcontentloaded');
    const descriptionField = this.page.getByPlaceholder('What was this expense for?');
    await expect(descriptionField).toBeVisible();
    
    // Fill expense form
    await this.fillPreactInput(descriptionField, expense.description);
    
    const amountField = this.page.getByPlaceholder('0.00');
    await this.fillPreactInput(amountField, expense.amount.toString());
    
    // Handle split type if not equal
    if (expense.splitType !== 'equal') {
      // Click on split type selector
      const splitTypeButton = this.page.getByRole('button', { name: /split|divide/i });
      await splitTypeButton.click();
      await this.page.getByText(expense.splitType, { exact: false }).click();
    }
    
    // Submit form
    const submitButton = this.page.getByRole('button', { name: /save expense|add expense/i });
    await submitButton.click();
    
    // Wait for navigation back to group page
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
  }
}
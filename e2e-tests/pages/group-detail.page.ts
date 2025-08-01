import { Page } from '@playwright/test';
import { BasePage } from './base.page';

export class GroupDetailPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async openShareModal() {
        await this.page.getByRole('button', { name: 'Share Group' }).click();
        // Wait for modal to appear - using similar pattern as CreateGroupModalPage
        await this.page.waitForSelector('.fixed.inset-0', { state: 'visible', timeout: 3000 });
    }

    async clickAddExpenseButton() {
        // Click add expense button - try multiple selectors
        const addExpenseButton = this.page.getByRole('button', { name: /add expense/i })
            .or(this.page.getByRole('link', { name: /add expense/i }))
            .or(this.page.getByText(/add expense/i));
        
        await addExpenseButton.first().click();
        
        // Wait for navigation to add expense page
        await this.page.waitForURL(/\/groups\/[^\/]+\/add-expense/, { timeout: 2000 });
    }

    async addExpense(expenseData: {
        description: string;
        amount: number;
        paidBy: string;
        splitType: 'equal' | 'exact' | 'percentage';
    }) {
        await this.clickAddExpenseButton();

        // Fill in expense details
        await this.page.getByPlaceholder('What was this expense for?').fill(expenseData.description);
        await this.page.getByPlaceholder('0.00').fill(expenseData.amount.toString());

        // Submit the form - look for Save Expense button
        const submitButton = this.page.getByRole('button', { name: /save expense/i })
            .or(this.page.getByRole('button', { name: /create/i }))
            .or(this.page.getByRole('button', { name: /add expense/i }));
        
        await submitButton.first().click();

        // Wait for navigation back to group page
        await this.page.waitForURL(/\/groups\/[^\/]+$/, { timeout: 3000 });
        await this.page.waitForTimeout(200); // Allow time for expense to appear
    }

    async getExpenseItems() {
        return this.page.locator('[data-testid="expense-item"]').all();
    }

    async getExpenseTexts() {
        const expenses = await this.getExpenseItems();
        return Promise.all(expenses.map(expense => expense.textContent()));
    }
}
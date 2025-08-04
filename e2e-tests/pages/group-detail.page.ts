import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class GroupDetailPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async navigate(groupId: string) {
        await this.page.goto(`/groups/${groupId}`);
        await this.page.waitForLoadState('networkidle');
    }

    async openShareModal() {
        await this.page.getByRole('button', { name: 'Share Group' }).click();
        // Wait for modal to appear - using similar pattern as CreateGroupModalPage
        await this.page.waitForSelector('.fixed.inset-0', { state: 'visible', timeout: 500 });
    }

    async clickAddExpenseButton() {
        // Click add expense button - use specific selector
        const addExpenseButton = this.page.getByRole('button', { name: 'Add Expense' });
        await addExpenseButton.click();
        
        // Wait for navigation to add expense page
        await this.page.waitForURL(/\/groups\/[^\/]+\/add-expense/, { timeout: 5000 });
    }

    async addExpense(expenseData: {
        description: string;
        amount: number;
        paidBy: string;
        splitType: 'equal' | 'exact' | 'percentage';
    }) {
        await this.clickAddExpenseButton();

        // Fill in expense details
        await this.fillPreactInput(this.page.getByPlaceholder('What was this expense for?'), expenseData.description);
        await this.fillPreactInput(this.page.getByPlaceholder('0.00'), expenseData.amount.toString());

        // Submit the form - use specific button
        const submitButton = this.page.getByRole('button', { name: /save expense/i });
        await submitButton.click();

        // Wait for navigation back to group page
        await this.page.waitForURL(/\/groups\/[^\/]+$/, { timeout: 5000 });
    }

    /**
     * Enhanced expense creation with better flow
     */
    async addExpenseStandardFlow(description: string, amount: string | number): Promise<void> {
        await this.clickAddExpenseButton();
        
        // Fill the form
        await this.fillPreactInput(this.page.getByPlaceholder('What was this expense for?'), description);
        await this.fillPreactInput(this.page.getByPlaceholder('0.00'), amount.toString());
        
        // Submit
        const submitButton = this.page.getByRole('button', { name: /save expense/i });
        await submitButton.click();
        
        // Wait for navigation back to group page
        await this.page.waitForURL(/\/groups\/[^\/]+$/, { timeout: 5000 });
        
        // Note: Don't verify expense immediately - let the caller do it after reload if needed
    }
    
    /**
     * Verifies an expense is visible on the page
     */
    async expectExpenseVisible(description: string): Promise<void> {
        const expense = this.page.getByText(description);
        await expect(expense).toBeVisible();
    }
    
    /**
     * Gets the share link for the current group
     */
    async getShareLink(): Promise<string> {
        await this.openShareModal();
        
        // Get share link from dialog
        const shareLinkInput = this.page.getByRole('dialog').getByRole('textbox');
        await shareLinkInput.waitFor({ state: 'visible' });
        const shareLink = await shareLinkInput.inputValue();
        
        // Close dialog
        await this.page.keyboard.press('Escape');
        
        return shareLink;
    }
    
    /**
     * Verifies a user is visible as a group member
     */
    async expectUserInGroup(userName: string): Promise<void> {
        // Look for user in the members section
        const memberSection = this.page.getByRole('main');
        await expect(memberSection.getByText(userName).first()).toBeVisible();
    }

    /**
     * Joins a group via share link
     */
    static async joinViaShareLink(page: Page, shareLink: string): Promise<void> {
        await page.goto(shareLink);
        
        // Wait for join page
        await expect(page.getByRole('heading', { name: 'Join Group' })).toBeVisible();
        
        // Click join button
        await page.getByRole('button', { name: 'Join Group' }).click();
        
        // Wait for redirect to group page
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
    }
}
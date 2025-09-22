import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { ExpenseFormPage } from './expense-form.page';
import { PooledTestUser } from '@splitifyd/shared';
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class ExpenseDetailPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }

    /**
     * Wait for the expense detail page to be fully loaded
     */
    async waitForPageReady(): Promise<void> {
        // Wait for URL pattern to match expense detail
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+$/);
        await this.waitForDomContentLoaded();

        // Wait for expense heading to be visible
        const expenseHeading = this.page.getByRole('heading', { level: 1 }).first();
        await expect(expenseHeading).toBeVisible();
    }

    /**
     * Get the edit button for the expense
     */
    getEditButton(): Locator {
        return this.page.getByRole('button', { name: /edit/i });
    }

    /**
     * Click the edit expense button and return the expense form page for editing
     */
    async clickEditExpenseButton(expectedMemberCount: number): Promise<ExpenseFormPage> {
        const editButton = this.getEditButton();
        await this.clickButton(editButton, { buttonName: 'Edit Expense' });

        // Wait for navigation to edit expense page
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense\?.*edit=true/);
        await this.waitForDomContentLoaded();

        // Create and validate the expense form page in edit mode
        const expenseFormPage = new ExpenseFormPage(this.page);
        await expenseFormPage.waitForFormReady(expectedMemberCount);

        return expenseFormPage;
    }

    /**
     * Get the discussion section (contains comments)
     */
    getDiscussionSection() {
        return this.page.getByTestId('comments-section');
    }

    /**
     * Get the comment input textarea
     */
    getCommentInput() {
        return this.getDiscussionSection().getByRole('textbox', { name: /comment text/i });
    }

    /**
     * Get the send comment button
     */
    getSendCommentButton() {
        return this.getDiscussionSection().getByRole('button', { name: /send comment/i });
    }

    /**
     * Get all comment items in the comments list
     */
    getCommentItems() {
        return this.getDiscussionSection().locator('[data-testid="comment-item"]');
    }

    /**
     * Get a specific comment by its text content
     */
    getCommentByText(text: string) {
        return this.getDiscussionSection().getByText(text);
    }

    /**
     * Add a comment to the expense
     */
    async addComment(text: string): Promise<void> {
        const input = this.getCommentInput();
        const sendButton = this.getSendCommentButton();

        // Verify discussion section is visible
        await expect(this.getDiscussionSection()).toBeVisible();

        // Type the comment using fillPreactInput for proper signal updates
        await this.fillPreactInput(input, text);

        // Verify the send button becomes enabled
        await expect(sendButton).toBeEnabled();

        // Click send button
        await this.clickButton(sendButton, { buttonName: 'Send comment' });

        // Wait for comment to be sent (button should become disabled briefly while submitting)
        await expect(sendButton).toBeDisabled({ timeout: 2000 });

        // After successful submission, input should be cleared and button should be disabled
        await expect(input).toHaveValue('');
        await expect(sendButton).toBeDisabled();
    }

    /**
     * Wait for a comment with specific text to appear
     */
    async waitForCommentToAppear(text: string, timeout: number = 5000): Promise<void> {
        const comment = this.getCommentByText(text);
        await expect(comment).toBeVisible({ timeout });
    }

    /**
     * Wait for the comment count to reach a specific number
     */
    async waitForCommentCount(expectedCount: number, timeout: number = 5000): Promise<void> {
        await expect(async () => {
            const count = await this.getCommentItems().count();
            expect(count).toBe(expectedCount);
        }).toPass({ timeout });
    }

    /**
     * Verify that comments section is present and functional
     */
    async verifyCommentsSection(): Promise<void> {
        // Check that discussion section exists
        await expect(this.getDiscussionSection()).toBeVisible();

        // Check that input exists and has correct placeholder
        const input = this.getCommentInput();
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute('placeholder', /add a comment to this expense/i);

        // Check that send button exists
        const sendButton = this.getSendCommentButton();
        await expect(sendButton).toBeVisible();

        // Send button should be disabled when input is empty
        await expect(sendButton).toBeDisabled();
    }

    /**
     * Click the back button to navigate to the group detail page
     */
    async clickBackButton(): Promise<void> {
        // Find the back button with "← Back" text
        const backButton = this.page.getByRole('button', { name: /← Back/i });
        await expect(backButton).toBeVisible();
        await this.clickButton(backButton, { buttonName: 'Back' });

        // Wait for navigation back to group detail page
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
        await this.waitForDomContentLoaded();
    }

    /**
     * Delete the expense via the ExpenseActions component
     */
    async deleteExpense(): Promise<void> {
        // Find and click the Delete button (red/danger variant)
        const deleteButton = this.page.getByRole('button', { name: /delete/i });
        await expect(deleteButton).toBeVisible();
        await this.clickButton(deleteButton, { buttonName: 'Delete Expense' });

        // Wait for the confirmation dialog to appear
        const confirmDialog = this.page.getByTestId('confirmation-dialog');
        await expect(confirmDialog).toBeVisible();

        // Verify the dialog shows the expense deletion message - using partial text match for the key parts
        await expect(confirmDialog.getByText(/this action cannot be undone and will affect group balances/i)).toBeVisible();

        // Click the confirm button to actually delete
        const confirmButton = confirmDialog.getByTestId('confirm-button');
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        // Wait for the dialog to close and navigation to occur
        await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });

        // The ExpenseDetailPage should redirect back to the group page after successful deletion
        // We'll let the test verify the URL change rather than asserting it here
    }

    /**
     * Get the current expense description from the page
     */
    private async getCurrentExpenseDescription(): Promise<string> {
        const headings = await this.page.getByRole('heading').allTextContents();
        return headings.join(', ');
    }

    /**
     * Get the current currency amount from the page
     */
    private async getCurrentCurrencyAmount(): Promise<string> {
        const headings = await this.page.getByRole('heading').allTextContents();
        const currencyHeadings = headings.filter(h => /[€$£¥]\d+/.test(h));
        return currencyHeadings.join(', ');
    }

    /**
     * Get the current split amounts from the split section
     */
    private async getCurrentSplitAmounts(): Promise<string> {
        // Use the data-testid we added to the SplitBreakdown component
        const splitAmountElements = this.page.getByTestId('split-amount');
        const count = await splitAmountElements.count();

        if (count === 0) {
            return 'no split amounts found (missing data-testid="split-amount")';
        }

        const amounts: string[] = [];
        for (let i = 0; i < count; i++) {
            const text = await splitAmountElements.nth(i).textContent() || '';
            amounts.push(text.trim());
        }

        return amounts.join(', ');
    }

    /**
     * Wait for expense description to be visible (polls until found)
     * @param description - The expense description text
     * @param timeout - Optional timeout in milliseconds
     */
    async waitForExpenseDescription(description: string, timeout: number = 5000): Promise<void> {
        await expect(async () => {
            const actual = await this.getCurrentExpenseDescription();
            expect(actual, `Expected description "${description}". Found: ${actual}`).toContain(description);
        }).toPass({ timeout });
    }

    /**
     * Wait for currency amount to be visible (polls until found)
     * @param formattedAmount - The formatted currency amount (e.g., "£33.45", "$125.50")
     * @param timeout - Optional timeout in milliseconds
     */
    async waitForCurrencyAmount(formattedAmount: string, timeout: number = 5000): Promise<void> {
        await expect(async () => {
            const actual = await this.getCurrentCurrencyAmount();
            expect(actual, `Expected currency amount "${formattedAmount}". Found: ${actual}`).toContain(formattedAmount);
        }).toPass({ timeout });
    }

    /**
     * Verify that the split section displays the correct amount per person
     * @param expectedAmountPerPerson - The formatted currency amount expected per person (e.g., "€50.00")
     * @param expectedUserCount - Optional: verify this many users have the amount (defaults to at least 1)
     */
    async verifySplitAmount(expectedAmountPerPerson: string, expectedUserCount?: number): Promise<void> {
        await expect(async () => {
            const actual = await this.getCurrentSplitAmounts();
            let errorMsg = `Expected split amount "${expectedAmountPerPerson}". Found: ${actual}`;

            expect(actual, errorMsg).toContain(expectedAmountPerPerson);

            if (expectedUserCount !== undefined) {
                const matches = (actual.match(new RegExp(expectedAmountPerPerson.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                errorMsg += ` (expected ${expectedUserCount} occurrences, found ${matches})`;
                expect(matches, errorMsg).toBe(expectedUserCount);
            }
        }).toPass({ timeout: 5000 });
    }
}

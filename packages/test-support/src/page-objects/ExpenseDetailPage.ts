import { ExpenseId, GroupId } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { ExpenseFormPage } from './ExpenseFormPage';

/**
 * Shared base class for Expense Detail page object.
 * Contains common selectors and basic actions for expense detail pages.
 * E2E tests may extend this with additional e2e-specific functionality.
 */
export class ExpenseDetailPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    private getSummaryCard(): Locator {
        return this.page.getByTestId('expense-summary-card');
    }

    private getSplitCard(): Locator {
        return this.page.getByTestId('expense-split-card');
    }

    private getCommentsCard(): Locator {
        return this.page.getByTestId('expense-comments-card');
    }

    private getReceiptCard(): Locator {
        return this.page.getByTestId('expense-receipt-card');
    }

    private getMetadataCard(): Locator {
        return this.page.getByTestId('expense-metadata-card');
    }

    protected getErrorCard(): Locator {
        return this.page.getByTestId('expense-error-card');
    }

    protected getHeader(): Locator {
        return this.page.getByTestId('expense-header');
    }

    // Basic element selectors

    /**
     * Get the edit button for the expense
     */
    protected getEditButton(): Locator {
        return this.page.getByRole('button', { name: /edit/i });
    }

    /**
     * Get the copy button for the expense
     */
    protected getCopyButton(): Locator {
        return this.page.getByRole('button', { name: /copy/i });
    }

    /**
     * Get the delete button for the expense
     */
    protected getDeleteButton(): Locator {
        return this.page.getByRole('button', { name: /delete/i });
    }

    /**
     * Get the discussion section (contains comments)
     */
    protected getDiscussionSection(): Locator {
        return this.getCommentsCard().locator('[data-testid="comments-section"]');
    }

    /**
     * Get the comment input textarea
     */
    protected getCommentInput(): Locator {
        return this.getDiscussionSection().getByRole('textbox', { name: /comment text/i });
    }

    /**
     * Get the send comment button
     */
    protected getSendCommentButton(): Locator {
        return this.getDiscussionSection().getByRole('button', { name: /send comment/i });
    }

    /**
     * Get all comment items in the comments list
     */
    protected getCommentItems(): Locator {
        return this.getDiscussionSection().locator('[data-testid="comment-item"]');
    }

    /**
     * Get a specific comment by its text content
     */
    protected getCommentByText(text: string): Locator {
        return this.getDiscussionSection().getByText(text);
    }

    /**
     * Get the lock warning banner for locked expenses
     */
    protected getLockWarningBanner(): Locator {
        return this.page.getByTestId('expense-lock-warning');
    }

    /**
     * Get the confirmation dialog - Modal component has role="dialog"
     */
    protected getConfirmationDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /**
     * Get the expense amount display element
     */
    protected getExpenseAmountElement(): Locator {
        return this.page.getByTestId('expense-amount-section');
    }

    protected getSplitBreakdownCard(): Locator {
        return this.getSplitCard();
    }

    protected getReceiptSection(): Locator {
        return this.getReceiptCard();
    }

    protected getMetadataSection(): Locator {
        return this.getMetadataCard();
    }

    // Basic actions

    /**
     * Navigate to a specific expense detail page
     */
    async navigate(groupId: GroupId | string, expenseId: ExpenseId): Promise<void> {
        await this.page.goto(`/groups/${groupId}/expenses/${expenseId}`);
        await this.waitForDomContentLoaded();
    }

    /**
     * Wait for the expense detail page to be fully loaded.
     */
    async waitForPageReady(): Promise<void> {
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+$/);
        await this.waitForDomContentLoaded();
        // Wait for the Edit button to be visible as a reliable indicator the page is ready
        const editButton = this.getEditButton();
        await expect(editButton).toBeVisible();
    }

    /**
     * Click the edit expense button and navigate to the expense form.
     */
    async clickEditExpenseButton(): Promise<void> {
        const editButton = this.getEditButton();
        await this.clickButton(editButton, { buttonName: 'Edit Expense' });
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense\?.*edit=true/);
        await this.waitForDomContentLoaded();
    }

    /**
     * Click the edit button and return an `ExpenseFormPage` ready for interaction.
     */
    async clickEditExpenseAndReturnForm<T = ExpenseFormPage>(
        expectedUsers: string[],
        createFormPage?: (page: Page) => T,
    ): Promise<T> {
        await this.clickEditExpenseButton();
        const formPage = createFormPage
            ? createFormPage(this.page)
            : ((new ExpenseFormPage(this.page)) as unknown as T);

        await this.ensureExpenseFormReady(formPage, expectedUsers);
        return formPage;
    }

    /**
     * Click the copy expense button and navigate to the copy form.
     */
    async clickCopyExpenseButton(): Promise<void> {
        const copyButton = this.getCopyButton();
        await this.clickButton(copyButton, { buttonName: 'Copy Expense' });
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense\?.*copy=true.*sourceId=/);
        await this.waitForDomContentLoaded();
    }

    /**
     * Click the copy button and return an `ExpenseFormPage` ready for interaction.
     */
    async clickCopyExpenseAndReturnForm<T = ExpenseFormPage>(
        expectedUsers: string[],
        createFormPage?: (page: Page) => T,
    ): Promise<T> {
        await this.clickCopyExpenseButton();
        const formPage = createFormPage
            ? createFormPage(this.page)
            : ((new ExpenseFormPage(this.page)) as unknown as T);

        await this.ensureExpenseFormReady(formPage, expectedUsers);
        return formPage;
    }

    private async ensureExpenseFormReady<T>(formPage: T, expectedUsers: string[]): Promise<void> {
        const guards = formPage as unknown as {
            waitForFormReady?: (expectedUsers: string[]) => Promise<void>;
        };

        if (typeof guards.waitForFormReady === 'function') {
            await guards.waitForFormReady(expectedUsers);
        }
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
        })
            .toPass({ timeout });
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
     * Verify a comment with specific text is visible
     */
    async verifyCommentVisible(text: string): Promise<void> {
        const comment = this.getCommentByText(text);
        await expect(comment).toBeVisible();
    }

    /**
     * Delete the expense via the ExpenseActions component
     */
    async deleteExpense(): Promise<void> {
        // Find and click the Delete button (red/danger variant)
        const deleteButton = this.getDeleteButton();
        await expect(deleteButton).toBeVisible();
        await this.clickButton(deleteButton, { buttonName: 'Delete Expense' });

        // Wait for the confirmation dialog to appear
        const confirmDialog = this.getConfirmationDialog();
        await expect(confirmDialog).toBeVisible();

        // Verify the dialog shows the expense deletion message - using partial text match for the key parts
        await expect(confirmDialog.getByText(/this action cannot be undone and will affect group balances/i)).toBeVisible();

        // Click the confirm button to actually delete - use semantic button name
        const confirmButton = confirmDialog.getByRole('button', { name: /confirm/i });
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
    async getCurrentExpenseDescription(): Promise<string> {
        // Description is now a <p> tag within the expense-amount-section
        const amountSection = this.getExpenseAmountElement();
        const descriptionElement = amountSection.locator('p.text-lg');
        const description = await descriptionElement.textContent();
        return description?.trim() || '';
    }

    /**
     * Get the current currency amount from the page
     */
    async getCurrentCurrencyAmount(): Promise<string> {
        // Use the specific data-testid for the main expense amount display
        const expenseAmountElement = this.getExpenseAmountElement();
        const amountText = await expenseAmountElement.textContent();
        // Normalize non-breaking spaces to regular spaces for easier test matching
        return amountText?.trim().replace(/\u00A0/g, ' ') || 'expense amount not found';
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
        })
            .toPass({ timeout });
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
        })
            .toPass({ timeout });
    }

    /**
     * Verify the lock warning banner is displayed with correct messaging
     */
    async verifyLockWarningBanner(): Promise<void> {
        const warningBanner = this.getLockWarningBanner();
        await expect(warningBanner).toBeVisible();

        // Verify banner contains warning emoji
        await expect(warningBanner).toContainText('⚠️');

        // Verify banner contains main message (using translation key text)
        await expect(warningBanner).toContainText('This expense cannot be edited');

        // Verify banner contains detailed explanation
        await expect(warningBanner).toContainText('One or more participants have left the group');
    }

    /**
     * Verify that the lock warning banner is NOT displayed
     */
    async verifyLockWarningBannerNotVisible(): Promise<void> {
        await expect(this.getLockWarningBanner()).not.toBeVisible();
    }

    /**
     * Verify that the edit button is disabled for a locked expense
     */
    async verifyEditButtonDisabled(): Promise<void> {
        const editButton = this.getEditButton();
        await expect(editButton).toBeVisible();
        await expect(editButton).toBeDisabled();
    }

    /**
     * Verify the tooltip on the edit button wrapper
     */
    async verifyEditButtonTooltip(): Promise<void> {
        // The tooltip is on the wrapper div, look for the title attribute
        const tooltipWrapper = this.page.getByTitle('Cannot edit - participant has left the group');
        await expect(tooltipWrapper).toBeVisible();
    }
}

import { expect, Locator, Page } from '@playwright/test';
import { ExpenseId, GroupId } from '@splitifyd/shared';
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

    // Basic element selectors

    /**
     * Get the edit button for the expense
     */
    getEditButton(): Locator {
        return this.page.getByRole('button', { name: /edit/i });
    }

    /**
     * Get the copy button for the expense
     */
    getCopyButton(): Locator {
        return this.page.getByRole('button', { name: /copy/i });
    }

    /**
     * Get the delete button for the expense
     */
    getDeleteButton(): Locator {
        return this.page.getByRole('button', { name: /delete/i });
    }

    /**
     * Get the discussion section (contains comments)
     */
    getDiscussionSection(): Locator {
        return this.page.getByTestId('comments-section');
    }

    /**
     * Get the comment input textarea
     */
    getCommentInput(): Locator {
        return this.getDiscussionSection().getByRole('textbox', { name: /comment text/i });
    }

    /**
     * Get the send comment button
     */
    getSendCommentButton(): Locator {
        return this.getDiscussionSection().getByRole('button', { name: /send comment/i });
    }

    /**
     * Get all comment items in the comments list
     */
    getCommentItems(): Locator {
        return this.getDiscussionSection().locator('[data-testid="comment-item"]');
    }

    /**
     * Get a specific comment by its text content
     */
    getCommentByText(text: string): Locator {
        return this.getDiscussionSection().getByText(text);
    }

    /**
     * Get the lock warning banner for locked expenses
     */
    getLockWarningBanner(): Locator {
        return this.page.locator('.bg-yellow-50').filter({ hasText: /cannot be edited/i });
    }

    /**
     * Get the confirmation dialog
     */
    getConfirmationDialog(): Locator {
        return this.page.getByTestId('confirmation-dialog');
    }

    /**
     * Get the expense amount display element
     */
    getExpenseAmountElement(): Locator {
        return this.page.getByTestId('expense-amount');
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
        const expenseHeading = this.page.getByRole('heading', { level: 1 }).first();
        await expect(expenseHeading).toBeVisible();
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
    async getCurrentExpenseDescription(): Promise<string> {
        const headings = await this.page.getByRole('heading').allTextContents();
        return headings.join(', ');
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

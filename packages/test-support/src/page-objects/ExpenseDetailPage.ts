import type { ReactionEmoji } from '@billsplit-wl/shared';
import { ExpenseId, GroupId } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { ExpenseFormPage } from './ExpenseFormPage';

const translation = translationEn;

/**
 * Shared base class for Expense Detail page object.
 * Contains common selectors and basic actions for expense detail pages.
 * E2E tests may extend this with additional e2e-specific functionality.
 */
export class ExpenseDetailPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    private getSplitCard(): Locator {
        return this.page.getByRole('region', { name: translation.pages.expenseDetailPage.splitSection });
    }

    /**
     * Get the receipt thumbnail in the hero section (clickable image)
     */
    private getReceiptThumbnail(): Locator {
        return this.page.getByRole('dialog').getByRole('img', { name: translation.expenseComponents.expenseDetailModal.receipt });
    }

    private getMetadataCard(): Locator {
        return this.page.getByRole('region', { name: translation.pages.expenseDetailPage.metadataSection });
    }

    /**
     * Get error state container - uses role="alert" for semantic selection
     */
    protected getErrorCard(): Locator {
        return this.page.getByRole('dialog').getByRole('alert');
    }

    /**
     * Get the modal header container - identified by the modal title ID
     */
    protected getHeader(): Locator {
        return this.page.locator('#expense-detail-modal-title').locator('..');
    }

    // Basic element selectors

    /**
     * Get the edit button for the expense
     */
    protected getEditButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseComponents.expenseActions.edit });
    }

    /**
     * Get the copy button for the expense
     */
    protected getCopyButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseComponents.expenseActions.copy });
    }

    /**
     * Get the delete button for the expense
     */
    protected getDeleteButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseComponents.expenseActions.delete });
    }

    /**
     * Get the discussion section (contains comments) - scoped to the modal
     */
    protected getDiscussionSection(): Locator {
        return this.page.getByRole('dialog').getByRole('region', { name: translation.pages.expenseDetailPage.discussion });
    }

    /**
     * Get the comment input textarea
     */
    protected getCommentInput(): Locator {
        return this.getDiscussionSection().getByRole('textbox', { name: translation.comments.input.ariaLabel });
    }

    /**
     * Get the send comment button
     */
    protected getSendCommentButton(): Locator {
        return this.getDiscussionSection().getByRole('button', { name: translation.comments.input.sendAriaLabel });
    }

    /**
     * Get all comment items in the comments list
     * Each CommentItem renders as an article element
     */
    protected getCommentItems(): Locator {
        return this.getDiscussionSection().locator('article');
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
        return this.page.getByRole('alert').filter({ hasText: translation.pages.expenseDetailPage.containsDepartedMembers });
    }

    /**
     * Get the expense detail dialog/modal container
     */
    protected getExpenseDetailModal(): Locator {
        return this.page.getByRole('dialog');
    }

    /**
     * Get the edit button wrapper element (for tooltip verification)
     */
    protected getEditButtonWrapper(): Locator {
        return this.page.getByTitle(translation.expenseComponents.expenseActions.cannotEditTooltip);
    }

    /**
     * Get the confirmation dialog - identified by aria-labelledby="confirm-dialog-title"
     */
    protected getConfirmationDialog(): Locator {
        return this.page.getByRole('dialog', { name: translation.expenseComponents.expenseActions.deleteTitle });
    }

    /**
     * Get the expense amount display element in the modal - uses aria-label for semantic selection
     */
    protected getExpenseAmountElement(): Locator {
        return this.page.getByRole('dialog').getByLabel(translation.expenseComponents.expenseDetailModal.expenseAmount);
    }

    /**
     * Get the expense detail modal title element (shows description)
     */
    protected getExpenseDetailModalTitle(): Locator {
        return this.page.locator('#expense-detail-modal-title');
    }

    protected getSplitBreakdownCard(): Locator {
        return this.getSplitCard();
    }

    protected getReceiptSection(): Locator {
        return this.getReceiptThumbnail();
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
     * Wait for the expense detail modal to be fully loaded.
     * Note: Expense details are now shown in a modal, so URL stays on group page.
     */
    async waitForPageReady(): Promise<void> {
        // Wait for the expense detail modal to be visible
        await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
        await this.waitForDomContentLoaded();
        // Wait for the Edit button to be visible as a reliable indicator the modal content is ready
        const editButton = this.getEditButton();
        await expect(editButton).toBeVisible();
    }

    /**
     * Click the edit expense button and open the expense form modal.
     * Note: The expense form is now a modal, so URL stays on group page.
     */
    async clickEditExpenseButton(): Promise<void> {
        const editButton = this.getEditButton();
        await this.clickButton(editButton, { buttonName: 'Edit Expense' });
        // Wait for expense form modal to open with specific title (not just any dialog)
        // This avoids race conditions during modal transition from expense detail to expense form
        await expect(
            this.page.getByRole('dialog', { name: translation.expenseComponents.expenseFormModal.editExpense }),
        )
            .toBeVisible({ timeout: 5000 });
        // Wait for form content to be ready (expense details section should be visible in edit mode)
        await expect(this.page.getByRole('region', { name: translation.expenseBasicFields.title })).toBeVisible({ timeout: 5000 });
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
     * Click the copy expense button and open the expense form modal in copy mode.
     * Note: The expense form is now a modal, so URL stays on group page.
     */
    async clickCopyExpenseButton(): Promise<void> {
        const copyButton = this.getCopyButton();
        await this.clickButton(copyButton, { buttonName: 'Copy Expense' });
        // Wait for expense form modal to open with specific title (not just any dialog)
        // This avoids race conditions during modal transition from expense detail to expense form
        await expect(
            this.page.getByRole('dialog', { name: translation.expenseComponents.expenseFormModal.copyExpense }),
        )
            .toBeVisible({ timeout: 5000 });
        // Wait for form content to be ready (expense details section should be visible in copy mode)
        await expect(this.page.getByRole('region', { name: translation.expenseBasicFields.title })).toBeVisible({ timeout: 5000 });
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
        await expect(input).toHaveAttribute('placeholder', translation.comments.commentsSection.placeholderExpense);

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

        // Verify the dialog shows the expense deletion message
        // The deleteConfirm translation contains interpolation but ends with a static warning phrase
        // Extract the static portion after the interpolation: "This action cannot be undone..."
        const deleteConfirmText = translation.expenseComponents.expenseActions.deleteConfirm;
        const staticWarningPortion = deleteConfirmText.split('?')[1]?.trim() || 'cannot be undone';
        await expect(confirmDialog.getByText(new RegExp(staticWarningPortion, 'i'))).toBeVisible();

        // Click the confirm button to actually delete - use translation for exact match
        const confirmButton = confirmDialog.getByRole('button', {
            name: translation.expenseComponents.expenseActions.deleteButton,
        });
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        // Wait for the dialog to close and navigation to occur
        await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });

        // The ExpenseDetailPage should redirect back to the group page after successful deletion
        // We'll let the test verify the URL change rather than asserting it here
    }

    /**
     * Get the current expense description from the modal title
     */
    async getCurrentExpenseDescription(): Promise<string> {
        // Description is now in the modal title
        const titleElement = this.getExpenseDetailModalTitle();
        const description = await titleElement.textContent({ timeout: 1500 });
        return description?.trim() || '';
    }

    /**
     * Get the current currency amount from the modal
     */
    async getCurrentCurrencyAmount(): Promise<string> {
        // Use the specific data-testid for the expense amount display in modal
        const expenseAmountElement = this.getExpenseAmountElement();
        const amountText = await expenseAmountElement.textContent({ timeout: 1500 });
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

        // Verify banner contains explanation about departed members
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
        await expect(this.getEditButtonWrapper()).toBeVisible();
    }

    /**
     * Verify the expense detail modal is visible
     */
    async verifyModalVisible(): Promise<void> {
        await expect(this.getExpenseDetailModal()).toBeVisible();
    }

    /**
     * Verify an expense with a specific description is visible in the modal
     */
    async verifyExpenseDescriptionInModal(description: string): Promise<void> {
        await expect(this.getExpenseDetailModal().getByText(description)).toBeVisible();
    }

    /**
     * Verify edit button is enabled
     */
    async verifyEditButtonEnabled(): Promise<void> {
        const editButton = this.getEditButton();
        await expect(editButton).toBeVisible();
        await expect(editButton).toBeEnabled();
    }

    // Reaction methods

    /**
     * Get the reaction bar container on the expense (below the metadata, above actions)
     */
    protected getExpenseReactionBar(): Locator {
        return this.page.getByRole('dialog').getByRole('group', { name: translation.reactions.reactionBarLabel });
    }

    /**
     * Get the add reaction button for the expense
     */
    protected getAddReactionButton(): Locator {
        return this.getExpenseReactionBar().getByRole('button', { name: translation.reactions.addReaction });
    }

    /**
     * Get a reaction pill button by emoji
     * Finds buttons containing the emoji text (not the add button which has '+')
     */
    protected getReactionPill(emoji: ReactionEmoji): Locator {
        return this.getExpenseReactionBar().locator('button').filter({ hasText: emoji });
    }

    /**
     * Get the reaction picker popover
     */
    protected getReactionPicker(): Locator {
        return this.page.getByRole('listbox');
    }

    /**
     * Get a specific emoji button in the reaction picker
     */
    protected getPickerEmojiButton(emoji: ReactionEmoji): Locator {
        return this.getReactionPicker().getByRole('option').filter({ hasText: emoji });
    }

    /**
     * Click the add reaction button to open the picker
     */
    async clickAddReaction(): Promise<void> {
        const button = this.getAddReactionButton();
        await expect(button).toBeVisible();
        await this.clickButton(button, { buttonName: 'Add reaction' });
        // Wait for picker to open
        await expect(this.getReactionPicker()).toBeVisible();
    }

    /**
     * Select an emoji from the reaction picker
     */
    async selectReactionEmoji(emoji: ReactionEmoji): Promise<void> {
        const emojiButton = this.getPickerEmojiButton(emoji);
        await expect(emojiButton).toBeVisible();
        await emojiButton.click();
        // Picker should close after selection
        await expect(this.getReactionPicker()).not.toBeVisible();
    }

    /**
     * Add a reaction to the expense (opens picker and selects emoji)
     */
    async addExpenseReaction(emoji: ReactionEmoji): Promise<void> {
        await this.clickAddReaction();
        await this.selectReactionEmoji(emoji);
    }

    /**
     * Click on an existing reaction pill to toggle it
     */
    async toggleExpenseReaction(emoji: ReactionEmoji): Promise<void> {
        const pill = this.getReactionPill(emoji);
        await expect(pill).toBeVisible();
        await pill.click();
    }

    /**
     * Verify a reaction pill is visible with expected count
     */
    async verifyReactionVisible(emoji: ReactionEmoji, count: number): Promise<void> {
        const pill = this.getReactionPill(emoji);
        await expect(pill).toBeVisible();
        await expect(pill).toContainText(String(count));
    }

    /**
     * Verify a reaction pill is not visible
     */
    async verifyReactionNotVisible(emoji: ReactionEmoji): Promise<void> {
        const pill = this.getReactionPill(emoji);
        await expect(pill).not.toBeVisible();
    }

    /**
     * Verify a reaction pill is highlighted (user has reacted)
     */
    async verifyReactionHighlighted(emoji: ReactionEmoji): Promise<void> {
        const pill = this.getReactionPill(emoji);
        await expect(pill).toHaveAttribute('aria-pressed', 'true');
    }

    /**
     * Verify a reaction pill is not highlighted (user has not reacted)
     */
    async verifyReactionNotHighlighted(emoji: ReactionEmoji): Promise<void> {
        const pill = this.getReactionPill(emoji);
        await expect(pill).toHaveAttribute('aria-pressed', 'false');
    }

    /**
     * Verify the add reaction button is visible
     */
    async verifyAddReactionButtonVisible(): Promise<void> {
        await expect(this.getAddReactionButton()).toBeVisible();
    }

    /**
     * Verify the reaction picker is open
     */
    async verifyReactionPickerOpen(): Promise<void> {
        await expect(this.getReactionPicker()).toBeVisible();
    }

    /**
     * Verify the reaction picker is closed
     */
    async verifyReactionPickerClosed(): Promise<void> {
        await expect(this.getReactionPicker()).not.toBeVisible();
    }

    /**
     * Verify all 6 emoji options are visible in the reaction picker
     */
    async verifyAllPickerEmojisVisible(): Promise<void> {
        const picker = this.getReactionPicker();
        await expect(picker).toBeVisible();
        const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
        for (const emoji of emojis) {
            await expect(picker.getByRole('option').filter({ hasText: emoji })).toBeVisible();
        }
    }

    /**
     * Press Escape key to dismiss the reaction picker
     */
    async pressEscapeToClosePicker(): Promise<void> {
        await this.page.keyboard.press('Escape');
    }

    /**
     * Click outside the reaction picker to dismiss it
     */
    async clickOutsideToClosePicker(): Promise<void> {
        // Click on the modal backdrop area outside the picker
        await this.page.getByRole('dialog').click({ position: { x: 10, y: 10 } });
    }

    // Comment reaction methods

    /**
     * Get a comment item by its text content
     */
    protected getCommentItemByText(text: string): Locator {
        return this.getCommentItems().filter({ hasText: text });
    }

    /**
     * Get the reaction bar for a specific comment
     */
    protected getCommentReactionBar(commentText: string): Locator {
        return this.getCommentItemByText(commentText).getByRole('group', { name: translation.reactions.reactionBarLabel });
    }

    /**
     * Get the add reaction button for a comment
     */
    protected getCommentAddReactionButton(commentText: string): Locator {
        return this.getCommentItemByText(commentText).getByRole('button', { name: translation.reactions.addReaction });
    }

    /**
     * Get a reaction pill on a comment
     */
    protected getCommentReactionPill(commentText: string, emoji: ReactionEmoji): Locator {
        return this.getCommentItemByText(commentText).locator('button').filter({ hasText: emoji });
    }

    /**
     * Click the add reaction button on a comment
     */
    async clickCommentAddReaction(commentText: string): Promise<void> {
        const button = this.getCommentAddReactionButton(commentText);
        await expect(button).toBeVisible();
        await this.clickButton(button, { buttonName: 'Add reaction to comment' });
        await expect(this.getReactionPicker()).toBeVisible();
    }

    /**
     * Add a reaction to a comment
     */
    async addCommentReaction(commentText: string, emoji: ReactionEmoji): Promise<void> {
        await this.clickCommentAddReaction(commentText);
        await this.selectReactionEmoji(emoji);
    }

    /**
     * Toggle a reaction on a comment
     */
    async toggleCommentReaction(commentText: string, emoji: ReactionEmoji): Promise<void> {
        const pill = this.getCommentReactionPill(commentText, emoji);
        await expect(pill).toBeVisible();
        await pill.click();
    }

    /**
     * Verify a comment reaction is visible with count
     */
    async verifyCommentReactionVisible(commentText: string, emoji: ReactionEmoji, count: number): Promise<void> {
        const pill = this.getCommentReactionPill(commentText, emoji);
        await expect(pill).toBeVisible();
        await expect(pill).toContainText(String(count));
    }

    /**
     * Verify a comment reaction is not visible
     */
    async verifyCommentReactionNotVisible(commentText: string, emoji: ReactionEmoji): Promise<void> {
        const pill = this.getCommentReactionPill(commentText, emoji);
        await expect(pill).not.toBeVisible();
    }

    /**
     * Verify a comment reaction is highlighted
     */
    async verifyCommentReactionHighlighted(commentText: string, emoji: ReactionEmoji): Promise<void> {
        const pill = this.getCommentReactionPill(commentText, emoji);
        await expect(pill).toHaveAttribute('aria-pressed', 'true');
    }

    /**
     * Verify a comment reaction is not highlighted
     */
    async verifyCommentReactionNotHighlighted(commentText: string, emoji: ReactionEmoji): Promise<void> {
        const pill = this.getCommentReactionPill(commentText, emoji);
        await expect(pill).toHaveAttribute('aria-pressed', 'false');
    }
}

import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';
import { EditGroupModalPage } from './EditGroupModalPage';
import { LeaveGroupDialogPage } from './LeaveGroupDialogPage';
import { ShareGroupModalPage } from './ShareGroupModalPage';
import { ExpenseFormPage } from './ExpenseFormPage';
import { translationEn } from '../translations/translation-en';
import { GroupId } from '@splitifyd/shared';

const translation = translationEn;

/**
 * Group Detail Page Object Model for Playwright tests
 * Handles group details, members, expenses, balances, and settlements
 * Reusable across unit tests and e2e tests
 */
export class GroupDetailPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // NAVIGATION
    // ============================================================================

    /**
     * Navigate to group detail page by ID
     */
    async navigateToGroup(groupId: GroupId): Promise<void> {
        await this.page.goto(`/groups/${groupId}`);
        await this.waitForNetworkIdle();
    }

    // ============================================================================
    // CONTAINER SELECTORS - Based on user-visible headings
    // ============================================================================

    /**
     * Members section container - found by "Members" heading
     */
    getMembersContainer(): Locator {
        return this
            .page
            .locator('div')
            .filter({
                has: this.page.getByRole('heading').filter({ hasText: /^members$/i }),
            })
            .first();
    }

    /**
     * Expenses section container - found by "Expenses" or "Recent Expenses" heading
     */
    getExpensesContainer(): Locator {
        return this
            .page
            .locator('div')
            .filter({
                has: this.page.getByRole('heading').filter({ hasText: /expenses/i }),
            })
            .first();
    }

    /**
     * Balance/Debts section container - finds the VISIBLE white container with "Balances" heading
     * Works for both sidebar (desktop) and main (mobile) balance summary displays.
     * Uses same selector pattern as e2e tests for consistency.
     * IMPORTANT: Finds ALL containers first, then filters to only visible ones to avoid hidden mobile versions.
     */
    getBalanceContainer(): Locator {
        // Find all white containers with "Balances" heading, then filter to visible
        const allContainers = this
            .page
            .locator('.bg-white')
            .filter({
                has: this.page.getByRole('heading', { name: 'Balances' }),
            });

        // Return only the last visible one (sidebar version on desktop)
        return allContainers.last();
    }

    /**
     * Settlement section container - found by "Settlements" heading
     */
    getSettlementContainer(): Locator {
        return this
            .page
            .locator('div')
            .filter({
                has: this.page.getByRole('heading').filter({ hasText: /payment history|settlement/i }),
            })
            .first();
    }

    private getSettlementHistoryToggle(): Locator {
        return this.getSettlementContainer().getByRole('button', { name: /history/i });
    }

    private getSettlementItems(): Locator {
        return this.getSettlementContainer().locator('[data-testid="settlement-item"]');
    }

    private getSettlementItem(note: string): Locator {
        return this.getSettlementItems().filter({
            has: this.page.getByText(note, { exact: false }),
        });
    }

    protected getSettlementEditButton(note: string): Locator {
        return this.getSettlementItem(note).getByTestId('edit-settlement-button');
    }

    /**
     * Loading spinner
     */
    getLoadingSpinner(): Locator {
        return this.page.locator('[data-testid="loading-spinner"], .animate-spin');
    }

    /**
     * Error container - primary error display area
     */
    getErrorContainer(): Locator {
        return this.page.locator('[data-testid="error-container"]');
    }

    // ============================================================================
    // GROUP HEADER SELECTORS
    // ============================================================================

    /**
     * Group name heading - the main H1 at top of page
     */
    getGroupName(): Locator {
        return this.page.getByRole('heading', { level: 1 });
    }

    /**
     * Convenience helper to read the trimmed group name text.
     */
    async getGroupNameText(): Promise<string> {
        const title = await this.getGroupName().textContent();
        return title?.trim() ?? '';
    }

    /**
     * Group description - paragraph text that appears directly after the group name h1
     * within the GroupHeader component (has text-gray-600 class)
     */
    getGroupDescription(): Locator {
        // Find the h1 heading, go up to its parent div, then find the p.text-gray-600 sibling
        return this.getGroupName().locator('..').locator('p.text-gray-600');
    }

    /**
     * Member count display - finds count near the Members heading
     * Scoped to the header area to avoid matching member lists
     */
    getMemberCount(): Locator {
        // Look for text containing digits and "member" word in the Members section
        return this.getMembersContainer().locator('text=/\\d+\\s*members?/i').first();
    }

    /**
     * Expense count display - finds count near the Expenses heading
     */
    getExpenseCount(): Locator {
        // Use the data-testid attribute for reliable selection
        return this.page.locator('[data-testid="expense-count"]');
    }

    // ============================================================================
    // ACTION BUTTONS
    // ============================================================================

    /**
     * Add Expense button
     */
    getAddExpenseButton(): Locator {
        return this.page.getByRole('button', { name: translation.group.actions.addExpense });
    }

    /**
     * Edit Group button (labeled as "Group Settings")
     * Uses .first() to handle duplicate buttons in sidebar and header
     */
    getEditGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.groupSettings }).first();
    }

    /**
     * Share Group button (labeled as "Invite Others")
     * Uses .first() to handle duplicate buttons in sidebar and elsewhere
     */
    getShareGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.inviteOthers }).first();
    }

    /**
     * Leave Group button
     */
    getLeaveGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.leaveGroup });
    }

    /**
     * Settle Up button
     */
    getSettleUpButton(): Locator {
        return this.page.getByRole('button', { name: translation.group.actions.settleUp });
    }

    // ============================================================================
    // MEMBERS SECTION
    // ============================================================================

    /**
     * Get all member items - looks for list items or cards within members section
     * Excludes action buttons like "Invite Others"
     * Note: Finds members within the first Members container (sidebar) to avoid mobile duplicates
     */
    getMemberCards(): Locator {
        // Members have data-testid="member-item" attribute
        // The members list is in a div.space-y-3 container within the Members section
        // Use .first() to get only the sidebar version (not the mobile duplicate)
        return this.getMembersContainer().locator('.space-y-3').first().locator('[data-testid="member-item"]');
    }

    /**
     * Get specific member by name - searches within members container
     * Uses .first() to get only the sidebar version (not the mobile duplicate)
     */
    getMemberCard(memberName: string): Locator {
        return this.getMembersContainer().locator('.space-y-3').first().getByText(memberName, { exact: false });
    }

    /**
     * Add Member button - looks for button with "add" and "member" text
     */
    getAddMemberButton(): Locator {
        return this.getMembersContainer().getByRole('button', { name: /add.*member/i });
    }

    // ============================================================================
    // EXPENSES SECTION
    // ============================================================================

    /**
     * Get all expense items - looks for articles or list items within expenses section
     */
    getExpenseItems(): Locator {
        return this.getExpensesContainer().locator('[data-testid="expense-item"]');
    }

    /**
     * Get specific expense by description - searches within expenses container
     */
    getExpenseByDescription(description: string): Locator {
        return this.getExpensesContainer().getByText(description);
    }

    /**
     * Empty expenses state - looks for "no expenses" message
     * Targets the <p> element specifically to avoid matching parent containers
     */
    getEmptyExpensesState(): Locator {
        return this
            .getExpensesContainer()
            .locator('p')
            .filter({ hasText: /no.*expenses/i });
    }

    // ============================================================================
    // COMMENTS SECTION
    // ============================================================================

    /**
     * Get the comments section container
     */
    getCommentsSection(): Locator {
        return this.page.getByTestId('comments-section');
    }

    /**
     * Get the comment input textarea
     */
    getCommentInput(): Locator {
        return this.getCommentsSection().getByRole('textbox', { name: /comment text/i });
    }

    /**
     * Get the send comment button
     */
    getSendCommentButton(): Locator {
        return this.getCommentsSection().getByRole('button', { name: /send comment/i });
    }

    /**
     * Get all comments currently rendered
     */
    getCommentItems(): Locator {
        return this.getCommentsSection().locator('[data-testid="comment-item"]');
    }

    /**
     * Get a comment locator by its text content
     */
    getCommentByText(text: string): Locator {
        return this.getCommentsSection().getByText(text);
    }

    /**
     * Add a comment using the UI controls
     */
    async addComment(text: string): Promise<void> {
        const input = this.getCommentInput();
        const sendButton = this.getSendCommentButton();

        await expect(this.getCommentsSection()).toBeVisible();

        await this.fillPreactInput(input, text);

        await expect(sendButton).toBeEnabled();

        await this.clickButton(sendButton, { buttonName: 'Send comment' });

        await expect(sendButton).toBeDisabled({ timeout: 2000 });

        await expect(input).toHaveValue('');
        await expect(sendButton).toBeDisabled();
    }

    /**
     * Wait for a comment containing specific text to become visible
     */
    async waitForCommentToAppear(text: string, timeout: number = 5000): Promise<void> {
        const comment = this.getCommentByText(text);
        await expect(comment).toBeVisible({ timeout });
    }

    /**
     * Wait for the comment count to reach the expected value
     */
    async waitForCommentCount(expectedCount: number, timeout: number = 5000): Promise<void> {
        await expect(async () => {
            const count = await this.getCommentItems().count();
            expect(count).toBe(expectedCount);
        }).toPass({ timeout });
    }

    /**
     * Verify the comments section renders with expected controls
     */
    async verifyCommentsSection(): Promise<void> {
        await expect(this.getCommentsSection()).toBeVisible();

        const input = this.getCommentInput();
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute('placeholder', /add a comment to this group/i);

        const sendButton = this.getSendCommentButton();
        await expect(sendButton).toBeVisible();
        await expect(sendButton).toBeDisabled();
    }

    /**
     * Verify a comment with given text is visible
     */
    async verifyCommentVisible(text: string): Promise<void> {
        await expect(this.getCommentByText(text)).toBeVisible();
    }

    // ============================================================================
    // BALANCE SECTION
    // ============================================================================

    /**
     * Get balance summary heading
     */
    getBalanceSummaryHeading(): Locator {
        return this.getBalanceContainer().getByRole('heading');
    }

    /**
     * Get "All settled up" message - looks for the text within the balance container
     */
    getSettledUpMessage(): Locator {
        return this.getBalanceContainer().getByText(translation.balanceSummary.allSettledUp);
    }

    /**
     * Get debt items - scoped within main balance container
     */
    getDebtItems(): Locator {
        return this.getBalanceContainer().locator('[data-testid="debt-item"]');
    }

    // ============================================================================
    // MODALS
    // ============================================================================

    /**
     * Edit Group Modal
     */
    getEditGroupModal(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByRole('heading', { name: translation.group.edit.title }),
        });
    }

    /**
     * Share Group Modal
     */
    getShareGroupModal(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByRole('heading', { name: translation.group.share.title }),
        });
    }

    /**
     * Leave Group Dialog
     */
    getLeaveGroupDialog(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByText(/leave.*group/i),
        });
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Verify group detail page loaded successfully
     */
    async verifyGroupDetailPageLoaded(groupName: string): Promise<void> {
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9\-_]+/);
        await expect(this.getGroupName()).toContainText(groupName);
    }

    /**
     * Verify loading state
     */
    async verifyLoadingState(): Promise<void> {
        await expect(this.getLoadingSpinner()).toBeVisible();
    }

    /**
     * Wait for group to finish loading
     */
    async waitForGroupToLoad(): Promise<void> {
        await expect(this.getLoadingSpinner()).not.toBeVisible({ timeout: 5000 });
    }

    /**
     * Verify error state - handles both inline errors and 404 page
     */
    async verifyErrorState(errorMessage?: string): Promise<void> {
        await expect(this.getErrorContainer()).toBeVisible();
        if (errorMessage) {
            // For 404 pages, the message might be in the body, not the heading
            await expect(this.page.locator('body')).toContainText(errorMessage);
        }
    }

    /**
     * Verify members are displayed
     */
    async verifyMembersDisplayed(count: number): Promise<void> {
        await expect(this.getMemberCards()).toHaveCount(count);
    }

    /**
     * Verify specific member is displayed
     */
    async verifyMemberDisplayed(memberName: string): Promise<void> {
        await expect(this.getMemberCard(memberName)).toBeVisible();
    }

    /**
     * Verify expenses are displayed
     */
    async verifyExpensesDisplayed(count: number): Promise<void> {
        await expect(this.getExpenseItems()).toHaveCount(count);
    }

    /**
     * Verify specific expense is displayed
     */
    async verifyExpenseDisplayed(description: string): Promise<void> {
        await expect(this.getExpenseByDescription(description)).toBeVisible();
    }

    /**
     * Verify empty expenses state
     */
    async verifyEmptyExpensesState(): Promise<void> {
        await expect(this.getEmptyExpensesState()).toBeVisible();
    }

    /**
     * Verify balances are settled up
     */
    async verifySettledUp(): Promise<void> {
        await expect(this.getSettledUpMessage()).toBeVisible();
    }

    /**
     * Verify user has debts
     */
    async verifyHasDebts(): Promise<void> {
        await expect(this.getDebtItems().first()).toBeVisible();
    }

    /**
     * Verify specific debt relationship with exact amount
     * Uses polling pattern to wait for real-time balance updates
     * @param debtorName - Name of the person who owes money
     * @param creditorName - Name of the person who is owed money
     * @param expectedAmount - Expected debt amount as formatted string (e.g., "$25.00")
     */
    async verifyDebtRelationship(debtorName: string, creditorName: string, expectedAmount: string): Promise<void> {
        await expect(async () => {
            // Wait for balance container to be visible first
            const balancesSection = this.getBalanceContainer();
            const isVisible = await balancesSection.isVisible().catch(() => false);
            if (!isVisible) {
                throw new Error('Balance section not visible yet');
            }

            // Find all debt relationship spans with the expected text pattern
            const debtRelationshipSpans = balancesSection.locator('span').filter({
                hasText: new RegExp(`${debtorName}\\s*→\\s*${creditorName}`),
            });

            const count = await debtRelationshipSpans.count();
            if (count === 0) {
                // Get all debt items for better error message
                const allDebtItems = balancesSection.locator('[data-testid="debt-item"]');
                const debtItemsCount = await allDebtItems.count();

                let foundDebts: string[] = [];
                for (let i = 0; i < debtItemsCount; i++) {
                    const item = allDebtItems.nth(i);
                    const text = await item.textContent();
                    foundDebts.push(text || '(empty)');
                }

                throw new Error(
                    `Debt relationship not found: ${debtorName} → ${creditorName}\n`
                        + `Check if both users are in the group and have expenses.\n`
                        + `Found ${debtItemsCount} debt items: ${foundDebts.join(' | ')}`,
                );
            }

            // Check each relationship to find one with the matching amount
            let foundMatchingAmount = false;
            let actualAmounts: string[] = [];

            for (let i = 0; i < count; i++) {
                const relationshipSpan = debtRelationshipSpans.nth(i);
                // Find the parent container and look for the amount span
                const parentContainer = relationshipSpan.locator('..');
                const amountSpan = parentContainer.locator('[data-financial-amount="debt"]');

                const actualAmount = await amountSpan.textContent().catch(() => null);
                if (actualAmount) {
                    // Normalize only the actual amount from screen - replace non-breaking spaces with regular spaces
                    // Expected amount should use regular spaces in tests for readability
                    const normalizedActual = actualAmount.trim().replace(/\u00A0/g, ' ');
                    const trimmedExpected = expectedAmount.trim();

                    actualAmounts.push(actualAmount);

                    if (normalizedActual === trimmedExpected) {
                        foundMatchingAmount = true;
                        break;
                    }
                }
            }

            if (!foundMatchingAmount) {
                throw new Error(
                    `Debt amount mismatch for ${debtorName} → ${creditorName}\n`
                        + `Expected: "${expectedAmount}"\n`
                        + `Found amounts: ${actualAmounts.join(', ')}`,
                );
            }

            // If we get here, everything matches!
        })
            .toPass({
                timeout: 3000,
                intervals: [50, 100, 200, 500],
            });
    }

    /**
     * Open settlement history if the toggle is visible
     */
    async openSettlementHistory(): Promise<void> {
        const toggle = this.getSettlementHistoryToggle();
        if (await toggle.isVisible()) {
            await toggle.click();
        }
    }

    /**
     * Verify settlement with specific note is visible
     */
    async verifySettlementVisible(note: string): Promise<void> {
        await expect(this.getSettlementItem(note)).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    /**
     * Verify settlement edit button is disabled
     */
    async verifySettlementEditDisabled(note: string, expectedTooltip?: string): Promise<void> {
        const button = this.getSettlementEditButton(note);
        await expect(button).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(button).toBeDisabled();
        if (expectedTooltip) {
            await expect(button).toHaveAttribute('title', expectedTooltip);
        }
    }

    /**
     * Verify settlement edit button is enabled
     */
    async verifySettlementEditEnabled(note: string, expectedTooltip?: string): Promise<void> {
        const button = this.getSettlementEditButton(note);
        await expect(button).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(button).toBeEnabled();
        if (expectedTooltip) {
            await expect(button).toHaveAttribute('title', expectedTooltip);
        }
    }

    /**
     * Click Add Expense button
     * Non-fluent version - clicks without verification.
     * Prefer clickAddExpenseAndOpenForm for end-to-end flows when possible.
     */
    async clickAddExpense(): Promise<void> {
        const button = this.getAddExpenseButton();
        await this.clickButton(button, { buttonName: 'Add Expense' });
        // Note: No waitForNetworkIdle() here - the form's waitForFormReady() handles page load
    }

    /**
     * Click Add Expense and return an expense form page object.
     */
    async clickAddExpenseAndOpenForm<T = ExpenseFormPage>(
        expectedMemberNames: string[],
        createExpenseFormPage?: (page: Page) => T,
    ): Promise<T> {
        await this.clickAddExpense();
        const formPage = createExpenseFormPage
            ? createExpenseFormPage(this.page)
            : ((new ExpenseFormPage(this.page)) as unknown as T);

        const guards = formPage as unknown as {
            waitForFormReady?: (expectedMemberNames: string[]) => Promise<void>;
        };

        if (typeof guards.waitForFormReady === 'function') {
            await guards.waitForFormReady(expectedMemberNames);
        }

        return formPage;
    }

    // ============================================================================
    // Modal/Dialog Actions - Following Fluent Interface Pattern
    // Each action has two versions:
    // 1. Non-fluent: clickX() - performs action only, for flexibility
    // 2. Fluent: clickXAndOpenModal/Dialog() - performs action + verifies + returns page object
    // ============================================================================

    /**
     * Click Edit Group button
     * Non-fluent version - clicks without verification, for flexibility
     */
    async clickEditGroup(): Promise<void> {
        const button = this.getEditGroupButton();
        await this.clickButton(button, { buttonName: 'Edit Group' });
    }

    /**
     * Click Edit Group button and open edit modal
     * Fluent version - verifies modal opens and returns EditGroupModalPage
     */
    async clickEditGroupAndOpenModal(): Promise<EditGroupModalPage> {
        await this.clickEditGroup();

        const modalPage = new EditGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
        return modalPage;
    }

    /**
     * Click Share Group button
     * Non-fluent version - clicks without verification, for flexibility
     */
    async clickShareGroup(): Promise<void> {
        const button = this.getShareGroupButton();
        await this.clickButton(button, { buttonName: 'Share Group' });
    }

    /**
     * Click Share Group button and open share modal
     * Fluent version - verifies modal opens and returns ShareGroupModalPage
     */
    async clickShareGroupAndOpenModal(): Promise<ShareGroupModalPage> {
        await this.clickShareGroup();

        const modalPage = new ShareGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
        return modalPage;
    }

    /**
     * Click Leave Group button
     * Non-fluent version - clicks without verification, for flexibility
     */
    async clickLeaveGroup(): Promise<void> {
        const button = this.getLeaveGroupButton();
        await this.clickButton(button, { buttonName: 'Leave Group' });
    }

    /**
     * Click Leave Group button and open leave dialog
     * Fluent version - verifies dialog opens and returns LeaveGroupDialogPage
     */
    async clickLeaveGroupAndOpenDialog(): Promise<LeaveGroupDialogPage> {
        await this.clickLeaveGroup();

        const dialogPage = new LeaveGroupDialogPage(this.page);
        await dialogPage.waitForDialogToOpen();
        return dialogPage;
    }

    /**
     * Verify Edit Group button is NOT visible (permission check)
     */
    async verifyCannotEditGroup(): Promise<void> {
        await expect(this.getEditGroupButton()).not.toBeVisible();
    }

    /**
     * Verify Leave Group button is NOT visible (owner or last member)
     */
    async verifyCannotLeaveGroup(): Promise<void> {
        await expect(this.getLeaveGroupButton()).not.toBeVisible();
    }

    /**
     * Wait for network to be idle
     */
    private async waitForNetworkIdle(): Promise<void> {
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Wait for expense to appear
     */
    async waitForExpenseToAppear(description: string, timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        await expect(this.getExpenseByDescription(description)).toBeVisible({ timeout });
    }

    /**
     * Wait for member to appear
     */
    async waitForMemberToAppear(memberName: string, timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        await expect(this.getMemberCard(memberName)).toBeVisible({ timeout });
    }

    /**
     * Verify user can perform owner actions
     */
    async verifyOwnerActions(): Promise<void> {
        await expect(this.getEditGroupButton()).toBeVisible();
        await expect(this.getShareGroupButton()).toBeVisible();
    }

    /**
     * Verify user can only perform member actions
     */
    async verifyMemberActions(): Promise<void> {
        await expect(this.getEditGroupButton()).not.toBeVisible();
        await expect(this.getLeaveGroupButton()).toBeVisible();
    }
}

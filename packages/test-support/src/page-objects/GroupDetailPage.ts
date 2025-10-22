import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';
import { GroupSettingsModalPage } from './GroupSettingsModalPage';
import { LeaveGroupDialogPage } from './LeaveGroupDialogPage';
import { ShareGroupModalPage } from './ShareGroupModalPage';
import { ExpenseFormPage } from './ExpenseFormPage';
import { ExpenseDetailPage } from './ExpenseDetailPage';
import { SettlementFormPage } from './SettlementFormPage';
import { RemoveMemberDialogPage } from './RemoveMemberDialogPage';
import { HeaderPage } from './HeaderPage';
import { translationEn } from '../translations/translation-en';
import { GroupId } from '@splitifyd/shared';

const translation = translationEn;

/**
 * Group Detail Page Object Model for Playwright tests
 * Handles group details, members, expenses, balances, and settlements
 * Reusable across unit tests and e2e tests
 */
export class GroupDetailPage extends BasePage {
    private _header?: HeaderPage;

    constructor(page: Page) {
        super(page);
    }

    /**
     * Build a regex that matches a group detail URL, optionally scoped to a specific group ID.
     */
    static groupDetailUrlPattern(groupId?: string): RegExp {
        if (groupId) {
            return new RegExp(`/groups/${groupId}$`);
        }
        return /\/groups\/[a-zA-Z0-9]+$/;
    }

    /**
     * Header page object for user menu and navigation functionality.
     */
    get header(): HeaderPage {
        if (!this._header) {
            this._header = new HeaderPage(this.page);
        }
        return this._header;
    }

    /**
     * Infer group ID from the current URL.
     */
    inferGroupId(): GroupId {
        const url = new URL(this.page.url());
        const match = url.pathname.match(/\/groups\/([a-zA-Z0-9]+)/);
        if (!match) {
            throw new Error(`Could not infer group ID from URL: ${url.pathname}`);
        }
        return match[1] as GroupId;
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
    // PAGE STATE HELPERS
    // ============================================================================

    /**
     * Wait for the group title heading to match the expected text.
     */
    async waitForGroupTitle(expectedText: string, timeout: number = 5000): Promise<void> {
        await this.waitForDomContentLoaded();

        await expect(async () => {
            const title = await this.getGroupName().textContent();
            const normalizedTitle = (title ?? '').trim();
            if (normalizedTitle !== expectedText) {
                throw new Error(`Title is still "${normalizedTitle}", waiting for "${expectedText}"`);
            }
        }).toPass({
            timeout,
            intervals: [500, 1000, 1500, 2000],
        });
    }

    /**
     * Wait for the group description text to match the expected text.
     */
    async waitForGroupDescription(expectedText: string, timeout: number = 5000): Promise<void> {
        await this.waitForDomContentLoaded();

        await expect(async () => {
            const description = await this.getGroupDescription().textContent();
            const normalizedDescription = (description ?? '').trim();
            if (normalizedDescription !== expectedText) {
                throw new Error(`Description is still "${normalizedDescription}", waiting for "${expectedText}"`);
            }
        }).toPass({
            timeout,
            intervals: [500, 1000, 1500, 2000],
        });
    }

    /**
     * Wait for critical parts of the group detail page to load and remain consistent.
     */
    async waitForPage(groupId: GroupId, expectedMemberCount: number): Promise<void> {
        const targetPattern = GroupDetailPage.groupDetailUrlPattern(groupId);

        await this.expectUrl(targetPattern);
        await this.header.getCurrentUserDisplayName();

        await this.waitForMemberCount(expectedMemberCount);
        await this.expectUrl(targetPattern);

        await this.waitForBalancesSection(groupId);
        await this.expectUrl(targetPattern);
    }

    /**
     * Wait until the browser navigates away from the specified group detail page.
     */
    async waitForRedirectAwayFromGroup(groupId: GroupId, timeout: number = 5000): Promise<void> {
        await expect(this.page).not.toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId), { timeout });
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

    private getBalanceToggle(): Locator {
        return this.getBalanceContainer().getByTestId('toggle-balance-section');
    }

    private getCommentsToggle(): Locator {
        return this.page.getByTestId('toggle-comments-section');
    }

    private getSettlementsToggle(): Locator {
        return this.getSettlementContainer().getByTestId('toggle-settlements-section');
    }

    private getShowAllSettlementsCheckbox(): Locator {
        return this.getSettlementContainer().getByTestId('show-all-settlements-checkbox');
    }

    private async ensureToggleExpanded(toggle: Locator): Promise<void> {
        await expect(toggle).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        const expanded = await toggle.getAttribute('aria-expanded');
        if (expanded === 'true') {
            return;
        }

        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }

    async ensureBalancesSectionExpanded(): Promise<void> {
        await this.ensureToggleExpanded(this.getBalanceToggle());
    }

    async expectBalancesCollapsed(): Promise<void> {
        const toggle = this.getBalanceToggle();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }

    async expectBalancesExpanded(): Promise<void> {
        const toggle = this.getBalanceToggle();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }

    async ensureCommentsSectionExpanded(): Promise<void> {
        await this.ensureToggleExpanded(this.getCommentsToggle());
        await expect(this.getCommentsSection()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    async expectCommentsCollapsed(): Promise<void> {
        const toggle = this.getCommentsToggle();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }

    async ensureSettlementsSectionExpanded(): Promise<void> {
        await this.ensureToggleExpanded(this.getSettlementsToggle());
        await expect(this.getSettlementContainer()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    async expectSettlementsCollapsed(): Promise<void> {
        const toggle = this.getSettlementsToggle();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }

    private getSettlementItems(): Locator {
        return this.getSettlementContainer().locator('[data-testid="settlement-item"]');
    }

    private getSettlementItem(note: string | RegExp): Locator {
        const pattern = typeof note === 'string' ? new RegExp(note, 'i') : note;
        return this.getSettlementItems().filter({
            hasText: pattern,
        });
    }

    protected getSettlementEditButton(note: string | RegExp): Locator {
        return this.getSettlementItem(note).getByTestId('edit-settlement-button');
    }

    protected getSettlementDeleteButton(note: string | RegExp): Locator {
        return this.getSettlementItem(note).getByTestId('delete-settlement-button');
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
     * Member count display - finds count in the group header card
     */
    getMemberCount(): Locator {
        // Use the data-testid from GroupHeader component
        return this.page.locator('[data-testid="member-count"]');
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
     * Settings button (opens the Group Settings modal)
     * Uses .first() to handle duplicate buttons in sidebar and header
     */
    getEditGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.settings }).first();
    }

    getSecuritySettingsButton(): Locator {
        return this.getEditGroupButton();
    }

    async openSecuritySettings(): Promise<GroupSettingsModalPage> {
        return this.clickEditGroupAndOpenModal('security');
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

    /**
     * Click Settle Up button and return a settlement form page object.
     */
    async clickSettleUpButton<T extends SettlementFormPage = SettlementFormPage>(
        expectedMemberCount: number,
        options: {
            createSettlementFormPage?: (page: Page) => T;
            waitForFormReady?: boolean;
            ensureModalVisible?: boolean;
        } = {},
    ): Promise<T> {
        const button = this.getSettleUpButton();
        await this.clickButton(button, { buttonName: 'Settle up' });

        const createSettlementFormPage =
            options.createSettlementFormPage
            ?? ((page: Page) => new SettlementFormPage(page) as unknown as T);

        const settlementFormPage = createSettlementFormPage(this.page);

        const guards = settlementFormPage as unknown as {
            waitForFormReady?: (expectedMemberCount: number) => Promise<void>;
            getModal?: () => Locator;
        };

        if ((options.ensureModalVisible ?? true) && typeof guards.getModal === 'function') {
            const modal = guards.getModal();
            await expect(modal).toBeVisible();
        }

        if ((options.waitForFormReady ?? true) && typeof guards.waitForFormReady === 'function') {
            await guards.waitForFormReady(expectedMemberCount);
        }

        return settlementFormPage;
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
        // The members list is in a div.space-y-0.5 container within the Members section (updated for compact design)
        // Use .first() to get only the sidebar version (not the mobile duplicate)
        return this.getMembersContainer().locator('.space-y-0\\.5').first().locator('[data-testid="member-item"]');
    }

    /**
     * Get specific member by name - searches within members container
     * Uses .first() to get only the sidebar version (not the mobile duplicate)
     */
    getMemberCard(memberName: string): Locator {
        return this.getMembersContainer().locator('.space-y-0\\.5').first().getByText(memberName, { exact: false });
    }

    /**
     * Get the actual member count displayed in the header
     */
    async getCurrentMemberCount(): Promise<number> {
        const memberCountElement = this.getMemberCount();
        await expect(memberCountElement).toBeVisible({ timeout: 1000 });

        const memberText = await memberCountElement.textContent();
        if (!memberText) {
            throw new Error('Could not find member count text in UI');
        }

        const match = memberText.match(/(\d+)\s+member/i);
        if (!match) {
            throw new Error(`Could not parse member count from text: "${memberText}"`);
        }

        return parseInt(match[1], 10);
    }

    /**
     * Get display names for all members currently rendered
     */
    async getMemberNames(): Promise<string[]> {
        const memberItems = this.getMemberCards();
        const count = await memberItems.count();
        const names: string[] = [];

        for (let i = 0; i < count; i++) {
            const item = memberItems.nth(i);
            const name = await item.getAttribute('data-member-name');
            if (name) {
                names.push(name);
            }
        }

        return names;
    }

    /**
     * Wait for the member list and header count to match the expected value.
     */
    async waitForMemberCount(expectedCount: number, timeout: number = 5000): Promise<void> {
        await expect(async () => {
            const textCount = await this.getCurrentMemberCount().catch(() => -1);
            const actualItems = await this.getMemberCards().count();

            if (textCount !== expectedCount || actualItems !== expectedCount) {
                const memberNames = await this.getMemberNames();
                throw new Error(
                    `Member count mismatch. Expected: ${expectedCount}, `
                        + `Header shows: ${textCount}, Items: ${actualItems}. `
                        + `Members: [${memberNames.join(', ')}]. URL: ${this.page.url()}`,
                );
            }
        }).toPass({ timeout });
    }

    /**
     * Locate a specific member entry by display name.
     */
    getMemberItem(memberName: string): Locator {
        return this
            .getMembersContainer()
            .locator(`[data-testid="member-item"][data-member-name="${memberName}"]:visible`);
    }

    /**
     * Get the remove member button for a given member.
     */
    getRemoveMemberButton(memberName: string): Locator {
        return this.getMemberItem(memberName).locator('[data-testid="remove-member-button"]');
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
     * Click on an expense and return the expense detail page for further assertions.
     */
    async clickExpenseToView(description: string): Promise<ExpenseDetailPage> {
        const expense = this.getExpenseByDescription(description);
        await expense.click();

        const expenseDetailPage = new ExpenseDetailPage(this.page);
        await expenseDetailPage.waitForPageReady();

        return expenseDetailPage;
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
        await this.ensureCommentsSectionExpanded();

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
        await this.ensureCommentsSectionExpanded();

        const comment = this.getCommentByText(text);
        await expect(comment).toBeVisible({ timeout });
    }

    /**
     * Wait for the comment count to reach the expected value
     */
    async waitForCommentCount(expectedCount: number, timeout: number = 5000): Promise<void> {
        await this.ensureCommentsSectionExpanded();

        await expect(async () => {
            const count = await this.getCommentItems().count();
            expect(count).toBe(expectedCount);
        }).toPass({ timeout });
    }

    /**
     * Verify the comments section renders with expected controls
     */
    async verifyCommentsSection(): Promise<void> {
        await this.ensureCommentsSectionExpanded();

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
        await this.ensureCommentsSectionExpanded();

        await expect(this.getCommentByText(text)).toBeVisible();
    }

    /**
     * Verify the group header displays the expected name
     */
    async verifyGroupNameText(expectedText: string): Promise<void> {
        const actualText = await this.getGroupNameText();
        expect(actualText).toBe(expectedText);
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

    /**
     * Get debt entry describing a debtor → creditor relationship.
     */
    getDebtInfo(debtorName: string, creditorName: string): Locator {
        const balancesSection = this.getBalanceContainer();
        return balancesSection
            .getByText(`${debtorName} → ${creditorName}`)
            .or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
    }

    /**
     * Get settlement button for a specific debt item
     * The button appears within debt items where the current user is the payer
     */
    getSettlementButtonForDebt(debtorName: string, creditorName: string): Locator {
        const balancesSection = this.getBalanceContainer();
        // Find the debt item containing the debtor and creditor names
        const debtItem = balancesSection.locator('[data-testid="debt-item"]').filter({
            hasText: new RegExp(`${debtorName}.*owes.*${creditorName}`),
        });
        // Find the button with aria-label containing "Record settlement"
        return debtItem.locator('button[aria-label*="settlement"]');
    }

    /**
     * Toggle the "Show all" balances filter
     * @param checked - true to show all balances, false to show only user's balances
     */
    async toggleShowAllBalances(checked: boolean): Promise<void> {
        const balancesSection = this.getBalanceContainer();
        const checkbox = balancesSection.getByRole('checkbox');
        const isChecked = await checkbox.isChecked();

        if (isChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleShowAllSettlements(checked: boolean): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const checkbox = this.getShowAllSettlementsCheckbox();
        const isChecked = await checkbox.isChecked();

        if (isChecked !== checked) {
            await checkbox.click();
        }
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
     * Click remove member button and return the confirmation dialog page.
     */
    async clickRemoveMember(memberName: string): Promise<RemoveMemberDialogPage> {
        const memberItem = this.getMemberItem(memberName);
        try {
            await expect(memberItem).toBeVisible({ timeout: 5000 });
        } catch (error) {
            const visibleMemberItems = await this.page.locator('[data-testid="member-item"]:visible').all();
            const visibleMembers = await Promise.all(
                visibleMemberItems.map(async (item) => {
                    const text = await item.innerText();
                    const dataName = await item.getAttribute('data-member-name');
                    return `${text.replace(/\n/g, ' ')} [data-member-name="${dataName}"]`;
                }),
            );
            const message = [
                `Failed to find visible member "${memberName}".`,
                `Visible members:`,
                visibleMembers.map((m, index) => `  ${index + 1}. ${m}`).join('\n') || '  (none)',
            ].join('\n');
            throw new Error(message);
        }

        const removeButton = this.getRemoveMemberButton(memberName);
        await this.clickButton(removeButton, { buttonName: `Remove ${memberName}` });

        const removeModal = new RemoveMemberDialogPage(this.page);
        await removeModal.waitForDialogVisible();
        return removeModal;
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
     * Verify expense list contains description (and optional amount)
     */
    async verifyExpenseInList(description: string, amount?: string): Promise<void> {
        await expect(this.getExpenseByDescription(description)).toBeVisible();
        if (amount) {
            await expect(this.page.getByText(amount)).toBeVisible();
        }
    }

    /**
     * Verify a payer and currency amount combination appears inside expenses
     */
    async verifyCurrencyAmountInExpenses(payer: string, currencyAmount: string): Promise<void> {
        const expensesHeading = this.page.getByRole('heading', { name: /Expenses/i });
        await expect(expensesHeading).toBeVisible({ timeout: 2000 });

        const expensesContainer = this.getExpensesContainer();
        await expect(expensesContainer).toBeVisible();

        await expect(async () => {
            const expenseItems = expensesContainer.locator('[data-testid="expense-item"]');
            const count = await expenseItems.count();

            if (count === 0) {
                throw new Error('No expense items found yet');
            }

            let found = false;
            const debugInfo: Array<{ index: number; text: string; hasPayer: boolean; hasAmount: boolean; }> = [];

            for (let i = 0; i < count; i++) {
                const item = expenseItems.nth(i);
                const text = await item.textContent();

                if (text) {
                    const normalizedText = text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                    const normalizedPayer = payer.replace(/\u00A0/g, ' ').trim();
                    const normalizedAmount = currencyAmount.replace(/\u00A0/g, ' ').trim();

                    const hasPayer = normalizedText.includes(normalizedPayer);
                    const hasAmount = normalizedText.includes(normalizedAmount);

                    debugInfo.push({
                        index: i,
                        text: normalizedText,
                        hasPayer,
                        hasAmount,
                    });

                    if (hasPayer && hasAmount) {
                        found = true;
                        break;
                    }
                }
            }

            if (!found) {
                const details = debugInfo
                    .map((entry) => `  [${entry.index}] hasPayer=${entry.hasPayer}, hasAmount=${entry.hasAmount}\n     Text: "${entry.text.substring(0, 200)}${entry.text.length > 200 ? '...' : ''}"`)
                    .join('\n');

                throw new Error(
                    `No expense found with payer "${payer}" AND amount "${currencyAmount}"\n`
                        + `Found ${count} expense(s):\n${details}\n`
                        + `Looking for payer: "${payer}"\n`
                        + `Looking for amount: "${currencyAmount}"`,
                );
            }
        }).toPass({ timeout: 5000 });
    }

    /**
     * Wait for an expense with the given description to appear.
     */
    async waitForExpense(description: string, timeout: number = 5000): Promise<void> {
        await expect(async () => {
            const expenseElement = this.getExpenseByDescription(description);
            const count = await expenseElement.count();
            if (count === 0) {
                throw new Error(`Expense with description "${description}" not found yet`);
            }

            const visible = await expenseElement.first().isVisible();
            if (!visible) {
                throw new Error(`Expense with description "${description}" found but not visible yet`);
            }
        }).toPass({
            timeout,
            intervals: [100, 200, 300, 500, 1000],
        });
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
        await this.ensureBalancesSectionExpanded();
        await expect(this.getSettledUpMessage()).toBeVisible();
    }

    /**
     * Verify user has debts
     */
    async verifyHasDebts(): Promise<void> {
        await this.ensureBalancesSectionExpanded();
        await expect(this.getDebtItems().first()).toBeVisible();
    }

    /**
     * Wait for balances section to render and loading indicator (if any) to disappear.
     */
    async waitForBalancesSection(groupId: GroupId, timeout: number = 3000): Promise<void> {
        const currentUrl = this.page.url();
        if (!currentUrl.includes(`/groups/${groupId}`)) {
            throw new Error(`waitForBalancesSection called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`);
        }

        const balancesSection = this.getBalanceContainer();
        await expect(balancesSection).toBeVisible({ timeout });

        try {
            await expect(balancesSection.getByText('Loading balances...')).not.toBeVisible({ timeout: 2000 });
        } catch {
            // Loading text may not appear; ignore timeout
        }
    }

    /**
     * Utility to ensure a newly created group page is ready for interactions.
     */
    async ensureNewGroupPageReadyWithOneMember(groupId: GroupId): Promise<void> {
        await this.waitForDomContentLoaded();
        await this.waitForMemberCount(1);
        await this.waitForBalancesSection(groupId);
    }

    /**
     * Verify that a specific debt relationship is no longer visible.
     */
    async verifyNoDebtRelationship(debtorName: string, creditorName: string, timeout: number = 5000): Promise<void> {
        await this.ensureBalancesSectionExpanded();

        await expect(async () => {
            const debtInfo = this.getDebtInfo(debtorName, creditorName);
            const count = await debtInfo.count();
            if (count > 0) {
                throw new Error(`Debt relationship still exists: ${debtorName} → ${creditorName}`);
            }
        })
            .toPass({ timeout });
    }

    /**
     * Verify that the group is fully settled up (no outstanding balances).
     * Optionally assert that the current URL corresponds to the provided group ID.
     */
    async verifyAllSettledUp(groupId?: GroupId, timeout: number = 3000): Promise<void> {
        if (groupId) {
            const currentUrl = this.page.url();
            if (!currentUrl.includes(`/groups/${groupId}`)) {
                throw new Error(`verifyAllSettledUp called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`);
            }
        }

        await this.ensureBalancesSectionExpanded();
        await expect(this.getSettledUpMessage()).toBeVisible({ timeout });

        const debtElements = this.getBalanceContainer().locator('[data-financial-amount="debt"]');
        await expect(debtElements).toHaveCount(0);
    }

    /**
     * Verify specific debt relationship with exact amount
     * Uses polling pattern to wait for real-time balance updates
     * @param debtorName - Name of the person who owes money
     * @param creditorName - Name of the person who is owed money
     * @param expectedAmount - Expected debt amount as formatted string (e.g., "$25.00")
     */
    async verifyDebtRelationship(debtorName: string, creditorName: string, expectedAmount: string): Promise<void> {
        await this.ensureBalancesSectionExpanded();

        await expect(async () => {
            // Wait for balance container to be visible first
            const balancesSection = this.getBalanceContainer();
            const isVisible = await balancesSection.isVisible().catch(() => false);
            if (!isVisible) {
                throw new Error('Balance section not visible yet');
            }

            // Find debt items containing both names - supports both old (→) and new (owes...to) format
            const debtItems = balancesSection.locator('[data-testid="debt-item"]').filter({
                hasText: debtorName,
            }).filter({
                hasText: creditorName,
            });

            const count = await debtItems.count();
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

            // Check each debt item to find one with the matching amount
            let foundMatchingAmount = false;
            let actualAmounts: string[] = [];

            for (let i = 0; i < count; i++) {
                const debtItem = debtItems.nth(i);
                // Find the amount span within this debt item
                const amountSpan = debtItem.locator('[data-financial-amount="debt"]');

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
     * Ensure the settlement history panel is open.
     * Idempotent: if history is already visible, nothing happens.
     */
    async ensureSettlementHistoryOpen(): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
    }

    /**
     * Open settlement history (for legacy call sites).
     */
    async openSettlementHistory(): Promise<void> {
        await this.ensureSettlementHistoryOpen();
    }

    /**
     * Legacy alias retained for backwards compatibility.
     */
    async openHistoryIfClosed(): Promise<void> {
        await this.ensureSettlementHistoryOpen();
    }

    /**
     * Verify settlement with specific note is visible
     */
    async verifySettlementVisible(note: string | RegExp): Promise<void> {
        await expect(this.getSettlementItem(note)).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    /**
     * Verify settlement edit button is disabled
     */
    async verifySettlementEditDisabled(note: string | RegExp, expectedTooltip?: string): Promise<void> {
        const button = this.getSettlementEditButton(note);
        await expect(button).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(button).toBeDisabled();
        if (expectedTooltip) {
            await expect(button).toHaveAttribute('aria-label', expectedTooltip);
        }
    }

    /**
     * Verify settlement edit button is enabled
     */
    async verifySettlementEditEnabled(note: string | RegExp, expectedTooltip?: string): Promise<void> {
        const button = this.getSettlementEditButton(note);
        await expect(button).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(button).toBeEnabled();
        if (expectedTooltip) {
            await expect(button).toHaveAttribute('aria-label', expectedTooltip);
        }
    }

    /**
     * Click edit on an existing settlement and return the form page object.
     * Provides optional hooks to customise the returned form instance and readiness checks.
     */
    async clickEditSettlement<T extends SettlementFormPage = SettlementFormPage>(
        note: string | RegExp,
        options: {
            createSettlementFormPage?: (page: Page) => T;
            expectedMemberCount?: number;
            waitForFormReady?: boolean;
            ensureUpdateHeading?: boolean;
        } = {},
    ): Promise<T> {
        await this.ensureSettlementHistoryOpen();

        const editButton = this.getSettlementEditButton(note);
        await expect(editButton).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(editButton).toBeEnabled();

        await this.clickButton(editButton, { buttonName: 'Edit Settlement' });

        const modal = this.page.getByRole('dialog');
        await expect(modal).toBeVisible({ timeout: 3000 });

        if (options.ensureUpdateHeading !== false) {
            await expect(modal.getByRole('heading', { name: /Update Settlement/i })).toBeVisible();
        }

        const createFormPage =
            options.createSettlementFormPage
            ?? ((page: Page) => new SettlementFormPage(page) as unknown as T);

        const settlementFormPage = createFormPage(this.page);
        await expect(settlementFormPage.getModal()).toBeVisible();

        const shouldWaitForFormReady = options.waitForFormReady ?? true;
        if (shouldWaitForFormReady) {
            const guards = settlementFormPage as unknown as {
                waitForFormReady?: (expectedMemberCount: number) => Promise<void>;
            };

            if (typeof guards.waitForFormReady === 'function') {
                let expectedMemberCount = options.expectedMemberCount;
                if (expectedMemberCount === undefined) {
                    try {
                        expectedMemberCount = await this.getCurrentMemberCount();
                    } catch {
                        expectedMemberCount = undefined;
                    }
                }

                if (expectedMemberCount !== undefined) {
                    await guards.waitForFormReady(expectedMemberCount);
                }
            }
        }

        return settlementFormPage;
    }

    /**
     * Verify a settlement no longer appears in history.
     */
    async verifySettlementNotInHistory(note: string | RegExp): Promise<void> {
        await this.ensureSettlementHistoryOpen();

        await expect(async () => {
            const settlementEntry = this.getSettlementItem(note);
            const count = await settlementEntry.count();

            if (count > 0) {
                const visible = await settlementEntry.first().isVisible();
                if (visible) {
                    throw new Error(`Settlement "${String(note)}" is still visible in history`);
                }
            }
        })
            .toPass({
                timeout: 5000,
                intervals: [100, 200, 300, 500, 1000],
            });
    }

    /**
     * Verify settlement details (amount/payer/payee) are displayed for the specified note.
     */
    async verifySettlementDetails(details: { note: string | RegExp; amount?: string; payerName?: string; payeeName?: string; }): Promise<void> {
        await this.ensureSettlementHistoryOpen();

        await expect(async () => {
            const settlementItem = this.getSettlementItem(details.note);
            const count = await settlementItem.count();

            if (count === 0) {
                throw new Error(`Settlement with note "${String(details.note)}" not found in payment history yet`);
            }

            const firstItem = settlementItem.first();
            const visible = await firstItem.isVisible();
            if (!visible) {
                throw new Error(`Settlement with note "${String(details.note)}" found but not visible yet`);
            }

            if (details.amount) {
                const amountVisible = await firstItem.locator(`text=${details.amount}`).isVisible();
                if (!amountVisible) {
                    throw new Error(`Settlement amount "${details.amount}" not visible yet`);
                }
            }

            if (details.payerName) {
                const payerVisible = await firstItem.locator(`text=${details.payerName}`).isVisible();
                if (!payerVisible) {
                    throw new Error(`Payer name "${details.payerName}" not visible yet`);
                }
            }

            if (details.payeeName) {
                const payeeVisible = await firstItem.locator(`text=${details.payeeName}`).isVisible();
                if (!payeeVisible) {
                    throw new Error(`Payee name "${details.payeeName}" not visible yet`);
                }
            }
        })
            .toPass({
                timeout: 5000,
                intervals: [100, 200, 300, 500, 1000],
            });
    }

    /**
     * Verify settlement entry exposes an edit button.
     */
    async verifySettlementHasEditButton(note: string | RegExp): Promise<void> {
        await this.ensureSettlementHistoryOpen();
        const editButton = this.getSettlementEditButton(note);
        await expect(editButton).toBeVisible();
    }

    /**
     * Verify settlement entry exposes a delete button.
     */
    async verifySettlementHasDeleteButton(note: string | RegExp): Promise<void> {
        await this.ensureSettlementHistoryOpen();
        const deleteButton = this.getSettlementDeleteButton(note);
        await expect(deleteButton).toBeVisible();
    }

    /**
     * Poll until the settlement edit button becomes disabled (useful for real-time updates).
     */
    async verifySettlementEditButtonDisabled(note: string | RegExp, timeoutMs: number = 10000): Promise<void> {
        await this.ensureSettlementHistoryOpen();

        const editButton = this.getSettlementEditButton(note);
        await expect(editButton).toBeVisible();

        await expect(async () => {
            const disabled = await editButton.isDisabled();
            if (!disabled) {
                throw new Error(`Settlement edit button for "${String(note)}" is still enabled, waiting for lock...`);
            }
        })
            .toPass({ timeout: timeoutMs });
    }

    /**
     * Delete a settlement via the UI confirmation dialog.
     * Pass confirm=false to cancel the deletion during tests.
     */
    async deleteSettlement(note: string | RegExp, confirm: boolean = true): Promise<void> {
        await this.ensureSettlementHistoryOpen();

        const deleteButton = this.getSettlementDeleteButton(note);
        await expect(deleteButton).toBeVisible({ timeout: 2000 });
        await expect(deleteButton).toBeEnabled();

        await this.clickButton(deleteButton, { buttonName: 'Delete Settlement' });

        const confirmDialog = this.page.locator('[data-testid="confirmation-dialog"]');
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });
        await expect(confirmDialog.locator('h3')).toHaveText('Delete Payment');

        if (confirm) {
            const confirmButton = confirmDialog.locator('[data-testid="confirm-button"]');
            await this.clickButton(confirmButton, { buttonName: 'Delete' });
        } else {
            const cancelButton = confirmDialog.locator('[data-testid="cancel-button"]');
            await this.clickButton(cancelButton, { buttonName: 'Cancel' });
        }

        await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });
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
        await this.clickButton(button, { buttonName: translation.groupActions.settings });
    }

    /**
     * Click Settings button and open group settings modal
     * Fluent version - verifies modal opens and returns GroupSettingsModalPage
     */
    async clickEditGroupAndOpenModal(tab: 'identity' | 'general' | 'security' = 'general'): Promise<GroupSettingsModalPage> {
        await this.clickEditGroup();

        const modalPage = new GroupSettingsModalPage(this.page);
        await modalPage.waitForModalToOpen({ tab });
        return modalPage;
    }

    /**
     * Click Share Group button
     * Non-fluent version - clicks without verification, for flexibility
     */
    async clickShareGroup(): Promise<void> {
        const button = this.getShareGroupButton();
        await this.clickButton(button, { buttonName: translation.groupActions.inviteOthers });
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
     * Alias retained for compatibility with older call sites.
     */
    async clickLeaveGroupButton(): Promise<LeaveGroupDialogPage> {
        return this.clickLeaveGroupAndOpenDialog();
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
     * Wait for DOM content to be loaded
     * Note: Using 'domcontentloaded' instead of 'networkidle' to avoid timeouts
     * when there are 404 errors or ongoing network activity
     */
    private async waitForNetworkIdle(): Promise<void> {
        await this.page.waitForLoadState('domcontentloaded');
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
     * Note: With Identity tab, all members can access Settings to update their display name
     */
    async verifyMemberActions(): Promise<void> {
        await expect(this.getEditGroupButton()).toBeVisible(); // All members can access Settings for Identity tab
        await expect(this.getLeaveGroupButton()).toBeVisible();
    }

    /**
     * Verify the member count element is visible
     */
    async verifyMemberCountElementVisible(): Promise<void> {
        await expect(this.getMemberCount()).toBeVisible();
    }

    /**
     * Verify the Leave Group button is visible
     */
    async verifyLeaveGroupButtonVisible(): Promise<void> {
        await expect(this.getLeaveGroupButton()).toBeVisible();
    }

    /**
     * Verify the Leave Group button is not visible
     */
    async verifyLeaveButtonNotVisible(): Promise<void> {
        await expect(this.getLeaveGroupButton()).not.toBeVisible();
    }

    /**
     * Verify the Edit Group button is visible
     */
    async verifyEditButtonVisible(): Promise<void> {
        await expect(this.getEditGroupButton()).toBeVisible();
    }

    /**
     * Verify a member is not visible in the member list
     */
    async verifyMemberNotVisible(memberName: string): Promise<void> {
        const memberItem = this
            .getMembersContainer()
            .locator(`[data-testid="member-item"][data-member-name="${memberName}"]`);
        await expect(memberItem).not.toBeVisible();
    }
}

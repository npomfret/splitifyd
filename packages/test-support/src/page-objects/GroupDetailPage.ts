import { GroupId } from '@billsplit-wl/shared';
import type { GroupName, ReactionEmoji } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { ExpenseDetailPage } from './ExpenseDetailPage';
import { ExpenseFormPage } from './ExpenseFormPage';
import { GroupSettingsModalPage } from './GroupSettingsModalPage';
import { HeaderPage } from './HeaderPage';
import { LeaveGroupDialogPage } from './LeaveGroupDialogPage';
import { RemoveMemberDialogPage } from './RemoveMemberDialogPage';
import { SettlementFormPage } from './SettlementFormPage';
import { ShareGroupModalPage } from './ShareGroupModalPage';

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
    static groupDetailUrlPattern(groupId?: GroupId | string): RegExp {
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
    async navigateToGroup(groupId: GroupId | string): Promise<void> {
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
        })
            .toPass({
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
        })
            .toPass({
                timeout,
                intervals: [500, 1000, 1500, 2000],
            });
    }

    /**
     * Wait for critical parts of the group detail page to load and remain consistent.
     */
    async waitForPage(groupId: GroupId | string | string, expectedMemberCount: number): Promise<void> {
        const targetPattern = GroupDetailPage.groupDetailUrlPattern(groupId);

        await this.expectUrl(targetPattern);
        await this.header.getCurrentUserDisplayName(); // just wait for it to be visible, we don't care what it is

        await this.waitForMemberCount(expectedMemberCount, 10000);
        await this.expectUrl(targetPattern);

        await this.waitForBalancesSection(groupId);
        await this.expectUrl(targetPattern);
    }

    /**
     * Wait until the browser navigates away from the specified group detail page.
     */
    async waitForRedirectAwayFromGroup(groupId: GroupId | string, timeout: number = 5000): Promise<void> {
        await expect(this.page).not.toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId), { timeout });
    }

    // ============================================================================
    // CONTAINER SELECTORS - Based on user-visible headings
    // ============================================================================

    /**
     * Members section container - found by "Members" region with aria-label.
     * Uses .first() because responsive layout may have duplicate regions for
     * sidebar (desktop) vs main (mobile) views.
     */
    protected getMembersContainer(): Locator {
        return this.page.getByRole('region', { name: translation.membersList.title }).first();
    }

    /**
     * Expenses section container - found by "Expenses" region with aria-label
     */
    protected getExpensesContainer(): Locator {
        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.expenses });
    }

    /**
     * Balance/Debts section container - found by "Balances" region with aria-label.
     * Works for both sidebar (desktop) and main (mobile) balance summary displays.
     * IMPORTANT: Uses first() to get the visible one on the current viewport.
     */
    protected getBalanceContainer(): Locator {
        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.balances }).first();
    }

    /**
     * Settlement section container - found by "Settlements" region with aria-label.
     * Uses .first() for responsive layout compatibility (sidebar vs main area).
     */
    protected getSettlementContainer(): Locator {
        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.paymentHistory }).first();
    }

    /**
     * Activity feed section container - found by "Activity" region with aria-label.
     * Uses .first() for responsive layout compatibility (sidebar vs main area).
     */
    protected getActivityFeedContainer(): Locator {
        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.activity }).first();
    }

    /**
     * Activity feed card (alias for activity feed container)
     */
    protected getActivityFeedCard(): Locator {
        return this.getActivityFeedContainer();
    }

    /**
     * Activity feed items - found by list items within the activity feed
     */
    protected getActivityFeedItems(): Locator {
        return this.getActivityFeedContainer().getByRole('listitem');
    }

    /**
     * Activity feed empty state - found by the empty state text
     */
    protected getActivityFeedEmptyState(): Locator {
        return this.getActivityFeedContainer().getByText(translation.activityFeed.emptyState.title);
    }

    private getBalanceToggle(): Locator {
        // SidebarCard toggles have aria-label="Toggle {section} section" pattern
        return this.page.getByRole('button', { name: /toggle.*balance.*section/i });
    }

    private getCommentsToggle(): Locator {
        return this.page.getByRole('button', { name: /toggle.*comment.*section/i });
    }

    private getActivityToggle(): Locator {
        return this.page.getByRole('button', { name: /toggle.*activity.*section/i });
    }

    private getSettlementsToggle(): Locator {
        return this.getSettlementContainer().getByRole('button', { name: /toggle.*settlement.*section/i });
    }

    private getMembersToggle(): Locator {
        // .first(): Responsive layout may have duplicate toggles; get any visible one
        return this.page.getByRole('button', { name: /toggle.*member.*section/i }).first();
    }

    private getShowAllSettlementsCheckbox(): Locator {
        return this.getSettlementContainer().getByLabel(translation.settlementHistory.showAll);
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

    async ensureActivitySectionExpanded(): Promise<void> {
        await this.ensureToggleExpanded(this.getActivityToggle());
        await expect(this.getActivityFeedContainer()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    async expectActivityCollapsed(): Promise<void> {
        const toggle = this.getActivityToggle();
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

    async ensureMembersSectionExpanded(): Promise<void> {
        await this.ensureToggleExpanded(this.getMembersToggle());
        await expect(this.getMembersContainer()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    async expectMembersCollapsed(): Promise<void> {
        const toggle = this.getMembersToggle();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }

    private getSettlementItems(): Locator {
        // Settlement items are now article elements
        return this.getSettlementContainer().locator('article');
    }

    protected getIncludeDeletedSettlementsCheckbox(): Locator {
        return this.getSettlementContainer().getByRole('checkbox', { name: translation.common.includeDeleted });
    }

    private getSettlementItem(note: string | RegExp): Locator {
        const pattern = typeof note === 'string' ? new RegExp(note, 'i') : note;
        return this.getSettlementItems().filter({
            hasText: pattern,
        });
    }

    protected getEditableSettlementEditButton(note: string | RegExp): Locator {
        // Edit button when settlement is editable
        return this.getSettlementItem(note).getByRole('button', { name: translation.settlementHistory.editPaymentTooltip });
    }

    protected getLockedSettlementEditButton(note: string | RegExp): Locator {
        // Edit button when settlement is locked (disabled state)
        return this.getSettlementItem(note).getByRole('button', { name: translation.settlementHistory.cannotEditTooltip });
    }

    protected getSettlementDeleteButton(note: string | RegExp): Locator {
        return this.getSettlementItem(note).getByRole('button', { name: translation.settlementHistory.deletePaymentTooltip });
    }

    /**
     * Loading spinner - uses role='status' for semantic selection
     */
    protected getLoadingSpinner(): Locator {
        return this.page.getByRole('status', { name: translation.uiComponents.loadingSpinner.loading });
    }

    /**
     * Error container - primary error display area (now uses role='alert')
     */
    protected getErrorContainer(): Locator {
        return this.page.getByRole('alert').filter({ has: this.page.getByText(translation.pages.groupDetailPage.errorLoadingGroup) });
    }

    // ============================================================================
    // GROUP HEADER SELECTORS
    // ============================================================================

    /**
     * Group name heading - in the group header section (targets the span containing just the name)
     */
    protected getGroupName(): Locator {
        return this.page.locator('#group-header').getByRole('heading').locator('span');
    }

    /**
     * Convenience helper to read the trimmed group name text.
     */
    async getGroupNameText(): Promise<string> {
        const title = await this.getGroupName().textContent();
        return title?.trim() ?? '';
    }

    /**
     * Group description - paragraph text inside the group header SidebarCard
     * Displayed as p tag with text-text-primary/80 class
     */
    protected getGroupDescription(): Locator {
        // Description is the paragraph inside #group-header (distinct from .help-text stats)
        return this.page.locator('#group-header p');
    }

    /**
     * Group stats display - finds the stats line in the group header card
     * Shows: "{X} members, {time} old, last updated {time}"
     * CSS class selector: scoped to unique #group-header ID, .help-text identifies
     * the stats container (no semantic alternative - content is dynamic with RelativeTime).
     */
    protected getGroupStats(): Locator {
        return this.page.locator('#group-header .help-text');
    }

    // ============================================================================
    // ACTION BUTTONS
    // ============================================================================

    /**
     * Add Expense button
     */
    protected getAddExpenseButton(): Locator {
        return this.page.getByRole('button', { name: translation.group.actions.addExpense });
    }

    /**
     * Settings button (opens the Group Settings modal)
     * Uses .first() to handle duplicate buttons in sidebar and header
     */
    protected getEditGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.settings }).first();
    }

    protected getSecuritySettingsButton(): Locator {
        return this.getEditGroupButton();
    }

    async openSecuritySettings(): Promise<GroupSettingsModalPage> {
        return this.clickEditGroupAndOpenModal('security');
    }

    /**
     * Share Group button (labeled as "Invite Others")
     * Uses .first() to handle duplicate buttons in sidebar and elsewhere
     */
    protected getShareGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.inviteOthers }).first();
    }

    /**
     * Leave Group button
     */
    protected getLeaveGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.leaveGroup });
    }

    private getArchiveGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.archive });
    }

    private getUnarchiveGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.groupActions.unarchive });
    }

    /**
     * Settle Up button
     */
    protected getSettleUpButton(): Locator {
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

        const createSettlementFormPage = options.createSettlementFormPage
            ?? ((page: Page) => new SettlementFormPage(page) as unknown as T);

        const settlementFormPage = createSettlementFormPage(this.page);

        if (options.ensureModalVisible ?? true) {
            await settlementFormPage.verifyModalVisible({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });
        }

        if (options.waitForFormReady ?? true) {
            await settlementFormPage.waitForReady({ expectedMemberCount });
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
    protected getMemberCards(): Locator {
        // Members are li elements with aria-label set to the member name in a ul list
        // Use .first() to get only the sidebar version (not the mobile duplicate)
        return this.getMembersContainer().getByRole('list').first().getByRole('listitem');
    }

    /**
     * Get specific member by name - searches within members container
     * Uses .first() to get only the sidebar version (not the mobile duplicate)
     */
    protected getMemberCard(memberName: string): Locator {
        return this.getMembersContainer().getByRole('list').first().getByRole('listitem', { name: memberName });
    }

    /**
     * Get the actual member count displayed in the header
     */
    async getCurrentMemberCount(): Promise<number> {
        const groupStatsElement = this.getGroupStats();
        await expect(groupStatsElement).toBeVisible({ timeout: 1000 });

        const statsText = await groupStatsElement.textContent();
        if (!statsText) {
            throw new Error('Could not find group stats text in UI');
        }

        const match = statsText.match(/(\d+)\s+member/i);
        if (!match) {
            throw new Error(`Could not parse member count from text: "${statsText}"`);
        }

        return parseInt(match[1], 10);
    }

    /**
     * Get the member count from the Members section header/toggle.
     * This extracts the count from text like "Members (3)" in the section toggle.
     */
    async getMembersSectionHeaderCount(): Promise<number> {
        const membersContainer = this.getMembersContainer();
        await expect(membersContainer).toBeVisible({ timeout: 1000 });

        // Get the text content of the members container header/toggle area
        // This should contain text like "Members (3)"
        const headerText = await membersContainer.textContent();
        if (!headerText) {
            throw new Error('Could not find members section header text');
        }

        // Extract the number from "(X)" pattern
        const match = headerText.match(/\((\d+)\)/);
        if (!match) {
            throw new Error(`Could not parse member count from members section header: "${headerText}"`);
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
            const name = await item.getAttribute('aria-label');
            if (name) {
                names.push(name);
            }
        }

        return names;
    }

    /**
     * Wait for the member list and header count to match the expected value.
     * Checks all three places where the member count is displayed:
     * 1. Main page header (GroupHeader component)
     * 2. Members section header/toggle button
     * 3. Actual number of member items in the list
     */
    async waitForMemberCount(expectedCount: number, timeout: number = 5000): Promise<void> {
        await expect(async () => {
            await this.ensureMembersSectionExpanded();
            const headerCount = await this.getCurrentMemberCount().catch(() => -1);
            const sectionHeaderCount = await this.getMembersSectionHeaderCount().catch(() => -1);
            const actualItems = await this.getMemberCards().count();

            if (headerCount !== expectedCount || sectionHeaderCount !== expectedCount || actualItems !== expectedCount) {
                const memberNames = await this.getMemberNames();
                throw new Error(
                    `Member count mismatch. Expected: ${expectedCount}, `
                        + `Page header shows: ${headerCount}, `
                        + `Section header shows: ${sectionHeaderCount}, `
                        + `Items: ${actualItems}. `
                        + `Members: [${memberNames.join(', ')}]. URL: ${this.page.url()}`,
                );
            }
        })
            .toPass({ timeout });
    }

    /**
     * Locate a specific member entry by display name.
     */
    protected getMemberItem(memberName: string): Locator {
        // Members are li elements with aria-label set to the member name
        return this
            .getMembersContainer()
            .getByRole('listitem', { name: memberName });
    }

    /**
     * Get the remove member button for a given member.
     * The button has aria-label="Remove {memberName}"
     */
    protected getRemoveMemberButton(memberName: string): Locator {
        // Use aria-label which contains the member name
        return this.getMemberItem(memberName).getByRole('button', { name: new RegExp(`Remove.*${memberName}`, 'i') });
    }

    // ============================================================================
    // EXPENSES SECTION
    // ============================================================================

    /**
     * Get all expense items - expense items are now article elements
     */
    protected getExpenseItems(): Locator {
        return this.getExpensesContainer().locator('article');
    }

    protected getIncludeDeletedExpensesCheckbox(): Locator {
        return this.getExpensesContainer().getByLabel(translation.common.includeDeleted);
    }

    /**
     * Get specific expense by description - searches within expenses container
     */
    protected getExpenseByDescription(description: string): Locator {
        return this.getExpensesContainer().getByText(description, { exact: true });
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
     * Empty expenses state - found by the empty state heading
     */
    protected getEmptyExpensesState(): Locator {
        return this.getExpensesContainer().getByRole('heading', { name: translation.expensesList.noExpensesYet });
    }

    /**
     * Get the "Load More" button in the expenses section
     */
    protected getLoadMoreExpensesButton(): Locator {
        return this.getExpensesContainer().getByRole('button', { name: translation.expensesList.loadMore });
    }

    /**
     * Verify the "Load More" expenses button is visible
     */
    async verifyLoadMoreExpensesButtonVisible(): Promise<void> {
        await expect(this.getLoadMoreExpensesButton()).toBeVisible();
    }

    /**
     * Verify the "Load More" expenses button is not visible (hidden)
     */
    async verifyLoadMoreExpensesButtonNotVisible(): Promise<void> {
        await expect(this.getLoadMoreExpensesButton()).toBeHidden();
    }

    /**
     * Click the "Load More" expenses button to load additional expenses
     */
    async clickLoadMoreExpenses(): Promise<void> {
        const button = this.getLoadMoreExpensesButton();
        await this.clickButton(button, { buttonName: 'Load More Expenses' });
    }

    // ============================================================================
    // COMMENTS SECTION
    // ============================================================================

    /**
     * Get the comments section container - found by "Comments" region with aria-label
     * .first(): Responsive layout has separate mobile/desktop cards; get visible one
     */
    protected getCommentsSection(): Locator {
        return this.page.getByRole('region', { name: translation.pages.groupDetailPage.comments }).first();
    }

    /**
     * Get the comment input textarea
     */
    protected getCommentInput(): Locator {
        return this.getCommentsSection().getByRole('textbox', { name: translation.comments.input.ariaLabel });
    }

    /**
     * Get the send comment button
     */
    protected getSendCommentButton(): Locator {
        return this.getCommentsSection().getByRole('button', { name: translation.comments.input.sendAriaLabel });
    }

    /**
     * Get all comments currently rendered
     */
    protected getCommentItems(): Locator {
        // Comment items are article elements within the comments section
        return this.getCommentsSection().locator('article');
    }

    /**
     * Get a comment locator by its text content
     */
    protected getCommentByText(text: string): Locator {
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
        })
            .toPass({ timeout });
    }

    /**
     * Verify the comments section renders with expected controls
     */
    async verifyCommentsSection(): Promise<void> {
        await this.ensureCommentsSectionExpanded();

        await expect(this.getCommentsSection()).toBeVisible();

        const input = this.getCommentInput();
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute('placeholder', translation.comments.commentsSection.placeholderGroup);

        const sendButton = this.getSendCommentButton();
        await expect(sendButton).toBeVisible();
        await expect(sendButton).toBeDisabled();
    }

    async uploadCommentAttachment(filePath: string): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        // .first(): Hidden file input may duplicate in responsive layout
        const input = this.getCommentsSection().locator(`input[type="file"][aria-label="${translation.comments.attachments.label}"]`).first();
        await input.setInputFiles(filePath);
    }

    async verifyComposerAttachmentVisible(fileName: string): Promise<void> {
        const removeLabel = translation.comments.attachments.remove.replace('{{fileName}}', fileName);
        const removeButton = this.getCommentsSection().getByRole('button', { name: new RegExp(removeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
        await expect(removeButton).toBeVisible();
    }

    async verifyComposerAttachmentNotVisible(fileName: string): Promise<void> {
        const removeLabel = translation.comments.attachments.remove.replace('{{fileName}}', fileName);
        const removeButton = this.getCommentsSection().getByRole('button', { name: new RegExp(removeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
        await expect(removeButton).toHaveCount(0);
    }

    async verifyCommentAttachmentVisible(fileName: string): Promise<void> {
        const linkLabel = translation.comments.attachments.viewAttachment.replace('{{fileName}}', fileName);
        const link = this.getCommentsSection().getByRole('link', { name: new RegExp(linkLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
        await expect(link).toBeVisible();
    }

    async removeComposerAttachment(fileName: string): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const removeLabel = translation.comments.attachments.remove.replace('{{fileName}}', fileName);
        const removeButton = this.getCommentsSection().getByRole('button', { name: new RegExp(removeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
        await this.clickButton(removeButton, { buttonName: `Remove ${fileName}` });
    }

    async verifyAttachmentError(errorText: string): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const error = this.getCommentsSection().getByRole('alert').filter({ hasText: errorText });
        await expect(error).toBeVisible();
    }

    async verifyAttachmentErrorNotVisible(): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const error = this.getCommentsSection().getByRole('alert');
        await expect(error).toHaveCount(0);
    }

    /**
     * Verify a comment with given text is visible
     */
    async verifyCommentVisible(text: string): Promise<void> {
        await this.ensureCommentsSectionExpanded();

        await expect(this.getCommentByText(text)).toBeVisible();
    }

    /**
     * Get the "Load More Comments" button in the comments section
     */
    protected getLoadMoreCommentsButton(): Locator {
        return this.getCommentsSection().getByRole('button', { name: /load more comments/i });
    }

    /**
     * Get the loading button state (when Load More is clicked)
     */
    protected getLoadingCommentsButton(): Locator {
        return this.getCommentsSection().getByRole('button', { name: /loading/i });
    }

    /**
     * Verify the "Load More Comments" button is visible
     */
    async verifyLoadMoreCommentsButtonVisible(): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        await expect(this.getLoadMoreCommentsButton()).toBeVisible();
    }

    /**
     * Verify the "Load More Comments" button is not visible
     */
    async verifyLoadMoreCommentsButtonNotVisible(): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        await expect(this.getLoadMoreCommentsButton()).not.toBeVisible();
    }

    /**
     * Verify the loading comments button is disabled (during loading state)
     */
    async verifyLoadingCommentsButtonDisabled(): Promise<void> {
        await expect(this.getLoadingCommentsButton()).toBeDisabled();
    }

    /**
     * Click the "Load More Comments" button to load additional comments
     */
    async clickLoadMoreComments(): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const button = this.getLoadMoreCommentsButton();
        await this.clickButton(button, { buttonName: 'Load More Comments' });
    }

    /**
     * Verify no comment error is displayed in the comments section
     */
    async verifyNoCommentError(): Promise<void> {
        await this.ensureCommentsSectionExpanded();

        // Comment errors use role='alert' within the comments section
        const commentError = this.getCommentsSection().getByRole('alert');
        await expect(commentError).toHaveCount(0);
    }

    // ============================================================================
    // GROUP COMMENT REACTIONS
    // ============================================================================

    /**
     * Get a comment item by its text content
     */
    protected getCommentItemByText(text: string): Locator {
        return this.getCommentItems().filter({ hasText: text });
    }

    /**
     * Get the reaction bar for a specific comment
     */
    protected getGroupCommentReactionBar(commentText: string): Locator {
        return this.getCommentItemByText(commentText).getByRole('group', { name: translation.reactions.reactionBarLabel });
    }

    /**
     * Get the add reaction button for a group comment
     */
    protected getGroupCommentAddReactionButton(commentText: string): Locator {
        return this.getCommentItemByText(commentText).getByRole('button', { name: translation.reactions.addReaction });
    }

    /**
     * Get a reaction pill on a group comment
     */
    protected getGroupCommentReactionPill(commentText: string, emoji: ReactionEmoji): Locator {
        return this.getCommentItemByText(commentText).locator('button').filter({ hasText: emoji });
    }

    /**
     * Click the add reaction button on a group comment
     */
    async clickGroupCommentAddReaction(commentText: string): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const button = this.getGroupCommentAddReactionButton(commentText);
        await expect(button).toBeVisible();
        await this.clickButton(button, { buttonName: 'Add reaction to group comment' });
        await expect(this.getReactionPicker()).toBeVisible();
    }

    /**
     * Add a reaction to a group comment
     */
    async addGroupCommentReaction(commentText: string, emoji: ReactionEmoji): Promise<void> {
        await this.clickGroupCommentAddReaction(commentText);
        await this.selectReactionEmoji(emoji);
    }

    /**
     * Toggle a reaction on a group comment
     */
    async toggleGroupCommentReaction(commentText: string, emoji: ReactionEmoji): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const pill = this.getGroupCommentReactionPill(commentText, emoji);
        await expect(pill).toBeVisible();
        await pill.click();
    }

    /**
     * Verify a group comment reaction is visible with count
     */
    async verifyGroupCommentReactionVisible(commentText: string, emoji: ReactionEmoji, count: number): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const pill = this.getGroupCommentReactionPill(commentText, emoji);
        await expect(pill).toBeVisible();
        await expect(pill).toContainText(String(count));
    }

    /**
     * Verify a group comment reaction is not visible
     */
    async verifyGroupCommentReactionNotVisible(commentText: string, emoji: ReactionEmoji): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const pill = this.getGroupCommentReactionPill(commentText, emoji);
        await expect(pill).not.toBeVisible();
    }

    /**
     * Verify a group comment reaction is highlighted (user has reacted)
     */
    async verifyGroupCommentReactionHighlighted(commentText: string, emoji: ReactionEmoji): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const pill = this.getGroupCommentReactionPill(commentText, emoji);
        await expect(pill).toHaveAttribute('aria-pressed', 'true');
    }

    /**
     * Verify a group comment reaction is not highlighted (user has not reacted)
     */
    async verifyGroupCommentReactionNotHighlighted(commentText: string, emoji: ReactionEmoji): Promise<void> {
        await this.ensureCommentsSectionExpanded();
        const pill = this.getGroupCommentReactionPill(commentText, emoji);
        await expect(pill).toHaveAttribute('aria-pressed', 'false');
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
     * Get balance summary heading - found by "Balances" region and its heading
     */
    protected getBalanceSummaryHeading(): Locator {
        return this.getBalanceContainer().getByRole('heading');
    }

    /**
     * Get "All settled up" message - looks for the text within the balance container
     */
    protected getSettledUpMessage(): Locator {
        return this.getBalanceContainer().getByText(translation.balanceSummary.allSettledUp);
    }

    /**
     * Get debt items - debt items are now article elements
     */
    protected getDebtItems(): Locator {
        return this.getBalanceContainer().locator('article');
    }

    /**
     * Get debt entry describing a debtor → creditor relationship.
     */
    protected getDebtInfo(debtorName: string, creditorName: string): Locator {
        const balancesSection = this.getBalanceContainer();
        return balancesSection
            .getByText(`${debtorName} → ${creditorName}`)
            .or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
    }

    /**
     * Get settlement button for a specific debt item
     * The button appears within debt items where the current user is the payer
     */
    protected getSettlementButtonForDebt(debtorName: string, creditorName: string): Locator {
        const balancesSection = this.getBalanceContainer();
        // Find the debt item (now article) containing the debtor and creditor names
        const debtItem = balancesSection.locator('article').filter({
            hasText: new RegExp(`${debtorName}.*owes.*${creditorName}`),
        });
        // Find the settlement button using its accessible name from translation
        return debtItem.getByRole('button', { name: translation.balanceSummary.settleUpButton });
    }

    /**
     * Verify settlement button is visible for a specific debt
     */
    async verifySettlementButtonVisible(debtorName: string, creditorName: string): Promise<void> {
        const settlementButton = this.getSettlementButtonForDebt(debtorName, creditorName);
        await expect(settlementButton).toBeVisible();
    }

    /**
     * Verify settlement button is not visible for a specific debt
     */
    async verifySettlementButtonNotVisible(debtorName: string, creditorName: string): Promise<void> {
        const settlementButton = this.getSettlementButtonForDebt(debtorName, creditorName);
        await expect(settlementButton).not.toBeVisible();
    }

    /**
     * Click settlement button for a specific debt and return the settlement form page
     */
    async clickSettlementButton(debtorName: string, creditorName: string, options: {
        expectedMemberCount?: number;
        waitForFormReady?: boolean;
    } = {}): Promise<SettlementFormPage> {
        const settlementButton = this.getSettlementButtonForDebt(debtorName, creditorName);
        await settlementButton.click();

        const settlementFormPage = new SettlementFormPage(this.page);
        await settlementFormPage.verifyModalVisible({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });

        if (options.waitForFormReady ?? true) {
            await settlementFormPage.waitForReady({ expectedMemberCount: options.expectedMemberCount });
        }

        return settlementFormPage;
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

    /**
     * Click the include deleted expenses checkbox
     */
    async clickIncludeDeletedExpensesCheckbox(): Promise<void> {
        const checkbox = this.getIncludeDeletedExpensesCheckbox();
        await checkbox.click();
    }

    /**
     * Click the include deleted settlements checkbox
     */
    async clickIncludeDeletedSettlementsCheckbox(): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const checkbox = this.getIncludeDeletedSettlementsCheckbox();
        await checkbox.click();
    }

    // ============================================================================
    // MODALS
    // ============================================================================

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Verify group detail page loaded successfully
     */
    async verifyGroupDetailPageLoaded(groupName: GroupName | string): Promise<void> {
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
        await this.ensureMembersSectionExpanded();
        await expect(this.getMemberCards()).toHaveCount(count);
    }

    /**
     * Verify specific member is displayed
     */
    async verifyMemberDisplayed(memberName: string): Promise<void> {
        await this.ensureMembersSectionExpanded();
        await expect(this.getMemberCard(memberName)).toBeVisible();
    }

    /**
     * Click remove member button and return the confirmation dialog page.
     */
    async clickRemoveMember(memberName: string): Promise<RemoveMemberDialogPage> {
        await this.ensureMembersSectionExpanded();
        const memberItem = this.getMemberItem(memberName);
        try {
            await expect(memberItem).toBeVisible({ timeout: 5000 });
        } catch (error) {
            // Members are li elements with aria-label set to the member name
            const visibleMemberItems = await this.getMembersContainer().locator('li[aria-label]:visible').all();
            const visibleMembers = await Promise.all(
                visibleMemberItems.map(async (item) => {
                    const ariaLabel = await item.getAttribute('aria-label');
                    return ariaLabel ?? '(unknown)';
                }),
            );
            const message = [
                `Failed to find visible member "${memberName}".`,
                `Visible members:`,
                visibleMembers.map((m, index) => `  ${index + 1}. ${m}`).join('\n') || '  (none)',
            ]
                .join('\n');
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
        const descriptionElement = this.getExpenseByDescription(description);
        await expect(descriptionElement).toBeVisible();
        if (amount) {
            // Find the expense-item (now article) container that contains this description
            const expenseItem = this
                .getExpensesContainer()
                .locator('article')
                .filter({ hasText: description });
            // Amount is visible text within the expense item
            await expect(expenseItem).toContainText(amount);
        }
    }

    /**
     * Verify a payer and currency amount combination appears inside expenses
     */
    async verifyCurrencyAmountInExpenses(payer: string, currencyAmount: string): Promise<void> {
        const expensesContainer = this.getExpensesContainer();
        await expect(expensesContainer).toBeVisible({ timeout: 2000 });

        await expect(async () => {
            // Expense items are now article elements
            const expenseItems = expensesContainer.locator('article');
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
        })
            .toPass({ timeout: 5000 });
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

            // .first(): Multiple matches possible; verify at least one is visible
            const visible = await expenseElement.first().isVisible();
            if (!visible) {
                throw new Error(`Expense with description "${description}" found but not visible yet`);
            }
        })
            .toPass({
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
     * .first(): Verify at least one debt item is visible
     */
    async verifyHasDebts(): Promise<void> {
        await this.ensureBalancesSectionExpanded();
        await expect(this.getDebtItems().first()).toBeVisible();
    }

    /**
     * Verify remove member button is disabled for a specific member
     */
    async verifyRemoveMemberButtonDisabled(memberName: string): Promise<void> {
        await expect(this.getRemoveMemberButton(memberName)).toBeDisabled();
    }

    /**
     * Verify edit group button is visible
     */
    async verifyEditGroupButtonVisible(): Promise<void> {
        await expect(this.getEditGroupButton()).toBeVisible();
    }

    /**
     * Verify edit group button is enabled
     */
    async verifyEditGroupButtonEnabled(): Promise<void> {
        await expect(this.getEditGroupButton()).toBeEnabled();
    }

    /**
     * Verify expense by description is visible
     */
    async verifyExpenseByDescriptionVisible(description: string): Promise<void> {
        await expect(this.getExpenseByDescription(description)).toBeVisible();
    }

    /**
     * Verify expense by description is not visible
     */
    async verifyExpenseByDescriptionNotVisible(description: string): Promise<void> {
        await expect(this.getExpenseByDescription(description)).not.toBeVisible();
    }

    /**
     * Verify specific debt relationship is not visible
     */
    async verifyDebtInfoNotVisible(debtorName: string, creditorName: string): Promise<void> {
        await expect(this.getDebtInfo(debtorName, creditorName)).not.toBeVisible();
    }

    /**
     * Wait for balances section to render and loading indicator (if any) to disappear.
     */
    async waitForBalancesSection(groupId: GroupId | string | string, timeout: number = 3000): Promise<void> {
        const currentUrl = this.page.url();
        if (!currentUrl.includes(`/groups/${groupId}`)) {
            throw new Error(`waitForBalancesSection called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`);
        }

        const balancesSection = this.getBalanceContainer();
        await expect(balancesSection).toBeVisible({ timeout });

        try {
            await expect(balancesSection.getByText(translation.balanceSummary.loadingBalances)).not.toBeVisible({ timeout: 2000 });
        } catch {
            // Loading text may not appear; ignore timeout
        }
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

            // Find debt items (now article elements) containing both names - supports both old (→) and new (owes...to) format
            const debtItems = balancesSection
                .locator('article')
                .filter({
                    hasText: debtorName,
                })
                .filter({
                    hasText: creditorName,
                });

            const count = await debtItems.count();
            if (count === 0) {
                // Get all debt items for better error message
                const allDebtItems = balancesSection.locator('article');
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
     * Verify settlement edit button is disabled (locked state)
     */
    async verifySettlementEditDisabled(note: string | RegExp): Promise<void> {
        const button = this.getLockedSettlementEditButton(note);
        await expect(button).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(button).toBeDisabled();
    }

    /**
     * Verify settlement edit button is enabled (editable state)
     */
    async verifySettlementEditEnabled(note: string | RegExp): Promise<void> {
        const button = this.getEditableSettlementEditButton(note);
        await expect(button).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(button).toBeEnabled();
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

        const editButton = this.getEditableSettlementEditButton(note);
        await expect(editButton).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(editButton).toBeEnabled();

        await this.clickButton(editButton, { buttonName: 'Edit Settlement' });

        const modal = this.page.getByRole('dialog');
        await expect(modal).toBeVisible({ timeout: 3000 });

        if (options.ensureUpdateHeading !== false) {
            await expect(modal.getByRole('heading', { name: translation.settlementForm.updateSettlement })).toBeVisible();
        }

        const createFormPage = options.createSettlementFormPage
            ?? ((page: Page) => new SettlementFormPage(page) as unknown as T);

        const settlementFormPage = createFormPage(this.page);
        await settlementFormPage.verifyModalVisible();

        if (options.waitForFormReady ?? true) {
            let expectedMemberCount = options.expectedMemberCount;
            if (expectedMemberCount === undefined) {
                try {
                    expectedMemberCount = await this.getCurrentMemberCount();
                } catch {
                    expectedMemberCount = undefined;
                }
            }

            await settlementFormPage.waitForReady({
                expectedMemberCount,
                timeout: TEST_TIMEOUTS.MODAL_TRANSITION,
            });
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

            // .first(): Verify at least one matching settlement is visible
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

            // .first(): Multiple matches possible; verify first matching item
            const firstItem = settlementItem.first();
            const visible = await firstItem.isVisible();
            if (!visible) {
                throw new Error(`Settlement with note "${String(details.note)}" found but not visible yet`);
            }

            if (details.amount) {
                // Use getByText which is more flexible with nested elements (works with CurrencyAmount components)
                const amountLocator = firstItem.getByText(details.amount, { exact: false });
                const amountCount = await amountLocator.count();
                if (amountCount === 0) {
                    throw new Error(`Settlement amount "${details.amount}" not found yet`);
                }
                // .first(): Amount may appear in multiple places; check any is visible
                const amountVisible = await amountLocator.first().isVisible();
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
     * Verify settlement entry has an editable edit button.
     */
    async verifySettlementHasEditableButton(note: string | RegExp): Promise<void> {
        await this.ensureSettlementHistoryOpen();
        await expect(this.getEditableSettlementEditButton(note)).toBeVisible();
    }

    /**
     * Verify settlement entry has a locked edit button.
     */
    async verifySettlementHasLockedButton(note: string | RegExp): Promise<void> {
        await this.ensureSettlementHistoryOpen();
        await expect(this.getLockedSettlementEditButton(note)).toBeVisible();
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
     * Poll until the settlement edit button becomes locked (useful for real-time updates).
     * Waits for the locked edit button to appear and be disabled.
     */
    async waitForSettlementToBecomeLocked(note: string | RegExp, timeoutMs: number = 10000): Promise<void> {
        await this.ensureSettlementHistoryOpen();

        await expect(async () => {
            const lockedButton = this.getLockedSettlementEditButton(note);
            const isVisible = await lockedButton.isVisible();
            if (!isVisible) {
                throw new Error(`Settlement "${String(note)}" is still editable, waiting for lock...`);
            }
            const isDisabled = await lockedButton.isDisabled();
            if (!isDisabled) {
                throw new Error(`Settlement "${String(note)}" locked button is not disabled yet...`);
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

        // Use semantic dialog selector - Modal component has role="dialog"
        const confirmDialog = this.page.getByRole('dialog');
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });
        await expect(confirmDialog.getByRole('heading', { name: translation.settlementHistory.deletePaymentTitle })).toBeVisible();

        if (confirm) {
            const confirmButton = confirmDialog.getByRole('button', { name: translation.common.delete });
            await this.clickButton(confirmButton, { buttonName: 'Delete' });
        } else {
            const cancelButton = confirmDialog.getByRole('button', { name: translation.common.cancel });
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

    async clickArchiveGroup(options: { expectedGroupId?: GroupId; } = {}): Promise<void> {
        let groupId = options.expectedGroupId;
        if (!groupId) {
            try {
                groupId = this.inferGroupId();
            } catch (error) {
                throw new Error(`Cannot archive group: expected to be on a group detail page. Current URL: ${this.page.url()}. Original error: ${error}`);
            }
        }

        await this.expectUrl(GroupDetailPage.groupDetailUrlPattern(groupId));
        const button = this.getArchiveGroupButton();
        await this.clickButton(button, { buttonName: translation.groupActions.archive });
        await this.expectUrl(GroupDetailPage.groupDetailUrlPattern(groupId));
    }

    async clickUnarchiveGroup(options: { expectedGroupId?: GroupId; } = {}): Promise<void> {
        let groupId = options.expectedGroupId;
        if (!groupId) {
            try {
                groupId = this.inferGroupId();
            } catch (error) {
                throw new Error(`Cannot unarchive group: expected to be on a group detail page. Current URL: ${this.page.url()}. Original error: ${error}`);
            }
        }

        const button = this.getUnarchiveGroupButton();
        await this.clickButton(button, { buttonName: translation.groupActions.unarchive });
        await this.expectUrl(GroupDetailPage.groupDetailUrlPattern(groupId));
    }

    async ensureArchiveActionVisible(options: { expectedGroupId?: GroupId; timeoutMs?: number; } = {}): Promise<void> {
        let groupId = options.expectedGroupId;
        if (!groupId) {
            try {
                groupId = this.inferGroupId();
            } catch (error) {
                throw new Error(`Cannot verify archive action: expected to be on a group detail page. Current URL: ${this.page.url()}. Original error: ${error}`);
            }
        }

        const button = this.getArchiveGroupButton();
        await expect(async () => {
            await this.expectUrl(GroupDetailPage.groupDetailUrlPattern(groupId));
            const isVisible = await button.isVisible();
            if (!isVisible) {
                throw new Error('Archive group action is still hidden.');
            }
        })
            .toPass({
                timeout: options.timeoutMs ?? TEST_TIMEOUTS.ELEMENT_VISIBLE,
                intervals: [250, 500, 750, 1000],
            });
    }

    async ensureUnarchiveActionVisible(options: { expectedGroupId?: GroupId; timeoutMs?: number; } = {}): Promise<void> {
        let groupId = options.expectedGroupId;
        if (!groupId) {
            try {
                groupId = this.inferGroupId();
            } catch (error) {
                throw new Error(`Cannot verify unarchive action: expected to be on a group detail page. Current URL: ${this.page.url()}. Original error: ${error}`);
            }
        }

        const button = this.getUnarchiveGroupButton();
        await expect(async () => {
            await this.expectUrl(GroupDetailPage.groupDetailUrlPattern(groupId));
            const isVisible = await button.isVisible();
            if (!isVisible) {
                throw new Error('Unarchive group action is still hidden.');
            }
        })
            .toPass({
                timeout: options.timeoutMs ?? TEST_TIMEOUTS.ELEMENT_VISIBLE,
                intervals: [250, 500, 750, 1000],
            });
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
     * Click Settings button and open group settings modal
     * Fluent version - verifies modal opens and returns GroupSettingsModalPage
     */
    async clickEditGroupAndOpenModal(tab: 'identity' | 'general' | 'security' = 'general'): Promise<GroupSettingsModalPage> {
        const button = this.getEditGroupButton();
        const modalPage = new GroupSettingsModalPage(this.page);

        // Verify modal is NOT open before we click (establishes baseline state)
        await modalPage.verifyModalNotVisible();

        // Use clickButtonNoWait since opening a modal doesn't trigger navigation
        await this.clickButtonNoWait(button, { buttonName: translation.groupActions.settings });

        // Wait for modal to be fully ready
        // waitForModalToOpen ensures the modal is stable and won't close unexpectedly
        await modalPage.waitForModalToOpen({ tab });

        return modalPage;
    }

    /**
     * Click Share Group button and open share modal
     * Fluent version - verifies modal opens and returns ShareGroupModalPage
     */
    async clickShareGroupAndOpenModal(): Promise<ShareGroupModalPage> {
        const button = this.getShareGroupButton();
        const modalPage = new ShareGroupModalPage(this.page);

        // Verify modal is NOT open before we click (establishes baseline state)
        await modalPage.verifyModalNotVisible();

        // Use clickButtonNoWait since opening a modal doesn't trigger navigation
        await this.clickButtonNoWait(button, { buttonName: translation.groupActions.inviteOthers });

        // Wait for modal to be fully ready (including share link generation)
        // waitForModalToOpen waits for loading to complete and share link to be ready
        // which ensures the modal is stable and won't close unexpectedly
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
     * Click Leave Group button and open leave dialog (for users who CAN leave)
     * Fluent version - verifies dialog opens and returns LeaveGroupDialogPage
     */
    async clickLeaveGroupAndOpenDialog(): Promise<LeaveGroupDialogPage> {
        await this.clickLeaveGroup();

        const dialogPage = new LeaveGroupDialogPage(this.page);
        await dialogPage.waitForLeaveDialogToOpen();
        return dialogPage;
    }

    /**
     * Click Leave Group button and open balance warning dialog (for users with outstanding balance)
     * Fluent version - verifies balance warning dialog opens and returns LeaveGroupDialogPage
     */
    async clickLeaveGroupAndOpenBalanceWarningDialog(): Promise<LeaveGroupDialogPage> {
        await this.clickLeaveGroup();

        const dialogPage = new LeaveGroupDialogPage(this.page);
        await dialogPage.waitForBalanceWarningDialogToOpen();
        return dialogPage;
    }

    /**
     * Alias retained for compatibility with older call sites.
     */
    async clickLeaveGroupButton(): Promise<LeaveGroupDialogPage> {
        return this.clickLeaveGroupAndOpenDialog();
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
     * Verify the group stats element is visible (shows members, age, last updated)
     */
    async verifyMemberCountElementVisible(): Promise<void> {
        await expect(this.getGroupStats()).toBeVisible();
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
        await expect(this.getMemberItem(memberName)).not.toBeVisible();
    }

    /**
     * Verify debt items are visible
     * .first(): Verify at least one debt item is visible
     */
    async verifyDebtItemsVisible(): Promise<void> {
        await expect(this.getDebtItems().first()).toBeVisible();
    }

    /**
     * Verify debt items count matches expected
     */
    async verifyDebtItemsCount(count: number): Promise<void> {
        await expect(this.getDebtItems()).toHaveCount(count);
    }

    /**
     * Verify settled up message is visible
     */
    async verifySettledUpMessageVisible(): Promise<void> {
        await expect(this.getSettledUpMessage()).toBeVisible();
    }

    /**
     * Verify settled up message is not visible
     */
    async verifySettledUpMessageNotVisible(): Promise<void> {
        await expect(this.getSettledUpMessage()).not.toBeVisible();
    }

    /**
     * Verify balance container is visible
     */
    async verifyBalanceContainerVisible(): Promise<void> {
        await expect(this.getBalanceContainer()).toBeVisible();
    }

    /**
     * Verify balance container is attached to DOM (not necessarily visible)
     */
    async verifyBalanceContainerAttached(): Promise<void> {
        await expect(this.getBalanceContainer()).toBeAttached();
    }

    /**
     * Click the settlement button for a specific debt between two members
     * Returns a SettlementFormPage for interacting with the opened modal
     */
    async clickSettlementButtonForDebt(debtorName: string, creditorName: string): Promise<void> {
        const settlementButton = this.getSettlementButtonForDebt(debtorName, creditorName);
        await settlementButton.click();
    }

    /**
     * Verify balance summary heading is visible
     */
    async verifyBalanceSummaryHeadingVisible(): Promise<void> {
        await expect(this.getBalanceSummaryHeading()).toBeVisible();
    }

    /**
     * Verify comment items count matches expected
     */
    async verifyCommentItemsCount(count: number): Promise<void> {
        await expect(this.getCommentItems()).toHaveCount(count);
    }

    /**
     * Verify include deleted expenses checkbox is visible
     */
    async verifyIncludeDeletedExpensesCheckboxVisible(): Promise<void> {
        await expect(this.getIncludeDeletedExpensesCheckbox()).toBeVisible();
    }

    /**
     * Verify include deleted expenses checkbox is checked
     */
    async verifyIncludeDeletedExpensesCheckboxChecked(): Promise<void> {
        await expect(this.getIncludeDeletedExpensesCheckbox()).toBeChecked();
    }

    /**
     * Verify include deleted expenses checkbox does not exist
     */
    async verifyIncludeDeletedExpensesCheckboxNotExists(): Promise<void> {
        await expect(this.getIncludeDeletedExpensesCheckbox()).toHaveCount(0);
    }

    /**
     * Verify include deleted settlements checkbox is visible
     */
    async verifyIncludeDeletedSettlementsCheckboxVisible(): Promise<void> {
        await expect(this.getIncludeDeletedSettlementsCheckbox()).toBeVisible();
    }

    /**
     * Verify include deleted settlements checkbox is checked
     */
    async verifyIncludeDeletedSettlementsCheckboxChecked(): Promise<void> {
        await expect(this.getIncludeDeletedSettlementsCheckbox()).toBeChecked();
    }

    /**
     * Verify include deleted settlements checkbox does not exist
     */
    async verifyIncludeDeletedSettlementsCheckboxNotExists(): Promise<void> {
        await expect(this.getIncludeDeletedSettlementsCheckbox()).toHaveCount(0);
    }

    /**
     * Verify settlement container is visible
     */
    async verifySettlementContainerVisible(): Promise<void> {
        await expect(this.getSettlementContainer()).toBeVisible();
    }

    /**
     * Verify settlement container is not visible
     */
    async verifySettlementContainerNotVisible(): Promise<void> {
        await expect(this.getSettlementContainer()).not.toBeVisible();
    }

    /**
     * Verify number of settlement items matches expected count
     */
    async verifySettlementItemCount(expectedCount: number): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        await expect(this.getSettlementItems()).toHaveCount(expectedCount);
    }

    /**
     * Verify a settlement item at a given index contains the specified amount
     */
    async verifySettlementItemContainsAmount(index: number, amount: string): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        await expect(this.getSettlementItems().nth(index)).toContainText(amount);
    }

    /**
     * Get the "Load More" button in the settlements section
     */
    private getLoadMoreSettlementsButton(): Locator {
        return this.getSettlementContainer().getByRole('button', { name: /load more/i });
    }

    /**
     * Verify the "Load More" settlements button is visible
     */
    async verifyLoadMoreSettlementsButtonVisible(): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        await expect(this.getLoadMoreSettlementsButton()).toBeVisible();
    }

    /**
     * Verify the "Load More" settlements button is not visible
     */
    async verifyLoadMoreSettlementsButtonNotVisible(): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        await expect(this.getLoadMoreSettlementsButton()).not.toBeVisible();
    }

    /**
     * Click the "Load More" settlements button to load additional settlements
     */
    async clickLoadMoreSettlements(): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const button = this.getLoadMoreSettlementsButton();
        await this.clickButton(button, { buttonName: 'Load More Settlements' });
    }

    /**
     * Get the "no payments for you" message in the settlements section
     */
    private getNoPaymentsForYouMessage(): Locator {
        return this.getSettlementContainer().getByText(translation.settlementHistory.noPaymentsForYou);
    }

    /**
     * Verify the "no payments for you" message is visible
     */
    async verifyNoPaymentsForYouMessageVisible(): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        await expect(this.getNoPaymentsForYouMessage()).toBeVisible();
    }

    /**
     * Verify the "no payments for you" message is not visible
     */
    async verifyNoPaymentsForYouMessageNotVisible(): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        await expect(this.getNoPaymentsForYouMessage()).not.toBeVisible();
    }

    /**
     * Verify expenses container is visible
     */
    async verifyExpensesContainerVisible(): Promise<void> {
        await expect(this.getExpensesContainer()).toBeVisible();
    }

    /**
     * Verify expenses container is not visible
     */
    async verifyExpensesContainerNotVisible(): Promise<void> {
        await expect(this.getExpensesContainer()).not.toBeVisible();
    }

    /**
     * Verify member item is visible
     */
    async verifyMemberItemVisible(memberName: string): Promise<void> {
        await expect(this.getMemberItem(memberName)).toBeVisible();
    }

    /**
     * Verify member cards count matches expected
     */
    async verifyMemberCardsCount(count: number): Promise<void> {
        await expect(this.getMemberCards()).toHaveCount(count);
    }

    /**
     * Verify group stats text contains expected value (e.g., member count)
     */
    async verifyMemberCountText(text: string): Promise<void> {
        await expect(this.getGroupStats()).toContainText(text);
    }

    /**
     * Verify security settings button is visible
     */
    async verifySecuritySettingsButtonVisible(): Promise<void> {
        await expect(this.getSecuritySettingsButton()).toBeVisible();
    }

    // Public locator accessors for tests
    getEditGroupButtonLocator(): Locator {
        return this.getEditGroupButton();
    }

    getMemberItemLocator(memberName: string): Locator {
        return this.getMemberItem(memberName);
    }

    getMemberCardsLocator(): Locator {
        return this.getMemberCards();
    }

    getBalanceContainerLocator(): Locator {
        return this.getBalanceContainer();
    }

    getSettlementButtonForDebtLocator(payerName: string, payeeName: string): Locator {
        return this.getSettlementButtonForDebt(payerName, payeeName);
    }

    // ============================================================================
    // ACTIVITY FEED SECTION
    // ============================================================================

    /**
     * Verify activity feed card is visible
     */
    async verifyActivityFeedCardVisible(): Promise<void> {
        await expect(this.getActivityFeedCard()).toBeVisible();
    }

    /**
     * Verify activity feed card is not visible
     */
    async verifyActivityFeedCardNotVisible(): Promise<void> {
        await expect(this.getActivityFeedCard()).not.toBeVisible();
    }

    /**
     * Verify activity feed is visible (expanded state)
     */
    async verifyActivityFeedVisible(): Promise<void> {
        await this.ensureActivitySectionExpanded();
        await expect(this.getActivityFeedContainer()).toBeVisible();
    }

    /**
     * Verify activity feed empty state is visible
     */
    async verifyActivityFeedEmpty(): Promise<void> {
        // For empty state, we can't expand since there's no container - just check the toggle is expanded
        // and the empty state div is visible
        await this.ensureToggleExpanded(this.getActivityToggle());
        await expect(this.getActivityFeedEmptyState()).toBeVisible();
    }

    /**
     * Verify activity feed has expected number of items
     */
    async verifyActivityFeedItemCount(expectedCount: number): Promise<void> {
        await this.ensureActivitySectionExpanded();
        await expect(this.getActivityFeedItems()).toHaveCount(expectedCount);
    }

    /**
     * Verify activity feed contains an item with the specified event type
     * .first(): Verify at least one item with event type exists
     */
    async verifyActivityFeedHasEventType(eventType: string): Promise<void> {
        await this.ensureActivitySectionExpanded();
        const item = this.getActivityFeedContainer().locator(`[data-event-type="${eventType}"]`);
        await expect(item.first()).toBeVisible();
    }

    /**
     * Verify activity feed contains text
     */
    async verifyActivityFeedContainsText(text: string): Promise<void> {
        await this.ensureActivitySectionExpanded();
        await expect(this.getActivityFeedContainer()).toContainText(text);
    }

    /**
     * Wait for activity feed to have at least one item
     */
    async waitForActivityFeedItems(timeout: number = 5000): Promise<void> {
        await this.ensureActivitySectionExpanded();
        await expect(async () => {
            const count = await this.getActivityFeedItems().count();
            if (count === 0) {
                throw new Error('No activity feed items found yet');
            }
        })
            .toPass({ timeout });
    }

    /**
     * Verify activity feed does NOT contain specific text
     */
    async verifyActivityFeedDoesNotContainText(text: string): Promise<void> {
        await this.ensureActivitySectionExpanded();
        await expect(this.getActivityFeedContainer()).not.toContainText(text);
    }

    /**
     * Click an activity feed item by its text content
     */
    async clickActivityFeedItemByText(text: string): Promise<void> {
        await this.ensureActivitySectionExpanded();
        const item = this.getActivityFeedContainer().getByText(text);
        await item.click();
    }

    // ============================================================================
    // SETTLEMENT REACTIONS
    // ============================================================================

    /**
     * Get the add reaction button for a settlement by note
     */
    protected getSettlementAddReactionButton(note: string | RegExp): Locator {
        return this.getSettlementItem(note).getByRole('button', { name: translation.reactions.addReaction });
    }

    /**
     * Get a reaction pill on a settlement by note
     */
    protected getSettlementReactionPill(note: string | RegExp, emoji: ReactionEmoji): Locator {
        return this.getSettlementItem(note).locator('button').filter({ hasText: emoji });
    }

    /**
     * Get the reaction picker (shared across all reactions)
     */
    protected getReactionPicker(): Locator {
        return this.page.getByRole('listbox');
    }

    /**
     * Click the add reaction button on a settlement
     */
    async clickSettlementAddReaction(note: string | RegExp): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const button = this.getSettlementAddReactionButton(note);
        await expect(button).toBeVisible();
        await button.click();
        await expect(this.getReactionPicker()).toBeVisible();
    }

    /**
     * Select an emoji from the reaction picker
     */
    async selectReactionEmoji(emoji: ReactionEmoji): Promise<void> {
        const picker = this.getReactionPicker();
        const emojiButton = picker.getByRole('option').filter({ hasText: emoji });
        await expect(emojiButton).toBeVisible();
        await emojiButton.click();
        await expect(picker).not.toBeVisible();
    }

    /**
     * Add a reaction to a settlement
     */
    async addSettlementReaction(note: string | RegExp, emoji: ReactionEmoji): Promise<void> {
        await this.clickSettlementAddReaction(note);
        await this.selectReactionEmoji(emoji);
    }

    /**
     * Toggle a reaction on a settlement
     */
    async toggleSettlementReaction(note: string | RegExp, emoji: ReactionEmoji): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const pill = this.getSettlementReactionPill(note, emoji);
        await expect(pill).toBeVisible();
        await pill.click();
    }

    /**
     * Verify a settlement reaction is visible with count
     */
    async verifySettlementReactionVisible(note: string | RegExp, emoji: ReactionEmoji, count: number): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const pill = this.getSettlementReactionPill(note, emoji);
        await expect(pill).toBeVisible();
        await expect(pill).toContainText(String(count));
    }

    /**
     * Verify a settlement reaction is not visible
     */
    async verifySettlementReactionNotVisible(note: string | RegExp, emoji: ReactionEmoji): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const pill = this.getSettlementReactionPill(note, emoji);
        await expect(pill).not.toBeVisible();
    }

    /**
     * Verify a settlement reaction is highlighted (user has reacted)
     */
    async verifySettlementReactionHighlighted(note: string | RegExp, emoji: ReactionEmoji): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const pill = this.getSettlementReactionPill(note, emoji);
        await expect(pill).toHaveAttribute('aria-pressed', 'true');
    }

    /**
     * Verify a settlement reaction is not highlighted
     */
    async verifySettlementReactionNotHighlighted(note: string | RegExp, emoji: ReactionEmoji): Promise<void> {
        await this.ensureSettlementsSectionExpanded();
        const pill = this.getSettlementReactionPill(note, emoji);
        await expect(pill).toHaveAttribute('aria-pressed', 'false');
    }

    // ============================================================================
    // LOCKED GROUP HELPERS
    // ============================================================================

    /**
     * Get the locked group banner/alert
     */
    protected getLockedGroupBanner(): Locator {
        return this.page.getByRole('alert').filter({ hasText: translation.group.locked.banner });
    }

    /**
     * Verify the locked group banner is visible
     */
    async verifyLockedGroupBannerVisible(): Promise<void> {
        await expect(this.getLockedGroupBanner()).toBeVisible();
    }

    /**
     * Verify the locked group banner is not visible
     */
    async verifyLockedGroupBannerNotVisible(): Promise<void> {
        await expect(this.getLockedGroupBanner()).not.toBeVisible();
    }

    /**
     * Wait for the locked group banner to appear
     */
    async waitForLockedGroupBanner(timeout: number = 5000): Promise<void> {
        await expect(this.getLockedGroupBanner()).toBeVisible({ timeout });
    }

    /**
     * Verify add expense button is disabled (when group is locked)
     */
    async verifyAddExpenseButtonDisabled(): Promise<void> {
        await expect(this.getAddExpenseButton()).toBeDisabled();
    }

    /**
     * Verify add expense button is enabled
     */
    async verifyAddExpenseButtonEnabled(): Promise<void> {
        await expect(this.getAddExpenseButton()).toBeEnabled();
    }

    /**
     * Verify settle up button is disabled (when group is locked)
     */
    async verifySettleUpButtonDisabled(): Promise<void> {
        await expect(this.getSettleUpButton()).toBeDisabled();
    }

    /**
     * Verify settle up button is enabled
     */
    async verifySettleUpButtonEnabled(): Promise<void> {
        await expect(this.getSettleUpButton()).toBeEnabled();
    }

    /**
     * Verify share/invite button is disabled (when group is locked)
     */
    async verifyShareGroupButtonDisabled(): Promise<void> {
        await expect(this.getShareGroupButton()).toBeDisabled();
    }

    /**
     * Verify share/invite button is enabled
     */
    async verifyShareGroupButtonEnabled(): Promise<void> {
        await expect(this.getShareGroupButton()).toBeEnabled();
    }

    /**
     * Verify all action buttons are disabled (group is locked)
     */
    async verifyAllActionButtonsDisabled(): Promise<void> {
        await this.verifyAddExpenseButtonDisabled();
        await this.verifySettleUpButtonDisabled();
        await this.verifyShareGroupButtonDisabled();
    }

    /**
     * Verify all action buttons are enabled (group is unlocked)
     */
    async verifyAllActionButtonsEnabled(): Promise<void> {
        await this.verifyAddExpenseButtonEnabled();
        await this.verifySettleUpButtonEnabled();
        await this.verifyShareGroupButtonEnabled();
    }
}

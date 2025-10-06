import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { EditGroupModalPage } from './EditGroupModalPage';
import { ShareGroupModalPage } from './ShareGroupModalPage';
import { LeaveGroupDialogPage } from './LeaveGroupDialogPage';
import { loadTranslation } from './translation-loader';

const translation = loadTranslation();

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
    async navigateToGroup(groupId: string): Promise<void> {
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
        return this.page.locator('div').filter({
            has: this.page.getByRole('heading').filter({ hasText: /^members$/i })
        }).first();
    }

    /**
     * Expenses section container - found by "Expenses" or "Recent Expenses" heading
     */
    getExpensesContainer(): Locator {
        return this.page.locator('div').filter({
            has: this.page.getByRole('heading').filter({ hasText: /expenses/i })
        }).first();
    }

    /**
     * Balance/Debts section container - found by "Balance" or "Balances" heading
     */
    getBalanceContainer(): Locator {
        return this.page.locator('div').filter({
            has: this.page.getByRole('heading').filter({ hasText: /balance/i })
        }).first();
    }

    /**
     * Settlement section container - found by "Settlements" heading
     */
    getSettlementContainer(): Locator {
        return this.page.locator('div').filter({
            has: this.page.getByRole('heading').filter({ hasText: /settlement/i })
        }).first();
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
     * Group description - paragraph text near the group name
     */
    getGroupDescription(): Locator {
        // Find description near the group name heading
        return this.page.locator('p').filter({ hasText: /./  }).first();
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
        return this.getExpensesContainer().locator('p').filter({ hasText: /no.*expenses/i });
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
     * Get "All settled up" message
     * Finds visible instance (works for both mobile and desktop views)
     */
    getSettledUpMessage(): Locator {
        return this.page.getByText(translation.balanceSummary.allSettledUp).locator('visible=true').first();
    }

    /**
     * Get debt items - finds visible instances (works for both mobile and desktop views)
     */
    getDebtItems(): Locator {
        return this.page.locator('[data-testid="debt-item"]').locator('visible=true');
    }

    // ============================================================================
    // MODALS
    // ============================================================================

    /**
     * Edit Group Modal
     */
    getEditGroupModal(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByRole('heading', { name: translation.group.edit.title })
        });
    }

    /**
     * Share Group Modal
     */
    getShareGroupModal(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByRole('heading', { name: translation.group.share.title })
        });
    }

    /**
     * Leave Group Dialog
     */
    getLeaveGroupDialog(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByText(/leave.*group/i)
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
     * Click Add Expense button
     */
    async clickAddExpense(): Promise<void> {
        await this.getAddExpenseButton().click();
        await this.waitForNetworkIdle();
    }

    /**
     * Click Edit Group button
     * Non-fluent version - does not return modal page object
     */
    async clickEditGroup(): Promise<void> {
        await this.getEditGroupButton().click();
        await expect(this.getEditGroupModal()).toBeVisible();
    }

    /**
     * Click Edit Group button and open edit modal
     * Fluent version - verifies modal opens and returns EditGroupModalPage
     */
    async clickEditGroupAndOpenModal(): Promise<EditGroupModalPage> {
        const button = this.getEditGroupButton();
        await expect(button).toBeVisible();
        await button.click();

        const modalPage = new EditGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
        return modalPage;
    }

    /**
     * Click Share Group button
     * Non-fluent version - does not return modal page object
     */
    async clickShareGroup(): Promise<void> {
        await this.getShareGroupButton().click();
        await expect(this.getShareGroupModal()).toBeVisible();
    }

    /**
     * Click Share Group button and open share modal
     * Fluent version - verifies modal opens and returns ShareGroupModalPage
     */
    async clickShareGroupAndOpenModal(): Promise<ShareGroupModalPage> {
        const button = this.getShareGroupButton();
        await expect(button).toBeVisible();
        await button.click();

        const modalPage = new ShareGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
        return modalPage;
    }

    /**
     * Click Leave Group button
     * Non-fluent version - does not return dialog page object
     */
    async clickLeaveGroup(): Promise<void> {
        await this.getLeaveGroupButton().click();
        await expect(this.getLeaveGroupDialog()).toBeVisible();
    }

    /**
     * Click Leave Group button and open leave dialog
     * Fluent version - verifies dialog opens and returns LeaveGroupDialogPage
     */
    async clickLeaveGroupAndOpenDialog(): Promise<LeaveGroupDialogPage> {
        const button = this.getLeaveGroupButton();
        await expect(button).toBeVisible();
        await button.click();

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
    async waitForExpenseToAppear(description: string, timeout = 3000): Promise<void> {
        await expect(this.getExpenseByDescription(description)).toBeVisible({ timeout });
    }

    /**
     * Wait for member to appear
     */
    async waitForMemberToAppear(memberName: string, timeout = 3000): Promise<void> {
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

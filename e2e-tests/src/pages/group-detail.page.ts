import { expect, Locator, Page } from '@playwright/test';
import { GroupDetailPage as BaseGroupDetailPage, HeaderPage, SettlementFormPage as SharedSettlementFormPage } from '@splitifyd/test-support';
import { ExpenseDetailPage } from '@splitifyd/test-support';
import { LeaveGroupDialogPage } from '@splitifyd/test-support';
import { RemoveMemberDialogPage } from '@splitifyd/test-support';
import { SettlementFormPage as E2ESettlementFormPage } from './settlement-form.page';
import { GroupId } from '@splitifyd/shared';

export class GroupDetailPage extends BaseGroupDetailPage {
    private _header?: HeaderPage;

    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // E2E-SPECIFIC PROPERTIES AND BASIC UTILITIES
    // ============================================================================

    /**
     * Header property for e2e navigation
     */
    get header(): HeaderPage {
        if (!this._header) {
            this._header = new HeaderPage(this.page);
        }
        return this._header;
    }

    /**
     * Infer group ID from URL (e2e utility)
     */
    inferGroupId(): string {
        const url = new URL(this.page.url());
        const match = url.pathname.match(/\/groups\/([a-zA-Z0-9]+)/);
        if (!match) {
            throw new Error(`Could not infer group ID from URL: ${url.pathname}`);
        }
        return match[1];
    }

    // ============================================================================
    // E2E-SPECIFIC GETTERS AND FORM OPENING METHODS
    // ============================================================================

    /**
     * Click Settle Up button and open settlement form (e2e-specific workflow)
     * This is an e2e version that returns the extended SettlementFormPage instead of void
     */
    async clickSettleUpButton(expectedMemberCount: number): Promise<E2ESettlementFormPage> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        // Get button and click it (clickButton will handle attachment wait internally)
        const settleButton = this.getSettleUpButton();

        await this.clickButton(settleButton, { buttonName: 'Settle up' });

        // Verify modal opened
        const settlementFormPage = new E2ESettlementFormPage(this.page);
        await expect(settlementFormPage.getModal()).toBeVisible();

        const membersCount = await this.getCurrentMemberCount();
        expect(membersCount).toBe(expectedMemberCount);

        await settlementFormPage.waitForFormReady(expectedMemberCount);
        return settlementFormPage;
    }

    // ============================================================================
    // POLLING AND WAITING METHODS (Real-time update verification)
    // ============================================================================

    /**
     * Wait for group title to update (e2e-specific polling for real-time updates)
     */
    async waitForGroupTitle(text: string) {
        await this.waitForDomContentLoaded();

        // Use polling pattern to handle async updates (since no real-time websockets yet)
        await expect(async () => {
            const title = await this.getGroupName().textContent();
            if (title !== text) {
                throw new Error(`Title is still "${title}", waiting for "${text}"`);
            }
        })
            .toPass({
                timeout: 5000,
                intervals: [500, 1000, 1500, 2000], // Retry at these intervals
            });
    }

    /**
     * Wait for group description to update (e2e-specific polling for real-time updates)
     */
    async waitForGroupDescription(text: string) {
        await this.waitForDomContentLoaded();

        // Use polling pattern to handle async updates (since no real-time websockets yet)
        await expect(async () => {
            const description = await this.getGroupDescription().textContent();
            if (description !== text) {
                throw new Error(`Description is still "${description}", waiting for "${text}"`);
            }
        })
            .toPass({
                timeout: 5000,
                intervals: [500, 1000, 1500, 2000], // Retry at these intervals
            });
    }

    /**
     * Waits for the group to have the expected number of members.
     * Relies on real-time updates to show the correct member count.
     */
    async waitForMemberCount(expectedCount: number, timeout = 5000): Promise<void> {
        // Assert we're on a group page before waiting for member count
        const currentUrl = this.page.url();
        if (!currentUrl.includes('/groups/') && !currentUrl.includes('/group/')) {
            throw new Error(`waitForMemberCount called but not on a group page. Current URL: ${currentUrl}`);
        }

        // Wait for page to load
        await this.waitForDomContentLoaded();

        // Use polling pattern to wait for both member count text AND actual member items
        await expect(async () => {
            // Check member count text
            let textCount: number;
            try {
                textCount = await this.getCurrentMemberCount();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Member count text not ready: ${errorMessage}`);
            }

            // Check actual member items
            const actualItems = await this.getMemberCards().count();

            // Both must match expected count
            if (textCount !== expectedCount || actualItems !== expectedCount) {
                // Get member names for better debugging
                const memberNames = await this.getMemberNames();
                throw new Error(
                    `Member count mismatch. Expected: ${expectedCount}, `
                        + `Text shows: ${textCount}, Actual items: ${actualItems}. `
                        + `Members: [${memberNames.join(', ')}]. URL: ${this.page.url()}`,
                );
            }
        })
            .toPass({ timeout });

        // Double-check we're still on the group page after waiting
        const finalUrl = this.page.url();
        if (!finalUrl.includes('/groups/') && !finalUrl.includes('/group/')) {
            throw new Error(`Navigation changed during waitForMemberCount. Now on: ${finalUrl}`);
        }
    }

    /**
     * Wait for balances section to be ready - replaces deprecated waitForBalancesToLoad and waitForBalanceUpdate
     * This method waits for the balance section to be visible but doesn't rely on generic loading states.
     * For specific debt verification, use verifyDebtRelationship() or waitForSettledUpMessage().
     */
    async waitForBalancesSection(groupId: GroupId): Promise<void> {
        // Assert we're on the correct group page
        const currentUrl = this.page.url();
        if (!currentUrl.includes(`/groups/${groupId}`)) {
            throw new Error(`waitForBalancesSection called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`);
        }

        // Wait for balances section to be visible
        const balancesSection = this.getBalanceContainer();
        await expect(balancesSection).toBeVisible({ timeout: 3000 });

        // Wait for any loading text to disappear if present
        try {
            await expect(balancesSection.getByText('Loading balances...')).not.toBeVisible({ timeout: 2000 });
        } catch (e) {
            // Loading text might not be present, that's okay
        }
    }

    async waitForPage(groupId: GroupId, expectedMemberCount: number) {
        const targetGroupUrl = `/groups/${groupId}`;
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);

        await this.header.getCurrentUserDisplayName(); // just a sanity check - top right by the menu

        await this.waitForMemberCount(expectedMemberCount);
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);
        await this.waitForBalancesSection(groupId);
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);
    }

    async waitForExpense(expenseDescription: string) {
        // Use polling to handle real-time expense creation
        await expect(async () => {
            const expenseElement = this.getExpenseByDescription(expenseDescription);
            const count = await expenseElement.count();
            if (count === 0) {
                throw new Error(`Expense with description "${expenseDescription}" not found yet`);
            }

            const isVisible = await expenseElement.first().isVisible();
            if (!isVisible) {
                throw new Error(`Expense with description "${expenseDescription}" found but not visible yet`);
            }
        })
            .toPass({
                timeout: 5000,
                intervals: [100, 200, 300, 500, 1000],
            });
    }

    private async sanityCheckPageUrl(currentUrl: string, targetGroupUrl: string) {
        // Assert we're actually on the group page
        if (!currentUrl.includes(targetGroupUrl)) {
            // Take screenshot before throwing error
            throw new Error(`Navigation failed. Expected URL to contain ${targetGroupUrl}, but got: ${currentUrl}`);
        }
    }

    // ============================================================================
    // EXPENSE METHODS
    // ============================================================================

    /**
     * Clicks on an expense by its description to view details
     * Returns the ExpenseDetailPage for further interactions
     */
    async clickExpenseToView(description: string): Promise<ExpenseDetailPage> {
        const expense = this.getExpenseByDescription(description);
        // Note: Expense item is not a button but a clickable element

        await expense.click();

        // Create and wait for expense detail page to be ready
        const expenseDetailPage = new ExpenseDetailPage(this.page);
        await expenseDetailPage.waitForPageReady();

        return expenseDetailPage;
    }

    /**
     * Verify that a currency amount is visible for a specific user within the expenses section
     * Properly scoped to the Expenses container by its heading
     * @param payer - The display name of the user who paid (e.g., 'pool user 6dbee5f4')
     * @param currencyAmount - The formatted currency amount to find (e.g., '¥123', 'BHD 30.500', 'EUR 50.00')
     */
    /**
     * Gets debt information from balances section
     */
    getDebtInfo(debtorName: string, creditorName: string) {
        const balancesSection = this.getBalanceContainer();
        // UI now uses arrow notation: "User A → User B" instead of "owes"
        return balancesSection.getByText(`${debtorName} → ${creditorName}`).or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
    }

    // ============================================================================
    // MEMBER COUNT AND ITEMS
    // ============================================================================

    // ============================================================================
    // SETTLEMENT HISTORY METHODS (Payment History Section)
    // ============================================================================

    /**
     * Click edit button for a settlement and wait for edit form to open
     */
    override async clickEditSettlement<T extends SharedSettlementFormPage = SharedSettlementFormPage>(
        settlementNote: string | RegExp,
        options: {
            createSettlementFormPage?: (page: Page) => T;
            expectedMemberCount?: number;
            waitForFormReady?: boolean;
            ensureUpdateHeading?: boolean;
        } = {},
    ): Promise<T> {
        const createSettlementFormPage =
            options.createSettlementFormPage
            ?? ((page: Page) => new E2ESettlementFormPage(page) as unknown as T);

        return super.clickEditSettlement<T>(settlementNote, {
            ...options,
            createSettlementFormPage,
            waitForFormReady: options.waitForFormReady ?? true,
        });
    }

    /**
     * Legacy alias retained for existing test call sites.
     */
    async openHistoryIfClosed(): Promise<void> {
        await this.ensureSettlementHistoryOpen();
    }

    /**
     * Ensures group page is fully loaded before proceeding with expense operations.
     * This should be called after creating a group or navigating to a group page.
     */
    async ensureNewGroupPageReadyWithOneMember(groupId: GroupId): Promise<void> {
        await this.waitForDomContentLoaded();
        await this.waitForMemberCount(1); // Wait for at least the creator to show
        await this.waitForBalancesSection(groupId);
    }

    // ============================================================================
    // MEMBER MANAGEMENT METHODS
    // ============================================================================

    private getMemberItem(memberName: string): Locator {
        // Use data-member-name attribute for precise selection within the members container
        // This avoids issues with "Admin" text or other content in the member item
        // Important: Only select visible member items within the Members section
        const membersContainer = this.getMembersContainer();
        return membersContainer.locator(`[data-testid="member-item"][data-member-name="${memberName}"]:visible`);
    }

    getRemoveMemberButton(memberName: string): Locator {
        const memberItem = this.getMemberItem(memberName);
        return memberItem.locator('[data-testid="remove-member-button"]');
    }

    /**
     * E2E-specific version that returns LeaveGroupModalPage
     * The shared base has clickLeaveGroup() that returns void
     * This version is for e2e workflows that need the page object
     */
    async clickLeaveGroupButton(): Promise<LeaveGroupDialogPage> {
        const leaveButton = this.getLeaveGroupButton();
        await this.clickButton(leaveButton, { buttonName: 'Leave Group' });

        // Create and return the LeaveGroup dialog instance
        const leaveModal = new LeaveGroupDialogPage(this.page);
        await leaveModal.waitForDialogVisible();

        return leaveModal;
    }

    async waitForRedirectAwayFromGroup(groupId: GroupId): Promise<void> {
        // Use proper web-first assertion to wait for URL change
        await expect(this.page).not.toHaveURL(new RegExp(`/groups/${groupId}`), { timeout: 5000 });
    }

    async clickRemoveMember(memberName: string): Promise<RemoveMemberDialogPage> {
        const memberItem = this.getMemberItem(memberName);
        try {
            await expect(memberItem).toBeVisible({ timeout: 5000 });
        } catch (e) {
            // Only get visible member items for error message
            const visibleMemberItems = await this.page.locator('[data-testid="member-item"]:visible').all();
            const visibleMembers = await Promise.all(
                visibleMemberItems.map(async (item) => {
                    const text = await item.innerText();
                    const dataName = await item.getAttribute('data-member-name');
                    return `${text.replace(/\n/g, ' ')} [data-member-name="${dataName}"]`;
                }),
            );
            throw new Error(`Failed to find visible member "${memberName}". Visible members:\n${visibleMembers.map((m, i) => `  ${i + 1}. ${m}`).join('\n')}`);
        }

        const removeButton = this.getRemoveMemberButton(memberName);
        await this.clickButton(removeButton, { buttonName: `Remove ${memberName}` });

        // Create and return the RemoveMemberModalPage instance
        const removeModal = new RemoveMemberDialogPage(this.page);
        await removeModal.waitForDialogVisible();
        return removeModal;
    }

}

/**
 * Helper to build a group detail URL pattern
 */
export function groupDetailUrlPattern(groupId?: string): RegExp {
    if (groupId) {
        return new RegExp(`/groups/${groupId}$`);
    }
    return /\/groups\/[a-zA-Z0-9]+$/;
}

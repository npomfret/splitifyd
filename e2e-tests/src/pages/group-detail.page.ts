import { expect, Locator, Page } from '@playwright/test';
import { GroupDetailPage as BaseGroupDetailPage } from '@splitifyd/test-support';
import { DashboardPage } from './dashboard.page.ts';
import { EditGroupModalPage } from './edit-group-modal.page';
import { ExpenseDetailPage } from './expense-detail.page';
import { ExpenseFormPage } from './expense-form.page';
import { HeaderPage } from './header.page';
import { LeaveGroupModalPage } from './leave-group-modal.page';
import { RemoveMemberModalPage } from './remove-member-modal.page';
import { SettlementFormPage } from './settlement-form.page';
import { ShareGroupModalPage } from './share-group-modal.page';

export class GroupDetailPage extends BaseGroupDetailPage {
    private _header?: HeaderPage;

    constructor(page: Page) {
        super(page);
    }

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
     * Get URL parameter (e2e utility)
     */
    getUrlParam(paramName: string): string | null {
        const url = new URL(this.page.url());
        const pathParts = url.pathname.split('/');
        const paramIndex = pathParts.indexOf(paramName);
        if (paramIndex !== -1 && paramIndex < pathParts.length - 1) {
            return pathParts[paramIndex + 1];
        }
        return null;
    }

    /**
     * Navigate to dashboard (e2e-specific workflow)
     */
    async navigateToDashboard() {
        await this.header.navigateToDashboard();
        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.waitForDashboard();
        return dashboardPage;
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

    /**
     * Get group name as text (e2e-specific, shared base has getGroupName() returning Locator)
     */
    async getGroupNameText(): Promise<string> {
        const title = await this.getGroupName().textContent();
        return title?.trim() || '';
    }

    /**
     * Click Settle Up button and open settlement form (e2e-specific workflow)
     * This is an e2e version that returns SettlementFormPage instead of void
     */
    async clickSettleUpButton(expectedMemberCount: number): Promise<SettlementFormPage> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        // Get button and click it (clickButton will handle attachment wait internally)
        const settleButton = this.getSettleUpButton();

        await this.clickButton(settleButton, { buttonName: 'Settle up' });

        // Verify modal opened
        const settlementFormPage = new SettlementFormPage(this.page);
        await expect(settlementFormPage.getModal()).toBeVisible();

        const membersCount = await this.getCurrentMemberCount();
        expect(membersCount).toBe(expectedMemberCount);

        await settlementFormPage.waitForFormReady(expectedMemberCount);
        return settlementFormPage;
    }

    async clickAddExpenseButton(): Promise<ExpenseFormPage> {
        const expectedMemberCount = await this.getCurrentMemberCount();
        const memberNames = await this.getMemberNames();
        expect(memberNames.length).toBeGreaterThan(0); // sanity check
        expect(memberNames.length).toBe(expectedMemberCount); // sanity check

        const addButton = this.getAddExpenseButton();

        await this.clickButton(addButton, { buttonName: 'Add Expense' });

        // Wait for navigation to expense form
        const expectedUrlPattern = /\/groups\/[a-zA-Z0-9]+\/add-expense/;
        await expect(this.page).toHaveURL(expectedUrlPattern);
        await this.waitForDomContentLoaded();

        // Verify we're on the correct page
        const currentUrl = this.page.url();
        if (!currentUrl.match(expectedUrlPattern)) {
            throw new Error(`Navigation failed - expected URL pattern ${expectedUrlPattern}, got ${currentUrl}`);
        }

        // Wait for any loading spinner to disappear
        const loadingSpinner = this.page.locator('.animate-spin');
        const loadingText = this.page.getByText('Loading expense form...');

        if ((await loadingSpinner.count()) > 0 || (await loadingText.count()) > 0) {
            await expect(loadingSpinner).not.toBeVisible({ timeout: 5000 });
            await expect(loadingText).not.toBeVisible({ timeout: 5000 });
        }

        // Verify we're still on the correct page
        if (!this.page.url().match(expectedUrlPattern)) {
            throw new Error(`Navigation failed after loading - expected URL pattern ${expectedUrlPattern}, got ${this.page.url()}`);
        }

        // Create and validate the expense form page
        const expenseFormPage = new ExpenseFormPage(this.page);

        // Wait for form to be ready
        await expenseFormPage.waitForFormReady(memberNames);

        return expenseFormPage;
    }

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
            const actualItems = await this.getActualMemberItems().count();

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
    async waitForBalancesSection(groupId: string): Promise<void> {
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

    async waitForPage(groupId: string, expectedMemberCount: number) {
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

    getExpenseByDescription(description: string) {
        // Simply look for the expense description text within the expenses container
        // This matches what users actually see on the page
        const expensesContainer = this.getExpensesContainer();
        return expensesContainer.getByText(description);
    }

    /**
     * Opens the share group modal and returns the ShareGroupModalPage instance.
     * E2E-specific version that returns e2e ShareGroupModalPage
     */
    async openShareGroupModal(): Promise<ShareGroupModalPage> {
        const shareButton = this.getShareGroupButton();
        await this.clickButton(shareButton, { buttonName: 'Invite Others' });

        // Create and return the e2e ShareGroupModalPage instance
        const shareModal = new ShareGroupModalPage(this.page);
        await shareModal.waitForModalToOpen();

        return shareModal;
    }

    /**
     * Gets the share link from the group page.
     * Assumes the app works perfectly - no retries or workarounds.
     */
    async getShareLink(): Promise<string> {
        const shareModal = await this.openShareGroupModal();
        const shareLink = await shareModal.getShareLink();
        await shareModal.closeModal();
        return shareLink;
    }

    /**
     * Gets debt information from balances section
     */
    getDebtInfo(debtorName: string, creditorName: string) {
        const balancesSection = this.getBalanceContainer();
        // UI now uses arrow notation: "User A → User B" instead of "owes"
        return balancesSection.getByText(`${debtorName} → ${creditorName}`).or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
    }

    /**
     * Opens the edit group modal by clicking the settings button
     * E2E-specific version that returns e2e EditGroupModalPage
     */
    async openEditGroupModal(): Promise<EditGroupModalPage> {
        const settingsButton = this.getEditGroupButton();
        await this.clickButton(settingsButton, { buttonName: 'Group Settings' });

        // Create and return the e2e EditGroupModalPage instance
        const editModal = new EditGroupModalPage(this.page);
        await editModal.waitForModalVisible();

        return editModal;
    }

    // ==============================
    // ADDITIONAL METHODS FOR TEST REFACTORING
    // ==============================

    /**
     * Get member count text element using data-testid
     */
    getMemberCountElement() {
        return this.page.getByTestId('member-count');
    }

    /**
     * Get the actual member count as a number by parsing the UI text
     * Waits for the API-loaded member count to be available
     */
    async getCurrentMemberCount(): Promise<number> {
        const memberCountElement = this.getMemberCountElement();
        await expect(memberCountElement).toBeVisible({ timeout: 1000 });

        const memberText = await memberCountElement.textContent();
        if (!memberText) {
            throw new Error('Could not find member count text in UI');
        }

        // Extract number from text like "1 member" or "3 members"
        const match = memberText.match(/(\d+)\s+member/i);
        if (!match) {
            throw new Error(`Could not parse member count from text: "${memberText}"`);
        }

        return parseInt(match[1], 10);
    }

    /**
     * Get actual member items displayed in the members list
     */
    getActualMemberItems() {
        return this.getMembersContainer().locator('[data-testid="member-item"]:visible');
    }

    /**
     * Get all visible member names for debugging purposes
     */
    async getMemberNames(): Promise<string[]> {
        const memberItems = this.getActualMemberItems();
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
     * E2E-specific payment history container (for settlement features)
     */
    private getPaymentHistoryContainer(): Locator {
        // Find the SidebarCard containing "Payment History" heading
        // Based on SidebarCard structure: bg-white rounded-lg shadow-sm border border-gray-200 p-4
        return this.page.locator('.bg-white.rounded-lg.shadow-sm.border.border-gray-200.p-4').filter({
            has: this.page.locator('h3').filter({ hasText: 'Payment History' }),
        });
    }

    async verifyExpenseInList(description: string, amount?: string) {
        await expect(this.getExpenseByDescription(description)).toBeVisible();
        if (amount) {
            await expect(this.page.getByText(amount)).toBeVisible();
        }
    }

    /**
     * Get settlement payment history entry by note
     * Properly scoped to the payment history container
     */
    private getSettlementHistoryEntry(settlementNote: string | RegExp) {
        const paymentHistoryContainer = this.getPaymentHistoryContainer();
        const hasTextPattern = typeof settlementNote === 'string' ? new RegExp(settlementNote, 'i') : settlementNote;
        return paymentHistoryContainer.locator('[data-testid="settlement-item"]').filter({
            hasText: hasTextPattern,
        });
    }

    /**
     * Get edit button for a specific settlement by identifying the settlement container
     * Properly scoped to the payment history container
     */
    private getSettlementEditButton(settlementNote: string): Locator {
        const settlementItem = this.getSettlementHistoryEntry(settlementNote);
        return settlementItem.locator('[data-testid="edit-settlement-button"]');
    }

    /**
     * Get delete button for a specific settlement by identifying the settlement container
     * Properly scoped to the payment history container
     */
    private getSettlementDeleteButton(settlementNote: string): Locator {
        const settlementItem = this.getSettlementHistoryEntry(settlementNote);
        return settlementItem.locator('[data-testid="delete-settlement-button"]');
    }

    /**
     * Click edit button for a settlement and wait for edit form to open
     */
    async clickEditSettlement(settlementNote: string): Promise<SettlementFormPage> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        await this.openHistoryIfClosed();

        // Assert the edit button exists and is enabled
        const editButton = this.getSettlementEditButton(settlementNote);
        await expect(editButton).toBeVisible({ timeout: 2000 });
        await expect(editButton).toBeEnabled();

        await this.clickButton(editButton, { buttonName: 'Edit Settlement' });

        // Wait for settlement form modal to open in edit mode
        const modal = this.page.getByRole('dialog');
        await expect(modal).toBeVisible({ timeout: 3000 });

        // Verify we're in edit mode by checking for "Update Payment" title
        await expect(modal.getByRole('heading', { name: 'Update Payment' })).toBeVisible();

        const expectedMemberCount = await this.getCurrentMemberCount();

        const settlementFormPage = new SettlementFormPage(this.page);
        await expect(settlementFormPage.getModal()).toBeVisible();
        await settlementFormPage.waitForFormReady(expectedMemberCount);

        return settlementFormPage;
    }

    /**
     * Verify a settlement is no longer visible in history
     */
    async verifySettlementNotInHistory(settlementNote: string): Promise<void> {
        await this.openHistoryIfClosed();

        // Use polling to wait for real-time settlement deletion updates
        await expect(async () => {
            const settlementEntry = this.getSettlementHistoryEntry(settlementNote);
            const count = await settlementEntry.count();

            if (count > 0) {
                const isVisible = await settlementEntry.first().isVisible();
                if (isVisible) {
                    throw new Error(`Settlement "${settlementNote}" is still visible in history`);
                }
            }

            // Settlement successfully removed
        })
            .toPass({
                timeout: 5000,
                intervals: [100, 200, 300, 500, 1000],
            });
    }

    /**
     * Verify settlement details in history
     * Properly scoped to the payment history container
     */
    async verifySettlementDetails(details: { note: string; amount?: string; payerName?: string; payeeName?: string; }): Promise<void> {
        // Assert we're in the right state
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        await this.openHistoryIfClosed();

        // Use polling to wait for real-time settlement updates
        await expect(async () => {
            // Find the settlement within the payment history container
            const settlementItem = this.getSettlementHistoryEntry(details.note);

            const count = await settlementItem.count();
            if (count === 0) {
                throw new Error(`Settlement with note "${details.note}" not found in payment history yet`);
            }

            // Verify settlement is visible
            const isVisible = await settlementItem.first().isVisible();
            if (!isVisible) {
                throw new Error(`Settlement with note "${details.note}" found but not visible yet`);
            }

            // Verify all expected details are present
            if (details.amount) {
                const amountVisible = await settlementItem.first().locator(`text=${details.amount}`).isVisible();
                if (!amountVisible) {
                    throw new Error(`Settlement amount "${details.amount}" not visible yet`);
                }
            }

            if (details.payerName) {
                const payerVisible = await settlementItem.first().locator(`text=${details.payerName}`).isVisible();
                if (!payerVisible) {
                    throw new Error(`Payer name "${details.payerName}" not visible yet`);
                }
            }

            if (details.payeeName) {
                const payeeVisible = await settlementItem.first().locator(`text=${details.payeeName}`).isVisible();
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
     * Open history if it's closed (idempotent)
     */
    async openHistoryIfClosed(): Promise<void> {
        // Assert we're on the group detail page
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        const showHistoryButton = this.page.getByRole('button', { name: 'Show History' });
        const hideHistoryButton = this.page.getByRole('button', { name: 'Hide History' });

        // Check if history is already open
        const isHistoryOpen = await hideHistoryButton.isVisible();

        if (!isHistoryOpen) {
            // History is closed, open it
            await expect(showHistoryButton).toBeVisible();
            await showHistoryButton.click();

            // Wait for history section to be visible
            await expect(hideHistoryButton).toBeVisible();
            // More specific: wait for settlement list container
            await expect(this.page.locator('.space-y-2').first()).toBeVisible();
        }
    }

    /**
     * Verify settlement has edit button
     */
    async verifySettlementHasEditButton(note: string): Promise<void> {
        const editButton = this.getSettlementEditButton(note);
        await expect(editButton).toBeVisible();
    }

    /**
     * Verify settlement has delete button
     */
    async verifySettlementHasDeleteButton(note: string): Promise<void> {
        const deleteButton = this.getSettlementDeleteButton(note);
        await expect(deleteButton).toBeVisible();
    }

    /**
     * Delete a settlement
     */
    async deleteSettlement(note: string, confirm: boolean): Promise<void> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        await this.openHistoryIfClosed();

        // Assert the delete button exists and is enabled
        const deleteButton = this.getSettlementDeleteButton(note);
        await expect(deleteButton).toBeVisible({ timeout: 2000 });
        await expect(deleteButton).toBeEnabled();

        await this.clickButton(deleteButton, { buttonName: 'Delete Settlement' });

        // Wait for confirmation dialog - it uses data-testid, not role="dialog"
        const confirmDialog = this.page.locator('[data-testid="confirmation-dialog"]');
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });

        // Verify it's the correct dialog
        await expect(confirmDialog.locator('h3')).toHaveText('Delete Payment');

        if (confirm) {
            const deleteButton = confirmDialog.locator('[data-testid="confirm-button"]');
            await this.clickButton(deleteButton, { buttonName: 'Delete' });

            // Wait for dialog to close
            await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });
        } else {
            const cancelButton = confirmDialog.locator('[data-testid="cancel-button"]');
            await this.clickButton(cancelButton, { buttonName: 'Cancel' });

            // Wait for dialog to close
            await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });
        }
    }

    async verifyDebtRelationship(debtorName: string, creditorName: string, expectedAmount: string): Promise<void> {
        // Use polling pattern to wait for real-time updates
        await expect(async () => {
            const balancesSection = this.getBalanceContainer();

            // Find all debt relationship spans with the expected text pattern
            const debtRelationshipSpans = balancesSection.locator('span').filter({
                hasText: new RegExp(`${debtorName}\\s*→\\s*${creditorName}`),
            });

            const count = await debtRelationshipSpans.count();
            if (count === 0) {
                throw new Error(`Debt relationship not found: ${debtorName} → ${creditorName}\n` + `Check if both users are in the group and have expenses.`);
            }

            // Check each relationship to find one with the matching amount
            let foundMatchingAmount = false;
            let actualAmounts: string[] = [];
            let debugInfo: Array<{ amount: string; trimmed: string; length: number; charCodes: number[]; }> = [];

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
                    debugInfo.push({
                        amount: actualAmount,
                        trimmed: normalizedActual,
                        length: normalizedActual.length,
                        charCodes: Array.from(normalizedActual).map((c) => c.charCodeAt(0)),
                    });

                    if (normalizedActual === trimmedExpected) {
                        foundMatchingAmount = true;
                        break;
                    }
                }
            }

            if (!foundMatchingAmount) {
                const expectedTrimmed = expectedAmount.trim();
                const expectedDebugInfo = {
                    amount: expectedAmount,
                    trimmed: expectedTrimmed,
                    length: expectedTrimmed.length,
                    charCodes: Array.from(expectedTrimmed).map((c) => c.charCodeAt(0)),
                };

                throw new Error(
                    `Debt amount mismatch for ${debtorName} → ${creditorName}\n`
                        + `Expected: "${expectedAmount}" (trimmed: "${expectedTrimmed}", length: ${expectedDebugInfo.length}, chars: [${expectedDebugInfo.charCodes.join(',')}])\n`
                        + `Found amounts: ${
                            actualAmounts
                                .map((amt, idx) => `"${amt}" (trimmed: "${debugInfo[idx].trimmed}", length: ${debugInfo[idx].length}, chars: [${debugInfo[idx].charCodes.join(',')}])`)
                                .join(', ')
                        }`,
                );
            }

            // If we get here, everything matches!
        })
            .toPass({
                timeout: 5000,
                intervals: [100, 200, 300, 500, 1000],
            });
    }
    /**
     * Verify that a specific debt relationship no longer exists
     * (e.g., after a member settles their balance)
     */
    async verifyNoDebtRelationship(debtorName: string, creditorName: string): Promise<void> {
        // Use polling pattern to wait for real-time balance updates
        await expect(async () => {
            const debtInfo = this.getDebtInfo(debtorName, creditorName);
            const count = await debtInfo.count();
            if (count > 0) {
                throw new Error(`Debt relationship still exists: ${debtorName} → ${creditorName}`);
            }
        }).toPass({ timeout: 5000 });
    }

    /**
     * Verify that all members in the group are settled up (no outstanding balances)
     * @param groupId - The group ID for context (used for better error messages)
     */
    async verifyAllSettledUp(groupId: string): Promise<void> {
        // Assert we're on the correct group page
        const currentUrl = this.page.url();
        if (!currentUrl.includes(`/groups/${groupId}`)) {
            throw new Error(`verifyAllSettledUp called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`);
        }

        // Wait for the "All settled up!" message to appear
        await expect(async () => {
            const balanceSection = this.getBalanceContainer();
            const count = await balanceSection.getByText('All settled up!').count();
            if (count === 0) {
                throw new Error('No "All settled up!" in balances section found yet');
            }
        })
            .toPass({
                timeout: 3000,
                intervals: [100, 200, 300, 400, 500, 1000],
            });

        // Double-check that there are no debt relationships visible
        const balancesSection = this.getBalanceContainer();
        const debtElements = balancesSection.locator('[data-financial-amount="debt"]');
        await expect(debtElements).toHaveCount(0);
    }

    /**
     * Ensures group page is fully loaded before proceeding with expense operations.
     * This should be called after creating a group or navigating to a group page.
     */
    async ensureNewGroupPageReadyWithOneMember(groupId: string): Promise<void> {
        await this.waitForDomContentLoaded();
        await this.waitForMemberCount(1); // Wait for at least the creator to show
        await this.waitForBalancesSection(groupId);
    }

    // ========== Member Management Methods ==========

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
    async clickLeaveGroupButton(): Promise<LeaveGroupModalPage> {
        const leaveButton = this.getLeaveGroupButton();
        await this.clickButton(leaveButton, { buttonName: 'Leave Group' });

        // Create and return the LeaveGroupModalPage instance
        const leaveModal = new LeaveGroupModalPage(this.page);
        await leaveModal.waitForDialogVisible();

        return leaveModal;
    }

    async waitForRedirectAwayFromGroup(groupId: string): Promise<void> {
        // Use proper web-first assertion to wait for URL change
        await expect(this.page).not.toHaveURL(new RegExp(`/groups/${groupId}`), { timeout: 5000 });
    }

    async clickRemoveMember(memberName: string): Promise<RemoveMemberModalPage> {
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
        const removeModal = new RemoveMemberModalPage(this.page);
        await removeModal.waitForDialogVisible();
        return removeModal;
    }

    async verifyMemberNotVisible(memberName: string): Promise<void> {
        await expect(this.getMemberItem(memberName)).not.toBeVisible();
    }

    // ========== Comments Methods ==========

    /**
     * Get the comments section for the group
     */
    getCommentsSection() {
        return this.page.getByTestId('comments-section');
    }

    /**
     * Get the comment input textarea
     */
    getCommentInput() {
        return this.getCommentsSection().getByRole('textbox', { name: /comment text/i });
    }

    /**
     * Get the send comment button
     */
    getSendCommentButton() {
        return this.getCommentsSection().getByRole('button', { name: /send comment/i });
    }

    /**
     * Get all comment items in the comments list
     */
    getCommentItems() {
        return this.getCommentsSection().locator('[data-testid="comment-item"]');
    }

    /**
     * Get a specific comment by its text content
     */
    getCommentByText(text: string) {
        return this.getCommentsSection().getByText(text);
    }

    /**
     * Add a comment to the group
     */
    async addComment(text: string): Promise<void> {
        const input = this.getCommentInput();
        const sendButton = this.getSendCommentButton();

        // Verify comments section is visible
        await expect(this.getCommentsSection()).toBeVisible();

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
        // Check that comments section exists
        await expect(this.getCommentsSection()).toBeVisible();

        // Check that input exists and has correct placeholder
        const input = this.getCommentInput();
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute('placeholder', /add a comment to this group/i);

        // Check that send button exists
        const sendButton = this.getSendCommentButton();
        await expect(sendButton).toBeVisible();

        // Send button should initially be disabled (no text input yet)
        await expect(sendButton).toBeDisabled();
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

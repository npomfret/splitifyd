import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { ExpenseFormPage } from './expense-form.page';
import { ExpenseDetailPage } from './expense-detail.page';
import { SettlementFormPage } from './settlement-form.page';
import { ARIA_ROLES, BUTTON_TEXTS, HEADINGS, MESSAGES } from '../constants/selectors';
import { PooledTestUser } from '@splitifyd/shared';
import {DashboardPage} from "./dashboard.page.ts";

interface ExpenseData {
    description: string;
    amount: number;
    currency: string; // Required: must be explicitly provided
    paidByDisplayName: string;
    splitType: 'equal' | 'exact' | 'percentage';
    participants?: string[]; // Optional: if not provided, selects all members
}

export class GroupDetailPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }

    // Element accessors for group information
    getGroupTitle() {
        // The group title is specifically an h1 element
        return this.page.locator('h1').first();
    }

    getGroupDescription() {
        // Target the paragraph element containing the group description
        // This is rendered in GroupHeader.tsx as: <p className="text-gray-600">{group.description}</p>
        return this.page.locator('p.text-gray-600').first();
    }

    getMembersCount() {
        return this.page.getByText(/\d+ member/i);
    }

    getBalancesHeading() {
        return this.page.getByRole('heading', { name: /balances/i });
    }

    // Element accessors for expenses
    getAddExpenseButton() {
        // Primary selector: use data-testid
        // Fallback: use role and name for robustness
        return this.page.locator('[data-testid="add-expense-button"]').or(
            this.page.getByRole('button', { name: /add expense/i })
        ).first();
    }

    async clickSettleUpButton(expectedMemberCount: number): Promise<SettlementFormPage> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        // Assert button is visible and enabled before clicking
        const settleButton = this.getSettleUpButton();
        await expect(settleButton).toBeVisible();
        await expect(settleButton).toBeEnabled();

        await this.clickButton(settleButton, { buttonName: 'Settle with payment' });

        // Verify modal opened
        const settlementFormPage = new SettlementFormPage(this.page);
        await expect(settlementFormPage.getModal()).toBeVisible();
        await settlementFormPage.waitForFormReady(expectedMemberCount);
        return settlementFormPage;
    }

    getSettleUpButton(): Locator {
        return this.page.getByRole('button', { name: /settle up/i });
    }

    /**
     * Waits for the Add Expense button to be visible and enabled.
     * This ensures the page is fully loaded before attempting to interact with the button.
     */
    async waitForAddExpenseButton(timeout = 5000): Promise<void> {
        const addButton = this.getAddExpenseButton();

        // Wait for button to be visible
        await expect(addButton).toBeVisible({ timeout });

        // Wait for button to be enabled
        await expect(addButton).toBeEnabled({ timeout });
    }

    async clickAddExpenseButton(expectedMemberCount: number, userInfo?: { displayName?: string; email?: string }): Promise<ExpenseFormPage> {
        // Wait for button to be ready first
        await this.waitForAddExpenseButton();

        // Now attempt navigation - will throw if it fails
        return await this.attemptAddExpenseNavigation(expectedMemberCount, userInfo);
    }

    async waitForGroupTitle(text: string) {
        await this.waitForDomContentLoaded();

        // Use polling pattern to handle async updates (since no real-time websockets yet)
        await expect(async () => {
            const title = await this.getGroupTitle().textContent();
            if (title !== text) {
                throw new Error(`Title is still "${title}", waiting for "${text}"`);
            }
        }).toPass({
            timeout: 5000,
            intervals: [500, 1000, 1500, 2000], // Retry at these intervals
        });
    }

    async waitForGroupDescription(text: string) {
        await this.waitForDomContentLoaded();

        // Use polling pattern to handle async updates (since no real-time websockets yet)
        await expect(async () => {
            const description = await this.getGroupDescription().textContent();
            if (description !== text) {
                throw new Error(`Description is still "${description}", waiting for "${text}"`);
            }
        }).toPass({
            timeout: 5000,
            intervals: [500, 1000, 1500, 2000], // Retry at these intervals
        });
    }

    /**
     * Navigates to add expense form with comprehensive state detection.
     */
    private async attemptAddExpenseNavigation(expectedMemberCount: number, userInfo?: { displayName?: string; email?: string }): Promise<ExpenseFormPage> {
        const expectedUrlPattern = /\/groups\/[a-zA-Z0-9]+\/add-expense/;
        const addButton = this.getAddExpenseButton();

        // Button readiness is already checked in clickAddExpenseButton
        // Trust that the button is ready when this method is called
        await this.clickButton(addButton, { buttonName: 'Add Expense' });

        // Wait for navigation to expense form
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
        await expenseFormPage.waitForFormReady(expectedMemberCount, userInfo);
        return expenseFormPage;
    }

    getNoExpensesMessage() {
        return this.page.getByText(/no expenses yet/i);
    }

    // Share functionality accessors
    getShareButton() {
        return this.page.getByRole('button', { name: /invite others/i }).first();
    }

    getShareDialog() {
        return this.page.getByRole('dialog');
    }

    getShareLinkInput() {
        return this.getShareDialog().locator('input[type="text"]');
    }

    getCloseButton() {
        return this.page.getByRole('button', { name: /close|×/i }).first();
    }

    // User-related accessors
    getUserName(displayName: string) {
        return this.page.getByText(displayName).first();
    }

    // CONTEXT-SPECIFIC SELECTORS TO FIX STRICT MODE VIOLATIONS

    /**
     * Waits for "All settled up!" message to appear in the balance section
     * The Balances section is always visible (no collapse/expand functionality)
     * This method waits for the text to appear as balances are calculated
     */
    async waitForSettledUpMessage(timeout: number = 5000): Promise<void> {
        // Wait for at least one "All settled up!" text to appear in the DOM
        // Using polling to handle dynamic rendering
        await expect(async () => {
            const count = await this.page.getByText('All settled up!').count();
            if (count === 0) {
                throw new Error('No "All settled up!" text found yet');
            }
        }).toPass({
            timeout,
            intervals: [100, 200, 300, 400, 500, 1000],
        });
    }

    /**
     * Checks if debt amount exists in the DOM (regardless of visibility)
     * Use this when checking for amounts that might be in hidden sections
     */
    async hasDebtAmount(amount: string): Promise<boolean> {
        // Look for the amount in red text (debt indicator) or as general text
        const redTextCount = await this.page.locator('.text-red-600').filter({ hasText: amount }).count();
        if (redTextCount > 0) return true;

        // Also check if the amount exists as regular text (in case styling changed)
        const textCount = await this.page.getByText(amount).count();
        return textCount > 0;
    }

    /**
     * Waits for the group to have the expected number of members.
     * Relies on real-time updates to show the correct member count.
     */
    async waitForMemberCount(expectedCount: number, timeout = 2000): Promise<void> {
        // Assert we're on a group page before waiting for member count
        const currentUrl = this.page.url();
        if (!currentUrl.includes('/groups/') && !currentUrl.includes('/group/')) {
            throw new Error(`waitForMemberCount called but not on a group page. Current URL: ${currentUrl}`);
        }

        // Wait for page to load
        await this.waitForDomContentLoaded();

        const expectedText = `${expectedCount} member${expectedCount !== 1 ? 's' : ''}`;

        // Wait for member count to appear in the main group heading
        // The member count is displayed in the group header section, not in the Members list
        await expect(this.page.getByText(expectedText).first()).toBeVisible({ timeout });

        // Double-check we're still on the group page after waiting
        const finalUrl = this.page.url();
        if (!finalUrl.includes('/groups/') && !finalUrl.includes('/group/')) {
            throw new Error(`Navigation changed during waitForMemberCount. Now on: ${finalUrl}`);
        }
    }

    /**
     * Waits for all specified users to be properly synchronized in the group
     */
    async waitForUserSynchronization(user1Name: string, ...otherUserNames: string[]): Promise<void> {
        const allUserNames = [user1Name, ...otherUserNames];
        const totalUsers = allUserNames.length;

        // Wait for network to be idle first to allow any join operations to complete
        await this.waitForDomContentLoaded();

        // Primary approach: verify all users are visible in the group (more reliable than member count)
        for (const userName of allUserNames) {
            try {
                await expect(this.page.getByText(userName).first()).toBeVisible({ timeout: 5000 });
            } catch (e) {
                // Capture detailed state for debugging - handle page closure gracefully
                let visibleMembers: Array<{name: string, id: string, text: string}> = [];
                let memberCount: string | null = 'unknown';
                let pageUrl = 'unknown';
                
                try {
                    const memberElements = await this.page.locator('[data-testid="member-item"]').all();
                    visibleMembers = await Promise.all(
                        memberElements.map(async (el) => {
                            const name = await el.getAttribute('data-member-name');
                            const id = await el.getAttribute('data-member-id');
                            const innerText = await el.innerText();
                            return {
                                name: name || 'Unknown',
                                id: id || 'no-id',
                                text: innerText.replace(/\n/g, ' '),
                            };
                        }),
                    );

                    memberCount = await this.page
                        .locator('[data-testid="member-count"]')
                        .textContent()
                        .catch(() => 'count-not-found');
                    pageUrl = this.page.url();
                } catch (debugError: any) {
                    // Page was closed or became inaccessible
                    console.warn('Could not capture debug info - page may be closed:', debugError.message);
                    visibleMembers = [{name: 'debug-capture-failed', id: 'unknown', text: 'Page inaccessible'}];
                }

                // Get browser context info
                const browserUser = this.userInfo?.email || 'Unknown User';
                const browserUserId = this.userInfo?.uid || 'unknown-id';

                const context = {
                    browserContext: {
                        user: browserUser,
                        userId: browserUserId,
                        displayName: await this.getCurrentUserDisplayName(),
                        pageUrl,
                        viewingAs: `Browser of: ${browserUser} (${browserUserId})`,
                    },
                    synchronizationState: {
                        missingUser: userName,
                        expectedUsers: allUserNames,
                        visibleMembers: visibleMembers.map((m) => m.name),
                        duplicates: visibleMembers.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) !== i).map((m) => m.name),
                    },
                    memberDetails: visibleMembers.map((m, i) => ({
                        index: i,
                        name: m.name,
                        id: m.id,
                        displayText: m.text,
                    })),
                    memberCount,
                    timestamp: new Date().toISOString(),
                };

                throw new Error(`User synchronization failed: User "${userName}" not visible after 5 seconds. ${JSON.stringify(context, null, 2)}`);
            }
        }

        // Secondary verification: wait for correct member count
        try {
            await this.waitForMemberCount(totalUsers, 3000);
        } catch (e) {
            const actualCount = await this.page.getByText(/\d+ member/i).textContent();
            throw new Error(`Member count synchronization failed. Expected: ${totalUsers} members, Found: ${actualCount}`);
        }

        // Final network idle wait to ensure all updates have propagated
        await this.waitForDomContentLoaded();
    }

    /**
     * Wait for the Balances section to be visible and loaded
     */
    async waitForBalancesToLoad(groupId: string): Promise<void> {
        // Assert we're on the correct group page before trying to find balances
        const currentUrl = this.page.url();
        if (!currentUrl.includes(`/groups/${groupId}`)) {
            throw new Error(`waitForBalancesToLoad called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`);
        }

        // More specific locator to avoid strict mode violation
        const balancesSection = this.page
            .locator('.bg-white')
            .filter({
                has: this.page.getByRole('heading', { name: 'Balances' }),
            })
            .first();

        // Wait for balances section to be visible
        try {
            await expect(balancesSection).toBeVisible({ timeout: 5000 });
        } catch (e) {
            const pageContent = await this.page.textContent('body');
            throw new Error(`Balances section failed to load within 8 seconds on group ${groupId}. Page content: ${pageContent?.substring(0, 500)}...`);
        }

        // Wait for loading to disappear
        try {
            await expect(balancesSection.getByText('Loading balances...')).not.toBeVisible({ timeout: 5000 });
        } catch (e) {
            // Loading text might not be present, that's okay
        }

        // Wait for the members section to stop loading
        // Check if there's a loading spinner in the Members section
        const membersSection = this.page.locator('text=Members').locator('..');
        const loadingSpinner = membersSection.locator('.animate-spin, [role="status"]');

        // Wait for spinner to disappear if it exists
        const spinnerCount = await loadingSpinner.count();
        if (spinnerCount > 0) {
            try {
                await expect(loadingSpinner.first()).not.toBeVisible({ timeout: 5000 });
            } catch (e) {
                throw new Error(`Members section loading spinner did not disappear within 5 seconds on group ${groupId}`);
            }
        }
    }

    async waitForBalanceUpdate(): Promise<void> {
        // Wait for the balance section to be stable
        const balanceSection = this.page.getByRole('heading', { name: 'Balances' }).locator('..');
        await expect(balanceSection).toBeVisible();

        // Wait for network requests to complete
        await this.waitForDomContentLoaded();
    }

    /**
     * Synchronize group state across multiple users by refreshing pages and waiting for updates.
     * This replaces manual reload() calls scattered throughout multi-user tests.
     * Auto-navigates users to the group page if they're not already there.
     */
    async synchronizeMultiUserState(pages: Array<{ page: Page; groupDetailPage: any;}>, expectedMemberCount: number, groupId: string): Promise<void> {
        const targetGroupUrl = `/groups/${groupId}`;

        // Navigate all users to the specific group
        for (let i = 0; i < pages.length; i++) {
            const { page, } = pages[i];

            await this.navigatePageToUrl(page, targetGroupUrl);

            // Check current URL after navigation
            const currentUrl = page.url();

            // Check if we got redirected to 404
            if (currentUrl.includes('/404')) {
                const currentUserDisplayName = await new DashboardPage(page).getCurrentUserDisplayName();
                throw new Error(`${currentUserDisplayName} was redirected to 404 page. Group access denied or group doesn't exist.`);
            }

            // If not on 404, check if we're on the dashboard (another redirect case)
            if (currentUrl.includes('/dashboard')) {
                const currentUserDisplayName = await new DashboardPage(page).getCurrentUserDisplayName();
                throw new Error(`${currentUserDisplayName} was redirected to dashboard. Expected ${targetGroupUrl}, but got: ${currentUrl}`);
            }

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl);
        }

        // Wait for all pages to show correct member count
        for (let i = 0; i < pages.length; i++) {
            const { page, groupDetailPage } = pages[i];

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl);

            try {
                await groupDetailPage.waitForMemberCount(expectedMemberCount);
            } catch (error) {
                const currentUserDisplayName = await new DashboardPage(page).getCurrentUserDisplayName();
                throw new Error(`${currentUserDisplayName} failed waiting for member count: ${error}`);
            }

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl);
        }

        // Wait for balances section to load on all pages
        for (let i = 0; i < pages.length; i++) {
            const { page, groupDetailPage } = pages[i];

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl);

            await groupDetailPage.waitForBalancesToLoad(groupId);

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl);
        }
    }

    private async sanityCheckPageUrl(currentUrl: string, targetGroupUrl: string) {
        // Assert we're actually on the group page
        if (!currentUrl.includes(targetGroupUrl)) {
            // Take screenshot before throwing error
            throw new Error(`Navigation failed. Expected URL to contain ${targetGroupUrl}, but got: ${currentUrl}`);
        }
    }

    /**
     * Verify that settlement appears in history for all provided pages
     */
    async verifySettlementInHistory(pages: Array<{ page: any }>, settlementNote: string): Promise<void> {
        for (const { page } of pages) {
            const showHistoryButton = page.getByRole('button', { name: 'Show History' });
            await this.clickButton(showHistoryButton, { buttonName: 'Show History' });
            await expect(page.getByText(new RegExp(settlementNote, 'i'))).toBeVisible();
            // Close modal by clicking close button or clicking outside
            const closeButton = page.getByRole('button', { name: /close|×/i }).first();
            if (await closeButton.isVisible()) {
                await closeButton.click();
            } else {
                // Click outside modal to close
                await page.click('body', { position: { x: 10, y: 10 } });
            }
        }
    }

    /**
     * Verify debt amount in balance section across multiple pages
     */
    async verifyDebtAcrossPages(pages: Array<{ page: any; groupDetailPage: any }>, debtorName: string, creditorName: string, amount?: string): Promise<void> {
        for (const { page } of pages) {
            const balancesSection = page
                .locator('.bg-white')
                .filter({
                    has: page.getByRole('heading', { name: 'Balances' }),
                })
                .first();

            // UI now uses arrow notation: "User A → User B" instead of "owes"
            const debtText = balancesSection.getByText(`${debtorName} → ${creditorName}`).or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
            await expect(debtText).toBeVisible();

            if (amount) {
                // Find the debt amount that's specifically associated with this debt relationship
                // Look for the amount within the same container as the debt message
                const debtRow = balancesSection.locator('div').filter({
                    hasText: new RegExp(`${debtorName}.*→.*${creditorName}|${debtorName}.*owes.*${creditorName}`),
                });
                await expect(debtRow.locator('.text-red-600').filter({ hasText: amount }).first()).toBeVisible();
            }
        }
    }

    /**
     * Verify expense appears on all provided pages
     */
    async verifyExpenseAcrossPages(pages: Array<{ page: any }>, expenseDescription: string, expenseAmount?: string): Promise<void> {
        for (const { page } of pages) {
            await expect(page.getByText(expenseDescription)).toBeVisible();
            if (expenseAmount) {
                await expect(page.getByText(expenseAmount)).toBeVisible();
            }
        }
    }

    /**
     * Create expense and synchronize across multiple users using proper page object composition
     */
    async addExpenseAndSync(expense: ExpenseData, pages: Array<{ page: any; groupDetailPage: any; userName?: string }>, expectedMemberCount: number, groupId: string): Promise<void> {
        // Use proper page object composition
        const expenseFormPage = await this.clickAddExpenseButton(expectedMemberCount);
        await expenseFormPage.submitExpense(expense);
        await this.synchronizeMultiUserState(pages, expectedMemberCount, groupId);
    }

    /**
     * Record settlement and synchronize across multiple users
     */
    /**
     * Record settlement and synchronize across multiple users using proper page object composition
     */
    async recordSettlementAndSync(
        settlementOptions: {
            payerName: string;
            payeeName: string;
            amount: string;
            note: string;
        },
        pages: Array<{ page: any; groupDetailPage: any; userName?: string }>,
        expectedMemberCount: number,
        groupId: string,
    ): Promise<void> {
        const settlementFormPage = await this.clickSettleUpButton(expectedMemberCount);
        await settlementFormPage.submitSettlement(settlementOptions, expectedMemberCount);
        await this.synchronizeMultiUserState(pages, expectedMemberCount, groupId);
    }

    /**
     * New getter methods using centralized constants
     */

    // Headings
    getExpensesHeading() {
        return this.page.getByRole(ARIA_ROLES.HEADING, { name: HEADINGS.EXPENSES });
    }

    getShowHistoryButton() {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: BUTTON_TEXTS.SHOW_HISTORY });
    }

    getNoExpensesText() {
        return this.page.getByText(MESSAGES.NO_EXPENSES_YET);
    }

    getLoadingBalancesText() {
        return this.page.getByText(MESSAGES.LOADING_BALANCES);
    }

    // Utility method for member count
    getMemberCountText(count: number) {
        const memberText = count === 1 ? 'member' : 'members';
        return this.page.getByText(`${count} ${memberText}`);
    }

    // Utility method for currency amounts
    getCurrencyAmount(amount: string) {
        return this.page.getByText(`$${amount}`);
    }

    /**
     * Shares the group and waits for another user to join.
     * This encapsulates the entire share/join flow to avoid code duplication.
     * Optimized for fast timeouts and reliable share link extraction.
     *
     * @param joinerPage - The Page object for the user who will join the group
     * @returns The share link URL
     */
    async shareGroupAndWaitForJoin(joinerPage: any): Promise<string> {
        // Get the share link from the modal
        const shareLink = await this.getShareLink();

        // Have the second user navigate to share link and join with fast timeout
        await this.navigatePageToShareLink(joinerPage, shareLink);

        // Click join button with fast timeout
        const joinButton = joinerPage.getByRole('button', { name: /join group/i });
        await joinButton.waitFor({ state: 'visible', timeout: 1000 });
        await this.clickButton(joinButton, { buttonName: 'Join Group' });

        // Wait for navigation with reasonable timeout
        await expect(joinerPage).toHaveURL(groupDetailUrlPattern());

        // Wait for real-time updates to propagate the new member (expecting 2 members now)
        await this.waitForMemberCount(2);

        return shareLink;
    }

    /**
     * Helper method to navigate an external page object to a share link
     * Encapsulates direct page.goto() usage for multi-user scenarios
     */
    private async navigatePageToShareLink(page: any, shareLink: string): Promise<void> {
        await page.goto(shareLink);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    }

    /**
     * Helper method to navigate an external page object to any URL
     * Encapsulates direct page.goto() usage for multi-user scenarios
     */
    private async navigatePageToUrl(page: any, url: string): Promise<void> {
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    }

    // ==============================
    // ADDITIONAL METHODS TO FIX SELECTOR VIOLATIONS
    // ==============================

    /**
     * Gets the balances section using the complex locator
     * This replaces repeated complex locator chains in tests
     */
    getBalancesSection() {
        return this.page
            .locator('.bg-white')
            .filter({
                has: this.page.getByRole('heading', { name: 'Balances' }),
            })
            .first();
    }

    /**
     * Gets any text element - centralizes getByText calls
     */
    getTextElement(text: string | RegExp) {
        return this.page.getByText(text);
    }

    /**
     * Gets the delete button for an expense
     */
    getExpenseDeleteButton() {
        return this.page.getByRole('button', { name: /delete/i });
    }

    /**
     * Gets the confirmation delete button (second delete button in dialog)
     */
    getDeleteConfirmButton() {
        return this.page.getByRole('button', { name: 'Delete' }).nth(1);
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
        // Use more specific selector to avoid strict mode violations
        // Look for the description in expense list context, not headings
        return this.page.getByText(description).first();
    }

    getExpenseAmount(amount: string) {
        // Target expense amount specifically in the expense list context
        // Look for amount that's not in a balance/debt context (excludes data-financial-amount elements)
        return this.page
            .getByText(amount)
            .and(this.page.locator(':not([data-financial-amount])'))
            .first();
    }

    async verifyExpenseInList(description: string, amount?: string) {
        await expect(this.getExpenseByDescription(description)).toBeVisible();
        if (amount) {
            await expect(this.page.getByText(amount)).toBeVisible();
        }
    }

    /**
     * Deletes an expense with confirmation
     */
    async deleteExpense() {
        const deleteButton = this.getExpenseDeleteButton();
        await this.clickButton(deleteButton, { buttonName: 'Delete Expense' });

        // Confirm deletion
        const confirmButton = this.getDeleteConfirmButton();
        await this.clickButton(confirmButton, { buttonName: 'Confirm Delete' });

        // Wait for deletion to complete
        await this.waitForDomContentLoaded();
    }
    /**
     * Gets the share link from the group page.
     * Assumes the app works perfectly - no retries or workarounds.
     */
    async getShareLink(): Promise<string> {
        // Click share button
        const shareButton = this.getShareButton();
        await expect(shareButton).toBeVisible();
        await expect(shareButton).toBeEnabled();
        await shareButton.click();

        // Wait for modal to appear
        const dialog = this.getShareDialog();
        await expect(dialog).toBeVisible();

        // Wait for loading spinner to disappear if present
        const loadingSpinner = dialog.locator('.animate-spin');
        if ((await loadingSpinner.count()) > 0) {
            await expect(loadingSpinner).not.toBeVisible({ timeout: 5000 });// for some reason this can be slow
        }

        // Get the share link
        const shareLinkInput = this.getShareLinkInput();
        await expect(shareLinkInput).toBeVisible({ timeout: 5000 });
        const shareLink = await shareLinkInput.inputValue();

        if (!shareLink || !shareLink.includes('/join?')) {
            throw new Error(`Invalid share link received: ${shareLink}`);
        }

        // Close modal by clicking close button or clicking outside
        const closeButton = this.getCloseButton();
        if (await closeButton.isVisible()) {
            await closeButton.click();
        } else {
            // Click outside modal to close
            await this.page.click('body', { position: { x: 10, y: 10 } });
        }

        return shareLink;
    }

    /**
     * Navigates to a share link and handles the join process reliably.
     * This method integrates with the new JoinGroupPage for better error handling.
     */
    async navigateToShareLink(shareLink: string): Promise<void> {
        await this.page.goto(shareLink);
        await this.waitForDomContentLoaded();
    }

    /**
     * Gets the show history button
     */
    getHistoryButton() {
        return this.page.getByRole('button', { name: 'Show History' });
    }

    /**
     * Opens the history modal
     */
    async openHistory() {
        const historyButton = this.getHistoryButton();
        await this.clickButton(historyButton, { buttonName: 'Show History' });
    }

    /**
     * Gets debt information from balances section
     */
    getDebtInfo(debtorName: string, creditorName: string) {
        const balancesSection = this.getBalancesSection();
        // UI now uses arrow notation: "User A → User B" instead of "owes"
        return balancesSection.getByText(`${debtorName} → ${creditorName}`).or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
    }

    /**
     * Gets the admin badge element specifically.
     * This targets the small badge text, not the group heading or description.
     */
    getAdminBadge() {
        // Target the admin badge which is typically a small text element with specific styling
        // Use exact match and look for the element with the smallest font size (text-xs class)
        return this.page.locator('.text-xs').filter({ hasText: 'Admin' }).first();
    }

    /**
     * Gets the settings button (only visible for group owner)
     */
    getSettingsButton() {
        return this.page.getByRole('button', { name: /group settings/i }).first();
    }

    /**
     * Opens the edit group modal by clicking the settings button
     */
    async openEditGroupModal() {
        const settingsButton = this.getSettingsButton();
        await this.clickButton(settingsButton, { buttonName: 'Group Settings' });

        // Wait for modal to appear
        await expect(this.page.getByRole('dialog')).toBeVisible();

        // Return a simple modal object with the methods the tests expect
        const modal = this.page.getByRole('dialog');
        const saveButton = modal.getByRole('button', { name: 'Save Changes' });

        return {
            modal,
            saveButton,
            editGroupName: async (name: string) => {
                const nameInput = modal.locator('input[type="text"]').first();
                // Use Preact-aware input filling
                await this.fillPreactInput(nameInput, name);

                // Defensive check: verify the value persisted (catches real-time update bug)
                // Use polling to ensure value has stabilized
                await expect(async () => {
                    const currentValue = await nameInput.inputValue();
                    if (currentValue !== name) {
                        throw new Error('Form value still changing');
                    }
                }).toPass({ timeout: 500, intervals: [50, 100] });
                const currentValue = await nameInput.inputValue();
                if (currentValue !== name) {
                    throw new Error(`Form field was reset! Expected name "${name}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`);
                }
            },
            clearGroupName: async () => {
                const nameInput = modal.locator('input[type="text"]').first();
                // Clear using fillPreactInput with empty string
                await this.fillPreactInput(nameInput, '');
                // Trigger blur to ensure validation runs
                await nameInput.blur();
            },
            editDescription: async (description: string) => {
                const descriptionTextarea = modal.locator('textarea').first();
                // Use fillPreactInput for proper Preact signal updates
                await this.fillPreactInput(descriptionTextarea, description);

                // Defensive check: verify the value persisted
                await expect(async () => {
                    const currentValue = await descriptionTextarea.inputValue();
                    if (currentValue !== description) {
                        throw new Error('Form value still changing');
                    }
                }).toPass({ timeout: 500, intervals: [50, 100] });
                const currentValue = await descriptionTextarea.inputValue();
                if (currentValue !== description) {
                    throw new Error(`Form field was reset! Expected description "${description}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`);
                }
            },
            saveChanges: async () => {
                // Double-check form values right before save to ensure they haven't been reset
                const nameInput = modal.locator('input[type="text"]').first();
                const descTextarea = modal.locator('textarea').first();
                const finalName = await nameInput.inputValue();
                const finalDesc = await descTextarea.inputValue();

                // Validate the form state
                if (!finalName || finalName.trim().length < 2) {
                    throw new Error(`Invalid form state before save: name="${finalName}" (minimum 2 characters required). The form may have been reset by a real-time update.`);
                }

                // Wait for button to stabilize in enabled state
                await expect(saveButton).toBeEnabled({ timeout: 2000 });

                // Brief stability check - ensure button remains enabled (no race condition)
                await expect(async () => {
                    const isEnabled = await saveButton.isEnabled();
                    if (!isEnabled) {
                        throw new Error('Save button became disabled - race condition detected');
                    }
                }).toPass({ timeout: 200, intervals: [25, 50] });
                const isStillEnabled = await saveButton.isEnabled();
                if (!isStillEnabled) {
                    throw new Error(
                        `Save button became disabled after stability check. This indicates a race condition. Form values at time of failure: name="${finalName}", description="${finalDesc}"`,
                    );
                }

                await saveButton.click();
                // Wait for the modal to close after saving
                // Use a longer timeout as the save operation might take time
                await expect(modal).not.toBeVisible({ timeout: 2000 });
                await this.waitForDomContentLoaded();

                // Wait for the data refresh to complete (since no real-time websockets yet)
                // Look for any loading indicators that appear during refresh
                const spinner = this.page.locator('.animate-spin');
                const spinnerCount = await spinner.count();
                if (spinnerCount > 0) {
                    // Wait for any spinners to disappear
                    await expect(spinner.first()).not.toBeVisible({ timeout: 5000 });
                }

                // Wait for modal to close (indicates data has propagated)
                await expect(modal).not.toBeVisible({ timeout: 1000 });
            },
            cancel: async () => {
                const cancelButton = modal.getByRole('button', { name: 'Cancel' });
                await cancelButton.click();
            },
            deleteGroup: async () => {
                const deleteButton = modal.getByRole('button', { name: 'Delete Group' });
                await deleteButton.click();
            },
        };
    }

    /**
     * Handles the delete confirmation dialog with hard delete confirmation text input
     */
    async handleDeleteConfirmDialog(confirm: boolean, groupName?: string) {
        // Wait for confirmation dialog to appear
        // The confirmation dialog appears on top of the edit modal
        await this.waitForDomContentLoaded();

        // The ConfirmDialog component creates a fixed overlay with the Delete Group title
        // Look for the modal content within the overlay - it has "Delete Group" as title
        // and the confirm message
        const confirmTitle = this.page.getByRole('heading', { name: 'Delete Group' });
        await expect(confirmTitle).toBeVisible({ timeout: 5000 });

        // Find the dialog container which is the parent of the title
        const confirmDialog = confirmTitle.locator('..').locator('..');

        if (confirm) {
            // For hard delete, we need to enter the group name in the confirmation text field
            if (groupName) {
                // Find the confirmation text input field
                const confirmationInput = confirmDialog.locator('input[type="text"]');
                await expect(confirmationInput).toBeVisible();
                
                // Clear any existing text and enter the group name
                await this.fillPreactInput(confirmationInput, groupName);
                
                // Verify the text was entered correctly
                await expect(confirmationInput).toHaveValue(groupName);
            }

            // Find the Delete button in the confirmation dialog
            const deleteButton = confirmDialog.getByRole('button', { name: 'Delete' });
            await expect(deleteButton).toBeVisible();
            
            // Wait for the button to be enabled (it's disabled until confirmation text matches group name)
            await expect(deleteButton).toBeEnabled({ timeout: 5000 });
            
            // Click the delete button
            await deleteButton.click();
            
            // Wait for the modal to disappear (indicates deletion is processing/complete)
            await expect(confirmDialog).not.toBeVisible({ timeout: 10000 });
        } else {
            // Click the Cancel button
            const cancelButton = confirmDialog.getByRole('button', { name: 'Cancel' });
            await cancelButton.click();
            
            // Wait for dialog to close
            await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
        }
    }

    // ==============================
    // ADDITIONAL METHODS FOR TEST REFACTORING
    // ==============================

    /**
     * Get the main section of the page
     */
    getMainSection() {
        return this.page.getByRole('main');
    }
    /**
     * Get the amount input field (for expense or settlement forms)
     */

    /**
     * Get member count text element (e.g., "1 member" or "3 members")
     */
    getMemberCountElement() {
        return this.page.getByText(/\d+ member/i);
    }

    /**
     * Close modal or dialog
     */
    async closeModal(): Promise<void> {
        const closeButton = this.getCloseButton();
        if (await closeButton.isVisible()) {
            await closeButton.click();
        } else {
            // Click outside modal to close
            await this.page.click('body', { position: { x: 10, y: 10 } });
        }
    }

    /**
     * Verify expense is visible for the current user
     */
    async verifyExpenseVisible(description: string): Promise<void> {
        await expect(this.getExpenseByDescription(description)).toBeVisible();
    }

    /**
     * Get settlement payment history entry by note
     */
    getSettlementHistoryEntry(note: string) {
        return this.page.getByText(new RegExp(note, 'i'));
    }

    /**
     * Open settlement history if not already open
     */
    async openSettlementHistoryIfNeeded(): Promise<void> {
        const showHistoryButton = this.getShowHistoryButton();
        if (await showHistoryButton.isVisible()) {
            await this.clickButton(showHistoryButton, { buttonName: 'Show History' });
        }
    }

    /**
     * Get edit button for a specific settlement by identifying the settlement container
     */
    getSettlementEditButton(settlementNote: string): Locator {
        return this.page.locator('.p-4.bg-white.border.border-gray-200.rounded-lg').filter({ hasText: settlementNote }).getByRole('button', { name: 'Edit payment' });
    }

    /**
     * Get delete button for a specific settlement by identifying the settlement container
     */
    getSettlementDeleteButton(settlementNote: string): Locator {
        return this.page.locator('.p-4.bg-white.border.border-gray-200.rounded-lg').filter({ hasText: settlementNote }).getByRole('button', { name: 'Delete payment' });
    }

    /**
     * Click edit button for a settlement and wait for edit form to open
     */
    async clickEditSettlement(settlementNote: string): Promise<void> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        await this.openSettlementHistoryIfNeeded();

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
    }

    /**
     * Click delete button for a settlement and handle confirmation dialog
     */
    async clickDeleteSettlement(settlementNote: string, confirm: boolean = true): Promise<void> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        await this.openSettlementHistoryIfNeeded();

        // Assert the delete button exists and is enabled
        const deleteButton = this.getSettlementDeleteButton(settlementNote);
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

    /**
     * Verify a settlement is no longer visible in history
     */
    async verifySettlementNotInHistory(settlementNote: string): Promise<void> {
        await this.openSettlementHistoryIfNeeded();

        // Wait for real-time updates to complete by ensuring settlement is not visible
        const settlementEntry = this.getSettlementHistoryEntry(settlementNote);
        await expect(settlementEntry).not.toBeVisible({ timeout: 2000 });
    }

    /**
     * Verify settlement is in history
     */
    async verifySettlementInHistoryVisible(note: string): Promise<void> {
        await expect(this.getSettlementHistoryEntry(note)).toBeVisible();
    }

    /**
     * Open settlement history modal and verify content
     */
    async openHistoryAndVerifySettlement(settlementText: string | RegExp): Promise<void> {
        const showHistoryButton = this.getShowHistoryButton();
        await this.clickButton(showHistoryButton, { buttonName: 'Show History' });

        // Wait for settlement history modal content to be rendered and verify it's visible
        await expect(this.page.locator('div').filter({ hasText: settlementText }).first()).toBeVisible();
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
     * Verify settlement details in history
     */
    async verifySettlementDetails(details: { note: string; amount: string; payerName: string; payeeName: string }): Promise<void> {
        // Assert we're in the right state
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        // The Payment History is in a SidebarCard within the page, not in a modal with role="region"
        // Look for the settlement card directly within the page
        const settlementCard = this.page.locator('.p-4.bg-white.border.border-gray-200.rounded-lg').filter({ hasText: details.note });

        // Use first() to resolve ambiguity when multiple matches
        await expect(settlementCard.first()).toBeVisible();
        await expect(settlementCard.first().locator(`text=${details.amount}`)).toBeVisible();
        await expect(settlementCard.first().locator(`text=${details.payerName}`)).toBeVisible();
        await expect(settlementCard.first().locator(`text=${details.payeeName}`)).toBeVisible();
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
        await this.clickDeleteSettlement(note, confirm);
    }

    /**
     * Get balances section with specific context (for multi-page tests)
     */
    getBalancesSectionByContext() {
        return this.page
            .locator('.bg-white')
            .filter({
                has: this.page.getByRole('heading', { name: 'Balances' }),
            })
            .first();
    }

    /**
     * Verify debt relationship and amount in balances section
     */
    async verifyDebtRelationship(debtorName: string, creditorName: string, amount: string): Promise<void> {
        const balancesSection = this.getBalancesSectionByContext();

        // Get actual content for better error reporting
        const actualContent = await balancesSection.textContent().catch(() => 'Unable to get content');

        // Get current page URL and user identifier from the page object
        const currentUrl = this.page.url();

        // Look for debt relationship span that contains both user names
        // This handles the case where text is split across multiple text nodes
        const debtSpan = balancesSection.locator('span').filter({
            hasText: debtorName
        }).filter({
            hasText: creditorName
        });
        await expect(debtSpan).toBeVisible({ timeout: 2000 });

        await expect(balancesSection.locator('.text-red-600').filter({ hasText: amount })).toBeVisible({ timeout: 2000 });
    }

    /**
     * Get currency amount text locator
     */
    getCurrencyAmountText(amount: string) {
        return this.page.getByText(`$${amount}`);
    }

    /**
     * Verify currency amount is visible
     */
    async verifyCurrencyAmountVisible(amount: string): Promise<void> {
        await expect(this.getCurrencyAmountText(amount)).toBeVisible();
    }

    // ========================================================================
    // COMPREHENSIVE EXPENSE WORKFLOW HELPERS
    // ========================================================================

    /**
     * Ensures group page is fully loaded before proceeding with expense operations.
     * This should be called after creating a group or navigating to a group page.
     */
    async ensureNewGroupPageReadyWithOneMember(groupId: string): Promise<void> {
        await this.waitForDomContentLoaded();
        await this.waitForMemberCount(1); // Wait for at least the creator to show
        await this.waitForBalancesToLoad(groupId);
    }

    // ========== Member Management Methods ==========

    // Member management element accessors
    getLeaveGroupButton(): Locator {
        // Leave button is now in the Group Actions panel
        // There may be multiple (sidebar and mobile views)
        // Return the first visible one with the test id
        return this.page.getByTestId('leave-group-button').first();
    }

    getMemberItem(memberName: string): Locator {
        // Use data-member-name attribute for precise selection
        // This avoids issues with "Admin" text or other content in the member item
        // Important: Only select visible member items (both mobile and desktop views may be in DOM)
        return this.page.locator(`[data-testid="member-item"][data-member-name="${memberName}"]:visible`);
    }

    getRemoveMemberButton(memberName: string): Locator {
        const memberItem = this.getMemberItem(memberName);
        return memberItem.locator('[data-testid="remove-member-button"]');
    }

    // Member management actions
    async clickLeaveGroup(): Promise<void> {
        const leaveButton = this.getLeaveGroupButton();
        await this.clickButton(leaveButton, { buttonName: 'Leave Group' });
    }

    async confirmLeaveGroup(): Promise<void> {
        const dialog = this.page.getByTestId('leave-group-dialog');
        const confirmButton = dialog.getByTestId('confirm-button');
        await expect(confirmButton).toBeVisible({ timeout: 2000 });
        await this.clickButton(confirmButton, { buttonName: 'Confirm Leave' });
    }

    async cancelLeaveGroup(): Promise<void> {
        const dialog = this.page.getByTestId('leave-group-dialog');
        const cancelButton = dialog.getByTestId('cancel-button');
        await this.clickButton(cancelButton, { buttonName: 'Cancel Leave' });
    }

    async waitForOutstandingBalanceError(): Promise<void> {
        // First try the specific test ID approach (more reliable)
        try {
            await this.verifyLeaveErrorMessage();
            return;
        } catch {
            // Fallback to text-based approach
            const errorMessage = this.page.getByText(/outstanding balance|settle up before leaving/i);
            await expect(errorMessage).toBeVisible({ timeout: 5000 });
        }
    }

    async waitForRedirectAwayFromGroup(groupId: string): Promise<void> {
        await expect(async () => {
            const currentUrl = this.page.url();
            
            // Check if we're already on the 404 page
            if (currentUrl.includes('/404')) {
                return;
            }
            
            // Check if we're on an error page or redirected away from the group
            if (!currentUrl.includes(`/groups/${groupId}`)) {
                return;
            }
            
            // If still on group page, wait a moment for error handling to kick in
            await this.page.waitForTimeout(1000);
            const newUrl = this.page.url();
            
            if (newUrl.includes('/404') || !newUrl.includes(`/groups/${groupId}`)) {
                return;
            }
            
            throw new Error(`Expected 404 or redirect away from group, but still on: ${newUrl}`);
        }).toPass({ timeout: 10000, intervals: [1000] });
    }

    async clickRemoveMember(memberName: string): Promise<void> {
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
    }

    async confirmRemoveMember(): Promise<void> {
        const dialog = this.page.getByTestId('remove-member-dialog');
        const confirmButton = dialog.getByTestId('confirm-button');
        await expect(confirmButton).toBeVisible({ timeout: 2000 });
        await this.clickButton(confirmButton, { buttonName: 'Confirm Remove' });
    }

    async verifyMemberNotVisible(memberName: string): Promise<void> {
        await expect(this.page.getByText(memberName)).not.toBeVisible();
    }

    async verifyLeaveErrorMessage(): Promise<void> {
        const dialog = this.page.getByTestId('leave-group-dialog');
        const errorMessage = dialog.getByTestId('balance-error-message');
        try {
            await expect(errorMessage).toBeVisible({ timeout: 10000 });
        } catch (e) {
            throw new Error('The error message for leaving with an outstanding balance did not appear within 10 seconds');
        }
    }

    // ====== COMMENTS METHODS ======

    /**
     * Get the comments section container
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

        // Wait for comment to be sent (button should become disabled briefly)
        await expect(sendButton).toBeDisabled({ timeout: 2000 });

        // Verify input is cleared and button remains disabled (empty input = disabled button)
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
        // Check that comments section exists
        await expect(this.getCommentsSection()).toBeVisible();

        // Check that input exists and has correct placeholder
        const input = this.getCommentInput();
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute('placeholder', /add a comment to this group/i);

        // Check that send button exists
        const sendButton = this.getSendCommentButton();
        await expect(sendButton).toBeVisible();

        // Send button should be disabled when input is empty
        await expect(sendButton).toBeDisabled();
    }


    /**
     * Verify that comment authors are visible in the comments section
     */
    async verifyCommentAuthorsVisible(authorNames: string[]): Promise<void> {
        const commentsSection = this.getCommentsSection();
        
        for (const authorName of authorNames) {
            const authorElement = commentsSection.locator('span.font-medium', { hasText: authorName }).first();
            await expect(authorElement).toBeVisible();
        }
    }

    /**
     * Verify that all specified comments are visible
     */
    async verifyCommentsVisible(commentTexts: string[]): Promise<void> {
        const commentsSection = this.getCommentsSection();
        
        for (const commentText of commentTexts) {
            await expect(commentsSection.getByText(commentText)).toBeVisible();
        }
    }

    /**
     * Remove a group member (owner only)
     */
    async removeGroupMember(userId: string): Promise<void> {
        // This method would need UI implementation
        // For now, throw a descriptive error
        throw new Error('removeGroupMember method not yet implemented - requires member management UI');
    }

    /**
     * Leave the group (non-owner members)
     */
    async leaveGroup(): Promise<void> {
        // Look for a leave group button in GroupActions component
        const leaveGroupButton = this.page.getByRole('button', { name: /leave group/i });
        await expect(leaveGroupButton).toBeVisible();
        await this.clickButton(leaveGroupButton, { buttonName: 'Leave Group' });
        
        // Wait for Leave Group confirmation UI to appear
        const leaveGroupHeading = this.page.getByRole('heading', { name: /leave group/i });
        await expect(leaveGroupHeading).toBeVisible();
        
        // Click confirm button with data-testid
        const confirmButton = this.page.getByTestId('confirm-button');
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();
        
        // Wait for confirmation UI to close and navigation to occur
        await expect(leaveGroupHeading).not.toBeVisible({ timeout: 5000 });
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

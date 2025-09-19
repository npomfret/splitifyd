import {expect, Locator, Page} from '@playwright/test';
import {BasePage} from './base.page';
import {ExpenseFormData, ExpenseFormPage} from './expense-form.page';
import {ExpenseDetailPage} from './expense-detail.page';
import {SettlementData, SettlementFormPage} from './settlement-form.page';
import {EditGroupModalPage} from './edit-group-modal.page';
import {LeaveGroupModalPage} from './leave-group-modal.page';
import {RemoveMemberModalPage} from './remove-member-modal.page';
import {ARIA_ROLES, BUTTON_TEXTS, HEADINGS, MESSAGES} from '../constants/selectors';
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
    constructor(page: Page) {
        super(page);
    }

    async navigateToDashboard() {
        await this.header.navigateToDashboard();
        return new DashboardPage(this.page, this.userInfo)
    }

    inferGroupId() {
        return this.getUrlParam('groupId')!;
    }

    // Element accessors for group information
    getGroupTitle() {
        // The group title is specifically an h1 element
        return this.page.locator('h1').first();
    }

    async getGroupName(): Promise<string> {
        // Returns the actual text content of the group title
        const title = await this.getGroupTitle().textContent();
        return title?.trim() || '';
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
        return this.page.getByRole('heading', {name: /balances/i});
    }

    // Element accessors for expenses
    getAddExpenseButton() {
        // Primary selector: use data-testid
        // Fallback: use role and name for robustness
        return this.page
            .locator('[data-testid="add-expense-button"]')
            .or(this.page.getByRole('button', {name: /add expense/i}))
            .first();
    }

    async clickSettleUpButton(expectedMemberCount: number): Promise<SettlementFormPage> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        // Get button and click it (clickButton will handle attachment wait internally)
        const settleButton = this.getSettleUpButton();

        await this.clickButton(settleButton, {buttonName: 'Settle up'});

        // Verify modal opened
        const settlementFormPage = new SettlementFormPage(this.page, this.userInfo);
        await expect(settlementFormPage.getModal()).toBeVisible();
        await settlementFormPage.waitForFormReady(expectedMemberCount);
        return settlementFormPage;
    }

    getSettleUpButton(): Locator {
        return this.page.getByRole('button', {name: /settle up/i});
    }

    /**
     * Waits for the Add Expense button to be visible and enabled.
     * This ensures the page is fully loaded before attempting to interact with the button.
     */
    async waitForAddExpenseButton(timeout = 5000): Promise<void> {
        const addButton = this.getAddExpenseButton();

        // Wait for button to be visible
        await expect(addButton).toBeVisible({timeout});

        // Wait for button to be enabled
        await expect(addButton).toBeEnabled({timeout});
    }

    async clickAddExpenseButton(expectedMemberCount: number): Promise<ExpenseFormPage> {
        // Wait for button to be ready first
        await this.waitForAddExpenseButton();

        // Now attempt navigation - will throw if it fails
        return await this.attemptAddExpenseNavigation(expectedMemberCount);
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
    private async attemptAddExpenseNavigation(expectedMemberCount: number): Promise<ExpenseFormPage> {
        const expectedUrlPattern = /\/groups\/[a-zA-Z0-9]+\/add-expense/;
        const addButton = this.getAddExpenseButton();

        // Button readiness is already checked in clickAddExpenseButton
        // Trust that the button is ready when this method is called
        await this.clickButton(addButton, {buttonName: 'Add Expense'});

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
            await expect(loadingSpinner).not.toBeVisible({timeout: 5000});
            await expect(loadingText).not.toBeVisible({timeout: 5000});
        }

        // Verify we're still on the correct page
        if (!this.page.url().match(expectedUrlPattern)) {
            throw new Error(`Navigation failed after loading - expected URL pattern ${expectedUrlPattern}, got ${this.page.url()}`);
        }

        // Create and validate the expense form page
        const expenseFormPage = new ExpenseFormPage(this.page);

        // Wait for form to be ready
        await expenseFormPage.waitForFormReady(expectedMemberCount);
        return expenseFormPage;
    }

    // Share functionality accessors
    getShareButton() {
        return this.page.getByRole('button', {name: /invite others/i}).first();
    }

    getShareDialog() {
        return this.page.getByRole('dialog');
    }

    getShareLinkInput() {
        return this.getShareDialog().locator('input[type="text"]');
    }

    getCloseButton() {
        return this.page.getByRole('button', {name: /close|×/i}).first();
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

        const expectedText = `${expectedCount} member${expectedCount !== 1 ? 's' : ''}`;

        // Wait for member count to appear in the main group heading
        try {
            await expect(this.page.getByText(expectedText).first()).toBeVisible({timeout});
        } catch (error) {
            // Get actual visible member count for better error reporting
            const visibleMemberTexts = await this.page.locator('text=/\\d+ member/').allTextContents();
            const actualMemberCount = visibleMemberTexts.length > 0 ? visibleMemberTexts[0] : 'none found';

            throw new Error(`Expected "${expectedText}" but found "${actualMemberCount}". Current URL: ${this.page.url()}`);
        }

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
                await expect(this.page.getByText(userName).first()).toBeVisible({timeout: 5000});
            } catch (e) {
                // Capture detailed state for debugging - handle page closure gracefully
                let visibleMembers: Array<{ name: string; id: string; text: string }> = [];
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
                        displayName: await this.header.getCurrentUserDisplayName(),
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
     * @deprecated use waitForPage instead
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
                has: this.page.getByRole('heading', {name: 'Balances'}),
            })
            .first();

        // Wait for balances section to be visible
        try {
            await expect(balancesSection).toBeVisible({timeout: 5000});
        } catch (e) {
            const pageContent = await this.page.textContent('body');
            throw new Error(`Balances section failed to load within 8 seconds on group ${groupId}. Page content: ${pageContent?.substring(0, 500)}...`);
        }

        // Wait for loading to disappear
        try {
            await expect(balancesSection.getByText('Loading balances...')).not.toBeVisible({timeout: 5000});
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
                await expect(loadingSpinner.first()).not.toBeVisible({timeout: 5000});
            } catch (e) {
                throw new Error(`Members section loading spinner did not disappear within 5 seconds on group ${groupId}`);
            }
        }
    }

    async waitForBalanceUpdate(): Promise<void> {
        // Wait for the balance section to be stable
        const balanceSection = this.page.getByRole('heading', {name: 'Balances'}).locator('..');
        await expect(balanceSection).toBeVisible();

        // Wait for network requests to complete
        await this.waitForDomContentLoaded();
    }

    async waitForPage(groupId: string, expectedMemberCount: number) {
        const targetGroupUrl = `/groups/${groupId}`;
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);

        await this.header.getCurrentUserDisplayName();// just a sanity check - top right by the menu

        await this.waitForMemberCount(expectedMemberCount);
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);
        await this.waitForBalancesToLoad(groupId);
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);
    }

    async waitForExpense(expenseDescription: string) {
        await this.page.waitForSelector(`text=${expenseDescription}`);
        await expect(this.getExpenseByDescription(expenseDescription)).toBeVisible();
    }

    private async sanityCheckPageUrl(currentUrl: string, targetGroupUrl: string) {
        // Assert we're actually on the group page
        if (!currentUrl.includes(targetGroupUrl)) {
            // Take screenshot before throwing error
            throw new Error(`Navigation failed. Expected URL to contain ${targetGroupUrl}, but got: ${currentUrl}`);
        }
    }

    /**
     * Create expense using proper page object composition
     */
    async addExpense(expense: ExpenseData, expectedMemberCount: number): Promise<void> {
        const expenseFormPage = await this.clickAddExpenseButton(expectedMemberCount);

        // Convert ExpenseData to ExpenseFormData, ensuring participants is provided
        const expenseFormData: ExpenseFormData = {
            ...expense,
            participants: expense.participants || [], // Default to empty array if not provided
        };

        await expenseFormPage.submitExpense(expenseFormData);
    }

    /**
     * Record settlement using proper page object composition
     */
    async recordSettlement(settlementOptions: SettlementData, expectedMemberCount: number,): Promise<void> {
        const settlementFormPage = await this.clickSettleUpButton(expectedMemberCount);
        await settlementFormPage.submitSettlement(settlementOptions, expectedMemberCount);
    }

    /**
     * New getter methods using centralized constants
     */

    // Headings
    getExpensesHeading() {
        return this.page.getByRole(ARIA_ROLES.HEADING, {name: HEADINGS.EXPENSES});
    }

    getShowHistoryButton() {
        return this.page.getByRole(ARIA_ROLES.BUTTON, {name: BUTTON_TEXTS.SHOW_HISTORY});
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

    /**
     * @deprecated far too vague - use a better selector
     */
    getCurrencyAmount(amount: string) {
        return this.page.getByText(`$${amount}`);
    }

    /**
     * Gets the balances section using the complex locator
     * This replaces repeated complex locator chains in tests
     */
    getBalancesSection() {
        return this.page
            .locator('.bg-white')
            .filter({
                has: this.page.getByRole('heading', {name: 'Balances'}),
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
        return this.page.getByRole('button', {name: /delete/i});
    }

    /**
     * Gets the confirmation delete button (second delete button in dialog)
     */
    getDeleteConfirmButton() {
        return this.page.getByRole('button', {name: 'Delete'}).nth(1);
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
        // Target the specific expense description within the ExpenseItem structure
        // Based on ExpenseItem.tsx: <p className="font-medium">{expense.description}</p>
        // This is inside a clickable expense container with specific styling
        return this.page.locator('div[style*="border-left"]').filter({hasText: description}).locator('p.font-medium', {hasText: description});
    }

    getExpenseAmount(amount: string) {
        // Target expense amount specifically in the expense list context
        // Look for amount that's not in a balance/debt context (excludes data-financial-amount elements)
        return this.page.getByText(amount).and(this.page.locator(':not([data-financial-amount])')).first();
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
        await this.clickButton(deleteButton, {buttonName: 'Delete Expense'});

        // Confirm deletion
        const confirmButton = this.getDeleteConfirmButton();
        await this.clickButton(confirmButton, {buttonName: 'Confirm Delete'});

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
            await expect(loadingSpinner).not.toBeVisible({timeout: 5000}); // for some reason this can be slow
        }

        // Get the share link
        const shareLinkInput = this.getShareLinkInput();
        await expect(shareLinkInput).toBeVisible({timeout: 5000});
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
            await this.page.click('body', {position: {x: 10, y: 10}});
        }

        return shareLink;
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
        return this.page.locator('.text-xs').filter({hasText: 'Admin'}).first();
    }

    /**
     * Gets the settings button (only visible for group owner)
     */
    getSettingsButton() {
        return this.page.getByRole('button', {name: /group settings/i}).first();
    }

    /**
     * Opens the edit group modal by clicking the settings button
     */
    async openEditGroupModal(): Promise<EditGroupModalPage> {
        const settingsButton = this.getSettingsButton();
        await this.clickButton(settingsButton, {buttonName: 'Group Settings'});

        // Create and return the EditGroupModalPage instance
        const editModal = new EditGroupModalPage(this.page);
        await editModal.waitForModalVisible();

        return editModal;
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
     * Get the actual member count as a number by parsing the UI text
     * Waits for the API-loaded member count to be available
     */
    async getCurrentMemberCount(): Promise<number> {
        // Use the specific testid we added to the GroupHeader component
        const memberCountElement = this.page.getByTestId('member-count');
        await expect(memberCountElement).toBeVisible({timeout: 10000});

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
     * Close modal or dialog
     */
    async closeModal(): Promise<void> {
        const closeButton = this.getCloseButton();
        if (await closeButton.isVisible()) {
            await closeButton.click();
        } else {
            // Click outside modal to close
            await this.page.click('body', {position: {x: 10, y: 10}});
        }
    }

    /**
     * Verify expense is visible for the current user
     */
    async verifyExpenseVisible(description: string): Promise<void> {
        await expect(this.getExpenseByDescription(description)).toBeVisible();
    }

    /**
     * Get the members container that contains the "Members" heading
     */
    getMembersContainer(): Locator {
        // Find the visible Members container (either sidebar div or Card)
        // Use the specific classes from the TSX: sidebar has "border rounded-lg bg-white p-4"
        return this.page.locator('.border.rounded-lg.bg-white, .p-6').filter({has: this.page.getByText('Members')});
    }

    /**
     * Wait for a specific member to become visible in the member list
     * This ensures the member has been fully added to the group before proceeding
     */
    async waitForMemberVisible(memberName: string, timeout: number = 3000): Promise<void> {
        const membersContainer = this.getMembersContainer();

        // Look for visible member item with our name within the visible container
        const memberElement = membersContainer.locator('[data-testid="member-item"]:visible').filter({hasText: memberName}).first();
        await expect(memberElement).toBeVisible({timeout});
    }

    /**
     * Get the payment history container that contains the "Payment History" heading
     * This ensures all settlement-related selectors are properly scoped
     */
    getPaymentHistoryContainer(): Locator {
        // Find the SidebarCard containing "Payment History" heading
        // Based on SidebarCard structure: bg-white rounded-lg shadow-sm border border-gray-200 p-4
        return this.page.locator('.bg-white.rounded-lg.shadow-sm.border.border-gray-200.p-4').filter({
            has: this.page.locator('h3').filter({hasText: 'Payment History'})
        });
    }

    /**
     * Get settlement payment history entry by note
     * Properly scoped to the payment history container
     */
    private getSettlementHistoryEntry(settlementNote: string) {
        const paymentHistoryContainer = this.getPaymentHistoryContainer();
        return paymentHistoryContainer.locator('[data-testid="settlement-item"]').filter({
            hasText: new RegExp(settlementNote, 'i')
        });
    }

    /**
     * Get edit button for a specific settlement by identifying the settlement container
     * Properly scoped to the payment history container
     */
    getSettlementEditButton(settlementNote: string): Locator {
        const settlementItem = this.getSettlementHistoryEntry(settlementNote);
        return settlementItem.locator('[data-testid="edit-settlement-button"]');
    }

    /**
     * Get delete button for a specific settlement by identifying the settlement container
     * Properly scoped to the payment history container
     */
    getSettlementDeleteButton(settlementNote: string): Locator {
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
        await expect(editButton).toBeVisible({timeout: 2000});
        await expect(editButton).toBeEnabled();

        await this.clickButton(editButton, {buttonName: 'Edit Settlement'});

        // Wait for settlement form modal to open in edit mode
        const modal = this.page.getByRole('dialog');
        await expect(modal).toBeVisible({timeout: 3000});

        // Verify we're in edit mode by checking for "Update Payment" title
        await expect(modal.getByRole('heading', {name: 'Update Payment'})).toBeVisible();

        const expectedMemberCount = await this.getCurrentMemberCount();

        const settlementFormPage = new SettlementFormPage(this.page, this.userInfo);
        await expect(settlementFormPage.getModal()).toBeVisible();
        await settlementFormPage.waitForFormReady(expectedMemberCount);

        return settlementFormPage;
    }

    /**
     * Click delete button for a settlement and handle confirmation dialog
     */
    async clickDeleteSettlement(settlementNote: string, confirm: boolean = true): Promise<void> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        await this.openHistoryIfClosed();

        // Assert the delete button exists and is enabled
        const deleteButton = this.getSettlementDeleteButton(settlementNote);
        await expect(deleteButton).toBeVisible({timeout: 2000});
        await expect(deleteButton).toBeEnabled();

        await this.clickButton(deleteButton, {buttonName: 'Delete Settlement'});

        // Wait for confirmation dialog - it uses data-testid, not role="dialog"
        const confirmDialog = this.page.locator('[data-testid="confirmation-dialog"]');
        await expect(confirmDialog).toBeVisible({timeout: 3000});

        // Verify it's the correct dialog
        await expect(confirmDialog.locator('h3')).toHaveText('Delete Payment');

        if (confirm) {
            const deleteButton = confirmDialog.locator('[data-testid="confirm-button"]');
            await this.clickButton(deleteButton, {buttonName: 'Delete'});

            // Wait for dialog to close
            await expect(confirmDialog).not.toBeVisible({timeout: 3000});
        } else {
            const cancelButton = confirmDialog.locator('[data-testid="cancel-button"]');
            await this.clickButton(cancelButton, {buttonName: 'Cancel'});

            // Wait for dialog to close
            await expect(confirmDialog).not.toBeVisible({timeout: 3000});
        }
    }

    /**
     * Verify a settlement is no longer visible in history
     */
    async verifySettlementNotInHistory(settlementNote: string): Promise<void> {
        await this.openHistoryIfClosed();

        // Wait for real-time updates to complete by ensuring settlement is not visible
        const settlementEntry = this.getSettlementHistoryEntry(settlementNote);
        await expect(settlementEntry).not.toBeVisible({timeout: 2000});
    }

    /**
     * Verify settlement is in history
     */
    async verifySettlementInHistoryVisible(settlementNote: string): Promise<void> {
        await expect(this.getSettlementHistoryEntry(settlementNote)).toBeVisible();
    }

    async verifySettlementInHistory(settlementNote: string): Promise<void> {
        // Open history if not already open
        await this.openHistoryIfClosed();

        // Verify settlement is visible in history using properly scoped selector
        const settlementEntry = this.getSettlementHistoryEntry(settlementNote);
        await expect(settlementEntry).toBeVisible();
    }

    /**
     * Wait for a settlement to appear in the payment history
     * This is used for real-time testing when multiple users need to see a settlement
     * @param settlementNote - The note text of the settlement to wait for
     * @param timeout - Optional timeout in milliseconds (default: 5000)
     */
    async waitForSettlementToAppear(settlementNote: string, timeout: number = 5000): Promise<void> {
        // First ensure payment history is open so we can see settlements
        await this.openHistoryIfClosed();

        // Wait for the settlement to appear in the history
        const settlementEntry = this.getSettlementHistoryEntry(settlementNote);
        await expect(settlementEntry).toBeVisible({timeout});
    }

    /**
     * Open settlement history and verify settlement content
     * Properly scoped to the payment history container
     */
    async openHistoryAndVerifySettlement(settlementText: string | RegExp): Promise<void> {
        await this.openHistoryIfClosed();

        // Find the settlement within the payment history container
        const paymentHistoryContainer = this.getPaymentHistoryContainer();
        const settlementEntry = paymentHistoryContainer.locator('[data-testid="settlement-item"]').filter({
            hasText: settlementText
        });

        // Wait for settlement to be visible within the payment history
        await expect(settlementEntry.first()).toBeVisible();
    }

    /**
     * Open history if it's closed (idempotent)
     */
    async openHistoryIfClosed(): Promise<void> {
        // Assert we're on the group detail page
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        const showHistoryButton = this.page.getByRole('button', {name: 'Show History'});
        const hideHistoryButton = this.page.getByRole('button', {name: 'Hide History'});

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
     * Properly scoped to the payment history container
     */
    async verifySettlementDetails(details: { note: string; amount: string; payerName: string; payeeName: string }): Promise<void> {
        // Assert we're in the right state
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        // Find the settlement within the payment history container
        const settlementItem = this.getSettlementHistoryEntry(details.note);

        // Verify settlement is visible and contains all expected details
        await expect(settlementItem.first()).toBeVisible();
        await expect(settlementItem.first().locator(`text=${details.amount}`)).toBeVisible();
        await expect(settlementItem.first().locator(`text=${details.payerName}`)).toBeVisible();
        await expect(settlementItem.first().locator(`text=${details.payeeName}`)).toBeVisible();
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
                has: this.page.getByRole('heading', {name: 'Balances'}),
            })
            .first();
    }

    async verifyDebtRelationship(debtorName: string, creditorName: string, amount: string): Promise<void> {
        // If testid approach doesn't work, fall back to a more precise text-based approach
        const debtContainerFallback = this.getBalancesSectionByContext()
            .locator('div')
            .filter({hasText: new RegExp(`${debtorName}\\s*→\\s*${creditorName}`)})
            .filter({hasText: amount})
            .last(); // Get the most specific (deepest) match

        await expect(debtContainerFallback).toBeVisible({timeout: 3000});

        // Verify the debt amount is present within this container
        const debtAmount = debtContainerFallback.locator('[data-financial-amount="debt"]').filter({hasText: amount});
        await expect(debtAmount).toBeVisible({timeout: 2000});
    }

    /**
     * Assert that a user is settled up (has no debts)
     * @param userName - The display name of the user to check
     */
    async assertSettledUp(userName: string): Promise<void> {
        const balancesSection = this.getBalancesSection();

        // User should not appear in any debt relationships
        const debtAsDebtor = balancesSection.getByText(new RegExp(`${userName}\\s*→`));
        const debtAsCreditor = balancesSection.getByText(new RegExp(`→\\s*${userName}`));

        await expect(debtAsDebtor).not.toBeVisible();
        await expect(debtAsCreditor).not.toBeVisible();
    }

    /**
     * Verify that all members in the group are settled up (no outstanding balances)
     * @param groupId - The group ID for context (used for better error messages)
     */
    async verifyAllSettledUp(groupId: string): Promise<void> {
        // Assert we're on the correct group page
        const currentUrl = this.page.url();// todo: remove this
        if (!currentUrl.includes(`/groups/${groupId}`)) {
            throw new Error(`verifyAllSettledUp called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`);
        }

        // Wait for the "All settled up!" message to appear
        await this.waitForSettledUpMessage();

        // Double-check that there are no debt relationships visible
        const balancesSection = this.getBalancesSection();
        const debtElements = balancesSection.locator('[data-financial-amount="debt"]');
        await expect(debtElements).toHaveCount(0);
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

    // Member management actions
    async clickLeaveGroup(): Promise<LeaveGroupModalPage> {
        const leaveButton = this.getLeaveGroupButton();
        await this.clickButton(leaveButton, {buttonName: 'Leave Group'});

        // Create and return the LeaveGroupModalPage instance
        const leaveModal = new LeaveGroupModalPage(this.page);
        await leaveModal.waitForDialogVisible();

        return leaveModal;
    }

    async waitForRedirectAwayFromGroup(groupId: string): Promise<void> {
        await expect(async () => {
            const currentUrl = this.page.url();

            // Check if we're already on the dashboard (expected behavior)
            if (currentUrl.includes('/dashboard')) {
                return;
            }

            // Check if we're on any other page away from the group
            if (!currentUrl.includes(`/groups/${groupId}`)) {
                return;
            }

            // If still on group page, wait a moment for redirect to kick in
            await this.page.waitForTimeout(1000);
            const newUrl = this.page.url();

            if (newUrl.includes('/dashboard') || !newUrl.includes(`/groups/${groupId}`)) {
                return;
            }

            throw new Error(`Expected redirect to dashboard or away from group, but still on: ${newUrl}`);
        }).toPass({timeout: 2000, intervals: [100, 200]});
    }

    async clickRemoveMember(memberName: string): Promise<RemoveMemberModalPage> {
        const memberItem = this.getMemberItem(memberName);
        try {
            await expect(memberItem).toBeVisible({timeout: 5000});
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
        await this.clickButton(removeButton, {buttonName: `Remove ${memberName}`});

        // Create and return the RemoveMemberModalPage instance
        const removeModal = new RemoveMemberModalPage(this.page);
        await removeModal.waitForDialogVisible();
        return removeModal;
    }

    async verifyMemberNotVisible(memberName: string): Promise<void> {
        await expect(this.getMemberItem(memberName)).not.toBeVisible();
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
        return this.getCommentsSection().getByRole('textbox', {name: /comment text/i});
    }

    /**
     * Get the send comment button
     */
    getSendCommentButton() {
        return this.getCommentsSection().getByRole('button', {name: /send comment/i});
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
        await this.clickButton(sendButton, {buttonName: 'Send comment'});

        // Wait for comment to be sent (button should become disabled briefly)
        await expect(sendButton).toBeDisabled({timeout: 2000});

        // Verify input is cleared and button remains disabled (empty input = disabled button)
        await expect(input).toHaveValue('');
        await expect(sendButton).toBeDisabled();
    }

    /**
     * Wait for a comment with specific text to appear
     */
    async waitForCommentToAppear(text: string, timeout: number = 5000): Promise<void> {
        const comment = this.getCommentByText(text);
        await expect(comment).toBeVisible({timeout});
    }

    /**
     * Leave the group (non-owner members)
     */
    async leaveGroup(): Promise<void> {
        // Look for a leave group button in GroupActions component
        const leaveGroupButton = this.page.getByRole('button', {name: /leave group/i});
        await expect(leaveGroupButton).toBeVisible();
        await this.clickButton(leaveGroupButton, {buttonName: 'Leave Group'});

        // Wait for Leave Group confirmation UI to appear
        const leaveGroupHeading = this.page.getByRole('heading', {name: /leave group/i});
        await expect(leaveGroupHeading).toBeVisible();

        // Check for any error messages that might prevent leaving
        const errorElements = await this.page.locator('[role="alert"], .text-red-500, .error').count();
        if (errorElements > 0) {
            const errorText = await this.page.locator('[role="alert"], .text-red-500, .error').first().textContent();
            throw new Error(`Cannot leave group due to error: ${errorText}`);
        }

        // Click confirm button with data-testid
        const confirmButton = this.page.getByTestId('confirm-button');
        await expect(confirmButton).toBeEnabled();

        const clickTime = Date.now();
        console.log('🕒 Clicking leave group confirm button at:', new Date(clickTime).toISOString());
        await confirmButton.click();

        // Wait for confirmation UI to close and navigation to occur with better error handling
        try {
            await expect(leaveGroupHeading).not.toBeVisible({timeout: 3000});
            const closeTime = Date.now();
            const duration = closeTime - clickTime;
            console.log(`🕒 Modal closed after ${duration}ms`);

            if (duration > 1000) {
                console.warn(`⚠️ SLOW MODAL CLOSE: Took ${duration}ms (expected <1000ms)`);
            }
        } catch (timeoutError) {
            // Check if there are any error messages preventing the leave
            const postClickErrors = await this.page.locator('[role="alert"], .text-red-500, .error').count();
            if (postClickErrors > 0) {
                const errorText = await this.page.locator('[role="alert"], .text-red-500, .error').first().textContent();
                throw new Error(`Leave group failed with error: ${errorText}`);
            }

            // Check if the button is still enabled (might indicate a failed action)
            const stillEnabled = await confirmButton.isEnabled().catch(() => false);
            if (stillEnabled) {
                throw new Error('Leave group confirmation button is still enabled - action may have failed');
            }

            // Re-throw the timeout error with more context
            throw new Error(`Leave group modal did not close within 10 seconds. Modal still visible: ${await leaveGroupHeading.isVisible()}`);
        }
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

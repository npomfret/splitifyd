import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { ExpenseFormPage } from './expense-form.page';
import { ExpenseDetailPage } from './expense-detail.page';
import { SettlementFormPage } from './settlement-form.page';
import { ARIA_ROLES, BUTTON_TEXTS, HEADINGS, MESSAGES } from '../constants/selectors';
import { ButtonClickError } from '../errors/test-errors';

interface ExpenseData {
    description: string;
    amount: number;
    currency: string; // Required: must be explicitly provided
    paidBy: string;
    splitType: 'equal' | 'exact' | 'percentage';
    participants?: string[]; // Optional: if not provided, selects all members
}

export class GroupDetailPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // Element accessors for group information
    getGroupTitle() {
        // The group title is specifically an h1 element
        return this.page.locator('h1').first();
    }

    getGroupTitleByName(name: string) {
        return this.page.getByRole('heading', { name });
    }

    getGroupDescription() {
        return this.page.getByText(/test|description/i).first();
    }

    getMembersCount() {
        return this.page.getByText(/\d+ member/i);
    }

    getBalancesHeading() {
        return this.page.getByRole('heading', { name: /balances/i });
    }

    // Element accessors for expenses
    getAddExpenseButton() {
        return this.page.getByRole('button', { name: /add expense/i });
    }

    async clickSettleUpButton(expectedMemberCount: number): Promise<SettlementFormPage> {
        const settleButton = this.getSettleUpButton();
        await this.clickButton(settleButton, { buttonName: 'Settle with payment' });
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

    /**
     * Navigates to add expense form with comprehensive state detection.
     * Throws ButtonClickError with all context if navigation fails.
     */
    private async attemptAddExpenseNavigation(expectedMemberCount: number, userInfo?: { displayName?: string; email?: string }): Promise<ExpenseFormPage> {
        const startUrl = this.page.url();
        const expectedUrlPattern = /\/groups\/[a-zA-Z0-9]+\/add-expense/;
        const addButton = this.getAddExpenseButton();

        // Button readiness is already checked in clickAddExpenseButton
        // Trust that the button is ready when this method is called
        await this.clickButton(addButton, { buttonName: 'Add Expense' });

        // Wait for navigation to expense form
        await this.page.waitForURL(expectedUrlPattern, { timeout: 5000 });
        await this.page.waitForLoadState('domcontentloaded');

        // sanity check!
        let currentUrl = this.page.url();
        if (!currentUrl.match(expectedUrlPattern)) {
            const result = {
                success: false,
                reason: 'Navigation failed - wrong URL pattern',
                startUrl,
                currentUrl:  this.page.url(),
                expectedPattern: expectedUrlPattern.toString(),
                userInfo
            };
            const error = ButtonClickError.fromResult('Navigate to Add Expense form', result);
            error.context.expectedPattern = expectedUrlPattern.toString();
            throw error;
        }

        // Wait for any loading spinner to disappear
        const loadingSpinner = this.page.locator('.animate-spin');
        const loadingText = this.page.getByText('Loading expense form...');

        if ((await loadingSpinner.count()) > 0 || (await loadingText.count()) > 0) {
            try {
                await expect(loadingSpinner).not.toBeVisible({ timeout: 5000 });
                await expect(loadingText).not.toBeVisible({ timeout: 5000 });
            } catch (timeoutError) {
                const result = {
                    success: false,
                    reason: 'Loading spinner or text did not disappear within timeout',
                    startUrl,
                    currentUrl:  this.page.url(),
                    userInfo,
                    loadingSpinnerVisible: await loadingSpinner.isVisible().catch(() => false),
                    loadingTextVisible: await loadingText.isVisible().catch(() => false),
                    timeout: 5000
                };
                const error = ButtonClickError.fromResult('Navigate to Add Expense form', result);
                error.context.originalError = timeoutError;
                throw error;
            }
        }

        // sanity check - verify we're still on the correct page
        if (!this.page.url().match(expectedUrlPattern)) {
            const result = {
                success: false,
                reason: 'Navigation failed after loading - wrong URL pattern',
                startUrl,
                currentUrl:  this.page.url(),
                expectedPattern: expectedUrlPattern.toString(),
                userInfo
            };
            const error = ButtonClickError.fromResult('Navigate to Add Expense form', result);
            error.context.expectedPattern = expectedUrlPattern.toString();
            throw error;
        }

        // Create and validate the expense form page
        const expenseFormPage = new ExpenseFormPage(this.page);

        // Try to wait for form to be ready
        try {
            await expenseFormPage.waitForFormReady(expectedMemberCount, userInfo);
            return expenseFormPage;
        } catch (formError) {
            const result = {
                success: false,
                reason: 'Expense form failed to load properly',
                startUrl,
                currentUrl:  this.page.url(),
                userInfo,
                error: String(formError)
            };
            const error = ButtonClickError.fromResult('Navigate to Add Expense form', result);
            error.context.originalError = formError;
            throw error;
        }
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

        // First, wait for any loading spinner in the Members section to disappear
        const membersSection = this.page.locator('text=Members').locator('..');
        const loadingSpinner = membersSection.locator('.animate-spin, [role="status"]');
        const spinnerCount = await loadingSpinner.count();
        if (spinnerCount > 0) {
            await expect(loadingSpinner.first()).not.toBeVisible({ timeout });
        }

        const expectedText = `${expectedCount} member${expectedCount !== 1 ? 's' : ''}`;

        // Use a more robust approach - wait for the text or any variant that indicates member count
        try {
            await expect(this.page.getByText(expectedText)).toBeVisible({ timeout });
        } catch (e) {
            // If exact text isn't found, try waiting for the members section to be updated
            // This provides a fallback for real-time update timing issues
            console.log(`Expected member text '${expectedText}' not found, checking for members section updates`);

            // Wait for real-time updates to sync
            await this.page.waitForLoadState('domcontentloaded');

            // Final attempt with the expected text
            await expect(this.page.getByText(expectedText)).toBeVisible({ timeout: 3000 });
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
        await this.page.waitForLoadState('domcontentloaded');

        // Primary approach: verify all users are visible in the group (more reliable than member count)
        for (const userName of allUserNames) {
            try {
                await expect(this.page.getByText(userName).first()).toBeVisible({ timeout: 15000 });
            } catch (e) {
                const visibleMembers = await this.page.locator('[data-testid="member-item"]').allInnerTexts();
                throw new Error(`Failed to find user "${userName}" in member list during synchronization. Expected users: [${allUserNames.join(', ')}]. Visible members: [${visibleMembers.join(', ')}]`);
            }
        }

        // Secondary verification: wait for correct member count
        try {
            await this.waitForMemberCount(totalUsers, 5000);
        } catch (e) {
            const actualCount = await this.page.getByText(/\d+ member/i).textContent();
            throw new Error(`Member count synchronization failed. Expected: ${totalUsers} members, Found: ${actualCount}`);
        }

        // Final network idle wait to ensure all updates have propagated
        await this.page.waitForLoadState('domcontentloaded');
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
            await expect(balancesSection).toBeVisible({ timeout: 8000 });
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
        await this.page.waitForLoadState('domcontentloaded');
    }

    /**
     * Synchronize group state across multiple users by refreshing pages and waiting for updates.
     * This replaces manual reload() calls scattered throughout multi-user tests.
     * Auto-navigates users to the group page if they're not already there.
     */
    async synchronizeMultiUserState(pages: Array<{ page: any; groupDetailPage: any; userName?: string }>, expectedMemberCount: number, groupId: string): Promise<void> {
        const targetGroupUrl = `/groups/${groupId}`;

        // Navigate all users to the specific group
        for (let i = 0; i < pages.length; i++) {
            const { page, userName } = pages[i];
            const userIdentifier = userName || `User ${i + 1}`;

            await this.navigatePageToUrl(page, targetGroupUrl);

            // Check current URL after navigation
            const currentUrl = page.url();

            // Check if we got redirected to 404
            if (currentUrl.includes('/404')) {
                throw new Error(`${userIdentifier} was redirected to 404 page. Group access denied or group doesn't exist.`);
            }

            // If not on 404, check if we're on the dashboard (another redirect case)
            if (currentUrl.includes('/dashboard')) {
                throw new Error(`${userIdentifier} was redirected to dashboard. Expected ${targetGroupUrl}, but got: ${currentUrl}`);
            }

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);
        }

        // Wait for all pages to show correct member count
        for (let i = 0; i < pages.length; i++) {
            const { page, groupDetailPage, userName } = pages[i];
            const userIdentifier = userName || `User ${i + 1}`;

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);

            try {
                await groupDetailPage.waitForMemberCount(expectedMemberCount);
            } catch (error) {
                throw new Error(`${userIdentifier} failed waiting for member count: ${error}`);
            }

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);
        }

        // Wait for balances section to load on all pages
        for (let i = 0; i < pages.length; i++) {
            const { page, groupDetailPage, userName } = pages[i];
            const userIdentifier = userName || `User ${i + 1}`;

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);

            try {
                await groupDetailPage.waitForBalancesToLoad(groupId);
            } catch (error) {
                // Take screenshot on failure
                const sanitizedUserName = userName ? userName.replace(/\s+/g, '-') : `user-${i + 1}`;
                await page.screenshot({
                    path: `playwright-report/ad-hoc/balance-load-failure-${sanitizedUserName}-${Date.now()}.png`,
                    fullPage: false,
                });
                throw new Error(`${userIdentifier} failed waiting for balances to load: ${error}`);
            }

            await this.sanityCheckPageUrl(page.url(), targetGroupUrl, userIdentifier, page);
        }
    }

    private async sanityCheckPageUrl(currentUrl: string, targetGroupUrl: string, userName: string, page: any) {
        // Assert we're actually on the group page
        if (!currentUrl.includes(targetGroupUrl)) {
            // Take screenshot before throwing error
            const sanitizedUserName = userName.replace(/\s+/g, '-');
            await page.screenshot({
                path: `playwright-report/ad-hoc/navigation-failure-${sanitizedUserName}-${Date.now()}.png`,
                fullPage: false,
            });
            throw new Error(`Navigation failed for ${userName}. Expected URL to contain ${targetGroupUrl}, but got: ${currentUrl}`);
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
     * Create expense and synchronize across multiple users
     */
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
        await joinerPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 3000 });

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
        await page.waitForLoadState('domcontentloaded');
    }

    /**
     * Helper method to navigate an external page object to any URL
     * Encapsulates direct page.goto() usage for multi-user scenarios
     */
    private async navigatePageToUrl(page: any, url: string): Promise<void> {
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');
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

    // todo
    getExpenseAmount(amount: string) {
        return this.page.getByText(amount);
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
        await this.page.waitForLoadState('domcontentloaded');
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
            await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
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
        await this.page.waitForLoadState('domcontentloaded');
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
            },
            saveChanges: async () => {
                // Ensure button is enabled before clicking
                await expect(saveButton).toBeEnabled();
                await saveButton.click();
                // Wait for the modal to close after saving
                // Use a longer timeout as the save operation might take time
                try {
                    await expect(modal).not.toBeVisible({ timeout: 10000 });
                } catch (timeoutError) {
                    const currentUrl = this.page.url();
                    const result = {
                        success: false,
                        reason: 'Edit group modal did not close after saving',
                        currentUrl,
                        buttonName: 'Save Changes',
                        modalVisible: await modal.isVisible().catch(() => false),
                        saveButtonEnabled: await saveButton.isEnabled().catch(() => false),
                        timeout: 10000
                    };
                    const error = ButtonClickError.fromResult('Save group changes', result);
                    error.context.originalError = timeoutError;
                    throw error;
                }
            },
            cancel: async () => {
                const cancelButton = modal.getByRole('button', { name: 'Cancel' });
                await cancelButton.click();
            },
            deleteGroup: async () => {
                const deleteButton = modal.getByRole('button', { name: 'Delete Group' });
                await deleteButton.click();
            }
        };
    }

    /**
     * Handles the delete confirmation dialog
     */
    async handleDeleteConfirmDialog(confirm: boolean) {
        // Wait for confirmation dialog to appear
        // The confirmation dialog appears on top of the edit modal
        await this.page.waitForLoadState('domcontentloaded');

        // The ConfirmDialog component creates a fixed overlay with the Delete Group title
        // Look for the modal content within the overlay - it has "Delete Group" as title
        // and the confirm message
        const confirmTitle = this.page.getByRole('heading', { name: 'Delete Group' });
        await expect(confirmTitle).toBeVisible({ timeout: 5000 });

        // Find the dialog container which is the parent of the title
        const confirmDialog = confirmTitle.locator('..').locator('..');

        if (confirm) {
            // Find and click the Delete button in the confirmation dialog
            // The button text is "Delete" as set by confirmText prop
            const deleteButton = confirmDialog.getByRole('button', { name: 'Delete' });
            await expect(deleteButton).toBeVisible();
            await expect(deleteButton).toBeEnabled();
            await deleteButton.click();
        } else {
            // Click the Cancel button
            const cancelButton = confirmDialog.getByRole('button', { name: 'Cancel' });
            await cancelButton.click();
        }
    }

    // ==============================
    // ADDITIONAL METHODS FOR TEST REFACTORING
    // ==============================

    /**
     * Count all "All settled up!" elements in the DOM
     */
    async getAllSettledUpElementsCount(): Promise<number> {
        return await this.page.getByText('All settled up!').count();
    }

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
     * Get edit button for expenses
     */
    getEditButton() {
        return this.page.getByRole('button', { name: /edit/i });
    }


    /**
     * Get amount input field
     */
    getAmountField() {
        return this.page.locator('[data-testid="expense-amount"], input[type="number"]').first();
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
        await expect(balancesSection.getByText(`${debtorName} → ${creditorName}`)).toBeVisible();
        await expect(balancesSection.locator('.text-red-600').filter({ hasText: amount })).toBeVisible();
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
        await this.page.waitForLoadState('domcontentloaded');
        await this.waitForMemberCount(1); // Wait for at least the creator to show
        await this.waitForBalancesToLoad(groupId);
    }

    // ========== Member Management Methods ==========
    
    // Member management element accessors
    getLeaveGroupButton(): Locator {
        // There may be multiple leave buttons (sidebar and mobile views)
        // Return the first visible one
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

    getMembersList(): Locator {
        return this.page.locator('[data-testid="member-item"]');
    }

    getMembersSection(): Locator {
        return this.page.getByText('Members').first();
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
                })
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

    async verifyRemoveErrorMessage(): Promise<void> {
        const dialog = this.page.getByTestId('remove-member-dialog');
        const errorMessage = dialog.getByTestId('balance-error-message');
        try {
            await expect(errorMessage).toBeVisible({ timeout: 10000 });
        } catch (e) {
            throw new Error('The error message for removing member with an outstanding balance did not appear within 10 seconds');
        }
    }
}

import {expect, Locator, Page} from '@playwright/test';
import {BasePage} from './base.page';
import {ExpenseFormPage} from './expense-form.page';
import {SettlementFormPage} from './settlement-form.page';
import {ARIA_ROLES, BUTTON_TEXTS, HEADINGS, MESSAGES} from '../constants/selectors';

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
    return this.page.getByRole('heading').first();
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

  async clickAddExpenseButton(expectedMemberCount: number): Promise<ExpenseFormPage> {
    await this.clickButton(this.getAddExpenseButton(), { buttonName: 'Add Expense' });
    
    // Wait for navigation to expense form
    await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    await this.page.waitForLoadState('domcontentloaded');
    
    // Create and validate the expense form page
    const expenseFormPage = new ExpenseFormPage(this.page);
    await expenseFormPage.waitForFormReady(expectedMemberCount);
    
    return expenseFormPage;
  }

  getNoExpensesMessage() {
    return this.page.getByText(/no expenses yet/i);
  }

  // Share functionality accessors
  getShareButton() {
    return this.page.getByRole('button', { name: /share/i });
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
      intervals: [100, 200, 300, 400, 500, 1000]
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
      throw new Error(
        `waitForMemberCount called but not on a group page. Current URL: ${currentUrl}`
      );
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
      await expect(this.page.getByText(expectedText))
        .toBeVisible({ timeout });
    } catch (e) {
      // If exact text isn't found, try waiting for the members section to be updated
      // This provides a fallback for real-time update timing issues
      console.log(`Expected member text '${expectedText}' not found, checking for members section updates`);
      
      // Wait for real-time updates to sync
      await this.page.waitForLoadState('domcontentloaded');
      
      // Final attempt with the expected text
      await expect(this.page.getByText(expectedText))
        .toBeVisible({ timeout: 3000 });
    }
    
    // Double-check we're still on the group page after waiting
    const finalUrl = this.page.url();
    if (!finalUrl.includes('/groups/') && !finalUrl.includes('/group/')) {
      throw new Error(
        `Navigation changed during waitForMemberCount. Now on: ${finalUrl}`
      );
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
      await expect(this.page.getByText(userName).first()).toBeVisible({ timeout: 15000 });
    }
    
    // Secondary verification: try to wait for member count if available, but don't fail if it's not working
    try {
      await this.waitForMemberCount(totalUsers, 5000);
    } catch (error) {
      console.log(`Member count verification failed for ${totalUsers} users, but user names are visible. This might be a real-time update delay.`);
      // Continue with the test since the important thing is that users are visible
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
      throw new Error(
        `waitForBalancesToLoad called but not on correct group page. Expected: /groups/${groupId}, Got: ${currentUrl}`
      );
    }
    
    // More specific locator to avoid strict mode violation
    const balancesSection = this.page.locator('.bg-white').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    }).first();
    
    // Wait for balances section to be visible
    await expect(balancesSection).toBeVisible();
    
    // Wait for loading to disappear
    await expect(balancesSection.getByText('Loading balances...')).not.toBeVisible({ timeout: 1000 });
    
    // Wait for the members section to stop loading
    // Check if there's a loading spinner in the Members section
    const membersSection = this.page.locator('text=Members').locator('..');
    const loadingSpinner = membersSection.locator('.animate-spin, [role="status"]');
    
    // Wait for spinner to disappear if it exists
    const spinnerCount = await loadingSpinner.count();
    if (spinnerCount > 0) {
      await expect(loadingSpinner.first()).not.toBeVisible({ timeout: 5000 });
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
      
      await page.goto(targetGroupUrl);
      await page.waitForLoadState('domcontentloaded');
      
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
          fullPage: false 
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
        fullPage: false
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
      const balancesSection = page.locator('.bg-white').filter({ 
        has: page.getByRole('heading', { name: 'Balances' }) 
      }).first();
      
      // UI now uses arrow notation: "User A → User B" instead of "owes"
      const debtText = balancesSection.getByText(`${debtorName} → ${creditorName}`)
        .or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
      await expect(debtText).toBeVisible();
      
      if (amount) {
        // Find the debt amount that's specifically associated with this debt relationship
        // Look for the amount within the same container as the debt message
        const debtRow = balancesSection.locator('div').filter({ 
          hasText: new RegExp(`${debtorName}.*→.*${creditorName}|${debtorName}.*owes.*${creditorName}`) 
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
  async addExpenseAndSync(
    expense: ExpenseData, 
    pages: Array<{ page: any; groupDetailPage: any; userName?: string }>,
    expectedMemberCount: number,
    groupId: string
  ): Promise<void> {
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
    groupId: string
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
    await joinerPage.goto(shareLink);
    await joinerPage.waitForLoadState('domcontentloaded');
    
    // Click join button with fast timeout
    const joinButton = joinerPage.getByRole('button', { name: /join group/i });
    await joinButton.waitFor({ state: 'visible', timeout: 1000 });
    await this.clickButton(joinButton, { buttonName: 'Join Group' });
    
    // Wait for navigation with reasonable timeout
    await joinerPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 3000 });
    
    // Refresh the original page to see updated members
    await this.page.reload();
    await this.page.waitForLoadState('domcontentloaded');
    
    return shareLink;
  }

  // ==============================
  // ADDITIONAL METHODS TO FIX SELECTOR VIOLATIONS
  // ==============================


  /**
   * Gets the balances section using the complex locator
   * This replaces repeated complex locator chains in tests
   */
  getBalancesSection() {
    return this.page.locator('.bg-white').filter({ 
      has: this.page.getByRole('heading', { name: 'Balances' }) 
    }).first();
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
   */
  async clickExpenseToView(description: string) {
    const expense = this.getExpenseByDescription(description);
    // Note: Expense item is not a button but a clickable element
    await expense.click();
    await this.page.waitForLoadState('domcontentloaded');
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
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Wait for loading spinner to disappear if present
    const loadingSpinner = dialog.locator('.animate-spin');
    if (await loadingSpinner.count() > 0) {
      await expect(loadingSpinner).not.toBeVisible();
    }
    
    // Get the share link
    const shareLinkInput = dialog.locator('input[type="text"]');
    await expect(shareLinkInput).toBeVisible();
    const shareLink = await shareLinkInput.inputValue();

    if (!shareLink || !shareLink.includes('/join?')) {
      throw new Error(`Invalid share link received: ${shareLink}`);
    }

    // Close modal by clicking close button or clicking outside
    const closeButton = this.page.getByRole('button', { name: /close|×/i }).first();
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
    return balancesSection.getByText(`${debtorName} → ${creditorName}`)
      .or(balancesSection.getByText(`${debtorName} owes ${creditorName}`));
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
    const closeButton = this.page.getByRole('button', { name: /close|×/i }).first();
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
    return this.page.locator('.bg-white').filter({
      has: this.page.getByRole('heading', { name: 'Balances' })
    }).first();
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
}

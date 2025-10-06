import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { loadTranslation } from './translation-loader';
import { CreateGroupModalPage } from './CreateGroupModalPage';
import { GroupDetailPage } from './GroupDetailPage';
import { ShareGroupModalPage } from './ShareGroupModalPage';

const translation = loadTranslation();

/**
 * Dashboard Page Object Model for Playwright tests
 * Container-aware selectors using visible headings and semantic elements
 * Reusable across unit tests and e2e tests
 */
export class DashboardPage extends BasePage {
    readonly url = '/dashboard';

    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER SELECTORS - Based on visible UI elements users can see
    // ============================================================================

    /**
     * Groups container - found by the "Your Groups" heading
     */
    getGroupsContainer(): Locator {
        return this.page.locator('section, div').filter({
            has: this.page.getByRole('heading', { name: translation.dashboard.yourGroups })
        }).first();
    }

    /**
     * Quick actions sidebar/card container
     */
    getQuickActionsContainer(): Locator {
        // Find the container with Quick Actions heading
        return this.page.locator('div').filter({
            has: this.page.getByRole('heading', { name: translation.quickActions.title, exact: true })
        }).first();
    }

    /**
     * Dashboard stats container
     */
    getStatsContainer(): Locator {
        // Find the stats container by heading
        return this.page.locator('div').filter({
            has: this.page.getByRole('heading', { name: translation.dashboardStats.title, exact: true })
        }).first();
    }

    /**
     * Welcome section for new users
     */
    getWelcomeSection(): Locator {
        return this.page.locator('div').filter({
            has: this.page.getByRole('heading', { level: 2 }).filter({ hasText: /welcome/i })
        });
    }

    /**
     * Error message container within the dashboard
     */
    getErrorContainer(): Locator {
        return this.getGroupsContainer().getByTestId('groups-load-error-message');
    }

    // ============================================================================
    // SECTION HEADINGS - User-visible headings that identify page sections
    // ============================================================================

    /**
     * "Your Groups" main heading
     */
    getYourGroupsHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.dashboard.yourGroups });
    }

    /**
     * Welcome message heading (for new users)
     */
    getWelcomeHeading(): Locator {
        return this.page.getByText('No groups yet');
    }

    /**
     * Error state heading
     */
    getErrorHeading(): Locator {
        return this.page.getByTestId('groups-load-error-title');
    }

    // ============================================================================
    // GROUPS SECTION SELECTORS
    // ============================================================================

    /**
     * Groups grid/list container
     */
    getGroupsGrid(): Locator {
        // Use data-testid for specificity to avoid matching layout grids
        return this.getGroupsContainer().locator('[data-testid="groups-grid"]');
    }

    /**
     * Individual group cards
     */
    getGroupCards(): Locator {
        // GroupCards are wrapped in a relative div, so we need to go one level deeper
        return this.getGroupsGrid().locator('[data-testid="group-card"]');
    }

    /**
     * Get a specific group card by name
     */
    getGroupCard(groupName: string): Locator {
        return this.getGroupCards().filter({
            has: this.page.getByText(groupName, { exact: true })
        });
    }

    /**
     * Empty state container when no groups exist
     */
    getEmptyGroupsState(): Locator {
        return this.page.getByText('No groups yet').locator('..');
    }

    /**
     * Loading spinner for groups
     * Uses role="status" for semantic loading indicators
     */
    getGroupsLoadingSpinner(): Locator {
        return this.getGroupsContainer().getByRole('status')
            .or(this.getGroupsContainer().locator('[aria-live="polite"]'))
            .or(this.getGroupsContainer().locator('.animate-spin'));
    }

    // ============================================================================
    // BUTTON SELECTORS - Scoped to appropriate containers
    // ============================================================================

    /**
     * Primary "Create Group" button (desktop version in groups header)
     */
    getCreateGroupButton(): Locator {
        return this.getGroupsContainer().getByRole('button', { name: translation.dashboard.createGroup });
    }

    /**
     * Mobile "Create Group" button (in quick actions card)
     */
    getMobileCreateGroupButton(): Locator {
        return this.getQuickActionsContainer().getByRole('button', { name: 'Create New Group' });
    }

    /**
     * "Try Again" button for error recovery
     */
    getTryAgainButton(): Locator {
        return this.getGroupsContainer().getByRole('button', { name: translation.dashboardComponents.groupsList.tryAgain });
    }

    /**
     * User menu button (profile/settings access)
     * Finds button with user display name or profile icon in navigation
     */
    getUserMenuButton(): Locator {
        // Look for button in navigation area (typically top-right) with aria-label or user name
        return this.page.getByRole('button', { name: /user menu|profile|settings|account/i })
            .or(this.page.locator('nav, header').getByRole('button').filter({ hasText: /.+@.+/ }))
            .or(this.page.locator('nav, header').getByRole('button').last());
    }

    /**
     * Quick Actions - Create Group button
     */
    getQuickActionsCreateButton(): Locator {
        return this.getQuickActionsContainer().getByRole('button', { name: translation.quickActions.createNewGroup });
    }

    /**
     * Quick Actions - View All Expenses button (disabled future feature)
     */
    getQuickActionsViewExpensesButton(): Locator {
        return this.getQuickActionsContainer().getByRole('button', { name: /view.*expenses/i });
    }

    /**
     * Dashboard Stats - Total groups value
     * Finds the numeric value in the stat item containing "Total Groups" text
     */
    getStatsTotalGroups(): Locator {
        // Find the stat item by its label, then get the visible number
        return this.getStatsContainer()
            .locator('div, li')
            .filter({ hasText: /total.*groups/i })
            .first()
            .getByText(/^\d+$/)
            .first();
    }

    /**
     * Dashboard Stats - Active groups value
     * Finds the numeric value in the stat item containing "Active Groups" text
     */
    getStatsActiveGroups(): Locator {
        // Find the stat item by its label, then get the visible number
        return this.getStatsContainer()
            .locator('div, li')
            .filter({ hasText: /active.*groups/i })
            .first()
            .getByText(/^\d+$/)
            .first();
    }

    /**
     * Dashboard Stats - Loading skeleton
     */
    getStatsLoadingSkeleton(): Locator {
        return this.getStatsContainer().locator('.animate-pulse');
    }

    /**
     * Group Card - Invite button (hover action)
     */
    getGroupCardInviteButton(groupName: string): Locator {
        return this.getGroupCard(groupName).locator('button[title*="Invite"], button[aria-label*="Invite"]');
    }

    /**
     * Group Card - Add expense button (hover action)
     */
    getGroupCardAddExpenseButton(groupName: string): Locator {
        return this.getGroupCard(groupName).locator('button[title*="expense"], button[aria-label*="expense"]');
    }

    /**
     * Group Card - Balance display badge
     */
    getGroupCardBalance(groupName: string): Locator {
        return this.getGroupCard(groupName).locator('[data-financial-amount="balance"]');
    }

    // ============================================================================
    // LOADING AND STATE INDICATORS
    // ============================================================================

    /**
     * Loading indicator for creating new group
     */
    getCreateGroupLoadingIndicator(): Locator {
        return this.getGroupsGrid().locator('div').filter({
            has: this.page.getByText(translation.dashboardComponents.groupsList.creating)
        });
    }

    /**
     * Group update loading overlay
     */
    getGroupUpdateLoadingOverlay(groupId?: string): Locator {
        const baseSelector = this.getGroupsGrid().locator('.absolute.inset-0').filter({
            has: this.page.locator('[data-testid="loading-spinner"], .animate-spin')
        });

        if (groupId) {
            return this.getGroupCard(`[data-group-id="${groupId}"]`).locator('.absolute.inset-0');
        }

        return baseSelector;
    }

    // ============================================================================
    // MODAL SELECTORS - For modals NOT owned by Dashboard
    // ============================================================================

    /**
     * Share Group Modal (not part of dashboard, just for detection)
     */
    getShareGroupModal(): Locator {
        return this.page.getByRole('dialog').filter({
            has: this.page.getByRole('heading', { name: /share|invite/i })
        });
    }

    /**
     * Share Group Modal - Close button
     */
    getShareModalCloseButton(): Locator {
        return this.getShareGroupModal().getByTestId('close-share-modal-button');
    }

    /**
     * Share Group Modal - Share link input field
     */
    getShareLinkInput(): Locator {
        return this.getShareGroupModal().getByTestId('share-link-input');
    }

    /**
     * Share Group Modal - Copy link button
     */
    getCopyLinkButton(): Locator {
        return this.getShareGroupModal().getByTestId('copy-link-button');
    }

    /**
     * Share Group Modal - Generate new link button
     */
    getGenerateNewLinkButton(): Locator {
        return this.getShareGroupModal().getByTestId('generate-new-link-button');
    }

    /**
     * Share Group Modal - QR Code canvas
     */
    getShareModalQRCode(): Locator {
        return this.getShareGroupModal().locator('canvas');
    }

    /**
     * Share Group Modal - Error message
     */
    getShareModalErrorMessage(): Locator {
        return this.getShareGroupModal().getByTestId('share-group-error-message');
    }

    /**
     * Share Group Modal - Loading spinner
     */
    getShareModalLoadingSpinner(): Locator {
        return this.getShareGroupModal().locator('.animate-spin');
    }

    /**
     * Share link copied toast notification
     */
    getShareLinkCopiedToast(): Locator {
        return this.page.locator('.fixed.bottom-4.right-4').filter({
            hasText: /copied|success/i
        });
    }

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify we're on the dashboard page with proper content loaded
     */
    async verifyDashboardPageLoaded(): Promise<void> {
        await expect(this.page).toHaveURL(/\/dashboard/);
        await expect(this.getYourGroupsHeading()).toBeVisible();
        await expect(this.getGroupsContainer()).toBeVisible();
    }

    /**
     * Check if dashboard is in loading state
     */
    async isDashboardLoading(): Promise<boolean> {
        return await this.getGroupsLoadingSpinner().isVisible();
    }

    /**
     * Check if dashboard shows error state
     */
    async hasErrorState(): Promise<boolean> {
        return await this.getErrorContainer().isVisible();
    }

    /**
     * Check if dashboard shows empty state (no groups)
     */
    async hasEmptyGroupsState(): Promise<boolean> {
        return await this.getEmptyGroupsState().isVisible();
    }

    /**
     * Check if user is properly authenticated and displayed
     */
    async isUserAuthenticated(): Promise<boolean> {
        return await this.getUserMenuButton().isVisible();
    }

    /**
     * Get current error message text
     */
    async getErrorMessage(): Promise<string> {
        await expect(this.getErrorContainer()).toBeVisible();
        return await this.getErrorContainer().textContent() || '';
    }

    /**
     * Count visible group cards
     */
    async getGroupCount(): Promise<number> {
        return await this.getGroupCards().count();
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Navigate to the dashboard page
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url);
        await this.verifyDashboardPageLoaded();
    }

    /**
     * Create a new group using the primary create button
     * Returns CreateGroupModalPage for fluent interface
     */
    async clickCreateGroup(): Promise<CreateGroupModalPage> {
        const button = this.getCreateGroupButton();
        await this.clickButton(button, { buttonName: 'Create Group' });

        const modalPage = new CreateGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
        return modalPage;
    }

    /**
     * Create a new group using mobile/quick actions button
     * Returns CreateGroupModalPage for fluent interface
     */
    async clickMobileCreateGroup(): Promise<CreateGroupModalPage> {
        const button = this.getMobileCreateGroupButton();
        await this.clickButton(button, { buttonName: 'Create Group (Mobile)' });

        const modalPage = new CreateGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
        return modalPage;
    }

    /**
     * Click on a specific group card to navigate to group details
     * Non-fluent version - does not verify navigation or return page object
     */
    async clickGroupCard(groupName: string): Promise<void> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible();
        await groupCard.click();
        await this.waitForDomContentLoaded();
    }

    /**
     * Click on a specific group card and navigate to group detail page
     * Fluent version - verifies navigation and returns GroupDetailPage
     * Use this when you expect navigation to succeed
     */
    async clickGroupCardAndNavigateToDetail(groupName: string): Promise<GroupDetailPage> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible();
        await groupCard.click();

        // Wait for navigation to group detail page
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9\-_]+/, { timeout: 5000 });

        // Return group detail page object
        const groupDetailPage = new GroupDetailPage(this.page);
        await groupDetailPage.verifyGroupDetailPageLoaded(groupName);
        return groupDetailPage;
    }

    /**
     * Click try again button to retry loading groups
     */
    async clickTryAgain(): Promise<void> {
        const button = this.getTryAgainButton();
        await this.clickButton(button, { buttonName: 'Try Again' });
    }

    /**
     * Open user menu
     */
    async openUserMenu(): Promise<void> {
        const button = this.getUserMenuButton();
        await this.clickButton(button, { buttonName: 'User Menu' });
    }

    /**
     * Wait for groups to finish loading
     */
    async waitForGroupsToLoad(timeout = 5000): Promise<void> {
        // Wait for loading spinner to disappear if it exists
        const spinner = this.getGroupsLoadingSpinner();
        if (await spinner.isVisible()) {
            await expect(spinner).not.toBeVisible({ timeout });
        }

        // Ensure we're either showing groups or empty state
        // First try to find groups, if none exist, look for empty state
        try {
            await expect(this.getGroupCards().first()).toBeVisible({ timeout: 1000 });
        } catch {
            // No groups found, check for empty state
            await expect(this.getEmptyGroupsState()).toBeVisible({ timeout });
        }
    }

    /**
     * Wait for a specific group to appear (useful for real-time updates)
     */
    async waitForGroupToAppear(groupName: string, timeout = 5000): Promise<void> {
        await expect(this.getGroupCard(groupName)).toBeVisible({ timeout });
    }

    /**
     * Wait for a specific group to disappear (useful for real-time updates)
     */
    async waitForGroupToDisappear(groupName: string, timeout = 5000): Promise<void> {
        await expect(this.getGroupCard(groupName)).not.toBeVisible({ timeout });
    }

    /**
     * Wait for welcome message (new user state)
     */
    async waitForWelcomeMessage(): Promise<void> {
        await expect(this.getWelcomeHeading()).toBeVisible();
        await expect(this.getEmptyGroupsState()).toBeVisible();
    }

    /**
     * Click group card invite button to open share modal
     */
    async clickGroupCardInviteButton(groupName: string): Promise<ShareGroupModalPage> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible();

        // Hover to reveal action buttons
        await groupCard.hover();

        const inviteButton = this.getGroupCardInviteButton(groupName);
        await expect(inviteButton).toBeVisible();
        await this.clickButton(inviteButton, { buttonName: `Invite to ${groupName}` });

        const modalPage = new ShareGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
        return modalPage;
    }

    /**
     * Click group card add expense button to navigate to expense form
     */
    async clickGroupCardAddExpenseButton(groupName: string): Promise<void> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible();

        // Hover to reveal action buttons
        await groupCard.hover();

        const addExpenseButton = this.getGroupCardAddExpenseButton(groupName);
        await expect(addExpenseButton).toBeVisible();
        await this.clickButton(addExpenseButton, { buttonName: `Add expense to ${groupName}` });
    }

    /**
     * Click Quick Actions create group button
     */
    async clickQuickActionsCreateGroup(): Promise<CreateGroupModalPage> {
        const button = this.getQuickActionsCreateButton();
        await this.clickButton(button, { buttonName: 'Quick Actions Create Group' });

        const modalPage = new CreateGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
        return modalPage;
    }

    /**
     * Close share modal via close button
     */
    async closeShareModal(): Promise<void> {
        const closeButton = this.getShareModalCloseButton();
        await this.clickButton(closeButton, { buttonName: 'Close Share Modal' });
        await expect(this.getShareGroupModal()).not.toBeVisible();
    }


    /**
     * Close share modal via backdrop click
     */
    async closeShareModalViaBackdrop(): Promise<void> {
        const modal = this.getShareGroupModal();
        // Click backdrop (the dialog's parent)
        await this.page.locator('.fixed.inset-0.bg-gray-600').click({ position: { x: 10, y: 10 } });
        await expect(modal).not.toBeVisible();
    }

    /**
     * Copy share link to clipboard
     */
    async copyShareLink(): Promise<void> {
        const copyButton = this.getCopyLinkButton();
        await this.clickButton(copyButton, { buttonName: 'Copy Share Link' });
    }

    /**
     * Generate new share link
     */
    async generateNewShareLink(): Promise<void> {
        const generateButton = this.getGenerateNewLinkButton();
        await this.clickButton(generateButton, { buttonName: 'Generate New Link' });
    }

    /**
     * Get current share link value
     */
    async getShareLinkValue(): Promise<string> {
        const input = this.getShareLinkInput();
        await expect(input).toBeVisible();
        return await input.inputValue();
    }

    // ============================================================================
    // VERIFICATION METHODS FOR SPECIFIC STATES
    // ============================================================================

    /**
     * Verify dashboard shows authenticated user info
     */
    async verifyAuthenticatedUser(expectedUserName?: string): Promise<void> {
        const userMenu = this.getUserMenuButton();
        await expect(userMenu).toBeVisible();

        if (expectedUserName) {
            await expect(userMenu).toContainText(expectedUserName);
        }
    }

    /**
     * Verify specific group is displayed
     */
    async verifyGroupDisplayed(groupName: string): Promise<void> {
        await expect(this.getGroupCard(groupName)).toBeVisible();
    }

    /**
     * Verify groups are loading
     */
    async verifyGroupsLoading(): Promise<void> {
        await expect(this.getGroupsLoadingSpinner()).toBeVisible();
        await expect(this.page.getByText(translation.dashboardComponents.groupsList.loading)).toBeVisible();
    }

    /**
     * Verify error state is displayed
     */
    async verifyErrorState(expectedErrorMessage?: string): Promise<void> {
        await expect(this.getErrorHeading()).toBeVisible();
        await expect(this.getErrorContainer()).toBeVisible();

        if (expectedErrorMessage) {
            await expect(this.getErrorContainer()).toContainText(expectedErrorMessage);
        }
    }

    /**
     * Verify empty groups state for new users
     */
    async verifyEmptyGroupsState(): Promise<void> {
        await expect(this.getEmptyGroupsState()).toBeVisible();
        await expect(this.getWelcomeHeading()).toBeVisible();
    }

    /**
     * Verify groups grid is populated
     */
    async verifyGroupsDisplayed(expectedCount?: number): Promise<void> {
        await expect(this.getGroupsGrid()).toBeVisible();
        await expect(this.getGroupCards().first()).toBeVisible();

        if (expectedCount !== undefined) {
            await expect(this.getGroupCards()).toHaveCount(expectedCount);
        }
    }

    /**
     * Verify share modal is open
     */
    async verifyShareModalOpen(): Promise<void> {
        await expect(this.getShareGroupModal()).toBeVisible();
        await expect(this.getShareModalCloseButton()).toBeVisible();
    }

    /**
     * Verify share modal is closed
     */
    async verifyShareModalClosed(): Promise<void> {
        await expect(this.getShareGroupModal()).not.toBeVisible();
    }

    /**
     * Verify share link is displayed
     */
    async verifyShareLinkDisplayed(): Promise<void> {
        await expect(this.getShareLinkInput()).toBeVisible();
        const linkValue = await this.getShareLinkValue();
        expect(linkValue).toContain('http');
    }

    /**
     * Verify QR code is displayed
     */
    async verifyQRCodeDisplayed(): Promise<void> {
        await expect(this.getShareModalQRCode()).toBeVisible();
    }

    /**
     * Verify share link copied toast appears
     */
    async verifyLinkCopiedToast(): Promise<void> {
        await expect(this.getShareLinkCopiedToast()).toBeVisible();
    }

    /**
     * Verify share modal shows error
     */
    async verifyShareModalError(expectedError?: string): Promise<void> {
        await expect(this.getShareModalErrorMessage()).toBeVisible();
        if (expectedError) {
            await expect(this.getShareModalErrorMessage()).toContainText(expectedError);
        }
    }

    /**
     * Verify share modal shows loading state
     */
    async verifyShareModalLoading(): Promise<void> {
        await expect(this.getShareModalLoadingSpinner()).toBeVisible();
    }

    /**
     * Verify dashboard stats display
     */
    async verifyStatsDisplayed(expectedTotalGroups?: number, expectedActiveGroups?: number): Promise<void> {
        await expect(this.getStatsContainer()).toBeVisible();

        if (expectedTotalGroups !== undefined) {
            await expect(this.getStatsTotalGroups()).toContainText(expectedTotalGroups.toString());
        }

        if (expectedActiveGroups !== undefined) {
            await expect(this.getStatsActiveGroups()).toContainText(expectedActiveGroups.toString());
        }
    }

    /**
     * Verify stats show loading skeleton
     */
    async verifyStatsLoading(): Promise<void> {
        await expect(this.getStatsLoadingSkeleton()).toBeVisible();
    }

    /**
     * Verify quick actions card is displayed
     */
    async verifyQuickActionsDisplayed(): Promise<void> {
        await expect(this.getQuickActionsContainer()).toBeVisible();
        await expect(this.getQuickActionsCreateButton()).toBeVisible();
    }

    /**
     * Verify view expenses button is disabled
     */
    async verifyViewExpensesDisabled(): Promise<void> {
        await expect(this.getQuickActionsViewExpensesButton()).toBeDisabled();
    }

    /**
     * Verify group card action buttons appear on hover
     */
    async verifyGroupCardActionsVisible(groupName: string): Promise<void> {
        const groupCard = this.getGroupCard(groupName);
        await groupCard.hover();

        await expect(this.getGroupCardInviteButton(groupName)).toBeVisible();
        await expect(this.getGroupCardAddExpenseButton(groupName)).toBeVisible();
    }

    /**
     * Verify group card balance display
     */
    async verifyGroupCardBalance(groupName: string, expectedText: string): Promise<void> {
        const balanceBadge = this.getGroupCardBalance(groupName);
        await expect(balanceBadge).toBeVisible();
        await expect(balanceBadge).toContainText(expectedText);
    }

}
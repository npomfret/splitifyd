import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { loadTranslation } from './translation-loader';
import { CreateGroupModalPage } from './CreateGroupModalPage';
import { GroupDetailPage } from './GroupDetailPage';

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
     * Groups container - contains all group-related content
     */
    getGroupsContainer(): Locator {
        return this.page.getByTestId('groups-container');
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
        return this.getGroupsContainer().locator('.grid, [data-testid="groups-grid"]');
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
     */
    getGroupsLoadingSpinner(): Locator {
        return this.getGroupsContainer().locator('[data-testid="loading-spinner"], .animate-spin');
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
     */
    getUserMenuButton(): Locator {
        return this.page.getByTestId('user-menu-button');
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

}
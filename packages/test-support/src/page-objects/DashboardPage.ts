import { expect, Locator, Page } from '@playwright/test';
import type { GroupName } from '@splitifyd/shared';
import { TEST_ROUTES, TEST_TIMEOUTS } from '../test-constants';
import { generateShortId, randomString } from '../test-helpers';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { CreateGroupModalPage } from './CreateGroupModalPage';
import { GroupDetailPage } from './GroupDetailPage';
import { HeaderPage } from './HeaderPage';
import { JoinGroupPage } from './JoinGroupPage';
import { ShareGroupModalPage } from './ShareGroupModalPage';

const translation = translationEn;
let multiUserGroupCounter = 0;

/**
 * Dashboard Page Object Model for Playwright tests
 * Container-aware selectors using visible headings and semantic elements
 * Reusable across unit tests and e2e tests
 */
export class DashboardPage extends BasePage {
    readonly url = '/dashboard';
    private _header?: HeaderPage;

    constructor(page: Page) {
        super(page);
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

    // ============================================================================
    // CONTAINER SELECTORS - Based on visible UI elements users can see
    // ============================================================================

    /**
     * Groups container - found by the "Your Groups" heading
     */
    protected getGroupsContainer(): Locator {
        return this
            .page
            .locator('section, div')
            .filter({
                has: this.page.getByRole('heading', { name: translation.dashboard.yourGroups }),
            })
            .first();
    }

    /**
     * Activity feed card container
     */
    private getActivityFeedContainer(): Locator {
        return this.page.locator('[data-testid="activity-feed-card"]:visible').first();
    }

    /**
     * Error message container within the dashboard
     */
    protected getErrorContainer(): Locator {
        return this.getGroupsContainer().getByTestId('groups-load-error-message');
    }

    // ============================================================================
    // SECTION HEADINGS - User-visible headings that identify page sections
    // ============================================================================

    /**
     * "Your Groups" main heading
     */
    protected getYourGroupsHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.dashboard.yourGroups });
    }

    /**
     * Welcome message heading (for new users)
     */
    protected getWelcomeHeading(): Locator {
        return this.page.getByText('No groups yet');
    }

    /**
     * Error state heading
     */
    protected getErrorHeading(): Locator {
        return this.page.getByTestId('groups-load-error-title');
    }

    // ============================================================================
    // GROUPS SECTION SELECTORS
    // ============================================================================

    /**
     * Groups grid/list container
     */
    protected getGroupsGrid(): Locator {
        // Use data-testid for specificity to avoid matching layout grids
        return this.getGroupsContainer().locator('[data-testid="groups-grid"]');
    }

    /**
     * Individual group cards
     */
    protected getGroupCards(): Locator {
        // GroupCards are wrapped in a relative div, so we need to go one level deeper
        return this.getGroupsGrid().locator('[data-testid="group-card"]');
    }

    /**
     * Get a specific group card by name
     */
    protected getGroupCard(groupName: GroupName | string): Locator {
        return this.getGroupCards().filter({
            has: this.page.getByText(groupName as string, { exact: true }),
        });
    }

    /**
     * Verify groups grid is visible
     */
    async verifyGroupsGridVisible(): Promise<void> {
        await expect(this.getGroupsGrid()).toBeVisible();
    }

    /**
     * Verify activity feed shows a description string.
     * Used by e2e flows to assert backend-triggered events appear on the dashboard.
     */
    async verifyActivityFeedShows(description: string): Promise<void> {
        await expect(this.getActivityFeedContainer()).toBeVisible();
        const matchingItems = this.getActivityFeedItems().filter({ hasText: description });
        await expect(matchingItems).not.toHaveCount(0);
    }

    /**
     * Verify responsive layout classes are applied to the groups grid
     */
    async verifyGroupsGridResponsiveLayout(): Promise<void> {
        const grid = this.getGroupsGrid();
        await expect(grid).toHaveClass(/grid/);
        await expect(grid).toHaveClass(/grid-cols-1/);
        await expect(grid).toHaveClass(/md:grid-cols-2/);
        await expect(grid).toHaveClass(/xl:grid-cols-3/);
    }

    /**
     * Hover a specific group card by name
     */
    async hoverGroupCard(groupName: GroupName | string): Promise<void> {
        const card = this.getGroupCard(groupName);
        await expect(card).toBeVisible();
        await card.hover();
    }

    async showActiveGroups(): Promise<void> {
        const button = this.getGroupsFilterButton('active');
        await this.clickButton(button, { buttonName: translation.dashboard.groupsFilter.active });
        await this.waitForGroupsToLoad();
    }

    async showArchivedGroups(): Promise<void> {
        const button = this.getGroupsFilterButton('archived');
        await this.clickButton(button, { buttonName: translation.dashboard.groupsFilter.archived });
        await this.waitForGroupsToLoad();
    }

    async verifyGroupHasArchivedBadge(groupName: GroupName | string): Promise<void> {
        const badge = this.getGroupCard(groupName).getByTestId('archived-badge');
        await expect(badge).toBeVisible();
    }

    async verifyGroupHasNoArchiveQuickActions(groupName: GroupName | string): Promise<void> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        const quickActions = groupCard.getByRole('button', { name: /Archive Group|Unarchive Group/ });
        await expect(async () => {
            const count = await quickActions.count();
            if (count !== 0) {
                throw new Error(`Expected no archive or unarchive quick actions for "${groupName}", but found ${count}.`);
            }
        })
            .toPass({
                timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE,
                intervals: [250, 500, 750],
            });
    }

    private getPaginationContainer(): Locator {
        return this.page.getByRole('navigation', { name: 'Pagination' });
    }

    private getPaginationNextButton(): Locator {
        return this.page.getByTestId('pagination-next');
    }

    private getPaginationPreviousButton(): Locator {
        return this.page.getByTestId('pagination-previous');
    }

    private getPaginationNextButtonMobile(): Locator {
        return this.page.getByTestId('pagination-next-mobile');
    }

    private getPaginationPreviousButtonMobile(): Locator {
        return this.page.getByTestId('pagination-previous-mobile');
    }

    async verifyPaginationHidden(): Promise<void> {
        await expect(this.getPaginationContainer()).not.toBeVisible();
    }

    async verifyPaginationVisible(): Promise<void> {
        await expect(this.getPaginationContainer()).toBeVisible();
    }

    async verifyPaginationNextEnabled(): Promise<void> {
        await expect(this.getPaginationNextButton()).toBeEnabled();
    }

    async verifyPaginationNextDisabled(): Promise<void> {
        await expect(this.getPaginationNextButton()).toBeDisabled();
    }

    async verifyPaginationPreviousEnabled(): Promise<void> {
        await expect(this.getPaginationPreviousButton()).toBeEnabled();
    }

    async verifyPaginationPreviousDisabled(): Promise<void> {
        await expect(this.getPaginationPreviousButton()).toBeDisabled();
    }

    async clickPaginationNext(): Promise<void> {
        const button = this.getPaginationNextButton();
        await this.clickButton(button, { buttonName: 'Pagination Next' });
    }

    async clickPaginationPrevious(): Promise<void> {
        const button = this.getPaginationPreviousButton();
        await this.clickButton(button, { buttonName: 'Pagination Previous' });
    }

    clickPaginationNextWithoutWait(): Promise<void> {
        const button = this.getPaginationNextButton();
        return (async () => {
            await expect(button).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
            await this.expectButtonEnabled(button, 'Pagination Next');
            await button.click();
        })();
    }

    async verifyPaginationIndicatorEquals(expectedText: string): Promise<void> {
        // Search entire page for exact text match (page indicator may be outside nav container)
        await expect(this.page.getByText(expectedText, { exact: true })).toBeVisible();
    }

    async verifyPaginationNextMobileEnabled(): Promise<void> {
        await expect(this.getPaginationNextButtonMobile()).toBeEnabled();
    }

    async verifyPaginationPreviousMobileDisabled(): Promise<void> {
        await expect(this.getPaginationPreviousButtonMobile()).toBeDisabled();
    }

    /**
     * Empty state container when no groups exist (internal use)
     */
    private getEmptyGroupsStateInternal(): Locator {
        return this.page.getByText('No groups yet').locator('..');
    }

    /**
     * Get the empty groups state container for external assertions
     */
    getEmptyGroupsState(): Locator {
        return this.getEmptyGroupsStateInternal();
    }

    protected getArchivedEmptyState(): Locator {
        return this.getGroupsContainer().getByTestId('archived-groups-empty-state');
    }

    /**
     * Loading spinner for groups
     * Uses role="status" for semantic loading indicators
     */
    protected getGroupsLoadingSpinner(): Locator {
        return this.getGroupsContainer().getByRole('status');
    }

    protected getGroupsFilterButton(filter: 'active' | 'archived'): Locator {
        const label = translation.dashboard.groupsFilter[filter];
        return this.getGroupsContainer().getByRole('button', { name: label, exact: true });
    }

    // ============================================================================
    // BUTTON SELECTORS - Scoped to appropriate containers
    // ============================================================================

    /**
     * Primary "Create Group" button (desktop version in groups header)
     */
    protected getCreateGroupButton(): Locator {
        return this.getGroupsContainer().getByRole('button', { name: translation.dashboard.createGroup });
    }

    /**
     * "Try Again" button for error recovery
     */
    protected getTryAgainButton(): Locator {
        return this.getGroupsContainer().getByRole('button', { name: translation.dashboardComponents.groupsList.tryAgain });
    }

    /**
     * User menu button (profile/settings access)
     * Button displays user's display name
     */
    protected getUserMenuButton(): Locator {
        return this.page.getByTestId('user-menu-button');
    }

    /**
     * Group Card - Invite button (hover action)
     */
    protected getGroupCardInviteButton(groupName: GroupName | string): Locator {
        return this.getGroupCard(groupName).locator('button[title*="Invite"], button[aria-label*="Invite"]');
    }

    // ============================================================================
    // Note: Modal/Dialog interactions are handled by their respective Page Objects
    // Dashboard only provides methods to open modals and return their page objects
    // Use the returned page object for all modal interactions
    // ============================================================================

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify we're on the dashboard page with proper content loaded
     */
    async verifyDashboardPageLoaded(): Promise<void> {
        try {
            await expect(this.page).toHaveURL(TEST_ROUTES.DASHBOARD, { timeout: TEST_TIMEOUTS.NAVIGATION });
            await expect(this.getYourGroupsHeading()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        } catch (error) {
            const currentUrl = this.page.url();
            throw new Error(`Dashboard page failed to load. Expected URL: ${TEST_ROUTES.DASHBOARD}, Actual URL: ${currentUrl}`);
        }
    }

    /**
     * Wait for dashboard content to stabilise after navigation or mutations.
     */
    async waitForDashboard(): Promise<void> {
        await this.verifyDashboardPageLoaded();

        try {
            const loadingSpinner = this.getGroupsLoadingSpinner();
            await loadingSpinner.waitFor({ state: 'hidden', timeout: 3000 });
        } catch {
            // Spinner never appeared or disappeared quickly - both cases are acceptable.
        }

        await expect(async () => {
            const hasGroupsContainer = await this
                .getGroupsContainer()
                .isVisible()
                .catch(() => false);
            const hasEmptyState = await this
                .getEmptyGroupsStateInternal()
                .isVisible()
                .catch(() => false);
            const hasErrorState = await this
                .getErrorContainer()
                .isVisible()
                .catch(() => false);
            const hasLoadingSpinner = await this
                .getGroupsLoadingSpinner()
                .isVisible()
                .catch(() => false);

            if (!hasGroupsContainer && !hasEmptyState && !hasErrorState && !hasLoadingSpinner) {
                throw new Error('Groups content not yet loaded - waiting for groups container, empty state, error state, or loading spinner');
            }
        })
            .toPass({
                timeout: 5000,
                intervals: [100, 250, 500],
            });

        await this.waitForDomContentLoaded();
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
     * Create a new group and navigate to its detail page.
     */
    async createGroupAndNavigate(name: string = generateShortId(), description: string = generateShortId()): Promise<GroupDetailPage> {
        if (!this.page.url().includes(this.url)) {
            await this.navigate();
        } else {
            await this.waitForDashboard();
        }

        const createGroupModal = await this.clickCreateGroup();
        await createGroupModal.verifyModalVisible({ timeout: 5000 });
        await createGroupModal.createGroup(name, description);

        // Wait for modal to close and navigation to occur
        await createGroupModal.verifyModalNotVisible({ timeout: 5000 });

        await this.expectUrl(GroupDetailPage.groupDetailUrlPattern());

        await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {
            // Ignore failures if DOM finished loading earlier.
        });

        await expect(this.page.getByRole('heading', { name })).toBeVisible();

        const groupDetailPage = new GroupDetailPage(this.page);
        const groupId = groupDetailPage.inferGroupId();

        await expect(this.page).toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId), { timeout: TEST_TIMEOUTS.NAVIGATION });

        await groupDetailPage.waitForPage(groupId, 1);

        return groupDetailPage;
    }

    /**
     * Create a new group using the primary create button
     * Returns CreateGroupModalPage for fluent interface
     */
    async clickCreateGroup(): Promise<CreateGroupModalPage> {
        const button = this.getCreateGroupButton();
        const modalPage = new CreateGroupModalPage(this.page);

        // Verify modal is NOT open before we click (establishes baseline state)
        await modalPage.verifyModalNotVisible();

        // Verify button exists and is visible before clicking
        await expect(button).toBeVisible({ timeout: 2000 });
        await expect(button).toBeEnabled({ timeout: 1000 });

        // Use clickButtonNoWait since opening a modal doesn't trigger navigation
        // This avoids the unnecessary waitForDomContentLoaded() that can delay modal state updates
        await this.clickButtonNoWait(button, { buttonName: 'Create Group' });

        // Wait for modal to be fully open and ready for interaction
        // waitForModalToOpen now waits for inputs to be editable, which ensures
        // the modal is stable and won't close unexpectedly
        try {
            await modalPage.waitForModalToOpen();
        } catch (error) {
            // Capture detailed page state when modal fails to open
            const url = this.page.url();
            const visibleButtons = await this.page.locator('button:visible').evaluateAll(
                (buttons) => buttons.map((b) => b.textContent?.trim()).filter(Boolean),
            );
            const dialogs = await this.page.locator('[role="dialog"]').count();
            const modalVisible = await modalPage.isModalVisible();

            throw new Error(
                `Create Group modal failed to open after clicking button.\n`
                    + `Current URL: ${url}\n`
                    + `Dialogs in DOM: ${dialogs}\n`
                    + `Modal visible now: ${modalVisible}\n`
                    + `Visible buttons: ${JSON.stringify(visibleButtons)}\n`
                    + `Original error: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return modalPage;
    }

    /**
     * Click on a specific group card to navigate to group details
     * Non-fluent version - does not verify navigation or return page object
     */
    async clickGroupCard(groupName: GroupName | string): Promise<void> {
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
    async clickGroupCardAndNavigateToDetail(groupName: GroupName | string): Promise<GroupDetailPage> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await groupCard.click();

        try {
            await expect(this.page).toHaveURL(TEST_ROUTES.GROUP_DETAIL_PATTERN, { timeout: TEST_TIMEOUTS.NAVIGATION });
        } catch (error) {
            const currentUrl = this.page.url();
            throw new Error(`Failed to navigate to group detail page after clicking "${groupName}". ` + `Current URL: ${currentUrl}. Expected pattern: /groups/[id]`);
        }

        const groupDetailPage = new GroupDetailPage(this.page);
        await groupDetailPage.verifyGroupDetailPageLoaded(groupName);

        return groupDetailPage;
    }

    /**
     * Derive the application's base URL from the current dashboard URL.
     */
    getBaseUrl(): string {
        const currentUrl = this.page.url();
        if (currentUrl.includes(this.url)) {
            const [origin] = currentUrl.split(this.url);
            if (origin) {
                return origin;
            }
        }

        try {
            return new URL(currentUrl).origin;
        } catch {
            return currentUrl;
        }
    }

    /**
     * Create a group, optionally invite additional dashboard sessions, and wait for all to sync.
     */
    async createMultiUserGroup(...dashboardPages: DashboardPage[]): Promise<GroupDetailPage[]> {
        const groupName = `g-${++multiUserGroupCounter} ${randomString(4)} ${randomString(6)} ${randomString(8)}`;
        const expectedMemberCount = dashboardPages.length + 1;
        const groupDescription = `descr for ${groupName} which should have ${expectedMemberCount} users`;
        const creatorDisplayName = await this.header.getCurrentUserDisplayName();

        const ownerGroupDetailPage = await this.createGroupAndNavigate(groupName, groupDescription);
        const groupId = ownerGroupDetailPage.inferGroupId();

        console.log(`${creatorDisplayName} created new group "${groupName}" (id: ${groupId}) and ${dashboardPages.length} users will join...`);

        const groupDetailPages: GroupDetailPage[] = [ownerGroupDetailPage];

        if (dashboardPages.length) {
            const shareModal = await ownerGroupDetailPage.clickShareGroupAndOpenModal();
            const shareLink = await shareModal.getShareLink();
            await shareModal.closeModal();

            for (let i = 0; i < dashboardPages.length; i++) {
                const dashboardPage = dashboardPages[i];
                const joinGroupPage = new JoinGroupPage(dashboardPage.page);
                await joinGroupPage.joinGroupUsingShareLink(shareLink);

                // it should redirect to the browser the group detail page
                await expect(dashboardPage.page).toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId));
                const newGroupDetailPage = new GroupDetailPage(dashboardPage.page);
                groupDetailPages.push(newGroupDetailPage);

                const displayName = await dashboardPage.header.getCurrentUserDisplayName();
                console.log(`User "${displayName}" has joined group "${groupName}" (id: ${groupId})`);

                // CRITICAL FIX: Wait for membership to be reflected in ALL browsers before next join
                // This ensures Firestore has persisted the write and real-time updates have propagated
                const currentMemberCount = groupDetailPages.length;
                console.log(`Waiting for all ${currentMemberCount} browsers to show ${currentMemberCount} members...`);
                for (const gdp of groupDetailPages) {
                    await gdp.waitForMemberCount(currentMemberCount, 15000);
                }
                console.log(`All ${currentMemberCount} browsers now show ${currentMemberCount} members`);
            }
        }

        for (const groupDetailPage of groupDetailPages) {
            await groupDetailPage.waitForPage(groupId, groupDetailPages.length);
            await groupDetailPage.verifyAllSettledUp(groupId);
        }

        return groupDetailPages;
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
     * Expects either groups to be displayed OR empty state to be visible
     * Tests calling this method should KNOW which state to expect
     */
    async waitForGroupsToLoad(timeout = TEST_TIMEOUTS.LOADING_COMPLETE): Promise<void> {
        try {
            await expect(this.getGroupsLoadingSpinner()).not.toBeVisible({ timeout });
            await expect(this.getGroupCards().first().or(this.getEmptyGroupsStateInternal()).or(this.getArchivedEmptyState())).toBeVisible({ timeout });
        } catch (error) {
            const spinnerVisible = await this.getGroupsLoadingSpinner().isVisible();
            const groupsVisible = await this.getGroupCards().first().isVisible();
            const emptyStateVisible = await this.getEmptyGroupsStateInternal().isVisible();
            const archivedEmptyStateVisible = await this.getArchivedEmptyState().isVisible();
            throw new Error(
                `Groups failed to load within ${timeout}ms. `
                    + `Spinner visible: ${spinnerVisible}, Groups visible: ${groupsVisible}, Empty state visible: ${emptyStateVisible}, Archived empty state visible: ${archivedEmptyStateVisible}`,
            );
        }
    }

    /**
     * Wait for a specific group to appear (useful for real-time updates)
     */
    async waitForGroupToAppear(groupName: GroupName | string, timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        try {
            await expect(this.getGroupCard(groupName)).toBeVisible({ timeout });
        } catch (error) {
            const allGroups = await this.getGroupCards().allTextContents();
            throw new Error(`Group "${groupName}" did not appear within ${timeout}ms. ` + `Currently visible groups: [${allGroups.join(', ')}]`);
        }
    }

    /**
     * Wait for a specific group to disappear (useful for real-time updates)
     */
    async waitForGroupToDisappear(groupName: GroupName | string, timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        try {
            await expect(this.getGroupCard(groupName)).not.toBeVisible({ timeout });
        } catch (error) {
            throw new Error(`Group "${groupName}" did not disappear within ${timeout}ms. It is still visible.`);
        }
    }

    async waitForArchivedGroupsEmptyState(timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        await expect(this.getArchivedEmptyState()).toBeVisible({ timeout });
    }

    /**
     * Wait for welcome message (new user state)
     */
    async waitForWelcomeMessage(): Promise<void> {
        await expect(this.getWelcomeHeading()).toBeVisible();
        await expect(this.getEmptyGroupsStateInternal()).toBeVisible();
    }

    /**
     * Click group card invite button to open share modal
     * Fluent version - opens modal, verifies it opened, returns ShareGroupModalPage
     */
    async clickGroupCardInviteButton(groupName: GroupName | string): Promise<ShareGroupModalPage> {
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
     * Click group card invite button - basic modal open (no share link wait)
     * Use for error/loading state tests that don't expect successful share link generation
     */
    async clickGroupCardInviteButtonNoWait(groupName: GroupName | string): Promise<ShareGroupModalPage> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible();

        // Hover to reveal action buttons
        await groupCard.hover();

        const inviteButton = this.getGroupCardInviteButton(groupName);
        await expect(inviteButton).toBeVisible();
        await this.clickButton(inviteButton, { buttonName: `Invite to ${groupName}` });

        const modalPage = new ShareGroupModalPage(this.page);
        await modalPage.waitForModalToOpenBasic();
        return modalPage;
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
    async verifyGroupDisplayed(groupName: GroupName | string): Promise<void> {
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
     * Verify error state is not displayed
     */
    async verifyErrorStateNotVisible(): Promise<void> {
        await expect(this.getErrorContainer()).not.toBeVisible();
    }

    /**
     * Verify empty groups state for new users
     */
    async verifyEmptyGroupsState(): Promise<void> {
        await expect(this.getEmptyGroupsStateInternal()).toBeVisible();
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
     * Verify create group button is visible
     */
    async verifyCreateGroupButtonVisible(): Promise<void> {
        await expect(this.getCreateGroupButton()).toBeVisible();
    }

    /**
     * Verify create group button is enabled
     */
    async verifyCreateGroupButtonEnabled(): Promise<void> {
        await expect(this.getCreateGroupButton()).toBeEnabled();
    }

    // ============================================================================
    // ACTIVITY FEED SELECTORS AND METHODS
    // ============================================================================

    /**
     * Activity feed heading
     */
    private getActivityFeedHeading(): Locator {
        return this.getActivityFeedContainer().getByRole('heading', { name: 'Recent Activity' });
    }

    /**
     * Activity feed empty state
     */
    private getActivityFeedEmptyState(): Locator {
        return this.getActivityFeedContainer().getByTestId('activity-feed-empty');
    }

    /**
     * Activity feed error message
     */
    private getActivityFeedError(): Locator {
        return this.getActivityFeedContainer().getByTestId('activity-feed-error');
    }

    /**
     * Activity feed items
     */
    private getActivityFeedItems(): Locator {
        return this.getActivityFeedContainer().getByTestId('activity-feed-item');
    }

    /**
     * Activity feed retry button
     */
    private getActivityFeedRetryButton(): Locator {
        return this.getActivityFeedContainer().getByRole('button', { name: 'Retry' });
    }

    /**
     * Activity feed load more button
     */
    private getActivityFeedLoadMoreButton(): Locator {
        return this.getActivityFeedContainer().getByRole('button', { name: 'Load More' });
    }

    /**
     * Activity feed item button by description
     */
    private getActivityFeedItemButton(description: string): Locator {
        return this.getActivityFeedContainer().getByRole('button', { name: description });
    }

    /**
     * Verify activity feed is visible
     */
    async verifyActivityFeedVisible(): Promise<void> {
        await expect(this.getActivityFeedContainer()).toBeVisible();
        await expect(this.getActivityFeedHeading()).toBeVisible();
    }

    /**
     * Verify activity feed shows empty state
     */
    async verifyActivityFeedEmptyState(): Promise<void> {
        await expect(this.getActivityFeedEmptyState()).toBeVisible();
        await expect(this.getActivityFeedEmptyState().getByText('No activity yet')).toBeVisible();
    }

    /**
     * Verify activity feed shows error
     */
    async verifyActivityFeedError(): Promise<void> {
        const errorText = translation.activityFeed.error.loadFailed;
        await expect(this.getActivityFeedError()).toBeVisible();
        await expect(this.getActivityFeedError().getByText(errorText)).toBeVisible();
    }

    /**
     * Verify activity feed has specific number of items
     */
    async verifyActivityFeedItemCount(expectedCount: number): Promise<void> {
        await expect(this.getActivityFeedItems()).toHaveCount(expectedCount);
    }

    /**
     * Verify activity feed contains text
     */
    async verifyActivityFeedContainsText(text: string): Promise<void> {
        await expect(this.getActivityFeedItems().filter({ hasText: text })).toHaveCount(1);
    }

    /**
     * Verify activity feed contains a comment preview
     */
    async verifyActivityFeedContainsPreview(preview: string): Promise<void> {
        await expect(this.getActivityFeedContainer().getByText(preview, { exact: true })).toBeVisible();
    }

    /**
     * Click an activity feed item by its description
     */
    async clickActivityFeedItem(description: string): Promise<void> {
        const button = this.getActivityFeedItemButton(description);
        await this.clickButton(button, { buttonName: `Activity Feed Item: ${description}` });
    }

    /**
     * Click activity feed retry button
     */
    async clickActivityFeedRetry(): Promise<void> {
        const button = this.getActivityFeedRetryButton();
        await this.clickButton(button, { buttonName: 'Activity Feed Retry' });
    }

    /**
     * Click activity feed load more button
     */
    async clickActivityFeedLoadMore(): Promise<void> {
        const button = this.getActivityFeedLoadMoreButton();
        await this.clickButton(button, { buttonName: 'Activity Feed Load More' });
    }

    /**
     * Verify load more button is visible and enabled
     */
    async verifyActivityFeedLoadMoreVisible(): Promise<void> {
        await expect(this.getActivityFeedLoadMoreButton()).toBeVisible();
        await expect(this.getActivityFeedLoadMoreButton()).toBeEnabled();
    }

    /**
     * Verify load more button is not visible
     */
    async verifyActivityFeedLoadMoreHidden(): Promise<void> {
        await expect(this.getActivityFeedLoadMoreButton()).not.toBeVisible();
    }
}

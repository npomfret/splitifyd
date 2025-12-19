import type { GroupName } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
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
        // .first(): Container may match multiple wrappers; get first (visible one)
        return this
            .page
            .locator('section, div')
            .filter({
                has: this.page.getByRole('heading', { name: translation.dashboard.yourGroups }),
            })
            .first();
    }

    /**
     * Activity feed is now in the header notifications dropdown.
     * This returns the dropdown dialog container.
     */
    private getActivityFeedContainer(): Locator {
        return this.page.getByRole('dialog', { name: translation.notifications.title });
    }

    /**
     * Ensure the notifications dropdown is open before interacting with activity feed.
     */
    private async ensureNotificationsDropdownOpen(): Promise<void> {
        const dropdown = this.getActivityFeedContainer();
        const isVisible = await dropdown.isVisible();
        if (!isVisible) {
            await this.header.openNotificationsDropdown();
        }
    }

    /**
     * Error message container within the dashboard (uses ErrorState component with role='alert')
     */
    protected getErrorContainer(): Locator {
        return this.getGroupsContainer().getByRole('alert');
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
        return this.page.getByText(translation.dashboard.emptyState.title);
    }

    /**
     * Error state heading (uses ErrorState component)
     */
    protected getErrorHeading(): Locator {
        return this.getGroupsContainer().getByRole('alert').getByRole('heading');
    }

    // ============================================================================
    // GROUPS SECTION SELECTORS
    // ============================================================================

    /**
     * Groups grid/list container - now uses role='list' with aria-label
     */
    protected getGroupsGrid(): Locator {
        return this.getGroupsContainer().getByRole('list', { name: translation.dashboardComponents.groupsList.groupsListAriaLabel });
    }

    /**
     * Individual group cards
     */
    protected getGroupCards(): Locator {
        // GroupCards are wrapped in listitem elements within the list
        return this.getGroupsGrid().getByRole('listitem');
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
        await this.ensureNotificationsDropdownOpen();
        await expect(this.getActivityFeedContainer()).toBeVisible();
        const matchingItems = this.getActivityFeedItems().filter({ hasText: description });
        await expect(matchingItems).not.toHaveCount(0);
    }

    /**
     * Verify responsive layout classes are applied to the groups grid
     * Uses grid-auto-fit for intrinsically responsive layout
     */
    async verifyGroupsGridResponsiveLayout(): Promise<void> {
        const grid = this.getGroupsGrid();
        await expect(grid).toHaveClass(/grid-auto-fit/);
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
        // Caller should wait for expected state (e.g., waitForGroupToAppear, verifyEmptyGroupsState)
    }

    async showArchivedGroups(): Promise<void> {
        const button = this.getGroupsFilterButton('archived');
        await this.clickButton(button, { buttonName: translation.dashboard.groupsFilter.archived });
        // Caller should wait for expected state (e.g., waitForGroupToAppear, waitForArchivedGroupsEmptyState)
    }

    async verifyGroupHasArchivedBadge(groupName: GroupName | string): Promise<void> {
        const badge = this.getGroupCard(groupName).getByText(translation.dashboard.groupCard.archivedBadge);
        await expect(badge).toBeVisible();
    }

    async verifyGroupHasNoArchiveQuickActions(groupName: GroupName | string): Promise<void> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        // Check each action separately to avoid conditional regex
        const archiveButton = groupCard.getByRole('button', { name: translation.groupActions.archive });
        const unarchiveButton = groupCard.getByRole('button', { name: translation.groupActions.unarchive });

        await expect(async () => {
            const archiveCount = await archiveButton.count();
            const unarchiveCount = await unarchiveButton.count();
            if (archiveCount !== 0 || unarchiveCount !== 0) {
                throw new Error(`Expected no archive or unarchive quick actions for "${groupName}", but found archive=${archiveCount}, unarchive=${unarchiveCount}.`);
            }
        })
            .toPass({
                timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE,
                intervals: [250, 500, 750],
            });
    }

    private getPaginationContainer(): Locator {
        return this.page.getByRole('navigation', { name: translation.pagination.navigation });
    }

    private getPaginationNextButton(): Locator {
        // Desktop pagination next button with aria-label
        return this.getPaginationContainer().getByRole('button', { name: translation.pagination.next });
    }

    private getPaginationPreviousButton(): Locator {
        // Desktop pagination previous button with aria-label
        return this.getPaginationContainer().getByRole('button', { name: translation.pagination.previous });
    }

    private getPaginationNextButtonMobile(): Locator {
        // .first(): Mobile pagination is first nav element; desktop is second
        return this.page.getByRole('navigation', { name: translation.pagination.navigation }).first().getByRole('button', { name: translation.pagination.next });
    }

    private getPaginationPreviousButtonMobile(): Locator {
        // .first(): Mobile pagination is first nav element; desktop is second
        return this.page.getByRole('navigation', { name: translation.pagination.navigation }).first().getByRole('button', { name: translation.pagination.previous });
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
        return this.page.getByText(translation.dashboard.emptyState.title).locator('..');
    }

    /**
     * Get the empty groups state container - internal use only
     * Use verifyEmptyGroupsState() or clickEmptyStateCreateGroup() for tests
     */
    private getEmptyGroupsState(): Locator {
        return this.getEmptyGroupsStateInternal();
    }

    /**
     * Get the create group button in the empty state
     */
    protected getEmptyStateCreateGroupButton(): Locator {
        return this.getEmptyGroupsStateInternal().getByRole('button', { name: translation.emptyGroupsState.createFirstGroup });
    }

    /**
     * Click the create group button in the empty state
     * Returns a CreateGroupModalPage instance
     */
    async clickEmptyStateCreateGroup(): Promise<CreateGroupModalPage> {
        const button = this.getEmptyStateCreateGroupButton();
        await expect(button).toBeVisible();
        await this.clickButton(button, { buttonName: 'Empty State Create Group' });
        const modal = new CreateGroupModalPage(this.page);
        await modal.verifyModalOpen();
        return modal;
    }

    /**
     * Verify the empty state create group button is visible
     */
    async verifyEmptyStateCreateGroupButtonVisible(): Promise<void> {
        await expect(this.getEmptyStateCreateGroupButton()).toBeVisible();
    }

    protected getArchivedEmptyState(): Locator {
        return this.getGroupsContainer().getByText(translation.dashboardComponents.groupsList.noArchivedTitle);
    }

    /**
     * Loading state for groups - either skeleton cards or spinner
     * Skeletons use aria-busy="true", spinner uses role="status"
     */
    protected getGroupsLoadingSpinner(): Locator {
        // Match either skeleton loading state or spinner
        return this.getGroupsContainer().locator('[aria-busy="true"], [role="status"]');
    }

    /**
     * Skeleton loading cards container
     */
    protected getGroupsSkeletonContainer(): Locator {
        return this.getGroupsContainer().locator('[aria-busy="true"]');
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
     * Uses aria-label for semantic selection
     */
    protected getUserMenuButton(): Locator {
        return this.page.getByRole('button', { name: translation.navigation.userMenu.openUserMenu });
    }

    /**
     * Group Card - Invite button (hover action)
     * Uses the translation template with interpolated group name for exact matching
     */
    protected getGroupCardInviteButton(groupName: GroupName | string): Locator {
        const expectedLabel = translation.groupCard.inviteTooltip.replace('{{groupName}}', groupName as string);
        return this.getGroupCard(groupName).getByRole('button', { name: expectedLabel, exact: true });
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

        const ownerGroupDetailPage = await this.createGroupAndNavigate(groupName, groupDescription);
        const groupId = ownerGroupDetailPage.inferGroupId();

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
     * Verify groups are loading (skeleton cards or spinner visible)
     */
    async verifyGroupsLoading(): Promise<void> {
        // Check for either skeleton loading state (aria-busy) or spinner (role=status)
        await expect(this.getGroupsLoadingSpinner()).toBeVisible();
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
     * .first(): Verify at least one group card is visible
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

    /**
     * Verify create group button is focused (for accessibility tests)
     */
    async verifyCreateGroupButtonFocused(): Promise<void> {
        await expect(this.getCreateGroupButton()).toBeFocused();
    }

    /**
     * Verify the "create first group" prompt is visible (empty state for new users)
     * .first(): Description text may appear in multiple contexts
     */
    async verifyCreateFirstGroupPromptVisible(): Promise<void> {
        await expect(this.page.getByText(translation.emptyGroupsState.description).first()).toBeVisible();
    }

    /**
     * Verify welcome message heading is visible (for new users with no groups)
     */
    async verifyWelcomeMessageVisible(timeout: number = 5000): Promise<void> {
        const welcomePattern = new RegExp(`^${translation.dashboard.welcomeMessage.split('{{')[0]}`);
        await expect(this.page.getByRole('heading', { name: welcomePattern })).toBeVisible({ timeout });
    }

    /**
     * Verify "Your Groups" heading is visible (for users with groups)
     */
    async verifyYourGroupsHeadingVisible(timeout: number = 5000): Promise<void> {
        await expect(this.page.getByRole('heading', { name: translation.dashboard.yourGroups })).toBeVisible({ timeout });
    }

    // ============================================================================
    // ACTIVITY FEED SELECTORS AND METHODS
    // ============================================================================

    /**
     * Activity feed heading (now in notifications dropdown - uses "Notifications" title)
     */
    private getActivityFeedHeading(): Locator {
        return this.getActivityFeedContainer().getByRole('heading', { name: translation.notifications.title });
    }

    /**
     * Activity feed empty state (contains 'No activity yet' text)
     */
    private getActivityFeedEmptyState(): Locator {
        // .first(): Multiple divs may contain empty state text; get first match
        return this
            .getActivityFeedContainer()
            .locator('div')
            .filter({
                hasText: translation.activityFeed.emptyState.title,
            })
            .first();
    }

    /**
     * Activity feed error message (has role='alert')
     */
    private getActivityFeedError(): Locator {
        return this.getActivityFeedContainer().getByRole('alert');
    }

    /**
     * Activity feed items (list items in the activity feed)
     */
    private getActivityFeedItems(): Locator {
        return this.getActivityFeedContainer().getByRole('listitem');
    }

    /**
     * Activity feed retry button
     */
    private getActivityFeedRetryButton(): Locator {
        return this.getActivityFeedContainer().getByRole('button', { name: translation.activityFeed.actions.retry });
    }

    /**
     * Activity feed load more button
     */
    private getActivityFeedLoadMoreButton(): Locator {
        return this.getActivityFeedContainer().getByRole('button', { name: translation.activityFeed.actions.loadMore });
    }

    /**
     * Activity feed item button by description
     */
    private getActivityFeedItemButton(description: string): Locator {
        return this.getActivityFeedContainer().getByRole('button', { name: description });
    }

    /**
     * Verify activity feed is visible (opens notifications dropdown first)
     */
    async verifyActivityFeedVisible(): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        await expect(this.getActivityFeedContainer()).toBeVisible();
        await expect(this.getActivityFeedHeading()).toBeVisible();
    }

    /**
     * Verify activity feed shows empty state (opens notifications dropdown first)
     */
    async verifyActivityFeedEmptyState(): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        await expect(this.getActivityFeedEmptyState()).toBeVisible();
        await expect(this.getActivityFeedEmptyState().getByText(translation.activityFeed.emptyState.title)).toBeVisible();
    }

    /**
     * Verify activity feed shows error (opens notifications dropdown first)
     */
    async verifyActivityFeedError(): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        const errorText = translation.activityFeed.error.loadFailed;
        await expect(this.getActivityFeedError()).toBeVisible();
        await expect(this.getActivityFeedError().getByText(errorText)).toBeVisible();
    }

    /**
     * Verify activity feed has specific number of items (opens notifications dropdown first)
     */
    async verifyActivityFeedItemCount(expectedCount: number): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        await expect(this.getActivityFeedItems()).toHaveCount(expectedCount);
    }

    /**
     * Verify activity feed contains text (opens notifications dropdown first)
     */
    async verifyActivityFeedContainsText(text: string): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        await expect(this.getActivityFeedItems().filter({ hasText: text })).toHaveCount(1);
    }

    /**
     * Verify activity feed contains a comment preview (opens notifications dropdown first)
     */
    async verifyActivityFeedContainsPreview(preview: string): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        await expect(this.getActivityFeedContainer().getByText(preview, { exact: true })).toBeVisible();
    }

    /**
     * Click an activity feed item by its description (opens notifications dropdown first)
     */
    async clickActivityFeedItem(description: string): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        const button = this.getActivityFeedItemButton(description);
        await this.clickButton(button, { buttonName: `Activity Feed Item: ${description}` });
    }

    /**
     * Click activity feed retry button (opens notifications dropdown first)
     */
    async clickActivityFeedRetry(): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        const button = this.getActivityFeedRetryButton();
        await this.clickButton(button, { buttonName: 'Activity Feed Retry' });
    }

    /**
     * Click activity feed load more button (opens notifications dropdown first)
     */
    async clickActivityFeedLoadMore(): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        const button = this.getActivityFeedLoadMoreButton();
        await this.clickButton(button, { buttonName: 'Activity Feed Load More' });
    }

    /**
     * Verify load more button is visible and enabled (opens notifications dropdown first)
     */
    async verifyActivityFeedLoadMoreVisible(): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        await expect(this.getActivityFeedLoadMoreButton()).toBeVisible();
        await expect(this.getActivityFeedLoadMoreButton()).toBeEnabled();
    }

    /**
     * Verify load more button is not visible (opens notifications dropdown first)
     */
    async verifyActivityFeedLoadMoreHidden(): Promise<void> {
        await this.ensureNotificationsDropdownOpen();
        await expect(this.getActivityFeedLoadMoreButton()).not.toBeVisible();
    }
}

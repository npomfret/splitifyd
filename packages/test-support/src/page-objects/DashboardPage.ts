import { expect, Locator, Page } from '@playwright/test';
import type { CreateGroupFormData } from '@splitifyd/shared';
import { TEST_ROUTES, TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';
import { CreateGroupModalPage } from './CreateGroupModalPage';
import { GroupDetailPage } from './GroupDetailPage';
import { ShareGroupModalPage } from './ShareGroupModalPage';
import { HeaderPage } from './HeaderPage';
import { JoinGroupPage } from './JoinGroupPage';
import { CreateGroupFormDataBuilder } from '../builders';
import { generateShortId, randomString } from '../test-helpers';
import { translationEn } from '../translations/translation-en';

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
     * Factory for group detail page instances.
     * Subclasses can override to provide extended implementations.
     */
    protected createGroupDetailPageInstance<T extends GroupDetailPage = GroupDetailPage>(page: Page): T {
        return new GroupDetailPage(page) as unknown as T;
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
    getGroupsContainer(): Locator {
        return this
            .page
            .locator('section, div')
            .filter({
                has: this.page.getByRole('heading', { name: translation.dashboard.yourGroups }),
            })
            .first();
    }

    /**
     * Quick actions sidebar/card container
     */
    getQuickActionsContainer(): Locator {
        // Find the container with Quick Actions text (title is now a div, not a heading)
        return this
            .page
            .locator('div')
            .filter({
                has: this.page.getByText(translation.quickActions.title, { exact: true }),
            })
            .first();
    }


    /**
     * Welcome section for new users
     */
    getWelcomeSection(): Locator {
        return this.page.locator('div').filter({
            has: this.page.getByRole('heading', { level: 2 }).filter({ hasText: /welcome/i }),
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
            has: this.page.getByText(groupName, { exact: true }),
        });
    }

    /**
     * Verify groups grid is visible
     */
    async verifyGroupsGridVisible(): Promise<void> {
        await expect(this.getGroupsGrid()).toBeVisible();
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
    async hoverGroupCard(groupName: string): Promise<void> {
        const card = this.getGroupCard(groupName);
        await expect(card).toBeVisible();
        await card.hover();
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

    async verifyPaginationVisibleMobile(): Promise<void> {
        // Mobile pagination doesn't have a nav container, check for mobile buttons directly
        const nextButton = this.getPaginationNextButtonMobile();
        const prevButton = this.getPaginationPreviousButtonMobile();
        await expect(nextButton.or(prevButton)).toBeVisible();
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

    clickPaginationPreviousWithoutWait(): Promise<void> {
        const button = this.getPaginationPreviousButton();
        return (async () => {
            await expect(button).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
            await this.expectButtonEnabled(button, 'Pagination Previous');
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

    async verifyPaginationNextMobileDisabled(): Promise<void> {
        await expect(this.getPaginationNextButtonMobile()).toBeDisabled();
    }

    async verifyPaginationPreviousMobileEnabled(): Promise<void> {
        await expect(this.getPaginationPreviousButtonMobile()).toBeEnabled();
    }

    async verifyPaginationPreviousMobileDisabled(): Promise<void> {
        await expect(this.getPaginationPreviousButtonMobile()).toBeDisabled();
    }

    async clickPaginationNextMobile(): Promise<void> {
        const button = this.getPaginationNextButtonMobile();
        await this.clickButton(button, { buttonName: 'Pagination Next Mobile' });
    }

    async clickPaginationPreviousMobile(): Promise<void> {
        const button = this.getPaginationPreviousButtonMobile();
        await this.clickButton(button, { buttonName: 'Pagination Previous Mobile' });
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
        return this.getGroupsContainer().getByRole('status');
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
     * Button displays user's display name
     */
    getUserMenuButton(): Locator {
        return this.page.getByTestId('user-menu-button');
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
        return this
            .getGroupsGrid()
            .locator('div')
            .filter({
                has: this.page.getByText(translation.dashboardComponents.groupsList.creating),
            });
    }

    /**
     * Group update loading overlay
     */
    getGroupUpdateLoadingOverlay(groupId?: string): Locator {
        const baseSelector = this
            .getGroupsGrid()
            .locator('.absolute.inset-0')
            .filter({
                has: this.page.locator('[data-testid="loading-spinner"], .animate-spin'),
            });

        if (groupId) {
            return this.getGroupCard(`[data-group-id="${groupId}"]`).locator('.absolute.inset-0');
        }

        return baseSelector;
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
                .getEmptyGroupsState()
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
    async createGroupAndNavigate<T extends GroupDetailPage = GroupDetailPage>(
        name: string = generateShortId(),
        description: string = generateShortId(),
        options: {
            createGroupDetailPage?: (page: Page) => T;
            expectedMemberCount?: number;
            verifyHeading?: boolean;
            waitForReady?: boolean;
        } = {},
    ): Promise<T> {
        if (!this.page.url().includes(this.url)) {
            await this.navigate();
        } else {
            await this.waitForDashboard();
        }

        const createGroupModal = await this.clickCreateGroup();
        await createGroupModal.createGroup(name, description);

        await this.expectUrl(GroupDetailPage.groupDetailUrlPattern());

        await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {
            // Ignore failures if DOM finished loading earlier.
        });

        if (options.verifyHeading ?? true) {
            await expect(this.page.getByRole('heading', { name })).toBeVisible();
        }

        const createGroupDetailPage =
            options.createGroupDetailPage
            ?? ((page: Page) => this.createGroupDetailPageInstance<T>(page));

        const groupDetailPage = createGroupDetailPage(this.page);
        const groupId = groupDetailPage.inferGroupId();

        await expect(this.page).toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId), { timeout: TEST_TIMEOUTS.NAVIGATION });

        if (options.waitForReady ?? true) {
            const memberCount = options.expectedMemberCount ?? 1;
            await groupDetailPage.waitForPage(groupId, memberCount);
        }

        return groupDetailPage;
    }

    /**
     * Create a new group using the primary create button
     * Returns CreateGroupModalPage for fluent interface
     */
    async clickCreateGroup(): Promise<CreateGroupModalPage> {
        const button = this.getCreateGroupButton();

        // Verify button exists and is visible before clicking
        await expect(button).toBeVisible({ timeout: 2000 });
        await expect(button).toBeEnabled({ timeout: 1000 });

        await this.clickButton(button, { buttonName: 'Create Group' });

        // Wait for any network requests to settle (e.g., user session checks)
        await this.page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {
            // Ignore timeout - not critical if network doesn't idle
        });

        const modalPage = new CreateGroupModalPage(this.page);

        // Add defensive check with better error message
        try {
            await modalPage.waitForModalToOpen();

            // CRITICAL: Verify modal is STILL open after waitForModalToOpen passes
            // This catches race conditions where modal opens then immediately closes
            await expect(modalPage.getModalContainer()).toBeVisible({ timeout: 500 });
            await expect(modalPage.getGroupNameInput()).toBeVisible({ timeout: 500 });

        } catch (error) {
            // Capture detailed page state when modal fails to open or stay open
            const url = this.page.url();
            const visibleButtons = await this.page.locator('button:visible').evaluateAll(
                (buttons) => buttons.map((b) => b.textContent?.trim()).filter(Boolean)
            );
            const dialogs = await this.page.locator('[role="dialog"]').count();
            const modalVisible = await modalPage.getModalContainer().isVisible().catch(() => false);

            throw new Error(
                `Create Group modal failed to open or stay open after clicking button.\n` +
                `Current URL: ${url}\n` +
                `Dialogs in DOM: ${dialogs}\n` +
                `Modal visible now: ${modalVisible}\n` +
                `Visible buttons: ${JSON.stringify(visibleButtons)}\n` +
                `Original error: ${error instanceof Error ? error.message : String(error)}`
            );
        }

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
    async clickGroupCardAndNavigateToDetail<T extends GroupDetailPage = GroupDetailPage>(
        groupName: string,
        options: {
            createGroupDetailPage?: (page: Page) => T;
            expectedGroupId?: string;
            expectedMemberCount?: number;
            verifyGroupName?: boolean;
            waitForReady?: boolean;
        } = {},
    ): Promise<T> {
        const groupCard = this.getGroupCard(groupName);
        await expect(groupCard).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await groupCard.click();

        try {
            const urlPattern = options.expectedGroupId
                ? GroupDetailPage.groupDetailUrlPattern(options.expectedGroupId)
                : TEST_ROUTES.GROUP_DETAIL_PATTERN;
            await expect(this.page).toHaveURL(urlPattern, { timeout: TEST_TIMEOUTS.NAVIGATION });
        } catch (error) {
            const currentUrl = this.page.url();
            throw new Error(`Failed to navigate to group detail page after clicking "${groupName}". ` + `Current URL: ${currentUrl}. Expected pattern: /groups/[id]`);
        }

        const createGroupDetailPage =
            options.createGroupDetailPage
            ?? ((page: Page) => this.createGroupDetailPageInstance<T>(page));

        const groupDetailPage = createGroupDetailPage(this.page);

        if (options.verifyGroupName ?? true) {
            await groupDetailPage.verifyGroupDetailPageLoaded(groupName);
        }

        if (options.waitForReady) {
            const groupId = options.expectedGroupId ?? groupDetailPage.inferGroupId();
            const expectedMemberCount = options.expectedMemberCount ?? 1;
            await groupDetailPage.waitForPage(groupId, expectedMemberCount);
        }

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
    async createMultiUserGroup<T extends GroupDetailPage = GroupDetailPage>(
        optionsOrBuilder: CreateGroupFormData | CreateGroupFormDataBuilder = new CreateGroupFormDataBuilder(),
        ...dashboardPages: DashboardPage[]
    ): Promise<T[]> {
        const options =
            optionsOrBuilder instanceof CreateGroupFormDataBuilder
                ? optionsOrBuilder.build()
                : optionsOrBuilder;

        const groupName = options.name ?? `g-${++multiUserGroupCounter} ${randomString(4)} ${randomString(6)} ${randomString(8)}`;
        const groupDescription = options.description ?? `descr for ${groupName}`;

        const ownerGroupDetailPage = await this.createGroupAndNavigate<T>(groupName, groupDescription, {
            expectedMemberCount: 1,
        });
        const groupId = ownerGroupDetailPage.inferGroupId();

        console.log(`New group created: "${groupName}" (id: ${groupId})`);

        const groupDetailPages: T[] = [ownerGroupDetailPage];

        if (dashboardPages.length) {
            const shareModal = await ownerGroupDetailPage.clickShareGroupAndOpenModal();
            const shareLink = await shareModal.getShareLink();
            await shareModal.closeModal();

            for (const dashboardPage of dashboardPages) {
                const joinGroupPage = new JoinGroupPage(dashboardPage.page);
                await joinGroupPage.joinGroupUsingShareLink(shareLink);
                await expect(dashboardPage.page).toHaveURL(GroupDetailPage.groupDetailUrlPattern(groupId));

                const memberDetailPage = dashboardPage.createGroupDetailPageInstance<T>(dashboardPage.page);
                groupDetailPages.push(memberDetailPage);

                const displayName = await dashboardPage.header.getCurrentUserDisplayName();
                console.log(`User "${displayName}" has joined group "${groupName}" (id: ${groupId})`);
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
            await expect(this.getGroupCards().first().or(this.getEmptyGroupsState())).toBeVisible({ timeout });
        } catch (error) {
            const spinnerVisible = await this.getGroupsLoadingSpinner().isVisible();
            const groupsVisible = await this.getGroupCards().first().isVisible();
            const emptyStateVisible = await this.getEmptyGroupsState().isVisible();
            throw new Error(`Groups failed to load within ${timeout}ms. ` + `Spinner visible: ${spinnerVisible}, Groups visible: ${groupsVisible}, Empty state visible: ${emptyStateVisible}`);
        }
    }

    /**
     * Wait for a specific group to appear (useful for real-time updates)
     */
    async waitForGroupToAppear(groupName: string, timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
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
    async waitForGroupToDisappear(groupName: string, timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        try {
            await expect(this.getGroupCard(groupName)).not.toBeVisible({ timeout });
        } catch (error) {
            throw new Error(`Group "${groupName}" did not disappear within ${timeout}ms. It is still visible.`);
        }
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
     * Fluent version - opens modal, verifies it opened, returns ShareGroupModalPage
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
     * Non-fluent version - clicks without verification
     * TODO: Add fluent version that returns ExpenseFormPage when it exists
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
     * Fluent version - opens modal, verifies it opened, returns CreateGroupModalPage
     */
    async clickQuickActionsCreateGroup(): Promise<CreateGroupModalPage> {
        const button = this.getQuickActionsCreateButton();
        await this.clickButton(button, { buttonName: 'Quick Actions Create Group' });

        const modalPage = new CreateGroupModalPage(this.page);
        await modalPage.waitForModalToOpen();
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

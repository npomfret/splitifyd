import { expect, Page } from '@playwright/test';
import { DashboardPage as BaseDashboardPage } from '@splitifyd/test-support';
import { PooledTestUser } from '@splitifyd/shared';
import { CreateGroupModalPage } from './create-group-modal.page.ts';
import { GroupDetailPage, groupDetailUrlPattern } from './group-detail.page.ts';
import { generateShortId, randomString, CreateGroupFormDataBuilder, CreateGroupFormData } from '@splitifyd/test-support';
import { JoinGroupPage } from './join-group.page.ts';
import { HeaderPage } from './header.page';

let i = 0;

/**
 * E2E-specific DashboardPage that extends the shared BaseDashboardPage
 * Adds multi-user group creation and advanced test workflows
 */
export class DashboardPage extends BaseDashboardPage {
    private _header?: HeaderPage;
    protected readonly userInfo?: PooledTestUser;

    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page);
        this.userInfo = userInfo;
    }

    /**
     * Header page object for user menu and navigation functionality.
     * E2E-specific header with additional functionality
     */
    get header(): HeaderPage {
        if (!this._header) {
            this._header = new HeaderPage(this.page);
        }
        return this._header;
    }

    // Override navigate to include e2e-specific setup
    async navigate() {
        await super.navigate();
    }

    // Overload: Accept CreateGroupFormDataBuilder for builder pattern
    async createMultiUserGroup(dataBuilder: CreateGroupFormDataBuilder, ...dashboardPages: DashboardPage[]): Promise<GroupDetailPage[]>;
    // Overload: Accept plain object for backward compatibility
    async createMultiUserGroup(options: CreateGroupFormData, ...dashboardPages: DashboardPage[]): Promise<GroupDetailPage[]>;
    // Implementation
    async createMultiUserGroup(optionsOrBuilder: CreateGroupFormData | CreateGroupFormDataBuilder, ...dashboardPages: DashboardPage[]): Promise<GroupDetailPage[]> {
        // Handle both builder and plain object inputs
        const options = optionsOrBuilder instanceof CreateGroupFormDataBuilder ? optionsOrBuilder.build() : optionsOrBuilder;

        const groupName = options.name ?? `g-${++i} ${randomString(4)} ${randomString(6)} ${randomString(8)}`;
        const groupDescription = options.description ?? `descr for ${groupName}`;

        const groupDetailPage = await this.createGroupAndNavigate(groupName, groupDescription);
        const groupId = groupDetailPage.inferGroupId();
        await groupDetailPage.waitForPage(groupId, 1);

        // sanity check
        const name = await groupDetailPage.getGroupName();
        expect(groupName).toEqual(name);

        console.log(`New group created: "${groupName}" (id: ${groupId})`);

        const groupDetailPages = [groupDetailPage];

        if (dashboardPages.length) {
            const shareLink = await groupDetailPage.getShareLink();

            for (const dashboardPage of dashboardPages) {
                const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(dashboardPage.page, shareLink, groupId);
                groupDetailPages.push(memberGroupDetailPage);
                const displayName = await dashboardPage.header.getCurrentUserDisplayName();
                console.log(`User "${displayName}" has joined group "${groupName}" (id: ${groupId})`);
            }
        }

        for (const newGroupDetailPage of groupDetailPages) {
            // wait for each page to sync before adding the next user
            await newGroupDetailPage.waitForPage(groupId, groupDetailPages.length);
            await newGroupDetailPage.verifyAllSettledUp(groupId);
        }

        return groupDetailPages;
    }

    /**
     * E2E-specific group creation that returns e2e GroupDetailPage
     * Delegates to base class for UI interactions, adds e2e-specific verification
     */
    async createGroupAndNavigate(name: string = generateShortId(), description: string = generateShortId()): Promise<GroupDetailPage> {
        const currentUrl = this.page.url();
        if (!currentUrl.includes('/dashboard')) {
            await this.navigate();
        }
        await this.waitForDashboard();

        // Open modal using e2e-specific method that returns e2e CreateGroupModalPage
        const createGroupModal = await this.openCreateGroupModal();
        await createGroupModal.createGroup(name, description);

        // Wait for navigation and verify URL
        await this.expectUrl(groupDetailUrlPattern());
        await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await expect(this.page.getByRole('heading', { name })).toBeVisible();

        const groupDetailPage = new GroupDetailPage(this.page);
        const groupId = groupDetailPage.inferGroupId();

        await expect(this.page).toHaveURL(groupDetailUrlPattern(groupId));
        await groupDetailPage.ensureNewGroupPageReadyWithOneMember(groupId);

        return groupDetailPage;
    }

    /**
     * E2E-specific utility to get base URL from current dashboard URL
     */
    getBaseUrl() {
        return this.page.url().split('/dashboard')[0];
    }

    /**
     * E2E-specific modal opening that returns e2e CreateGroupModalPage
     * Uses base class selector but wraps result in e2e page object
     */
    async openCreateGroupModal() {
        // Use base class method to click the button
        await super.clickCreateGroup();

        // Create e2e-specific modal page instance
        const createGroupModalPage = new CreateGroupModalPage(this.page, this.userInfo);

        // Wait for the modal to appear using the modal's own strict selector
        await createGroupModalPage.getModalDialog().waitFor({
            state: 'visible',
            timeout: 1000,
        });

        return createGroupModalPage;
    }

    /**
     * E2E-specific dashboard waiting with comprehensive state checking
     * Extends base class verification with additional e2e requirements
     */
    async waitForDashboard() {
        // Use base class verification for standard checks
        await super.verifyDashboardPageLoaded();

        // E2E-specific: Wait for loading spinner to disappear
        try {
            const loadingSpinner = super.getGroupsLoadingSpinner();
            await loadingSpinner.waitFor({ state: 'hidden', timeout: 3000 });
        } catch {
            // Spinner never appeared or disappeared quickly - expected behavior
        }

        // E2E-specific: Comprehensive state polling for all possible outcomes
        await expect(async () => {
            const hasGroupsContainer = await super
                .getGroupsContainer()
                .isVisible()
                .catch(() => false);
            const hasEmptyState = await super
                .getEmptyGroupsState()
                .isVisible()
                .catch(() => false);
            const hasErrorState = await super
                .getErrorContainer()
                .isVisible()
                .catch(() => false);
            const hasLoadingSpinner = await super
                .getGroupsLoadingSpinner()
                .isVisible()
                .catch(() => false);

            if (!hasGroupsContainer && !hasEmptyState && !hasErrorState && !hasLoadingSpinner) {
                throw new Error('Groups content not yet loaded - waiting for groups container, empty state, error state, or loading spinner');
            }
        }).toPass({
            timeout: 5000,
            intervals: [100, 250, 500],
        });

        // Final DOM check
        await this.waitForDomContentLoaded();
    }

    /**
     * E2E-specific: Wait for a group to not be present (with custom polling intervals)
     * Delegates to base class but adds e2e-specific polling strategy
     */
    async waitForGroupToNotBePresent(groupName: string, options: { timeout?: number } = {}) {
        await expect(this.page).toHaveURL(/\/dashboard/);
        const timeout = options.timeout || 5000;

        // Use base class method with e2e-specific polling
        await super.waitForGroupToDisappear(groupName, timeout);
    }

    /**
     * E2E-specific: Wait for a group to appear (delegates to base class)
     * Accepts options object for backwards compatibility
     */
    async waitForGroupToAppear(groupName: string, options: { timeout?: number } | number = {}) {
        const timeout = typeof options === 'number' ? options : options.timeout || 5000;
        await super.waitForGroupToAppear(groupName, timeout);
    }

    /**
     * E2E-specific: Click on a group card and navigate to group detail page
     * Use this method in e2e tests to get the GroupDetailPage instance
     *
     * This overrides the base class method to return GroupDetailPage instead of void.
     * TypeScript doesn't allow changing return types in overrides, but this is intentional
     * for e2e test workflows that need the page object instance.
     */
    // @ts-expect-error - Intentionally changing return type for e2e test ergonomics
    async clickGroupCard(groupName: string, groupId?: string): Promise<GroupDetailPage> {
        // Use base class method to click the group
        await super.clickGroupCard(groupName);

        // E2E-specific: Verify navigation to group detail page
        await expect(this.page).toHaveURL(groupDetailUrlPattern(groupId));

        // Return e2e-specific GroupDetailPage
        return new GroupDetailPage(this.page);
    }
}

import { expect, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { PooledTestUser } from '@splitifyd/shared';
import { CreateGroupModalPage } from './create-group-modal.page.ts';
import { GroupDetailPage, groupDetailUrlPattern } from './group-detail.page.ts';
import { generateShortId, randomString, CreateGroupFormDataBuilder, CreateGroupFormData } from '@splitifyd/test-support';
import { JoinGroupPage } from './join-group.page.ts';

let i = 0;

export class DashboardPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }

    // Selectors
    readonly url = '/dashboard';

    async navigate() {
        await this.page.goto(this.url);
        await this.waitForDomContentLoaded();
    }

    // Overload: Accept CreateGroupFormDataBuilder for builder pattern
    async createMultiUserGroup(dataBuilder: CreateGroupFormDataBuilder, ...dashboardPages: DashboardPage[]): Promise<GroupDetailPage[]>;
    // Overload: Accept plain object for backward compatibility
    async createMultiUserGroup(options: CreateGroupFormData, ...dashboardPages: DashboardPage[]): Promise<GroupDetailPage[]>;
    // Implementation
    async createMultiUserGroup(optionsOrBuilder: CreateGroupFormData | CreateGroupFormDataBuilder, ...dashboardPages: DashboardPage[]): Promise<GroupDetailPage[]> {
        // Handle both builder and plain object inputs
        const options = optionsOrBuilder instanceof CreateGroupFormDataBuilder
            ? optionsOrBuilder.build()
            : optionsOrBuilder;

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

    async createGroupAndNavigate(name: string = generateShortId(), description: string = generateShortId()): Promise<GroupDetailPage> {
        const currentUrl = this.page.url();
        if (!currentUrl.includes('/dashboard')) {
            await this.navigate();
        }
        await this.waitForDashboard();

        // Open modal and create group
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

    getCreateGroupButton() {
        return this.page.getByRole('button', { name: /Create.*Group/i }).first();
    }

    getBaseUrl() {
        return this.page.url().split('/dashboard')[0];
    }

    async openCreateGroupModal() {
        // Simply click the first visible create group button
        const createButton = this.page
            .getByRole('button')
            .filter({ hasText: /Create.*Group/i }) //there are several
            .first();

        await this.clickButton(createButton, { buttonName: 'Create Group' });

        // Create modal page instance first
        const createGroupModalPage = new CreateGroupModalPage(this.page, this.userInfo);

        // Wait for the modal to appear using the modal's own strict selector
        await createGroupModalPage.getModalDialog().waitFor({
            state: 'visible',
            timeout: 1000,
        });

        return createGroupModalPage;
    }

    async waitForDashboard() {
        // Wait for navigation to dashboard if not already there - handle both /dashboard and /dashboard/
        await expect(this.page).toHaveURL(/\/dashboard\/?$/);

        // Wait for the dashboard to be fully loaded
        await this.waitForDomContentLoaded();

        // Wait for the main dashboard content to appear
        await this.page.locator('h3:has-text("Your Groups")').waitFor();

        // Wait for loading spinner to disappear (handles race condition where spinner might never appear)
        const loadingSpinner = this.page.locator('span:has-text("Loading your groups...")');
        try {
            await loadingSpinner.waitFor({ state: 'hidden', timeout: 3000 });
        } catch {
            // Spinner never appeared or disappeared quickly - expected behavior
        }

        // Wait for groups content to be fully loaded
        // This ensures we wait for either groups to appear, empty state to show, or loading to complete
        await expect(async () => {
            // Check if groups container exists (means groups are loaded)
            const groupsContainer = this.page.getByTestId('groups-container');
            const hasGroupsContainer = await groupsContainer.isVisible().catch(() => false);

            // Check if empty state is shown (means no groups but loading is complete)
            const emptyState = this.page.getByRole('button', { name: /create.*first.*group/i });
            const hasEmptyState = await emptyState.isVisible().catch(() => false);

            // Check if error state is shown
            const errorState = this.page.getByTestId('groups-load-error-title');
            const hasErrorState = await errorState.isVisible().catch(() => false);

            // Check if loading spinner is shown (means still loading groups)
            const loadingSpinner = this.page.getByText('Loading your groups...');
            const hasLoadingSpinner = await loadingSpinner.isVisible().catch(() => false);

            if (!hasGroupsContainer && !hasEmptyState && !hasErrorState && !hasLoadingSpinner) {
                throw new Error('Groups content not yet loaded - waiting for groups container, empty state, error state, or loading spinner');
            }
        }).toPass({
            timeout: 5000,
            intervals: [100, 250, 500],
        });

        // Wait for DOM to be fully loaded
        await this.waitForDomContentLoaded();
    }

    /**
     * Wait for a group with the specified name to not be present on the dashboard
     * This handles async deletion processes and real-time updates properly
     */
    async waitForGroupToNotBePresent(groupName: string, options: { timeout?: number } = {}) {
        await expect(this.page).toHaveURL(/\/dashboard/);
        const timeout = options.timeout || 5000; // Default 5 seconds - allow time for real-time updates

        await expect(async () => {
            // Use exact match to avoid partial matches with updated group names
            const groupCard = this.page.getByText(groupName, { exact: true });
            const isVisible = await groupCard.isVisible();
            if (isVisible) {
                throw new Error(`Group "${groupName}" is still visible on dashboard`);
            }
        }).toPass({
            timeout,
            intervals: [100, 250, 500, 1000], // Check frequently initially, then less frequently
        });
    }

    /**
     * Wait for a group with the specified name to appear on the dashboard
     * This handles async creation processes and real-time updates properly
     */
    async waitForGroupToAppear(groupName: string, options: { timeout?: number } = {}) {
        const timeout = options.timeout || 5000; // Default 5 seconds - allow time for real-time updates

        await expect(async () => {
            const groupCard = this.page.getByText(groupName);
            const isVisible = await groupCard.isVisible();
            if (!isVisible) {
                throw new Error(`Group "${groupName}" is not yet visible on dashboard`);
            }
        }).toPass({
            timeout,
            intervals: [100, 250, 500], // Check frequently for appearance
        });
    }

    /**
     * Click on a group card to navigate to the group details page
     * This simulates the user clicking on a group from the dashboard
     */
    async clickGroupCard(groupName: string, groupId?: string) {
        // Ensure the group is visible first
        await this.waitForGroupToAppear(groupName);

        // Find the group card button and click it
        // Group cards are typically buttons containing the group name
        const groupCard = this.page.getByRole('button').filter({ hasText: groupName });
        await this.clickButton(groupCard, { buttonName: `Group: ${groupName}` });

        // Wait for navigation to complete
        await this.waitForDomContentLoaded();
        await expect(this.page).toHaveURL(groupDetailUrlPattern(groupId));

        return new GroupDetailPage(this.page);
    }
}

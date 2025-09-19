import {expect, Page} from '@playwright/test';
import {BasePage} from './base.page';
import {ARIA_ROLES, HEADINGS} from '../constants/selectors';
import {PooledTestUser} from '@splitifyd/shared';
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with {type: 'json'};
import {CreateGroupModalPage} from './create-group-modal.page.ts';
import {GroupDetailPage, groupDetailUrlPattern} from './group-detail.page.ts';
import {SettingsPage} from "./settings.page.ts";
import {generateShortId, generateTestGroupName} from "@splitifyd/test-support";
import {JoinGroupPage} from "./join-group.page.ts";

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

    async createMultiUserGroup(options: { name?: string, description?: string }, ...dashboardPages: DashboardPage[]): Promise<GroupDetailPage[]> {
        const groupName = options.name ?? generateTestGroupName(`g-${++i}`);
        const groupDescription = options.description ?? `descr for ${groupName}`;

        const groupDetailPage = await this.createGroupAndNavigate(groupName, groupDescription);
        const groupId = groupDetailPage.inferGroupId();
        await groupDetailPage.waitForPage(groupId, 1);

        // sanity check
        const name = await groupDetailPage.getGroupName();
        expect(groupName).toEqual(name);

        console.log(`new group created: "${groupName}" (${groupId})`);

        const groupDetailPages = [groupDetailPage];

        if (dashboardPages.length) {
            const shareLink = await groupDetailPage.getShareLink();

            for (const dashboardPage of dashboardPages) {
                const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(dashboardPage.page, shareLink, groupId);
                groupDetailPages.push(memberGroupDetailPage);
                const displayName = await dashboardPage.header.getCurrentUserDisplayName();
                console.log(`member "${displayName}" has joined group "${groupName}" (${groupId})`);
            };

            for (const newGroupDetailPage of groupDetailPages) {// wait for each page to sync before adding the next user
                await newGroupDetailPage.waitForPage(groupId, groupDetailPages.length)
            }
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
        const createGroupModal = new CreateGroupModalPage(this.page);
        await this.openCreateGroupModal();
        await createGroupModal.createGroup(name, description);


        // Wait for navigation and verify URL
        await this.expectUrl(groupDetailUrlPattern());
        await this.page.waitForLoadState('domcontentloaded', {timeout: 5000});
        await expect(this.page.getByRole('heading', { name })).toBeVisible();

        const groupDetailPage = new GroupDetailPage(this.page);
        const groupId = groupDetailPage.inferGroupId();

        await expect(this.page).toHaveURL(groupDetailUrlPattern(groupId));
        await groupDetailPage.ensureNewGroupPageReadyWithOneMember(groupId);

        return groupDetailPage;
    }

    getGroupsHeading() {
        return this.page.getByRole(ARIA_ROLES.HEADING, {name: HEADINGS.YOUR_GROUPS});
    }

    getCreateGroupButton() {
        return this.page.getByRole('button', {name: /Create.*Group/i}).first();
    }

    getBaseUrl() {
        return this.page.url().split('/dashboard')[0];
    }

    async clickSettings() {
        const settingsPage = new SettingsPage(this.page, this.userInfo);
        await settingsPage.navigate();
        return settingsPage;
    }

    async openCreateGroupModal() {
        // Simply click the first visible create group button
        const createButton = this.page
            .getByRole('button')
            .filter({hasText: /Create.*Group/i}) //there are several
            .first();

        // First verify button is visible before clicking
        await expect(createButton).toBeVisible({timeout: 5000});
        await this.clickButton(createButton, {buttonName: 'Create Group'});

        // Wait for the modal dialog container to appear first (more reliable)
        try {
            await this.page.getByRole('dialog').waitFor({
                state: 'visible',
                timeout: 3000,
            });
        } catch (error) {
            throw new Error(`Create Group modal did not open after clicking button. Dialog element not found. Original error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Additional verification: wait for the modal heading to appear
        // This provides extra confidence that the modal content has fully loaded
        try {
            await this.page.getByRole('heading', {name: translationEn.createGroupModal.title}).waitFor({
                state: 'visible',
                timeout: 3000,
            });
        } catch (error) {
            throw new Error(
                `Create Group modal opened but content did not load properly. Modal heading "${translationEn.createGroupModal.title}" not found. Original error: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return new CreateGroupModalPage(this.page, this.userInfo);
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
            await loadingSpinner.waitFor({state: 'hidden', timeout: 3000});
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
            const emptyState = this.page.getByRole('button', {name: /create.*first.*group/i});
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
     * Wait for dashboard, handling the case where user might be on 404 page due to group removal.
     * This method handles the real-time edge case where a removed user lands on 404 before being redirected.
     */
    async waitForDashboardWithFallback() {
        // Check if we're on a 404 page first (common when user is removed from group)
        const currentUrl = this.page.url();
        if (currentUrl.includes('/404')) {
            // Look for the "Go to Dashboard" button and click it
            const dashboardButton = this.page.getByRole('button', {name: 'Go to Dashboard'});
            await expect(dashboardButton).toBeVisible({timeout: 2000});
            await dashboardButton.click();

            // Wait for navigation to dashboard
            await expect(this.page).toHaveURL(/\/dashboard\/?$/, {timeout: 5000});
        }

        // Now wait for dashboard to be ready (either directly or after 404 redirect)
        await this.waitForDashboard();
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
            const groupCard = this.page.getByText(groupName, {exact: true});
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
     * Get a list of visible group names on the dashboard
     * Returns an array of group names that are currently visible
     */
    async getVisibleGroupNames(): Promise<string[]> {
        // Ensure we're on the dashboard and it's loaded
        await this.waitForDashboard();

        // Check if groups container exists (it won't exist if there are no groups)
        const groupsContainer = this.page.getByTestId('groups-container');
        const containerExists = await groupsContainer.isVisible().catch(() => false);

        // If no groups container, check for empty state
        if (!containerExists) {
            const emptyState = this.page.getByRole('button', {name: /create.*first.*group/i});
            const hasEmptyState = await emptyState.isVisible().catch(() => false);

            // Return empty array if we're in empty state
            if (hasEmptyState) {
                return [];
            }

            // If neither container nor empty state, something is wrong
            throw new Error('Dashboard in unexpected state - no groups container and no empty state');
        }

        // Groups container exists, get the group cards
        const groupCards = groupsContainer.getByTestId('group-card');
        const groupNames: string[] = [];

        const cardCount = await groupCards.count();
        for (let i = 0; i < cardCount; i++) {
            const card = groupCards.nth(i);
            // Get the group name from the h4 element which contains the group title
            const groupNameElement = card.locator('h4');
            const groupName = await groupNameElement.textContent();

            if (groupName && groupName.trim().length > 0) {
                groupNames.push(groupName.trim());
            }
        }

        return groupNames;
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
        const groupCard = this.page.getByRole('button').filter({hasText: groupName});
        await this.clickButton(groupCard, {buttonName: `Group: ${groupName}`});

        // Wait for navigation to complete
        await this.waitForDomContentLoaded();
        await expect(this.page).toHaveURL(groupDetailUrlPattern(groupId));

        return new GroupDetailPage(this.page);
    }
}

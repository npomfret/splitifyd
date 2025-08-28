import { Page, expect } from '@playwright/test';
import { DashboardPage, CreateGroupModalPage, GroupDetailPage } from '../pages';
import { groupDetailUrlPattern } from '../pages/group-detail.page.ts';

/**
 * Group workflow class that handles group creation and management flows.
 * Encapsulates group-related multi-step processes.
 */
export class GroupWorkflow {
    constructor(private page: Page) {}

    static async createGroup(page: Page, groupName: string, description?: string): Promise<string> {
        return new GroupWorkflow(page).createGroupAndNavigate(groupName, description);
    }

    /**
     * Creates a group and navigates to it, returning the group ID.
     * This encapsulates the multi-step workflow of group creation.
     */
    async createGroupAndNavigate(name: string, description?: string): Promise<string> {
        const dashboard = new DashboardPage(this.page);

        // Check if authentication is still valid before proceeding
        const currentUrl = this.page.url();
        if (currentUrl.includes('/login')) {
            throw new Error(`Authentication lost: User was redirected to login page. ` + `This indicates session expiration or authentication state loss. ` + `Current URL: ${currentUrl}`);
        }

        // Ensure we're on dashboard and fully loaded
        if (!currentUrl.includes('/dashboard')) {
            await dashboard.navigate();
        }
        await dashboard.waitForDashboard();

        // Open modal and create group
        const createGroupModal = new CreateGroupModalPage(this.page);
        await dashboard.openCreateGroupModal();
        await createGroupModal.createGroup(name, description);

        // Wait for navigation and verify URL
        await dashboard.expectUrl(groupDetailUrlPattern());

        // Extract and return group ID
        const groupId = dashboard.getUrlParam('groupId')!;

        // Verify we're on the correct group page by checking URL contains the pattern
        await expect(this.page).toHaveURL(groupDetailUrlPattern(groupId));

        await expect(this.page.getByText(name)).toBeVisible();

        await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        const groupDetailPage = new GroupDetailPage(this.page);
        await groupDetailPage.ensureNewGroupPageReadyWithOneMember(groupId);

        return groupId;
    }
}

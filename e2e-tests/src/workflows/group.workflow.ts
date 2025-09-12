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
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, description);
        return groupId;
    }

    /**
     * Creates a group and navigates to it, returning the group ID.
     * This encapsulates the multi-step workflow of group creation.
     */
    async createGroupAndNavigate(name: string, description?: string): Promise<string> {
        const dashboard = new DashboardPage(this.page);

        const currentUrl = this.page.url();
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
        await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify we're on the correct group page by checking URL contains the pattern
        await expect(this.page).toHaveURL(groupDetailUrlPattern());
        await expect(this.page.getByText(name)).toBeVisible();

        const groupDetailPage = new GroupDetailPage(this.page);
        const groupId = groupDetailPage.inferGroupId();

        await expect(this.page).toHaveURL(groupDetailUrlPattern(groupId));
        await groupDetailPage.ensureNewGroupPageReadyWithOneMember(groupId);

        return groupId;
    }
}

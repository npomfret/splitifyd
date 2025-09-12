import {Page} from '@playwright/test';
import {DashboardPage} from '../pages';

/**
 * @deprecated - just inline this
 */
export class GroupWorkflow {
    constructor(private page: Page) {}

    static async createGroup(page: Page, groupName: string, description?: string): Promise<string> {
        const dashboardPage = new DashboardPage(page);
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, description);
        return groupDetailPage.inferGroupId();
    }

    async createGroupAndNavigate(name: string, description?: string): Promise<string> {
        const dashboardPage = new DashboardPage(this.page);
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(name, description);
        return groupDetailPage.inferGroupId();
    }
}

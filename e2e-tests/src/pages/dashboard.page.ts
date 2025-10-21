import { expect, Page } from '@playwright/test';
import type { CreateGroupFormData } from '@splitifyd/shared';
import { DashboardPage as BaseDashboardPage, JoinGroupPage } from '@splitifyd/test-support';
import { CreateGroupFormDataBuilder, randomString } from '@splitifyd/test-support';
import { GroupDetailPage, groupDetailUrlPattern } from './group-detail.page.ts';

let i = 0;

/**
 * E2E-specific DashboardPage that extends the shared BaseDashboardPage
 * Adds multi-user group creation and advanced test workflows
 */
export class DashboardPage extends BaseDashboardPage {
    constructor(page: Page) {
        super(page);
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

        const groupDetailPage = await this.createGroupAndNavigate<GroupDetailPage>(groupName, groupDescription, {
            createGroupDetailPage: (page) => new GroupDetailPage(page),
            expectedMemberCount: 1,
        });
        const groupId = groupDetailPage.inferGroupId();

        // sanity check
        const name = await groupDetailPage.getGroupNameText();
        expect(groupName).toEqual(name);

        console.log(`New group created: "${groupName}" (id: ${groupId})`);

        const groupDetailPages = [groupDetailPage];

        if (dashboardPages.length) {
            const shareModal = await groupDetailPage.clickShareGroupAndOpenModal();
            const shareLink = await shareModal.getShareLink();
            await shareModal.closeModal();

            for (const dashboardPage of dashboardPages) {
                // Join using new POM from test-support
                const joinGroupPage = new JoinGroupPage(dashboardPage.page);
                await joinGroupPage.joinGroupUsingShareLink(shareLink);
                await expect(dashboardPage.page).toHaveURL(groupDetailUrlPattern(groupId));

                // Create e2e GroupDetailPage instance (has waitForPage method)
                const memberGroupDetailPage = new GroupDetailPage(dashboardPage.page);
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
     * E2E-specific utility to get base URL from current dashboard URL
     */
    getBaseUrl() {
        return this.page.url().split('/dashboard')[0];
    }

    // @ts-expect-error - Intentionally changing return type for e2e test ergonomics
    async clickGroupCard(groupName: string, groupId?: string): Promise<GroupDetailPage> {
        return super.clickGroupCardAndNavigateToDetail<GroupDetailPage>(groupName, {
            expectedGroupId: groupId,
            createGroupDetailPage: (page) => new GroupDetailPage(page),
        });
    }
}

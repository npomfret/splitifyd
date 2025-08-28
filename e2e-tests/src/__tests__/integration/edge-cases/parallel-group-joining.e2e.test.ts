import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { setupMCPDebugOnFailure } from '../../../helpers';
import { DashboardPage, GroupDetailPage, JoinGroupPage, LoginPage } from '../../../pages';
import { GroupWorkflow } from '../../../workflows';
import { DEFAULT_PASSWORD, generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';
import { getUserPool } from '../../../fixtures/user-pool.fixture';
import { User } from '@splitifyd/shared';

setupMCPDebugOnFailure();

test.describe('Parallel Group Joining Edge Cases', () => {
    const userPool = getUserPool();
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const users: User[] = [];

    async function _prepareUsers(totalUsers: number, browser: Browser) {
        for (let i = 0; i < totalUsers; i++) {
            const context = await browser.newContext();

            const page = await context.newPage();
            const user = await userPool.claimUser(browser);

            const loginPage = new LoginPage(page);
            await loginPage.navigate();
            await loginPage.login(user.email, DEFAULT_PASSWORD);

            const dashboardPage = new DashboardPage(page);
            await dashboardPage.waitForDashboard();

            contexts.push(context);
            pages.push(page);
            users.push(user);
        }
    }

    test('should handle multiple users joining group in parallel', async ({ browser }) => {
        test.setTimeout(60000);

        const totalUsers = 4;

        try {
            // Set up authenticated users
            await _prepareUsers(totalUsers, browser);

            // Creator creates group, others join it
            const [creatorPage, ...otherPages] = pages;
            const creatorGroupDetailPage = new GroupDetailPage(creatorPage);

            await creatorPage.goto('/dashboard');
            const groupWorkflow = new GroupWorkflow(creatorPage);
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Parallel'), 'Testing parallel join');

            // Get share link
            const shareLink = await creatorGroupDetailPage.getShareLink();

            // Other users join in parallel
            await Promise.all(
                otherPages.map(async (page, i) => {
                    const joinGroupPage = new JoinGroupPage(page);
                    // Use the joinGroup method with proper error handling
                    await joinGroupPage.joinGroupUsingShareLink(shareLink);
                }),
            );

            // Verify all users see complete member list

            for (const page of pages) {
                const groupDetailPage = new GroupDetailPage(page);
                await groupDetailPage.waitForMemberCount(totalUsers, 5000);

                // Check all names visible
                for (const user of users) {
                    await expect(page.getByText(user.displayName).first()).toBeVisible();
                }
            }

            console.log(`✅ All ${totalUsers} users joined successfully`);
        } finally {
            try {
                await Promise.all(contexts.map((c) => c.close()));
            } catch (e) {}

            try {
                users.forEach((u) => userPool.releaseUser(u));
            } catch (e) {}
        }
    });
});

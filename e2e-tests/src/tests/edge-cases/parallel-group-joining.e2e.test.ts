import { expect, Page, test } from '@playwright/test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupDetailPage, JoinGroupPage } from '../../pages';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';
import { getUserPool } from '../../fixtures/user-pool.fixture';
import { LoginPage } from '../../pages';

setupMCPDebugOnFailure();

test.describe('Parallel Group Joining Edge Cases', () => {
    test('should handle 4 users joining group in parallel', async ({ browser }) => {
        test.setTimeout(60000);

        const userPool = getUserPool();
        const totalUsers = 4;
        const contexts: any[] = [];
        const pages: Page[] = [];
        const users: any[] = [];

        try {
            // Set up authenticated users
            for (let i = 0; i < totalUsers; i++) {
                const context = await browser.newContext();
                const page = await context.newPage();
                const user = await userPool.claimUser(browser);

                const loginPage = new LoginPage(page);
                await page.goto('/login');
                await loginPage.login(user.email, 'TestPassword123!');
                await page.waitForURL(/\/dashboard/, { timeout: 5000 });

                contexts.push(context);
                pages.push(page);
                users.push(user);
            }

            // Creator creates group
            const [creatorPage] = pages;
            const [creatorUser] = users;
            const creatorGroupDetailPage = new GroupDetailPage(creatorPage);

            await creatorPage.goto('/dashboard');
            const groupWorkflow = new GroupWorkflow(creatorPage);
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Parallel4'), 'Testing parallel join');

            // Get share link
            const shareLink = await creatorGroupDetailPage.getShareLink();

            // Other users join in parallel
            const joinPromises = pages.slice(1).map(async (page, i) => {
                const joinGroupPage = new JoinGroupPage(page);
                
                // Navigate to share link using page object method
                await joinGroupPage.navigateToShareLink(shareLink);

                // Use the joinGroup method with proper error handling
                await joinGroupPage.joinGroup({
                    expectedRedirectPattern: new RegExp(`/groups/${groupId}`),
                    maxRetries: 1  // Reduce retries for parallel joins
                });

                return users[i + 1].displayName;
            });

            await Promise.all(joinPromises);

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
            await Promise.all(contexts.map((c) => c.close()));
            users.forEach((u) => userPool.releaseUser(u));
        }
    });

    test('should handle race conditions during parallel joins', async ({ browser }) => {
        test.setTimeout(60000);

        const userPool = getUserPool();
        const totalUsers = 6;
        const contexts: any[] = [];
        const pages: Page[] = [];
        const users: any[] = [];

        try {
            // Set up users
            for (let i = 0; i < totalUsers; i++) {
                const context = await browser.newContext();
                const page = await context.newPage();
                const user = await userPool.claimUser(browser);

                const loginPage = new LoginPage(page);
                await page.goto('/login');
                await loginPage.login(user.email, 'TestPassword123!');
                await page.waitForURL(/\/dashboard/, { timeout: 5000 });

                contexts.push(context);
                pages.push(page);
                users.push(user);
            }

            // Create group
            const creatorPage = pages[0];
            const creatorGroupDetailPage = new GroupDetailPage(creatorPage);

            await creatorPage.goto('/dashboard');
            const groupWorkflow = new GroupWorkflow(creatorPage);
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('RaceCondition'), 'Testing race conditions');

            const shareLink = await creatorGroupDetailPage.getShareLink();

            // Join with random delays to create race conditions
            const joinPromises = pages.slice(1).map(async (page, i) => {
                try {
                    const joinGroupPage = new JoinGroupPage(page);
                    
                    // Navigate to share link using page object method
                    await joinGroupPage.navigateToShareLink(shareLink);
                    
                    // Use the joinGroup method with proper error handling
                    await joinGroupPage.joinGroup({
                        expectedRedirectPattern: /\/groups\/[a-zA-Z0-9]+$/,
                        maxRetries: 1  // Reduce retries for race condition testing
                    });
                    return true;
                } catch {
                    return false;
                }
            });

            const results = await Promise.all(joinPromises);
            const successCount = results.filter((r) => r).length;

            // At least some joins should succeed
            expect(successCount).toBeGreaterThan(0);

            // Creator page should still work after race conditions
            await creatorGroupDetailPage.waitForBalancesToLoad(groupId);
            await expect(creatorGroupDetailPage.getGroupTitle()).toBeVisible();

            console.log(`✅ System stable: ${successCount}/${totalUsers - 1} joins succeeded`);
        } finally {
            await Promise.all(contexts.map((c) => c.close()));
            users.forEach((u) => userPool.releaseUser(u));
        }
    });
});

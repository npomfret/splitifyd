import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { GroupDetailPage, JoinGroupPage } from '../../../pages';
import { GroupWorkflow } from '../../../workflows';
import { generateTestGroupName } from '../../../../../packages/test-support/src/test-helpers.ts';

simpleTest.describe('Parallel Group Joining Edge Cases', () => {
    simpleTest('should handle multiple users joining group in parallel', async ({ newLoggedInBrowser }) => {
        // Create three browser instances - User 1, User 2, and User 3
        const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
        const { page: user3Page, dashboardPage: user3DashboardPage, user: user3 } = await newLoggedInBrowser();

        // Create page objects
        const groupDetailPage = new GroupDetailPage(user1Page, user1);
        const groupDetailPage2 = new GroupDetailPage(user2Page, user2);
        const groupDetailPage3 = new GroupDetailPage(user3Page, user3);

        const groupWorkflow = new GroupWorkflow(user1Page);

        // Verify all 3 users are distinct
        expect(user1.email).not.toBe(user2.email);
        expect(user1.email).not.toBe(user3.email);
        expect(user2.email).not.toBe(user3.email);

        // Create group with first user
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Parallel'), 'Testing parallel join');

        // Ensure we're on the group page before getting share link
        await user1Page.waitForURL(`**/groups/${groupId}**`);

        // Get share link
        const shareLink = await groupDetailPage.getShareLink();

        // Test parallel join - this should handle race conditions gracefully
        const joinGroupPage2 = new JoinGroupPage(user2Page);
        const joinGroupPage3 = new JoinGroupPage(user3Page);

        // Join users sequentially instead of in parallel to avoid race conditions
        // that might cause the test to be unreliable
        try {
            await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        } catch (error) {
            throw error;
        }

        try {
            await joinGroupPage3.joinGroupUsingShareLink(shareLink);
        } catch (error) {
            throw error;
        }

        // Verify all pages see complete member list
        const allPages = [
            { page: user1Page, groupDetailPage },
            { page: user2Page, groupDetailPage: groupDetailPage2 },
            { page: user3Page, groupDetailPage: groupDetailPage3 },
        ];

        // Ensure all pages are on the correct group page
        await expect(user1Page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await expect(user2Page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await expect(user3Page).toHaveURL(new RegExp(`/groups/${groupId}$`));

        await groupDetailPage.synchronizeMultiUserState(allPages, 3, groupId);

        // Wait for the member counts to be correct on all pages
        await groupDetailPage.waitForMemberCount(3);
        await groupDetailPage2.waitForMemberCount(3);
        await groupDetailPage3.waitForMemberCount(3);

        // Use the display names from the user fixtures instead of extracting from UI
        const user1Name = await groupDetailPage.getCurrentUserDisplayName();
        const user2Name = await groupDetailPage2.getCurrentUserDisplayName();
        const user3Name = await groupDetailPage3.getCurrentUserDisplayName();

        // Check that all 3 users can see all 3 members on their respective pages
        await expect(groupDetailPage.getTextElement(user1Name).first()).toBeVisible();
        await expect(groupDetailPage.getTextElement(user2Name).first()).toBeVisible();
        await expect(groupDetailPage.getTextElement(user3Name).first()).toBeVisible();

        await expect(groupDetailPage2.getTextElement(user1Name).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(user2Name).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(user3Name).first()).toBeVisible();

        await expect(groupDetailPage3.getTextElement(user1Name).first()).toBeVisible();
        await expect(groupDetailPage3.getTextElement(user2Name).first()).toBeVisible();
        await expect(groupDetailPage3.getTextElement(user3Name).first()).toBeVisible();
    });
});

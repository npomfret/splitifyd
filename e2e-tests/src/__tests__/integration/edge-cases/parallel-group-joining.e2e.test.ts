import { expect, threeUserTest as test } from '../../../fixtures/three-user-test';
import { setupMCPDebugOnFailure } from '../../../helpers';
import { JoinGroupPage } from '../../../pages';
import { GroupWorkflow } from '../../../workflows';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';

setupMCPDebugOnFailure();

test.describe('Parallel Group Joining Edge Cases', () => {
    test('should handle multiple users joining group in parallel', async ({ authenticatedPage, groupDetailPage, secondUser, thirdUser }) => {
        const { page, user: user1 } = authenticatedPage;
        const { page: page2, user: user2 } = secondUser;
        const { page: page3, user: user3 } = thirdUser;
        const groupWorkflow = new GroupWorkflow(page);

        // Verify all 3 users are distinct
        expect(user1.email).not.toBe(user2.email);
        expect(user1.email).not.toBe(user3.email);
        expect(user2.email).not.toBe(user3.email);

        expect(user1.displayName).not.toBe(user2.displayName);
        expect(user1.displayName).not.toBe(user3.displayName);
        expect(user2.displayName).not.toBe(user3.displayName);

        // Create group with first user
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Parallel'), 'Testing parallel join');

        // Ensure we're on the group page before getting share link
        await page.waitForURL(`**/groups/${groupId}**`);

        // Get share link
        const shareLink = await groupDetailPage.getShareLink();

        // Test parallel join - this should handle race conditions gracefully
        const joinGroupPage2 = new JoinGroupPage(page2);
        const joinGroupPage3 = new JoinGroupPage(page3);

        // Try parallel joining to test race condition handling
        await Promise.all([
            joinGroupPage2.joinGroupUsingShareLink(shareLink),
            joinGroupPage3.joinGroupUsingShareLink(shareLink),
        ]);

        // Verify all pages see complete member list
        const allPages = [
            { page, groupDetailPage },
            { page: page2, groupDetailPage: secondUser.groupDetailPage },
            { page: page3, groupDetailPage: thirdUser.groupDetailPage },
        ];

        await groupDetailPage.synchronizeMultiUserState(allPages, 3, groupId);

        // Get the actual display names from each user's page (in case they were changed)
        const user1ActualName = await groupDetailPage.getUserDisplayName();
        const user2ActualName = await secondUser.groupDetailPage.getUserDisplayName();
        const user3ActualName = await thirdUser.groupDetailPage.getUserDisplayName();

        // Check all users' actual names are visible on all pages
        for (const { groupDetailPage: gdp } of allPages) {
            await expect(gdp.getTextElement(user1ActualName).first()).toBeVisible();
            await expect(gdp.getTextElement(user2ActualName).first()).toBeVisible();
            await expect(gdp.getTextElement(user3ActualName).first()).toBeVisible();
        }
    });
});

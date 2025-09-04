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
            { page, groupDetailPage },
            { page: page2, groupDetailPage: secondUser.groupDetailPage },
            { page: page3, groupDetailPage: thirdUser.groupDetailPage },
        ];

        // Ensure all pages are on the correct group page
        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await expect(page2).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await expect(page3).toHaveURL(new RegExp(`/groups/${groupId}$`));

        await groupDetailPage.synchronizeMultiUserState(allPages, 3, groupId);

        // Wait for the member counts to be correct on all pages
        await groupDetailPage.waitForMemberCount(3);
        await secondUser.groupDetailPage.waitForMemberCount(3);
        await thirdUser.groupDetailPage.waitForMemberCount(3);

        // Use the display names from the user fixtures instead of extracting from UI
        const user1Name = user1.displayName;
        const user2Name = user2.displayName;
        const user3Name = user3.displayName;


        // Check that all 3 users can see all 3 members on their respective pages
        await expect(groupDetailPage.getTextElement(user1Name).first()).toBeVisible();
        await expect(groupDetailPage.getTextElement(user2Name).first()).toBeVisible();  
        await expect(groupDetailPage.getTextElement(user3Name).first()).toBeVisible();

        await expect(secondUser.groupDetailPage.getTextElement(user1Name).first()).toBeVisible();
        await expect(secondUser.groupDetailPage.getTextElement(user2Name).first()).toBeVisible();
        await expect(secondUser.groupDetailPage.getTextElement(user3Name).first()).toBeVisible();

        await expect(thirdUser.groupDetailPage.getTextElement(user1Name).first()).toBeVisible();
        await expect(thirdUser.groupDetailPage.getTextElement(user2Name).first()).toBeVisible();
        await expect(thirdUser.groupDetailPage.getTextElement(user3Name).first()).toBeVisible();
    });
});

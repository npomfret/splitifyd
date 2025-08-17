import { expect, test } from '@playwright/test';
import { fourUserTest } from '../../fixtures/multi-user-declarative';
import { multiUserTest } from '../../fixtures';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow, MultiUserWorkflow } from '../../workflows';
import { generateShortId } from '../../utils/test-helpers';

setupMCPDebugOnFailure();

test.describe('Share Link - Edge Cases', () => {
    test.describe('Rapid Multiple Joins', () => {
        fourUserTest('should work reliably with multiple rapid joins', async ({ users }) => {
            const creatorUser = users[0];
            const { page: creatorPage, user: creator } = creatorUser;
            const groupDetailPage = creatorUser.pages.groupDetail;

            // Create group
            const uniqueId = generateShortId();
            const groupWorkflow = new GroupWorkflow(creatorPage);
            await groupWorkflow.createGroupAndNavigate(`Rapid Join Test ${uniqueId}`, 'Testing rapid multiple joins');

            const multiUserWorkflow = new MultiUserWorkflow();
            const shareLink = await multiUserWorkflow.getShareLink(creatorPage);

            // Have the other 3 users join rapidly
            const { JoinGroupPage } = await import('../../pages');
            const joinPromises = users.slice(1).map(async (userFixture) => {
                const joinGroupPage = new JoinGroupPage(userFixture.page);
                const joinResult = await joinGroupPage.attemptJoinWithStateDetection(shareLink, { 
                    displayName: userFixture.user.displayName, 
                    email: userFixture.user.email 
                });
                if (!joinResult.success) {
                    throw new Error(`Failed to join group: ${joinResult.reason}`);
                }
            });

            // Wait for all joins to complete
            await Promise.all(joinPromises);

            // Verify all users joined
            await groupDetailPage.waitForMemberCount(4); // Creator + 3 joiners
        });
    });

    test.describe('Multiple Share Link Operations', () => {
        multiUserTest('should handle multiple share link operations', async ({ authenticatedPage, groupDetailPage }) => {
            const { page } = authenticatedPage;
            // User is already authenticated via fixture
            const groupWorkflow = new GroupWorkflow(page);
            const multiUserWorkflow = new MultiUserWorkflow();

            const shareLinks: string[] = [];

            // Create groups sequentially to avoid modal conflicts
            for (let i = 0; i < 3; i++) {
                const uniqueId = generateShortId();
                await groupWorkflow.createGroupAndNavigate(`Sequential Test ${i} ${uniqueId}`, `Testing operations ${i}`);
                const shareLink = await multiUserWorkflow.getShareLink(page);
                shareLinks.push(shareLink);

                // Navigate back to dashboard for next iteration
                await groupDetailPage.navigateToDashboard();
            }

            // All share links should be valid and unique
            expect(shareLinks).toHaveLength(3);
            shareLinks.forEach((link) => {
                expect(link).toContain('/join?linkId=');
            });

            // All links should be different
            const uniqueLinks = new Set(shareLinks);
            expect(uniqueLinks.size).toBe(3);
        });
    });
});

import { test, expect } from '@playwright/test';
import { fourUserTest } from '../../fixtures/multi-user-declarative';
import { multiUserTest } from '../../fixtures';
import { setupMCPDebugOnFailure, EMULATOR_URL } from '../../helpers';
import { MultiUserWorkflow } from '../../workflows';
import { GroupWorkflow } from '../../workflows';
import { generateShortId } from '../../utils/test-helpers';

setupMCPDebugOnFailure();

test.describe('Share Link - Edge Cases', () => {
  test.describe('Rapid Multiple Joins', () => {
    fourUserTest('should work reliably with multiple rapid joins', async ({ 
      users
    }) => {
      const creatorUser = users[0];
      const { page: creatorPage, user: creator } = creatorUser;
      const groupDetailPage = creatorUser.pages.groupDetail;
      
      // Create group
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(creatorPage);
      await groupWorkflow.createGroup(`Rapid Join Test ${uniqueId}`, 'Testing rapid multiple joins');

      const multiUserWorkflow = new MultiUserWorkflow(null);
      const shareLink = await multiUserWorkflow.getShareLink(creatorPage);

      // Have the other 3 users join rapidly
      const joinPromises = users.slice(1).map(userFixture => 
        multiUserWorkflow.joinGroupViaShareLink(userFixture.page, shareLink, userFixture.user)
      );

      // Wait for all joins to complete
      await Promise.all(joinPromises);

      // Verify all users joined
      await groupDetailPage.waitForMemberCount(4); // Creator + 3 joiners
    });
  });

  test.describe('Multiple Share Link Operations', () => {
    multiUserTest('should handle multiple share link operations', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      // User is already authenticated via fixture
      const groupWorkflow = new GroupWorkflow(page);
      const multiUserWorkflow = new MultiUserWorkflow(null);
      
      const shareLinks: string[] = [];
      
      // Create groups sequentially to avoid modal conflicts
      for (let i = 0; i < 3; i++) {
        const uniqueId = generateShortId();
        await groupWorkflow.createGroup(`Sequential Test ${i} ${uniqueId}`, `Testing operations ${i}`);
        const shareLink = await multiUserWorkflow.getShareLink(page);
        shareLinks.push(shareLink);
        
        // Navigate back to dashboard for next iteration
        await groupDetailPage.navigateToDashboard();
      }
      
      // All share links should be valid and unique
      expect(shareLinks).toHaveLength(3);
      shareLinks.forEach(link => {
        expect(link).toContain('/join?linkId=');
      });
      
      // All links should be different
      const uniqueLinks = new Set(shareLinks);
      expect(uniqueLinks.size).toBe(3);
    });
  });
});
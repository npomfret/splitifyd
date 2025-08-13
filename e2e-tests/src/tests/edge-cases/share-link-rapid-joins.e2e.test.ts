import { test } from '@playwright/test';
import { fourUserTest } from '../../fixtures/multi-user-declarative';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { MultiUserWorkflow } from '../../workflows/multi-user.workflow';
import { GroupWorkflow } from '../../workflows/group.workflow';
import { generateShortId } from '../../utils/test-helpers';

setupConsoleErrorReporting();
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

      const multiUserWorkflow = new MultiUserWorkflow();
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
});
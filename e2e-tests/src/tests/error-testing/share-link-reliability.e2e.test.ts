import { multiUserTest } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { MultiUserWorkflow } from '../../workflows/multi-user.workflow';
import { GroupWorkflow } from '../../workflows/group.workflow';
import { generateShortId } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

multiUserTest.describe('Share Link - Reliability Testing', () => {
  multiUserTest('should recover from network interruptions during join', async ({ 
    authenticatedPage, 
    groupDetailPage,
    secondUser 
  }) => {
    const { page: creatorPage } = authenticatedPage;
    const { page: page2, user: user2, groupDetailPage: groupDetailPage2 } = secondUser;
    
    // Create group
    const uniqueId = generateShortId();
    const groupWorkflow = new GroupWorkflow(creatorPage);
    await groupWorkflow.createGroup(`Network Recovery Test ${uniqueId}`, 'Testing network recovery');

    const multiUserWorkflow = new MultiUserWorkflow();
    const shareLink = await multiUserWorkflow.getShareLink(creatorPage);

    // Simulate network interruption by going offline briefly
    await page2.context().setOffline(true);
    
    // Wait a bit
    await page2.waitForTimeout(1000);
    
    // Go back online
    await page2.context().setOffline(false);
    
    // Should still be able to join (retry logic should handle this)
    await multiUserWorkflow.joinGroupViaShareLink(page2, shareLink, user2);
    
    // Verify join succeeded
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    await groupDetailPage2.waitForMemberCount(2);
  });
});
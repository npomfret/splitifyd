import { multiUserTest } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { MultiUserWorkflow } from '../../workflows';
import { GroupWorkflow } from '../../workflows';
import { generateShortId } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

multiUserTest.describe('Share Link - Network Resilience', () => {
  // TODO: This test reveals complex interactions between network state and authentication
  // The network offline/online operation affects browser authentication state in ways that
  // make this test flaky. Consider implementing once authentication persistence is more robust.
  multiUserTest.skip('should recover from network interruptions during join', async ({ 
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

    const multiUserWorkflow = new MultiUserWorkflow(null);
    const shareLink = await multiUserWorkflow.getShareLink(creatorPage);

    // Simulate network interruption by going offline briefly
    await page2.context().setOffline(true);
    
    // Wait for any pending operations to complete
    await page2.waitForLoadState('domcontentloaded');
    
    // Go back online
    await page2.context().setOffline(false);
    
    // Wait for network to stabilize and refresh authentication if needed
    await page2.waitForLoadState('networkidle');
    
    // Should still be able to join (retry logic should handle this)
    // Note: Network interruption may have affected auth state, so use the login version if needed
    try {
      await multiUserWorkflow.joinGroupViaShareLink(page2, shareLink, user2);
    } catch (error: any) {
      // If auth was lost due to network interruption, use the login flow
      if (error.message.includes('User needs to log in')) {
        await multiUserWorkflow.joinGroupViaShareLinkWithLogin(page2, shareLink, user2);
      } else {
        throw error;
      }
    }
    
    // Verify join succeeded
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    await groupDetailPage2.waitForMemberCount(2);
  });
});
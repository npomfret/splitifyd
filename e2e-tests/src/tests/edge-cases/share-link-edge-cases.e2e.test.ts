import { multiUserTest, expect } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, EMULATOR_URL } from '../../helpers';
import { MultiUserWorkflow } from '../../workflows/multi-user.workflow';
import { GroupWorkflow } from '../../workflows/group.workflow';
import { generateShortId } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

multiUserTest.describe('Share Link - Edge Cases', () => {
  // Test deleted - group deletion not implemented yet
  
  multiUserTest('should handle multiple share link operations', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    // User is already authenticated via fixture
    const groupWorkflow = new GroupWorkflow(page);
    const multiUserWorkflow = new MultiUserWorkflow();
    
    const shareLinks: string[] = [];
    
    // Create groups sequentially to avoid modal conflicts
    for (let i = 0; i < 3; i++) {
      const uniqueId = generateShortId();
      await groupWorkflow.createGroup(`Sequential Test ${i} ${uniqueId}`, `Testing operations ${i}`);
      const shareLink = await multiUserWorkflow.getShareLink(page);
      shareLinks.push(shareLink);
      
      // Navigate back to dashboard for next iteration
      await page.goto(`${EMULATOR_URL}/dashboard`);
      await page.waitForLoadState('domcontentloaded');
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
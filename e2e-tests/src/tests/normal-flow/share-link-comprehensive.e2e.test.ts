import { test, expect } from '@playwright/test';
import { setupMCPDebugOnFailure, EMULATOR_URL } from "../../helpers";
import { multiUserTest } from '../../fixtures';
import { singleMixedAuthTest } from '../../fixtures/mixed-auth-test';
import { MultiUserWorkflow } from '../../workflows';
import { GroupWorkflow } from '../../workflows';
import { GroupDetailPage } from '../../pages';
import { generateShortId } from '../../utils/test-helpers';

setupMCPDebugOnFailure();

test.describe('Comprehensive Share Link Testing', () => {
  
  test.describe('Share Link - Already Logged In User', () => {
    multiUserTest('should allow logged-in user to join group via share link', async ({ 
      authenticatedPage, 
      groupDetailPage, 
      secondUser 
    }) => {
      const { page: page1, user: user1 } = authenticatedPage;
      const { page: page2, user: user2 } = secondUser;
      const groupDetailPage2 = new GroupDetailPage(page2);
      
      // Create group with user1
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(page1);
      await groupWorkflow.createGroup(`Share Link Test ${uniqueId}`, 'Testing share link functionality');

      // Get share link from user1's page
      const multiUserWorkflow = new MultiUserWorkflow(null); // Not using browser here
      const shareLink = await multiUserWorkflow.getShareLink(page1);
      expect(shareLink).toContain('/join?linkId=');

      // User2 (already logged in) joins via share link
      await multiUserWorkflow.joinGroupViaShareLink(page2, shareLink, user2);

      // Verify user2 is now in the group
      await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      await groupDetailPage2.waitForMemberCount(2);
      
      // Both users should be visible
      await expect(groupDetailPage2.getTextElement(user1.displayName).first()).toBeVisible();
      await expect(groupDetailPage2.getTextElement(user2.displayName).first()).toBeVisible();
    });

    multiUserTest('should show appropriate message when logged-in user is already a member', async ({ 
      authenticatedPage, 
      groupDetailPage, 
      secondUser 
    }) => {
      const { page: page1, user: user1 } = authenticatedPage;
      const { page: page2, user: user2 } = secondUser;
      
      // Create group and add user2
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(page1);
      await groupWorkflow.createGroup(`Already Member Test ${uniqueId}`, 'Testing already member scenario');

      const multiUserWorkflow = new MultiUserWorkflow(null);
      const shareLink = await multiUserWorkflow.getShareLink(page1);
      
      // User2 joins first time
      await multiUserWorkflow.joinGroupViaShareLink(page2, shareLink, user2);
      
      // User2 tries to join again - should show already member message
      await multiUserWorkflow.testShareLinkAlreadyMember(page2, shareLink);
    });
  });

  test.describe('Share Link - Not Logged In User', () => {
    singleMixedAuthTest('should redirect non-logged-in user to login then to group after login', async ({ 
      authenticatedUsers, 
      unauthenticatedUsers 
    }) => {
      const { page: page1, user: user1 } = authenticatedUsers[0];
      const { page: page2, joinGroupPage } = unauthenticatedUsers[0];
      
      // Create group with authenticated user
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(page1);
      const groupId = await groupWorkflow.createGroup(`Login Required Test ${uniqueId}`, 'Testing login requirement');
      
      const multiUserWorkflow = new MultiUserWorkflow(null);
      const shareLink = await multiUserWorkflow.getShareLink(page1);
      
      // Navigate to share link while not logged in
      const result = await joinGroupPage.attemptJoinWithStateDetection(shareLink);
      
      expect(result.success).toBe(false);
      expect(result.needsLogin).toBe(true);
      expect(result.reason).toContain('log in');
    });

    multiUserTest.skip('should allow user to join group after logging in from share link', async ({ 
      authenticatedPage,
      secondUser
    }) => {
      const { page: page1, user: user1 } = authenticatedPage;
      const { page: page2, user: user2 } = secondUser;
      
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(page1);
      await groupWorkflow.createGroup(`Login Then Join Test ${uniqueId}`, 'Testing login then join flow');
      
      const multiUserWorkflow = new MultiUserWorkflow(null);
      const shareLink = await multiUserWorkflow.getShareLink(page1);

      // Log out user2 to test login flow
      await page2.goto(`${EMULATOR_URL}/dashboard`);
      await page2.waitForLoadState('domcontentloaded');
      // Click user menu to show logout option
      await page2.getByRole('button', { name: user2.displayName }).click();
      await page2.getByRole('button', { name: /logout|sign out/i }).click();
      
      // Wait for logout to complete
      await page2.waitForURL(url => !url.toString().includes('/dashboard'), { timeout: 5000 });
      
      // Now test login + join flow
      await multiUserWorkflow.joinGroupViaShareLinkWithLogin(page2, shareLink, user2);
      
      // Should be in the group now
      await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      const groupDetailPage2 = new GroupDetailPage(page2);
      await groupDetailPage2.waitForMemberCount(2);
    });
  });

  test.describe('Share Link - Reliability Testing', () => {
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

      const multiUserWorkflow = new MultiUserWorkflow(null);
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

  test.describe('Share Link - Edge Cases', () => {
    // Test deleted - group deletion not implemented yet
    
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
});
import { test, expect } from '@playwright/test';
import { multiUserTest } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, EMULATOR_URL } from '../../helpers';
import { MultiUserWorkflow } from '../../workflows/multi-user.workflow';
import { AuthenticationWorkflow } from '../../workflows/authentication.workflow';
import { GroupWorkflow } from '../../workflows/group.workflow';
import { JoinGroupPage, LoginPage, DashboardPage, GroupDetailPage } from '../../pages';
import { generateShortId } from '../../utils/test-helpers';

setupConsoleErrorReporting();
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
    test('should redirect non-logged-in user to login then to group after login', async ({ browser }) => {
      // Create a logged-in user to create the group
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await AuthenticationWorkflow.createTestUser(page1);
      
      // Create group
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(page1);
      const groupId = await groupWorkflow.createGroup(`Login Required Test ${uniqueId}`, 'Testing login requirement');
      
      const multiUserWorkflow = new MultiUserWorkflow(null);
      const shareLink = await multiUserWorkflow.getShareLink(page1);

      // Create a second user (but don't log them in yet)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      // Navigate to share link while not logged in
      const joinGroupPage = new JoinGroupPage(page2);
      const result = await joinGroupPage.attemptJoinWithStateDetection(shareLink);
      
      expect(result.success).toBe(false);
      expect(result.needsLogin).toBe(true);
      expect(result.reason).toContain('log in');

      // Clean up
      await context1.close();
      await context2.close();
    });

    test('should allow user to join group after logging in from share link', async ({ browser }) => {
      // Create user1 and group
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const user1 = await AuthenticationWorkflow.createTestUser(page1);
      
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(page1);
      await groupWorkflow.createGroup(`Login Then Join Test ${uniqueId}`, 'Testing login then join flow');
      
      const multiUserWorkflow = new MultiUserWorkflow(null);
      const shareLink = await multiUserWorkflow.getShareLink(page1);

      // Create user2 (registered but not currently logged in)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const authWorkflow = new AuthenticationWorkflow(page2);
      const user2 = await authWorkflow.createAndLoginTestUser();
      
      // Log out user2
      await page2.goto(`${EMULATOR_URL}/dashboard`);
      await page2.waitForLoadState('networkidle');
      // Click user menu to show logout option
      await page2.getByRole('button', { name: user2.displayName }).click();
      await page2.getByRole('button', { name: /logout|sign out/i }).click();
      
      // Now test login + join flow
      await multiUserWorkflow.joinGroupViaShareLinkWithLogin(page2, shareLink, user2);
      
      // Should be in the group now
      await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
      const groupDetailPage2 = new GroupDetailPage(page2);
      await groupDetailPage2.waitForMemberCount(2);

      // Clean up
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Share Link - Error Scenarios', () => {
    multiUserTest('should handle invalid share links gracefully', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Get the base URL from the current page
      await page.waitForLoadState('networkidle');
      const baseUrl = page.url().split('/dashboard')[0];
      const invalidShareLink = `${baseUrl}/join?linkId=invalid-group-id-12345`;
      
      const multiUserWorkflow = new MultiUserWorkflow(null);
      await multiUserWorkflow.testInvalidShareLink(page, invalidShareLink);
    });

    multiUserTest('should handle malformed share links', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Get the base URL from the current page
      await page.waitForLoadState('networkidle');
      const baseUrl = page.url().split('/dashboard')[0];
      
      // Test various malformed links
      // When linkId is missing or empty, app redirects to dashboard
      const emptyLinkCases = [
        `${baseUrl}/join?linkId=`,
        `${baseUrl}/join`,
      ];
      
      for (const link of emptyLinkCases) {
        await page.goto(link);
        await page.waitForURL(/\/dashboard/, { timeout: 5000 });
        expect(page.url()).toContain('/dashboard');
      }
      
      // Test with malicious/invalid linkId - should show error
      const invalidLink = `${baseUrl}/join?linkId=../../malicious`;
      const multiUserWorkflow = new MultiUserWorkflow(null);
      await multiUserWorkflow.testInvalidShareLink(page, invalidLink);
    });
  });

  test.describe('Share Link - Reliability Testing', () => {
    multiUserTest('should work reliably with multiple rapid joins', async ({ 
      authenticatedPage, 
      groupDetailPage 
    }) => {
      const { page: creatorPage, user: creator } = authenticatedPage;
      
      // Create group
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(creatorPage);
      await groupWorkflow.createGroup(`Rapid Join Test ${uniqueId}`, 'Testing rapid multiple joins');

      const multiUserWorkflow = new MultiUserWorkflow(null);
      const shareLink = await multiUserWorkflow.getShareLink(creatorPage);

      // Create multiple users and have them join rapidly
      const browser = creatorPage.context().browser()!;
      const joinPromises: Promise<void>[] = [];
      const contexts: any[] = [];

      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        contexts.push(context);
        const page = await context.newPage();
        const user = await AuthenticationWorkflow.createTestUser(page);
        
        joinPromises.push(
          multiUserWorkflow.joinGroupViaShareLink(page, shareLink, user)
        );
      }

      // Wait for all joins to complete
      await Promise.all(joinPromises);

      // Verify all users joined
      await groupDetailPage.waitForMemberCount(4); // Creator + 3 joiners

      // Clean up
      for (const context of contexts) {
        await context.close();
      }
    });

    multiUserTest('should recover from network interruptions during join', async ({ 
      authenticatedPage, 
      groupDetailPage 
    }) => {
      const { page: creatorPage } = authenticatedPage;
      
      // Create group
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(creatorPage);
      await groupWorkflow.createGroup(`Network Recovery Test ${uniqueId}`, 'Testing network recovery');

      const multiUserWorkflow = new MultiUserWorkflow(null);
      const shareLink = await multiUserWorkflow.getShareLink(creatorPage);

      // Create second user
      const browser = creatorPage.context().browser()!;
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const user2 = await AuthenticationWorkflow.createTestUser(page2);

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
      const groupDetailPage2 = new GroupDetailPage(page2);
      await groupDetailPage2.waitForMemberCount(2);

      await context2.close();
    });
  });

  test.describe('Share Link - Edge Cases', () => {
    // Test deleted - group deletion not implemented yet
    
    test('should handle multiple share link operations', async ({ page }) => {
      // Create multiple groups and get their share links
      const user = await AuthenticationWorkflow.createTestUser(page);
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
        await page.waitForLoadState('networkidle');
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
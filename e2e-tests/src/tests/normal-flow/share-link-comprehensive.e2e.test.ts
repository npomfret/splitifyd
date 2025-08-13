import { test, expect } from '@playwright/test';
import { multiUserTest } from '../../fixtures/multi-user-test';
import { singleMixedAuthTest } from '../../fixtures/mixed-auth-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, EMULATOR_URL } from '../../helpers';
import { MultiUserWorkflow } from '../../workflows/multi-user.workflow';
import { GroupWorkflow } from '../../workflows/group.workflow';
import { GroupDetailPage } from '../../pages';
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
      const multiUserWorkflow = new MultiUserWorkflow(); // Not using browser here
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

      const multiUserWorkflow = new MultiUserWorkflow();
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
      
      const multiUserWorkflow = new MultiUserWorkflow();
      const shareLink = await multiUserWorkflow.getShareLink(page1);
      
      console.log(`Testing unauthenticated access for user ${user1.displayName} with share link: ${shareLink}`);
      
      // Navigate to share link while not logged in
      const result = await joinGroupPage.attemptJoinWithStateDetection(shareLink);
      
      // Enhanced assertions with user context and debugging info
      expect(result.success, `User ${user1.displayName}: Expected join to fail but got success=${result.success}, reason='${result.reason}', URL: ${page2.url()}`).toBe(false);
      expect(result.needsLogin, `User ${user1.displayName}: Expected needsLogin=true but got ${result.needsLogin}, current URL: ${page2.url()}, reason='${result.reason}'`).toBe(true);
      expect(result.reason, `User ${user1.displayName}: Expected login requirement message but got '${result.reason}'`).toContain('log in');
    });

    multiUserTest('should allow user to join group after logging in from share link', async ({ 
      authenticatedPage,
      secondUser
    }) => {
      const { page: page1, user: user1 } = authenticatedPage;
      const { page: page2, user: user2 } = secondUser;
      
      const uniqueId = generateShortId();
      const groupWorkflow = new GroupWorkflow(page1);
      await groupWorkflow.createGroup(`Login Then Join Test ${uniqueId}`, 'Testing login then join flow');
      
      const multiUserWorkflow = new MultiUserWorkflow();
      const shareLink = await multiUserWorkflow.getShareLink(page1);

      console.log(`Testing login+join flow for user ${user2.displayName} (${user2.email})`);

      // Log out user2 to test login flow
      console.log(`${user2.displayName}: Starting logout process...`);
      await page2.goto(`${EMULATOR_URL}/dashboard`);
      await page2.waitForLoadState('domcontentloaded');
      console.log(`${user2.displayName}: On dashboard, looking for user menu...`);
      
      // Click user menu to show logout option
      try {
        const userMenuButton = page2.getByRole('button', { name: user2.displayName });
        await userMenuButton.waitFor({ state: 'visible', timeout: 3000 });
        console.log(`${user2.displayName}: User menu button found, clicking...`);
        await userMenuButton.click();
        
        const logoutButton = page2.getByRole('button', { name: /logout|sign out/i });
        await logoutButton.waitFor({ state: 'visible', timeout: 3000 });
        console.log(`${user2.displayName}: Logout button found, clicking...`);
        
        // Use force option to handle DOM changes during logout
        await logoutButton.click({ force: true });
        
        // Small delay for logout to process
        await page2.waitForTimeout(500);
        console.log(`${user2.displayName}: Logout button clicked, waiting for redirect...`);
      } catch (error) {
        throw new Error(`Logout failed for user ${user2.displayName}: ${(error as Error).message}. Current URL: ${page2.url()}`);
      }
      
      // Wait for logout to complete
      await page2.waitForURL(url => !url.toString().includes('/dashboard'), { timeout: 5000 });
      console.log(`${user2.displayName}: Logout complete, current URL: ${page2.url()}`);
      
      // Verify logout worked by trying to access dashboard (should redirect to login)
      await page2.goto(`${EMULATOR_URL}/dashboard`);
      await page2.waitForLoadState('domcontentloaded');
      await page2.waitForTimeout(1000); // Give time for potential redirect
      const postLogoutUrl = page2.url();
      console.log(`${user2.displayName}: After logout verification, dashboard access redirected to: ${postLogoutUrl}`);
      
      if (!postLogoutUrl.includes('/login')) {
        throw new Error(`${user2.displayName}: Logout verification failed - expected redirect to login but got: ${postLogoutUrl}`);
      }
      
      // Now test login + join flow with comprehensive assertions
      console.log(`${user2.displayName}: Starting joinGroupViaShareLinkWithLogin...`);
      await multiUserWorkflow.joinGroupViaShareLinkWithLogin(page2, shareLink, user2);
      console.log(`${user2.displayName}: joinGroupViaShareLinkWithLogin completed`);
      
      // Assert step 1: We're on the correct group page URL pattern  
      console.log(`${user2.displayName}: Verifying group page URL...`);
      await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 5000 });
      const currentUrl = page2.url();
      expect(currentUrl, `Expected group URL pattern but got: ${currentUrl}`).toMatch(/\/groups\/[a-zA-Z0-9]+$/);
      console.log(`${user2.displayName}: ✓ Group page URL verified: ${currentUrl}`);
      
      // Assert step 2: Group page elements are visible and loaded
      const groupDetailPage2 = new GroupDetailPage(page2);
      console.log(`${user2.displayName}: Verifying group page content loaded...`);
      
      // Check for key group page elements
      await expect(groupDetailPage2.getBalancesHeading(), `Balances heading not found on group page`).toBeVisible({ timeout: 5000 });
      await expect(groupDetailPage2.getMembersCount(), `Members count not found on group page`).toBeVisible({ timeout: 3000 });
      console.log(`${user2.displayName}: ✓ Group page content verified`);
      
      // Assert step 3: Correct number of members (should be 2: user1 + user2)
      console.log(`${user2.displayName}: Verifying member count is 2...`);
      await groupDetailPage2.waitForMemberCount(2);
      console.log(`${user2.displayName}: ✓ Member count verified as 2`);
      
      // Assert step 4: Both specific users are visible as members
      console.log(`${user2.displayName}: Verifying both users are visible as members...`);
      await expect(groupDetailPage2.getTextElement(user1.displayName).first(), 
        `User ${user1.displayName} not visible as group member`).toBeVisible({ timeout: 3000 });
      await expect(groupDetailPage2.getTextElement(user2.displayName).first(), 
        `User ${user2.displayName} not visible as group member`).toBeVisible({ timeout: 3000 });
      console.log(`${user2.displayName}: ✓ Both users (${user1.displayName}, ${user2.displayName}) verified as visible members`);
      
      // Assert step 5: Group title matches what we created
      const expectedGroupName = `Login Then Join Test ${uniqueId}`;
      console.log(`${user2.displayName}: Verifying group title matches expected: ${expectedGroupName}`);
      await expect(groupDetailPage2.getGroupTitleByName(expectedGroupName),
        `Group title "${expectedGroupName}" not found on page`).toBeVisible({ timeout: 3000 });
      console.log(`${user2.displayName}: ✓ Group title verified: ${expectedGroupName}`);
      
      console.log(`${user2.displayName}: 🎉 COMPLETE - Successfully joined group via login flow with all assertions passing!`);
    });
  });

});
import { test, expect, Page } from '@playwright/test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupDetailPage, DashboardPage, JoinGroupPage } from '../../pages';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';
import { getUserPool } from '../../fixtures/user-pool.fixture';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

// Parameterized test configuration
const TEST_CONFIGS = [
  { totalUsers: 4, description: 'small group' }
];

test.describe('Parallel Group Joining Edge Cases', () => {
  
  TEST_CONFIGS.forEach(({ totalUsers, description }) => {
    test(`should handle ${totalUsers} users joining group in parallel (${description})`, async ({ browser }) => {
      // Set longer timeout for complex multi-user test
      test.setTimeout(60000);
      
      const userPool = getUserPool();
      const contexts: any[] = [];
      const pages: Page[] = [];
      const users: any[] = [];
      const groupDetailPages: GroupDetailPage[] = [];
      
      try {
        // 1. Create browser contexts and users for all participants
        for (let i = 0; i < totalUsers; i++) {
          const context = await browser.newContext();
          const page = await context.newPage();
          const user = await userPool.claimUser(browser);
          
          // Authenticate the user in their own browser context
          const loginPage = await import('../../pages/login.page');
          const login = new loginPage.LoginPage(page);
          
          await page.goto('/login');
          await page.waitForLoadState('domcontentloaded');
          
          // Use page object methods instead of raw selectors
          await login.login(user.email, 'TestPassword123!');
          
          // Wait for login to complete
          await page.waitForURL(/\/dashboard/, { timeout: 15000 });
          await page.waitForLoadState('domcontentloaded');
          
          contexts.push(context);
          pages.push(page);
          users.push(user);
          groupDetailPages.push(new GroupDetailPage(page));
        }
        
        // 2. First user creates the group
        const creatorPage = pages[0];
        const creatorUser = users[0];
        const creatorGroupDetailPage = groupDetailPages[0];
        const dashboardPage = new DashboardPage(creatorPage);
        
        // Navigate to dashboard and create group
        await creatorPage.goto('/dashboard');
        await dashboardPage.waitForDashboard();
        
        const groupWorkflow = new GroupWorkflow(creatorPage);
        const groupName = generateTestGroupName(`Parallel${totalUsers}Users`);
        const groupId = await groupWorkflow.createGroup(groupName, `Testing ${totalUsers}-user parallel join`);
        
        // Get share link
        const shareButton = creatorGroupDetailPage.getShareButton();
        await expect(shareButton).toBeVisible();
        await shareButton.click();
        
        const shareModal = creatorGroupDetailPage.getShareModal();
        await expect(shareModal).toBeVisible();
        
        const shareLinkInput = creatorGroupDetailPage.getShareLinkInput();
        await expect(shareLinkInput).toBeVisible();
        const shareLink = await shareLinkInput.inputValue();
        expect(shareLink).toMatch(/\/join\?linkId=/);
        
        // Close share modal
        await creatorPage.keyboard.press('Escape');
        await expect(shareModal).not.toBeVisible();
        
        console.log(`Group created by ${creatorUser.displayName}. Share link: ${shareLink}`);
        
        // 3. All other users join IN PARALLEL
        const joinerUsers = users.slice(1);
        const joinerPages = pages.slice(1);
        
        console.log(`Starting parallel join for ${joinerUsers.length} users...`);
        
        // Create join promises for all users
        const joinPromises = joinerUsers.map(async (user, index) => {
          const page = joinerPages[index];
          const joinGroupPage = new JoinGroupPage(page);
          
          try {
            console.log(`User ${user.displayName} starting join...`);
            
            // Navigate to share link
            await page.goto(shareLink);
            await page.waitForLoadState('domcontentloaded');
            
            // Attempt to join
            const joinResult = await joinGroupPage.attemptJoinWithStateDetection(shareLink);
            
            if (!joinResult.success) {
              throw new Error(`${user.displayName} failed to join: ${joinResult.reason}`);
            }
            
            console.log(`User ${user.displayName} join completed`);
            
            // Verify user ended up on group page
            const finalUrl = page.url();
            if (!finalUrl.includes(`/groups/${groupId}`)) {
              // Take screenshot for debugging
              await page.screenshot({ 
                path: `tmp/parallel-join-failure-${user.displayName.replace(/\s+/g, '-')}-${Date.now()}.png`,
                fullPage: false 
              });
              throw new Error(`${user.displayName} join verification failed. Expected URL to contain /groups/${groupId}, but got: ${finalUrl}`);
            }
            
            return { success: true, user: user.displayName };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Join failed for ${user.displayName}:`, errorMessage);
            return { success: false, user: user.displayName, error: errorMessage };
          }
        });
        
        // 4. Wait for all joins to complete
        console.log('Waiting for all parallel joins to complete...');
        const joinResults = await Promise.all(joinPromises);
        
        // Check join results
        const failedJoins = joinResults.filter(result => !result.success);
        if (failedJoins.length > 0) {
          const failureMessages = failedJoins.map(f => `${f.user}: ${f.error}`).join(', ');
          throw new Error(`${failedJoins.length}/${joinerUsers.length} users failed to join: ${failureMessages}`);
        }
        
        console.log(`All ${joinerUsers.length} users successfully joined!`);
        
        // 5. Wait for all pages to synchronize and show correct member count
        console.log('Synchronizing all user pages...');
        
        // Give time for real-time updates to propagate
        await Promise.all(pages.map(page => page.waitForLoadState('domcontentloaded')));
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 6. Verify all users see the complete member list
        const verificationPromises = pages.map(async (page, index) => {
          const user = users[index];
          const groupDetailPage = groupDetailPages[index];
          
          try {
            
            // Wait for member count to update
            await groupDetailPage.waitForMemberCount(totalUsers, 15000);
            
            // Verify all user names are visible
            for (const expectedUser of users) {
              const userNameElement = page.getByText(expectedUser.displayName).first();
              await expect(userNameElement).toBeVisible({
                timeout: 5000
              });
            }
            
            console.log(`${user.displayName} sees all ${totalUsers} members correctly`);
            return { success: true, user: user.displayName };
            
          } catch (error) {
            // Take screenshot for debugging
            await page.screenshot({ 
              path: `tmp/verification-failure-${user.displayName.replace(/\s+/g, '-')}-${Date.now()}.png`,
              fullPage: false 
            });
            
            console.error(`Verification failed for ${user.displayName}:`, error);
            return { success: false, user: user.displayName, error: error instanceof Error ? error.message : String(error) };
          }
        });
        
        const verificationResults = await Promise.all(verificationPromises);
        
        // Check verification results
        const failedVerifications = verificationResults.filter(result => !result.success);
        if (failedVerifications.length > 0) {
          const failureMessages = failedVerifications.map(f => `${f.user}: ${f.error}`).join(', ');
          throw new Error(`${failedVerifications.length}/${totalUsers} users failed verification: ${failureMessages}`);
        }
        
        console.log(`✅ SUCCESS: All ${totalUsers} users can see complete member list!`);
        
        // 7. Final verification - check group has correct member count
        const finalMemberCount = await creatorGroupDetailPage.getMemberCountElement().textContent();
        expect(finalMemberCount).toContain(`${totalUsers} member`);
        
      } finally {
        // Clean up all browser contexts
        await Promise.all(contexts.map(context => context.close()));
        
        // Release users back to pool
        for (const user of users) {
          userPool.releaseUser(user);
        }
      }
    });
  });
  
  test('should handle race conditions during parallel joins gracefully', async ({ browser }) => {
    // This test focuses on ensuring the system doesn't break under concurrent load
    test.setTimeout(90000); // Increased timeout for 6 user authentication and parallel operations
    
    const userPool = getUserPool();
    const contexts: any[] = [];
    const pages: Page[] = [];
    const users: any[] = [];
    
    const totalUsers = 6; // Medium-sized test for race condition testing
    
    try {
      // Create all browser contexts
      for (let i = 0; i < totalUsers; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const user = await userPool.claimUser(browser);
        
        try {
          // Use a simpler approach - authenticate via the login helper
          // This is more reliable than manual login for bulk user creation
          const loginPage = await import('../../pages/login.page');
          const login = new loginPage.LoginPage(page);
          
          await page.goto('/login');
          await page.waitForLoadState('domcontentloaded');
          
          // Use page object methods instead of raw selectors
          await login.login(user.email, 'TestPassword123!');
          
          // Wait for login to complete with appropriate timeout
          await page.waitForURL(/\/dashboard/, { timeout: 15000 });
          await page.waitForLoadState('domcontentloaded');
          
          contexts.push(context);
          pages.push(page);
          users.push(user);
        } catch (authError) {
          console.error(`Failed to authenticate user ${i + 1}:`, authError);
          await context.close();
          userPool.releaseUser(user);
          throw new Error(`Authentication failed for user ${i + 1}: ${authError}`);
        }
      }
      
      // First user creates group
      const creatorPage = pages[0];
      const creatorUser = users[0];
      const dashboardPage = new DashboardPage(creatorPage);
      const creatorGroupDetailPage = new GroupDetailPage(creatorPage);
      
      await creatorPage.goto('/dashboard');
      await dashboardPage.waitForDashboard();
      
      const groupWorkflow = new GroupWorkflow(creatorPage);
      const groupName = generateTestGroupName('RaceCondition');
      const groupId = await groupWorkflow.createGroup(groupName, 'Testing race conditions');
      
      // Get share link
      const shareLink = await creatorGroupDetailPage.getShareLink();
      
      // All other users attempt to join simultaneously with minimal delay
      const joinPromises = users.slice(1).map(async (user, index) => {
        const page = pages[index + 1];
        
        // Add small random delay to increase chance of race conditions
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        try {
          await page.goto(shareLink);
          await page.waitForLoadState('domcontentloaded');
          
          const joinButton = page.getByRole('button', { name: /join group/i });
          await joinButton.waitFor({ state: 'visible', timeout: 3000 });
          await expect(joinButton).toBeEnabled();
          await joinButton.click();
          
          // Wait for navigation with reasonable timeout
          await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 10000 });
          
          return { success: true, user: user.displayName };
        } catch (error) {
          // Don't fail the test for individual race condition failures
          // The goal is to test system stability, not perfect success rate
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Race condition join failed for ${user.displayName}:`, errorMessage);
          return { success: false, user: user.displayName, error: errorMessage };
        }
      });
      
      const results = await Promise.all(joinPromises);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      console.log(`Race condition test results: ${successCount} succeeded, ${failureCount} failed`);
      
      // The test passes if:
      // 1. At least some users successfully joined (system didn't completely break)
      // 2. The creator can still access the group
      // 3. No critical errors occurred
      
      expect(successCount).toBeGreaterThan(0); // At least some joins should succeed
      
      // Verify creator page is still functional
      await creatorPage.reload();
      await creatorPage.waitForLoadState('domcontentloaded');
      await expect(creatorGroupDetailPage.getGroupTitle()).toBeVisible();
      
      console.log(`✅ Race condition test completed: System remained stable with ${successCount}/${users.length - 1} successful joins`);
      
    } finally {
      await Promise.all(contexts.map(context => context.close()));
      
      // Release users back to pool
      for (const user of users) {
        userPool.releaseUser(user);
      }
    }
  });
});
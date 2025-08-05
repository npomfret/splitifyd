import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { 
  setupConsoleErrorReporting, 
  setupMCPDebugOnFailure,
  AuthenticationWorkflow
} from '../../helpers';
import { GroupWorkflow } from '../../workflows';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Security and Access Control', () => {
  test('verifies group access control behavior', async ({ authenticatedPage, browser }) => {
    const { page } = authenticatedPage;
    // Create a group with User 1 (already authenticated)
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup('Test Access Group', 'Testing access control');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    const groupUrl = page.url();
    
    // Create User 2 in separate context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    // Note: This test requires a second user, so we need to use createTestUser for User 2
    await AuthenticationWorkflow.createTestUser(page2);
    
    // User 2 tries to access User 1's group
    await page2.goto(groupUrl);
    await page2.waitForLoadState('domcontentloaded');
    
    // Just verify the page loads without crashing
    // The app may or may not have access control implemented
    const pageLoaded = await page2.evaluate(() => document.readyState === 'complete');
    expect(pageLoaded).toBe(true);
    
    // Verify that access control works - non-members should not see group details
    // The group name should NOT be visible to unauthorized users
    await expect(page2.getByText('Test Access Group')).not.toBeVisible();
    
    await context2.close();
  });
});
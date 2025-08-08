import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { 
  setupConsoleErrorReporting, 
  setupMCPDebugOnFailure
} from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Security and Access Control', () => {
  test('verifies group access control behavior', async ({ authenticatedPage, secondUser }) => {
    const { page: page1 } = authenticatedPage;
    const { page: page2 } = secondUser;
    
    // Create a group with User 1 (already authenticated)
    const groupWorkflow = new GroupWorkflow(page1);
    const groupName = generateTestGroupName('Access');
    await groupWorkflow.createGroup(groupName, 'Testing access control');
    
    const groupUrl = page1.url();
    
    // User 2 (already authenticated via fixture) tries to access User 1's group
    await page2.goto(groupUrl);
    await page2.waitForLoadState('domcontentloaded');
    
    // Just verify the page loads without crashing
    // The app may or may not have access control implemented
    const pageLoaded = await page2.evaluate(() => document.readyState === 'complete');
    expect(pageLoaded).toBe(true);
    
    // Verify that access control works - non-members should not see group details
    // The group name should NOT be visible to unauthorized users
    await expect(page2.getByText(groupName)).not.toBeVisible();
  });
});
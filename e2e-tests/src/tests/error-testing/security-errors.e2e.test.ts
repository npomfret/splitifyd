import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

// Enable console error reporting and MCP debugging
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
    
    // Wait for redirect to 404 page
    await page2.waitForURL('**/404', { timeout: 5000 });
    
    // Verify that User 2 is redirected to 404 page when trying to access a group they're not a member of
    const currentUrl = page2.url();
    expect(currentUrl).toContain('/404');
    
    // Verify the 404 page is displayed
    const heading = await page2.locator('h1').textContent();
    expect(heading).toBe('404');
    
    // Verify the group name is NOT visible to unauthorized users
    await expect(page2.locator(`text=${groupName}`)).not.toBeVisible();
  });
});
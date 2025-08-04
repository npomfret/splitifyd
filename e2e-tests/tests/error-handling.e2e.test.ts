import { test, expect } from '../fixtures/base-test';
import { 
  setupConsoleErrorReporting, 
  setupMCPDebugOnFailure,
  GroupWorkflow,
  AuthenticationWorkflow
} from '../helpers';
import { CreateGroupModalPage, DashboardPage } from '../pages';
import { TIMEOUT_CONTEXTS, TIMEOUTS } from '../config/timeouts';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Error Handling', () => {
  test('displays error message when network fails during group creation', async ({ page, context }) => {
    // NOTE: This test intentionally triggers network errors
    test.info().annotations.push({ 
      type: 'skip-error-checking', 
      description: 'Network errors are intentionally triggered to test error handling' 
    });
    
    await AuthenticationWorkflow.createTestUser(page);
    
    // Intercept API calls to simulate network failure
    await context.route('**/api/groups', route => route.abort());
    await context.route('**/groups', route => route.abort());
    
    // Try to create group while network is failing
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await expect(createGroupModal.isOpen()).resolves.toBe(true);
    
    // Fill and submit form
    await createGroupModal.fillGroupForm('Network Test Group', 'Testing network error handling');
    await createGroupModal.submitForm();
    
    // Wait for error handling
    await page.waitForLoadState('networkidle');
    
    // Verify some error indication is shown (generic check)
    const errorText = page.getByText(/error|failed|try again/i);
    await expect(errorText.first()).toBeVisible();
    
    // Verify modal is still open (error didn't crash the UI)
    await expect(createGroupModal.isOpen()).resolves.toBe(true);
  });

  test('prevents form submission with invalid data', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await expect(createGroupModal.isOpen()).resolves.toBe(true);
    
    // Try to submit empty form
    const submitButton = page.locator('form').getByRole('button', { name: 'Create Group' });
    await expect(submitButton).toBeVisible();
    
    // Submit button should be disabled for empty form
    await expect(submitButton).toBeDisabled();
    
    // Fill with valid data and verify form can be submitted
    await createGroupModal.fillGroupForm('Valid Group Name', 'Valid description');
    
    // Button should now be enabled
    await expect(submitButton).toBeEnabled();
    
    // Now submit button should work
    await submitButton.click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
  });

  test('handles server errors gracefully', async ({ page, context }) => {
    // NOTE: This test intentionally triggers server errors
    test.info().annotations.push({ 
      type: 'skip-error-checking', 
      description: 'Server errors are intentionally triggered to test error handling' 
    });
    
    await AuthenticationWorkflow.createTestUser(page);
    
    // Intercept API calls to simulate server error
    await context.route('**/api/groups', route => {
      route.fulfill({ 
        status: 500, 
        body: JSON.stringify({ error: 'Internal Server Error' }),
        headers: { 'Content-Type': 'application/json' }
      });
    });
    
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.fillGroupForm('Server Error Test', 'Testing 500 error');
    await createGroupModal.submitForm();
    
    await page.waitForLoadState('networkidle');
    
    // Should show some error indication
    const errorIndication = page.getByText(/error|failed|wrong/i);
    await expect(errorIndication.first()).toBeVisible();
    
    // Modal should remain open
    await expect(createGroupModal.isOpen()).resolves.toBe(true);
  });

  test('handles malformed API responses', async ({ page, context }) => {
    // NOTE: This test intentionally triggers JSON parse errors
    test.info().annotations.push({ 
      type: 'skip-error-checking', 
      description: 'JSON parse errors are intentionally triggered to test error handling' 
    });
    
    await AuthenticationWorkflow.createTestUser(page);
    
    // Intercept API calls to return malformed JSON
    await context.route('**/api/groups', route => {
      route.fulfill({ 
        status: 200, 
        body: 'Invalid JSON response {malformed',
        headers: { 'Content-Type': 'application/json' }
      });
    });
    
    // Reload to trigger API call
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // App should still be functional despite malformed response
    const createButton = page.getByRole('button', { name: 'Create Group' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('verifies group access control behavior', async ({ page, browser }) => {
    // Create User 1 and a group
    await GroupWorkflow.createTestGroup(page, 'Test Access Group', 'Testing access control');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    const groupUrl = page.url();
    
    // Create User 2 in separate context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
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

  test('handles API timeouts appropriately', async ({ page, context }) => {
    // NOTE: This test simulates timeout scenarios
    test.info().annotations.push({ 
      type: 'skip-error-checking', 
      description: 'Timeout errors are intentionally triggered to test error handling' 
    });
    
    await AuthenticationWorkflow.createTestUser(page);
    
    // Intercept API calls to simulate timeout
    await context.route('**/api/groups', async route => {
      // Wait 10 seconds then respond with timeout
      await new Promise(resolve => setTimeout(resolve, 10000));
      await route.fulfill({ status: 408, body: 'Request Timeout' });
    });
    
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.fillGroupForm('Timeout Test Group');
    
    // Start the submission (will timeout)
    // This promise is expected to fail due to the simulated timeout
    await Promise.race([
      createGroupModal.submitForm().catch(() => {
        // Expected failure due to timeout - UI should handle this gracefully
      }),
      // Wait for the submit button to be re-enabled (indicates submission attempt completed)
      page.waitForFunction(() => {
        const button = document.querySelector('button[type="submit"]:not([disabled])');
        return button && button.textContent?.includes('Create Group');
      }, { timeout: TIMEOUTS.LONG })
    ]);
    
    // Modal should still be open
    await expect(createGroupModal.isOpen()).resolves.toBe(true);
    
    // Cancel the test to avoid waiting 10 seconds
    await page.keyboard.press('Escape');
  });
});
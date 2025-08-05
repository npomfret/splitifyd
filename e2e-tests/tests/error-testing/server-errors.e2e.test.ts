import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { 
  setupConsoleErrorReporting, 
  setupMCPDebugOnFailure
} from '../../helpers';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Server Error Handling', () => {
  test('handles server errors gracefully', async ({ authenticatedPage, dashboardPage, createGroupModalPage, context }) => {
    const { page } = authenticatedPage;
    // NOTE: This test intentionally triggers server errors
    test.info().annotations.push({ 
      type: 'skip-error-checking', 
      description: 'Server errors are intentionally triggered to test error handling' 
    });
    
    // Already authenticated via fixture
    
    // Intercept API calls to simulate server error
    await context.route('**/api/groups', route => {
      route.fulfill({ 
        status: 500, 
        body: JSON.stringify({ error: 'Internal Server Error' }),
        headers: { 'Content-Type': 'application/json' }
      });
    });
    
    
    
    await dashboardPage.openCreateGroupModal();
    await createGroupModalPage.fillGroupForm('Server Error Test', 'Testing 500 error');
    await createGroupModalPage.submitForm();
    
    await page.waitForLoadState('networkidle');
    
    // Should show some error indication
    const errorIndication = page.getByText(/error|failed|wrong/i);
    await expect(errorIndication.first()).toBeVisible();
    
    // Modal should remain open
    await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
  });
});
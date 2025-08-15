import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../helpers';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('API Error Handling', () => {
  test('handles malformed API responses', async ({ authenticatedPage, dashboardPage, context }) => {
    const { page } = authenticatedPage;
    // NOTE: This test intentionally triggers JSON parse errors
    test.info().annotations.push({ 
      type: 'skip-error-checking', 
      description: 'JSON parse errors are intentionally triggered to test error handling' 
    });
    
    // Already authenticated via fixture
    
    // Intercept API calls to return malformed JSON
    await context.route('**/api/groups', route => {
      route.fulfill({ 
        status: 200, 
        body: 'Invalid JSON response {malformed',
        headers: { 'Content-Type': 'application/json' }
      });
    });
    
    // Wait for load state
    await page.waitForLoadState('domcontentloaded');
    
    // App should still be functional despite malformed response
    const createButton = dashboardPage.getCreateGroupButton();
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
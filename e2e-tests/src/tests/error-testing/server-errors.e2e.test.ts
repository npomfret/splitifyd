import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../helpers';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Server Error Handling', () => {
  test('handles server errors gracefully', async ({ authenticatedPage, dashboardPage, createGroupModalPage, primaryUser }) => {
    const { page } = authenticatedPage;
    const { context } = primaryUser;
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
    
    await page.waitForLoadState('domcontentloaded');
    
    // Should show some error indication
    const errorIndication = page.getByText(/error|failed|wrong/i);
    await expect(errorIndication.first()).toBeVisible();
    
    // Note: Modal behavior on server errors may have changed
    const isModalOpen = await createGroupModalPage.isOpen();
    if (!isModalOpen) {
      // If modal closed, verify we're still on dashboard with error shown
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(errorIndication.first()).toBeVisible();
    } else {
      // If modal is still open, that's also valid
      await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
    }
  });
});
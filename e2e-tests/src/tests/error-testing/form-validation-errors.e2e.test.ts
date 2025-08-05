import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { 
  setupConsoleErrorReporting, 
  setupMCPDebugOnFailure
} from '../../helpers/index';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { SELECTORS } from '../../constants/selectors';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Form Validation Error Handling', () => {
  test('prevents form submission with invalid data', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
    const { page } = authenticatedPage;
    // Already authenticated via fixture
    
    
    await dashboardPage.openCreateGroupModal();
    await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
    
    // Try to submit empty form
    const submitButton = page.locator(SELECTORS.FORM).getByRole('button', { name: 'Create Group' });
    await expect(submitButton).toBeVisible();
    
    // Submit button should be disabled for empty form
    await expect(submitButton).toBeDisabled();
    
    // Fill with valid data and verify form can be submitted
    await createGroupModalPage.fillGroupForm('Valid Group Name', 'Valid description');
    
    // Button should now be enabled
    await expect(submitButton).toBeEnabled();
    
    // Now submit button should work
    await submitButton.click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
  });
});
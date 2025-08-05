import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { 
  setupConsoleErrorReporting, 
  setupMCPDebugOnFailure
} from '../../helpers/index';
import { TIMEOUT_CONTEXTS, TIMEOUTS } from '../../config/timeouts';
import { SELECTORS } from '../../constants/selectors';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Timeout Error Handling', () => {
  test('handles API timeouts appropriately', async ({ authenticatedPage, dashboardPage, createGroupModalPage, context }) => {
    const { page } = authenticatedPage;
    // NOTE: This test simulates timeout scenarios
    test.info().annotations.push({ 
      type: 'skip-error-checking', 
      description: 'Timeout errors are intentionally triggered to test error handling' 
    });
    
    // Already authenticated via fixture
    
    // Intercept API calls to simulate timeout
    await context.route('**/api/groups', async route => {
      // Wait for configured timeout delay then respond with timeout
      await new Promise(resolve => setTimeout(resolve, TIMEOUT_CONTEXTS.SIMULATED_TIMEOUT_DELAY));
      await route.fulfill({ status: 408, body: 'Request Timeout' });
    });
    
    
    
    await dashboardPage.openCreateGroupModal();
    await createGroupModalPage.fillGroupForm('Timeout Test Group');
    
    // Start the submission (will timeout) and wait for expected UI state changes
    const submitPromise = createGroupModalPage.submitForm();
    const buttonReenabledPromise = page.waitForFunction((selector) => {
      const button = document.querySelector(`${selector}:not([disabled])`);
      return button && button.textContent?.includes('Create Group');
    }, SELECTORS.SUBMIT_BUTTON, { timeout: TIMEOUTS.LONG });

    // Wait for either submission to complete or button to be re-enabled
    await Promise.race([submitPromise, buttonReenabledPromise]);

    // Verify the expected state: form submission should fail and modal should remain open
    const isSubmitButtonEnabled = await page.locator(SELECTORS.SUBMIT_BUTTON).isEnabled();
    expect(isSubmitButtonEnabled).toBe(true); // Button should be re-enabled after timeout

    // Modal should still be open
    await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
    
    // Cancel the test to avoid waiting 10 seconds
    await page.keyboard.press('Escape');
  });
});
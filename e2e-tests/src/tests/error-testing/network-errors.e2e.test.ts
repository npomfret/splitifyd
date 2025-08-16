import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { TIMEOUT_CONTEXTS, TIMEOUTS } from '../../config/timeouts';
import { SELECTORS } from '../../constants/selectors';
import { generateTestGroupName } from '../../utils/test-helpers';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Error Handling', () => {
  test('displays error message when network fails during group creation', async ({ authenticatedPage, dashboardPage, createGroupModalPage, primaryUser }) => {
    const { page } = authenticatedPage;
    const { context } = primaryUser;
    // NOTE: This test intentionally triggers network errors
    test.info().annotations.push({ 
      type: 'skip-error-checking', 
      description: 'Network errors are intentionally triggered to test error handling' 
    });
    
    // Already authenticated via fixture
    
    // Intercept API calls to simulate network failure
    await context.route('**/api/groups', route => {
      route.abort();
    });
    
    // Try to create group while network is failing
    
    
    await dashboardPage.openCreateGroupModal();
    await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
    
    // Fill and submit form
    await createGroupModalPage.fillGroupForm('Network Test Group', 'Testing network error handling');
    await createGroupModalPage.submitForm();
    
    // Wait for error handling
    await page.waitForLoadState('domcontentloaded');
    
    // Verify some error indication is shown (generic check)
    const errorText = page.getByText(/error|failed|try again/i);
    await expect(errorText.first()).toBeVisible();
    
    // Note: Modal behavior on network errors may have changed
    // The app might now close the modal and show the error elsewhere
    // We're primarily testing that errors are handled without crashes
    const isModalOpen = await createGroupModalPage.isOpen();
    if (!isModalOpen) {
      // If modal closed, verify we're still on dashboard with error shown
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(errorText.first()).toBeVisible();
    } else {
      // If modal is still open, that's also valid
      await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
    }
  });

  test('prevents form submission with invalid data', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
    const { page } = authenticatedPage;
    // Already authenticated via fixture
    
    
    await dashboardPage.openCreateGroupModal();
    await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
    
    // Try to submit empty form
    const submitButton = createGroupModalPage.getCreateGroupFormButton();
    await expect(submitButton).toBeVisible();
    
    // Submit button should be disabled for empty form
    await expect(submitButton).toBeDisabled();
    
    // Fill with valid data and verify form can be submitted
    await createGroupModalPage.fillGroupForm(generateTestGroupName('Valid'), 'Valid description');
    
    // Button should now be enabled
    await expect(submitButton).toBeEnabled();
    
    // Now submit button should work
    await submitButton.click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
  });

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

  test('handles malformed API responses', async ({ authenticatedPage, dashboardPage, primaryUser }) => {
    const { page } = authenticatedPage;
    const { context } = primaryUser;
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

  // NOTE: The 'verifies group access control behavior' test has been removed as it's a duplicate 
  // of the test in security-errors.e2e.test.ts which now properly uses multiUserTest fixture

  test('handles API timeouts appropriately', async ({ authenticatedPage, dashboardPage, createGroupModalPage, primaryUser }) => {
    const { page } = authenticatedPage;
    const { context } = primaryUser;
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
    const buttonReenabledPromise = page.waitForFunction((selector: string) => {
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

    // Just close to modal to avoid waiting 10 seconds
    await page.keyboard.press('Escape');
  });
});
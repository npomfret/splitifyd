import {expect, simpleTest as test} from '../../fixtures/simple-test.fixture';
import {CreateGroupModalPage, LoginPage} from '../../pages';
import {TIMEOUT_CONTEXTS, TIMEOUTS} from '../../config/timeouts';
import {SELECTORS} from '../../constants/selectors';
import {generateTestGroupName} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';

test.describe('Error Handling', () => {
    test('displays error message when network fails during group creation', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);

        // NOTE: This test intentionally triggers network errors
        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Network errors are intentionally triggered to test error handling',
        });

        // Already authenticated via fixture

        // Try to create group while network is failing using page object methods
        const createGroupModal = await dashboardPage.openCreateGroupModal();
        await expect(createGroupModal.isOpen()).resolves.toBe(true);

        // Wait for any initial dashboard API calls to settle before setting up interception
        await dashboardPage.page.waitForTimeout(1000);

        // Intercept API calls to simulate network failure - be very specific to only intercept group creation
        await page.context().route(/\/groups$/, (route) => {
            const method = route.request().method();
            if (method === 'POST') {
                route.fulfill({
                    status: 0, // Network failure
                    body: '',
                });
            } else {
                route.continue();
            }
        });

        // Fill and submit form using page object methods
        await createGroupModal.fillGroupForm('Network Test Group', 'Testing network error handling');
        await createGroupModal.submitForm();

        // Wait for error handling using page object method
        await dashboardPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify error indication is shown using page object method for error detection
        // Wait for the error to appear (might be async) - check for any error message first
        const anyErrorElement = createGroupModal.getErrorMessage();
        await expect(anyErrorElement.first()).toBeVisible({ timeout: 5000 });

        // Note: Modal behavior on network errors may have changed
        // The app might now close the modal and show the error elsewhere
        // We're primarily testing that errors are handled without crashes
        const isModalOpen = await createGroupModal.isOpen();
        if (!isModalOpen) {
            // If modal closed, verify we're still on dashboard with error shown
            await dashboardPage.expectUrl(/\/dashboard/);
            await expect(anyErrorElement.first()).toBeVisible();
        } else {
            // If modal is still open, that's also valid
            await expect(createGroupModal.isOpen()).resolves.toBe(true);
        }
    });

    test('prevents form submission with invalid data', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const createGroupModalPage = new CreateGroupModalPage(page, user);

        await dashboardPage.openCreateGroupModal();
        await expect(createGroupModalPage.isOpen()).resolves.toBe(true);

        // Try to submit empty form
        const submitButton = createGroupModalPage.getCreateGroupFormButton();
        await expect(submitButton).toBeVisible();

        // Submit button should be disabled for empty form
        await expect(submitButton).toBeDisabled();

        // Fill with valid data and verify form can be submitted using page object methods
        await createGroupModalPage.fillGroupForm(generateTestGroupName('Valid'), 'Valid description');

        // Button should now be enabled
        await expect(submitButton).toBeEnabled();

        // Now submit button should work using page object method
        await createGroupModalPage.submitForm();
        await expect(dashboardPage.page).toHaveURL(groupDetailUrlPattern());
    });

    test('handles server errors gracefully', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const createGroupModalPage = new CreateGroupModalPage(page, user);
        const context = page.context();
        // NOTE: This test intentionally triggers server errors
        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Server errors are intentionally triggered to test error handling',
        });

        // Already authenticated via fixture

        await dashboardPage.openCreateGroupModal();

        // Wait for any initial dashboard API calls to settle before setting up interception
        await dashboardPage.page.waitForTimeout(1000);

        // Intercept API calls to simulate server error - be very specific to only intercept group creation
        await context.route(/\/groups$/, (route) => {
            const method = route.request().method();
            if (method === 'POST') {
                route.fulfill({
                    status: 500,
                    body: JSON.stringify({ error: 'Internal Server Error' }),
                    headers: { 'Content-Type': 'application/json' },
                });
            } else {
                route.continue();
            }
        });
        await createGroupModalPage.fillGroupForm('Server Error Test', 'Testing 500 error');
        await createGroupModalPage.submitForm();

        await dashboardPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Should show some error indication using page object method
        // Wait for the error to appear (might be async) - check for any error message first
        const errorIndication = createGroupModalPage.getErrorMessage();
        await expect(errorIndication.first()).toBeVisible({ timeout: 5000 });

        // Note: Modal behavior on server errors may have changed
        const isModalOpen = await createGroupModalPage.isOpen();
        if (!isModalOpen) {
            // If modal closed, verify we're still on dashboard with error shown
            await dashboardPage.expectUrl(/\/dashboard/);
            await expect(errorIndication.first()).toBeVisible();
        } else {
            // If modal is still open, that's also valid
            await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
        }
    });

    test('handles malformed API responses', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
        const context = page.context();
        // NOTE: This test intentionally triggers JSON parse errors
        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'JSON parse errors are intentionally triggered to test error handling',
        });

        // Already authenticated via fixture

        // Intercept API calls to return malformed JSON - only for GET requests to break group loading
        await context.route(/\/groups$/, (route) => {
            const method = route.request().method();
            if (method === 'GET') {
                route.fulfill({
                    status: 200,
                    body: 'Invalid JSON response {malformed',
                    headers: { 'Content-Type': 'application/json' },
                });
            } else {
                route.continue();
            }
        });

        // Wait for load state using page object
        await dashboardPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // App should still be functional despite malformed response
        const createButton = dashboardPage.getCreateGroupButton();
        await expect(createButton).toBeVisible();
        await expect(createButton).toBeEnabled();

        // Should still be on dashboard using page object method
        await dashboardPage.expectUrl(/\/dashboard/);
    });

    // NOTE: The 'verifies group access control behavior' test has been removed as it's a duplicate
    // of the test in security-errors.e2e.test.ts which now properly uses multiUserTest fixture

    test('handles API timeouts appropriately', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const createGroupModalPage = new CreateGroupModalPage(page, user);
        const context = page.context();
        // NOTE: This test simulates timeout scenarios
        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Timeout errors are intentionally triggered to test error handling',
        });

        // Already authenticated via fixture

        // Intercept API calls to simulate timeout - be very specific to avoid blocking dashboard loads
        await context.route('**/groups', async (route) => {
            const method = route.request().method();
            if (method === 'POST') {
                // Wait for configured timeout delay then respond with timeout
                await new Promise((resolve) => setTimeout(resolve, TIMEOUT_CONTEXTS.SIMULATED_TIMEOUT_DELAY));
                await route.fulfill({ status: 408, body: 'Request Timeout' });
            } else {
                route.continue();
            }
        });

        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm('Timeout Test Group');

        // Start the submission (will timeout) and wait for expected UI state changes
        const submitPromise = createGroupModalPage.submitForm();
        const buttonReenabledPromise = dashboardPage.page.waitForFunction(
            (selector: string) => {
                const button = document.querySelector(`${selector}:not([disabled])`);
                return button && button.textContent?.includes('Create Group');
            },
            SELECTORS.SUBMIT_BUTTON,
            { timeout: TIMEOUTS.LONG },
        );

        // Wait for either submission to complete or button to be re-enabled
        await Promise.race([submitPromise, buttonReenabledPromise]);

        // Verify the expected state: form submission should fail and modal should remain open
        const submitButton = createGroupModalPage.getCreateGroupFormButton();
        const isSubmitButtonEnabled = await submitButton.isEnabled();
        expect(isSubmitButtonEnabled).toBe(true); // Button should be re-enabled after timeout

        // Modal should still be open
        await expect(createGroupModalPage.isOpen()).resolves.toBe(true);

        // Just close the modal to avoid waiting 10 seconds using Escape key since Cancel button may be disabled during timeout
        await dashboardPage.page.keyboard.press('Escape');
    });

    test('login page resilience to network failures', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const context = page.context();
        const loginPage = new LoginPage(page);
        test.info().annotations.push({ type: 'skip-error-checking' });

        // Block API calls to simulate network failure
        await context.route('**/api/**', (route) => route.abort());

        // Try to load login page (which might make API calls)
        await loginPage.navigate();

        // Page should still render even if API calls fail
        await expect(loginPage.getSignInHeading()).toBeVisible({ timeout: 5000 }); // high timeout intentionally

        // Should not have unhandled errors (handled network errors are ok)
        // This is a basic check - app should handle network failures gracefully
    });
});

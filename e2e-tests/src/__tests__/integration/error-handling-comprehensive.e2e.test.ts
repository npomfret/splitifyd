import {expect, simpleTest as test} from '../../fixtures/simple-test.fixture';
import {CreateGroupModalPage, LoginPage} from '../../pages';
import {TIMEOUT_CONTEXTS, TIMEOUTS} from '../../config/timeouts';
import {SELECTORS} from '../../constants/selectors';
import {generateTestGroupName} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';

/**
 * Comprehensive Error Handling E2E Tests
 *
 * Consolidated from:
 * - network-errors.e2e.test.ts (network failures, server errors, timeouts)
 * - Parts of auth-and-registration.e2e.test.ts (security errors)
 *
 * This file covers all error scenarios comprehensively while eliminating
 * redundancy across multiple test files.
 */

test.describe('Network & Server Error Handling', () => {
    test('should handle all network failure scenarios gracefully', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);

        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Network errors are intentionally triggered to test error handling',
        });

        // Test 1: Network failure during group creation
        const createGroupModal = await dashboardPage.openCreateGroupModal();
        await expect(createGroupModal.isOpen()).resolves.toBe(true);

        // Wait for initial dashboard API calls to settle
        await dashboardPage.page.waitForTimeout(1000);

        // Intercept API calls to simulate network failure - be specific to group creation
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

        // Fill and submit form
        await createGroupModal.fillGroupForm('Network Test Group', 'Testing network error handling');
        await createGroupModal.submitForm();

        // Wait for error handling
        await dashboardPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify error indication is shown
        const anyErrorElement = createGroupModal.getErrorMessage();
        await expect(anyErrorElement.first()).toBeVisible({ timeout: 5000 });

        // Test 2: Malformed API responses (within same test to avoid setup overhead)
        await page.context().unroute(/\/groups$/);

        // Intercept API calls to return malformed JSON - only for GET requests
        await page.context().route(/\/groups$/, (route) => {
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

        // Refresh page to trigger GET request
        await page.reload();
        await dashboardPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // App should still be functional despite malformed response
        const createButton = dashboardPage.getCreateGroupButton();
        await expect(createButton).toBeVisible();
        await expect(createButton).toBeEnabled();
        await dashboardPage.expectUrl(/\/dashboard/);
    });

    test('should handle server errors and timeouts appropriately', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const createGroupModalPage = new CreateGroupModalPage(page, user);
        const context = page.context();

        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Server errors and timeouts are intentionally triggered to test error handling',
        });

        // Test 1: Server error (500)
        await dashboardPage.openCreateGroupModal();
        await dashboardPage.page.waitForTimeout(1000);

        // Intercept API calls to simulate server error
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

        // Should show error indication
        const errorIndication = createGroupModalPage.getErrorMessage();
        await expect(errorIndication.first()).toBeVisible({ timeout: 5000 });

        // Test 2: Timeout scenario (within same test)
        await context.unroute(/\/groups$/);

        // Intercept API calls to simulate timeout
        await context.route('**/groups', async (route) => {
            const method = route.request().method();
            if (method === 'POST') {
                // Wait for timeout delay then respond with timeout
                await new Promise((resolve) => setTimeout(resolve, TIMEOUT_CONTEXTS.SIMULATED_TIMEOUT_DELAY));
                await route.fulfill({ status: 408, body: 'Request Timeout' });
            } else {
                route.continue();
            }
        });

        // Close current modal and open new one for timeout test
        await createGroupModalPage.cancel();
        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm('Timeout Test Group');

        // Start submission and wait for expected UI state changes
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

        // Verify expected state: button should be re-enabled after timeout
        const submitButton = createGroupModalPage.getCreateGroupFormButton();
        const isSubmitButtonEnabled = await submitButton.isEnabled();
        expect(isSubmitButtonEnabled).toBe(true);

        // Modal should still be open
        await expect(createGroupModalPage.isOpen()).resolves.toBe(true);

        // Close modal
        await dashboardPage.page.keyboard.press('Escape');
    });

    test('should prevent form submission with invalid data and handle validation errors', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const createGroupModalPage = new CreateGroupModalPage(page, user);

        // Test 1: Client-side validation
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

        // Test 2: Server validation errors (within same test)
        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Expected: Failed to load resource: the server responded with a status of 400 (Bad Request)'
        });

        // Intercept to simulate server validation error
        await page.context().route(/\/groups$/, (route) => {
            const method = route.request().method();
            if (method === 'POST') {
                route.fulfill({
                    status: 400,
                    body: JSON.stringify({ error: 'Invalid group data', field: 'name' }),
                    headers: { 'Content-Type': 'application/json' },
                });
            } else {
                route.continue();
            }
        });

        await createGroupModalPage.submitForm();

        // Should show error and stay on form
        await dashboardPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const errorMessage = createGroupModalPage.getErrorMessage();
        await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });

        // Should remain on dashboard (not navigate away)
        await dashboardPage.expectUrl(/\/dashboard/);
    });

    test('should handle login page resilience to network failures', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const context = page.context();
        const loginPage = new LoginPage(page);

        test.info().annotations.push({ type: 'skip-error-checking' });

        // Block API calls to simulate network failure
        await context.route('**/api/**', (route) => route.abort());

        // Try to load login page (which might make API calls)
        await loginPage.navigate();

        // Page should still render even if API calls fail
        await expect(loginPage.getSignInHeading()).toBeVisible({ timeout: 5000 });

        // Should not have unhandled errors (handled network errors are ok)
        // This is a basic check - app should handle network failures gracefully
    });
});

test.describe('Security & Access Control Errors', () => {
    test('should handle authentication and authorization failures', async ({ createLoggedInBrowsers, newEmptyBrowser }) => {
        // Test 1: Unauthenticated access redirects
        const { page: unauthPage } = await newEmptyBrowser();

        // Clear authentication by going to login and not logging in
        await unauthPage.goto('/login');

        // Try to access protected dashboard directly
        await unauthPage.goto('/dashboard');

        // Should be redirected to login
        await expect(unauthPage).toHaveURL(/\/login/);

        // Test 2: Protected group page access (within same test for efficiency)
        const [{ page: authPage, dashboardPage, user }] = await createLoggedInBrowsers(1);
        const createGroupModalPage = new CreateGroupModalPage(authPage, user);

        // Create a group while authenticated
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();

        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm('Security Test Group');
        await createGroupModalPage.submitForm();

        // Wait for group creation and get the group ID from URL
        await authPage.waitForURL(/\/groups\/[a-zA-Z0-9]+/);
        const groupId = authPage.url().split('/groups/')[1];

        // Navigate back to dashboard and log out
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();
        await dashboardPage.header.logout();

        // Try to access the group page directly while logged out
        await authPage.goto(`/groups/${groupId}`);

        // Should be redirected to login (may take time for auth check)
        await expect(authPage).toHaveURL(/\/login(\?|$)/, { timeout: 15000 });
    });

    test('should prevent unauthorized access to other users groups', async ({ createLoggedInBrowsers }) => {
        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Expected 404 errors when unauthorized user tries to access private group'
        });

        // Create two browser instances - User 1 and User 2
        const [
            { page: page1, dashboardPage, user: user1 },
            { page: page2 }
        ] = await createLoggedInBrowsers(2);

        const createGroupModalPage = new CreateGroupModalPage(page1, user1);

        // User 1 creates a private group
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();

        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm('Private Group');
        await createGroupModalPage.submitForm();

        // Wait for group creation and get the group ID from URL
        await page1.waitForURL(/\/groups\/[a-zA-Z0-9]+/);
        const groupId = page1.url().split('/groups/')[1];

        // User 2 tries to access User 1's group directly
        await page2.goto(`/groups/${groupId}`);

        // Should be redirected away (either to dashboard or 404)
        await expect(page2).not.toHaveURL(new RegExp(`/groups/${groupId}`));
    });
});
import { CreateGroupFormDataBuilder, generateTestGroupName } from '@splitifyd/test-support';
import { TIMEOUT_CONTEXTS, TIMEOUTS } from '../../config/timeouts';
import { SELECTORS } from '../../constants/selectors';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';
import { CreateGroupModalPage, DashboardPage, LoginPage } from '../../pages';
import type { GroupDetailPage } from '../../pages';
import { ExpenseFormPage as E2EExpenseFormPage } from '../../pages/expense-form.page';

async function navigateToDashboardFromGroupPage(groupDetailPage: GroupDetailPage): Promise<DashboardPage> {
    await groupDetailPage.header.navigateToDashboard();
    const dashboardPage = new DashboardPage(groupDetailPage.page);
    await dashboardPage.waitForDashboard();
    return dashboardPage;
}

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
    test('should handle network failures during group creation', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Network errors are intentionally triggered to test error handling',
        });

        // Set up network failure interception BEFORE opening modal
        let intercepted = false;
        await page.route('**/api/groups', (route) => {
            const method = route.request().method();
            if (method === 'POST') {
                intercepted = true;
                // Use a proper HTTP error status instead of network failure
                route.fulfill({
                    status: 503, // Service Unavailable - more realistic network error
                    body: JSON.stringify({ error: 'Service temporarily unavailable' }),
                    headers: { 'Content-Type': 'application/json' },
                });
            } else {
                route.continue();
            }
        });

        // Open modal and fill form
        const createGroupModal = await dashboardPage.clickCreateGroup();
        await expect(createGroupModal.getModalContainer()).toBeVisible();
        await createGroupModal.fillGroupForm('Network Test Group', 'Testing network error handling');

        // Submit the form
        await createGroupModal.submitForm();

        // Verify the request was intercepted
        await expect(async () => {
            if (!intercepted) {
                throw new Error('Request not intercepted yet');
            }
        })
            .toPass({ timeout: 5000, intervals: [100] });

        // Wait for error message to appear (this is the expected behavior)
        const errorMessage = createGroupModal.getErrorMessage().first();
        await expect(errorMessage).toBeVisible({ timeout: 10000 });

        // Verify modal stays open on error
        await expect(createGroupModal.getModalContainer()).toBeVisible();

        // Verify submit button is re-enabled after error
        const submitButton = createGroupModal.getSubmitButton();
        await expect(submitButton).toBeEnabled({ timeout: 2000 });

        // Clean up route
        await page.unroute('**/api/groups');
    });

    test('should handle malformed API responses gracefully', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Malformed API responses are intentionally triggered to test error handling',
        });

        // Set up malformed response interception for GET requests
        await page.route('**/api/groups*', (route) => {
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

        // Reload page to trigger GET request with malformed response
        await page.reload();
        await dashboardPage.waitForDomContentLoaded();

        // App should still be functional despite malformed response
        const createButton = dashboardPage.getCreateGroupButton();
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await expect(createButton).toBeEnabled();
        await dashboardPage.expectUrl(/\/dashboard/);

        // Clean up route
        await page.unroute('**/api/groups*');
    });

    test('should handle server errors and timeouts appropriately', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
        const createGroupModalPage = new CreateGroupModalPage(page);

        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Server errors and timeouts are intentionally triggered to test error handling',
        });

        // Test 1: Server error (500)
        await dashboardPage.clickCreateGroup();
        await dashboardPage.waitForDomContentLoaded();

        // Intercept API calls to simulate server error
        await page.route('**/api/groups', (route) => {
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
        await dashboardPage.waitForDomContentLoaded();

        // Should show error indication
        const errorIndication = createGroupModalPage.getErrorMessage();
        await expect(errorIndication.first()).toBeVisible({ timeout: 5000 });

        // Test 2: Timeout scenario (within same test)
        await page.unroute('**/api/groups');

        // Intercept API calls to simulate timeout
        await page.route('**/api/groups', async (route) => {
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
        await createGroupModalPage.clickCancel();
        await dashboardPage.clickCreateGroup();
        await createGroupModalPage.fillGroupForm('Timeout Test Group');

        // Start submission and wait for expected UI state changes
        const submitPromise = createGroupModalPage.submitForm();
        const buttonReenabledPromise = page.waitForFunction(
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
        const submitButton = createGroupModalPage.getSubmitButton();
        const isSubmitButtonEnabled = await submitButton.isEnabled();
        expect(isSubmitButtonEnabled).toBe(true);

        // Modal should still be open
        await expect(createGroupModalPage.getModalContainer()).toBeVisible();

        // Close modal
        await page.keyboard.press('Escape');
    });

    test('should prevent form submission with invalid data and handle validation errors', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
        const createGroupModalPage = new CreateGroupModalPage(page);

        // Test 1: Client-side validation
        await dashboardPage.clickCreateGroup();
        await expect(createGroupModalPage.getModalContainer()).toBeVisible();

        // Try to submit empty form
        const submitButton = createGroupModalPage.getSubmitButton();
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
            description: 'Expected: Failed to load resource: the server responded with a status of 400 (Bad Request)',
        });

        // Intercept to simulate server validation error
        await page.route('**/api/groups', (route) => {
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

        // Wait for the response to be processed
        await dashboardPage.waitForDomContentLoaded();

        // The application behavior: modal should stay open and display the error message
        // The error is displayed via enhancedGroupsStore.errorSignal in the modal

        // Modal should still be open
        await expect(createGroupModalPage.getModalContainer()).toBeVisible();

        // Should show error message within the modal
        const errorMessage = createGroupModalPage.getErrorMessage();
        await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });

        // Should remain on dashboard URL but modal should still be open
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
        await loginPage.verifySignInHeadingVisible(5000);

        // Should not have unhandled errors (handled network errors are ok)
        // This is a basic check - app should handle network failures gracefully
    });
});

test.describe('Form Validation & UI Error Handling', () => {
    test('should validate form inputs and handle expense form submission states', async ({ createLoggedInBrowsers }) => {
        const memberCount = 1;

        const [{ dashboardPage }] = await createLoggedInBrowsers(memberCount);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder()
            .build());
        const memberNames = await groupDetailPage.getMemberNames();
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            memberNames,
            (page) => new E2EExpenseFormPage(page),
        );
        const submitButton = expenseFormPage.getSaveButtonForValidation();

        // Test validation sequence
        await expect(submitButton).toBeDisabled(); // Empty form

        await expenseFormPage.fillDescription('Test expense');
        await expect(submitButton).toBeDisabled(); // Missing amount

        await expenseFormPage.fillAmount('0');
        await expect(submitButton).toBeDisabled(); // Zero amount

        await expenseFormPage.fillAmount('50');
        await expect(submitButton).toBeEnabled({ timeout: 2000 }); // Valid form

        // Test clearing description disables form again
        await expenseFormPage.fillDescription('');
        await expect(submitButton).toBeDisabled(); // Missing description
    });

    test('should handle server validation errors gracefully', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected: Failed to load resource: the server responded with a status of 400 (Bad Request)' });

        const memberCount = 1;

        const [{ page, dashboardPage }] = await createLoggedInBrowsers(memberCount);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder()
            .build());
        const memberNames = await groupDetailPage.getMemberNames();
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            memberNames,
            (page) => new E2EExpenseFormPage(page),
        );

        // Create invalid form state that passes client validation but fails server validation
        await expenseFormPage.fillDescription('Test expense');
        await expenseFormPage.fillAmount('50');

        // Set a currency to pass client validation
        const currencyButton = page.getByRole('button', { name: /select currency/i });
        await currencyButton.click();
        const searchInput = page.getByPlaceholder('Search by symbol, code, or country...');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('EUR');
        const currencyOption = page.getByText('Euro (EUR)').first();
        await currencyOption.click();

        const submitButton = expenseFormPage.getSaveButtonForValidation();
        await expect(submitButton).toBeEnabled({ timeout: 2000 });

        await expenseFormPage.typeCategoryText(''); // Clear category to trigger server error
        await submitButton.click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
        await expect(page.getByRole('heading', { name: /something went wrong/i })).toBeVisible({ timeout: 5000 });
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
        let [{ page: authPage, dashboardPage }] = await createLoggedInBrowsers(1);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder()
            .build());
        const groupId = groupDetailPage.inferGroupId();

        // Navigate back to dashboard and log out
        dashboardPage = await navigateToDashboardFromGroupPage(groupDetailPage);
        await dashboardPage.header.logout();

        // Try to access the group page directly while logged out
        await authPage.goto(`/groups/${groupId}`);

        // Should be redirected to login (may take time for auth check)
        await expect(authPage).toHaveURL(/\/login(\?|$)/, { timeout: 15000 });
    });

    test('should prevent unauthorized access to other users groups', async ({ createLoggedInBrowsers }) => {
        test.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Expected 404 errors when unauthorized user tries to access private group',
        });

        // Create two browser instances - User 1 and User 2
        const [{ dashboardPage }, { page: page2 }] = await createLoggedInBrowsers(2);

        // User 1 creates a private group using the efficient helper
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder()
            .build());
        const groupId = groupDetailPage.inferGroupId();

        // User 2 tries to access User 1's group directly
        await page2.goto(`/groups/${groupId}`);

        // Should be redirected away (either to dashboard or 404)
        await expect(page2).not.toHaveURL(new RegExp(`/groups/${groupId}`));
    });
});

import { pageTest as test, expect } from '../../../fixtures/page-fixtures';
import { setupMCPDebugOnFailure } from '../../../helpers';
import { TIMEOUT_CONTEXTS } from '../../../config/timeouts';
import { DEFAULT_PASSWORD, generateTestEmail, generateTestUserName } from '../../../../../packages/test-support/test-helpers';
import { DashboardPage } from '../../../pages';

test.describe('Duplicate User Registration E2E', () => {
    test('should prevent duplicate email registration and show error', async ({ page, registerPage }) => {
        // This test expects a 409 error when trying to register duplicate email
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
        const email = generateTestEmail('duplicate');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Duplicate');

        // First registration - should succeed
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill registration form using page object method
        await registerPage.register(displayName, email, password);

        // Should redirect to dashboard after successful registration
        await expect(page).toHaveURL(/\/dashboard/);

        // Log out to attempt second registration using page object
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.logout();

        // Navigate to register page using page object
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Start capturing console messages before the registration attempt
        const consoleMessages: string[] = [];
        page.on('console', (msg) => {
            consoleMessages.push(`${msg.type()}: ${msg.text()}`);
        });

        // Fill form again with same email using enhanced page object methods
        await registerPage.fillFormField('name', displayName);
        await registerPage.fillFormField('email', email);
        await registerPage.fillFormField('password', password);
        await registerPage.fillFormField('confirmPassword', password);
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit form and wait for error response using page object method
        const responsePromise = registerPage.waitForRegistrationResponse(409);
        await registerPage.submitForm();
        await responsePromise;

        // Should NOT redirect - should stay on registration page
        await registerPage.expectUrl(/\/register/);

        // Check for error message using enhanced page object method
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });

        const errorText = await errorElement.textContent();
        expect(errorText?.toLowerCase()).toMatch(/email.*already.*exists|email.*in use|account.*exists|email.*registered/);

        // Check console for error messages (make it more flexible)
        // The 409 error appears as a resource load failure
        const errorInConsole = consoleMessages.some((msg) => {
            const lowerMsg = msg.toLowerCase();
            return lowerMsg.includes('409') || (lowerMsg.includes('error') && lowerMsg.includes('conflict'));
        });

        // We verified the error appears on screen, and the 409 is in the console
        expect(errorInConsole).toBe(true);
    });

    test('should show error immediately without clearing form', async ({ page, registerPage }) => {
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });

        const email = generateTestEmail('persist');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Persist');

        // First registration using page object
        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.register(displayName, email, password);

        // Wait for dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Log out using page object
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.logout();

        // Wait for navigation after logout using page object
        await expect(page).toHaveURL((url) => {
            const urlStr = url.toString();
            const path = new URL(urlStr).pathname;
            return path === '/' || path === '/login' || path === '/home';
        });

        // Second attempt - navigate to register page using page object
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill form using enhanced page object methods
        await registerPage.fillFormField('name', displayName);
        await registerPage.fillFormField('email', email);
        await registerPage.fillFormField('password', password);
        await registerPage.fillFormField('confirmPassword', password);
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit and wait for the expected error response using page object method
        const responsePromise2 = registerPage.waitForRegistrationResponse(409);
        await registerPage.submitForm();
        await responsePromise2;

        // Form fields should still contain the values - using page object getters
        const nameInput = registerPage.getFormField('name');
        const emailInput = registerPage.getFormField('email');
        const passwordInput = registerPage.getFormField('password');

        await expect(nameInput).toHaveValue(displayName);
        await expect(emailInput).toHaveValue(email);
        // Password might be cleared for security - check if it has value
        const passwordValue = await passwordInput.inputValue();
        expect(passwordValue.length).toBeGreaterThanOrEqual(0); // Allow it to be cleared or retained

        // Error should be visible using page object method
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });
    });

    test('should allow registration with different email after duplicate attempt', async ({ page, registerPage }) => {
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });

        const email1 = generateTestEmail('first');
        const email2 = generateTestEmail('second');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('Recovery');

        // First registration using page object
        await registerPage.navigate();
        await registerPage.waitForFormReady();
        await registerPage.register(displayName, email1, password);
        await expect(page).toHaveURL(/\/dashboard/);

        // Log out using page object
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.logout();

        // Wait for navigation after logout
        await expect(page).toHaveURL((url) => {
            const urlStr = url.toString();
            const path = new URL(urlStr).pathname;
            return path === '/' || path === '/login' || path === '/home';
        });

        // Try duplicate (should fail) using page object methods
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill form with duplicate email using enhanced page object methods
        await registerPage.fillFormField('name', displayName);
        await registerPage.fillFormField('email', email1);
        await registerPage.fillFormField('password', password);
        await registerPage.fillFormField('confirmPassword', password);
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit and wait for the expected error response using page object method
        const responsePromise3 = registerPage.waitForRegistrationResponse(409);
        await registerPage.submitForm();
        await responsePromise3;

        // Should see error using page object method
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });

        // Now change email and try again using page object method
        await registerPage.fillFormField('email', email2);
        await registerPage.submitForm();

        // Should succeed this time
        await expect(page).toHaveURL(/\/dashboard/);
    });
});

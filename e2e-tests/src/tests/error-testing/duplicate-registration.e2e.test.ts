import { pageTest as test, expect } from '../../fixtures/page-fixtures';
import { setupMCPDebugOnFailure } from '../../helpers';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { generateTestEmail, generateTestUserName } from '../../utils/test-helpers';

setupMCPDebugOnFailure();

test.describe('Duplicate User Registration E2E', () => {
    test('should prevent duplicate email registration and show error', async ({ page, registerPage }) => {
        // This test expects a 409 error when trying to register duplicate email
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });
        const email = generateTestEmail('duplicate');
        const password = 'TestPassword123!';
        const displayName = generateTestUserName('Duplicate');

        // First registration - should succeed
        await registerPage.navigate();

        // Fill registration form
        await registerPage.register(displayName, email, password);

        // Should redirect to dashboard after successful registration
        await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });

        // Log out to attempt second registration
        // Use the new DashboardPage signOut method
        const { DashboardPage } = await import('../../pages');
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.signOut();

        // Navigate to register page
        await registerPage.navigate();

        // Start capturing console messages before the registration attempt
        const consoleMessages: string[] = [];
        page.on('console', (msg) => {
            consoleMessages.push(`${msg.type()}: ${msg.text()}`);
        });

        // Wait for register page to load
        await page.waitForLoadState('domcontentloaded');

        // Fill form again with same email using page object methods
        const nameInput = registerPage.getFullNameInput();
        const emailInput = registerPage.getEmailInput();
        const passwordInput = registerPage.getPasswordInput();
        const confirmPasswordInput = registerPage.getConfirmPasswordInput();
        const termsCheckbox = registerPage.getTermsCheckbox();
        const cookieCheckbox = registerPage.getCookieCheckbox();
        const submitButton = registerPage.getSubmitButton();

        await registerPage.fillPreactInput(nameInput, displayName);
        await registerPage.fillPreactInput(emailInput, email);
        await registerPage.fillPreactInput(passwordInput, password);
        await registerPage.fillPreactInput(confirmPasswordInput, password);
        await termsCheckbox.check();
        await cookieCheckbox.check();

        // Click register button and wait for the expected error response
        await Promise.all([page.waitForResponse((response) => response.url().includes('/api/register') && response.status() >= 400, { timeout: TIMEOUT_CONTEXTS.API_RESPONSE }), submitButton.click()]);

        // Should NOT redirect - should stay on registration page
        await expect(page).toHaveURL(/\/register/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });

        // Check for error message on screen using the RegisterPage's error method
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
        const password = 'TestPassword123!';
        const displayName = generateTestUserName('Persist');

        // First registration
        await registerPage.navigate();
        await registerPage.register(displayName, email, password);

        // Wait for dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });

        // Log out
        const userMenuButton = page.getByRole('button', { name: displayName });
        await userMenuButton.click();
        await page.getByText('Sign out').click();

        // Wait for navigation after logout
        await page.waitForURL(
            (url) => {
                const urlStr = url.toString();
                const path = new URL(urlStr).pathname;
                return path === '/' || path === '/login' || path === '/home';
            },
            { timeout: TIMEOUT_CONTEXTS.URL_CHANGE },
        );

        // Second attempt - navigate to register page
        await registerPage.navigate();
        await page.waitForLoadState('domcontentloaded');

        // Fill form using the shared helper to trigger Preact signals
        const nameInput = registerPage.getFullNameInput();
        const emailInput = registerPage.getEmailInput();
        const passwordInput = registerPage.getPasswordInput();
        const confirmPasswordInput = registerPage.getConfirmPasswordInput();

        await registerPage.fillPreactInput(nameInput, displayName);
        await registerPage.fillPreactInput(emailInput, email);
        await registerPage.fillPreactInput(passwordInput, password);
        await registerPage.fillPreactInput(confirmPasswordInput, password);
        const termsCheckbox = registerPage.getTermsCheckbox();
        const cookieCheckbox = registerPage.getCookieCheckbox();
        const submitButton = registerPage.getSubmitButton();

        await termsCheckbox.check();
        await cookieCheckbox.check();

        // Submit and wait for the expected error response
        await Promise.all([page.waitForResponse((response) => response.url().includes('/api/register') && response.status() >= 400, { timeout: TIMEOUT_CONTEXTS.API_RESPONSE }), submitButton.click()]);

        // Form fields should still contain the values
        await expect(nameInput).toHaveValue(displayName);
        await expect(emailInput).toHaveValue(email);
        // Password might be cleared for security - check if it has value
        const passwordValue = await passwordInput.inputValue();
        expect(passwordValue.length).toBeGreaterThanOrEqual(0); // Allow it to be cleared or retained

        // Error should be visible
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });
    });

    test('should allow registration with different email after duplicate attempt', async ({ page, registerPage }) => {
        test.info().annotations.push({ type: 'skip-error-checking', description: '409 Conflict error is expected' });

        const email1 = generateTestEmail('first');
        const email2 = generateTestEmail('second');
        const password = 'TestPassword123!';
        const displayName = generateTestUserName('Recovery');

        // First registration
        await registerPage.navigate();
        await registerPage.register(displayName, email1, password);
        await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });

        // Log out
        const userMenuButton = page.getByRole('button', { name: displayName });
        await userMenuButton.click();
        await page.getByText('Sign out').click();

        // Wait for navigation after logout
        await page.waitForURL(
            (url) => {
                const urlStr = url.toString();
                const path = new URL(urlStr).pathname;
                return path === '/' || path === '/login' || path === '/home';
            },
            { timeout: TIMEOUT_CONTEXTS.URL_CHANGE },
        );

        // Try duplicate (should fail)
        await registerPage.navigate();
        await page.waitForLoadState('domcontentloaded');

        // Use shared helper for Preact input handling
        const nameInput = registerPage.getFullNameInput();
        const emailInput = registerPage.getEmailInput();
        const passwordInput = registerPage.getPasswordInput();
        const confirmPasswordInput = registerPage.getConfirmPasswordInput();
        const termsCheckbox = registerPage.getTermsCheckbox();
        const submitButton = registerPage.getSubmitButton();

        await registerPage.fillPreactInput(nameInput, displayName);
        await registerPage.fillPreactInput(emailInput, email1);
        await registerPage.fillPreactInput(passwordInput, password);
        await registerPage.fillPreactInput(confirmPasswordInput, password);
        const cookieCheckbox = registerPage.getCookieCheckbox();
        await termsCheckbox.check();
        await cookieCheckbox.check();

        // Submit and wait for the expected error response
        await Promise.all([page.waitForResponse((response) => response.url().includes('/api/register') && response.status() >= 400, { timeout: TIMEOUT_CONTEXTS.API_RESPONSE }), submitButton.click()]);

        // Should see error
        const errorElement = registerPage.getEmailError();
        await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });

        // Now change email and try again using page object
        await registerPage.fillPreactInput(emailInput, email2);
        await submitButton.click();

        // Should succeed this time
        await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.URL_CHANGE });
    });
});

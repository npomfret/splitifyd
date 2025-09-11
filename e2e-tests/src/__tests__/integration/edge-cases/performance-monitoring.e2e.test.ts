import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { waitForApp } from '../../../helpers';
import { TIMEOUTS } from '../../../config/timeouts';
import { RegisterPage, LoginPage } from '../../../pages';

// NOTE: Simple load time testing moved to CI performance budgets
simpleTest.describe('Performance Monitoring E2E', () => {
    simpleTest('should handle login and registration form interactions correctly on slow network', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const context = page.context();
        const loginPage = new LoginPage(page);
        // Simulate slow 3G network conditions
        await context.route('**/*', (route) => {
            setTimeout(() => route.continue(), TIMEOUTS.QUICK / 5);
        });

        await loginPage.navigate();

        // Page should still load and be functional on slow network
        await waitForApp(page);
        await expect(loginPage.getHeading('Sign In')).toBeVisible();

        // Test comprehensive form functionality under slow network conditions
        const emailInput = loginPage.getEmailInput();
        const passwordInput = loginPage.getPasswordInput();
        const submitButton = loginPage.getSubmitButton();

        // Test email input
        await loginPage.fillPreactInput(emailInput, 'test@example.com');
        await expect(emailInput).toHaveValue('test@example.com');

        // Test password input
        await loginPage.fillPreactInput(passwordInput, 'TestPassword123');
        await expect(passwordInput).toHaveValue('TestPassword123');

        // Test form validation - clear email and check submit is disabled
        await loginPage.fillPreactInput(emailInput, '');
        await expect(submitButton).toBeDisabled();

        // Re-fill email
        await loginPage.fillPreactInput(emailInput, 'test@example.com');
        await expect(submitButton).toBeEnabled();

        // Test navigation links still work
        await loginPage.clickSignUp();

        // Should navigate to register page even with slow network
        await expect(page).toHaveURL(/\/register/);
        const registerPage = new RegisterPage(page);
        await expect(registerPage.getHeading('Create Account')).toBeVisible();

        // No console errors
        // Console errors are automatically captured by
    });
});

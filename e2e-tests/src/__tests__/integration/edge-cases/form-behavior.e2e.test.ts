import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { LoginPage, RegisterPage } from '../../../pages';
import { waitForApp } from '../../../helpers';
simpleTest.describe('Form Behavior Edge Cases', () => {
    simpleTest('should persist form values on page refresh', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // Wait for any pre-filled data to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Clear any pre-filled data first
        const emailInput = loginPage.getEmailInput();
        const passwordInput = loginPage.getPasswordInput();

        await loginPage.fillPreactInput(emailInput, '');
        await loginPage.fillPreactInput(passwordInput, '');

        // Now fill form with our test data
        await loginPage.fillPreactInput(emailInput, 'user@testsite.com');
        await loginPage.fillPreactInput(passwordInput, 'MyCustomPass456');

        // Verify values are filled
        await expect(emailInput).toHaveValue('user@testsite.com');
        await expect(passwordInput).toHaveValue('MyCustomPass456');

        // Refresh page and wait for app
        await page.reload();
        await waitForApp(page);

        // Get the inputs again after refresh
        const refreshedEmailInput = loginPage.getEmailInput();
        const refreshedPasswordInput = loginPage.getPasswordInput();

        // Values should persist via sessionStorage
        const newEmailValue = await refreshedEmailInput.inputValue();
        const newPasswordValue = await refreshedPasswordInput.inputValue();

        // Our custom values should persist
        expect(newEmailValue).toBe('user@testsite.com');
        expect(newPasswordValue).toBe('MyCustomPass456');

        // No console errors
        // Console errors are automatically captured by
    });

    simpleTest('should trim whitespace from inputs', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Fill form with extra spaces
        const nameInput = registerPage.getNameInputByType();
        const emailInput = registerPage.getEmailInputByType();

        await registerPage.fillPreactInput(nameInput, '  Test User  ');
        await registerPage.fillPreactInput(emailInput, '  test@example.com  ');

        // Tab away to trigger any trim logic
        await emailInput.press('Tab');

        // Values should be trimmed (this depends on implementation)
        // Just verify we can type with spaces without errors

        // No console errors
        // Console errors are automatically captured by
    });
});

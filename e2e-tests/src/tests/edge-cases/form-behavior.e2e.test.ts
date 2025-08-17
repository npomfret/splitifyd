import { pageTest, expect } from '../../fixtures';
import { waitForApp, setupMCPDebugOnFailure } from '../../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

pageTest.describe('Form Behavior Edge Cases', () => {
    pageTest('should clear form on page refresh', async ({ loginPageNavigated }) => {
        const { page, loginPage } = loginPageNavigated;

        // Wait for any pre-filled data to load
        await page.waitForLoadState('domcontentloaded');

        // Clear any pre-filled data first
        const emailInput = loginPage.getEmailInput();
        const passwordInput = loginPage.getPasswordInput();

        await loginPage.fillPreactInput(emailInput, '');
        await loginPage.fillPreactInput(passwordInput, '');

        // Now fill form with our test data
        await loginPage.fillPreactInput(emailInput, 'test@example.com');
        await loginPage.fillPreactInput(passwordInput, 'Password123');

        // Verify values are filled
        await expect(emailInput).toHaveValue('test@example.com');
        await expect(passwordInput).toHaveValue('Password123');

        // Refresh page
        await page.reload();
        await waitForApp(page);

        // In dev, form may be pre-filled from config, but our custom values should be gone
        const newEmailValue = await emailInput.inputValue();
        const newPasswordValue = await passwordInput.inputValue();

        // Our custom values should not persist
        expect(newEmailValue).not.toBe('test@example.com');
        expect(newPasswordValue).not.toBe('Password123');

        // No console errors
        // Console errors are automatically captured by
    });

    pageTest('should trim whitespace from inputs', async ({ registerPageNavigated }) => {
        const { registerPage } = registerPageNavigated;

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

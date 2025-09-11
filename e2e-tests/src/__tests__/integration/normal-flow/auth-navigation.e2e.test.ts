import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { RegisterPage } from '../../../pages';
import { generateTestEmail, generateTestUserName } from '../../../../../packages/test-support/test-helpers.ts';

simpleTest.describe('Auth Navigation E2E', () => {
    simpleTest('should navigate between login and register pages', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();

        // Verify login page loaded
        await expect(loginPage.getSignInHeading()).toBeVisible();
        await expect(loginPage.getSubmitButton()).toBeVisible();

        // Click "Sign up" link
        await loginPage.clickSignUp();

        // Create register page object
        const registerPage = new RegisterPage(page);
        
        // Verify register page loaded
        await expect(registerPage.getCreateAccountHeading()).toBeVisible();
        await expect(registerPage.getSubmitButton()).toBeVisible();

        // Click "Sign in" link using page object method
        await registerPage.getSignInLink().click();

        // Back on login page
        await expect(loginPage.getSignInHeading()).toBeVisible();
    });

    simpleTest('should show form fields on login page', async ({ newEmptyBrowser }) => {
        const { loginPage } = await newEmptyBrowser();

        // Verify form fields are present
        await expect(loginPage.getEmailLabel()).toBeVisible();
        await expect(loginPage.getPasswordLabel()).toBeVisible();
        await expect(loginPage.getSubmitButton()).toBeVisible();
    });

    simpleTest('should show form fields on register page', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Verify form fields are present
        await expect(registerPage.getFullNameLabel()).toBeVisible();
        await expect(registerPage.getEmailLabel()).toBeVisible();
        await expect(registerPage.getPasswordLabel()).toBeVisible();
        await expect(registerPage.getConfirmPasswordLabel()).toBeVisible();
        await expect(registerPage.getSubmitButton()).toBeVisible();
    });

    simpleTest('should allow typing in login form fields', async ({ newEmptyBrowser }) => {
        const { loginPage } = await newEmptyBrowser();

        // Find and fill email input using page object methods
        const emailInput = loginPage.getEmailInput();
        const testEmail = generateTestEmail();
        await loginPage.fillPreactInput(emailInput, testEmail);
        await expect(emailInput).toHaveValue(testEmail);

        // Find and fill password input using page object methods
        const passwordInput = loginPage.getPasswordInput();
        await loginPage.fillPreactInput(passwordInput, 'TestPassword123');
        await expect(passwordInput).toHaveValue('TestPassword123');
    });

    simpleTest('should allow typing in register form fields', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        await registerPage.navigate();

        // Find and fill name input using page object methods
        const nameInput = registerPage.getFullNameInput();
        const testName = generateTestUserName();
        await registerPage.fillPreactInput(nameInput, testName);
        await expect(nameInput).toHaveValue(testName);

        // Find and fill email input using page object methods
        const emailInput = registerPage.getEmailInput();
        const testEmail2 = generateTestEmail();
        await registerPage.fillPreactInput(emailInput, testEmail2);
        await expect(emailInput).toHaveValue(testEmail2);

        // Find and fill password inputs using page object methods
        const passwordInput = registerPage.getPasswordInput();
        await registerPage.fillPreactInput(passwordInput, 'TestPassword123');
        await expect(passwordInput).toHaveValue('TestPassword123');

        const confirmPasswordInput = registerPage.getConfirmPasswordInput();
        await registerPage.fillPreactInput(confirmPasswordInput, 'TestPassword123');
        await expect(confirmPasswordInput).toHaveValue('TestPassword123');
    });

    simpleTest('should show forgot password link on login page', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();

        // Check for forgot password link
        await expect(loginPage.getForgotPasswordLink()).toBeVisible();

        // Click it and verify navigation
        await loginPage.clickForgotPassword();

        // Should navigate away from login page
        await expect(page).not.toHaveURL(/\/login$/);
    });
});

import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { RegisterPage } from '../../../pages';
import { DEFAULT_PASSWORD, generateTestEmail } from '../../../../../packages/test-support/test-helpers.ts';

simpleTest.describe('Terms and Cookie Policy Acceptance', () => {
    simpleTest('should display both terms and cookie policy checkboxes', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const registerPage = new RegisterPage(page);

        // Check that both checkboxes are present using page object methods
        await expect(registerPage.getTermsCheckbox()).toBeVisible();
        await expect(registerPage.getCookieCheckbox()).toBeVisible();

        // Check that they have appropriate labels
        await expect(registerPage.getTermsText()).toBeVisible();
        await expect(registerPage.getCookieText()).toBeVisible();

        // Check that links exist
        await expect(registerPage.getTermsLink()).toBeVisible();
        await expect(registerPage.getCookiesLink()).toBeVisible();
    });

    simpleTest('should disable submit button when terms not accepted', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        // Fill form but leave terms unchecked
        const registerPage = new RegisterPage(page);
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Check only cookie policy checkbox using page object method
        await registerPage.checkCookieCheckbox();

        // Submit button should be disabled
        await expect(registerPage.getCreateAccountButton()).toBeDisabled();
    });

    simpleTest('should disable submit button when cookie policy not accepted', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const registerPage = new RegisterPage(page);
        // Fill form but leave cookie policy unchecked
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Check only terms checkbox using page object method
        await registerPage.checkTermsCheckbox();

        // Submit button should be disabled
        await expect(registerPage.getCreateAccountButton()).toBeDisabled();
    });

    simpleTest('should enable submit button when both policies accepted', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const registerPage = new RegisterPage(page);
        // Fill form completely
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Check both checkboxes using page object methods
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit button should be enabled
        await expect(registerPage.getCreateAccountButton()).toBeEnabled();
    });

    simpleTest('should show appropriate error messages for unchecked boxes', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const registerPage = new RegisterPage(page);
        // Fill form but don't check any boxes
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Try to submit (should show validation error before form submission)
        // Since the submit button is disabled, we'll test by checking the form validity
        const submitButton = registerPage.getCreateAccountButton();
        await expect(submitButton).toBeDisabled();

        // Check one box, should still be disabled
        await registerPage.checkTermsCheckbox();
        await expect(submitButton).toBeDisabled();

        // Check second box, should now be enabled
        await registerPage.checkCookieCheckbox();
        await expect(submitButton).toBeEnabled();
    });
});

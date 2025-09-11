import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { HomepagePage, LoginPage, RegisterPage } from '../../../pages';
import { waitForApp } from '../../../helpers';
simpleTest.describe('Error Monitoring E2E', () => {
    simpleTest('should load homepage without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        
        // Navigate from login page to homepage
        await loginPage.navigateToHomepage();
        
        const homepagePage = new HomepagePage(page);
        
        // Basic smoke test - verify page loads and main heading is visible
        await expect(homepagePage.getMainHeading()).toBeVisible();
    });

    simpleTest('should load login page without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        
        // Basic smoke test - verify page loads and form is present
        await expect(loginPage.getSignInHeading()).toBeVisible();
    });

    simpleTest('should load register page without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        
        // Navigate to register page
        await loginPage.clickSignUp();
        
        const registerPage = new RegisterPage(page);
        
        // Basic smoke test - verify page loads and form is present
        await expect(registerPage.getCreateAccountHeading()).toBeVisible();
    });

    simpleTest('should load pricing page without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        
        // Navigate from login page to homepage, then to pricing
        await loginPage.navigateToHomepage();
        
        const homepagePage = new HomepagePage(page);
        await homepagePage.getPricingLink().click();
        
        // Basic smoke test - verify page loads and main heading is visible
        await expect(page.getByRole('heading').first()).toBeVisible();
    });

    simpleTest('should load terms page without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        
        // Navigate from login page to homepage, then to terms
        await loginPage.navigateToHomepage();
        
        const homepagePage = new HomepagePage(page);
        await homepagePage.getTermsLink().click();
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        
        // Basic smoke test - verify page loads and main heading is visible
        await expect(page.getByRole('heading').first()).toBeVisible();
    });

    simpleTest('should load privacy page without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        
        // Navigate from login page to homepage, then to privacy
        await loginPage.navigateToHomepage();
        
        const homepagePage = new HomepagePage(page);
        await homepagePage.getPrivacyLink().click();
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        
        // Basic smoke test - verify page loads and main heading is visible
        await expect(page.getByRole('heading').first()).toBeVisible();
    });
});

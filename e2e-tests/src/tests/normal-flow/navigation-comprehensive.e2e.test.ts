import { pageTest as test, expect } from '../../fixtures/page-fixtures';
import { setupMCPDebugOnFailure, EMULATOR_URL } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

test.describe('Comprehensive Navigation E2E', () => {
    test('should navigate between all main pages', async ({ page, homepagePage, loginPage, registerPage, pricingPage }) => {
        // Start from homepage
        await homepagePage.navigate();

        // Verify homepage loads with key elements
        await expect(homepagePage.getMainHeading()).toBeVisible();
        await expect(homepagePage.getPricingLink()).toBeVisible();
        await expect(homepagePage.getLoginLink()).toBeVisible();
        await expect(homepagePage.getSignUpLink()).toBeVisible();

        // Navigate to Pricing
        await homepagePage.getPricingLink().click();
        await expect(page).toHaveURL(/\/pricing/);
        await expect(pricingPage.getHeading('Pricing')).toBeVisible();

        // Navigate to Login from header
        await homepagePage.getLoginLink().click();
        await expect(page).toHaveURL(/\/login/);
        await expect(loginPage.getHeading('Sign In')).toBeVisible();

        // Navigate back to home via logo
        await homepagePage.getLogo().click();
        await expect(homepagePage.getMainHeading()).toBeVisible();

        // Navigate to Register
        await homepagePage.getSignUpLink().click();
        await expect(page).toHaveURL(/\/register/);
        await expect(registerPage.getHeading('Create Account')).toBeVisible();

        // Test logo navigation from pricing page
        await pricingPage.navigate();
        const logoLink = homepagePage.getLogoLink();
        await logoLink.click();
        await expect(page).toHaveURL(EMULATOR_URL);
    });

    test('should navigate to static pages from footer', async ({ page, loginPage, homepagePage }) => {
        await loginPage.navigate();

        // Navigate to Terms
        await homepagePage.getTermsLink().click();
        await expect(page).toHaveURL(/\/terms/);

        // Navigate back to login
        await loginPage.navigate();

        // Navigate to Privacy
        await homepagePage.getPrivacyLink().click();
        await expect(page).toHaveURL(/\/privacy/);
    });

    test('should verify footer links exist on homepage', async ({ page, homepagePage }) => {
        await homepagePage.navigate();

        // Check footer exists and has required links
        const footer = homepagePage.getFooter();
        await expect(footer).toBeVisible();

        const termsLink = homepagePage.getTermsLink();
        await expect(termsLink).toBeVisible();

        const privacyLink = homepagePage.getPrivacyLink();
        await expect(privacyLink).toBeVisible();
    });
});

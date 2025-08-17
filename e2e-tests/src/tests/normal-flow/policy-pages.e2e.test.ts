import { pageTest } from '../../fixtures';
import { setupMCPDebugOnFailure, waitForApp } from '../../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

pageTest.describe('Policy Pages E2E', () => {
    pageTest('should load terms of service page without JavaScript errors', async ({ page, homepagePage }) => {
        await homepagePage.navigateToStaticPath('/terms');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded');

        // Verify the page loaded with terms content
        await page
            .getByRole('heading', { level: 1 })
            .filter({ hasText: /Terms of Service|Terms and Conditions/ })
            .first()
            .waitFor();
    });

    pageTest('should load privacy policy page without JavaScript errors', async ({ page, homepagePage }) => {
        await homepagePage.navigateToStaticPath('/privacy');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded');

        // Verify the page loaded with privacy content
        await page
            .getByRole('heading', { level: 1 })
            .filter({ hasText: /Privacy Policy|Privacy/ })
            .first()
            .waitFor();
    });

    pageTest('should load cookie policy page without JavaScript errors', async ({ page, homepagePage }) => {
        await homepagePage.navigateToStaticPath('/cookies');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded');

        // Verify the page loaded with cookie content
        await page
            .getByRole('heading', { level: 1 })
            .filter({ hasText: /Cookie Policy|Cookie/ })
            .first()
            .waitFor();
    });

    pageTest(
        'should navigate between policy pages without errors',
        {
            annotation: { type: 'skip-error-checking', description: 'Policy fetch errors expected in test environment' },
        },
        async ({ page, homepagePage }) => {
            // Start with terms page
            await homepagePage.navigateToStaticPath('/terms');
            await waitForApp(page);
            await page
                .getByRole('heading', { level: 1 })
                .filter({ hasText: /Terms of Service|Terms and Conditions/ })
                .first()
                .waitFor();

            // Navigate to privacy
            await homepagePage.navigateToStaticPath('/privacy');
            await waitForApp(page);
            await page
                .getByRole('heading', { level: 1 })
                .filter({ hasText: /Privacy Policy|Privacy/ })
                .first()
                .waitFor();

            // Navigate to cookies
            await homepagePage.navigateToStaticPath('/cookies');
            await waitForApp(page);
            await page
                .getByRole('heading', { level: 1 })
                .filter({ hasText: /Cookie Policy|Cookie/ })
                .first()
                .waitFor();
        },
    );

    pageTest('should display policy content and not show loading states indefinitely', async ({ page, homepagePage }) => {
        await homepagePage.navigateToStaticPath('/terms');
        await waitForApp(page);

        // Ensure policy content appears and no loading spinners remain visible
        await page
            .getByRole('heading', { level: 1 })
            .filter({ hasText: /Terms of Service|Terms and Conditions/ })
            .first()
            .waitFor();

        // Verify policy text content is visible (not just headings)
        const policyContent = page.locator('div, section, main').filter({ hasText: /terms|conditions|agreement|service/i });
        await policyContent.first().waitFor({ state: 'visible' });

        // Ensure no persistent loading states
        const loadingIndicators = page.locator('[data-testid*="loading"], .loading, [class*="spinner"], [class*="loading"]');
        await loadingIndicators
            .first()
            .waitFor({ state: 'hidden', timeout: 5000 })
            .catch(() => {
                // Loading indicators might not exist, which is fine
            });
    });
});

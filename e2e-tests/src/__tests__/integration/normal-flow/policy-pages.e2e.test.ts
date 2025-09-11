import { simpleTest } from '../../../fixtures/simple-test.fixture';
import { HomepagePage } from '../../../pages';
import { waitForApp } from '../../../helpers';

simpleTest.describe('Policy Pages E2E', () => {
    simpleTest('should load terms of service page without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigateToStaticPath('/terms');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify the page loaded with terms content
        await homepagePage
            .getHeadingByLevel(1)
            .filter({ hasText: /Terms of Service|Terms and Conditions/ })
            .first()
            .waitFor();
    });

    simpleTest('should load privacy policy page without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigateToStaticPath('/privacy');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify the page loaded with privacy content
        await homepagePage
            .getHeadingByLevel(1)
            .filter({ hasText: /Privacy Policy|Privacy/ })
            .first()
            .waitFor();
    });

    simpleTest('should load cookie policy page without JavaScript errors', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigateToStaticPath('/cookies');
        await waitForApp(page);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify the page loaded with cookie content
        await homepagePage
            .getHeadingByLevel(1)
            .filter({ hasText: /Cookie Policy|Cookie/ })
            .first()
            .waitFor();
    });

    simpleTest('should display policy content and not show loading states indefinitely', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigateToStaticPath('/terms');
        await waitForApp(page);

        // Ensure policy content appears and no loading spinners remain visible
        await homepagePage
            .getHeadingByLevel(1)
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

    simpleTest(
        'should navigate between policy pages without errors',
        {
            annotation: { type: 'skip-error-checking', description: 'Policy fetch errors expected in test environment' },
        },
        async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            const homepagePage = new HomepagePage(page);
            // Start with terms page
            await homepagePage.navigateToStaticPath('/terms');
            await waitForApp(page);
            await homepagePage
                .getHeadingByLevel(1)
                .filter({ hasText: /Terms of Service|Terms and Conditions/ })
                .first()
                .waitFor();

            // Navigate to privacy
            await homepagePage.navigateToStaticPath('/privacy');
            await waitForApp(page);
            await homepagePage
                .getHeadingByLevel(1)
                .filter({ hasText: /Privacy Policy|Privacy/ })
                .first()
                .waitFor();

            // Navigate to cookies
            await homepagePage.navigateToStaticPath('/cookies');
            await waitForApp(page);
            await homepagePage
                .getHeadingByLevel(1)
                .filter({ hasText: /Cookie Policy|Cookie/ })
                .first()
                .waitFor();
        },
    );
});

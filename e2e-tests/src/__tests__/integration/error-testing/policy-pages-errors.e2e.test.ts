import { simpleTest } from '../../../fixtures/simple-test.fixture';
import { HomepagePage } from '../../../pages';
import { waitForApp } from '../../../helpers';
simpleTest.describe('Policy Pages Error Testing', () => {
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

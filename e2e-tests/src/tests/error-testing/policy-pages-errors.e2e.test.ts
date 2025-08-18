import { pageTest } from '../../fixtures';
import { setupMCPDebugOnFailure, waitForApp } from '../../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

pageTest.describe('Policy Pages Error Testing', () => {
    pageTest(
        'should navigate between policy pages without errors',
        {
            annotation: { type: 'skip-error-checking', description: 'Policy fetch errors expected in test environment' },
        },
        async ({ page, homepagePage }) => {
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
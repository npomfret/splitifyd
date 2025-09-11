import {expect, simpleTest as test} from '../../../fixtures/simple-test.fixture';

import { MultiUserWorkflow } from '../../../workflows';
import { JoinGroupPage, GroupDetailPage } from '../../../pages';

test.describe('Share Link - Error Scenarios', () => {
    test('should handle invalid share links gracefully', { annotation: { type: 'skip-error-checking' } }, async ({ newLoggedInBrowser }) => {
        const { page } = await newLoggedInBrowser();

        // Get the base URL from the current page
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const baseUrl = page.url().split('/dashboard')[0];
        const invalidShareLink = `${baseUrl}/join?linkId=invalid-group-id-12345`;

        const multiUserWorkflow = new MultiUserWorkflow();
        await multiUserWorkflow.testInvalidShareLink(page, invalidShareLink);
    });

    test('should handle malformed share links', { annotation: { type: 'skip-error-checking' } }, async ({ newLoggedInBrowser }) => {
        const { page } = await newLoggedInBrowser();

        // Get the base URL from the current page using page object
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const baseUrl = page.url().split('/dashboard')[0];

        // Test various malformed links using page object navigation
        // When linkId is missing or empty, app now shows an error page (not redirect)
        const emptyLinkCases = [`${baseUrl}/join?linkId=`, `${baseUrl}/join`];

        for (const link of emptyLinkCases) {
            await page.goto(link);
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Should stay on /join page and show error message
            expect(page.url()).toContain('/join');

            // Check for error message
            await expect(page.getByText('Invalid Link')).toBeVisible();
            await expect(page.getByText(/No group invitation link was provided/)).toBeVisible();

            // Should have a button to go back to dashboard
            const backButton = page.getByRole('button', { name: /Back to Dashboard/i });
            await expect(backButton).toBeVisible();
        }

        // Test with malicious/invalid linkId - should show error
        const invalidLink = `${baseUrl}/join?linkId=../../malicious`;
        const multiUserWorkflow = new MultiUserWorkflow();
        await multiUserWorkflow.testInvalidShareLink(page, invalidLink);
    });

    test('should display error messages with back navigation option', { annotation: { type: 'skip-error-checking' } }, async ({ newLoggedInBrowser }) => {
        const { page } = await newLoggedInBrowser();
        const joinGroupPage = new JoinGroupPage(page);
        const groupDetailPage = new GroupDetailPage(page);

        const invalidShareLink = `${page.url().split('/dashboard')[0]}/join?linkId=invalid-specific-test`;

        // Navigate to invalid share link using page object method
        await groupDetailPage.navigateToShareLink(invalidShareLink);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // The app should show an error message for invalid links
        await expect(joinGroupPage.getErrorMessage()).toBeVisible();

        // Should show specific error message using page object method  
        const errorMessage = joinGroupPage.getSpecificErrorMessage(/Invalid share link|Group not found|expired/i);
        await expect(errorMessage).toBeVisible();

        // Should have a button to go back to dashboard using page object method
        const backButton = joinGroupPage.getBackToDashboardButton();
        await expect(backButton).toBeVisible();

        // Click the button to verify navigation works using page object method
        await backButton.click();
        await joinGroupPage.expectUrl(/\/dashboard/);
    });
});

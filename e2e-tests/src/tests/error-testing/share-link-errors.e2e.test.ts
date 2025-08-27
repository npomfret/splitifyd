import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { JoinGroupPage } from '../../pages';

setupMCPDebugOnFailure();

test.describe('Share Link Error Handling', () => {
    test('should handle invalid share links', { annotation: { type: 'skip-error-checking' } }, async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        const invalidShareLink = `${page.url().split('/dashboard')[0]}/join?linkId=invalid-group-id`;

        // Navigate to invalid share link using page object method
        await groupDetailPage.navigateToShareLink(invalidShareLink);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // The app now shows an error message for invalid links instead of 404
        await expect(joinGroupPage.getErrorMessage()).toBeVisible();

        // Should show specific error message using page object method
        const errorMessage = joinGroupPage.getSpecificErrorMessage(/Invalid share link|Group not found|expired/i);
        await expect(errorMessage).toBeVisible();

        // Should have a button to go back to dashboard using page object method
        const backButton = joinGroupPage.getBackToDashboardButton();
        await expect(backButton).toBeVisible();

        // Click the button to verify it works using page object method
        await backButton.click();
        await joinGroupPage.page.waitForURL(/\/dashboard/);
        await joinGroupPage.expectUrl(/\/dashboard/);
    });
});

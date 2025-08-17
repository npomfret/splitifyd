import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { JoinGroupPage } from '../../pages';

setupMCPDebugOnFailure();

test.describe('Share Link Error Handling', () => {
    test('should handle invalid share links', { annotation: { type: 'skip-error-checking' } }, async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const joinGroupPage = new JoinGroupPage(page);

        const invalidShareLink = `${page.url().split('/dashboard')[0]}/join?linkId=invalid-group-id`;

        await groupDetailPage.navigateToShareLink(invalidShareLink);
        await page.waitForLoadState('domcontentloaded');

        // The app now shows an error message for invalid links instead of 404
        await expect(joinGroupPage.getErrorMessage()).toBeVisible();

        // Should show an error message
        await expect(page.getByText(/Invalid share link|Group not found|expired/i)).toBeVisible();

        // Should have a button to go back to dashboard
        const backButton = page.getByRole('button', { name: /back to dashboard/i });
        await expect(backButton).toBeVisible();

        // Click the button to verify it works
        await backButton.click();
        await page.waitForURL(/\/dashboard/);
        await expect(page).toHaveURL(/\/dashboard/);
    });
});

import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Share Link Error Handling', () => {
  test('should handle invalid share links', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    
    const invalidShareLink = `${page.url().split('/dashboard')[0]}/join/invalid-group-id`;
    
    await groupDetailPage.navigateToShareLink(invalidShareLink);
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText(/404/)).toBeVisible();
    
    const goHomeLink = page.getByRole('link', { name: /go home/i });
    await expect(goHomeLink).toBeVisible();
  });
});
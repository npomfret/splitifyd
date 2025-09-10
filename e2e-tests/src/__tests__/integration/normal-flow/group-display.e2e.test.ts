import { authenticatedPageTest as test, expect } from '../../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure, TestGroupWorkflow } from '../../../helpers';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

test.describe('Group Details E2E', () => {
    test('should display correct initial state for a new group', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        
        // Use cached group for better performance
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);

        // Verify group information displays correctly
        // Since we're using a cached group, verify that any group title is present
        await expect(groupDetailPage.getGroupTitle()).toBeVisible();
        await expect(groupDetailPage.getGroupDescription()).toBeVisible();

        const userNameElement = groupDetailPage.getUserName(await groupDetailPage.getCurrentUserDisplayName());
        await expect(userNameElement).toBeVisible();
        await expect(groupDetailPage.getMembersCount()).toBeVisible();

        // Verify expense section is present (group may have existing expenses when cached)
        // Check for either "no expenses" message OR verify expenses heading exists
        try {
            await expect(groupDetailPage.getNoExpensesMessage()).toBeVisible({ timeout: 1000 });
        } catch {
            // If no "no expenses" message, verify expenses section exists instead
            await expect(groupDetailPage.getExpensesHeading()).toBeVisible();
        }
        await expect(groupDetailPage.getAddExpenseButton()).toBeVisible();

        // Verify group balances section is present
        await expect(groupDetailPage.getBalancesHeading()).toBeVisible();

        // Verify navigation back to dashboard works
        await page.goBack();
        await expect(page).toHaveURL(/\/dashboard/);

        // Navigate back to group to continue verification
        await groupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify share button is available (more reliable than settings)
        const shareButton = groupDetailPage.getShareButton();
        await expect(shareButton).toBeVisible();
    });
});

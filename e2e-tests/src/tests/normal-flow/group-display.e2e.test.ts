import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

setupMCPDebugOnFailure();

test.describe('Group Details E2E', () => {
    test('should display correct initial state for a new group', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupName = generateTestGroupName('Details');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Test group for details page');

        // Verify group information displays correctly
        // The group title is a specific heading with the group name, not the first heading
        await expect(groupDetailPage.getGroupTitleByName(groupName)).toBeVisible();
        await expect(groupDetailPage.getGroupDescription()).toBeVisible();

        const userNameElement = groupDetailPage.getUserName(user.displayName);
        await expect(userNameElement).toBeVisible();
        await expect(groupDetailPage.getMembersCount()).toBeVisible();

        // Verify empty expense list displays correctly
        await expect(groupDetailPage.getNoExpensesMessage()).toBeVisible();
        await expect(groupDetailPage.getAddExpenseButton()).toBeVisible();

        // Verify group balances section is present
        await expect(groupDetailPage.getBalancesHeading()).toBeVisible();

        // Verify navigation back to dashboard works
        await page.goBack();
        await expect(page).toHaveURL(/\/dashboard/);

        // Navigate back to group to continue verification
        await groupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(page).toHaveURL(`/groups/${groupId}`);

        // Verify share button is available (more reliable than settings)
        const shareButton = groupDetailPage.getShareButton();
        await expect(shareButton).toBeVisible();
    });
});

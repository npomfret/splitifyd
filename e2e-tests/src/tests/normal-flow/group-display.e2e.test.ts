import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { GroupWorkflow } from '../../workflows/index';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Group Details E2E', () => {
  test('should display correct initial state for a new group', async ({ authenticatedPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    const groupName = generateTestGroupName('Details');
    const groupId = await groupWorkflow.createGroup(groupName, 'Test group for details page');

    // Verify group information displays correctly
    await expect(groupDetailPage.getGroupTitle()).toContainText(groupName);
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
    await page.goto(`/groups/${groupId}`);
    await expect(page).toHaveURL(`/groups/${groupId}`);
    
    // Verify group settings or options are available
    const settingsElement = page.getByRole('button', { name: /settings/i });
    await expect(settingsElement).toBeVisible();
  });
});
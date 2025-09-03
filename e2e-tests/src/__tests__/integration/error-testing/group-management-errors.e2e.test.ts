import { authenticatedPageTest, expect } from '../../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';
import { DashboardPage } from '../../../pages/dashboard.page';
import { v4 as uuidv4 } from 'uuid';

// Enable debugging helpers
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('Group Management Error Testing', () => {
    authenticatedPageTest('should prevent deleting group with expenses', async ({ authenticatedPage, groupDetailPage }) => {
        // This test expects a 400 error when trying to delete a group with expenses
        authenticatedPageTest.info().annotations.push({
            type: 'skip-error-checking',
            description: 'Expected 400 error when deleting group with expenses',
        });
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);

        // Create a group
        const groupId = await groupWorkflow.createGroupAndNavigate('Group to Delete', 'Will have expenses');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Add an expense using proper page objects
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);
        await expenseFormPage.submitExpense({
            description: 'Test Expense',
            amount: 50,
            currency: 'USD',
            paidBy: authenticatedPage.user.displayName,
            splitType: 'equal',
        });

        // Wait for expense to appear
        await expect(groupDetailPage.getExpenseByDescription('Test Expense')).toBeVisible();

        // Open edit modal
        const editModal = await groupDetailPage.openEditGroupModal();

        // Click delete button
        await editModal.deleteGroup();

        // Confirm deletion in the confirmation dialog
        await groupDetailPage.handleDeleteConfirmDialog(true);

        // Wait for the API response and check that delete failed
        // The page should remain on the same group URL
        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`));

        // Close all dialogs by pressing Escape until none are visible
        await expect(async () => {
            const dialogs = await page.locator('.fixed.inset-0').count();
            if (dialogs > 0) {
                await page.keyboard.press('Escape');
                throw new Error(`${dialogs} dialog(s) still visible`);
            }
        }).toPass({ timeout: 5000, intervals: [100, 200, 500, 1000] });

        // Verify we're still on the group page
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
    });

    authenticatedPageTest('should successfully delete empty group', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);

        // Create a group with unique name (keep under 50 chars limit)
        const shortId = uuidv4().substring(0, 8);
        const groupName = `Group to Delete ${shortId}`;
        await groupWorkflow.createGroupAndNavigate(groupName, 'Will be deleted');

        // Open edit modal
        const editModal = await groupDetailPage.openEditGroupModal();

        // Click delete button
        await editModal.deleteGroup();

        // Confirm deletion
        await groupDetailPage.handleDeleteConfirmDialog(true);

        // Verify we're on the dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Wait for dashboard to load 
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // WORKAROUND: There's a race condition where real-time updates don't propagate
        // The group is deleted on backend but dashboard doesn't update in real-time
        // Refresh the page to get the correct state from the server
        await page.reload();
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Now verify the group is no longer present (should work after refresh)
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.waitForGroupToNotBePresent(groupName);
    });
});

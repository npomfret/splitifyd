import { authenticatedPageTest, expect } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { JoinGroupPage } from '../../pages';
import { RegisterPage } from '../../pages';
import { DashboardPage } from '../../pages';

// Enable debugging helpers
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('Group Management Error Testing', () => {
    authenticatedPageTest(
        'should prevent deleting group with expenses',
        async ({
            authenticatedPage,
            groupDetailPage,
        }) => {
            // This test expects a 400 error when trying to delete a group with expenses
            authenticatedPageTest.info().annotations.push({ 
                type: 'skip-error-checking', 
                description: 'Expected 400 error when deleting group with expenses' 
            });
            const { page } = authenticatedPage;
            const groupWorkflow = new GroupWorkflow(page);

            // Create a group
            const groupId = await groupWorkflow.createGroupAndNavigate('Group to Delete', 'Will have expenses');
            await page.waitForLoadState('domcontentloaded');

            // Add an expense using proper page objects
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);
            await expenseFormPage.submitExpense({
                description: 'Test Expense',
                amount: 50,
                currency: 'USD',
                paidBy: authenticatedPage.user.displayName,
                splitType: 'equal'
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
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`), { timeout: 5000 });
            
            // Close all dialogs by pressing Escape until none are visible
            await expect(async () => {
                const dialogs = await page.locator('.fixed.inset-0').count();
                if (dialogs > 0) {
                    await page.keyboard.press('Escape');
                    throw new Error(`${dialogs} dialog(s) still visible`);
                }
            }).toPass({ timeout: 5000, intervals: [100, 200, 500, 1000] });

            // Verify we're still on the group page
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`));
        },
    );

    authenticatedPageTest(
        'should successfully delete empty group',
        async ({
            authenticatedPage,
            groupDetailPage,
        }) => {
            // This test expects 404 errors after successfully deleting a group
            authenticatedPageTest.info().annotations.push({ 
                type: 'skip-error-checking', 
                description: 'Expected 404 errors after deleting a group' 
            });
            const { page } = authenticatedPage;
            const groupWorkflow = new GroupWorkflow(page);

            // Create a group
            await groupWorkflow.createGroupAndNavigate('Group to Delete', 'Will be deleted');
            await page.waitForLoadState('domcontentloaded');

            // Open edit modal
            const editModal = await groupDetailPage.openEditGroupModal();

            // Click delete button
            await editModal.deleteGroup();

            // Confirm deletion
            await groupDetailPage.handleDeleteConfirmDialog(true);

            // Wait for navigation to dashboard after successful deletion
            await page.waitForURL(/\/dashboard/, { timeout: 5000 });
            
            // Verify we're on the dashboard
            await expect(page).toHaveURL(/\/dashboard/);

            // Wait for dashboard to load
            await page.waitForLoadState('domcontentloaded');
            
            // NOTE: Real-time updates are not fully implemented yet (see docs/guides/end-to-end_testing.md:438)
            // We need to reload to see the group removed from the dashboard
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
            
            // Verify the group is no longer in the list
            const groupCard = page.getByText('Group to Delete');
            await expect(groupCard).not.toBeVisible();
        },
    );
});
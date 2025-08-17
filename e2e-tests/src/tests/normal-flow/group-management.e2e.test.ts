import { authenticatedPageTest, expect } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { JoinGroupPage } from '../../pages';
import { RegisterPage } from '../../pages';
import { DashboardPage } from '../../pages';

// Enable debugging helpers
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('Group Management', () => {
    authenticatedPageTest(
        'should allow group owner to edit group name',
        async ({
            authenticatedPage,
            groupDetailPage,
        }) => {
            const { page } = authenticatedPage;
            const groupWorkflow = new GroupWorkflow(page);

            // Verify starting state
            await expect(page).toHaveURL(/\/dashboard/);

            // Create a group
            await groupWorkflow.createGroupAndNavigate('Original Group Name', 'Original description');
            await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);

            // Wait for group page to load
            await page.waitForLoadState('domcontentloaded');

            // Verify settings button is visible for owner
            const settingsButton = groupDetailPage.getSettingsButton();
            await expect(settingsButton).toBeVisible();

            // Open edit modal
            const editModal = await groupDetailPage.openEditGroupModal();

            // Edit the group name and description
            await editModal.editGroupName('Updated Group Name');
            await editModal.editDescription('Updated description text');

            // Save changes (this will wait for modal to close)
            await editModal.saveChanges();
            
            // Wait for save to complete
            await page.waitForLoadState('domcontentloaded');
            
            // NOTE: Real-time updates are not fully implemented yet (see docs/guides/end-to-end_testing.md:438)
            // We need to reload to see the updated group name
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
            
            // Verify the group name was updated
            await expect(groupDetailPage.getGroupTitle()).toHaveText('Updated Group Name');
            await expect(groupDetailPage.getGroupDescription()).toBeVisible();
        },
    );

    authenticatedPageTest(
        'should validate group name when editing',
        async ({
            authenticatedPage,
            groupDetailPage,
        }) => {
            const { page } = authenticatedPage;
            const groupWorkflow = new GroupWorkflow(page);

            // Create a group
            await groupWorkflow.createGroupAndNavigate('Test Group', 'Test description');
            await page.waitForLoadState('domcontentloaded');
            // Wait for the page to fully settle
            await expect(groupDetailPage.getGroupTitle()).toBeVisible();

            // Open edit modal
            const editModal = await groupDetailPage.openEditGroupModal();

            // Try to save with empty name
            await editModal.clearGroupName();

            // Save button should be disabled with empty name
            await expect(editModal.saveButton).toBeVisible();
            await expect(editModal.saveButton).toBeDisabled();

            // Try with too short name
            await editModal.editGroupName('A');
            // Save button should be disabled with a single character
            await expect(editModal.saveButton).toBeDisabled();
            
            // Try with valid name
            await editModal.editGroupName('Valid Name');
            // Save button should be enabled now
            await expect(editModal.saveButton).toBeEnabled();
            
            // Clear again and check button is disabled
            await editModal.clearGroupName();
            await expect(editModal.saveButton).toBeDisabled();

            // Cancel the modal
            await editModal.cancel();
            await expect(editModal.modal).not.toBeVisible();
        },
    );

    authenticatedPageTest(
        'should disable save button when no changes made',
        async ({
            authenticatedPage,
            groupDetailPage,
        }) => {
            const { page } = authenticatedPage;
            const groupWorkflow = new GroupWorkflow(page);

            // Create a group
            const groupName = 'No Changes Group';
            const groupDescription = 'No changes description';
            await groupWorkflow.createGroupAndNavigate(groupName, groupDescription);
            await page.waitForLoadState('domcontentloaded');

            // Open edit modal
            const editModal = await groupDetailPage.openEditGroupModal();

            // Verify save button is disabled when no changes
            await expect(editModal.saveButton).toBeDisabled();

            // Make a change
            await editModal.editGroupName('Changed Name');

            // Now save button should be enabled
            await expect(editModal.saveButton).toBeEnabled();

            // Revert the change
            await editModal.editGroupName(groupName);

            // Save button should be disabled again
            await expect(editModal.saveButton).toBeDisabled();

            // Close modal
            await editModal.cancel();
        },
    );

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

    authenticatedPageTest(
        'should not show settings button for non-owner',
        async ({
            authenticatedPage,
            groupDetailPage,
        }) => {
            const { page } = authenticatedPage;
            const groupWorkflow = new GroupWorkflow(page);

            // Create a group with the first user as owner
            const groupName = 'Owner Only Settings';
            await groupWorkflow.createGroupAndNavigate(groupName, 'Only owner can edit');
            await page.waitForLoadState('domcontentloaded');

            // Get the share link (this method closes the modal automatically)
            const shareLink = await groupDetailPage.getShareLink();
            
            // Navigate to dashboard first before signing out
            await page.goto('/dashboard');
            await page.waitForLoadState('domcontentloaded');
            
            // Sign out current user
            const dashboard = new DashboardPage(page);
            await dashboard.signOut();
            
            // Wait for redirect to login page
            await expect(page).toHaveURL(/\/login/);

            // Create a new user
            const registerPage = new RegisterPage(page);
            await registerPage.navigate();
            
            const timestamp = Date.now();
            const newUserEmail = `nonowner${timestamp}@test.com`;
            await registerPage.register('Non Owner', newUserEmail, 'TestPass123!');

            // Wait for dashboard
            await expect(page).toHaveURL(/\/dashboard/);

            // Join the group via share link
            const joinGroupPage = new JoinGroupPage(page);
            await joinGroupPage.navigateToShareLink(shareLink);
            await joinGroupPage.joinGroup();
            
            // Should be on the group page now
            await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
            
            // Wait for page to fully load and ensure group detail is visible
            await page.waitForLoadState('domcontentloaded');
            await expect(groupDetailPage.getGroupTitle()).toBeVisible();

            // Verify settings button is NOT visible for non-owner
            const settingsButton = groupDetailPage.getSettingsButton();
            await expect(settingsButton).not.toBeVisible();

            // Verify the group name is still visible
            await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
        },
    );
});
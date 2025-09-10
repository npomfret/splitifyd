import { authenticatedPageTest, expect } from '../../../fixtures';
import { GroupWorkflow } from '../../../workflows';
import { JoinGroupPage } from '../../../pages';
import { RegisterPage } from '../../../pages';
import { DashboardPage } from '../../../pages';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

// Enable debugging helpers

authenticatedPageTest.describe('Group Management', () => {
    authenticatedPageTest('should allow group owner to edit group name', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);

        // Verify starting state
        await expect(page).toHaveURL(/\/dashboard/);

        // Create a group
        const groupId = await groupWorkflow.createGroupAndNavigate('Original Group Name', 'Original description');
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for group page to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

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

        // Wait for save to complete and real-time updates to propagate
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify the group name was updated (relying on real-time updates)
        await groupDetailPage.waitForGroupTitle('Updated Group Name');
        await groupDetailPage.waitForGroupDescription('Updated description text');
    });

    authenticatedPageTest('should validate group name when editing', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);

        // Create a group
        await groupWorkflow.createGroupAndNavigate('Test Group', 'Test description');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
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
        await editModal.editGroupName('some oterh Valid Name');
        // Save button should be enabled now
        await expect(editModal.saveButton).toBeEnabled();

        // Clear again and check button is disabled
        await editModal.clearGroupName();
        await expect(editModal.saveButton).toBeDisabled();

        // Cancel the modal
        await editModal.cancel();
        await expect(editModal.modal).not.toBeVisible();
    });

    authenticatedPageTest('should disable save button when no changes made', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);

        // Create a group
        const groupName = 'No Changes Group';
        const groupDescription = 'No changes description';
        await groupWorkflow.createGroupAndNavigate(groupName, groupDescription);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

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
    });

    authenticatedPageTest('should not show settings button for non-owner', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);

        // Create a group with the first user as owner
        const groupName = 'Owner Only Settings';
        await groupWorkflow.createGroupAndNavigate(groupName, 'Only owner can edit');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Get the share link (this method closes the modal automatically)
        const shareLink = await groupDetailPage.getShareLink();

        // Navigate to dashboard first before signing out
        await page.goto('/dashboard');
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Sign out current user
        const dashboard = new DashboardPage(page);
        await dashboard.logout();

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
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Should be on the group page now
        await expect(page).toHaveURL(groupDetailUrlPattern());

        // Wait for page to fully load and ensure group detail is visible
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await expect(groupDetailPage.getGroupTitle()).toBeVisible();

        // Verify settings button is NOT visible for non-owner
        const settingsButton = groupDetailPage.getSettingsButton();
        await expect(settingsButton).not.toBeVisible();

        // Verify the group name is still visible
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
    });
});

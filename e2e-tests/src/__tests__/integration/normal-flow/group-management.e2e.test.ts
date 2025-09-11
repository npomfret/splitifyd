import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { GroupDetailPage, JoinGroupPage } from '../../../pages';
import { GroupWorkflow } from '../../../workflows';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

simpleTest.describe('Group Management', () => {
    simpleTest('should allow group owner to edit group name', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
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

    simpleTest('should validate group name when editing', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
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

    simpleTest('should disable save button when no changes made', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
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

    simpleTest('should not show settings button for non-owner', async ({ newLoggedInBrowser }) => {
        // Create two browser sessions with pooled users
        const { page: ownerPage, user: owner } = await newLoggedInBrowser();
        const { page: memberPage, user: member } = await newLoggedInBrowser();
        
        const ownerGroupDetailPage = new GroupDetailPage(ownerPage, owner);
        const memberGroupDetailPage = new GroupDetailPage(memberPage, member);
        const groupWorkflow = new GroupWorkflow(ownerPage);

        // Owner creates a group
        const groupName = 'Owner Only Settings';
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Only owner can edit');
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Get the share link
        const shareLink = await ownerGroupDetailPage.getShareLink();

        // Member joins the group via share link
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify owner CAN see settings button
        const ownerSettingsButton = ownerGroupDetailPage.getSettingsButton();
        await expect(ownerSettingsButton).toBeVisible();

        // Verify member CANNOT see settings button
        const memberSettingsButton = memberGroupDetailPage.getSettingsButton();
        await expect(memberSettingsButton).not.toBeVisible();

        // Verify both can see the group name
        await expect(ownerGroupDetailPage.getGroupTitle()).toHaveText(groupName);
        await expect(memberGroupDetailPage.getGroupTitle()).toHaveText(groupName);
    });
});

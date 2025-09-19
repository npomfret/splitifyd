import { simpleTest, expect } from '../../fixtures';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { GroupDetailPage, JoinGroupPage } from '../../pages';
import { groupDetailUrlPattern } from '../../pages/group-detail.page';

simpleTest.describe('Group Management', () => {
    simpleTest('should comprehensively test group editing validation and functionality', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

        // Verify starting state
        await expect(page).toHaveURL(/\/dashboard/);

        // Create a group
        const originalGroupName = 'Original Group Name';
        const originalDescription = 'Original description';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(originalGroupName, originalDescription);
        const groupId = groupDetailPage.inferGroupId();
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for group page to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify settings button is visible for owner
        const settingsButton = groupDetailPage.getSettingsButton();
        await expect(settingsButton).toBeVisible();

        // === Test 1: Basic editing functionality ===
        let editModal = await groupDetailPage.openEditGroupModal();

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

        // === Test 2: Validation scenarios ===
        editModal = await groupDetailPage.openEditGroupModal();

        // Try to save with empty name
        await editModal.clearGroupName();
        await expect(editModal.getSaveButton()).toBeVisible();
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Try with too short name
        await editModal.editGroupName('A');
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Try with valid name
        await editModal.editGroupName('Valid Name');
        await expect(editModal.getSaveButton()).toBeEnabled();

        // Clear again and check button is disabled
        await editModal.clearGroupName();
        await expect(editModal.getSaveButton()).toBeDisabled();

        // === Test 3: No changes detection ===
        // Reset to original values
        await editModal.editGroupName('Updated Group Name');
        await editModal.editDescription('Updated description text');

        // Save button should be disabled when no changes from current state
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Make a change
        await editModal.editGroupName('Changed Name');
        await expect(editModal.getSaveButton()).toBeEnabled();

        // Revert the change
        await editModal.editGroupName('Updated Group Name');
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Cancel the modal
        await editModal.cancel();
        await expect(editModal.getModal()).not.toBeVisible();
    });

    simpleTest('should not show settings button for non-owner', async ({ createLoggedInBrowsers }) => {
        // Create two browser sessions with pooled users
        const [{ page: ownerPage, dashboardPage },  { page: memberPage }] = await createLoggedInBrowsers(2);

        const ownerGroupDetailPage = new GroupDetailPage(ownerPage);
        const memberGroupDetailPage = new GroupDetailPage(memberPage);

        // Owner creates a group
        const groupName = 'Owner Only Settings';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Only owner can edit');
        const groupId = groupDetailPage.inferGroupId();

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
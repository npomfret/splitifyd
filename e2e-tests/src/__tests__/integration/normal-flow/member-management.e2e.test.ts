import { expect, multiUserTest } from '../../../fixtures/multi-user-test';
import { authenticatedPageTest } from '../../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import { JoinGroupPage } from '../../../pages';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

// Enable debugging helpers
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('Member Management - Owner Restrictions', () => {
    authenticatedPageTest('group owner should not see leave button and should see settings', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);

        // Create a group as owner
        const groupName = generateTestGroupName('Owner Test');
        await groupWorkflow.createGroupAndNavigate(groupName, 'Testing owner restrictions');

        // Wait for group to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);

        // Verify Leave Group button is NOT visible for owner
        await expect(groupDetailPage.getLeaveGroupButton()).not.toBeVisible();

        // But Settings button should be visible
        await expect(groupDetailPage.getSettingsButton()).toBeVisible();
    });
});

multiUserTest.describe('Member Management - Multi-User Operations', () => {
    multiUserTest('non-owner member should be able to leave group', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: ownerPage, dashboardPage: user1DashboardPage } = authenticatedPage;
        const { page: memberPage, dashboardPage: user2DashboardPage } = secondUser;
        const memberGroupDetailPage = secondUser.groupDetailPage;

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();
        
        // Owner creates group
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupName = generateTestGroupName('Leave Test');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing member leave functionality');

        // Get share link
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
        const shareLink = await groupDetailPage.getShareLink();

        // Member joins the group
        const joinGroupPage = new JoinGroupPage(memberPage);
        await memberPage.goto(shareLink);
        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();
        await joinGroupPage.getJoinGroupButton().click();
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for both users to see each other in the member list
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Verify member sees Leave Group button
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();

        // Member clicks Leave Group
        await memberGroupDetailPage.clickLeaveGroup();

        // Confirm in the dialog
        await memberGroupDetailPage.confirmLeaveGroup();

        // Member should be redirected to dashboard
        await expect(memberPage).toHaveURL(/\/dashboard/);

        // Owner should see updated member count (only 1 member now)
        await groupDetailPage.waitForMemberCount(1);

        // Verify the member who left is no longer in the list
        await groupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    multiUserTest('group owner should be able to remove a member', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: ownerPage, dashboardPage: user1DashboardPage } = authenticatedPage;
        const { page: memberPage, dashboardPage: user2DashboardPage } = secondUser;

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        const memberGroupDetailPage = secondUser.groupDetailPage;

        // Owner creates group
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupName = generateTestGroupName('Remove Test');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing member removal');

        // Get share link
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
        const shareLink = await groupDetailPage.getShareLink();

        // Member joins the group
        const joinGroupPage = new JoinGroupPage(memberPage);
        await memberPage.goto(shareLink);
        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();
        await joinGroupPage.getJoinGroupButton().click();
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Owner removes the member
        await groupDetailPage.clickRemoveMember(memberDisplayName);

        // Confirm removal in dialog
        await groupDetailPage.confirmRemoveMember();

        // Wait a moment for the removal to be processed and real-time updates to propagate
        // Member should see 404 because they no longer have access to the group
        // Note: Permission checks happen on page load, so we may need to refresh
        await expect(async () => {
            const currentUrl = memberPage.url();

            // Check if we're already on the 404 page
            if (currentUrl.includes('/404')) {
                return;
            }

            // If still on group page, refresh to trigger permission check
            if (currentUrl.includes('/groups/')) {
                await memberPage.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });

                const newUrl = memberPage.url();
                if (newUrl.includes('/404')) {
                    return;
                }
            }

            throw new Error(`Expected 404 page, but got: ${currentUrl}`);
        }).toPass({ timeout: 10000, intervals: [1000] });

        // Owner should see updated member list
        await groupDetailPage.waitForMemberCount(1);

        // Verify the removed member is no longer visible
        await groupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    multiUserTest('should prevent leaving group with outstanding balance', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: ownerPage, dashboardPage: user1DashboardPage } = authenticatedPage;
        const { page: memberPage, dashboardPage: user2DashboardPage } = secondUser;

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        const memberGroupDetailPage = secondUser.groupDetailPage;

        // Owner creates group
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupName = generateTestGroupName('Balance Test');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing balance restrictions');

        // Get share link and have member join
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(memberPage);
        await memberPage.goto(shareLink);
        await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();
        await joinGroupPage.getJoinGroupButton().click();
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Owner adds an expense that creates a balance
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Test expense for balance',
            amount: 100,
            currency: 'USD',
            paidBy: ownerDisplayName,
            splitType: 'equal',
        });

        // Wait for expense to be processed and balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Member tries to leave group
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        await memberGroupDetailPage.clickLeaveGroup();

        // Should see error message about outstanding balance
        await memberGroupDetailPage.verifyLeaveErrorMessage();

        // Cancel the leave attempt
        await memberGroupDetailPage.cancelLeaveGroup();

        // Member records a settlement to clear the balance
        const settlementFormPage = await memberGroupDetailPage.clickSettleUpButton(2);

        // Fill and submit settlement for the full owed amount (50 in this case)
        await settlementFormPage.fillAndSubmitSettlement('50', ownerDisplayName);

        // Wait for settlement to process and balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Now member should be able to leave
        await memberGroupDetailPage.clickLeaveGroup();
        await memberGroupDetailPage.confirmLeaveGroup();

        // Member should be redirected to dashboard
        await expect(memberPage).toHaveURL(/\/dashboard/);
    });

    multiUserTest('should prevent owner from removing member with outstanding balance', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: ownerPage, dashboardPage: user1DashboardPage } = authenticatedPage;
        const { page: memberPage, dashboardPage: user2DashboardPage } = secondUser;

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        const memberGroupDetailPage = secondUser.groupDetailPage;

        // Owner creates group
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupName = generateTestGroupName('Remove Balance');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing removal with balance');

        // Member joins
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(memberPage);
        await memberPage.goto(shareLink);
        await joinGroupPage.getJoinGroupButton().click();
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Member adds expense creating a balance
        const expenseFormPage = await memberGroupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Member expense',
            amount: 60,
            currency: 'USD',
            paidBy: memberDisplayName,
            splitType: 'equal',
        });

        // Wait for balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Owner tries to remove member - button should be disabled
        const removeButton = groupDetailPage.getRemoveMemberButton(memberDisplayName);
        await expect(removeButton).toBeDisabled({ timeout: 5000 });
    });

    multiUserTest('should handle edge case of removing last non-owner member', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: ownerPage, dashboardPage: user1DashboardPage } = authenticatedPage;
        const { page: memberPage, dashboardPage: user2DashboardPage } = secondUser;

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupName = generateTestGroupName('Last Member');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing last member removal');

        // Member joins
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(memberPage);
        await memberPage.goto(shareLink);
        await joinGroupPage.getJoinGroupButton().click();
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Owner removes the only other member
        await groupDetailPage.clickRemoveMember(memberDisplayName);
        await groupDetailPage.confirmRemoveMember();

        // Owner should still be in the group
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Group should show only 1 member (the owner)
        await groupDetailPage.waitForMemberCount(1);

        // Group title should still be visible
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
    });
});

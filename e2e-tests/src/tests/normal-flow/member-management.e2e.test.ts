import { expect, multiUserTest } from '../../fixtures/multi-user-test';
import { authenticatedPageTest } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { JoinGroupPage } from '../../pages';
import { generateTestGroupName } from '../../utils/test-helpers';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';

// Enable debugging helpers
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('Member Management - Owner Restrictions', () => {
    authenticatedPageTest(
        'group owner should not see leave button and should see settings',
        async ({ authenticatedPage, groupDetailPage }) => {
            const { page } = authenticatedPage;
            const groupWorkflow = new GroupWorkflow(page);

            // Create a group as owner
            const groupName = generateTestGroupName('Owner Test');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing owner restrictions');
            
            // Wait for group to load
            await page.waitForLoadState('domcontentloaded');
            await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);

            // Verify Leave Group button is NOT visible for owner
            await expect(groupDetailPage.getLeaveGroupButton()).not.toBeVisible();

            // But Settings button should be visible
            await expect(groupDetailPage.getSettingsButton()).toBeVisible();
        },
    );
});

multiUserTest.describe('Member Management - Multi-User Operations', () => {
    multiUserTest(
        'non-owner member should be able to leave group',
        async ({ authenticatedPage, groupDetailPage, secondUser }) => {
            const { page: ownerPage, user: owner } = authenticatedPage;
            const { page: memberPage, user: member } = secondUser;
            const memberGroupDetailPage = secondUser.groupDetailPage;
            
            // Owner creates group
            const groupWorkflow = new GroupWorkflow(ownerPage);
            const groupName = generateTestGroupName('Leave Test');
            const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing member leave functionality');
            
            // Get share link
            await expect(ownerPage).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
            const shareLink = await groupDetailPage.getShareLink();
            
            // Member joins the group
            const joinGroupPage = new JoinGroupPage(memberPage);
            await memberPage.goto(shareLink);
            await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();
            await joinGroupPage.getJoinGroupButton().click();
            await memberPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
            
            // Wait for both users to see each other in the member list
            await groupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            await memberGroupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            
            // Verify member sees Leave Group button
            await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
            
            // Member clicks Leave Group
            await memberGroupDetailPage.clickLeaveGroup();
            
            // Confirm in the dialog
            await memberGroupDetailPage.confirmLeaveGroup();
            
            // Member should be redirected to dashboard
            await memberPage.waitForURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
            
            // Owner should see updated member count (only 1 member now)
            await groupDetailPage.waitForMemberCount(1);
            
            // Verify the member who left is no longer in the list
            await groupDetailPage.verifyMemberNotVisible(member.displayName);
        },
    );

    multiUserTest(
        'group owner should be able to remove a member',
        async ({ authenticatedPage, groupDetailPage, secondUser }) => {
            const { page: ownerPage, user: owner } = authenticatedPage;
            const { page: memberPage, user: member } = secondUser;
            const memberGroupDetailPage = secondUser.groupDetailPage;
            
            // Owner creates group
            const groupWorkflow = new GroupWorkflow(ownerPage);
            const groupName = generateTestGroupName('Remove Test');
            const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing member removal');
            
            // Get share link
            await expect(ownerPage).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
            const shareLink = await groupDetailPage.getShareLink();
            
            // Member joins the group
            const joinGroupPage = new JoinGroupPage(memberPage);
            await memberPage.goto(shareLink);
            await expect(joinGroupPage.getJoinGroupHeading()).toBeVisible();
            await joinGroupPage.getJoinGroupButton().click();
            await memberPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
            
            // Wait for synchronization
            await groupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            await memberGroupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            
            // Owner removes the member
            await groupDetailPage.clickRemoveMember(member.displayName);
            
            // Confirm removal in dialog
            await groupDetailPage.confirmRemoveMember();
            
            // Wait a moment for the removal to be processed and real-time updates to propagate
            // Member should see 404 because they no longer have access to the group
            await expect(async () => {
                const currentUrl = memberPage.url();
                if (!currentUrl.includes('/404')) {
                    throw new Error(`Expected 404 page, but got: ${currentUrl}`);
                }
            }).toPass({ timeout: 10000, intervals: [1000] });
            
            // Owner should see updated member list
            await groupDetailPage.waitForMemberCount(1);
            
            // Verify the removed member is no longer visible
            await groupDetailPage.verifyMemberNotVisible(member.displayName);
        },
    );

    multiUserTest(
        'should prevent leaving group with outstanding balance',
        async ({ authenticatedPage, groupDetailPage, secondUser }) => {
            const { page: ownerPage, user: owner } = authenticatedPage;
            const { page: memberPage, user: member } = secondUser;
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
            await memberPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
            
            // Wait for synchronization
            await groupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            await memberGroupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            
            // Owner adds an expense that creates a balance
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
            await expenseFormPage.submitExpense({
                description: 'Test expense for balance',
                amount: 100,
                currency: 'USD',
                paidBy: owner.displayName,
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
            await settlementFormPage.fillAndSubmitSettlement('50', owner.displayName);
            
            // Wait for settlement to process and balances to update
            await groupDetailPage.waitForBalancesToLoad(groupId);
            await memberGroupDetailPage.waitForBalancesToLoad(groupId);
            
            // Now member should be able to leave
            await memberGroupDetailPage.clickLeaveGroup();
            await memberGroupDetailPage.confirmLeaveGroup();
            
            // Member should be redirected to dashboard
            await memberPage.waitForURL(/\/dashboard/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
        },
    );

    multiUserTest(
        'should prevent owner from removing member with outstanding balance',
        async ({ authenticatedPage, groupDetailPage, secondUser }) => {
            const { page: ownerPage, user: owner } = authenticatedPage;
            const { page: memberPage, user: member } = secondUser;
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
            await memberPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
            
            // Wait for synchronization
            await groupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            await memberGroupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            
            // Member adds expense creating a balance
            const expenseFormPage = await memberGroupDetailPage.clickAddExpenseButton(2);
            await expenseFormPage.submitExpense({
                description: 'Member expense',
                amount: 60,
                currency: 'USD',
                paidBy: member.displayName,
                splitType: 'equal',
            });
            
            // Wait for balances to update
            await groupDetailPage.waitForBalancesToLoad(groupId);
            await memberGroupDetailPage.waitForBalancesToLoad(groupId);
            
            // Owner tries to remove member - button should be disabled
            const removeButton = groupDetailPage.getRemoveMemberButton(member.displayName);
            await expect(removeButton).toBeDisabled({ timeout: 5000 });
        },
    );

    multiUserTest(
        'should handle edge case of removing last non-owner member',
        async ({ authenticatedPage, groupDetailPage, secondUser }) => {
            const { page: ownerPage, user: owner } = authenticatedPage;
            const { page: memberPage, user: member } = secondUser;
            
            // Owner creates group
            const groupWorkflow = new GroupWorkflow(ownerPage);
            const groupName = generateTestGroupName('Last Member');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing last member removal');
            
            // Member joins
            const shareLink = await groupDetailPage.getShareLink();
            const joinGroupPage = new JoinGroupPage(memberPage);
            await memberPage.goto(shareLink);
            await joinGroupPage.getJoinGroupButton().click();
            await memberPage.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
            
            // Wait for synchronization  
            await groupDetailPage.waitForUserSynchronization(owner.displayName, member.displayName);
            
            // Owner removes the only other member
            await groupDetailPage.clickRemoveMember(member.displayName);
            await groupDetailPage.confirmRemoveMember();
            
            // Owner should still be in the group
            await expect(ownerPage).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
            
            // Group should show only 1 member (the owner)
            await groupDetailPage.waitForMemberCount(1);
            
            // Group title should still be visible
            await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
        },
    );
});
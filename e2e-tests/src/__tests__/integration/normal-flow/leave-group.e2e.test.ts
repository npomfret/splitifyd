import { expect, multiUserTest as test } from '../../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import { JoinGroupPage } from '../../../pages';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';
import { ExpenseBuilder } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

// Enable error reporting and debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

// Increase timeout for multi-user operations
test.setTimeout(30000);

test.describe('Leave Group E2E', () => {
    test('user should be able to leave group and no longer access it', async ({ 
        authenticatedPage, 
        groupDetailPage, 
        secondUser 
    }) => {
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = authenticatedPage;
        const { page: memberPage, groupDetailPage: memberGroupDetailPage, dashboardPage: memberDashboardPage, user: member } = secondUser;

        // Verify users are distinct
        expect(owner.email).not.toBe(member.email);

        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();
        expect(ownerDisplayName).not.toBe(memberDisplayName);

        // =============================================================
        // SETUP PHASE: Create group and add member
        // =============================================================
        
        const groupName = generateTestGroupName('LeaveTest');
        const groupDescription = 'Testing leave group functionality';
        
        // Owner creates group
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, groupDescription);
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Get share link for member to join
        const shareLink = await groupDetailPage.getShareLink();

        // Member joins the group
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify both users can see the group
        await groupDetailPage.synchronizeMultiUserState([
            { page: ownerPage, groupDetailPage },
            { page: memberPage, groupDetailPage: memberGroupDetailPage },
        ], 2, groupId);

        // =============================================================
        // VERIFY INITIAL STATE: Group appears on member's dashboard
        // =============================================================
        
        // Member navigates to dashboard to verify group is visible
        await memberDashboardPage.navigate();
        await expect(memberPage).toHaveURL(/\/dashboard/);
        
        // Verify member can see the group on their dashboard
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // =============================================================
        // LEAVE GROUP ACTION: Member leaves the group
        // =============================================================
        
        // Member navigates back to the group
        await memberPage.goto(`/groups/${groupId}`);
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));
        
        // Member leaves the group
        await memberGroupDetailPage.leaveGroup();
        
        // Verify member gets redirected to dashboard after leaving
        await expect(memberPage).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // =============================================================
        // VERIFY DASHBOARD REMOVAL: Group no longer on dashboard
        // =============================================================
        
        // Verify the group is no longer visible on member's dashboard
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);

        // =============================================================
        // VERIFY ACCESS DENIED: Direct URL access should fail
        // =============================================================
        
        // Member tries to access the group URL directly
        await memberPage.goto(`/groups/${groupId}`);
        
        // Should be redirected to 404 or error page since they're no longer a member
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // =============================================================
        // VERIFY OWNER STATE: Owner still has access and sees updated member count
        // =============================================================
        
        // Owner should still be able to access the group and see updated member count
        await ownerPage.goto(`/groups/${groupId}`);
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
        
        // Wait for member count to update (should now be 1 - just the owner)
        await groupDetailPage.waitForMemberCount(1);
        
        // Verify owner can still see group details
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
        await expect(groupDetailPage.getGroupDescription()).toHaveText(groupDescription);

    });
    
    test('user with outstanding balance cannot leave group until settled', async ({ 
        authenticatedPage, 
        groupDetailPage, 
        secondUser 
    }) => {
        const { page: ownerPage, user: owner } = authenticatedPage;
        const { page: memberPage, groupDetailPage: memberGroupDetailPage, user: member } = secondUser;

        // Create group and add member
        const groupName = generateTestGroupName('BalanceLeaveTest');
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing leave with balance');

        // Add member to group
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(memberPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Create an expense where owner paid and member owes money (member should be blocked from leaving)
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense(new ExpenseBuilder()
            .withDescription('Test expense for balance validation')
            .withAmount(60)
            .withCurrency('USD')
            .withPaidBy(owner.uid)
            .withSplitType('equal')
            .withParticipants([owner.uid, member.uid])
            .build());

        // Wait for balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Member tries to leave group but should be blocked due to outstanding balance
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        await memberGroupDetailPage.clickLeaveGroup();
        
        // Click confirm button - but leave action should fail due to validation
        await memberGroupDetailPage.confirmLeaveGroup();
        
        // User should stay on the group page (validation working)
        await expect(memberPage).toHaveURL(/\/groups\//, { timeout: 5000 });
        
        // Verify member is still in the group (leave was blocked)
        await ownerPage.goto(`/groups/${groupId}`);
        await groupDetailPage.waitForMemberCount(2);
    });
});
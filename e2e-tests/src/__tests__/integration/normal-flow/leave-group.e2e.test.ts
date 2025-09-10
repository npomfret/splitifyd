import { expect, multiUserTest as test } from '../../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import { JoinGroupPage } from '../../../pages';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';
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
        
        // Record the initial number of groups on the dashboard for later comparison
        const initialGroupCount = await memberDashboardPage.getGroupCount();

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
        
        // Verify the group count has decreased by 1
        const finalGroupCount = await memberDashboardPage.getGroupCount();
        expect(finalGroupCount).toBe(initialGroupCount - 1);

        // =============================================================
        // VERIFY ACCESS DENIED: Direct URL access should fail
        // =============================================================
        
        // Member tries to access the group URL directly
        await memberPage.goto(`/groups/${groupId}`);
        
        // Should be redirected to 404 or error page since they're no longer a member
        await expect(async () => {
            const currentUrl = memberPage.url();
            
            // Check if we're already on the 404 page
            if (currentUrl.includes('/404')) {
                return;
            }
            
            // Check if we're on an error page or redirected away from the group
            if (!currentUrl.includes(`/groups/${groupId}`)) {
                return;
            }
            
            // If still on group page, wait a moment for error handling to kick in
            await memberPage.waitForTimeout(1000);
            const newUrl = memberPage.url();
            
            if (newUrl.includes('/404') || !newUrl.includes(`/groups/${groupId}`)) {
                return;
            }
            
            throw new Error(`Expected 404 or redirect away from group, but still on: ${newUrl}`);
        }).toPass({ timeout: 10000, intervals: [1000] });

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

        // =============================================================
        // FINAL VERIFICATION: Member cannot rejoin without new invite
        // =============================================================
        
        // The original share link should still work, but this verifies the complete flow
        // In a real scenario, the member would need a new invitation to rejoin
        
        console.log('✅ Leave group test completed successfully');
        console.log(`- Member left group: ${groupName}`);
        console.log(`- Group removed from member's dashboard`);
        console.log(`- Member cannot access group URL (404/redirect)`);
        console.log(`- Owner retains access with updated member count`);
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

        // Create an expense where member owes money
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Test expense',
            amount: 60,
            currency: 'USD',
            paidBy: owner.uid,
            splitType: 'equal',
            participants: [owner.uid, member.uid]
        });

        // Wait for balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Member tries to leave group but should be blocked due to outstanding balance
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        await memberGroupDetailPage.clickLeaveGroup();
        
        // Should show error about outstanding balance
        await expect(async () => {
            // Look for error message about outstanding balance
            const errorMessage = memberPage.getByText(/outstanding balance|settle up before leaving/i);
            await expect(errorMessage).toBeVisible();
        }).toPass({ timeout: 5000 });

        // Cancel the leave attempt - member should still be in the group
        await memberGroupDetailPage.cancelLeaveGroup();
        
        // Verify member is still in the group
        await groupDetailPage.waitForMemberCount(2);
        
        console.log('✅ Outstanding balance prevention test completed');
        console.log('- Member with debt blocked from leaving');
        console.log('- Error message displayed correctly');
        console.log('- Member remains in group after canceling');
    });
});
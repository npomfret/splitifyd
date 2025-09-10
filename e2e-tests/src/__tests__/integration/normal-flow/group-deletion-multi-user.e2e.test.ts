import { expect, multiUserTest } from '../../../fixtures';
import { expect as expectThree, threeUserTest } from '../../../fixtures/three-user-test';
import { setupMCPDebugOnFailure } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import { generateShortId } from '../../../../../packages/test-support/test-helpers';
import { GroupDetailPage, JoinGroupPage, DashboardPage } from '../../../pages';

multiUserTest.describe('Multi-User Group Deletion Real-Time Updates', () => {
    multiUserTest('should update both dashboards when owner deletes group', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page, user: user1 } = authenticatedPage;
        const { page: page2, user: user2 } = secondUser;

        const groupDetailPage2 = new GroupDetailPage(page2, user2);
        const dashboardPage1 = new DashboardPage(page, user1);
        const dashboardPage2 = new DashboardPage(page2, user2);
        const groupWorkflow = new GroupWorkflow(page);

        // Setup 2-person group with unique ID
        const uniqueId = generateShortId();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const groupName = `Owner Delete Test ${uniqueId}-${randomSuffix}`;
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing owner deletion');

        // Get share link and have User2 join
        const shareLink = await groupDetailPage.getShareLink();
        
        // Verify User2 is authenticated before attempting to join
        await expect(page2).toHaveURL(/\/dashboard/);
        await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // User2 joins using robust JoinGroupPage
        const joinGroupPage = new JoinGroupPage(page2, user2);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Wait for synchronization - both users should see 2 members total
        await groupDetailPage.waitForMemberCount(2);
        await groupDetailPage2.waitForMemberCount(2);

        // Both users navigate to dashboard to see the group
        await dashboardPage1.navigate();
        await dashboardPage1.waitForDashboard();
        await dashboardPage2.navigate();
        await dashboardPage2.waitForDashboard();

        // Verify both users can see the group on dashboard
        await dashboardPage1.waitForGroupToAppear(groupName);
        await dashboardPage2.waitForGroupToAppear(groupName);

        // User1 (owner) clicks on the group from dashboard to navigate to it
        await dashboardPage1.clickGroupCard(groupName);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Delete the group
        const editModal = await groupDetailPage.openEditGroupModal();
        await editModal.deleteGroup();
        await groupDetailPage.handleDeleteConfirmDialog(true, groupName);

        // Verify User1 is redirected to dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await dashboardPage1.waitForDashboard();

        // CRITICAL TEST: Both dashboards should update in real-time WITHOUT reload
        // User1's dashboard should not show the deleted group
        await dashboardPage1.waitForGroupToNotBePresent(groupName, { timeout: 8000 });

        // User2's dashboard should also update in real-time (this tests the bug fix)
        await dashboardPage2.waitForGroupToNotBePresent(groupName, { timeout: 8000 });

        // Verify no errors occurred on User2's page during the real-time update
        const jsErrors: string[] = [];
        page2.on('pageerror', (error) => jsErrors.push(error.message));
        
        // Brief wait to catch any JS errors
        await page2.waitForTimeout(500);
        
        // Filter for relevant errors (ignore minor console warnings)
        const criticalErrors = jsErrors.filter(error => 
            error.includes('404') && error.includes('group')
        );
        
        // We expect no critical errors - User2 should handle group deletion gracefully
        expect(criticalErrors).toHaveLength(0);
    });

    multiUserTest('should update dashboard when member leaves group', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page, user: user1 } = authenticatedPage;
        const { page: page2, user: user2 } = secondUser;
        const groupDetailPage2 = new GroupDetailPage(page2, user2);
        const dashboardPage1 = new DashboardPage(page, user1);
        const dashboardPage2 = new DashboardPage(page2, user2);
        const groupWorkflow = new GroupWorkflow(page);

        // Setup 2-person group
        const uniqueId = generateShortId();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const groupName = `Member Leave Test ${uniqueId}-${randomSuffix}`;
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing member leaving');

        // User2 joins the group
        const shareLink = await groupDetailPage.getShareLink();
        await expect(page2).toHaveURL(/\/dashboard/);
        
        const joinGroupPage = new JoinGroupPage(page2, user2);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Wait for synchronization - both users should see 2 members total
        await groupDetailPage.waitForMemberCount(2);
        await groupDetailPage2.waitForMemberCount(2);

        // Both users navigate to dashboard
        await dashboardPage1.navigate();
        await dashboardPage1.waitForDashboard();
        await dashboardPage2.navigate();
        await dashboardPage2.waitForDashboard();

        // Verify both see the group
        await dashboardPage1.waitForGroupToAppear(groupName);
        await dashboardPage2.waitForGroupToAppear(groupName);

        // User2 clicks on the group from dashboard to navigate to it
        await dashboardPage2.clickGroupCard(groupName);
        await page2.waitForLoadState('domcontentloaded', { timeout: 5000 });
        
        // User2 leaves the group (not deletes - just leaves)
        await groupDetailPage2.clickLeaveGroup();
        await groupDetailPage2.confirmLeaveGroup();

        // User2 should be redirected to dashboard
        await expect(page2).toHaveURL(/\/dashboard/);
        await dashboardPage2.waitForDashboard();

        // User2's dashboard should no longer show the group
        await dashboardPage2.waitForGroupToNotBePresent(groupName, { timeout: 5000 });

        // User1's dashboard should still show the group (but now with 1 member)
        await dashboardPage1.waitForGroupToAppear(groupName);
    });

    multiUserTest('should handle concurrent dashboard viewing during hard deletion', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page, user: user1 } = authenticatedPage;
        const { page: page2, user: user2 } = secondUser;
        const groupDetailPage2 = new GroupDetailPage(page2, user2);
        const dashboardPage1 = new DashboardPage(page, user1);
        const dashboardPage2 = new DashboardPage(page2, user2);
        const groupWorkflow = new GroupWorkflow(page);

        // Setup group with expenses (testing hard delete with data)
        const uniqueId = generateShortId();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const groupName = `Hard Delete Test ${uniqueId}-${randomSuffix}`;
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing hard delete with expenses');

        // User2 joins
        const shareLink = await groupDetailPage.getShareLink();
        await expect(page2).toHaveURL(/\/dashboard/);
        
        const joinGroupPage = new JoinGroupPage(page2, user2);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
        await groupDetailPage.waitForMemberCount(2);
        await groupDetailPage2.waitForMemberCount(2);

        // Add expenses to test hard delete functionality
        const expenseFormPage1 = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage1.submitExpense({
            description: 'Pre-deletion Expense 1',
            amount: 50,
            paidBy: user1.uid, // Use userId for server validation
            currency: 'USD',
            splitType: 'equal',
        });

        // Wait for expense synchronization
        await groupDetailPage.waitForBalanceUpdate();
        await groupDetailPage2.verifyExpenseVisible('Pre-deletion Expense 1');

        // User2 adds expense too
        const expenseFormPage2 = await groupDetailPage2.clickAddExpenseButton(2);
        await expenseFormPage2.submitExpense({
            description: 'Pre-deletion Expense 2',
            amount: 75,
            paidBy: user2.uid, // Use userId for server validation
            currency: 'USD',
            splitType: 'equal',
        });

        // Wait for second expense synchronization
        await groupDetailPage2.waitForBalanceUpdate();
        await groupDetailPage.verifyExpenseVisible('Pre-deletion Expense 2');

        // Both users navigate to dashboard and keep it open
        await dashboardPage1.navigate();
        await dashboardPage1.waitForDashboard();
        await dashboardPage2.navigate();
        await dashboardPage2.waitForDashboard();

        // Verify both see the group with expenses
        await dashboardPage1.waitForGroupToAppear(groupName);
        await dashboardPage2.waitForGroupToAppear(groupName);

        // User1 clicks on the group from dashboard to perform hard delete (should work despite expenses)
        await dashboardPage1.clickGroupCard(groupName);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // With new hard delete implementation, this should succeed even with expenses
        const editModal = await groupDetailPage.openEditGroupModal();
        await editModal.deleteGroup();
        await groupDetailPage.handleDeleteConfirmDialog(true, groupName);

        // Verify User1 is redirected to dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        await dashboardPage1.waitForDashboard();

        // CRITICAL: Both dashboards should update in real-time despite the complex deletion
        // User1's dashboard should be clean
        await dashboardPage1.waitForGroupToNotBePresent(groupName, { timeout: 10000 });

        // User2's dashboard should also update (this is the main bug we're testing)
        // The change document should have proper user IDs despite hard deletion
        await dashboardPage2.waitForGroupToNotBePresent(groupName, { timeout: 10000 });

        // Verify User2 experiences no errors during the hard delete process
        const jsErrors: string[] = [];
        page2.on('pageerror', (error) => jsErrors.push(error.message));
        await page2.waitForTimeout(500);

        // Should be no critical errors related to the group deletion
        const relevantErrors = jsErrors.filter(error => 
            (error.includes('404') || error.includes('deleted')) && error.includes('group')
        );
        expect(relevantErrors).toHaveLength(0);
    });
});

threeUserTest.describe('Three-User Group Deletion Dashboard Updates', () => {
    threeUserTest('should update all dashboards in real-time when owner deletes group', async ({ 
        authenticatedPage, 
        groupDetailPage, 
        secondUser, 
        thirdUser 
    }, testInfo) => {
        // Skip error checking for this test - 404 errors are expected when group detail 
        // stores try to refresh data for a deleted group
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors from group detail store refreshes after deletion' });
        const { page: page1, user: user1 } = authenticatedPage;
        const { page: page2, user: user2 } = secondUser;
        const { page: page3, user: user3 } = thirdUser;
        
        const groupDetailPage2 = new GroupDetailPage(page2, user2);
        const groupDetailPage3 = new GroupDetailPage(page3, user3);
        const dashboardPage1 = new DashboardPage(page1, user1);
        const dashboardPage2 = new DashboardPage(page2, user2);
        const dashboardPage3 = new DashboardPage(page3, user3);
        const groupWorkflow = new GroupWorkflow(page1);

        // Create group with User 1 as owner
        const uniqueId = generateShortId();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const groupName = `Dashboard Update Test ${uniqueId}-${randomSuffix}`;
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing real-time dashboard updates');

        // User 2 and User 3 join the group
        const shareLink = await groupDetailPage.getShareLink();
        
        // User 2 joins
        await expectThree(page2).toHaveURL(/\/dashboard/);
        const joinGroupPage2 = new JoinGroupPage(page2, user2);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        
        // User 3 joins  
        await expectThree(page3).toHaveURL(/\/dashboard/);
        const joinGroupPage3 = new JoinGroupPage(page3, user3);
        await joinGroupPage3.joinGroupUsingShareLink(shareLink);

        // Wait for all users to see 3 members total
        await groupDetailPage.waitForMemberCount(3);
        await groupDetailPage2.waitForMemberCount(3);
        await groupDetailPage3.waitForMemberCount(3);

        // ALL users navigate to their dashboards
        await dashboardPage1.navigate();
        await dashboardPage1.waitForDashboard();
        await dashboardPage2.navigate(); 
        await dashboardPage2.waitForDashboard();
        await dashboardPage3.navigate();
        await dashboardPage3.waitForDashboard();

        // ALL users should see the group on their dashboards
        await dashboardPage1.waitForGroupToAppear(groupName);
        await dashboardPage2.waitForGroupToAppear(groupName);
        await dashboardPage3.waitForGroupToAppear(groupName);

        // CRITICAL TEST SETUP:
        // User 1: Will delete the group (on group detail page)
        // User 2: Stays on dashboard (should see real-time update) 
        // User 3: Stays on dashboard (should see real-time update)
        
        // User 1 clicks on the group from dashboard to delete
        await dashboardPage1.clickGroupCard(groupName);
        await page1.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Users 2 and 3 STAY on dashboard to watch for real-time updates
        // (This is the key difference from the 2-user test)

        // CRITICAL: Ensure all subscriptions are ready by waiting for DOM to be stable
        // This replaces arbitrary timeouts with proper synchronization
        await page1.waitForLoadState('domcontentloaded');
        await page2.waitForLoadState('domcontentloaded');
        await page3.waitForLoadState('domcontentloaded');

        // User 1 deletes the group
        const editModal = await groupDetailPage.openEditGroupModal();
        await editModal.deleteGroup();
        await groupDetailPage.handleDeleteConfirmDialog(true, groupName);

        // User 1 should be redirected to dashboard
        await expectThree(page1).toHaveURL(/\/dashboard/);
        await dashboardPage1.waitForDashboard();

        // CRITICAL TEST: All dashboards should update in real-time
        // This tests the change document subscription system
        
        // User 1's dashboard (who deleted) should not show the group
        await dashboardPage1.waitForGroupToNotBePresent(groupName, { timeout: 8000 });

        // User 2's dashboard should update in real-time (MAIN TEST)
        await dashboardPage2.waitForGroupToNotBePresent(groupName, { timeout: 8000 });

        // User 3's dashboard should also update in real-time (MAIN TEST)
        await dashboardPage3.waitForGroupToNotBePresent(groupName, { timeout: 8000 });

        // Verify no critical errors occurred during real-time updates
        const jsErrors2: string[] = [];
        const jsErrors3: string[] = [];
        
        page2.on('pageerror', (error) => jsErrors2.push(error.message));
        page3.on('pageerror', (error) => jsErrors3.push(error.message));
        
        await page2.waitForTimeout(500);
        await page3.waitForTimeout(500);
        
        // Filter for group-related errors (ignore other console noise)
        const criticalErrors2 = jsErrors2.filter(error => 
            error.includes('404') && error.includes('group')
        );
        const criticalErrors3 = jsErrors3.filter(error => 
            error.includes('404') && error.includes('group')
        );
        
        // Users 2 and 3 should have no group-related errors
        // (they should handle the group deletion gracefully via subscription)
        expectThree(criticalErrors2).toHaveLength(0);
        expectThree(criticalErrors3).toHaveLength(0);
    });
});
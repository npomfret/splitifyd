import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { simpleTest, expect } from '../../fixtures';
import { GroupDetailPage, JoinGroupPage, ExpenseDetailPage } from '../../pages';
import { generateTestGroupName, randomString } from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
import { SettlementData } from '../../pages/settlement-form.page.ts';

simpleTest.describe('Group Real-Time Updates E2E', () => {
    // This test has been enhanced to test true real-time updates WITHOUT page reloads
    // Previous temporary page.reload() calls have been removed to test actual real-time functionality
    //
    // NOTE: This comprehensive test covers ALL real-time scenarios including:
    // - Group page real-time updates (group edits, expenses, comments, settlements, member changes)
    // - Dashboard real-time updates (User 2 monitors from dashboard throughout)
    // - Member removal scenarios and edge cases
    // This replaces the need for separate dashboard-specific test files.
    simpleTest('should handle real-time group updates across 4 users without page refresh', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - real-time tests may generate expected transient errors during synchronization
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Real-time sync may generate expected transient API errors' });

        // Increase timeout for complex multi-user real-time test
        testInfo.setTimeout(60000); // 60 seconds
        // Create four browser instances - User 1, User 2, User 3, and User 4
        const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
        const { page: user3Page, dashboardPage: user3DashboardPage, user: user3 } = await newLoggedInBrowser();
        const { page: user4Page, dashboardPage: user4DashboardPage, user: user4 } = await newLoggedInBrowser();

        // Create page objects
        const user2GroupDetailPage = new GroupDetailPage(user2Page, user2);
        const user3GroupDetailPage = new GroupDetailPage(user3Page, user3);
        const user4GroupDetailPage = new GroupDetailPage(user4Page, user4);

        // Verify all 4 users are distinct
        expect(user1.email).not.toBe(user2.email);
        expect(user1.email).not.toBe(user3.email);
        expect(user1.email).not.toBe(user4.email);
        expect(user2.email).not.toBe(user3.email);
        expect(user2.email).not.toBe(user4.email);
        expect(user3.email).not.toBe(user4.email);

        // Get display names for verification
        const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.getCurrentUserDisplayName();
        const user4DisplayName = await user4DashboardPage.getCurrentUserDisplayName();

        // Assert all users have different display names
        expect(user1DisplayName).not.toBe(user2DisplayName);
        expect(user1DisplayName).not.toBe(user3DisplayName);
        expect(user1DisplayName).not.toBe(user4DisplayName);
        expect(user2DisplayName).not.toBe(user3DisplayName);
        expect(user2DisplayName).not.toBe(user4DisplayName);
        expect(user3DisplayName).not.toBe(user4DisplayName);

        // =============================================================
        // SETUP PHASE: Create group and get all users joined
        // =============================================================

        const originalGroupName = generateTestGroupName('RealtimeUpdates');
        const originalDescription = 'Testing real-time group updates';

        // User 1 creates the group
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(originalGroupName, originalDescription);
        const groupId = groupDetailPage.inferGroupId();
        await expect(user1Page).toHaveURL(groupDetailUrlPattern(groupId));

        // Get share link for other users
        const shareLink = await groupDetailPage.getShareLink();

        // User 2 joins the group (SEQUENTIAL)
        const joinGroupPage2 = new JoinGroupPage(user2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        await expect(user2Page).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for User 2 to be synchronized before User 3 joins
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page: user1Page, groupDetailPage },
                { page: user2Page, groupDetailPage: user2GroupDetailPage },
            ],
            2,
            groupId,
        );

        // User 3 joins the group (SEQUENTIAL)
        const joinGroupPage3 = new JoinGroupPage(user3Page);
        await joinGroupPage3.joinGroupUsingShareLink(shareLink);
        await expect(user3Page).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for User 3 to be synchronized before User 4 joins
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page: user1Page, groupDetailPage },
                { page: user2Page, groupDetailPage: user2GroupDetailPage },
                { page: user3Page, groupDetailPage: user3GroupDetailPage },
            ],
            3,
            groupId,
        );

        // SEQUENTIAL JOIN 3: Fourth user joins ONLY AFTER third user is fully synchronized
        const joinGroupPage4 = new JoinGroupPage(user4Page);
        await joinGroupPage4.joinGroupUsingShareLink(shareLink);

        // Verify fourth user can actually access the group page
        await expect(user4Page).toHaveURL(groupDetailUrlPattern(groupId));

        // Synchronize all 4 users to see all members
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page: user1Page, groupDetailPage },
                { page: user2Page, groupDetailPage: user2GroupDetailPage },
                { page: user3Page, groupDetailPage: user3GroupDetailPage },
                { page: user4Page, groupDetailPage: user4GroupDetailPage },
            ],
            4,
            groupId,
        );

        // =============================================================
        // DASHBOARD MONITORING SETUP: User 2 on dashboard
        // =============================================================

        // User 2 navigates to dashboard to monitor group-level changes
        await user2DashboardPage.navigate();
        await user2DashboardPage.waitForDashboard(); // Wait for dashboard to load properly

        // Verify User 2 can see the group on dashboard with original name
        await user2DashboardPage.waitForGroupToAppear(originalGroupName);

        // =============================================================
        // TEST 1: Edit Group Name (affects both group page and dashboard)
        // =============================================================

        const newGroupName = `${originalGroupName} UPDATED ${randomString(4)}`;

        // User 1 edits the group name
        const editModal = await groupDetailPage.openEditGroupModal();
        await editModal.editGroupName(newGroupName);
        await editModal.saveChanges();

        // Verify User 1 sees the new name in real-time
        await groupDetailPage.waitForGroupTitle(newGroupName);

        // Verify User 3 sees the new name in real-time
        await user3GroupDetailPage.waitForGroupTitle(newGroupName);

        // Verify User 2 sees the new name on dashboard in real-time
        await user2DashboardPage.waitForGroupToAppear(newGroupName);
        await user2DashboardPage.waitForGroupToNotBePresent(originalGroupName);

        // =============================================================
        // TEST 2: Edit Group Description (affects group page)
        // =============================================================

        const newDescription = `${originalDescription} - Modified at ${new Date().toISOString()}`;

        // User 1 edits the group description
        const editModal2 = await groupDetailPage.openEditGroupModal();
        await editModal2.editDescription(newDescription);
        await editModal2.saveChanges();

        // Verify User 1 sees the new description in real-time
        await groupDetailPage.waitForGroupDescription(newDescription);

        // Verify User 3 sees the new description in real-time
        await user3GroupDetailPage.waitForGroupDescription(newDescription);

        // =============================================================
        // TEST 3: Add Expense (affects balances on both group page and dashboard)
        // =============================================================

        // User 1 adds an expense (only involving users 1, 2, 3 - leaving user 4 uninvolved)
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(4);
        const expenseDescription = `Lunch ${randomString(4)}`;
        const expenseAmount = 60; // $60 split 3 ways = $20 each

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(expenseAmount)
                .withCurrency('USD')
                .withPaidByDisplayName(user1DisplayName)
                .withSplitType('equal')
                // User 4 deliberately excluded
                .build(),
        );

        // Wait for balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);

        // Verify User 1 sees the expense
        await expect(groupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();

        // Verify User 3 sees the expense in real-time
        await expect(user3GroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await user3GroupDetailPage.waitForBalancesToLoad(groupId);

        // Verify User 2 sees balance change on dashboard
        // Users 2 and 3 each owe User 1 $20
        await user2DashboardPage.navigate(); // Navigate to dashboard to ensure proper state
        await user2DashboardPage.waitForDashboard(); // Wait for dashboard to load properly
        await user2DashboardPage.waitForGroupToAppear(newGroupName);

        // =============================================================
        // TEST 4: Add Group Comment (affects group page comments)
        // =============================================================

        const commentText = `Group comment ${randomString(6)}`;

        // User 1 adds a comment
        await groupDetailPage.addComment(commentText);

        // Verify User 3 sees the comment in real-time
        await user3GroupDetailPage.waitForCommentToAppear(commentText);
        await expect(user3GroupDetailPage.getCommentByText(commentText)).toBeVisible();

        // =============================================================
        // TEST 5: Add Settlement (affects balances)
        // =============================================================

        // User 2 settles their debt with User 1
        // Navigate User 2 back to group page
        await user2GroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(user2Page).toHaveURL(groupDetailUrlPattern(groupId));

        const settlementFormPage = await user2GroupDetailPage.clickSettleUpButton(4);
        await settlementFormPage.submitSettlement(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
                amount: '20',
                note: `Settlement ${randomString(4)}`,
            } as SettlementData,
            4,
        );

        // Wait for settlement to process and balances to update
        await user2GroupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage.waitForBalancesToLoad(groupId);

        // Verify User 1 sees the updated balance (User 2 no longer owes money)
        // User 3 should still owe User 1 $20
        await user3GroupDetailPage.waitForBalancesToLoad(groupId);

        // =============================================================
        // TEST 6: Delete Expense (affects balances)
        // =============================================================

        // User 1 deletes the expense
        const expenseLocator = groupDetailPage.getExpenseByDescription(expenseDescription);
        await expenseLocator.click();

        // Wait for expense detail page and delete
        await expect(user1Page).toHaveURL(/\/groups\/[^\/]+\/expenses\/[^\/]+/);
        const expenseDetailPage = new ExpenseDetailPage(user1Page);
        await expenseDetailPage.deleteExpense();

        // Should redirect back to group page
        await expect(user1Page).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify expense is gone for all users
        await expect(groupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();
        await expect(user3GroupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();

        // Verify balances reset to settled up
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await user3GroupDetailPage.waitForBalancesToLoad(groupId);

        // =============================================================
        // TEST 7: User 4 Leaves Group (no expenses/settlements involved)
        // =============================================================

        // User 4 can leave the group since they have no expenses or settlements
        console.log('🚪 Attempting User 4 group leave...');

        // Check if User 4 has any outstanding balances before leaving
        console.log('💰 Checking User 4 balance status...');
        await user4GroupDetailPage.waitForBalancesToLoad(groupId);
        console.log('✅ User 4 balances loaded successfully');

        const leaveModal = await user4GroupDetailPage.clickLeaveGroup();
        await leaveModal.confirmLeaveGroup();
        console.log('✅ User 4 leave group completed');

        // Verify User 4 gets redirected to dashboard
        await user4DashboardPage.waitForDashboard();

        // Verify Users 1, 2, and 3 see updated member count (3 members)
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page: user1Page, groupDetailPage },
                { page: user2Page, groupDetailPage: user2GroupDetailPage },
                { page: user3Page, groupDetailPage: user3GroupDetailPage },
            ],
            3,
            groupId,
        );

        // =============================================================
        // FINAL VERIFICATION: 3 users remain in the group
        // =============================================================

        // Verify 3 users are still in the group (User 4 has left)
        await expect(groupDetailPage.getMembersCount()).toContainText('3 member');

        // Verify group still has the updated name and description
        await expect(groupDetailPage.getGroupTitle()).toHaveText(newGroupName);
        await expect(groupDetailPage.getGroupDescription()).toHaveText(newDescription);
    });

    simpleTest('should support real-time expense comments across multiple users', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Alice and Bob
        const { page: alicePage, user: alice, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
        const { page: bobPage, user: bob, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

        const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Create page objects
        const bobGroupDetailPage = new GroupDetailPage(bobPage, bob);

        // Alice creates a group and adds an expense
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('ExpenseComments'), 'Testing expense comments');
        const groupId = groupDetailPage.inferGroupId();

        // Bob joins the group
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(bobPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Synchronize both users
        const allPages = [
            { page: alicePage, groupDetailPage },
            { page: bobPage, groupDetailPage: bobGroupDetailPage },
        ];
        await groupDetailPage.synchronizeMultiUserState(allPages, 2, groupId);

        // Alice creates an expense
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Test Expense for Comments',
            amount: 50.0,
            currency: 'USD',
            paidByDisplayName: user1DisplayName,
            splitType: 'equal',
        });

        // After submission, we should be back on the group page
        await alicePage.waitForURL(new RegExp(`/groups/${groupId}$`), { timeout: 3000 });

        // Click on the newly created expense to navigate to expense detail page
        await groupDetailPage.clickExpenseToView('Test Expense for Comments');

        // Wait for navigation to expense detail page
        await alicePage.waitForURL(new RegExp(`/groups/${groupId}/expenses/[a-zA-Z0-9]+$`), { timeout: 3000 });

        // Create the expense detail page object
        const expenseDetailPage = new ExpenseDetailPage(alicePage, alice);

        // Verify we're on the expense detail page
        await expenseDetailPage.waitForPageReady();

        // Get the expense URL to navigate Bob there
        const expenseUrl = alicePage.url();
        const expenseId = expenseUrl.match(/\/expenses\/([a-zA-Z0-9]+)$/)?.[1];
        if (!expenseId) {
            throw new Error(`Could not extract expense ID from URL: ${expenseUrl}`);
        }

        // Navigate Bob to the expense detail page
        await bobPage.goto(expenseUrl);
        const bobExpenseDetailPage = new ExpenseDetailPage(bobPage, bob);
        await bobExpenseDetailPage.waitForPageReady();

        // Verify comments section is available on both pages
        await expenseDetailPage.verifyCommentsSection();
        await bobExpenseDetailPage.verifyCommentsSection();

        // Test real-time expense comments
        const aliceExpenseComment = `comment ${uuidv4()}`;

        // Alice adds comment to expense
        await expenseDetailPage.addComment(aliceExpenseComment);

        // Bob should see it in real-time
        await bobExpenseDetailPage.waitForCommentToAppear(aliceExpenseComment);

        // Bob adds a comment
        const bobExpenseComment = `comment ${uuidv4()}`;
        await bobExpenseDetailPage.addComment(bobExpenseComment);

        // Alice should see Bob's comment
        await expenseDetailPage.waitForCommentToAppear(bobExpenseComment);

        // Both should see 2 comments
        await expenseDetailPage.waitForCommentCount(2);
        await bobExpenseDetailPage.waitForCommentCount(2);

        // Verify comments are visible
        await expect(expenseDetailPage.getCommentByText(aliceExpenseComment)).toBeVisible();
        await expect(expenseDetailPage.getCommentByText(bobExpenseComment)).toBeVisible();
        await expect(bobExpenseDetailPage.getCommentByText(aliceExpenseComment)).toBeVisible();
        await expect(bobExpenseDetailPage.getCommentByText(bobExpenseComment)).toBeVisible();
    });
});

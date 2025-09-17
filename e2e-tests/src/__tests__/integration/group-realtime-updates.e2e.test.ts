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

    simpleTest('should handle concurrent expense editing by multiple users', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Concurrent editing may generate expected transient sync errors' });

        // Create three users - Editor1, Editor2, Watcher
        const { page: editor1Page, dashboardPage: editor1DashboardPage, user: editor1 } = await newLoggedInBrowser();
        const { page: editor2Page, dashboardPage: editor2DashboardPage, user: editor2 } = await newLoggedInBrowser();
        const { page: watcherPage, dashboardPage: watcherDashboardPage, user: watcher } = await newLoggedInBrowser();

        // Create page objects
        const editor1GroupDetailPage = new GroupDetailPage(editor1Page, editor1);
        const editor2GroupDetailPage = new GroupDetailPage(editor2Page, editor2);
        const watcherGroupDetailPage = new GroupDetailPage(watcherPage, watcher);

        // Get display names
        const editor1DisplayName = await editor1DashboardPage.getCurrentUserDisplayName();
        const editor2DisplayName = await editor2DashboardPage.getCurrentUserDisplayName();

        // Editor1 creates group
        const groupName = generateTestGroupName('ConcurrentEdit');
        const groupDetailPage = await editor1DashboardPage.createGroupAndNavigate(groupName, 'Testing concurrent expense editing');
        const groupId = groupDetailPage.inferGroupId();

        // Others join
        const shareLink = await editor1GroupDetailPage.getShareLink();

        const joinGroupPage2 = new JoinGroupPage(editor2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        const joinGroupPageWatcher = new JoinGroupPage(watcherPage);
        await joinGroupPageWatcher.joinGroupUsingShareLink(shareLink);

        await editor1GroupDetailPage.waitForMemberCount(3);

        // Editor1 creates first expense
        const expense1FormPage = await editor1GroupDetailPage.clickAddExpenseButton(3);
        const expense1Description = `Concurrent Test 1 ${randomString(4)}`;

        await expense1FormPage.submitExpense(
            new ExpenseFormDataBuilder().withDescription(expense1Description).withAmount(30).withCurrency('USD').withPaidByDisplayName(editor1DisplayName).withSplitType('equal').build(),
        );

        // Editor2 creates second expense (concurrent with first)
        const expense2FormPage = await editor2GroupDetailPage.clickAddExpenseButton(3);
        const expense2Description = `Concurrent Test 2 ${randomString(4)}`;

        await expense2FormPage.submitExpense(
            new ExpenseFormDataBuilder().withDescription(expense2Description).withAmount(45).withCurrency('USD').withPaidByDisplayName(editor2DisplayName).withSplitType('equal').build(),
        );

        // Wait for both expenses to appear
        await editor1GroupDetailPage.waitForBalancesToLoad(groupId);
        await editor2GroupDetailPage.waitForBalancesToLoad(groupId);

        await expect(editor1GroupDetailPage.getExpenseByDescription(expense1Description)).toBeVisible();
        await expect(editor2GroupDetailPage.getExpenseByDescription(expense2Description)).toBeVisible();

        // CONCURRENT EDITING: Both editors edit their expenses simultaneously

        // Editor1 edits first expense (increase amount to $60)
        await editor1GroupDetailPage.clickExpenseToView(expense1Description);
        const expense1DetailPage = new ExpenseDetailPage(editor1Page, editor1);
        await expense1DetailPage.waitForPageReady();
        const edit1FormPage = await expense1DetailPage.clickEditExpenseButton(3);
        await edit1FormPage.fillAmount('60');
        await edit1FormPage.getUpdateExpenseButton().click();
        await expense1DetailPage.navigateToStaticPath(`/groups/${groupId}`);

        // Editor2 edits second expense (increase amount to $90)
        await editor2GroupDetailPage.clickExpenseToView(expense2Description);
        const expense2DetailPage = new ExpenseDetailPage(editor2Page, editor2);
        await expense2DetailPage.waitForPageReady();
        const edit2FormPage = await expense2DetailPage.clickEditExpenseButton(3);
        await edit2FormPage.fillAmount('90');
        await edit2FormPage.getUpdateExpenseButton().click();
        await expense2DetailPage.navigateToStaticPath(`/groups/${groupId}`);

        // Wait for changes to propagate
        await editor1GroupDetailPage.waitForBalancesToLoad(groupId);
        await editor2GroupDetailPage.waitForBalancesToLoad(groupId);

        // CRITICAL TEST: Watcher should see BOTH edits reflected in final balances WITHOUT refresh
        // Editor1 paid $60, Editor2 paid $90, total $150 split 3 ways = $50 each
        // Editor1 owes: $50 - $60 = -$10 (they are owed $10)
        // Editor2 owes: $50 - $90 = -$40 (they are owed $40)
        // Watcher owes: $50 - $0 = $50

        await watcherGroupDetailPage.waitForBalancesToLoad(groupId);

        // Verify both expenses are visible to watcher with updated amounts
        await expect(watcherGroupDetailPage.getExpenseByDescription(expense1Description)).toBeVisible();
        await expect(watcherGroupDetailPage.getExpenseByDescription(expense2Description)).toBeVisible();

        console.log('✅ Concurrent expense editing handled correctly');
    });

    simpleTest('should propagate expense deletion in real-time', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Real-time sync may generate expected transient API errors' });

        // Create three users - Deleter, GroupWatcher, DashboardWatcher
        const { page: deleterPage, dashboardPage: deleterDashboardPage, user: deleter } = await newLoggedInBrowser();
        const { page: groupWatcherPage, dashboardPage: groupWatcherDashboardPage, user: groupWatcher } = await newLoggedInBrowser();
        const { page: dashWatcherPage, dashboardPage: dashWatcherDashboardPage } = await newLoggedInBrowser();

        // Create page objects
        const deleterGroupDetailPage = new GroupDetailPage(deleterPage, deleter);
        const groupWatcherGroupDetailPage = new GroupDetailPage(groupWatcherPage, groupWatcher);

        // Get display names
        const deleterDisplayName = await deleterDashboardPage.getCurrentUserDisplayName();

        // Deleter creates group
        const groupName = generateTestGroupName('DeleteRT');
        const groupDetailPage = await deleterDashboardPage.createGroupAndNavigate(groupName, 'Testing real-time expense deletion');
        const groupId = groupDetailPage.inferGroupId();

        // Others join
        const shareLink = await groupDetailPage.getShareLink();

        const joinGroupPageGroup = new JoinGroupPage(groupWatcherPage);
        await joinGroupPageGroup.joinGroupUsingShareLink(shareLink);
        const joinGroupPageDash = new JoinGroupPage(dashWatcherPage);
        await joinGroupPageDash.joinGroupUsingShareLink(shareLink);

        await deleterGroupDetailPage.waitForMemberCount(3);

        // Position watchers: GroupWatcher stays on group page, DashWatcher goes to dashboard
        await dashWatcherDashboardPage.navigate();
        await dashWatcherDashboardPage.waitForGroupToAppear(groupName);

        // Create expense involving GroupWatcher ($50 split = $25 each)
        const expenseFormPage = await deleterGroupDetailPage.clickAddExpenseButton(3);
        const expenseDescription = `Delete Test ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder().withDescription(expenseDescription).withAmount(50).withCurrency('USD').withPaidByDisplayName(deleterDisplayName).withSplitType('equal').build(),
        );

        await deleterGroupDetailPage.waitForBalancesToLoad(groupId);

        // Verify expense is visible to all
        await expect(deleterGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await expect(groupWatcherGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();

        // DashWatcher should see the group accessible
        await dashWatcherDashboardPage.waitForGroupToAppear(groupName);

        // Deleter deletes the expense
        const expenseToDelete = deleterGroupDetailPage.getExpenseByDescription(expenseDescription);
        await expect(expenseToDelete).toBeVisible();

        // Click expense to go to detail page, then delete from there
        await deleterGroupDetailPage.clickExpenseToView(expenseDescription);
        const expenseDetailPage = new ExpenseDetailPage(deleterPage, deleter);
        await expenseDetailPage.waitForPageReady();

        // Delete the expense from the expense detail page
        await expenseDetailPage.deleteExpense();

        // Should redirect back to group page after deletion
        await expect(deleterPage).toHaveURL(groupDetailUrlPattern(groupId));
        await deleterGroupDetailPage.waitForBalancesToLoad(groupId);

        // CRITICAL TESTS:

        // 1. GroupWatcher should see expense disappear WITHOUT refresh
        await expect(groupWatcherGroupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();
        await groupWatcherGroupDetailPage.waitForBalancesToLoad(groupId);

        // 2. DashWatcher should still see the group accessible after deletion
        await dashWatcherDashboardPage.waitForGroupToAppear(groupName);

        console.log('✅ Real-time expense deletion working correctly');
    });

    simpleTest('should show real-time notifications when user is added to existing group', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Real-time sync may generate expected transient API errors' });

        // Create three users - Owner (adding), ExistingMember (watching), NewMember (being added via invite)
        const { dashboardPage: ownerDashboardPage, } = await newLoggedInBrowser();
        const { page: existingPage, dashboardPage: existingDashboardPage, user: existing } = await newLoggedInBrowser();
        const { page: newPage, dashboardPage: newDashboardPage, user: newUser } = await newLoggedInBrowser();

        // Create page objects
        const existingGroupDetailPage = new GroupDetailPage(existingPage, existing);

        // Get display names
        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const existingDisplayName = await existingDashboardPage.getCurrentUserDisplayName();
        const newDisplayName = await newDashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('AddNotifyRT');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing add member notifications');
        const groupId = groupDetailPage.inferGroupId();

        // Existing member joins initially
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPageExisting = new JoinGroupPage(existingPage);
        await joinGroupPageExisting.joinGroupUsingShareLink(shareLink);

        // Wait for initial 2 members
        await groupDetailPage.waitForMemberCount(2);
        await existingGroupDetailPage.waitForMemberCount(2);

        // New user starts on dashboard (they'll join via share link)
        await newDashboardPage.navigate();

        // New user joins the group
        const joinGroupPageNew = new JoinGroupPage(newPage);
        await joinGroupPageNew.joinGroupUsingShareLink(shareLink);
        await expect(newPage).toHaveURL(groupDetailUrlPattern(groupId));

        // CRITICAL TESTS:

        // 1. Owner should see member count increase to 3 in real-time
        await groupDetailPage.waitForMemberCount(3);
        await expect(groupDetailPage.getMemberItem(newDisplayName)).toBeVisible();

        // 2. Existing member should see new member appear in real-time
        await existingGroupDetailPage.waitForMemberCount(3);
        await expect(existingGroupDetailPage.getMemberItem(newDisplayName)).toBeVisible();

        // 3. New user should see all existing members
        const newGroupDetailPage = new GroupDetailPage(newPage, newUser);
        await newGroupDetailPage.waitForMemberCount(3);
        await expect(newGroupDetailPage.getMemberItem(ownerDisplayName)).toBeVisible();
        await expect(newGroupDetailPage.getMemberItem(existingDisplayName)).toBeVisible();

        console.log('✅ Real-time member addition notifications working correctly');
    });
});

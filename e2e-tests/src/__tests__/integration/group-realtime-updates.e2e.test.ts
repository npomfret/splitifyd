import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';
import {expect, simpleTest} from '../../fixtures';
import {ExpenseDetailPage, JoinGroupPage} from '../../pages';
import {generateShortId, generateTestGroupName, randomString} from '@splitifyd/test-support';
import {v4 as uuidv4} from 'uuid';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {SettlementData} from '../../pages/settlement-form.page.ts';

simpleTest.describe('Group Real-Time Updates E2E', () => {
    simpleTest('should handle real-time group detail updates across 4 users', async ({newLoggedInBrowser}, testInfo) => {
        testInfo.setTimeout(60000); // 60 seconds

        // Create four browser instances - User 1, User 2, User 3, and User 4
        const {dashboardPage: user1DashboardPage} = await newLoggedInBrowser();
        const {page: user2Page, dashboardPage: user2DashboardPage} = await newLoggedInBrowser();
        const {page: user3Page, dashboardPage: user3DashboardPage} = await newLoggedInBrowser();
        const {page: user4Page, dashboardPage: user4DashboardPage} = await newLoggedInBrowser();

        // Get display names for verification
        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();
        const user4DisplayName = await user4DashboardPage.header.getCurrentUserDisplayName();

        // Assert all users have different display names
        // Assert all users have different display names
        expect(new Set([user1DisplayName, user2DisplayName, user3DisplayName, user4DisplayName]).size).toBe(4);

        // =============================================================
        // SETUP PHASE: Create group and get all users joined
        // =============================================================

        const originalGroupName = generateTestGroupName(`RealtimeUpdates ${generateShortId()}`);
        const originalDescription = 'Testing real-time group updates';

        // User 1 creates the group
        const user1GroupDetailPage = await user1DashboardPage.createGroupAndNavigate(originalGroupName, originalDescription);
        const groupId = user1GroupDetailPage.inferGroupId();

        // Get share link for other users
        const shareLink = await user1GroupDetailPage.getShareLink();

        // User 2 joins the group (SEQUENTIAL)
        const user2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink);
        await user1GroupDetailPage.waitForPage(groupId, 2);
        await user2GroupDetailPage.waitForPage(groupId, 2);

        // User 3 joins the group (SEQUENTIAL)
        const user3GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user3Page, shareLink);
        await user1GroupDetailPage.waitForPage(groupId, 3);
        await user2GroupDetailPage.waitForPage(groupId, 3);
        await user3GroupDetailPage.waitForPage(groupId, 3);

        // SEQUENTIAL JOIN 3: Fourth user joins ONLY AFTER third user is fully synchronized
        const user4GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user4Page, shareLink);
        await user1GroupDetailPage.waitForPage(groupId, 4);
        await user2GroupDetailPage.waitForPage(groupId, 4);
        await user3GroupDetailPage.waitForPage(groupId, 4);
        await user4GroupDetailPage.waitForPage(groupId, 4);

        // =============================================================
        // DASHBOARD MONITORING SETUP: User 2 on dashboard
        // =============================================================

        // User 2 navigates to dashboard to monitor group-level changes
        // Verify User 2 can see the group on dashboard with original name
        await user2GroupDetailPage.navigateToDashboard();
        await user2DashboardPage.waitForGroupToAppear(originalGroupName);

        // =============================================================
        // TEST 1: Edit Group Name (affects both group page and dashboard)
        // =============================================================

        const newGroupName = `${originalGroupName} UPDATED ${randomString(4)}`;

        // User 1 edits the group name
        const editModal = await user1GroupDetailPage.openEditGroupModal();
        await editModal.editGroupName(newGroupName);
        await editModal.saveChanges();

        // Verifygroup details pages
        await user1GroupDetailPage.waitForGroupTitle(newGroupName);
        await user3GroupDetailPage.waitForGroupTitle(newGroupName);
        await user4GroupDetailPage.waitForGroupTitle(newGroupName);

        // Verify User 2 sees the new name on dashboard in real-time
        await user2DashboardPage.waitForGroupToAppear(newGroupName);
        await user2DashboardPage.waitForGroupToNotBePresent(originalGroupName);

        // =============================================================
        // TEST 2: Edit Group Description (affects group page)
        // =============================================================

        const newDescription = `${originalDescription} UPDATED ${randomString(4)}`;

        // User 1 edits the group description
        const editModal2 = await user1GroupDetailPage.openEditGroupModal();
        await editModal2.editDescription(newDescription);
        await editModal2.saveChanges();

        // Verify Users see the new description in real-time
        await user1GroupDetailPage.waitForGroupDescription(newDescription);
        await user3GroupDetailPage.waitForGroupDescription(newDescription);
        await user4GroupDetailPage.waitForGroupDescription(newDescription);
    });

    simpleTest('should handle real-time group transactions across 4 users', async ({newLoggedInBrowser}, testInfo) => {
        testInfo.setTimeout(60000); // 60 seconds

        // Create four browser instances - User 1, User 2, User 3, and User 4
        const {page: user1Page, dashboardPage: user1DashboardPage} = await newLoggedInBrowser();
        const {page: user2Page, dashboardPage: user2DashboardPage} = await newLoggedInBrowser();
        const {page: user3Page, dashboardPage: user3DashboardPage} = await newLoggedInBrowser();
        const {page: user4Page, dashboardPage: user4DashboardPage} = await newLoggedInBrowser();

        // Get display names for verification
        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();
        const user4DisplayName = await user4DashboardPage.header.getCurrentUserDisplayName();

        console.log({user1DisplayName, user2DisplayName, user3DisplayName, user4DisplayName})

        // Assert all users have different display names
        expect(new Set([user1DisplayName, user2DisplayName, user3DisplayName, user4DisplayName]).size).toBe(4);

        // =============================================================
        // SETUP PHASE: Create group and get all users joined
        // =============================================================

        const groupName = generateTestGroupName(`RealtimeUpdates ${generateShortId()}`);
        // User 1 creates the group
        const user1GroupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, generateShortId());
        const groupId = user1GroupDetailPage.inferGroupId();

        // Get share link for other users
        const shareLink = await user1GroupDetailPage.getShareLink();

        // User 2 joins the group (SEQUENTIAL)
        const user2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink);
        await user1GroupDetailPage.waitForPage(groupId, 2);
        await user2GroupDetailPage.waitForPage(groupId, 2);

        // User 3 joins the group (SEQUENTIAL)
        const user3GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user3Page, shareLink);
        await user1GroupDetailPage.waitForPage(groupId, 3);
        await user2GroupDetailPage.waitForPage(groupId, 3);
        await user3GroupDetailPage.waitForPage(groupId, 3);

        // SEQUENTIAL JOIN 3: Fourth user joins ONLY AFTER third user is fully synchronized
        const user4GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user4Page, shareLink);
        await user1GroupDetailPage.waitForPage(groupId, 4);
        await user2GroupDetailPage.waitForPage(groupId, 4);
        await user3GroupDetailPage.waitForPage(groupId, 4);
        await user4GroupDetailPage.waitForPage(groupId, 4);

        // =============================================================
        // DASHBOARD MONITORING SETUP: User 2 on dashboard
        // =============================================================

        // User 2 navigates to dashboard to monitor group-level changes
        // Verify User 2 can see the group on dashboard with original name
        await user2GroupDetailPage.navigateToDashboard();
        await user2DashboardPage.waitForGroupToAppear(groupName);

        // =============================================================
        // TEST 3: Add Expense (affects balances on both group page and dashboard)
        // =============================================================

        // User 1 adds an expense (only involving users 1, 2, 3 - leaving user 4 uninvolved)
        const expenseFormPage = await user1GroupDetailPage.clickAddExpenseButton(4);
        const expenseDescription = `Lunch ${randomString(4)}`;
        const expenseAmount = 99; // $ split 3 ways = 33 each

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(expenseAmount)
                .withCurrency('USD')
                .withPaidByDisplayName(user1DisplayName)
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName, user3DisplayName])// User 4 excluded
                .build(),
        );

        await user1GroupDetailPage.waitForExpense(expenseDescription);
        await user3GroupDetailPage.waitForExpense(expenseDescription);
        await user4GroupDetailPage.waitForExpense(expenseDescription);

        // Verify debt relationships after $99 expense split 3 ways ($33 each)
        // User2 and User3 each owe User1 $33, User4 has no debt
        await user1GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$33.00');
        await user1GroupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$33.00');
        await user1GroupDetailPage.assertSettledUp(user4DisplayName);

        await user3GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$33.00');
        await user3GroupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$33.00');
        await user3GroupDetailPage.assertSettledUp(user4DisplayName);

        // Verify User 2 sees balance change on dashboard
        // Users 2 and 3 each owe User 1 $20
        await user2DashboardPage.navigate(); // Navigate to dashboard to ensure proper state
        await user2DashboardPage.waitForDashboard(); // Wait for dashboard to load properly
        await user2DashboardPage.waitForGroupToAppear(groupName);

        // =============================================================
        // TEST 4: Add Group Comment (affects group page comments)
        // =============================================================

        const commentText = `Group comment ${randomString(6)}`;

        // User 1 adds a comment
        await user1GroupDetailPage.addComment(commentText);

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
        const settlementNote = `Settlement ${randomString(4)}`;
        await settlementFormPage.submitSettlement(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
                amount: '20',
                note: settlementNote,
            } as SettlementData,
            4,
        );

        // Wait for settlement to appear on all group detail pages in real-time
        await user1GroupDetailPage.waitForSettlementToAppear(settlementNote);
        await user3GroupDetailPage.waitForSettlementToAppear(settlementNote);
        await user4GroupDetailPage.waitForSettlementToAppear(settlementNote);

        // Verify debt relationships after $20 settlement from User2 to User1
        // User2 now owes User1 $13.00 ($33 - $20), User3 still owes $33, User4 still settled
        await user1GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$13.00');
        await user1GroupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$33.00');
        await user1GroupDetailPage.assertSettledUp(user4DisplayName);

        await user3GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$13.00');
        await user3GroupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$33.00');
        await user3GroupDetailPage.assertSettledUp(user4DisplayName);

        await user4GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$13.00');
        await user4GroupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '$33.00');
        await user4GroupDetailPage.assertSettledUp(user4DisplayName);

        // =============================================================
        // TEST 6: Delete Expense (affects balances)
        // =============================================================

        // User 1 deletes the expense
        const expenseLocator = user1GroupDetailPage.getExpenseByDescription(expenseDescription);
        await expenseLocator.click();

        // Wait for expense detail page and delete
        await expect(user1Page).toHaveURL(/\/groups\/[^\/]+\/expenses\/[^\/]+/);
        const expenseDetailPage = new ExpenseDetailPage(user1Page);
        await expenseDetailPage.deleteExpense();

        // Should redirect back to group page
        await expect(user1Page).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify expense is gone for all users
        await expect(user1GroupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();
        await expect(user3GroupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();

        // Verify balances reset to settled up
        await user1GroupDetailPage.waitForBalancesToLoad(groupId);
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
        await user1GroupDetailPage.waitForPage(groupId, 3);
        await user2GroupDetailPage.waitForPage(groupId, 3);
        await user3GroupDetailPage.waitForPage(groupId, 3);

        // =============================================================
        // FINAL VERIFICATION: 3 users remain in the group
        // =============================================================

        // Verify 3 users are still in the group (User 4 has left)
        await expect(user1GroupDetailPage.getMembersCount()).toContainText('3 member');
    });

    simpleTest('should support real-time expense comments across multiple users', async ({newLoggedInBrowser}) => {
        // Create two browser instances - Alice and Bob
        const {dashboardPage: user1DashboardPage} = await newLoggedInBrowser();
        const {page: user2Page } = await newLoggedInBrowser();

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();

        // Create page objects
        // Alice creates a group and adds an expense
        const user1GroupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('ExpenseComments'), 'Testing expense comments');
        const groupId = user1GroupDetailPage.inferGroupId();

        // Bob joins the group
        const shareLink = await user1GroupDetailPage.getShareLink();
        const user2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink);
        const user2DisplayName = await user2GroupDetailPage.header.getCurrentUserDisplayName();

        // Synchronize both users
        await user1GroupDetailPage.waitForPage(groupId, 2);
        await user2GroupDetailPage.waitForPage(groupId, 2);

        // Alice creates an expense
        const expenseFormPage = await user1GroupDetailPage.clickAddExpenseButton(2);
        const expense1Description = 'Test Expense for Comments';
        await expenseFormPage.submitExpense({
            description: expense1Description,
            amount: 50.0,
            currency: 'USD',
            paidByDisplayName: user1DisplayName,
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await user1GroupDetailPage.waitForExpense(expense1Description);
        await user2GroupDetailPage.waitForExpense(expense1Description);

        // Click on the newly created expense to navigate to expense detail page
        const expenseDetailPage = await user1GroupDetailPage.clickExpenseToView(expense1Description);

        // User2 clicks on the expense to navigate to expense detail page
        const user2ExpenseDetailPage = await user2GroupDetailPage.clickExpenseToView(expense1Description);

        // Verify comments section is available on both pages
        await expenseDetailPage.verifyCommentsSection();
        await user2ExpenseDetailPage.verifyCommentsSection();

        // Test real-time expense comments
        const comment1 = `comment ${uuidv4()}`;

        // Alice adds comment to expense
        await expenseDetailPage.addComment(comment1);

        // Bob should see it in real-time
        await user2ExpenseDetailPage.waitForCommentToAppear(comment1);

        // Bob adds a comment
        const comment2 = `comment ${uuidv4()}`;
        await user2ExpenseDetailPage.addComment(comment2);

        // Alice should see Bob's comment
        await expenseDetailPage.waitForCommentToAppear(comment2);

        // Both should see 2 comments
        await expenseDetailPage.waitForCommentCount(2);
        await user2ExpenseDetailPage.waitForCommentCount(2);

        // Verify comments are visible
        await expect(expenseDetailPage.getCommentByText(comment1)).toBeVisible();
        await expect(expenseDetailPage.getCommentByText(comment2)).toBeVisible();
        await expect(user2ExpenseDetailPage.getCommentByText(comment1)).toBeVisible();
        await expect(user2ExpenseDetailPage.getCommentByText(comment2)).toBeVisible();
    });

    simpleTest('should handle concurrent expense editing by multiple users', async ({newLoggedInBrowser}) => {
        // Create three users - Editor1, Editor2, Watcher
        const {dashboardPage: editor1DashboardPage} = await newLoggedInBrowser();
        const {page: editor2Page, dashboardPage: editor2DashboardPage} = await newLoggedInBrowser();
        const {page: watcherPage, dashboardPage: watcherDashboardPage} = await newLoggedInBrowser();

        // Get display names
        const editor1DisplayName = await editor1DashboardPage.header.getCurrentUserDisplayName();
        const editor2DisplayName = await editor2DashboardPage.header.getCurrentUserDisplayName();
        const watcherDisplayName = await watcherDashboardPage.header.getCurrentUserDisplayName();

        // Editor1 creates group
        const editorGroupDetailPage = await editor1DashboardPage.createGroupAndNavigate(
            generateTestGroupName('ConcurrentEdit'),
            'Testing concurrent expense editing'
        );
        const groupId = editorGroupDetailPage.inferGroupId();

        // Others join
        const shareLink = await editorGroupDetailPage.getShareLink();

        const editor2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(editor2Page, shareLink);
        await editorGroupDetailPage.waitForPage(groupId, 2);
        await editor2GroupDetailPage.waitForPage(groupId, 2);

        const watcherGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(watcherPage, shareLink);
        await editorGroupDetailPage.waitForPage(groupId, 3);
        await editor2GroupDetailPage.waitForPage(groupId, 3);
        await watcherGroupDetailPage.waitForPage(groupId, 3);

        // Editor1 creates first expense
        const expense1FormPage = await editorGroupDetailPage.clickAddExpenseButton(3);
        const expense1Description = `Concurrent Test 1 ${randomString(4)}`;

        await expense1FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expense1Description)
                .withAmount(30)// $10 each
                .withCurrency('USD')
                .withPaidByDisplayName(editor1DisplayName)
                .withSplitType('equal')
                .withParticipants([editor1DisplayName, editor2DisplayName, watcherDisplayName])
                .build(),
        );

        await editorGroupDetailPage.waitForExpense(expense1Description);
        await editor2GroupDetailPage.waitForExpense(expense1Description);
        await watcherGroupDetailPage.waitForExpense(expense1Description);

        // Wait for balances to update after first expense ($30 split 3 ways = $10 each, paid by editor1)
        // Test all 3 pages for all balances: editor2 and watcher each owe $10 to editor1
        await editorGroupDetailPage.verifyDebtRelationship(editor2DisplayName, editor1DisplayName, '$10.00');
        await editorGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$10.00');

        await editor2GroupDetailPage.verifyDebtRelationship(editor2DisplayName, editor1DisplayName, '$10.00');
        await editor2GroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$10.00');

        await watcherGroupDetailPage.verifyDebtRelationship(editor2DisplayName, editor1DisplayName, '$10.00');
        await watcherGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$10.00');

        // Editor2 creates second expense (concurrent with first)
        const expense2FormPage = await editor2GroupDetailPage.clickAddExpenseButton(3);
        const expense2Description = `Concurrent Test 2 ${randomString(4)}`;

        await expense2FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expense2Description)
                .withAmount(45)
                .withCurrency('USD')
                .withPaidByDisplayName(editor2DisplayName)
                .withSplitType('equal')
                .withParticipants([editor1DisplayName, editor2DisplayName, watcherDisplayName])
                .build(),
        );

        await editorGroupDetailPage.waitForExpense(expense2Description);
        await editor2GroupDetailPage.waitForExpense(expense2Description);
        await watcherGroupDetailPage.waitForExpense(expense2Description);

        // Wait for balances to update after second expense ($45 split 3 ways = $15 each, paid by editor2)
        // Test all 3 pages for all balances after both expenses (with debt simplification):
        // Raw debts: Editor1 owes $15 to editor2, Editor2 is owed $10 from editor1, Watcher owes $10 to editor1 + $15 to editor2
        // Simplified: Watcher owes $5 to editor1 + $20 to editor2 (editor1→editor2 debt eliminated via triangulation)
        await editorGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$5.00');
        await editorGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$20.00');

        await editor2GroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$5.00');
        await editor2GroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$20.00');

        await watcherGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$5.00');
        await watcherGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$20.00');

        // Editor1 edits first expense (increase amount to $60)
        const expense1DetailPage = await editorGroupDetailPage.clickExpenseToView(expense1Description);
        const edit1FormPage = await expense1DetailPage.clickEditExpenseButton(3);
        const expense1DescriptionEdited = `${expense1Description} editied`;
        await edit1FormPage.fillDescription(expense1DescriptionEdited);
        await edit1FormPage.fillAmount('60');
        await edit1FormPage.clickUpdateExpenseButton();
        await expense1DetailPage.clickBackButton();// take them back to the group detail page

        await editorGroupDetailPage.waitForExpense(expense1DescriptionEdited);
        await editor2GroupDetailPage.waitForExpense(expense1DescriptionEdited);
        await watcherGroupDetailPage.waitForExpense(expense1DescriptionEdited);

        // Wait for balances to update after first expense edit ($60 split 3 ways = $20 each, paid by editor1)
        // After debt simplification:
        // Raw: Editor2 owes $5 to editor1, Watcher owes $20 to editor1 + $15 to editor2
        // Simplified: Watcher owes $25 to editor1, Watcher owes $10 to editor2
        await editorGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$25.00');
        await editorGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$10.00');

        await editor2GroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$25.00');
        await editor2GroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$10.00');

        await watcherGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$25.00');
        await watcherGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$10.00');

        // Editor2 edits second expense (increase amount to $90)
        const expense2DetailPage = await editor2GroupDetailPage.clickExpenseToView(expense2Description);
        const edit2FormPage = await expense2DetailPage.clickEditExpenseButton(3);
        const expense2DescriptionEdited = `${expense2Description} editied`;
        await edit2FormPage.fillDescription(expense2DescriptionEdited);
        await edit2FormPage.fillAmount('90');
        await edit2FormPage.clickUpdateExpenseButton();
        await expense2DetailPage.clickBackButton();// take them back to the group detail page

        await editorGroupDetailPage.waitForExpense(expense2DescriptionEdited);
        await editor2GroupDetailPage.waitForExpense(expense2DescriptionEdited);
        await watcherGroupDetailPage.waitForExpense(expense2DescriptionEdited);

        await editorGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$40.00');
        await editorGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$10.00');

        await editor2GroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$40.00');
        await editor2GroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$10.00');

        await watcherGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor1DisplayName, '$40.00');
        await watcherGroupDetailPage.verifyDebtRelationship(watcherDisplayName, editor2DisplayName, '$10.00');

    });

    simpleTest('should propagate expense deletion in real-time', async ({newLoggedInBrowser}) => {
        // Create three users - Deleter, GroupWatcher, DashboardWatcher
        const {page: deleterPage, dashboardPage: deleterDashboardPage} = await newLoggedInBrowser();
        const {page: groupWatcherPage, dashboardPage: groupWatcherDashboardPage} = await newLoggedInBrowser();
        const {page: dashWatcherPage, dashboardPage: dashWatcherDashboardPage} = await newLoggedInBrowser();

        // Get display names
        const deleterDisplayName = await deleterDashboardPage.header.getCurrentUserDisplayName();
        const groupWatcherDisplayName = await groupWatcherDashboardPage.header.getCurrentUserDisplayName();
        const dashWatcherDisplayName = await dashWatcherDashboardPage.header.getCurrentUserDisplayName();

        // Deleter creates group
        const groupName = generateTestGroupName('DeleteRT');
        const deleterGroupDetailPage = await deleterDashboardPage.createGroupAndNavigate(groupName, 'Testing real-time expense deletion');
        const groupId = deleterGroupDetailPage.inferGroupId();

        // Others join
        const shareLink = await deleterGroupDetailPage.getShareLink();

        const groupWatcherGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(groupWatcherPage, shareLink);
        await deleterGroupDetailPage.waitForPage(groupId, 2);
        await groupWatcherGroupDetailPage.waitForPage(groupId, 2);

        const dashWatcherGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(dashWatcherPage, shareLink);
        await deleterGroupDetailPage.waitForPage(groupId, 3);
        await groupWatcherGroupDetailPage.waitForPage(groupId, 3);
        await dashWatcherGroupDetailPage.waitForPage(groupId, 3);

        // Position watchers: GroupWatcher stays on group page, DashWatcher goes to dashboard
        await dashWatcherGroupDetailPage.navigateToDashboard();
        await dashWatcherDashboardPage.waitForGroupToAppear(groupName);

        // Create expense involving GroupWatcher ($50 split = $25 each)
        const expenseFormPage = await deleterGroupDetailPage.clickAddExpenseButton(3);
        const expenseDescription = `Delete Test ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(99)// 33 each when split equally
                .withCurrency('USD')
                .withPaidByDisplayName(deleterDisplayName)
                .withSplitType('equal')
                .withParticipants([deleterDisplayName, groupWatcherDisplayName, dashWatcherDisplayName])
                .build(),
        );

        await deleterGroupDetailPage.waitForExpense(expenseDescription);
        await groupWatcherGroupDetailPage.waitForExpense(expenseDescription);

        // Test the balances after expense creation
        // $99 split 3 ways = $33 each. Deleter paid $99, so others owe $33 each to deleter
        // GroupWatcher should owe $33 to Deleter
        await groupWatcherGroupDetailPage.verifyDebtRelationship(groupWatcherDisplayName, deleterDisplayName, '$33.00');
        await deleterGroupDetailPage.verifyDebtRelationship(groupWatcherDisplayName, deleterDisplayName, '$33.00');

        // DashWatcher should also owe $33 to Deleter (verify this shows up across all browsers)
        await groupWatcherGroupDetailPage.verifyDebtRelationship(dashWatcherDisplayName, deleterDisplayName, '$33.00');
        await deleterGroupDetailPage.verifyDebtRelationship(dashWatcherDisplayName, deleterDisplayName, '$33.00');

        // Deleter deletes the expense
        const expenseToDelete = deleterGroupDetailPage.getExpenseByDescription(expenseDescription);
        await expect(expenseToDelete).toBeVisible();

        // Click expense to go to detail page, then delete from there
        const expenseDetailPage = await deleterGroupDetailPage.clickExpenseToView(expenseDescription);
        await expenseDetailPage.deleteExpense();

        // Should redirect back to group page after deletion
        await expect(deleterPage).toHaveURL(groupDetailUrlPattern(groupId));

        // CRITICAL TESTS:

        // 1. GroupWatcher should see expense disappear WITHOUT refresh
        await expect(groupWatcherGroupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();

        // Test that the balances have changed after expense deletion
        // After deletion, all users should be settled up (no debts)
        // Verify "All settled up!" message appears for all users
        await deleterGroupDetailPage.waitForSettledUpMessage();
        await groupWatcherGroupDetailPage.waitForSettledUpMessage();

        // Double-check that specific debt relationships no longer exist
        await groupWatcherGroupDetailPage.assertSettledUp(groupWatcherDisplayName);
        await groupWatcherGroupDetailPage.assertSettledUp(dashWatcherDisplayName);
        await deleterGroupDetailPage.assertSettledUp(groupWatcherDisplayName);
        await deleterGroupDetailPage.assertSettledUp(dashWatcherDisplayName);

        // 2. DashWatcher should still see the group accessible after deletion
        await dashWatcherDashboardPage.waitForGroupToAppear(groupName);
    });
});

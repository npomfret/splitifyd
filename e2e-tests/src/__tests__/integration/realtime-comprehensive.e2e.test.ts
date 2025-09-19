import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';
import {expect, simpleTest} from '../../fixtures';
import {ExpenseDetailPage} from '../../pages';
import {randomString} from '@splitifyd/test-support';
import {v4 as uuidv4} from 'uuid';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {SettlementData} from '../../pages/settlement-form.page.ts';

/**
 * Comprehensive Real-Time Updates E2E Tests
 *
 * Consolidated from:
 * - group-realtime-updates.e2e.test.ts (group-level changes, transactions)
 * - realtime-edge-cases.e2e.test.ts (edge cases, stress tests)
 *
 * This file covers all essential real-time functionality while eliminating
 * duplication and reducing complexity from 4-user to 2-user scenarios where appropriate.
 */

simpleTest.describe('Real-Time Updates - Core Functionality', () => {
    simpleTest('should handle real-time group changes across users', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.setTimeout(45000); // 45 seconds

        // Create two browser instances - Owner and Member
        const [
            { dashboardPage: ownerDashboardPage },
            { page: memberPage, dashboardPage: memberDashboardPage }
        ] = await createLoggedInBrowsers(2);

        // Get display names for verification
        const ownerDisplayName = await ownerDashboardPage.header.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

        // Setup: Create group and join member

        const [ownerGroupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({}, memberDashboardPage);
        const originalGroupName = await ownerGroupDetailPage.getGroupName();

        // Member on dashboard to monitor group-level changes
        await memberGroupDetailPage.navigateToDashboard();
        await memberDashboardPage.waitForGroupToAppear(originalGroupName);

        // Test 1: Edit Group Name
        const newGroupName = `UPDATED name ${randomString(4)}`;
        const editModal = await ownerGroupDetailPage.openEditGroupModal();
        await editModal.editGroupName(newGroupName);
        await editModal.saveChanges();

        await ownerGroupDetailPage.waitForGroupTitle(newGroupName);
        await memberDashboardPage.waitForGroupToAppear(newGroupName);
        await memberDashboardPage.waitForGroupToNotBePresent(originalGroupName);

        // Test 2: Edit Group Description
        const newDescription = `UPDATED descrption ${randomString(4)}`;
        const editModal2 = await ownerGroupDetailPage.openEditGroupModal();
        await editModal2.editDescription(newDescription);
        await editModal2.saveChanges();

        await ownerGroupDetailPage.waitForGroupDescription(newDescription);
    });

    simpleTest('should handle real-time expense and settlement operations', async ({ createLoggedInBrowsers }, testInfo) => {
        // Create two browser instances - User1 and User2
        const [
            { page: user1Page, dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage },
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [user1GroupDetailPage, user2GroupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = user1GroupDetailPage.inferGroupId();

        // Test 1: Add Expense
        const expenseFormPage = await user1GroupDetailPage.clickAddExpenseButton(2);
        const expenseDescription = `Lunch ${randomString(4)}`;
        const expenseAmount = 60; // $30 each

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(expenseAmount)
                .withCurrency('USD')
                .withPaidByDisplayName(user1DisplayName)
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );

        await user1GroupDetailPage.waitForExpense(expenseDescription);
        await user2GroupDetailPage.waitForExpense(expenseDescription);

        // Verify debt relationship ($30 each, User2 owes User1 $30)
        await user1GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$30.00');
        await user2GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$30.00');

        // Test 2: Add Group Comment
        const commentText = `Group comment ${randomString(6)}`;
        await user1GroupDetailPage.addComment(commentText);
        await user2GroupDetailPage.waitForCommentToAppear(commentText);
        await expect(user2GroupDetailPage.getCommentByText(commentText)).toBeVisible();

        // Test 3: Add Settlement
        const settlementFormPage = await user2GroupDetailPage.clickSettleUpButton(2);
        const settlementNote = `Settlement ${randomString(4)}`;
        await settlementFormPage.submitSettlement(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
                amount: '20',
                note: settlementNote,
            } as SettlementData,
            2,
        );

        // Wait for settlement and verify balances
        await user1GroupDetailPage.waitForSettlementToAppear(settlementNote);
        await user2GroupDetailPage.waitForSettlementToAppear(settlementNote);

        // After $20 settlement, User2 owes User1 $10 ($30 - $20)
        await user1GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$10.00');
        await user2GroupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '$10.00');

        // Test 4: Delete Expense
        const expenseLocator = user1GroupDetailPage.getExpenseByDescription(expenseDescription);
        await expenseLocator.click();

        await expect(user1Page).toHaveURL(/\/groups\/[^\/]+\/expenses\/[^\/]+/);
        const expenseDetailPage = new ExpenseDetailPage(user1Page);
        await expenseDetailPage.deleteExpense();

        await expect(user1Page).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify expense is gone and balances reset
        await expect(user1GroupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();
        await expect(user2GroupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();

        await user1GroupDetailPage.waitForBalancesToLoad(groupId);
        await user2GroupDetailPage.waitForBalancesToLoad(groupId);
    });

    simpleTest('should support real-time expense comments', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Alice and Bob
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage },
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [user1GroupDetailPage, user2GroupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = user1GroupDetailPage.inferGroupId();

        // Create expense
        const expenseFormPage = await user1GroupDetailPage.clickAddExpenseButton(2);
        const expenseDescription = 'Test Expense for Comments';
        await expenseFormPage.submitExpense({
            description: expenseDescription,
            amount: 50.0,
            currency: 'USD',
            paidByDisplayName: user1DisplayName,
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await user1GroupDetailPage.waitForExpense(expenseDescription);
        await user2GroupDetailPage.waitForExpense(expenseDescription);

        // Navigate to expense detail pages
        const aliceExpenseDetailPage = await user1GroupDetailPage.clickExpenseToView(expenseDescription);
        const bobExpenseDetailPage = await user2GroupDetailPage.clickExpenseToView(expenseDescription);

        await aliceExpenseDetailPage.verifyCommentsSection();
        await bobExpenseDetailPage.verifyCommentsSection();

        // Test real-time comments
        const comment1 = `comment ${uuidv4()}`;
        await aliceExpenseDetailPage.addComment(comment1);
        await bobExpenseDetailPage.waitForCommentToAppear(comment1);

        const comment2 = `comment ${uuidv4()}`;
        await bobExpenseDetailPage.addComment(comment2);
        await aliceExpenseDetailPage.waitForCommentToAppear(comment2);

        // Verify both comments visible
        await aliceExpenseDetailPage.waitForCommentCount(2);
        await bobExpenseDetailPage.waitForCommentCount(2);

        await expect(aliceExpenseDetailPage.getCommentByText(comment1)).toBeVisible();
        await expect(aliceExpenseDetailPage.getCommentByText(comment2)).toBeVisible();
        await expect(bobExpenseDetailPage.getCommentByText(comment1)).toBeVisible();
        await expect(bobExpenseDetailPage.getCommentByText(comment2)).toBeVisible();
    });
});

simpleTest.describe('Real-Time Updates - Edge Cases & Stress Tests', () => {
    simpleTest('should handle user leaving during expense operations', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Edge case testing may generate expected transient errors and 404s' });

        // Create three users - Creator, LeavingUser, WatchingUser
        const [
            { dashboardPage: creatorDashboardPage, user: creator },
            { page: leavingPage, dashboardPage: leavingDashboardPage, user: leaving },
            { page: watchingPage, dashboardPage: watchingDashboardPage, user: watching }
        ] = await createLoggedInBrowsers(3);

        const creatorDisplayName = await creatorDashboardPage.header.getCurrentUserDisplayName();
        const leavingDisplayName = await leavingDashboardPage.header.getCurrentUserDisplayName();

        // Setup group
        const [creatorGroupDetailPage, leavingGroupDetailPage, watchingGroupDetailPage] = await creatorDashboardPage.createMultiUserGroup({}, leavingDashboardPage, watchingDashboardPage);
        const groupId = creatorGroupDetailPage.inferGroupId();

        // LeavingUser leaves
        const leaveModal = await leavingGroupDetailPage.clickLeaveGroup();
        await leaveModal.confirmLeaveGroup();

        // Wait for removal to propagate
        await creatorGroupDetailPage.waitForPage(groupId, 2);
        await watchingGroupDetailPage.waitForPage(groupId, 2);

        // Creator creates expense after user has left
        const expenseFormPage = await creatorGroupDetailPage.clickAddExpenseButton(2);
        const expenseDescription = `Edge Leave Test ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(60)
                .withCurrency('USD')
                .withPaidByDisplayName(creatorDisplayName)
                .withSplitType('equal')
                .withParticipants([creatorDisplayName])
                .build(),
        );

        // Verify expense appears for remaining users
        await creatorGroupDetailPage.waitForExpense(expenseDescription);
        await watchingGroupDetailPage.waitForExpense(expenseDescription);

        // Verify leaving user is on dashboard and removed from group
        await leavingDashboardPage.waitForDashboard();
        await creatorGroupDetailPage.verifyMemberNotVisible(leavingDisplayName);
        await watchingGroupDetailPage.verifyMemberNotVisible(leavingDisplayName);
    });

    simpleTest('should handle concurrent expense editing', async ({ createLoggedInBrowsers }) => {
        // Create two editors and one watcher
        const [
            { dashboardPage: editor1DashboardPage },
            { page: editor2Page, dashboardPage: editor2DashboardPage },
            { page: watcherPage, dashboardPage: watcherDashboardPage },
        ] = await createLoggedInBrowsers(3);

        const editor1DisplayName = await editor1DashboardPage.header.getCurrentUserDisplayName();
        const editor2DisplayName = await editor2DashboardPage.header.getCurrentUserDisplayName();

        const [editor1GroupDetailPage, editor2GroupDetailPage, watcherGroupDetailPage] = await editor1DashboardPage.createMultiUserGroup({}, editor2DashboardPage, watcherDashboardPage);
        const groupId = editor1GroupDetailPage.inferGroupId();

        // Create initial expense
        const expense1FormPage = await editor1GroupDetailPage.clickAddExpenseButton(3);
        const expense1Description = `Concurrent Test 1 ${randomString(4)}`;

        await expense1FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expense1Description)
                .withAmount(30) // $10 each
                .withCurrency('USD')
                .withPaidByDisplayName(editor1DisplayName)
                .withSplitType('equal')
                .withParticipants([editor1DisplayName, editor2DisplayName])
                .build(),
        );

        await editor1GroupDetailPage.waitForExpense(expense1Description);
        await editor2GroupDetailPage.waitForExpense(expense1Description);
        await watcherGroupDetailPage.waitForExpense(expense1Description);

        // Verify initial balances
        await editor1GroupDetailPage.verifyDebtRelationship(editor2DisplayName, editor1DisplayName, '$15.00');

        // Editor2 creates second expense concurrently
        const expense2FormPage = await editor2GroupDetailPage.clickAddExpenseButton(3);
        const expense2Description = `Concurrent Test 2 ${randomString(4)}`;

        await expense2FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expense2Description)
                .withAmount(45)
                .withCurrency('USD')
                .withPaidByDisplayName(editor2DisplayName)
                .withSplitType('equal')
                .withParticipants([editor1DisplayName, editor2DisplayName])
                .build(),
        );

        await editor1GroupDetailPage.waitForExpense(expense2Description);
        await editor2GroupDetailPage.waitForExpense(expense2Description);
        await watcherGroupDetailPage.waitForExpense(expense2Description);

        // Verify balanced state after both expenses
        await editor1GroupDetailPage.verifyDebtRelationship(editor1DisplayName, editor2DisplayName, '$7.50');

        // Editor1 edits first expense
        const expense1DetailPage = await editor1GroupDetailPage.clickExpenseToView(expense1Description);
        const edit1FormPage = await expense1DetailPage.clickEditExpenseButton(3);
        const expense1DescriptionEdited = `${expense1Description} edited`;
        await edit1FormPage.fillDescription(expense1DescriptionEdited);
        await edit1FormPage.fillAmount('60');
        await edit1FormPage.clickUpdateExpenseButton();
        await expense1DetailPage.clickBackButton();

        // Verify updated expense propagates
        await editor1GroupDetailPage.waitForExpense(expense1DescriptionEdited);
        await editor2GroupDetailPage.waitForExpense(expense1DescriptionEdited);
        await watcherGroupDetailPage.waitForExpense(expense1DescriptionEdited);

        // Verify updated balances
        await editor1GroupDetailPage.verifyDebtRelationship(editor2DisplayName, editor1DisplayName, '$7.50');
    });

    simpleTest('should handle network instability simulation', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Network simulation may generate expected connection errors' });

        // Create two users - ActiveUser and OfflineUser
        const [
            { dashboardPage: activeDashboardPage },
            { page: offlinePage, dashboardPage: offlineDashboardPage },
        ] = await createLoggedInBrowsers(2);

        const activeDisplayName = await activeDashboardPage.header.getCurrentUserDisplayName();

        // Setup group
        const [activeGroupDetailPage, offlineGroupDetailPage] = await activeDashboardPage.createMultiUserGroup({}, offlineDashboardPage);
        const groupId = activeGroupDetailPage.inferGroupId();

        // Simulate offline by navigating away
        await offlineGroupDetailPage.navigateToHomepage();

        // Create expense while "offline" user is disconnected
        const expenseFormPage = await activeGroupDetailPage.clickAddExpenseButton(2);
        const expenseDescription = `Network Test ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(60)
                .withCurrency('USD')
                .withPaidByDisplayName(activeDisplayName)
                .withSplitType('equal')
                .withParticipants([activeDisplayName])
                .build(),
        );

        await activeGroupDetailPage.waitForExpense(expenseDescription);

        // "Reconnect" by navigating back
        await offlineGroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(offlinePage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify offline user sees changes that happened while "offline"
        await offlineGroupDetailPage.waitForExpense(expenseDescription);

        // Test continued real-time after "reconnection"
        const expense2FormPage = await activeGroupDetailPage.clickAddExpenseButton(2);
        const afterReconnectDescription = `After Reconnect ${randomString(4)}`;
        await expense2FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(afterReconnectDescription)
                .withAmount(30)
                .withCurrency('USD')
                .withPaidByDisplayName(activeDisplayName)
                .withSplitType('equal')
                .withParticipants([activeDisplayName])
                .build(),
        );

        await activeGroupDetailPage.waitForExpense(afterReconnectDescription);
        await offlineGroupDetailPage.waitForExpense(afterReconnectDescription);
    });

    simpleTest('should allow third-party expense creation and editing', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Testing third-party expense creation and editing' });

        // Create three users - Creator (not involved), Payer, Receiver
        const [
            { dashboardPage: creatorDashboardPage },
            { page: payerPage, dashboardPage: payerDashboardPage },
            { page: receiverPage, dashboardPage: receiverDashboardPage }
        ] = await createLoggedInBrowsers(3);

        const payerDisplayName = await payerDashboardPage.header.getCurrentUserDisplayName();
        const receiverDisplayName = await receiverDashboardPage.header.getCurrentUserDisplayName();

        // Setup group
        const [creatorGroupDetailPage, payerGroupDetailPage, receiverGroupDetailPage] = await creatorDashboardPage.createMultiUserGroup({}, payerDashboardPage, receiverDashboardPage);
        const groupId = creatorGroupDetailPage.inferGroupId();

        // Creator creates expense for other users (creator not involved)
        const expenseFormPage = await creatorGroupDetailPage.clickAddExpenseButton(3);
        const expenseDescription = `Third Party Expense ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(80)
                .withCurrency('USD')
                .withPaidByDisplayName(payerDisplayName)
                .withSplitType('equal')
                .withParticipants([payerDisplayName, receiverDisplayName])
                .build(),
        );

        await creatorGroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(creatorGroupDetailPage.page).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify expense appears for all users
        await creatorGroupDetailPage.waitForExpense(expenseDescription);
        await payerGroupDetailPage.waitForExpense(expenseDescription);
        await receiverGroupDetailPage.waitForExpense(expenseDescription);

        // Verify debt relationship (Receiver owes $40 to Payer)
        await creatorGroupDetailPage.verifyDebtRelationship(receiverDisplayName, payerDisplayName, "$40");

        // Payer edits the expense
        const payerExpenseDetailPage = await payerGroupDetailPage.clickExpenseToView(expenseDescription);
        const payerEditFormPage = await payerExpenseDetailPage.clickEditExpenseButton(3);
        await payerEditFormPage.fillAmount('100');
        await payerEditFormPage.getUpdateExpenseButton().click();

        await payerGroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(payerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify updated amount propagates
        await payerGroupDetailPage.waitForExpense(expenseDescription);
        await receiverGroupDetailPage.waitForExpense(expenseDescription);
        await creatorGroupDetailPage.waitForExpense(expenseDescription);

        await expect(payerPage.getByText('$100.00').first()).toBeVisible();
        await expect(receiverPage.getByText('$100.00').first()).toBeVisible();
        await expect(creatorGroupDetailPage.getTextElement('$100.00').first()).toBeVisible();

        // Verify updated debt (Receiver now owes $50 to Payer)
        await creatorGroupDetailPage.verifyDebtRelationship(receiverDisplayName, payerDisplayName, "$50");
    });

    simpleTest('should handle expense deletion in real-time', async ({ createLoggedInBrowsers }) => {
        // Create two users - Deleter and Watcher
        const [
            { page: deleterPage, dashboardPage: deleterDashboardPage },
            { page: watcherPage, dashboardPage: watcherDashboardPage },
        ] = await createLoggedInBrowsers(2);

        const deleterDisplayName = await deleterDashboardPage.header.getCurrentUserDisplayName();
        const watcherDisplayName = await watcherDashboardPage.header.getCurrentUserDisplayName();

        // Setup group
        // Setup group
        const [deleterGroupDetailPage, watcherGroupDetailPage] = await deleterDashboardPage.createMultiUserGroup({}, watcherDashboardPage);
        const groupId = deleterGroupDetailPage.inferGroupId();

        // Create expense involving both users
        const expenseFormPage = await deleterGroupDetailPage.clickAddExpenseButton(2);
        const expenseDescription = `Delete Test ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(60) // $30 each
                .withCurrency('USD')
                .withPaidByDisplayName(deleterDisplayName)
                .withSplitType('equal')
                .withParticipants([deleterDisplayName, watcherDisplayName])
                .build(),
        );

        await deleterGroupDetailPage.waitForExpense(expenseDescription);
        await watcherGroupDetailPage.waitForExpense(expenseDescription);

        // Verify initial debt
        await watcherGroupDetailPage.verifyDebtRelationship(watcherDisplayName, deleterDisplayName, '$30.00');
        await deleterGroupDetailPage.verifyDebtRelationship(watcherDisplayName, deleterDisplayName, '$30.00');

        // Delete the expense
        const expenseToDelete = deleterGroupDetailPage.getExpenseByDescription(expenseDescription);
        await expect(expenseToDelete).toBeVisible();

        const expenseDetailPage = await deleterGroupDetailPage.clickExpenseToView(expenseDescription);
        await expenseDetailPage.deleteExpense();

        await expect(deleterPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify expense disappears for both users WITHOUT refresh
        await expect(watcherGroupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();

        // Verify balances reset to settled up
        await deleterGroupDetailPage.waitForSettledUpMessage();
        await watcherGroupDetailPage.waitForSettledUpMessage();

        await watcherGroupDetailPage.assertSettledUp(watcherDisplayName);
        await deleterGroupDetailPage.assertSettledUp(watcherDisplayName);
    });
});
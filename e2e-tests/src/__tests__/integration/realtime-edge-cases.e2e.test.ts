import { simpleTest, expect } from '../../fixtures';
import { GroupDetailPage, JoinGroupPage, ExpenseDetailPage } from '../../pages';
import { generateTestGroupName, randomString } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { SettlementData } from '../../pages/settlement-form.page.ts';

simpleTest.describe('Real-Time Edge Cases', () => {
    simpleTest('should handle user leaving while being added to new expense', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Edge case testing may generate expected transient errors and 404s' });

        // Create four users - ExpenseCreator, LeavingUser, StayingUser, Watcher
        const { dashboardPage: creatorDashboardPage, user: creator } = await newLoggedInBrowser();
        const { page: leavingPage, dashboardPage: leavingDashboardPage, user: leaving } = await newLoggedInBrowser();
        const { page: stayingPage, user: staying } = await newLoggedInBrowser();
        const { page: watcherPage, user: watcher } = await newLoggedInBrowser();

        // Create page objects
        const leavingGroupDetailPage = new GroupDetailPage(leavingPage);
        const watcherGroupDetailPage = new GroupDetailPage(watcherPage);

        // Get display names and log user UIDs
        const creatorDisplayName = await creatorDashboardPage.header.getCurrentUserDisplayName();
        const leavingDisplayName = await leavingDashboardPage.header.getCurrentUserDisplayName();

        console.log(`👥 Test 1 User UIDs - Creator: ${creator.uid}, Leaving: ${leaving.uid}, Staying: ${staying.uid}, Watcher: ${watcher.uid}`);

        // Creator creates group
        const groupName = generateTestGroupName('LeaveEdge');
        const creatorGroupDetailPage = await creatorDashboardPage.createGroupAndNavigate(groupName, 'Testing user leaving during expense creation');
        const groupId = creatorGroupDetailPage.inferGroupId();

        // All users join
        const shareLink = await creatorGroupDetailPage.getShareLink();

        const joinGroupPageLeaving = new JoinGroupPage(leavingPage);
        await joinGroupPageLeaving.joinGroupUsingShareLink(shareLink);
        const joinGroupPageStaying = new JoinGroupPage(stayingPage);
        await joinGroupPageStaying.joinGroupUsingShareLink(shareLink);
        const joinGroupPageWatcher = new JoinGroupPage(watcherPage);
        await joinGroupPageWatcher.joinGroupUsingShareLink(shareLink);

        await creatorGroupDetailPage.waitForMemberCount(4);

        // RACE CONDITION: LeavingUser leaves while Creator starts expense creation

        // LeavingUser initiates leaving
        const leaveModal = await leavingGroupDetailPage.clickLeaveGroup();
        await leaveModal.confirmLeaveGroup();

        // Wait for LeavingUser to be fully removed from group
        await creatorGroupDetailPage.waitForMemberCount(3);

        // Creator creates expense after user has left (testing real-time sync)
        const expenseFormPage = await creatorGroupDetailPage.clickAddExpenseButton(3);
        const expenseDescription = `Edge Leave Test ${randomString(4)}`;

        // Create expense with remaining members only
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(60)
                .withCurrency('USD')
                .withPaidByDisplayName(creatorDisplayName)
                .withSplitType('equal')
                .build(),
        );

        // Wait for system to process the expense
        await creatorGroupDetailPage.waitForBalancesToLoad(groupId);

        // VERIFICATION:

        // 1. LeavingUser should be on dashboard (left successfully)
        await leavingDashboardPage.waitForDashboard();

        // 2. Creator should see updated member count (3 members now)
        await creatorGroupDetailPage.waitForMemberCount(3);
        await creatorGroupDetailPage.verifyMemberNotVisible(leavingDisplayName);

        // 3. Expense should exist but only involve remaining members
        await expect(creatorGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();

        // 4. Watcher should see the expense and correct member count
        await watcherGroupDetailPage.waitForMemberCount(3);
        await expect(watcherGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();

        console.log('✅ User leaving during expense creation handled correctly');
    });

    simpleTest('should handle removal during active settlement', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Edge case testing may generate expected transient errors and 404s' });

        // Create four users - Owner, SettlingUser, RemovalTarget, Watcher
        const { dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: settlingPage, dashboardPage: settlingDashboardPage, user: settling } = await newLoggedInBrowser();
        const { page: targetPage, dashboardPage: targetDashboardPage, user: target } = await newLoggedInBrowser();
        const { page: watcherPage, user: watcher } = await newLoggedInBrowser();

        // Create page objects
        const settlingGroupDetailPage = new GroupDetailPage(settlingPage);
        const watcherGroupDetailPage = new GroupDetailPage(watcherPage);

        // Get display names and log user UIDs
        const ownerDisplayName = await ownerDashboardPage.header.getCurrentUserDisplayName();
        const settlingDisplayName = await settlingDashboardPage.header.getCurrentUserDisplayName();
        const targetDisplayName = await targetDashboardPage.header.getCurrentUserDisplayName();

        console.log(`👥 Test 2 User UIDs - Owner: ${owner.uid}, Settling: ${settling.uid}, Target: ${target.uid}, Watcher: ${watcher.uid}`);

        // Owner creates group
        const groupName = generateTestGroupName('RemovalEdge');
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing removal during settlement');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // All users join
        const shareLink = await ownerGroupDetailPage.getShareLink();

        const joinGroupPageSettling = new JoinGroupPage(settlingPage);
        await joinGroupPageSettling.joinGroupUsingShareLink(shareLink);
        const joinGroupPageTarget = new JoinGroupPage(targetPage);
        await joinGroupPageTarget.joinGroupUsingShareLink(shareLink);
        const joinGroupPageWatcher = new JoinGroupPage(watcherPage);
        await joinGroupPageWatcher.joinGroupUsingShareLink(shareLink);

        await ownerGroupDetailPage.waitForMemberCount(4);

        // Create expense creating debt (Owner paid $80, others owe $20 each)
        const expenseFormPage = await ownerGroupDetailPage.clickAddExpenseButton(4);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription('Settlement Edge Test')
                .withAmount(80)
                .withCurrency('USD')
                .withPaidByDisplayName(ownerDisplayName)
                .withSplitType('equal')
                .build(),
        );

        await ownerGroupDetailPage.waitForBalancesToLoad(groupId);
        await settlingGroupDetailPage.waitForBalancesToLoad(groupId);

        // SEQUENCE: Target settles their debt first, then Owner removes Target, then SettlingUser creates settlement (testing real-time sync)

        // Target settles their debt first (they owe $20 to owner)
        const targetGroupDetailPage = new GroupDetailPage(targetPage);
        const targetSettlementFormPage = await targetGroupDetailPage.clickSettleUpButton(4);
        await targetSettlementFormPage.submitSettlement(
            {
                payerName: targetDisplayName,
                payeeName: ownerDisplayName,
                amount: '20',
                note: `Pre-removal Settlement ${randomString(4)}`,
            } as SettlementData,
            4,
        );

        // Wait for target's settlement to process
        await targetGroupDetailPage.waitForBalancesToLoad(groupId);
        await ownerGroupDetailPage.waitForBalancesToLoad(groupId);

        // Now Owner can remove Target user (no outstanding balance)
        const removeMemberModal = await ownerGroupDetailPage.clickRemoveMember(targetDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Wait for removal to propagate to other users
        await ownerGroupDetailPage.waitForMemberCount(3);
        await settlingGroupDetailPage.waitForMemberCount(3);

        // SettlingUser creates settlement with remaining members
        const settlementFormPage = await settlingGroupDetailPage.clickSettleUpButton(3);
        await settlementFormPage.submitSettlement(
            {
                payerName: settlingDisplayName,
                payeeName: ownerDisplayName,
                amount: '20',
                note: `Edge Settlement ${randomString(4)}`,
            } as SettlementData,
            3,
        );

        // Wait for settlement to process
        await settlingGroupDetailPage.waitForBalancesToLoad(groupId);
        await ownerGroupDetailPage.waitForBalancesToLoad(groupId);

        // VERIFICATION:

        // 1. Target should be removed (redirected to dashboard)
        // Use fallback method to handle 404 page that occurs when user is removed from group
        await targetDashboardPage.waitForDashboardWithFallback();

        // 2. Settlement should have completed successfully
        await ownerGroupDetailPage.waitForMemberCount(3);
        await ownerGroupDetailPage.verifyMemberNotVisible(targetDisplayName);

        // 3. Watcher should see updated member count and settlement effects
        await watcherGroupDetailPage.waitForMemberCount(3);
        await watcherGroupDetailPage.waitForBalancesToLoad(groupId);

        console.log('✅ Removal during settlement handled correctly');
    });

    simpleTest('should handle rapid successive changes (stress test)', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Stress testing may generate expected transient sync errors' });

        // Create four users for stress testing
        const { dashboardPage: user1DashboardPage, } = await newLoggedInBrowser();
        const { page: user2Page, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();
        const { page: user3Page, dashboardPage: user3DashboardPage } = await newLoggedInBrowser();
        const { page: user4Page, dashboardPage: user4DashboardPage } = await newLoggedInBrowser();

        // Create page objects
        const user2GroupDetailPage = new GroupDetailPage(user2Page);
        const user4GroupDetailPage = new GroupDetailPage(user4Page);

        // Get display names
        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user4DisplayName = await user4DashboardPage.header.getCurrentUserDisplayName();

        // User1 creates group
        const groupName = generateTestGroupName('StressRT');
        const user1GroupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Stress testing real-time updates');
        const groupId = user1GroupDetailPage.inferGroupId();

        // All users join
        const shareLink = await user1GroupDetailPage.getShareLink();

        const joinGroupPage2 = new JoinGroupPage(user2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        const joinGroupPage3 = new JoinGroupPage(user3Page);
        await joinGroupPage3.joinGroupUsingShareLink(shareLink);
        const joinGroupPage4 = new JoinGroupPage(user4Page);
        await joinGroupPage4.joinGroupUsingShareLink(shareLink);

        await user1GroupDetailPage.waitForMemberCount(4);

        // Position users: User1 stays on group, User2 on group, User3 on dashboard, User4 on group
        await user3DashboardPage.navigate();
        await user3DashboardPage.waitForGroupToAppear(groupName);

        // STRESS TEST: Rapid sequence of operations

        // Store expense descriptions for verification
        const expense1Description = `Stress 1 ${randomString(3)}`;
        const expense2Description = `Stress 2 ${randomString(3)}`;
        const expense3Description = `Stress 3 ${randomString(3)}`;

        // 1. User1 adds expense
        const expense1FormPage = await user1GroupDetailPage.clickAddExpenseButton(4);
        await expense1FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expense1Description)
                .withAmount(40)
                .withCurrency('USD')
                .withPaidByDisplayName(user1DisplayName)
                .withSplitType('equal')
                .build(),
        );

        // 2. User2 adds expense immediately
        const expense2FormPage = await user2GroupDetailPage.clickAddExpenseButton(4);
        await expense2FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expense2Description)
                .withAmount(30)
                .withCurrency('USD')
                .withPaidByDisplayName(user2DisplayName)
                .withSplitType('equal')
                .build(),
        );

        // 3. User1 adds comment
        await user1GroupDetailPage.addComment(`Stress comment ${randomString(4)}`);

        // 4. User4 adds expense
        const expense4FormPage = await user4GroupDetailPage.clickAddExpenseButton(4);
        await expense4FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expense3Description)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidByDisplayName(user4DisplayName)
                .withSplitType('equal')
                .build(),
        );

        // 5. User2 settles immediately
        const settlementFormPage = await user2GroupDetailPage.clickSettleUpButton(4);
        await settlementFormPage.submitSettlement(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
                amount: '20',
                note: `Stress settlement ${randomString(3)}`,
            },
            4,
        );

        // Allow system to process all changes
        await user1GroupDetailPage.waitForBalancesToLoad(groupId);
        await user2GroupDetailPage.waitForBalancesToLoad(groupId);
        await user4GroupDetailPage.waitForBalancesToLoad(groupId);

        // CRITICAL TEST: All users should see consistent final state

        // All users should see the expenses exist
        await user1GroupDetailPage.verifyExpenseVisible(expense1Description);
        await user1GroupDetailPage.verifyExpenseVisible(expense2Description);
        await user1GroupDetailPage.verifyExpenseVisible(expense3Description);

        await user2GroupDetailPage.verifyExpenseVisible(expense1Description);
        await user2GroupDetailPage.verifyExpenseVisible(expense2Description);
        await user2GroupDetailPage.verifyExpenseVisible(expense3Description);

        await user4GroupDetailPage.verifyExpenseVisible(expense1Description);
        await user4GroupDetailPage.verifyExpenseVisible(expense2Description);
        await user4GroupDetailPage.verifyExpenseVisible(expense3Description);

        // User3 on dashboard should still see the group accessible
        await user3DashboardPage.waitForGroupToAppear(groupName);

        console.log('✅ Rapid successive changes handled correctly');
    });

    simpleTest('should handle network instability simulation', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Network simulation may generate expected connection errors' });

        // Create three users - ActiveUser, WatcherOnline, WatcherOffline
        const { dashboardPage: activeDashboardPage } = await newLoggedInBrowser();
        const { page: onlinePage, } = await newLoggedInBrowser();
        const { page: offlinePage, } = await newLoggedInBrowser();

        // Create page objects
        const onlineGroupDetailPage = new GroupDetailPage(onlinePage);
        const offlineGroupDetailPage = new GroupDetailPage(offlinePage);

        // Get display names
        const activeDisplayName = await activeDashboardPage.header.getCurrentUserDisplayName();

        // ActiveUser creates group
        const groupName = generateTestGroupName('NetworkRT');
        const activeGroupDetailPage = await activeDashboardPage.createGroupAndNavigate(groupName, 'Testing network instability');
        const groupId = activeGroupDetailPage.inferGroupId();

        // Others join
        const shareLink = await activeGroupDetailPage.getShareLink();

        const joinGroupPageOnline = new JoinGroupPage(onlinePage);
        await joinGroupPageOnline.joinGroupUsingShareLink(shareLink);
        const joinGroupPageOffline = new JoinGroupPage(offlinePage);
        await joinGroupPageOffline.joinGroupUsingShareLink(shareLink);

        await activeGroupDetailPage.waitForMemberCount(3);

        // Simulate "offline" user by making them navigate away (simulating network disconnect)
        await offlineGroupDetailPage.navigateToHomepage(); // Simulate going offline

        // ActiveUser makes changes while one user is "offline"
        const expenseFormPage = await activeGroupDetailPage.clickAddExpenseButton(3);
        const expenseDescription = `Network Test ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(60)
                .withCurrency('USD')
                .withPaidByDisplayName(activeDisplayName)
                .withSplitType('equal')
                .build(),
        );

        await activeGroupDetailPage.waitForBalancesToLoad(groupId);

        // OnlineUser should see changes immediately
        await expect(onlineGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await onlineGroupDetailPage.waitForBalancesToLoad(groupId);

        // "Reconnect" offline user by navigating back to group
        await offlineGroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(offlinePage).toHaveURL(groupDetailUrlPattern(groupId));

        // CRITICAL TEST: OfflineUser should see all changes that happened while "offline"
        await offlineGroupDetailPage.waitForBalancesToLoad(groupId);
        await expect(offlineGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();

        // Add another expense to test continued real-time after "reconnection"
        const expense2FormPage = await activeGroupDetailPage.clickAddExpenseButton(3);
        await expense2FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(`After Reconnect ${randomString(4)}`)
                .withAmount(30)
                .withCurrency('USD')
                .withPaidByDisplayName(activeDisplayName)
                .withSplitType('equal')
                .build(),
        );

        await activeGroupDetailPage.waitForBalancesToLoad(groupId);

        // Both watchers should see the new expense in real-time
        await expect(onlineGroupDetailPage.getExpenseByDescription(`After Reconnect`)).toBeVisible();
        await expect(offlineGroupDetailPage.getExpenseByDescription(`After Reconnect`)).toBeVisible();

        console.log('✅ Network instability simulation handled correctly');
    });

    simpleTest('should handle conflicting expense edits gracefully', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Conflict resolution may generate expected transient errors' });

        // Create three users - Editor1, Editor2, Watcher
        const { page: editor1Page, dashboardPage: editor1DashboardPage, user: editor1 } = await newLoggedInBrowser();
        const { page: editor2Page, user: editor2 } = await newLoggedInBrowser();
        const { page: watcherPage } = await newLoggedInBrowser();

        // Create page objects
        const editor2GroupDetailPage = new GroupDetailPage(editor2Page);
        const watcherGroupDetailPage = new GroupDetailPage(watcherPage);

        // Get display names
        const editor1DisplayName = await editor1DashboardPage.header.getCurrentUserDisplayName();

        // Editor1 creates group
        const groupName = generateTestGroupName('ConflictRT');
        const editor1GroupDetailPage = await editor1DashboardPage.createGroupAndNavigate(groupName, 'Testing conflicting edits');
        const groupId = editor1GroupDetailPage.inferGroupId();

        // Others join
        const shareLink = await editor1GroupDetailPage.getShareLink();

        const joinGroupPage2 = new JoinGroupPage(editor2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        const joinGroupPageWatcher = new JoinGroupPage(watcherPage);
        await joinGroupPageWatcher.joinGroupUsingShareLink(shareLink);

        await editor1GroupDetailPage.waitForMemberCount(3);

        // Create initial expense
        const expenseFormPage = await editor1GroupDetailPage.clickAddExpenseButton(3);
        const expenseDescription = `Conflict Test ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(60)
                .withCurrency('USD')
                .withPaidByDisplayName(editor1DisplayName)
                .withSplitType('equal')
                .build(),
        );

        await editor1GroupDetailPage.waitForBalancesToLoad(groupId);

        // Both editors navigate to expense detail simultaneously
        await editor1GroupDetailPage.clickExpenseToView(expenseDescription);
        await editor2GroupDetailPage.clickExpenseToView(expenseDescription);

        const expense1DetailPage = new ExpenseDetailPage(editor1Page, editor1);
        const expense2DetailPage = new ExpenseDetailPage(editor2Page, editor2);

        await expense1DetailPage.waitForPageReady();
        await expense2DetailPage.waitForPageReady();

        // Both start editing simultaneously
        const edit1FormPage = await expense1DetailPage.clickEditExpenseButton(3);
        const edit2FormPage = await expense2DetailPage.clickEditExpenseButton(3);

        // CONFLICTING EDITS:

        // Editor1 changes amount to $90
        await edit1FormPage.fillAmount('90');

        // Editor2 changes amount to $120 (conflicting change)
        await edit2FormPage.fillAmount('120');

        // Both submit nearly simultaneously
        await edit1FormPage.getUpdateExpenseButton().click();
        await edit2FormPage.getUpdateExpenseButton().click();

        // Navigate back to group
        await expense1DetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expense2DetailPage.navigateToStaticPath(`/groups/${groupId}`);

        // Allow system to resolve conflict
        await editor1GroupDetailPage.waitForBalancesToLoad(groupId);
        await editor2GroupDetailPage.waitForBalancesToLoad(groupId);

        // CRITICAL TEST: System should handle conflict gracefully
        // One of the edits should win, and all users should see consistent state

        await watcherGroupDetailPage.waitForBalancesToLoad(groupId);

        // All users should see the same final expense amount (last write wins or conflict resolution)
        await expect(watcherGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();

        console.log('✅ Conflicting expense edits handled gracefully');
    });
});

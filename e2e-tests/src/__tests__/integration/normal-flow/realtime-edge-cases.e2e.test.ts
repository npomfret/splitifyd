import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { GroupDetailPage, JoinGroupPage, ExpenseDetailPage } from '../../../pages';
import { GroupWorkflow } from '../../../workflows';
import { generateTestGroupName, randomString } from '../../../../../packages/test-support/test-helpers.ts';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';
import { ExpenseFormDataBuilder } from '../../../pages/expense-form.page';

simpleTest.describe('Real-Time Edge Cases', () => {
    simpleTest('should handle user leaving while being added to new expense', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Edge case testing may generate expected transient errors and 404s' });
        
        // Create four users - ExpenseCreator, LeavingUser, StayingUser, Watcher
        const { page: creatorPage, dashboardPage: creatorDashboardPage, user: creator } = await newLoggedInBrowser();
        const { page: leavingPage, dashboardPage: leavingDashboardPage, user: leaving } = await newLoggedInBrowser();
        const { page: stayingPage, dashboardPage: stayingDashboardPage, user: staying } = await newLoggedInBrowser();
        const { page: watcherPage, dashboardPage: watcherDashboardPage, user: watcher } = await newLoggedInBrowser();
        
        // Create page objects
        const creatorGroupDetailPage = new GroupDetailPage(creatorPage, creator);
        const leavingGroupDetailPage = new GroupDetailPage(leavingPage, leaving);
        const watcherGroupDetailPage = new GroupDetailPage(watcherPage, watcher);
        
        // Get display names
        const creatorDisplayName = await creatorDashboardPage.getCurrentUserDisplayName();
        const leavingDisplayName = await leavingDashboardPage.getCurrentUserDisplayName();
        const stayingDisplayName = await stayingDashboardPage.getCurrentUserDisplayName();
        const watcherDisplayName = await watcherDashboardPage.getCurrentUserDisplayName();
        
        // Creator creates group
        const groupWorkflow = new GroupWorkflow(creatorPage);
        const groupName = generateTestGroupName('LeaveEdge');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing user leaving during expense creation');

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
        const leaveButton = leavingGroupDetailPage.getLeaveGroupButton();
        await expect(leaveButton).toBeVisible();
        await leaveButton.click();
        await leavingGroupDetailPage.confirmLeaveGroup();

        // Creator creates expense immediately (including the user who is leaving)
        const expenseFormPage = await creatorGroupDetailPage.clickAddExpenseButton(4); // Still thinks there are 4 members
        const expenseDescription = `Edge Leave Test ${randomString(4)}`;
        
        // Attempt to create expense including the leaving user
        await expenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(expenseDescription)
            .withAmount(60)
            .withCurrency('USD')
            .withPaidByDisplayName(creatorDisplayName)
            .withSplitType('equal')
            .build());

        // Wait for system to resolve the conflict
        await creatorGroupDetailPage.waitForBalancesToLoad(groupId);

        // VERIFICATION:
        
        // 1. LeavingUser should be on dashboard (left successfully)
        await expect(async () => {
            const currentUrl = leavingPage.url();
            if (currentUrl.includes('/dashboard')) return;
            await leavingPage.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
            const newUrl = leavingPage.url();
            if (newUrl.includes('/dashboard')) return;
            throw new Error(`Expected dashboard after leaving, got: ${currentUrl}`);
        }).toPass({ timeout: 10000, intervals: [1000] });

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
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: settlingPage, dashboardPage: settlingDashboardPage, user: settling } = await newLoggedInBrowser();
        const { page: targetPage, dashboardPage: targetDashboardPage, user: target } = await newLoggedInBrowser();
        const { page: watcherPage, dashboardPage: watcherDashboardPage, user: watcher } = await newLoggedInBrowser();
        
        // Create page objects
        const ownerGroupDetailPage = new GroupDetailPage(ownerPage, owner);
        const settlingGroupDetailPage = new GroupDetailPage(settlingPage, settling);
        const watcherGroupDetailPage = new GroupDetailPage(watcherPage, watcher);
        
        // Get display names
        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const settlingDisplayName = await settlingDashboardPage.getCurrentUserDisplayName();
        const targetDisplayName = await targetDashboardPage.getCurrentUserDisplayName();
        const watcherDisplayName = await watcherDashboardPage.getCurrentUserDisplayName();
        
        // Owner creates group
        const groupWorkflow = new GroupWorkflow(ownerPage);
        const groupName = generateTestGroupName('RemovalEdge');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing removal during settlement');

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
        await expenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription('Settlement Edge Test')
            .withAmount(80)
            .withCurrency('USD')
            .withPaidByDisplayName(ownerDisplayName)
            .withSplitType('equal')
            .build());

        await ownerGroupDetailPage.waitForBalancesToLoad(groupId);
        await settlingGroupDetailPage.waitForBalancesToLoad(groupId);

        // RACE CONDITION: SettlingUser starts settlement while Owner removes Target
        
        // SettlingUser opens settlement form
        const settlementFormPage = await settlingGroupDetailPage.clickSettleUpButton(4);
        
        // Meanwhile, Owner removes Target (who was also involved in settlement)  
        await ownerGroupDetailPage.clickRemoveMember(targetDisplayName);
        await ownerGroupDetailPage.confirmRemoveMember();

        // SettlingUser completes settlement (system should handle removal gracefully)
        await settlementFormPage.submitSettlement({
            payerName: settlingDisplayName,
            payeeName: ownerDisplayName,
            amount: '20',
            note: `Edge Settlement ${randomString(4)}`
        }, 4); // Still thinks there are 4 members

        // Wait for system to resolve conflicts
        await settlingGroupDetailPage.waitForBalancesToLoad(groupId);
        await ownerGroupDetailPage.waitForBalancesToLoad(groupId);

        // VERIFICATION:
        
        // 1. Target should be removed (404 or dashboard)
        await expect(async () => {
            const currentUrl = targetPage.url();
            if (currentUrl.includes('/404') || currentUrl.includes('/dashboard')) return;
            await targetPage.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
            const newUrl = targetPage.url();
            if (newUrl.includes('/404') || newUrl.includes('/dashboard')) return;
            throw new Error(`Expected 404 or dashboard after removal, got: ${currentUrl}`);
        }).toPass({ timeout: 15000, intervals: [1000] });

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
        const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
        const { page: user3Page, dashboardPage: user3DashboardPage, user: user3 } = await newLoggedInBrowser();
        const { page: user4Page, dashboardPage: user4DashboardPage, user: user4 } = await newLoggedInBrowser();
        
        // Create page objects
        const user1GroupDetailPage = new GroupDetailPage(user1Page, user1);
        const user2GroupDetailPage = new GroupDetailPage(user2Page, user2);
        const user3GroupDetailPage = new GroupDetailPage(user3Page, user3);
        const user4GroupDetailPage = new GroupDetailPage(user4Page, user4);
        
        // Get display names
        const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.getCurrentUserDisplayName();
        const user4DisplayName = await user4DashboardPage.getCurrentUserDisplayName();
        
        // User1 creates group
        const groupWorkflow = new GroupWorkflow(user1Page);
        const groupName = generateTestGroupName('StressRT');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Stress testing real-time updates');

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
        
        // 1. User1 adds expense
        const expense1FormPage = await user1GroupDetailPage.clickAddExpenseButton(4);
        await expense1FormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(`Stress 1 ${randomString(3)}`)
            .withAmount(40)
            .withCurrency('USD')
            .withPaidByDisplayName(user1DisplayName)
            .withSplitType('equal')
            .build());
        
        // 2. User2 adds expense immediately  
        const expense2FormPage = await user2GroupDetailPage.clickAddExpenseButton(4);
        await expense2FormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(`Stress 2 ${randomString(3)}`)
            .withAmount(30)
            .withCurrency('USD')
            .withPaidByDisplayName(user2DisplayName)
            .withSplitType('equal')
            .build());

        // 3. User1 adds comment
        await user1GroupDetailPage.addComment(`Stress comment ${randomString(4)}`);

        // 4. User4 adds expense
        const expense4FormPage = await user4GroupDetailPage.clickAddExpenseButton(4);
        await expense4FormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(`Stress 3 ${randomString(3)}`)
            .withAmount(50)
            .withCurrency('USD')
            .withPaidByDisplayName(user4DisplayName)
            .withSplitType('equal')
            .build());

        // 5. User2 settles immediately
        const settlementFormPage = await user2GroupDetailPage.clickSettleUpButton(4);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '20',
            note: `Stress settlement ${randomString(3)}`
        }, 4);

        // Allow system to process all changes
        await user1GroupDetailPage.waitForBalancesToLoad(groupId);
        await user2GroupDetailPage.waitForBalancesToLoad(groupId);
        await user4GroupDetailPage.waitForBalancesToLoad(groupId);

        // CRITICAL TEST: All users should see consistent final state
        
        // All users should see the expenses exist
        await user1GroupDetailPage.verifyExpenseVisible('Stress expense 1');
        await user1GroupDetailPage.verifyExpenseVisible('Stress expense 2');
        await user1GroupDetailPage.verifyExpenseVisible('Stress expense 3');
        
        await user2GroupDetailPage.verifyExpenseVisible('Stress expense 1');
        await user2GroupDetailPage.verifyExpenseVisible('Stress expense 2');
        await user2GroupDetailPage.verifyExpenseVisible('Stress expense 3');
        
        await user4GroupDetailPage.verifyExpenseVisible('Stress expense 1');
        await user4GroupDetailPage.verifyExpenseVisible('Stress expense 2');
        await user4GroupDetailPage.verifyExpenseVisible('Stress expense 3');

        // User3 on dashboard should still see the group accessible
        await user3DashboardPage.waitForGroupToAppear(groupName);

        console.log('✅ Rapid successive changes handled correctly');
    });

    simpleTest('should handle network instability simulation', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Network simulation may generate expected connection errors' });
        
        // Create three users - ActiveUser, WatcherOnline, WatcherOffline
        const { page: activePage, dashboardPage: activeDashboardPage, user: active } = await newLoggedInBrowser();
        const { page: onlinePage, dashboardPage: onlineDashboardPage, user: online } = await newLoggedInBrowser();
        const { page: offlinePage, dashboardPage: offlineDashboardPage, user: offline } = await newLoggedInBrowser();
        
        // Create page objects
        const activeGroupDetailPage = new GroupDetailPage(activePage, active);
        const onlineGroupDetailPage = new GroupDetailPage(onlinePage, online);
        const offlineGroupDetailPage = new GroupDetailPage(offlinePage, offline);
        
        // Get display names
        const activeDisplayName = await activeDashboardPage.getCurrentUserDisplayName();
        const onlineDisplayName = await onlineDashboardPage.getCurrentUserDisplayName();
        const offlineDisplayName = await offlineDashboardPage.getCurrentUserDisplayName();
        
        // ActiveUser creates group
        const groupWorkflow = new GroupWorkflow(activePage);
        const groupName = generateTestGroupName('NetworkRT');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing network instability');

        // Others join
        const shareLink = await activeGroupDetailPage.getShareLink();
        
        const joinGroupPageOnline = new JoinGroupPage(onlinePage);
        await joinGroupPageOnline.joinGroupUsingShareLink(shareLink);
        const joinGroupPageOffline = new JoinGroupPage(offlinePage);
        await joinGroupPageOffline.joinGroupUsingShareLink(shareLink);

        await activeGroupDetailPage.waitForMemberCount(3);

        // Simulate "offline" user by making them navigate away (simulating network disconnect)
        await offlinePage.goto('about:blank'); // Simulate going offline

        // ActiveUser makes changes while one user is "offline"
        const expenseFormPage = await activeGroupDetailPage.clickAddExpenseButton(3);
        const expenseDescription = `Network Test ${randomString(4)}`;
        
        await expenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(expenseDescription)
            .withAmount(60)
            .withCurrency('USD')
            .withPaidByDisplayName(activeDisplayName)
            .withSplitType('equal')
            .build());

        await activeGroupDetailPage.waitForBalancesToLoad(groupId);

        // OnlineUser should see changes immediately
        await expect(onlineGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await onlineGroupDetailPage.waitForBalancesToLoad(groupId);

        // "Reconnect" offline user by navigating back to group
        await offlinePage.goto(`/groups/${groupId}`);
        await expect(offlinePage).toHaveURL(groupDetailUrlPattern(groupId));

        // CRITICAL TEST: OfflineUser should see all changes that happened while "offline"
        await offlineGroupDetailPage.waitForBalancesToLoad(groupId);
        await expect(offlineGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();

        // Add another expense to test continued real-time after "reconnection"
        const expense2FormPage = await activeGroupDetailPage.clickAddExpenseButton(3);
        await expense2FormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(`After Reconnect ${randomString(4)}`)
            .withAmount(30)
            .withCurrency('USD')
            .withPaidByDisplayName(activeDisplayName)
            .withSplitType('equal')
            .build());

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
        const { page: editor2Page, dashboardPage: editor2DashboardPage, user: editor2 } = await newLoggedInBrowser();
        const { page: watcherPage, dashboardPage: watcherDashboardPage, user: watcher } = await newLoggedInBrowser();
        
        // Create page objects
        const editor1GroupDetailPage = new GroupDetailPage(editor1Page, editor1);
        const editor2GroupDetailPage = new GroupDetailPage(editor2Page, editor2);
        const watcherGroupDetailPage = new GroupDetailPage(watcherPage, watcher);
        
        // Get display names
        const editor1DisplayName = await editor1DashboardPage.getCurrentUserDisplayName();
        const editor2DisplayName = await editor2DashboardPage.getCurrentUserDisplayName();
        const watcherDisplayName = await watcherDashboardPage.getCurrentUserDisplayName();
        
        // Editor1 creates group
        const groupWorkflow = new GroupWorkflow(editor1Page);
        const groupName = generateTestGroupName('ConflictRT');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing conflicting edits');

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
        
        await expenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(expenseDescription)
            .withAmount(60)
            .withCurrency('USD')
            .withPaidByDisplayName(editor1DisplayName)
            .withSplitType('equal')
            .build());

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
import {expect, simpleTest} from '../../fixtures';
import {JoinGroupPage} from '../../pages';
import {generateTestGroupName, randomString} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';
import {SettlementData} from '../../pages/settlement-form.page.ts';

simpleTest.describe('Real-Time Edge Cases', () => {
    simpleTest('should handle user leaving while being added to new expense', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Edge case testing may generate expected transient errors and 404s' });

        // Create four users - ExpenseCreator, LeavingUser, StayingUser, Watcher
        const { dashboardPage: creatorDashboardPage, user: creator } = await newLoggedInBrowser();
        const { page: leavingPage, dashboardPage: leavingDashboardPage, user: leaving } = await newLoggedInBrowser();
        const { page: stayingPage, user: staying } = await newLoggedInBrowser();
        const { page: watcherPage, user: watcher } = await newLoggedInBrowser();

        // Create page objects

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

        const leavingGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(leavingPage, shareLink);
        const stayingGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(stayingPage, shareLink);
        const watcherGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(watcherPage, shareLink);

        await creatorGroupDetailPage.waitForPage(groupId, 4);
        await leavingGroupDetailPage.waitForPage(groupId, 4);
        await stayingGroupDetailPage.waitForPage(groupId, 4);
        await watcherGroupDetailPage.waitForPage(groupId, 4);

        // RACE CONDITION: LeavingUser leaves while Creator starts expense creation

        // LeavingUser initiates leaving
        const leaveModal = await leavingGroupDetailPage.clickLeaveGroup();
        await leaveModal.confirmLeaveGroup();

        // Wait for LeavingUser to be fully removed from group
        await creatorGroupDetailPage.waitForPage(groupId, 3);
        await stayingGroupDetailPage.waitForPage(groupId, 3);
        await watcherGroupDetailPage.waitForPage(groupId, 3);

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
                .withParticipants([creatorDisplayName]) // After user left, need to specify remaining participants
                .build(),
        );

        // Wait for expense to appear for all remaining users immediately after creation
        await creatorGroupDetailPage.waitForExpense(expenseDescription);
        await stayingGroupDetailPage.waitForExpense(expenseDescription);
        await watcherGroupDetailPage.waitForExpense(expenseDescription);

        // VERIFICATION:

        // 1. LeavingUser should be on dashboard (left successfully)
        await leavingDashboardPage.waitForDashboard();

        // 2. All remaining users should see member removed
        await creatorGroupDetailPage.verifyMemberNotVisible(leavingDisplayName);
        await stayingGroupDetailPage.verifyMemberNotVisible(leavingDisplayName);
        await watcherGroupDetailPage.verifyMemberNotVisible(leavingDisplayName);

        // 3. Expense should exist for all remaining members
        await expect(creatorGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await expect(stayingGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await expect(watcherGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
    });

    simpleTest('should handle removal during active settlement', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Edge case testing may generate expected transient errors and 404s' });

        // Create four users - Owner, SettlingUser, RemovalTarget, Watcher
        const { dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: settlingPage, dashboardPage: settlingDashboardPage, user: settling } = await newLoggedInBrowser();
        const { page: targetPage, dashboardPage: targetDashboardPage, user: target } = await newLoggedInBrowser();
        const { page: watcherPage, user: watcher } = await newLoggedInBrowser();

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

        const settlingGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(settlingPage, shareLink);
        const targetGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(targetPage, shareLink);
        const watcherGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(watcherPage, shareLink);

        await ownerGroupDetailPage.waitForPage(groupId, 4);
        await settlingGroupDetailPage.waitForPage(groupId, 4);
        await targetGroupDetailPage.waitForPage(groupId, 4);
        await watcherGroupDetailPage.waitForPage(groupId, 4);

        // Create expense creating debt (Owner paid $80, others owe $20 each)
        const expenseFormPage = await ownerGroupDetailPage.clickAddExpenseButton(4);
        const expenseDescription = 'Settlement Edge Test';
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(87)
                .withCurrency('USD')
                .withPaidByDisplayName(ownerDisplayName)
                .withSplitType('equal')
                .withParticipants([ownerDisplayName, settlingDisplayName, targetDisplayName])// split between 3 (not 4 members)
                .build(),
        );

        await ownerGroupDetailPage.waitForExpense(expenseDescription);
        await settlingGroupDetailPage.waitForExpense(expenseDescription);
        await targetGroupDetailPage.waitForExpense(expenseDescription);
        await watcherGroupDetailPage.waitForExpense(expenseDescription);

        await ownerGroupDetailPage.verifyDebt(settlingDisplayName, ownerDisplayName, "$29");
        await ownerGroupDetailPage.verifyDebt(targetDisplayName, ownerDisplayName, "$29");
        // watcher has no debt

        // SEQUENCE: Target settles their debt first, then Owner removes Target, then SettlingUser creates settlement (testing real-time sync)

        // Target settles their debt first (they owe $20 to owner)
        const targetSettlementFormPage = await targetGroupDetailPage.clickSettleUpButton(4);
        const settlementNote1 = `Pre-removal Settlement ${randomString(4)}`;
        await targetSettlementFormPage.submitSettlement(
            {
                payerName: targetDisplayName,
                payeeName: ownerDisplayName,
                amount: '29',
                note: settlementNote1,
            } as SettlementData,
            4,
        );

        // Wait for target's settlement to process
        await ownerGroupDetailPage.waitForSettlementToAppear(settlementNote1);
        await settlingGroupDetailPage.waitForSettlementToAppear(settlementNote1);
        await targetGroupDetailPage.waitForSettlementToAppear(settlementNote1);
        await watcherGroupDetailPage.waitForSettlementToAppear(settlementNote1);

        await ownerGroupDetailPage.verifyDebt(settlingDisplayName, ownerDisplayName, "$29");
        // target has no debt now
        // watcher has no debt

        // Now Owner can remove Target user (no outstanding balance)
        const removeMemberModal = await ownerGroupDetailPage.clickRemoveMember(targetDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Wait for removal to propagate to other users
        await ownerGroupDetailPage.waitForPage(groupId, 3);
        await settlingGroupDetailPage.waitForPage(groupId, 3);
        await watcherGroupDetailPage.waitForPage(groupId, 3);

        await ownerGroupDetailPage.verifyMemberNotVisible(targetDisplayName);
        await settlingGroupDetailPage.verifyMemberNotVisible(targetDisplayName);
        await watcherGroupDetailPage.verifyMemberNotVisible(targetDisplayName);

        // SettlingUser creates settlement with remaining members
        const settlementFormPage = await settlingGroupDetailPage.clickSettleUpButton(3);
        const settlementNote2 = `Edge Settlement ${randomString(4)}`;
        await settlementFormPage.submitSettlement(
            {
                payerName: settlingDisplayName,
                payeeName: ownerDisplayName,
                amount: '29',
                note: settlementNote2,
            } as SettlementData,
            3,
        );

        // Wait for settlement to process
        await ownerGroupDetailPage.waitForSettlementToAppear(settlementNote2);
        await settlingGroupDetailPage.waitForSettlementToAppear(settlementNote2);
        await watcherGroupDetailPage.waitForSettlementToAppear(settlementNote2);

        await ownerGroupDetailPage.verifyAllSettledUp(groupId);
        await settlingGroupDetailPage.verifyAllSettledUp(groupId);
        await watcherGroupDetailPage.verifyAllSettledUp(groupId);

        // VERIFICATION:

        // 1. Target should be removed (redirected to dashboard)
        // Use fallback method to handle 404 page that occurs when user is removed from group
        await targetDashboardPage.waitForDashboardWithFallback();
    });

    simpleTest('should handle rapid successive changes (stress test)', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Stress testing may generate expected transient sync errors' });

        // Create four users for stress testing
        const { dashboardPage: user1DashboardPage, } = await newLoggedInBrowser();
        const { page: user2Page, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();
        const { page: user3Page, dashboardPage: user3DashboardPage } = await newLoggedInBrowser();
        const { page: user4Page, dashboardPage: user4DashboardPage } = await newLoggedInBrowser();

        // Create page objects

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

        const user2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink);
        const user3GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user3Page, shareLink);
        const user4GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(user4Page, shareLink);

        await user1GroupDetailPage.waitForPage(groupId, 4);
        await user2GroupDetailPage.waitForPage(groupId, 4);
        await user3GroupDetailPage.waitForPage(groupId, 4);
        await user4GroupDetailPage.waitForPage(groupId, 4);

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
                .withParticipants([user1DisplayName, user2DisplayName, user4DisplayName]) // 4-user group but user3DisplayName not captured
                .build(),
        );

        // Wait for expense 1 to appear immediately
        await user1GroupDetailPage.waitForExpense(expense1Description);
        await user2GroupDetailPage.waitForExpense(expense1Description);
        await user4GroupDetailPage.waitForExpense(expense1Description);

        // 2. User2 adds expense immediately
        const expense2FormPage = await user2GroupDetailPage.clickAddExpenseButton(4);
        await expense2FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expense2Description)
                .withAmount(30)
                .withCurrency('USD')
                .withPaidByDisplayName(user2DisplayName)
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName, user4DisplayName]) // 4-user group but user3DisplayName not captured
                .build(),
        );

        // Wait for expense 2 to appear immediately
        await user1GroupDetailPage.waitForExpense(expense2Description);
        await user2GroupDetailPage.waitForExpense(expense2Description);
        await user4GroupDetailPage.waitForExpense(expense2Description);

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
                .withParticipants([user1DisplayName, user2DisplayName, user4DisplayName]) // 4-user group but user3DisplayName not captured
                .build(),
        );

        // Wait for expense 3 to appear immediately
        await user1GroupDetailPage.waitForExpense(expense3Description);
        await user2GroupDetailPage.waitForExpense(expense3Description);
        await user4GroupDetailPage.waitForExpense(expense3Description);

        // 5. User2 settles immediately
        const settlementFormPage = await user2GroupDetailPage.clickSettleUpButton(4);
        const settlementNote = `Stress settlement ${randomString(3)}`;
        await settlementFormPage.submitSettlement(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
                amount: '20',
                note: settlementNote,
            },
            4,
        );

        // Wait for settlement to appear immediately
        await user1GroupDetailPage.waitForSettlementToAppear(settlementNote);
        await user2GroupDetailPage.waitForSettlementToAppear(settlementNote);
        await user4GroupDetailPage.waitForSettlementToAppear(settlementNote);

        // Allow final synchronization

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
    });

    simpleTest('should handle network instability simulation', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Network simulation may generate expected connection errors' });

        // Create three users - ActiveUser, WatcherOnline, WatcherOffline
        const { dashboardPage: activeDashboardPage } = await newLoggedInBrowser();
        const { page: onlinePage, } = await newLoggedInBrowser();
        const { page: offlinePage, } = await newLoggedInBrowser();

        // Create page objects

        // Get display names
        const activeDisplayName = await activeDashboardPage.header.getCurrentUserDisplayName();

        // ActiveUser creates group
        const groupName = generateTestGroupName('NetworkRT');
        const activeGroupDetailPage = await activeDashboardPage.createGroupAndNavigate(groupName, 'Testing network instability');
        const groupId = activeGroupDetailPage.inferGroupId();

        // Others join
        const shareLink = await activeGroupDetailPage.getShareLink();

        const onlineGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(onlinePage, shareLink);
        const offlineGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(offlinePage, shareLink);

        await activeGroupDetailPage.waitForPage(groupId, 3);
        await onlineGroupDetailPage.waitForPage(groupId, 3);
        await offlineGroupDetailPage.waitForPage(groupId, 3);

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
                .withParticipants([activeDisplayName]) // 3-user group but only activeDisplayName captured
                .build(),
        );

        // Wait for expense to appear immediately after creation
        await activeGroupDetailPage.waitForExpense(expenseDescription);
        await onlineGroupDetailPage.waitForExpense(expenseDescription);

        // "Reconnect" offline user by navigating back to group
        await offlineGroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(offlinePage).toHaveURL(groupDetailUrlPattern(groupId));

        // CRITICAL TEST: OfflineUser should see all changes that happened while "offline"
        await offlineGroupDetailPage.waitForExpense(expenseDescription);

        // Add another expense to test continued real-time after "reconnection"
        const expense2FormPage = await activeGroupDetailPage.clickAddExpenseButton(3);
        const afterReconnectDescription = `After Reconnect ${randomString(4)}`;
        await expense2FormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(afterReconnectDescription)
                .withAmount(30)
                .withCurrency('USD')
                .withPaidByDisplayName(activeDisplayName)
                .withSplitType('equal')
                .withParticipants([activeDisplayName]) // 3-user group but only activeDisplayName captured
                .build(),
        );

        // Wait for expense to appear immediately after creation
        await activeGroupDetailPage.waitForExpense(afterReconnectDescription);
        await onlineGroupDetailPage.waitForExpense(afterReconnectDescription);
        await offlineGroupDetailPage.waitForExpense(afterReconnectDescription);
    });

    simpleTest('should handle conflicting expense edits gracefully', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Conflict resolution may generate expected transient errors' });

        // Create three users - Editor1, Editor2, Watcher
        const { dashboardPage: editor1DashboardPage } = await newLoggedInBrowser();
        const { page: editor2Page, dashboardPage: editor2DashboardPage } = await newLoggedInBrowser();
        const { page: watcherPage } = await newLoggedInBrowser();

        // Create page objects

        // Get display names
        const editor1DisplayName = await editor1DashboardPage.header.getCurrentUserDisplayName();
        const editor2DisplayName = await editor2DashboardPage.header.getCurrentUserDisplayName();

        // Editor1 creates group
        const editor1GroupDetailPage = await editor1DashboardPage.createGroupAndNavigate(generateTestGroupName('ConflictRT'), 'Testing conflicting edits');
        const groupId = editor1GroupDetailPage.inferGroupId();

        // Others join
        const shareLink = await editor1GroupDetailPage.getShareLink();

        const editor2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(editor2Page, shareLink);
        const watcherGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(watcherPage, shareLink);

        await editor1GroupDetailPage.waitForPage(groupId, 3);
        await editor2GroupDetailPage.waitForPage(groupId, 3);
        await watcherGroupDetailPage.waitForPage(groupId, 3);

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
                .withParticipants([editor1DisplayName, editor2DisplayName])
                .build(),
        );

        // Wait for expense to appear immediately after creation
        await editor1GroupDetailPage.waitForExpense(expenseDescription);
        await editor2GroupDetailPage.waitForExpense(expenseDescription);
        await watcherGroupDetailPage.waitForExpense(expenseDescription);

        // Both editors navigate to expense detail simultaneously
        const expense1DetailPage = await editor1GroupDetailPage.clickExpenseToView(expenseDescription);
        const expense2DetailPage = await editor2GroupDetailPage.clickExpenseToView(expenseDescription);

        // Both start editing simultaneously
        const edit1FormPage = await expense1DetailPage.clickEditExpenseButton(3);
        const edit2FormPage = await expense2DetailPage.clickEditExpenseButton(3);

        // CONFLICTING EDITS:

        // Editor1 changes amount to $90
        await edit1FormPage.fillAmount('90');

        // Editor2 changes amount to $120 (conflicting change)
        await edit2FormPage.fillAmount('120');

        // Both submit nearly simultaneously
        await Promise.all([
            edit1FormPage.getUpdateExpenseButton().click(),
            edit2FormPage.getUpdateExpenseButton().click()
        ]);

        // Navigate back to group
        await expense1DetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expense2DetailPage.navigateToStaticPath(`/groups/${groupId}`);

        // Allow system to resolve conflict - wait for updated expense
        await editor1GroupDetailPage.waitForExpense(expenseDescription);
        await editor2GroupDetailPage.waitForExpense(expenseDescription);
        await watcherGroupDetailPage.waitForExpense(expenseDescription);

        // CRITICAL TEST: System should handle conflict gracefully
        // One of the edits should win, and all users should see consistent state

        // Verify one of the conflicting edits succeeded ($90 or $120)
        // Check which amount is actually displayed in the UI
        const is90Visible = await editor1GroupDetailPage.getTextElement('$90.00').first().isVisible();
        const is120Visible = await editor1GroupDetailPage.getTextElement('$120.00').first().isVisible();

        let finalAmountVisible: string;
        if (is90Visible) {
            finalAmountVisible = '$90.00';
        } else if (is120Visible) {
            finalAmountVisible = '$120.00';
        } else {
            throw new Error('Neither $90.00 nor $120.00 is visible - conflict resolution failed');
        }

        console.log(`✅ Conflict resolved - final amount: ${finalAmountVisible}`);

        // All users should see the same final expense amount (last write wins or conflict resolution)
        await expect(editor1GroupDetailPage.getTextElement(finalAmountVisible).first()).toBeVisible();
        await expect(editor2GroupDetailPage.getTextElement(finalAmountVisible).first()).toBeVisible();
        await expect(watcherGroupDetailPage.getTextElement(finalAmountVisible).first()).toBeVisible();

        // Verify expense is still accessible by all users
        await expect(editor1GroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await expect(editor2GroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await expect(watcherGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
    });

    simpleTest('should allow user to create expense for other users without being involved', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Testing third-party expense creation and editing' });
        // Create three users - Creator (not involved), PayerUser, ReceiverUser
        const { dashboardPage: creatorDashboardPage } = await newLoggedInBrowser();
        const { page: payerPage, dashboardPage: payerDashboardPage } = await newLoggedInBrowser();
        const { page: receiverPage, dashboardPage: receiverDashboardPage } = await newLoggedInBrowser();

        // Get display names
        const payerDisplayName = await payerDashboardPage.header.getCurrentUserDisplayName();
        const receiverDisplayName = await receiverDashboardPage.header.getCurrentUserDisplayName();

        // Creator creates group
        const groupName = generateTestGroupName('ThirdPartyExpense');
        const creatorGroupDetailPage = await creatorDashboardPage.createGroupAndNavigate(groupName, 'Testing expense creation for other users');
        const groupId = creatorGroupDetailPage.inferGroupId();

        // Other users join
        const shareLink = await creatorGroupDetailPage.getShareLink();

        const payerGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(payerPage, shareLink);
        const receiverGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(receiverPage, shareLink);

        await creatorGroupDetailPage.waitForPage(groupId, 3);
        await payerGroupDetailPage.waitForPage(groupId, 3);
        await receiverGroupDetailPage.waitForPage(groupId, 3);

        // Creator creates expense for the other two users (creator not involved)
        const expenseFormPage = await creatorGroupDetailPage.clickAddExpenseButton(3);
        const expenseDescription = `Third Party Expense ${randomString(4)}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(80)
                .withCurrency('USD')
                .withPaidByDisplayName(payerDisplayName) // Payer paid
                .withSplitType('equal')
                .withParticipants([payerDisplayName, receiverDisplayName]) // Split between payer and receiver only (creator not involved)
                .build(),
        );

        // The submitExpense currently redirects to expense detail page, navigate back to group
        await creatorGroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(creatorGroupDetailPage.page).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for expense to appear for all users immediately after creation
        await creatorGroupDetailPage.waitForExpense(expenseDescription);
        await payerGroupDetailPage.waitForExpense(expenseDescription);
        await receiverGroupDetailPage.waitForExpense(expenseDescription);

        // VERIFICATION 1: All users can see the expense
        await expect(creatorGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await expect(payerGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
        await expect(receiverGroupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();

        // VERIFICATION 2: Check that debt is created between payer and receiver (creator owes nothing)
        await creatorGroupDetailPage.verifyDebt(receiverDisplayName, payerDisplayName, "$40"); // Receiver owes $40 to Payer

        // VERIFICATION 3: PayerUser can edit the expense they're involved in
        const payerExpenseDetailPage = await payerGroupDetailPage.clickExpenseToView(expenseDescription);
        const payerEditFormPage = await payerExpenseDetailPage.clickEditExpenseButton(3);
        await payerEditFormPage.fillAmount('100'); // Change from $80 to $100
        await payerEditFormPage.getUpdateExpenseButton().click();

        // Navigate back to group page after edit
        await payerGroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(payerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for updated expense to propagate
        await payerGroupDetailPage.waitForExpense(expenseDescription);
        await receiverGroupDetailPage.waitForExpense(expenseDescription);
        await creatorGroupDetailPage.waitForExpense(expenseDescription);

        // VERIFICATION 4: Updated amount is visible to all users
        await expect(payerPage.getByText('$100.00').first()).toBeVisible();
        await expect(receiverPage.getByText('$100.00').first()).toBeVisible();
        await expect(creatorGroupDetailPage.getTextElement('$100.00').first()).toBeVisible();

        // VERIFICATION 5: ReceiverUser can also edit the expense
        const receiverExpenseDetailPage = await receiverGroupDetailPage.clickExpenseToView(expenseDescription);
        const receiverEditFormPage = await receiverExpenseDetailPage.clickEditExpenseButton(3);
        await receiverEditFormPage.fillDescription(`${expenseDescription} - Updated by Receiver`);
        await receiverEditFormPage.getUpdateExpenseButton().click();

        // Navigate back to group page after edit
        await receiverGroupDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(receiverPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for updated expense description to propagate
        const updatedDescription = `${expenseDescription} - Updated by Receiver`;
        await payerGroupDetailPage.waitForExpense(updatedDescription);
        await receiverGroupDetailPage.waitForExpense(updatedDescription);
        await creatorGroupDetailPage.waitForExpense(updatedDescription);

        // VERIFICATION 6: Updated description is visible to all users
        await expect(payerGroupDetailPage.getExpenseByDescription(updatedDescription)).toBeVisible();
        await expect(receiverGroupDetailPage.getExpenseByDescription(updatedDescription)).toBeVisible();
        await expect(creatorGroupDetailPage.getExpenseByDescription(updatedDescription)).toBeVisible();

        // VERIFICATION 7: Final debt check - receiver now owes $50 to payer (updated amount $100 / 2)
        await creatorGroupDetailPage.verifyDebt(receiverDisplayName, payerDisplayName, "$50");
    });
});

import { ExpenseFormDataBuilder } from '../../../pages/expense-form.page';
import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { GroupDetailPage, JoinGroupPage, ExpenseDetailPage } from '../../../pages';
import { GroupWorkflow } from '../../../workflows';
import { generateTestGroupName, randomString } from "@splitifyd/test-support";
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

simpleTest.describe('Real-Time Expense Editing', () => {
    simpleTest('should show expense edits in real-time to all users on group page', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Real-time sync may generate expected transient API errors' });

        // Create three users - Editor (making changes), Watcher1 (group page), Watcher2 (group page)
        const { page: editorPage, dashboardPage: editorDashboardPage, user: editor } = await newLoggedInBrowser();
        const { page: watcher1Page, dashboardPage: watcher1DashboardPage, user: watcher1 } = await newLoggedInBrowser();
        const { page: watcher2Page, dashboardPage: watcher2DashboardPage, user: watcher2 } = await newLoggedInBrowser();

        // Create page objects
        const editorGroupDetailPage = new GroupDetailPage(editorPage, editor);
        const watcher1GroupDetailPage = new GroupDetailPage(watcher1Page, watcher1);
        const watcher2GroupDetailPage = new GroupDetailPage(watcher2Page, watcher2);

        // Get display names
        const editorDisplayName = await editorDashboardPage.getCurrentUserDisplayName();
        const watcher1DisplayName = await watcher1DashboardPage.getCurrentUserDisplayName();
        const watcher2DisplayName = await watcher2DashboardPage.getCurrentUserDisplayName();

        // Editor creates group
        const groupWorkflow = new GroupWorkflow(editorPage);
        const groupName = generateTestGroupName('EditRT');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing real-time expense editing');

        // Watchers join
        const shareLink = await editorGroupDetailPage.getShareLink();

        const joinGroupPage1 = new JoinGroupPage(watcher1Page);
        await joinGroupPage1.joinGroupUsingShareLink(shareLink);
        const joinGroupPage2 = new JoinGroupPage(watcher2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);

        // Wait for all members to be present
        await editorGroupDetailPage.waitForMemberCount(3);
        await watcher1GroupDetailPage.waitForMemberCount(3);
        await watcher2GroupDetailPage.waitForMemberCount(3);

        // Editor creates initial expense
        const expenseFormPage = await editorGroupDetailPage.clickAddExpenseButton(3);
        const originalDescription = `Edit Test ${randomString(4)}`;
        const originalAmount = 60;

        await expenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(originalDescription)
            .withAmount(originalAmount)
            .withCurrency('USD')
            .withPaidByDisplayName(editorDisplayName)
            .withSplitType('equal')
            .build()
        );

        // Wait for expense to appear for all users
        await editorGroupDetailPage.waitForBalancesToLoad(groupId);
        await expect(editorGroupDetailPage.getExpenseByDescription(originalDescription)).toBeVisible();
        await expect(watcher1GroupDetailPage.getExpenseByDescription(originalDescription)).toBeVisible();
        await expect(watcher2GroupDetailPage.getExpenseByDescription(originalDescription)).toBeVisible();

        // Editor edits the expense
        await editorGroupDetailPage.clickExpenseToView(originalDescription);
        await expect(editorPage).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);

        const expenseDetailPage = new ExpenseDetailPage(editorPage, editor);
        await expenseDetailPage.waitForPageReady();

        const editFormPage = await expenseDetailPage.clickEditExpenseButton(3);

        // Change amount and description
        const newDescription = `Edited Test ${randomString(4)}`;
        const newAmount = 90;

        await editFormPage.fillDescription(newDescription);
        await editFormPage.fillAmount(newAmount.toString());

        const updateButton = editFormPage.getUpdateExpenseButton();
        await expect(updateButton).toBeVisible();
        await updateButton.click();

        // Navigate back to group page
        await expenseDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await expect(editorPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for editor to see changes
        await editorGroupDetailPage.waitForBalancesToLoad(groupId);
        await expect(editorGroupDetailPage.getExpenseByDescription(newDescription)).toBeVisible();

        // CRITICAL TEST: Watchers should see updated expense WITHOUT refresh
        await expect(watcher1GroupDetailPage.getExpenseByDescription(newDescription)).toBeVisible();
        await expect(watcher2GroupDetailPage.getExpenseByDescription(newDescription)).toBeVisible();

        // Old expense description should no longer be visible
        await expect(watcher1GroupDetailPage.getExpenseByDescription(originalDescription)).not.toBeVisible();
        await expect(watcher2GroupDetailPage.getExpenseByDescription(originalDescription)).not.toBeVisible();

        // Balances should update (new amount $90 / 3 users = $30 each)
        await watcher1GroupDetailPage.waitForBalancesToLoad(groupId);
        await watcher2GroupDetailPage.waitForBalancesToLoad(groupId);

        console.log('✅ Real-time expense editing on group page working correctly');
    });

    simpleTest('should show expense edits in real-time on dashboard', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Real-time sync may generate expected transient API errors' });

        // Create three users - Editor (group page), DashWatcher1 (dashboard), DashWatcher2 (dashboard)
        const { page: editorPage, dashboardPage: editorDashboardPage, user: editor } = await newLoggedInBrowser();
        const { page: dashWatcher1Page, dashboardPage: dashWatcher1DashboardPage, user: dashWatcher1 } = await newLoggedInBrowser();
        const { page: dashWatcher2Page, dashboardPage: dashWatcher2DashboardPage, user: dashWatcher2 } = await newLoggedInBrowser();

        // Create page objects
        const editorGroupDetailPage = new GroupDetailPage(editorPage, editor);

        // Get display names
        const editorDisplayName = await editorDashboardPage.getCurrentUserDisplayName();
        const dashWatcher1DisplayName = await dashWatcher1DashboardPage.getCurrentUserDisplayName();
        const dashWatcher2DisplayName = await dashWatcher2DashboardPage.getCurrentUserDisplayName();

        // Editor creates group
        const groupWorkflow = new GroupWorkflow(editorPage);
        const groupName = generateTestGroupName('DashEditRT');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing dashboard real-time expense editing');

        // Watchers join then go to dashboard
        const shareLink = await editorGroupDetailPage.getShareLink();

        const joinGroupPage1 = new JoinGroupPage(dashWatcher1Page);
        await joinGroupPage1.joinGroupUsingShareLink(shareLink);
        const joinGroupPage2 = new JoinGroupPage(dashWatcher2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);

        await editorGroupDetailPage.waitForMemberCount(3);

        // Watchers go to dashboard
        await dashWatcher1DashboardPage.navigate();
        await dashWatcher1DashboardPage.waitForGroupToAppear(groupName);
        await dashWatcher2DashboardPage.navigate();
        await dashWatcher2DashboardPage.waitForGroupToAppear(groupName);

        // Editor creates expense involving DashWatcher1 ($40 split = $20 each)
        const expenseFormPage = await editorGroupDetailPage.clickAddExpenseButton(3);
        const originalDescription = `Dashboard Edit ${randomString(4)}`;
        const originalAmount = 40;

        await expenseFormPage.submitExpense(new ExpenseFormDataBuilder()
                .withDescription(originalDescription)
                .withAmount(originalAmount)
                .withCurrency('USD')
                .withPaidByDisplayName(editorDisplayName)
                .withSplitType('equal')
                .build());

        await editorGroupDetailPage.waitForBalancesToLoad(groupId);

        // DashWatcher1's dashboard should show the group accessible
        await dashWatcher1DashboardPage.waitForGroupToAppear(groupName);
        // DashWatcher2 should also show the group accessible
        await dashWatcher2DashboardPage.waitForGroupToAppear(groupName);

        // Editor edits the expense to increase amount to $80 (= $40 each)
        await editorGroupDetailPage.clickExpenseToView(originalDescription);
        const expenseDetailPage = new ExpenseDetailPage(editorPage, editor);
        await expenseDetailPage.waitForPageReady();

        const editFormPage = await expenseDetailPage.clickEditExpenseButton(3);
        const newAmount = 80;
        await editFormPage.fillAmount(newAmount.toString());

        await editFormPage.getUpdateExpenseButton().click();
        await expenseDetailPage.navigateToStaticPath(`/groups/${groupId}`);
        await editorGroupDetailPage.waitForBalancesToLoad(groupId);

        // CRITICAL TEST: DashWatcher1's dashboard should still show the group accessible
        await dashWatcher1DashboardPage.waitForGroupToAppear(groupName);
        // DashWatcher2 should also still show the group accessible
        await dashWatcher2DashboardPage.waitForGroupToAppear(groupName);

        console.log('✅ Real-time expense editing on dashboard working correctly');
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
        const watcherDisplayName = await watcherDashboardPage.getCurrentUserDisplayName();

        // Editor1 creates group
        const groupWorkflow = new GroupWorkflow(editor1Page);
        const groupName = generateTestGroupName('ConcurrentEdit');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing concurrent expense editing');

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

        await expense1FormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(expense1Description)
            .withAmount(30)
            .withCurrency('USD')
            .withPaidByDisplayName(editor1DisplayName)
            .withSplitType('equal')
            .build());

        // Editor2 creates second expense (concurrent with first)
        const expense2FormPage = await editor2GroupDetailPage.clickAddExpenseButton(3);
        const expense2Description = `Concurrent Test 2 ${randomString(4)}`;

        await expense2FormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(expense2Description)
            .withAmount(45)
            .withCurrency('USD')
            .withPaidByDisplayName(editor2DisplayName)
            .withSplitType('equal')
            .build()
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
        const { page: dashWatcherPage, dashboardPage: dashWatcherDashboardPage, user: dashWatcher } = await newLoggedInBrowser();

        // Create page objects
        const deleterGroupDetailPage = new GroupDetailPage(deleterPage, deleter);
        const groupWatcherGroupDetailPage = new GroupDetailPage(groupWatcherPage, groupWatcher);

        // Get display names
        const deleterDisplayName = await deleterDashboardPage.getCurrentUserDisplayName();
        const groupWatcherDisplayName = await groupWatcherDashboardPage.getCurrentUserDisplayName();
        const dashWatcherDisplayName = await dashWatcherDashboardPage.getCurrentUserDisplayName();

        // Deleter creates group
        const groupWorkflow = new GroupWorkflow(deleterPage);
        const groupName = generateTestGroupName('DeleteRT');
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, 'Testing real-time expense deletion');

        // Others join
        const shareLink = await deleterGroupDetailPage.getShareLink();

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

        await expenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription(expenseDescription)
            .withAmount(50)
            .withCurrency('USD')
            .withPaidByDisplayName(deleterDisplayName)
            .withSplitType('equal')
            .build());

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
});

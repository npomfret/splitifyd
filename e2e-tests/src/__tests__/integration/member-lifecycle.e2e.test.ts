import { simpleTest, expect } from '../../fixtures';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { PLACEHOLDERS } from '../../constants/selectors';
import { JoinGroupPage, GroupDetailPage } from '../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';

simpleTest.describe('Member Management - Owner Restrictions', () => {
    simpleTest('group owner should not see leave button and should see settings', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();

        // Create a group as owner
        const groupName = generateTestGroupName('Owner Test');
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Testing owner restrictions');

        // Wait for group to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);

        // Verify Leave Group button is NOT visible for owner
        await expect(groupDetailPage.getLeaveGroupButton()).not.toBeVisible();

        // But Settings button should be visible
        await expect(groupDetailPage.getSettingsButton()).toBeVisible();
    });
});

simpleTest.describe('Member Management - Multi-User Operations', () => {
    simpleTest('non-owner member should be able to leave group', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member
        const { page: ownerPage, dashboardPage: user1DashboardPage, } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: user2DashboardPage, } = await newLoggedInBrowser();

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Leave Test');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing member leave functionality');
        const groupId = groupDetailPage.inferGroupId();

        // Get share link
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
        const shareLink = await groupDetailPage.getShareLink();

        // Member joins the group
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Wait for both users to see each other in the member list
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Verify member sees Leave Group button
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();

        // Member clicks Leave Group
        const leaveModal = await memberGroupDetailPage.clickLeaveGroup();

        // Confirm in the dialog
        await leaveModal.confirmLeaveGroup();

        // Member should be redirected to dashboard
        await expect(memberPage).toHaveURL(/\/dashboard/);

        // Owner should see updated member count (only 1 member now)
        await groupDetailPage.waitForMemberCount(1);

        // Verify the member who left is no longer in the list
        await groupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    simpleTest('group owner should be able to remove multiple members', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - removed members will get expected 404s when trying to access group
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create three browser instances - Owner, Member1 (on group page), Member2 (on dashboard)
        const { page: ownerPage, dashboardPage: ownerDashboardPage, } = await newLoggedInBrowser();
        const { page: member1Page, dashboardPage: member1DashboardPage, } = await newLoggedInBrowser();
        const { page: member2Page, dashboardPage: member2DashboardPage, } = await newLoggedInBrowser();

        // Create page objects

        const member1DisplayName = await member1DashboardPage.getCurrentUserDisplayName();
        const member2DisplayName = await member2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Multi Remove Test');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing multiple member removal scenarios');
        const groupId = groupDetailPage.inferGroupId();

        // Get share link
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
        const shareLink = await groupDetailPage.getShareLink();

        // Both members join the group
        const member1GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(member1Page, shareLink, groupId);
        const member2GroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(member2Page, shareLink, groupId);

        // Wait for all users to see each other (3 members total)
        await groupDetailPage.waitForMemberCount(3);
        await member1GroupDetailPage.waitForMemberCount(3);

        // Position users for different removal scenarios:
        // - Member1 stays on group page (will get 404 errors)
        // - Member2 goes to dashboard (will see group disappear from list)
        await member2GroupDetailPage.navigateToDashboard();
        await member2DashboardPage.waitForGroupToAppear(groupName);

        // Owner removes Member1 first (who is on the group page)
        const removeMember1Modal = await groupDetailPage.clickRemoveMember(member1DisplayName);
        await removeMember1Modal.confirmRemoveMember();

        // Verify Member1 gets 404 (since they're viewing the group page)
        await member1GroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Owner should see updated member count (2 members remaining: owner + member2)
        await groupDetailPage.waitForMemberCount(2);
        await groupDetailPage.verifyMemberNotVisible(member1DisplayName);

        // Now remove Member2 (who is on dashboard)
        const removeMember2Modal = await groupDetailPage.clickRemoveMember(member2DisplayName);
        await removeMember2Modal.confirmRemoveMember();

        // Verify Member2 can no longer access the group (should get 404)
        await member2Page.goto(`/groups/${groupId}`);
        await member2GroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Owner should see final member count (only 1 member: the owner)
        await groupDetailPage.waitForMemberCount(1);
        await groupDetailPage.verifyMemberNotVisible(member2DisplayName);

        // Verify group title is still visible for owner (group still exists)
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
    });

    simpleTest('should prevent leaving group with outstanding balance', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member
        const { dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: user2DashboardPage, } = await newLoggedInBrowser();

        // Create page objects

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Balance Test');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing balance restrictions');
        const groupId = groupDetailPage.inferGroupId();

        // Get share link and have member join
        const shareLink = await groupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Owner adds an expense that creates a balance
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        const expenseDescription = 'Test expense for balance';
        await expenseFormPage.submitExpense({
            description: expenseDescription,
            amount: 100,
            currency: 'USD',
            paidByDisplayName: ownerDisplayName,
            splitType: 'equal',
        });

        // Wait for expense to be processed and balances to update
        await groupDetailPage.waitForExpense(expenseDescription);
        await groupDetailPage.verifyDebt(memberDisplayName, ownerDisplayName, "$50");

        await memberGroupDetailPage.waitForExpense(expenseDescription);
        await memberGroupDetailPage.verifyDebt(memberDisplayName, ownerDisplayName, "$50");

        // Member tries to leave group
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        const leaveModalWithBalance = await memberGroupDetailPage.clickLeaveGroup();

        // Should see error message about outstanding balance
        await leaveModalWithBalance.verifyLeaveErrorMessage();

        // Cancel the leave attempt
        await leaveModalWithBalance.cancelLeaveGroup();

        // Member records a settlement to clear the balance
        const settlementFormPage = await memberGroupDetailPage.clickSettleUpButton(2);

        // Fill and submit settlement for the full owed amount (50 in this case)
        await settlementFormPage.fillAndSubmitSettlement('50', ownerDisplayName);

        // Wait for settlement to process and balances to update
        await groupDetailPage.verifyAllSettledUp(groupId);
        await memberGroupDetailPage.verifyAllSettledUp(groupId);

        // Now member should be able to leave
        const leaveModalAfterSettlement = await memberGroupDetailPage.clickLeaveGroup();
        await leaveModalAfterSettlement.confirmLeaveGroup();

        // Member should be redirected to dashboard
        await expect(memberPage).toHaveURL(/\/dashboard/);
    });

    simpleTest('should prevent owner from removing member with outstanding balance', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member
        const { dashboardPage: user1DashboardPage, } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

        // Create page objects

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Remove Balance');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing removal with balance');
        const groupId = groupDetailPage.inferGroupId();

        // Member joins
        const shareLink = await groupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await memberGroupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);

        // Member adds expense creating a balance
        const expenseFormPage = await memberGroupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Member expense',
            amount: 60,
            currency: 'USD',
            paidByDisplayName: memberDisplayName,
            splitType: 'equal',
        });

        // Wait for balances to update
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Owner tries to remove member - button should be disabled
        const removeButton = groupDetailPage.getRemoveMemberButton(memberDisplayName);
        await expect(removeButton).toBeDisabled({ timeout: 5000 });
    });

    simpleTest('should handle edge case of removing last non-owner member', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - Owner and Member
        const { page: ownerPage, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

        // Create page objects

        const ownerDisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('Last Member');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing last member removal');
        const groupId = groupDetailPage.inferGroupId();

        // Member joins
        const shareLink = await groupDetailPage.getShareLink();
        const groupDetailPage2 = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Wait for synchronization
        await groupDetailPage.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await groupDetailPage2.waitForUserSynchronization(ownerDisplayName, memberDisplayName);
        await groupDetailPage2.navigateToDashboard(); // move away from the page to avoid 404 errors in console after the removal happens

        // Owner removes the only other member
        const removeMemberModal = await groupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Owner should still be in the group
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Group should show only 1 member (the owner)
        await groupDetailPage.waitForMemberCount(1);

        // Group title should still be visible
        await expect(groupDetailPage.getGroupTitle()).toHaveText(groupName);
    });

    simpleTest('should show member removal in real-time to all viewers', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create four users - Owner (removing), Member1 (being removed), Member2 (group watching), Member3 (dashboard watching)
        const { dashboardPage: ownerDashboardPage} = await newLoggedInBrowser();
        const { page: member1Page, dashboardPage: member1DashboardPage,} = await newLoggedInBrowser();
        const { page: member2Page, dashboardPage: member2DashboardPage, user: member2 } = await newLoggedInBrowser();
        const { page: member3Page, dashboardPage: member3DashboardPage, } = await newLoggedInBrowser();

        // Create page objects
        const member2GroupDetailPage = new GroupDetailPage(member2Page);

        // Get display names
        const member1DisplayName = await member1DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('MemberRemoveRT');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing real-time member removal');

        // All members join
        const shareLink = await groupDetailPage.getShareLink();

        const joinGroupPage1 = new JoinGroupPage(member1Page);
        await joinGroupPage1.joinGroupUsingShareLink(shareLink);
        const joinGroupPage2 = new JoinGroupPage(member2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        const joinGroupPage3 = new JoinGroupPage(member3Page);
        await joinGroupPage3.joinGroupUsingShareLink(shareLink);

        // Wait for all 4 members to be present
        await groupDetailPage.waitForMemberCount(4);
        await member2GroupDetailPage.waitForMemberCount(4);

        // Position viewers: Member2 stays on group page, Member3 goes to dashboard
        await member3DashboardPage.navigate();
        await member3DashboardPage.waitForGroupToAppear(groupName);

        // Owner removes Member1
        const removeMember1Modal = await groupDetailPage.clickRemoveMember(member1DisplayName);
        await removeMember1Modal.confirmRemoveMember();

        // CRITICAL TESTS:

        // 1. Member1 (being removed) should get 404 when accessing group
        await expect(async () => {
            const currentUrl = member1Page.url();
            if (currentUrl.includes('/404')) return;
            await member1Page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
            const newUrl = member1Page.url();
            if (newUrl.includes('/404')) return;
            throw new Error(`Expected 404 after removal, got: ${currentUrl}`);
        }).toPass({ timeout: 10000, intervals: [1000] });

        // 2. Member2 (watching group) should see member count decrease to 3 WITHOUT refresh
        await member2GroupDetailPage.waitForMemberCount(3);
        await member2GroupDetailPage.verifyMemberNotVisible(member1DisplayName);

        // 3. Owner should see updated member count
        await groupDetailPage.waitForMemberCount(3);
        await groupDetailPage.verifyMemberNotVisible(member1DisplayName);

        // 4. Member3 (on dashboard) should still see the group but removed member can't access
        await member3DashboardPage.waitForGroupToAppear(groupName);

        console.log('✅ Real-time member removal updates working correctly');
    });
});

test.describe('Member Management E2E', () => {
    test('should display current group members', async ({ newLoggedInBrowser }) => {
        const { dashboardPage, } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Members Display Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for member display');

        // Should show the current user as a member in the main content area
        // Use the groupDetailPage page object model instead of direct selectors
        await expect(groupDetailPage.getUserName(await dashboardPage.getCurrentUserDisplayName())).toBeVisible();

        // Look for members section showing 1 member
        await expect(groupDetailPage.getMemberCountElement()).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    });

    test('should show member in expense split options', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Split Test Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for split options');

        // Navigate to add expense
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        // Wait for expense form
        await expect(page.getByPlaceholder(PLACEHOLDERS.EXPENSE_DESCRIPTION)).toBeVisible();

        // Member should be visible in split section
        const splitHeading = expenseFormPage.getSplitBetweenHeading();
        await expect(splitHeading).toBeVisible();

        // The current user should be included and checked by default (payer is auto-selected)
        const userCheckbox = expenseFormPage.getSplitOptionsFirstCheckbox();
        await expect(userCheckbox).toBeVisible();
        await expect(userCheckbox).toBeChecked();

        // User name should be visible in split section
        const isUserInSplit = await expenseFormPage.isUserInSplitOptions(await dashboardPage.getCurrentUserDisplayName());
        expect(isUserInSplit).toBe(true);
    });

    test('should show creator as admin', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Admin Test Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for admin badge');

        // Creator should have admin badge - we expect a specific UI element
        // The UI must show "admin" text for the group creator
        await expect(groupDetailPage.getAdminBadge()).toBeVisible();
    });

    test('should show share functionality', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Share Test Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for sharing');

        // Share button should be visible and functional
        const shareButton = groupDetailPage.getShareButton();
        await expect(shareButton).toBeVisible();

        // Get share link (opens modal, waits for link, closes modal)
        const linkValue = await groupDetailPage.getShareLink();

        // Link should contain the join URL with linkId parameter
        expect(linkValue).toMatch(/\/join\?linkId=/);
    });

    test('should handle member count display', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Member Count Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for member count');

        // Should show member count
        const memberCount = groupDetailPage.getMemberCountElement();
        await expect(memberCount).toBeVisible();

        // Note: Balance display testing is centralized in balance-settlement.e2e.test.ts
    });
});

test.describe('Leave Group E2E', () => {
    test('user should be able to leave group and no longer access it', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - 404 errors and console errors are expected when trying to access removed group
        testInfo.annotations.push({ type: 'skip-error-checking', description: '404 errors and console errors expected when accessing removed group' });

        // Create two browser instances - owner and member
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        let { page: memberPage, dashboardPage: memberDashboardPage, user: member } = await newLoggedInBrowser();

        // Verify users are distinct
        expect(owner.email).not.toBe(member.email);

        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();
        expect(ownerDisplayName).not.toBe(memberDisplayName);

        // =============================================================
        // SETUP PHASE: Create group and add member
        // =============================================================

        const groupName = generateTestGroupName('LeaveTest');
        // Owner creates group
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing leave group functionality');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Get share link for member to join
        const shareLink = await ownerGroupDetailPage.getShareLink();

        // Member joins the group
        let memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Verify both users can see the group
        await ownerGroupDetailPage.waitForPage(groupId, 2);
        await memberGroupDetailPage.waitForPage(groupId, 2);

        // Member navigates to dashboard to verify group is visible
        memberDashboardPage = await memberGroupDetailPage.navigateToDashboard();

        // Verify member can see the group on their dashboard
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // Member navigates back to the group
        memberGroupDetailPage = await memberDashboardPage.clickGroupCard(groupName, groupId);

        // Member leaves the group
        const leaveModal = await memberGroupDetailPage.clickLeaveGroup();
        memberDashboardPage = await leaveModal.confirmLeaveGroup();

        // Verify the group is no longer visible on member's dashboard
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);

        // Member tries to access the group URL directly - should get 404 and console errors (expected)
        await memberPage.goto(`/groups/${groupId}`);

        // Should be redirected to 404 or error page since they're no longer a member
        // Console errors are expected here as the app tries to load group data that no longer exists for this user
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId)); // sanity check
        // Wait for member count to update (should now be 1 - just the owner)
        await ownerGroupDetailPage.waitForMemberCount(1);

        // Owner should still be able to access the group
        await ownerGroupDetailPage.page.reload();
        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
    });

    test('user with outstanding balance cannot leave group until settled', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - owner and member
        const { dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        let { page: memberPage, } = await newLoggedInBrowser();

        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();

        // Create group and add member
        const groupName = generateTestGroupName('BalanceLeaveTest');
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing leave with balance');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Add member to group
        const shareLink = await ownerGroupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Create an expense where owner paid and member owes money (member should be blocked from leaving)
        const expenseFormPage = await ownerGroupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription('Test expense for balance validation')
                .withAmount(60)
                .withCurrency('USD')
                .withPaidByDisplayName(ownerDisplayName)
                .withSplitType('equal')
                .build(),
        );

        // Wait for balances to update
        await ownerGroupDetailPage.waitForBalancesToLoad(groupId);
        await memberGroupDetailPage.waitForBalancesToLoad(groupId);

        // Member tries to leave group but should be blocked due to outstanding balance
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        const leaveModal = await memberGroupDetailPage.clickLeaveGroup();

        // Expect leave to be blocked and modal to be cancelled
        await leaveModal.expectLeaveBlockedAndCancel();

        // Verify member is still in the group (leave was blocked)
        await ownerGroupDetailPage.page.reload();
        await ownerGroupDetailPage.waitForMemberCount(2);
    });

    test('member removed while on group page should get 404 on refresh', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - 404 errors and console errors are expected when member is removed
        testInfo.annotations.push({ type: 'skip-error-checking', description: '404 errors and console errors expected when member removed from group' });

        // Create owner and member browsers
        const { page: ownerPage, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        const { page: memberPage, dashboardPage: memberDashboardPage } = await newLoggedInBrowser();

        // Get display names for member removal
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();

        // Create group and add member
        const groupName = generateTestGroupName('RemoveFromGroupPage');
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing member removal while on group page');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Member joins group
        const shareLink = await ownerGroupDetailPage.getShareLink();
        const memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Synchronize both users to ensure member is properly added
        await ownerGroupDetailPage.waitForPage(groupId, 2);
        await memberGroupDetailPage.waitForPage(groupId, 2);

        // Member stays on group page while owner removes them
        // Owner removes the member using the remove member feature
        const removeMemberModal = await ownerGroupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Member should automatically get redirected away from group (since they lost access)
        // Console errors are expected as the app tries to handle the removed access
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Owner should see member count updated to 1
        await ownerGroupDetailPage.waitForMemberCount(1);
        await ownerGroupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    test('member removed while on dashboard should see group disappear cleanly', async ({ newLoggedInBrowser }) => {
        // Create owner and member browsers
        const { page: ownerPage, dashboardPage: ownerDashboardPage } = await newLoggedInBrowser();
        let { page: memberPage, dashboardPage: memberDashboardPage } = await newLoggedInBrowser();

        // Get display names for member removal
        const memberDisplayName = await memberDashboardPage.getCurrentUserDisplayName();

        // Create group and add member
        const groupName = generateTestGroupName('RemoveFromDashboard');
        const ownerGroupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing member removal while on dashboard');
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Member joins group
        const shareLink = await ownerGroupDetailPage.getShareLink();
        let memberGroupDetailPage = await JoinGroupPage.joinGroupViaShareLink(memberPage, shareLink, groupId);

        // Synchronize both users to ensure member is properly added
        await ownerGroupDetailPage.waitForPage(groupId, 2);
        await memberGroupDetailPage.waitForPage(groupId, 2);

        // Member navigates to dashboard and verifies group is visible
        memberDashboardPage = await memberGroupDetailPage.navigateToDashboard();
        await memberDashboardPage.waitForGroupToAppear(groupName);

        // Owner removes member using the remove member feature
        const removeMemberModal = await ownerGroupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Group should no longer be visible on member's dashboard - this should happen cleanly without errors
        await memberDashboardPage.waitForGroupToNotBePresent(groupName);

        // Owner should see member count updated to 1
        await ownerGroupDetailPage.waitForMemberCount(1);
        await ownerGroupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });
});
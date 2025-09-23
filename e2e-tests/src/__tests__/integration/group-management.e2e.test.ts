import {expect, simpleTest} from '../../fixtures';
import {simpleTest as test} from '../../fixtures/simple-test.fixture';
import {TIMEOUT_CONTEXTS} from '../../config/timeouts';
import {PLACEHOLDERS} from '../../constants/selectors';
import {generateShortId} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';

/**
 * Consolidated Group Management E2E Tests
 *
 * Consolidated from:
 * - member-management.e2e.test.ts (member operations)
 * - group-lifecycle.e2e.test.ts (group editing/settings)
 * - member-lifecycle.e2e.test.ts (deprecated)
 *
 * This file provides comprehensive group and member management testing while eliminating
 * redundancy and reducing test complexity.
 */

simpleTest.describe('Member Management - Core Operations', () => {
    simpleTest('group owner should not see leave button and should see settings with member UI elements', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage }] = await createLoggedInBrowsers(1);

        // Create a group as owner
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({})

        // Verify Leave Group button is NOT visible for owner
        await expect(groupDetailPage.getLeaveGroupButton()).not.toBeVisible();

        // But Settings button should be visible
        await expect(groupDetailPage.getSettingsButton()).toBeVisible();

        // UI Components validation: Member count and expense split options
        await expect(groupDetailPage.getMemberCountElement()).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });

        // Test member visibility in expense split options
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);
        await expect(expenseFormPage.getSplitBetweenHeading()).toBeVisible();

        const userCheckbox = expenseFormPage.getSplitOptionsFirstCheckbox();
        await expect(userCheckbox).toBeVisible();
        await expect(userCheckbox).toBeChecked();

        const currentUserDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        const isUserInSplit = await expenseFormPage.isUserInSplitOptions(currentUserDisplayName);
        expect(isUserInSplit).toBe(true);
    });

    simpleTest('non-owner member should be able to leave group', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, memberGroupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage)

        // Verify member sees Leave Group button
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();

        // Member clicks Leave Group
        const leaveModal = await memberGroupDetailPage.clickLeaveGroup();

        // Confirm in the dialog
        const memberDashboardPage = await leaveModal.confirmLeaveGroup();
        await expect(memberDashboardPage.page).toHaveURL(/\/dashboard/);

        // Owner should see updated member count (only 1 member now)
        await groupDetailPage.waitForMemberCount(1);

        // Verify the member who left is no longer in the list
        await groupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    simpleTest('group owner should be able to remove member', async ({ createLoggedInBrowsers }, testInfo) => {
        // Skip error checking - removed members will get expected 404s when trying to access group
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create two browser instances - Owner and Member
        const [
            { dashboardPage: ownerDashboardPage },
            { page: memberPage, dashboardPage: memberDashboardPage }
        ] = await createLoggedInBrowsers(2);

        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

        // Owner creates group
        const [groupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({}, memberDashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Owner removes the member
        const removeMemberModal = await groupDetailPage.clickRemoveMember(memberDisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Verify Member gets 404 (since they're viewing the group page)
        await memberGroupDetailPage.waitForRedirectAwayFromGroup(groupId);

        // Owner should see updated member count (only 1 member: the owner)
        await groupDetailPage.waitForMemberCount(1);
        await groupDetailPage.verifyMemberNotVisible(memberDisplayName);
    });

    simpleTest('should handle edge case of removing last non-owner member', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [
            { page: ownerPage, dashboardPage: user1DashboardPage },
            { page: memberPage, dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();
        const groupName = await groupDetailPage.getGroupName();

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
});

simpleTest.describe('Member Management - Balance Restrictions', () => {
    simpleTest('should prevent leaving/removing members with outstanding balance', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [
            { dashboardPage: user1DashboardPage },
            { page: memberPage, dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const ownerDisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Owner creates group
        const [groupDetailPage, memberGroupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId()

        // Owner adds an expense that creates a balance
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        const expenseDescription = 'Test expense for balance';
        await expenseFormPage.submitExpense({
            description: expenseDescription,
            amount: 100,
            currency: 'JPY',
            paidByDisplayName: ownerDisplayName,
            splitType: 'equal',
            participants: [ownerDisplayName, memberDisplayName],
        });

        // Wait for expense to be processed and balances to update
        await groupDetailPage.waitForExpense(expenseDescription);
        await groupDetailPage.verifyDebtRelationship(memberDisplayName, ownerDisplayName, "¥50");

        await memberGroupDetailPage.waitForExpense(expenseDescription);
        await memberGroupDetailPage.verifyDebtRelationship(memberDisplayName, ownerDisplayName, "¥50");

        // Member tries to leave group
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        const leaveModalWithBalance = await memberGroupDetailPage.clickLeaveGroup();

        // Should see error message about outstanding balance
        await leaveModalWithBalance.verifyLeaveErrorMessage();

        // Cancel the leave attempt
        await leaveModalWithBalance.cancelLeaveGroup();

        // Owner tries to remove member - button should be disabled
        const removeButton = groupDetailPage.getRemoveMemberButton(memberDisplayName);
        await expect(removeButton).toBeDisabled({ timeout: 5000 });
    });

    simpleTest('should allow leaving/removing after settlement clears balance', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [
            { dashboardPage: user1DashboardPage },
            { page: memberPage, dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const ownerDisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, memberGroupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        const groupId = groupDetailPage.inferGroupId();

        // Create expense that creates a balance
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription('Test expense for balance validation')
                .withAmount(60)
                .withCurrency('JPY')
                .withPaidByDisplayName(ownerDisplayName)
                .withSplitType('equal')
                .withParticipants([ownerDisplayName, memberDisplayName])
                .build(),
        );

        // Wait for balances to update
        await groupDetailPage.waitForPage(groupId, 2);
        await memberGroupDetailPage.waitForPage(groupId, 2);

        // Member records a settlement to clear the balance
        const settlementFormPage = await memberGroupDetailPage.clickSettleUpButton(2);

        // Fill and submit settlement for the full owed amount (¥30 JPY in this case)
        await settlementFormPage.fillAndSubmitSettlement('30', ownerDisplayName, 'JPY');

        // Wait for settlement to process and balances to update
        await groupDetailPage.verifyAllSettledUp(groupId);
        await memberGroupDetailPage.verifyAllSettledUp(groupId);

        // Now member should be able to leave
        const leaveModalAfterSettlement = await memberGroupDetailPage.clickLeaveGroup();
        await leaveModalAfterSettlement.confirmLeaveGroup();

        // Member should be redirected to dashboard
        await expect(memberPage).toHaveURL(/\/dashboard/);
    });
});

simpleTest.describe('Member Management - Real-time Updates', () => {
    simpleTest('should show member removal in real-time to all viewers', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create three users - Owner (removing), Member1 (being removed), Member2 (watching)
        const [
            { dashboardPage: ownerDashboardPage },
            { page: member1Page, dashboardPage: member1DashboardPage },
            { page: member2Page, dashboardPage: member2DashboardPage }
        ] = await createLoggedInBrowsers(3);

        // Get display names
        const member1DisplayName = await member1DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, member1GroupDetailPage, member2GroupDetailPage] = await ownerDashboardPage.createMultiUserGroup(
            {}, member1DashboardPage, member2DashboardPage);

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

        // 2. Member2 (watching group) should see member count decrease to 2 WITHOUT refresh
        await member2GroupDetailPage.waitForMemberCount(2);
        await member2GroupDetailPage.verifyMemberNotVisible(member1DisplayName);

        // 3. Owner should see updated member count
        await groupDetailPage.waitForMemberCount(2);
        await groupDetailPage.verifyMemberNotVisible(member1DisplayName);
    });

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
        const expenseDescription = `Edge Leave Test ${generateShortId()}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(60)
                .withCurrency('JPY')
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
});

simpleTest.describe('Member Management - Group Settings', () => {
    simpleTest('should comprehensively test group editing validation and functionality', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

        // Verify starting state
        await expect(page).toHaveURL(/\/dashboard/);

        // Create a group
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
        const groupId = groupDetailPage.inferGroupId();
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for group page to load
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify settings button is visible for owner
        const settingsButton = groupDetailPage.getSettingsButton();
        await expect(settingsButton).toBeVisible();

        // === Test 1: Basic editing functionality ===
        let editModal = await groupDetailPage.openEditGroupModal();

        // Edit the group name and description
        await editModal.editGroupName('Updated Group Name');
        await editModal.editDescription('Updated description text');

        // Save changes (this will wait for modal to close)
        await editModal.saveChanges();

        // Wait for save to complete and real-time updates to propagate
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Verify the group name was updated (relying on real-time updates)
        await groupDetailPage.waitForGroupTitle('Updated Group Name');
        await groupDetailPage.waitForGroupDescription('Updated description text');

        // === Test 2: Validation scenarios ===
        editModal = await groupDetailPage.openEditGroupModal();

        // Try to save with empty name
        await editModal.clearGroupName();
        await expect(editModal.getSaveButton()).toBeVisible();
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Try with too short name
        await editModal.editGroupName('A');
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Try with valid name
        await editModal.editGroupName('Valid Name');
        await expect(editModal.getSaveButton()).toBeEnabled();

        // Clear again and check button is disabled
        await editModal.clearGroupName();
        await expect(editModal.getSaveButton()).toBeDisabled();

        // === Test 3: No changes detection ===
        // Reset to original values
        await editModal.editGroupName('Updated Group Name');
        await editModal.editDescription('Updated description text');

        // Save button should be disabled when no changes from current state
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Make a change
        await editModal.editGroupName('Changed Name');
        await expect(editModal.getSaveButton()).toBeEnabled();

        // Revert the change
        await editModal.editGroupName('Updated Group Name');
        await expect(editModal.getSaveButton()).toBeDisabled();

        // Cancel the modal
        await editModal.cancel();
        await expect(editModal.getModal()).not.toBeVisible();
    });

    simpleTest('should not show settings button for non-owner', async ({ createLoggedInBrowsers }) => {
        // Create two browser sessions with pooled users
        const [
            { page: ownerPage, dashboardPage },
            { page: memberPage, dashboardPage: memberDashboardPage },
        ] = await createLoggedInBrowsers(2);

        // Owner creates a group with member
        const [ownerGroupDetailPage, memberGroupDetailPage] = await dashboardPage.createMultiUserGroup({}, memberDashboardPage);
        const groupId = ownerGroupDetailPage.inferGroupId();
        const groupName = await ownerGroupDetailPage.getGroupName();

        await expect(ownerPage).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(memberPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify owner CAN see settings button
        const ownerSettingsButton = ownerGroupDetailPage.getSettingsButton();
        await expect(ownerSettingsButton).toBeVisible();

        // Verify member CANNOT see settings button
        const memberSettingsButton = memberGroupDetailPage.getSettingsButton();
        await expect(memberSettingsButton).not.toBeVisible();

        // Verify both can see the group name
        await expect(ownerGroupDetailPage.getGroupTitle()).toHaveText(groupName);
        await expect(memberGroupDetailPage.getGroupTitle()).toHaveText(groupName);
    });
});


simpleTest.describe('Group Deletion', () => {
    simpleTest('comprehensive group deletion scenarios with dashboard updates and member redirects', async ({ createLoggedInBrowsers }, testInfo) => {
        // Skip error checking - console errors may occur during redirect
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Console errors may occur during redirect when group is deleted while member viewing it' });

        // Create three browser instances to test different deletion scenarios
        let [
            { dashboardPage: ownerDashboardPage },
            { page: memberPage1, dashboardPage: memberDashboardPage1 },
            { dashboardPage: memberDashboardPage2 }
        ] = await createLoggedInBrowsers(3);

        // Scenario 1: Dashboard real-time updates when group is deleted
        let [ownerGroupDetailPage, member1GroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({}, memberDashboardPage1);
        const groupId1 = ownerGroupDetailPage.inferGroupId();
        const groupName1 = await ownerGroupDetailPage.getGroupName();

        // Both users navigate to dashboard to see the group
        ownerDashboardPage = await ownerGroupDetailPage.navigateToDashboard();
        memberDashboardPage1 = await member1GroupDetailPage.navigateToDashboard();

        // Verify both users can see the group on dashboard
        await ownerDashboardPage.waitForGroupToAppear(groupName1);
        await memberDashboardPage1.waitForGroupToAppear(groupName1);

        // Owner clicks on the group from dashboard to navigate to it
        ownerGroupDetailPage = await ownerDashboardPage.clickGroupCard(groupName1);

        // Delete the group
        const editModal1 = await ownerGroupDetailPage.openEditGroupModal();
        await editModal1.clickDeleteGroup();
        ownerDashboardPage = await editModal1.handleDeleteConfirmDialog(groupName1);

        // CRITICAL TEST: Both dashboards should update in real-time WITHOUT reload
        await ownerDashboardPage.waitForGroupToNotBePresent(groupName1);
        await memberDashboardPage1.waitForGroupToNotBePresent(groupName1);

        // Scenario 2: Member redirect when group deleted while viewing
        let [ownerGroupDetailPage2, member2GroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({}, memberDashboardPage2);
        const groupId2 = ownerGroupDetailPage2.inferGroupId();
        const groupName2 = await ownerGroupDetailPage2.getGroupName();

        // Owner navigates to dashboard to delete the group
        ownerDashboardPage = await ownerGroupDetailPage2.navigateToDashboard();
        await ownerDashboardPage.waitForDashboard();
        await ownerDashboardPage.waitForGroupToAppear(groupName2);

        // Owner clicks on the group from dashboard to delete it
        ownerGroupDetailPage2 = await ownerDashboardPage.clickGroupCard(groupName2);

        // Owner deletes the group while member is still viewing it
        const editModal2 = await ownerGroupDetailPage2.openEditGroupModal();
        await editModal2.clickDeleteGroup();
        ownerDashboardPage = await editModal2.handleDeleteConfirmDialog(groupName2);

        // CRITICAL TEST: Member should be redirected away when group is deleted
        await member2GroupDetailPage.waitForRedirectAwayFromGroup(groupId2);
    });
});
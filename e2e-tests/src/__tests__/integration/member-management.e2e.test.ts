import {expect, simpleTest} from '../../fixtures';
import {simpleTest as test} from '../../fixtures/simple-test.fixture';
import {TIMEOUT_CONTEXTS} from '../../config/timeouts';
import {PLACEHOLDERS} from '../../constants/selectors';
import {generateShortId} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';

/**
 * Consolidated Member Management E2E Tests
 *
 * Consolidated from:
 * - member-lifecycle.e2e.test.ts (leave/remove operations)
 * - realtime-comprehensive.e2e.test.ts (member removal edge cases)
 * - group-deletion.e2e.test.ts (member behavior during group deletion)
 *
 * This file provides comprehensive member management testing while eliminating
 * redundancy and reducing test complexity from 3-4 user scenarios to 2 users where possible.
 */

simpleTest.describe('Member Management - Core Operations', () => {
    simpleTest('group owner should not see leave button and should see settings', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage }] = await createLoggedInBrowsers(1);

        // Create a group as owner
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({})

        // Verify Leave Group button is NOT visible for owner
        await expect(groupDetailPage.getLeaveGroupButton()).not.toBeVisible();

        // But Settings button should be visible
        await expect(groupDetailPage.getSettingsButton()).toBeVisible();
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
            currency: 'USD',
            paidByDisplayName: ownerDisplayName,
            splitType: 'equal',
            participants: [ownerDisplayName, memberDisplayName],
        });

        // Wait for expense to be processed and balances to update
        await groupDetailPage.waitForExpense(expenseDescription);
        await groupDetailPage.verifyDebtRelationship(memberDisplayName, ownerDisplayName, "$50");

        await memberGroupDetailPage.waitForExpense(expenseDescription);
        await memberGroupDetailPage.verifyDebtRelationship(memberDisplayName, ownerDisplayName, "$50");

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
                .withCurrency('USD')
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

        // Fill and submit settlement for the full owed amount (30 in this case)
        await settlementFormPage.fillAndSubmitSettlement('30', ownerDisplayName);

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
});

test.describe('Member Management - UI Components', () => {
    test('should display current group members', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage }] = await createLoggedInBrowsers(1);

        // Navigate to dashboard
        await dashboardPage.waitForDashboard();

        // Create a group
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});

        // Should show the current user as a member in the main content area
        // Use the groupDetailPage page object model instead of direct selectors
        await expect(groupDetailPage.getUserName(await dashboardPage.header.getCurrentUserDisplayName())).toBeVisible();

        // Look for members section showing 1 member
        await expect(groupDetailPage.getMemberCountElement()).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    });

    test('should show member in expense split options', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

        // Create a group
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});

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
        const isUserInSplit = await expenseFormPage.isUserInSplitOptions(await dashboardPage.header.getCurrentUserDisplayName());
        expect(isUserInSplit).toBe(true);
    });

    test('should show creator as admin', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage }] = await createLoggedInBrowsers(1);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});

        // Creator should have admin badge - we expect a specific UI element
        // The UI must show "admin" text for the group creator
        await expect(groupDetailPage.getAdminBadge()).toBeVisible();
    });

    test('should show share functionality', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage }] = await createLoggedInBrowsers(1);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});

        // Share button should be visible and functional
        const shareButton = groupDetailPage.getShareButton();
        await expect(shareButton).toBeVisible();

        // Get share link (opens modal, waits for link, closes modal)
        const linkValue = await groupDetailPage.getShareLink();

        // Link should contain the join URL with linkId parameter
        expect(linkValue).toMatch(/\/join\?linkId=/);
    });

    test('should handle member count display', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage }] = await createLoggedInBrowsers(1);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});

        // Should show member count
        const memberCount = groupDetailPage.getMemberCountElement();
        await expect(memberCount).toBeVisible();

        // Note: Balance display testing is centralized in balance-visualization.e2e.test.ts
    });
});
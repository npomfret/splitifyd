import {expect, simpleTest} from '../../fixtures';
import {simpleTest as test} from '../../fixtures/simple-test.fixture';
import {TIMEOUT_CONTEXTS} from '../../config/timeouts';
import {PLACEHOLDERS} from '../../constants/selectors';
import {GroupDetailPage, JoinGroupPage} from '../../pages';
import {generateShortId, generateTestGroupName} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';

simpleTest.describe('Member Management - Owner Restrictions', () => {
    simpleTest('group owner should not see leave button and should see settings', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage }] = await createLoggedInBrowsers(1);

        // Create a group as owner
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup({})

        // Verify Leave Group button is NOT visible for owner
        await expect(groupDetailPage.getLeaveGroupButton()).not.toBeVisible();

        // But Settings button should be visible
        await expect(groupDetailPage.getSettingsButton()).toBeVisible();
    });
});

simpleTest.describe('Member Management - Multi-User Operations', () => {
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

    simpleTest('group owner should be able to remove multiple members', async ({ createLoggedInBrowsers }, testInfo) => {
        // Skip error checking - removed members will get expected 404s when trying to access group
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create three browser instances - Owner, Member1 (on group page), Member2 (on dashboard)
        const [
            { dashboardPage: ownerDashboardPage },
            { dashboardPage: member1DashboardPage },
            { page: member2Page, dashboardPage: member2DashboardPage }
        ] = await createLoggedInBrowsers(3);

        // Create page objects

        const member1DisplayName = await member1DashboardPage.header.getCurrentUserDisplayName();
        const member2DisplayName = await member2DashboardPage.header.getCurrentUserDisplayName();

        // Owner creates group
        const [groupDetailPage, member1GroupDetailPage, member2GroupDetailPage] = await ownerDashboardPage.createMultiUserGroup(
            {}, member1DashboardPage, member2DashboardPage);

        // Get group details for later use
        const groupId = groupDetailPage.inferGroupId();
        const groupName = await groupDetailPage.getGroupName();

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

    simpleTest('should prevent leaving group with outstanding balance', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [
            { dashboardPage: user1DashboardPage },
            { page: memberPage, dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        // Create page objects

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

    simpleTest('should prevent owner from removing member with outstanding balance', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - Owner and Member
        const [
            { dashboardPage: user1DashboardPage },
            { page: memberPage, dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const ownerDisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const memberDisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Owner creates group
        const [groupDetailPage, memberGroupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Member adds expense creating a balance
        const expenseFormPage = await memberGroupDetailPage.clickAddExpenseButton(2);
        const description = `Member expense ${generateShortId()}`;
        await expenseFormPage.submitExpense({
            description: description,
            amount: 60,
            currency: 'USD',
            paidByDisplayName: memberDisplayName,
            splitType: 'equal',
            participants: [ownerDisplayName, memberDisplayName],
        });

        // Wait for balances to update
        await groupDetailPage.waitForExpense(description);
        await memberGroupDetailPage.waitForExpense(description);

        // Owner tries to remove member - button should be disabled
        const removeButton = groupDetailPage.getRemoveMemberButton(memberDisplayName);
        await expect(removeButton).toBeDisabled({ timeout: 5000 });
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

    simpleTest('should show member removal in real-time to all viewers', async ({ createLoggedInBrowsers }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create four users - Owner (removing), Member1 (being removed), Member2 (group watching), Member3 (dashboard watching)
        const [
            { dashboardPage: ownerDashboardPage },
            { page: member1Page, dashboardPage: member1DashboardPage },
            { page: member2Page, dashboardPage: member2DashboardPage },
            { page: member3Page, dashboardPage: member3DashboardPage }
        ] = await createLoggedInBrowsers(4);

        // Get display names
        const member1DisplayName = await member1DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, member1GroupDetailPage, member2GroupDetailPage, member3GroupDetailPage] = await ownerDashboardPage.createMultiUserGroup(
            {}, member1DashboardPage, member2DashboardPage, member3DashboardPage);

        const groupName = await groupDetailPage.getGroupName();

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
    });
});

test.describe('Member Management E2E', () => {
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

        // Note: Balance display testing is centralized in balance-settlement.e2e.test.ts
    });
});

test.describe('Leave Group E2E', () => {
    test('user should be able to leave group and no longer access it', async ({ createLoggedInBrowsers }, testInfo) => {
        // Skip error checking - 404 errors and console errors are expected when trying to access removed group
        testInfo.annotations.push({ type: 'skip-error-checking', description: '404 errors and console errors expected when accessing removed group' });

        // Create two browser instances - owner and member
        let [
            { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner },
            { page: memberPage, user: member, dashboardPage: memberDashboardPage }
        ] = await createLoggedInBrowsers(2);

        // Verify users are distinct
        expect(owner.email).not.toBe(member.email);

        const ownerDisplayName = await ownerDashboardPage.header.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();
        expect(ownerDisplayName).not.toBe(memberDisplayName);

        // =============================================================
        // SETUP PHASE: Create group and add member
        // =============================================================

        let [ownerGroupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({}, memberDashboardPage);
        const groupName = await ownerGroupDetailPage.getGroupName();
        const groupId = ownerGroupDetailPage.inferGroupId();

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

    test('user with outstanding balance cannot leave group until settled', async ({ createLoggedInBrowsers }) => {
        // Create two browser instances - owner and member
        const [
            { dashboardPage: ownerDashboardPage },
            { page: memberPage, dashboardPage: memberDashboardPage },
        ] = await createLoggedInBrowsers(2);

        const ownerDisplayName = await ownerDashboardPage.header.getCurrentUserDisplayName();
        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

        const [ownerGroupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({}, memberDashboardPage);
        const groupId = ownerGroupDetailPage.inferGroupId();

        // Create an expense where owner paid and member owes money (member should be blocked from leaving)
        const expenseFormPage = await ownerGroupDetailPage.clickAddExpenseButton(2);
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
        await ownerGroupDetailPage.waitForPage(groupId, 2);
        await memberGroupDetailPage.waitForPage(groupId, 2);

        // Member tries to leave group but should be blocked due to outstanding balance
        await expect(memberGroupDetailPage.getLeaveGroupButton()).toBeVisible();
        const leaveModal = await memberGroupDetailPage.clickLeaveGroup();

        // Expect leave to be blocked and modal to be cancelled
        await leaveModal.expectLeaveBlockedAndCancel();

        // Verify member is still in the group (leave was blocked)
        await ownerGroupDetailPage.page.reload();
        await ownerGroupDetailPage.waitForMemberCount(2);
    });

    test('member removed while on group page should get 404 on refresh', async ({ createLoggedInBrowsers }, testInfo) => {
        // Skip error checking - 404 errors and console errors are expected when member is removed
        testInfo.annotations.push({ type: 'skip-error-checking', description: '404 errors and console errors expected when member removed from group' });

        // Create owner and member browsers
        const [
            { dashboardPage: ownerDashboardPage },
            { dashboardPage: memberDashboardPage }
        ] = await createLoggedInBrowsers(2);

        // Get display names for member removal
        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

        const [ownerGroupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({}, memberDashboardPage);
        const groupId = ownerGroupDetailPage.inferGroupId();

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

    test('member removed while on dashboard should see group disappear cleanly', async ({ createLoggedInBrowsers }) => {
        // Create owner and member browsers
        let [
            { dashboardPage: ownerDashboardPage },
            { dashboardPage: memberDashboardPage  }
        ] = await createLoggedInBrowsers(2);

        // Get display names for member removal
        const memberDisplayName = await memberDashboardPage.header.getCurrentUserDisplayName();

        const [ownerGroupDetailPage, memberGroupDetailPage] = await ownerDashboardPage.createMultiUserGroup({}, memberDashboardPage);
        const groupName = await ownerGroupDetailPage.getGroupName();

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
import { CommentBuilder, ExpenseDTOBuilder, GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementWithMembersBuilder, ThemeBuilder } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockApiFailure, mockGroupCommentsApi, mockGroupDetailApi, mockPendingMembersApi, mockUpdateGroupPermissionsApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';
import { createJsonHandler } from '@/test/msw/handlers.ts';

test.describe('Group Detail - Authentication and Navigation', () => {
    test('should redirect unauthenticated user to login', async ({ pageWithLogging: page }) => {
        // mockFirebase fixture starts with logged-out state
        await page.goto('/groups/test-group-id');

        // Should be redirected to login page
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { name: /sign.*in/i })).toBeVisible();
    });

    test('should show loading state while group data loads', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'test-group-123';

        // Navigate to group (don't mock APIs yet to see loading state)
        await page.goto(`/groups/${groupId}`);

        // Verify loading state appears
        await expect(page).toHaveURL(`/groups/${groupId}`);
        await groupDetailPage.verifyLoadingState();
    });

    test('should display group details for authenticated user', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId('group-abc')
            .withName('Test Group')
            .withDescription('A test group description')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        // Set up mocks
        await mockGroupDetailApi(page, 'group-abc', fullDetails);
        await mockGroupCommentsApi(page, 'group-abc');

        // Navigate to group
        await groupDetailPage.navigateToGroup('group-abc');

        // Verify group details are displayed
        await groupDetailPage.verifyGroupDetailPageLoaded('Test Group');
    });
});

test.describe('Group Detail - Members Display', () => {
    test('should display all group members', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-members-test';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Members Test Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('Alice Smith')
                .withGroupDisplayName('Alice Smith')
                .withTheme(
                    ThemeBuilder
                        .red()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-3')
                .withDisplayName('Bob Jones')
                .withGroupDisplayName('Bob Jones')
                .withTheme(
                    new ThemeBuilder()
                        .withName('green')
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify all members are displayed
        await groupDetailPage.verifyMembersDisplayed(3);
        await groupDetailPage.verifyMemberDisplayed(testUser.displayName);
        await groupDetailPage.verifyMemberDisplayed('Alice Smith');
        await groupDetailPage.verifyMemberDisplayed('Bob Jones');
    });

    test('should show member count in header', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-count-test';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Count Test Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('User 2')
                .withGroupDisplayName('User 2')
                .withTheme(
                    ThemeBuilder
                        .red()
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify member count is displayed
        await expect(groupDetailPage.getMemberCount()).toContainText('2');
    });
});

test.describe('Group Detail - Security Settings', () => {
    test('should allow admins to open security modal and apply presets', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-security-test';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Security Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withMemberRole('admin')
                .withMemberStatus('active')
                .withTheme(ThemeBuilder.blue().build())
                .build(),
            new GroupMemberBuilder()
                .withUid('member-1')
                .withDisplayName('Alex Rivera')
                .withGroupDisplayName('Alex Rivera')
                .withMemberRole('member')
                .withMemberStatus('active')
                .withTheme(ThemeBuilder.red().build())
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await setupSuccessfulApiMocks(page);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);
        await mockPendingMembersApi(page, groupId, []);
        await mockUpdateGroupPermissionsApi(page, groupId, { message: 'Security settings updated.' });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await expect(groupDetailPage.getSecuritySettingsButton()).toBeVisible();

        const settingsModal = await groupDetailPage.openSecuritySettings();
        await settingsModal.waitForSecurityTab();

        await settingsModal.selectPreset('managed');
        await expect(settingsModal.getSecurityUnsavedBanner()).toBeVisible();

        const permissionsRequestPromise = page.waitForRequest(
            (request) => request.url().includes(`/api/groups/${groupId}/security/permissions`) && request.method() === 'PATCH',
        );

        await settingsModal.saveSecuritySettings();

        const permissionRequest = await permissionsRequestPromise;
        expect(permissionRequest.postDataJSON()).toEqual({
            expenseEditing: 'owner-and-admin',
            expenseDeletion: 'owner-and-admin',
            memberInvitation: 'admin-only',
            memberApproval: 'admin-required',
            settingsManagement: 'admin-only',
        });
        await expect(settingsModal.getSecuritySuccessAlert()).toBeVisible();
        await expect(settingsModal.getSecurityUnsavedBanner()).not.toBeVisible();

        await settingsModal.clickFooterClose();
        await expect(page.getByTestId('group-settings-modal-title')).toBeHidden();
    });
});

test.describe('Group Detail - Comments', () => {
    test('should display existing comments for the group', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-comments-visible';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Comments Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const existingComment = new CommentBuilder()
            .withId('comment-existing')
            .withAuthor(testUser.uid, testUser.displayName)
            .withText('Welcome to the group!')
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withComments({ comments: [existingComment], hasMore: false })
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, [existingComment]);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyCommentsSection();
        await groupDetailPage.waitForCommentCount(1);
        await groupDetailPage.verifyCommentVisible(existingComment.text);
    });

    test('should submit a new comment and reset the input state', async ({ authenticatedPage, msw }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-comments-submit';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Comments Submission Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const newCommentText = 'This group is great!';
        const createdComment = new CommentBuilder()
            .withId('comment-created')
            .withAuthor(testUser.uid, testUser.displayName)
            .withText(newCommentText)
            .build();

        await msw.use(createJsonHandler('POST', `/api/groups/${groupId}/comments`, createdComment, { once: true }));

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();
        await groupDetailPage.verifyCommentsSection();

        const commentRequestPromise = page.waitForRequest(
            (request) => request.method() === 'POST' && request.url().endsWith(`/api/groups/${groupId}/comments`),
        );

        await groupDetailPage.addComment(newCommentText);

        const commentRequest = await commentRequestPromise;
        expect(commentRequest.postDataJSON()).toEqual({ text: newCommentText });

        await expect(page.locator('[data-testid="comment-error-message"]')).toHaveCount(0);
    });
});

test.describe('Group Detail - Sidebar Sections', () => {
    test('should collapse sidebar sections by default and expand on toggle', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-sidebar-collapsed';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Sidebar Sections Group')
            .build();

        const memberSelf = new GroupMemberBuilder()
            .withUid(testUser.uid)
            .withDisplayName(testUser.displayName)
            .withGroupDisplayName(testUser.displayName)
            .withTheme(
                ThemeBuilder
                    .blue()
                    .build(),
            )
            .build();

        const memberTwo = new GroupMemberBuilder()
            .withUid('member-two')
            .withDisplayName('Member Two')
            .withGroupDisplayName('Member Two')
            .withTheme(
                ThemeBuilder
                    .red()
                    .build(),
            )
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(memberSelf.uid, memberSelf.displayName ?? 'Member One', memberTwo.uid, memberTwo.displayName ?? 'Member Two', 42)
            .build();

        const sidebarComment = new CommentBuilder()
            .withId('comment-sidebar')
            .withAuthor(memberTwo.uid, memberTwo.displayName ?? 'Member Two')
            .withText('Sidebar comment content')
            .build();

        const sidebarSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-sidebar')
            .withGroupId(groupId)
            .withPayer(memberSelf)
            .withPayee(memberTwo)
            .withAmount(18, 'USD')
            .withNote('Sidebar settlement')
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([memberSelf, memberTwo], false)
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([sidebarSettlement], false)
            .withComments({ comments: [sidebarComment], hasMore: false })
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, [sidebarComment]);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.expectBalancesCollapsed();
        await groupDetailPage.expectCommentsCollapsed();
        await groupDetailPage.expectSettlementsCollapsed();

        await groupDetailPage.ensureBalancesSectionExpanded();
        await expect(groupDetailPage.getDebtItems()).toHaveCount(1);

        await groupDetailPage.ensureCommentsSectionExpanded();
        await groupDetailPage.waitForCommentCount(1);

        await groupDetailPage.ensureSettlementHistoryOpen();
        await expect(page.getByTestId('settlement-item')).toHaveCount(1);
    });
});

test.describe('Group Detail - Expenses Display', () => {
    test('should display all expenses', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-expenses-test';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Expenses Test Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const expenses = [
            new ExpenseDTOBuilder()
                .withId('exp-1')
                .withDescription('Groceries')
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .withGroupId(groupId)
                .build(),
            new ExpenseDTOBuilder()
                .withId('exp-2')
                .withDescription('Dinner')
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .withGroupId(groupId)
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withExpenses(expenses)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify expenses are displayed
        await groupDetailPage.verifyExpensesDisplayed(2);
        await groupDetailPage.verifyExpenseDisplayed('Groceries');
        await groupDetailPage.verifyExpenseDisplayed('Dinner');
    });

    test('should show empty state when no expenses exist', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-empty-expenses';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Empty Expenses Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify empty state is displayed
        await groupDetailPage.verifyEmptyExpensesState();
    });

    test('should show expense count in header', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-expense-count';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Expense Count Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const expenses = [
            new ExpenseDTOBuilder()
                .withId('exp-1')
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .withGroupId(groupId)
                .build(),
            new ExpenseDTOBuilder()
                .withId('exp-2')
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .withGroupId(groupId)
                .build(),
            new ExpenseDTOBuilder()
                .withId('exp-3')
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .withGroupId(groupId)
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withExpenses(expenses)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify expense count is displayed
        await expect(groupDetailPage.getExpenseCount()).toContainText('3');
    });
});

test.describe('Group Detail - Balance Display', () => {
    test('should show "All settled up" when no debts exist', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-settled-up';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Settled Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify settled up message is displayed
        await groupDetailPage.verifySettledUp();
    });

    test('should display debts when balances exist', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-with-debts';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Group With Debts')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('Alice')
                .withGroupDisplayName('Alice')
                .withTheme(
                    ThemeBuilder
                        .red()
                        .build(),
                )
                .build(),
        ];

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(testUser.uid, testUser.displayName, 'user-2', 'Alice', 25.0)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify debts are displayed
        await groupDetailPage.verifyHasDebts();
    });
});

test.describe('Group Detail - Permission Checks', () => {
    test('should show owner actions for group owner', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'owner-group';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Owner Group')
            .withCreatedBy(testUser.uid)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('User 2')
                .withGroupDisplayName('User 2')
                .withTheme(
                    ThemeBuilder
                        .red()
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify owner actions are available
        await groupDetailPage.verifyOwnerActions();
    });

    test('should show member actions for non-owner', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'member-group';

        const group = GroupDTOBuilder
            .groupForUser('other-user-id')
            .withId(groupId)
            .withName('Member Group')
            .withCreatedBy('other-user-id')
            .withPermissions({
                memberApproval: 'admin-required',
            })
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('other-user-id')
                .withDisplayName('Other User')
                .withGroupDisplayName('Other User')
                .withTheme(
                    new ThemeBuilder()
                        .withName('orange')
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify member actions are available (can access Settings for Identity tab, can leave group)
        await groupDetailPage.verifyMemberActions();
    });

    test('should not show leave button for last member', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'last-member-group';

        const group = GroupDTOBuilder
            .groupForUser('other-user-id')
            .withId(groupId)
            .withName('Last Member Group')
            .withCreatedBy('other-user-id')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify leave button is not visible (last member)
        await groupDetailPage.verifyCannotLeaveGroup();
    });
});

test.describe('Group Detail - Error Handling', () => {
    test('should handle group not found error', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'non-existent-group';

        // Mock 404 error
        await mockApiFailure(page, `/api/groups/${groupId}/full-details`, 404, { error: 'Group not found' });

        await page.goto(`/groups/${groupId}`);

        // Verify 404 page is displayed
        await groupDetailPage.verifyErrorState('Page not found');
    });

    test('should handle permission denied error', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'forbidden-group';

        // Mock 403 error
        await mockApiFailure(page, `/api/groups/${groupId}/full-details`, 403, { error: 'Permission denied' });

        await page.goto(`/groups/${groupId}`);

        // Verify error page is displayed
        await groupDetailPage.verifyErrorState('Permission denied');
    });

    test('should handle API server error', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'error-group';

        // Mock 500 error
        await mockApiFailure(page, `/api/groups/${groupId}/full-details`, 500, { error: 'Internal Server Error' });

        await page.goto(`/groups/${groupId}`);

        // Verify error state is displayed
        await groupDetailPage.verifyErrorState('Internal Server Error');
    });

    test('should handle network timeout error', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'timeout-group';

        // Mock 408 timeout error
        await mockApiFailure(page, `/api/groups/${groupId}/full-details`, 408, { error: 'Request timeout' });

        await page.goto(`/groups/${groupId}`);

        // Verify error state is displayed
        await groupDetailPage.verifyErrorState('Request timeout');
    });
});

test.describe('Group Detail - Modal Interactions', () => {
    test('should open edit group modal when clicking edit button', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'edit-modal-group';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Edit Modal Group')
            .withCreatedBy(testUser.uid)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Click edit button and verify modal opens
        const editModal = await groupDetailPage.clickEditGroupAndOpenModal();

        // Verify modal is open
        await editModal.verifyModalOpen();
    });
});

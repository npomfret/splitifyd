import {ExpenseDTOBuilder, GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder} from '@splitifyd/test-support';
import {expect, test} from '../../utils/console-logging-fixture';
import {mockApiFailure, mockGroupCommentsApi, mockGroupDetailApi} from '../../utils/mock-firebase-service';

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
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('Alice Smith')
                .withTheme(
                    ThemeBuilder
                        .red()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-3')
                .withDisplayName('Bob Jones')
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
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('User 2')
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
                .withAmount(50.0)
                .build(),
            new ExpenseDTOBuilder()
                .withId('exp-2')
                .withDescription('Dinner')
                .withAmount(75.5)
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
                .build(),
            new ExpenseDTOBuilder()
                .withId('exp-2')
                .build(),
            new ExpenseDTOBuilder()
                .withId('exp-3')
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
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('Alice')
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
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('User 2')
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
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withTheme(
                    ThemeBuilder
                        .blue()
                        .build(),
                )
                .build(),
            new GroupMemberBuilder()
                .withUid('other-user-id')
                .withDisplayName('Other User')
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

        // Verify member actions are available (cannot edit, can leave)
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

import { test, expect } from '../../utils/console-logging-fixture';
import {
    createMockFirebase,
    mockGroupDetailApi,
    mockGroupCommentsApi,
    mockApiFailure,
    mockFullyAcceptedPoliciesApi,
    MockFirebase
} from '../../utils/mock-firebase-service';
import {
    ClientUserBuilder,
    GroupBuilder,
    GroupFullDetailsBuilder,
    GroupMemberDTOBuilder,
    ExpenseBuilder,
    GroupDetailPage
} from '@splitifyd/test-support';

// Configure all tests to run in serial mode for browser reuse
test.describe.configure({ mode: 'serial' });

test.describe('Group Detail - Authentication and Navigation', () => {
    let mockFirebase: MockFirebase | null = null;

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should redirect unauthenticated user to login', async ({ pageWithLogging: page }) => {
        // Set up mock Firebase (logged out)
        mockFirebase = await createMockFirebase(page, null);

        // Try to navigate to group detail without authentication
        await page.goto('/groups/test-group-id');

        // Should be redirected to login page
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { name: /sign.*in/i })).toBeVisible();
    });

    test('should show loading state while group data loads', async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'test-group-123';

        // Set up authenticated user
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);

        // Navigate to group (don't mock APIs yet to see loading state)
        await page.goto(`/groups/${groupId}`);

        // Verify loading state appears
        await expect(page).toHaveURL(`/groups/${groupId}`);
        await groupDetailPage.verifyLoadingState();
    });

    test('should display group details for authenticated user', async ({ pageWithLogging: page }) => {
        const testUser = ClientUserBuilder.validUser().build();
        const groupDetailPage = new GroupDetailPage(page);

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId('group-abc')
            .withName('Test Group')
            .withDescription('A test group description')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build()
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        // Set up mocks
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await mockGroupDetailApi(page, 'group-abc', fullDetails);
        await mockGroupCommentsApi(page, 'group-abc');

        // Navigate to group
        await groupDetailPage.navigateToGroup('group-abc');

        // Verify group details are displayed
        await groupDetailPage.verifyGroupDetailPageLoaded('Test Group');
    });
});

test.describe('Group Detail - Members Display', () => {
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should display all group members', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-members-test';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Members Test Group')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build(),
            new GroupMemberDTOBuilder()
                .withUid('user-2')
                .withDisplayName('Alice Smith')
                .withEmail('alice@example.com')
                .withThemeName('purple')
                .build(),
            new GroupMemberDTOBuilder()
                .withUid('user-3')
                .withDisplayName('Bob Jones')
                .withEmail('bob@example.com')
                .withThemeName('green')
                .build()
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

    test('should show member count in header', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-count-test';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Count Test Group')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build(),
            new GroupMemberDTOBuilder()
                .withUid('user-2')
                .withDisplayName('User 2')
                .withEmail('user2@example.com')
                .withThemeName('purple')
                .build()
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
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should display all expenses', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-expenses-test';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Expenses Test Group')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build()
        ];

        const expenses = [
            new ExpenseBuilder()
                .withId('exp-1')
                .withDescription('Groceries')
                .withAmount(50.00)
                .build(),
            new ExpenseBuilder()
                .withId('exp-2')
                .withDescription('Dinner')
                .withAmount(75.50)
                .build()
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

    test('should show empty state when no expenses exist', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-empty-expenses';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Empty Expenses Group')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build()
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

    test('should show expense count in header', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-expense-count';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Expense Count Group')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build()
        ];

        const expenses = [
            new ExpenseBuilder().withId('exp-1').build(),
            new ExpenseBuilder().withId('exp-2').build(),
            new ExpenseBuilder().withId('exp-3').build()
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
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should show "All settled up" when no debts exist', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-settled-up';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Settled Group')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build()
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

    test('should display debts when balances exist', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-with-debts';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Group With Debts')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build(),
            new GroupMemberDTOBuilder()
                .withUid('user-2')
                .withDisplayName('Alice')
                .withEmail('alice@example.com')
                .withThemeName('purple')
                .build()
        ];

        const userBalance1: Record<string, number> = {};
        userBalance1['user-2'] = 25.00;

        const userBalance2: Record<string, number> = {};
        userBalance2[testUser.uid] = 25.00;

        const balances = {
            groupId: groupId,
            lastUpdated: new Date().toISOString(),
            userBalances: {
                [testUser.uid]: {
                    uid: testUser.uid,
                    displayName: testUser.displayName,
                    netBalance: -25.00,
                    balances: {},
                    owes: userBalance1,
                    owedBy: {}
                },
                'user-2': {
                    uid: 'user-2',
                    displayName: 'Alice',
                    netBalance: 25.00,
                    balances: {},
                    owes: {},
                    owedBy: userBalance2
                }
            },
            simplifiedDebts: [
                {
                    from: {
                        uid: testUser.uid,
                        displayName: testUser.displayName
                    },
                    to: {
                        uid: 'user-2',
                        displayName: 'Alice'
                    },
                    amount: 25.00,
                    currency: 'USD'
                }
            ],
            balancesByCurrency: {}
        };

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
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should show owner actions for group owner', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'owner-group';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Owner Group')
            .withCreatedBy(testUser.uid)
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build(),
            new GroupMemberDTOBuilder()
                .withUid('user-2')
                .withDisplayName('User 2')
                .withEmail('user2@example.com')
                .withThemeName('purple')
                .build()
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

    test('should show member actions for non-owner', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'member-group';

        const group = GroupBuilder.groupForUser('other-user-id')
            .withId(groupId)
            .withName('Member Group')
            .withCreatedBy('other-user-id')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build(),
            new GroupMemberDTOBuilder()
                .withUid('other-user-id')
                .withDisplayName('Other User')
                .withEmail('other@example.com')
                .withThemeName('orange')
                .build()
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

    test('should not show leave button for last member', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'last-member-group';

        const group = GroupBuilder.groupForUser('other-user-id')
            .withId(groupId)
            .withName('Last Member Group')
            .withCreatedBy('other-user-id')
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build()
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
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should handle group not found error', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'non-existent-group';

        // Mock 404 error
        await mockApiFailure(page, `/api/groups/${groupId}/full-details`, 404, { error: 'Group not found' });

        await page.goto(`/groups/${groupId}`);

        // Verify 404 page is displayed
        await groupDetailPage.verifyErrorState('Page not found');
    });

    test('should handle permission denied error', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'forbidden-group';

        // Mock 403 error
        await mockApiFailure(page, `/api/groups/${groupId}/full-details`, 403, { error: 'Permission denied' });

        await page.goto(`/groups/${groupId}`);

        // Verify error page is displayed
        await groupDetailPage.verifyErrorState('Permission denied');
    });

    test('should handle API server error', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'error-group';

        // Mock 500 error
        await mockApiFailure(page, `/api/groups/${groupId}/full-details`, 500, { error: 'Internal Server Error' });

        await page.goto(`/groups/${groupId}`);

        // Verify error state is displayed
        await groupDetailPage.verifyErrorState();
    });

    test('should handle network timeout error', async ({ pageWithLogging: page }) => {
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
    const testUser = ClientUserBuilder.validUser().build();
    let mockFirebase: MockFirebase | null = null;

    test.beforeEach(async ({ pageWithLogging: page }) => {
        mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
    });

    test.afterEach(async () => {
        if (mockFirebase) {
            await mockFirebase.dispose();
            mockFirebase = null;
        }
    });

    test('should open edit group modal when clicking edit button', async ({ pageWithLogging: page }) => {
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'edit-modal-group';

        const group = GroupBuilder.groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Edit Modal Group')
            .withCreatedBy(testUser.uid)
            .build();

        const members = [
            new GroupMemberDTOBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withEmail(testUser.email)
                .withThemeName('blue')
                .build()
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Click edit button
        await groupDetailPage.clickEditGroup();

        // Verify modal is open
        await expect(groupDetailPage.getEditGroupModal()).toBeVisible();
    });

});

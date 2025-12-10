import {
    ActivityFeedItemBuilder,
    ExpenseDTOBuilder,
    ExpenseFullDetailsBuilder,
    GroupBalancesBuilder,
    GroupDetailPage,
    GroupDTOBuilder,
    GroupFullDetailsBuilder,
    GroupMemberBuilder,
    ListGroupsResponseBuilder,
    ThemeBuilder,
} from '@billsplit-wl/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import {
    mockActivityFeedApi,
    mockExpenseCommentsApi,
    mockExpenseDetailApi,
    mockGroupActivityFeedApi,
    mockGroupCommentsApi,
    mockGroupDetailApi,
    mockGroupsApi,
} from '../../utils/mock-firebase-service';

// ============================================================================
// Group Activity Feed Browser Unit Tests
// ============================================================================
// These are browser-based unit tests for the group activity feed component
// on the group detail page. They mock the API responses to test UI behavior.

test.describe('Group Activity Feed - Display & Content', () => {
    test('should display activity feed card on group detail page', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-activity-1';
        const groupName = 'Activity Test Group';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const member = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([member])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .build();

        const activityItems = [
            ActivityFeedItemBuilder.groupCreated('item-1', user.uid, groupId, groupName, user.displayName ?? 'Test User').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, activityItems);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyActivityFeedCardVisible();
    });

    test('should display multiple distinct activity items in group feed', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-activity-2';
        const groupName = 'Activity Test Group';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const member = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([member])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .build();

        // Create multiple distinct activity items with different event types
        const activityItems = [
            ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, groupId, groupName, 'Alice', 'Team Lunch').build(),
            ActivityFeedItemBuilder.memberJoined('item-2', user.uid, groupId, groupName, 'Bob', 'Charlie').build(),
            ActivityFeedItemBuilder.settlementCreated('item-3', user.uid, groupId, groupName, 'Diana', 'Repaid dinner').build(),
            ActivityFeedItemBuilder.groupCreated('item-4', user.uid, groupId, groupName, 'Eve').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, activityItems);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyActivityFeedVisible();
        await groupDetailPage.verifyActivityFeedItemCount(4);

        // Verify each distinct activity appears with correct short format
        const expenseText = translationEn
            .activityFeed
            .events['expense-created-short']
            .replace('{{actor}}', 'Alice')
            .replace('{{expense}}', '"Team Lunch"');
        await groupDetailPage.verifyActivityFeedContainsText(expenseText);

        const memberJoinedText = translationEn
            .activityFeed
            .events['member-joined-short']
            .replace('{{actor}}', 'Bob')
            .replace('{{target}}', 'Charlie');
        await groupDetailPage.verifyActivityFeedContainsText(memberJoinedText);

        const settlementText = translationEn
            .activityFeed
            .events['settlement-created-short']
            .replace('{{actor}}', 'Diana')
            .replace('{{settlement}}', '"Repaid dinner"');
        await groupDetailPage.verifyActivityFeedContainsText(settlementText);

        const groupCreatedText = translationEn
            .activityFeed
            .events['group-created-short']
            .replace('{{actor}}', 'Eve');
        await groupDetailPage.verifyActivityFeedContainsText(groupCreatedText);

        // Verify each event type is present
        await groupDetailPage.verifyActivityFeedHasEventType('expense-created');
        await groupDetailPage.verifyActivityFeedHasEventType('member-joined');
        await groupDetailPage.verifyActivityFeedHasEventType('settlement-created');
        await groupDetailPage.verifyActivityFeedHasEventType('group-created');
    });

    test('should display empty state when no activity exists', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-activity-empty';
        const groupName = 'Empty Activity Group';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const member = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([member])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, []);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyActivityFeedEmpty();
    });

    test('should use short format without group name', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-short-format';
        const groupName = 'Short Format Group';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const member = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([member])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .build();

        const activityItems = [
            ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, groupId, groupName, 'Alice', 'Team Lunch').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, activityItems);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify short format is used (without "in [group name]")
        const shortFormat = translationEn
            .activityFeed
            .events['expense-created-short']
            .replace('{{actor}}', 'Alice')
            .replace('{{expense}}', '"Team Lunch"');

        await groupDetailPage.verifyActivityFeedContainsText(shortFormat);

        // Verify the long format with group name is NOT displayed
        const longFormat = translationEn
            .activityFeed
            .events['expense-created']
            .replace('{{actor}}', 'Alice')
            .replace('{{expense}}', '"Team Lunch"')
            .replace('{{group}}', groupName);

        const feedContainer = page.getByTestId('group-activity-feed');
        await expect(feedContainer).not.toContainText(longFormat);
    });

    test('should show "You" when current user is the actor', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-you-actor';
        const groupName = 'You Actor Group';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const member = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([member])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .build();

        const activityItems = [
            ActivityFeedItemBuilder
                .expenseCreated('item-1', user.uid, groupId, groupName, user.uid, 'My Expense')
                .withActorId(user.uid)
                .build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, activityItems);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Should show "You" instead of user's name
        const youLabel = translationEn.activityFeed.labels.actorYou;
        const shortFormat = translationEn
            .activityFeed
            .events['expense-created-short']
            .replace('{{actor}}', youLabel)
            .replace('{{expense}}', '"My Expense"');

        await groupDetailPage.verifyActivityFeedContainsText(shortFormat);
    });
});

test.describe('Group Activity Feed - Event Types', () => {
    test('should display expense-created events with short format', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-expense-event';
        const groupName = 'Expense Event Group';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const member = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([member])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .build();

        const activityItems = [
            ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, groupId, groupName, 'Alice', 'Dinner').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, activityItems);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyActivityFeedHasEventType('expense-created');

        const expectedText = translationEn
            .activityFeed
            .events['expense-created-short']
            .replace('{{actor}}', 'Alice')
            .replace('{{expense}}', '"Dinner"');
        await groupDetailPage.verifyActivityFeedContainsText(expectedText);
    });

    test('should display group-created events with short format', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-created-event';
        const groupName = 'Created Event Group';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const member = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([member])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .build();

        const activityItems = [
            ActivityFeedItemBuilder.groupCreated('item-1', user.uid, groupId, groupName, 'Bob').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, activityItems);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyActivityFeedHasEventType('group-created');

        const expectedText = translationEn
            .activityFeed
            .events['group-created-short']
            .replace('{{actor}}', 'Bob');
        await groupDetailPage.verifyActivityFeedContainsText(expectedText);
    });

    test('should display settlement-created events with short format', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-settlement-event';
        const groupName = 'Settlement Event Group';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const member = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([member])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .build();

        const activityItems = [
            ActivityFeedItemBuilder.settlementCreated('item-1', user.uid, groupId, groupName, 'Charlie', 'Repaid lunch').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, activityItems);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyActivityFeedHasEventType('settlement-created');

        const expectedText = translationEn
            .activityFeed
            .events['settlement-created-short']
            .replace('{{actor}}', 'Charlie')
            .replace('{{settlement}}', '"Repaid lunch"');
        await groupDetailPage.verifyActivityFeedContainsText(expectedText);
    });
});

test.describe('Group Activity Feed - Navigation', () => {
    test('should navigate to expense detail when clicking expense activity item', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-nav-expense';
        const groupName = 'Navigation Group';
        const expenseDescription = 'Team Lunch';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();
        const currentUserMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const aliceMember = new GroupMemberBuilder()
            .withUid('alice-uid')
            .withDisplayName('Alice')
            .withGroupDisplayName('Alice')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts({ uid: user.uid }, { uid: 'alice-uid' })
            .build();

        const activityItem = ActivityFeedItemBuilder
            .expenseCreated('item-1', user.uid, groupId, groupName, 'Alice', expenseDescription)
            .build();

        const expenseId = activityItem.details?.expenseId!;

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription(expenseDescription)
            .withAmount(48.75, 'USD')
            .withPaidBy(aliceMember.uid)
            .withParticipants([aliceMember.uid, currentUserMember.uid])
            .build();

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([currentUserMember, aliceMember])
            .withBalances(balances)
            .withExpenses([expense], false)
            .withSettlements([], false)
            .build();

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers([currentUserMember, aliceMember])
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, []);
        await mockGroupActivityFeedApi(page, groupId, [activityItem]);
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId, []);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();
        await groupDetailPage.ensureActivitySectionExpanded();

        const expectedDescription = translationEn
            .activityFeed
            .events['expense-created-short']
            .replace('{{actor}}', 'Alice')
            .replace('{{expense}}', `"${expenseDescription}"`);

        await groupDetailPage.verifyActivityFeedContainsText(expectedDescription);

        // Click on the activity item
        const activityContainer = page.getByTestId('group-activity-feed');
        await activityContainer.getByText(expectedDescription).click();

        // Expense detail modal opens (URL stays on group page)
        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        // Verify expense description shows in modal heading
        await expect(modal.getByRole('heading', { name: expenseDescription })).toBeVisible();
    });
});

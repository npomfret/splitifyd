import {
    ActivityFeedItemBuilder,
    CommentBuilder,
    DashboardPage,
    ExpenseDetailPage,
    ExpenseDTOBuilder,
    ExpenseFullDetailsBuilder,
    GroupBalancesBuilder,
    GroupDetailPage,
    GroupDTOBuilder,
    GroupFullDetailsBuilder,
    GroupMemberBuilder,
    ListGroupsResponseBuilder,
    SettlementWithMembersBuilder,
    ThemeBuilder,
} from '@billsplit-wl/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockExpenseCommentsApi, mockExpenseDetailApi, mockGroupCommentsApi, mockGroupDetailApi, mockGroupsApi } from '../../utils/mock-firebase-service';

// ============================================================================
// Dashboard Activity Feed Browser Unit Tests
// ============================================================================
// These are browser-based unit tests for the activity feed component.
// They mock the API responses to test UI behavior in isolation.

test.describe('Activity Feed - Display & Content', () => {
    test('should display activity feed on dashboard', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [
            ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Lunch').build(),
            ActivityFeedItemBuilder.memberJoined('item-2', user.uid, 'group-1', 'Test Group', 'Bob', 'Charlie').build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedVisible();
        await dashboardPage.verifyActivityFeedItemCount(2);
        await dashboardPage.verifyActivityFeedContainsText('Alice added "Lunch" in Test Group');
        await dashboardPage.verifyActivityFeedContainsText('Bob added Charlie to Test Group');
    });

    test('should display empty state when no activity exists', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, []);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedVisible();
        await dashboardPage.verifyActivityFeedEmptyState();
        await dashboardPage.verifyActivityFeedItemCount(0);
    });

    test('should show "You" when current user is the actor', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [
            ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', user.uid, 'My Expense').withActorId(user.uid).build(),
        ];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedContainsText('You added "My Expense" in Test Group');
    });
});

test.describe('Activity Feed - Event Types', () => {
    test('should display expense-created events correctly', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Dinner').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedContainsText('Alice added "Dinner" in Test Group');
    });

    test('should display member-joined events correctly', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemBuilder.memberJoined('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Bob').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedContainsText('Alice added Bob to Test Group');
    });

    test('should display comment-added events with preview', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemBuilder.commentAdded('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Looks good!', 'Groceries').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        const commentTarget = translationEn.activityFeed.labels.commentOnExpense.replace('{{description}}', 'Groceries');
        const expectedDescription = translationEn
            .activityFeed
            .events['comment-added']
            .replace('{{actor}}', 'Alice')
            .replace('{{target}}', commentTarget)
            .replace('{{group}}', 'Test Group');

        await dashboardPage.verifyActivityFeedContainsText(expectedDescription);
        await dashboardPage.verifyActivityFeedContainsPreview('Looks good!');
    });
});

test.describe('Activity Feed - Error Handling', () => {
    test('should display error message when feed fails to load', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        // Mock activity feed API to fail
        await page.route('**/api/activity-feed?*', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
            });
        });

        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedError();
    });

    test('should allow retry after error', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Lunch').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        let requestCount = 0;
        await page.route('**/api/activity-feed?*', async (route) => {
            requestCount++;
            if (requestCount === 1) {
                // First request fails
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
                });
            } else {
                // Second request succeeds
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ items: activityItems, hasMore: false, nextCursor: undefined }),
                });
            }
        });

        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedError();
        await dashboardPage.clickActivityFeedRetry();
        await dashboardPage.verifyActivityFeedContainsText('Alice added "Lunch" in Test Group');
    });
});

test.describe('Activity Feed - Pagination', () => {
    test('should show load more button when there are more items', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Lunch').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        // Mock initial response with hasMore=true
        await page.route('**/api/activity-feed?*', async (route) => {
            const url = new URL(route.request().url());
            const cursor = url.searchParams.get('cursor');

            if (!cursor) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: activityItems,
                        hasMore: true,
                        nextCursor: 'item-1',
                    }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [],
                        hasMore: false,
                        nextCursor: undefined,
                    }),
                });
            }
        });

        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedLoadMoreVisible();
    });

    test('should load more items when button clicked', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const firstPageItems = [ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'First').build()];
        const secondPageItems = [ActivityFeedItemBuilder.expenseCreated('item-2', user.uid, 'group-1', 'Test Group', 'Bob', 'Second').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());

        await page.route('**/api/activity-feed?*', async (route) => {
            const url = new URL(route.request().url());
            const cursor = url.searchParams.get('cursor');

            if (!cursor) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: firstPageItems,
                        hasMore: true,
                        nextCursor: 'item-1',
                    }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: secondPageItems,
                        hasMore: false,
                        nextCursor: undefined,
                    }),
                });
            }
        });

        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedContainsText('Alice added "First" in Test Group');
        await dashboardPage.clickActivityFeedLoadMore();
        await dashboardPage.verifyActivityFeedContainsText('Bob added "Second" in Test Group');
        await dashboardPage.verifyActivityFeedItemCount(2);
        await dashboardPage.verifyActivityFeedLoadMoreHidden();
    });

    test('should not show load more button when no more items', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder.groupForUser(user.uid).withId('group-1').withName('Test Group').build();
        const activityItems = [ActivityFeedItemBuilder.expenseCreated('item-1', user.uid, 'group-1', 'Test Group', 'Alice', 'Lunch').build()];

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, activityItems);
        await page.goto('/dashboard');

        await dashboardPage.verifyActivityFeedLoadMoreHidden();
    });
});

test.describe('Activity Feed - Navigation', () => {
    test('should navigate to expense detail when clicking expense activity item', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const expenseDetailPage = new ExpenseDetailPage(page);

        const groupId = 'group-nav-expense';
        const groupName = 'Navigation Group';
        const actorName = 'Alice';
        const activityId = 'nav-expense-item';
        const expenseDescription = 'Team Lunch';
        const currentUserName = user.displayName ?? 'Current User';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();

        const activityItem = ActivityFeedItemBuilder.expenseCreated(activityId, user.uid, groupId, groupName, actorName, expenseDescription).build();
        const expenseId = activityItem.details?.expenseId!;

        const actorMember = new GroupMemberBuilder()
            .withUid(activityItem.actorId)
            .withDisplayName(actorName)
            .withGroupDisplayName(actorName)
            .withTheme(ThemeBuilder.red().build())
            .build();

        const currentUserMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(currentUserName)
            .withGroupDisplayName(currentUserName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription(expenseDescription)
            .withAmount(48.75, 'USD')
            .withPaidBy(actorMember.uid)
            .withCreatedBy(actorMember.uid)
            .withParticipants([actorMember.uid, currentUserMember.uid])
            .build();

        const fullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers([actorMember, currentUserMember])
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, [activityItem]);
        await mockExpenseDetailApi(page, expenseId, fullDetails);
        await mockExpenseCommentsApi(page, expenseId, []);

        await page.goto('/dashboard');

        const expectedDescription = translationEn
            .activityFeed
            .events['expense-created']
            .replace('{{actor}}', actorName)
            .replace('{{expense}}', `"${expenseDescription}"`)
            .replace('{{group}}', groupName);

        await dashboardPage.verifyActivityFeedContainsText(expectedDescription);
        await dashboardPage.clickActivityFeedItem(expectedDescription);

        await expect(page).toHaveURL(`/groups/${groupId}/expenses/${expenseId}`);
        await expenseDetailPage.waitForExpenseDescription(expenseDescription);
    });

    test('should navigate to group comments when clicking comment activity without expense target', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-nav-comments';
        const groupName = 'Navigation Comments Group';
        const actorName = 'Priya';
        const activityId = 'nav-comment-item';
        const commentPreview = 'Excited for this trip!';
        const currentUserName = user.displayName ?? 'Current User';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();

        const activityItem = ActivityFeedItemBuilder.commentAdded(activityId, user.uid, groupId, groupName, actorName, commentPreview).build();

        const currentUserMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(currentUserName)
            .withGroupDisplayName(currentUserName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const actorMember = new GroupMemberBuilder()
            .withUid(activityItem.actorId)
            .withDisplayName(actorName)
            .withGroupDisplayName(actorName)
            .withTheme(ThemeBuilder.red().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts(
                { uid: currentUserMember.uid },
                { uid: actorMember.uid },
            )
            .build();

        const comment = new CommentBuilder()
            .withId(activityItem.details?.commentId ?? 'comment-nav')
            .withAuthor(actorMember.uid, actorName)
            .withText(commentPreview)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([currentUserMember, actorMember])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .withComments({ comments: [comment], hasMore: false })
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, [activityItem]);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId, [comment]);

        await page.goto('/dashboard');

        const commentTarget = translationEn.activityFeed.labels.commentOnGroup;
        const expectedDescription = translationEn
            .activityFeed
            .events['comment-added']
            .replace('{{actor}}', actorName)
            .replace('{{target}}', commentTarget)
            .replace('{{group}}', groupName);

        await dashboardPage.verifyActivityFeedContainsText(expectedDescription);
        await dashboardPage.clickActivityFeedItem(expectedDescription);

        await expect(page).toHaveURL(`/groups/${groupId}#comments`);
        await groupDetailPage.waitForGroupToLoad();
        await groupDetailPage.ensureCommentsSectionExpanded();
        await expect(page.getByText(commentPreview)).toBeVisible();
    });

    test('should navigate to settlements section when clicking settlement activity item', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);
        const groupDetailPage = new GroupDetailPage(page);

        const groupId = 'group-nav-settlements';
        const groupName = 'Navigation Settlements Group';
        const actorName = 'Miguel';
        const activityId = 'nav-settlement-item';
        const settlementDescription = 'Repaid dinner tab';
        const currentUserName = user.displayName ?? 'Current User';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName(groupName).build();

        const activityItem = ActivityFeedItemBuilder
            .settlementCreated(activityId, user.uid, groupId, groupName, actorName, settlementDescription)
            .build();

        const settlementId = activityItem.details?.settlementId!;

        const currentUserMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(currentUserName)
            .withGroupDisplayName(currentUserName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const actorMember = new GroupMemberBuilder()
            .withUid(activityItem.actorId)
            .withDisplayName(actorName)
            .withGroupDisplayName(actorName)
            .withTheme(ThemeBuilder.red().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts(
                { uid: currentUserMember.uid },
                { uid: actorMember.uid },
            )
            .build();

        const settlement = new SettlementWithMembersBuilder()
            .withId(settlementId)
            .withGroupId(groupId)
            .withPayer(actorMember)
            .withPayee(currentUserMember)
            .withAmount(120, 'USD')
            .withNote(settlementDescription)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([currentUserMember, actorMember])
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([settlement], false)
            .build();

        await mockGroupsApi(page, ListGroupsResponseBuilder.responseWithMetadata([group], 1).build());
        await mockActivityFeedApi(page, [activityItem]);
        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await page.goto('/dashboard');

        const expectedDescription = translationEn
            .activityFeed
            .events['settlement-created']
            .replace('{{actor}}', actorName)
            .replace('{{settlement}}', `"${settlementDescription}"`)
            .replace('{{group}}', groupName);

        await dashboardPage.verifyActivityFeedContainsText(expectedDescription);
        await dashboardPage.clickActivityFeedItem(expectedDescription);

        await expect(page).toHaveURL(`/groups/${groupId}#settlements`);
        await groupDetailPage.waitForGroupToLoad();
        await groupDetailPage.ensureSettlementsSectionExpanded();
        await expect(page.getByText(settlementDescription)).toBeVisible();
    });
});

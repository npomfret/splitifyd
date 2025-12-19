import { ReactionEmojis, toUserId } from '@billsplit-wl/shared';
import { ExpenseDetailPage, ExpenseDTOBuilder, ExpenseFullDetailsBuilder, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockExpenseCommentsApi, mockExpenseDetailApi, mockGroupCommentsApi, mockGroupDetailApi, mockToggleExpenseReactionApiForAllEmojis } from '../../utils/mock-firebase-service';

test.describe('Expense Reactions', () => {
    test('should display add reaction button in expense detail modal', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-with-reactions';
        const groupId = 'test-group-reactions';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Test Expense')
            .withAmount(50.0, 'USD')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();
        await expenseDetailPage.verifyAddReactionButtonVisible();
    });

    test('should open reaction picker when add button is clicked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-picker-test';
        const groupId = 'test-group-picker';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Picker Test')
            .withAmount(25.0, 'USD')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        await expenseDetailPage.clickAddReaction();
        await expenseDetailPage.verifyReactionPickerOpen();
    });

    test('should add reaction to expense', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-add-reaction';
        const groupId = 'test-group-add-reaction';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Add Reaction Test')
            .withAmount(100.0, 'EUR')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);
        await mockToggleExpenseReactionApiForAllEmojis(page, expenseId, 'added');

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Add a thumbs up reaction
        await expenseDetailPage.addExpenseReaction(ReactionEmojis.THUMBS_UP);

        // Verify reaction pill appears with count 1
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.THUMBS_UP, 1);

        // Verify the reaction is highlighted (user has reacted)
        await expenseDetailPage.verifyReactionHighlighted(ReactionEmojis.THUMBS_UP);
    });

    test('should display existing reactions on expense', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-existing-reactions';
        const groupId = 'test-group-existing';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Existing Reactions Test')
            .withAmount(75.0, 'GBP')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .withReactionCounts({ [ReactionEmojis.THUMBS_UP]: 2, [ReactionEmojis.HEART]: 1 })
            .withUserReactions({ [toUserId(testUser.uid)]: [ReactionEmojis.THUMBS_UP] })
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Verify existing reactions are displayed
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.THUMBS_UP, 2);
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.HEART, 1);

        // Verify user's own reaction is highlighted
        await expenseDetailPage.verifyReactionHighlighted(ReactionEmojis.THUMBS_UP);

        // Verify other reaction is not highlighted (user hasn't reacted with heart)
        await expenseDetailPage.verifyReactionNotHighlighted(ReactionEmojis.HEART);
    });

    test('should toggle off existing reaction when clicked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-toggle-off';
        const groupId = 'test-group-toggle';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Toggle Off Test')
            .withAmount(50.0, 'USD')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .withReactionCounts({ [ReactionEmojis.THUMBS_UP]: 1 })
            .withUserReactions({ [toUserId(testUser.uid)]: [ReactionEmojis.THUMBS_UP] })
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);
        await mockToggleExpenseReactionApiForAllEmojis(page, expenseId, 'removed');

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Verify reaction exists and is highlighted
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.THUMBS_UP, 1);
        await expenseDetailPage.verifyReactionHighlighted(ReactionEmojis.THUMBS_UP);

        // Click to toggle off
        await expenseDetailPage.toggleExpenseReaction(ReactionEmojis.THUMBS_UP);

        // Reaction should disappear (count went to 0)
        await expenseDetailPage.verifyReactionNotVisible(ReactionEmojis.THUMBS_UP);
    });

    test('should add heart reaction to expense', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-heart-reaction';
        const groupId = 'test-group-heart';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Heart Reaction Test')
            .withAmount(30.0, 'USD')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);
        await mockToggleExpenseReactionApiForAllEmojis(page, expenseId, 'added', { emoji: ReactionEmojis.HEART });

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Add a heart reaction
        await expenseDetailPage.addExpenseReaction(ReactionEmojis.HEART);

        // Verify reaction pill appears with count 1
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.HEART, 1);
        await expenseDetailPage.verifyReactionHighlighted(ReactionEmojis.HEART);
    });

    test('should decrement reaction count but keep pill visible when count > 1', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-decrement';
        const groupId = 'test-group-decrement';

        // Start with count of 2 - user has already reacted
        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Decrement Test')
            .withAmount(40.0, 'USD')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .withReactionCounts({ [ReactionEmojis.THUMBS_UP]: 2 })
            .withUserReactions({ [toUserId(testUser.uid)]: [ReactionEmojis.THUMBS_UP] })
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);
        // Mock returns newCount: 1 (decremented from 2)
        await mockToggleExpenseReactionApiForAllEmojis(page, expenseId, 'removed', { newCount: 1 });

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Verify initial state
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.THUMBS_UP, 2);

        // Toggle off user's reaction
        await expenseDetailPage.toggleExpenseReaction(ReactionEmojis.THUMBS_UP);

        // Pill should still be visible with count 1, but not highlighted
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.THUMBS_UP, 1);
        await expenseDetailPage.verifyReactionNotHighlighted(ReactionEmojis.THUMBS_UP);
    });

    test('should show all 6 emoji options in reaction picker', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-all-emojis';
        const groupId = 'test-group-all-emojis';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('All Emojis Test')
            .withAmount(20.0, 'USD')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Open picker
        await expenseDetailPage.clickAddReaction();

        // Verify all 6 emojis are visible
        await expenseDetailPage.verifyAllPickerEmojisVisible();
    });

    test('should close reaction picker when escape key is pressed', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-escape-picker';
        const groupId = 'test-group-escape';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Escape Picker Test')
            .withAmount(15.0, 'USD')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Open picker
        await expenseDetailPage.clickAddReaction();
        await expenseDetailPage.verifyReactionPickerOpen();

        // Press Escape
        await expenseDetailPage.pressEscapeToClosePicker();

        // Verify picker is closed
        await expenseDetailPage.verifyReactionPickerClosed();
    });

    test('should add multiple different reactions to same expense', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-multiple-reactions';
        const groupId = 'test-group-multiple';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Multiple Reactions Test')
            .withAmount(60.0, 'USD')
            .withPaidBy(testUser.uid)
            .withParticipants([testUser.uid])
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);
        await mockToggleExpenseReactionApiForAllEmojis(page, expenseId, 'added');

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Add thumbs up
        await expenseDetailPage.addExpenseReaction(ReactionEmojis.THUMBS_UP);
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.THUMBS_UP, 1);

        // Add heart (need to re-mock for second reaction with different response)
        // Since we're using optimistic updates, the UI should show both
        await expenseDetailPage.addExpenseReaction(ReactionEmojis.HEART);
        await expenseDetailPage.verifyReactionVisible(ReactionEmojis.HEART, 1);

        // Both should be visible and highlighted
        await expenseDetailPage.verifyReactionHighlighted(ReactionEmojis.THUMBS_UP);
        await expenseDetailPage.verifyReactionHighlighted(ReactionEmojis.HEART);
    });
});

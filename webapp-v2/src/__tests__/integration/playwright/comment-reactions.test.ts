import { ReactionEmojis, toUserId } from '@billsplit-wl/shared';
import { CommentBuilder, ExpenseDetailPage, ExpenseDTOBuilder, ExpenseFullDetailsBuilder, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockExpenseCommentsApi, mockExpenseDetailApi, mockGroupCommentsApi, mockGroupDetailApi, mockToggleExpenseCommentReactionApi } from '../../utils/mock-firebase-service';

test.describe('Comment Reactions', () => {
    test('should display existing reactions on a comment', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-comment-reactions';
        const groupId = 'test-group-comment-reactions';
        const commentId = 'comment-with-reactions';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Expense With Comment Reactions')
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

        const comment = new CommentBuilder()
            .withId(commentId)
            .withAuthorId(testUser.uid)
            .withAuthorName(testUser.displayName)
            .withText('Great expense!')
            .withReactionCounts({ [ReactionEmojis.THUMBS_UP]: 2, [ReactionEmojis.HEART]: 1 })
            .withUserReactions({ [toUserId(testUser.uid)]: [ReactionEmojis.THUMBS_UP] })
            .build();

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
        await mockExpenseCommentsApi(page, expenseId, [comment]);

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Verify comment reactions are displayed
        await expenseDetailPage.verifyCommentReactionVisible('Great expense!', ReactionEmojis.THUMBS_UP, 2);
        await expenseDetailPage.verifyCommentReactionVisible('Great expense!', ReactionEmojis.HEART, 1);

        // Verify user's reaction is highlighted
        await expenseDetailPage.verifyCommentReactionHighlighted('Great expense!', ReactionEmojis.THUMBS_UP);
        await expenseDetailPage.verifyCommentReactionNotHighlighted('Great expense!', ReactionEmojis.HEART);
    });

    test('should add reaction to a comment', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-add-comment-reaction';
        const groupId = 'test-group-add-comment-reaction';
        const commentId = 'comment-to-react';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Add Comment Reaction Test')
            .withAmount(75.0, 'USD')
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

        const comment = new CommentBuilder()
            .withId(commentId)
            .withAuthorId(testUser.uid)
            .withAuthorName(testUser.displayName)
            .withText('Nice work!')
            .build();

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
        await mockExpenseCommentsApi(page, expenseId, [comment]);
        await mockToggleExpenseCommentReactionApi(page, expenseId, commentId, 'added');

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Verify comment is visible
        await expenseDetailPage.verifyCommentVisible('Nice work!');

        // Add reaction to comment
        await expenseDetailPage.addCommentReaction('Nice work!', ReactionEmojis.THUMBS_UP);

        // Verify reaction appears
        await expenseDetailPage.verifyCommentReactionVisible('Nice work!', ReactionEmojis.THUMBS_UP, 1);
        await expenseDetailPage.verifyCommentReactionHighlighted('Nice work!', ReactionEmojis.THUMBS_UP);
    });

    test('should toggle off comment reaction when clicked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'expense-toggle-comment-reaction';
        const groupId = 'test-group-toggle-comment';
        const commentId = 'comment-toggle-off';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
            .withGroupId(groupId)
            .withDescription('Toggle Comment Reaction Test')
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

        const comment = new CommentBuilder()
            .withId(commentId)
            .withAuthorId(testUser.uid)
            .withAuthorName(testUser.displayName)
            .withText('Toggle me!')
            .withReactionCounts({ [ReactionEmojis.HEART]: 1 })
            .withUserReactions({ [toUserId(testUser.uid)]: [ReactionEmojis.HEART] })
            .build();

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
        await mockExpenseCommentsApi(page, expenseId, [comment]);
        await mockToggleExpenseCommentReactionApi(page, expenseId, commentId, 'removed', { emoji: ReactionEmojis.HEART });

        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();

        // Verify initial state
        await expenseDetailPage.verifyCommentReactionVisible('Toggle me!', ReactionEmojis.HEART, 1);
        await expenseDetailPage.verifyCommentReactionHighlighted('Toggle me!', ReactionEmojis.HEART);

        // Toggle off
        await expenseDetailPage.toggleCommentReaction('Toggle me!', ReactionEmojis.HEART);

        // Verify reaction is removed
        await expenseDetailPage.verifyCommentReactionNotVisible('Toggle me!', ReactionEmojis.HEART);
    });
});

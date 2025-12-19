import { ReactionEmojis, toUserId } from '@billsplit-wl/shared';
import { CommentBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi, mockToggleGroupCommentReactionApi } from '../../utils/mock-firebase-service';

test.describe('Group Comment Reactions', () => {
    test('should display existing reactions on a group comment', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-comment-reactions';
        const commentId = 'comment-with-reactions';

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
            .withText('Great group!')
            .withReactionCounts({ [ReactionEmojis.THUMBS_UP]: 2, [ReactionEmojis.HEART]: 1 })
            .withUserReactions({ [toUserId(testUser.uid)]: [ReactionEmojis.THUMBS_UP] })
            .build();

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withComments({ comments: [comment], hasMore: false })
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, [comment]);

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);

        // Expand comments section and verify comment is visible
        await groupDetailPage.ensureCommentsSectionExpanded();
        await groupDetailPage.verifyCommentVisible('Great group!');

        // Verify comment reactions are displayed
        await groupDetailPage.verifyGroupCommentReactionVisible('Great group!', ReactionEmojis.THUMBS_UP, 2);
        await groupDetailPage.verifyGroupCommentReactionVisible('Great group!', ReactionEmojis.HEART, 1);

        // Verify user's reaction is highlighted
        await groupDetailPage.verifyGroupCommentReactionHighlighted('Great group!', ReactionEmojis.THUMBS_UP);
        await groupDetailPage.verifyGroupCommentReactionNotHighlighted('Great group!', ReactionEmojis.HEART);
    });

    test('should add reaction to a group comment', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-add-comment-reaction';
        const commentId = 'comment-to-react';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Add Reaction Group')
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
            .withComments({ comments: [comment], hasMore: false })
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, [comment]);
        await mockToggleGroupCommentReactionApi(page, groupId, commentId, 'added');

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);

        // Expand comments section and verify comment is visible
        await groupDetailPage.ensureCommentsSectionExpanded();
        await groupDetailPage.verifyCommentVisible('Nice work!');

        // Add reaction to comment
        await groupDetailPage.addGroupCommentReaction('Nice work!', ReactionEmojis.THUMBS_UP);

        // Verify reaction appears
        await groupDetailPage.verifyGroupCommentReactionVisible('Nice work!', ReactionEmojis.THUMBS_UP, 1);
        await groupDetailPage.verifyGroupCommentReactionHighlighted('Nice work!', ReactionEmojis.THUMBS_UP);
    });

    test('should toggle off group comment reaction when clicked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-toggle-comment';
        const commentId = 'comment-toggle-off';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Toggle Reaction Group')
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
            .withComments({ comments: [comment], hasMore: false })
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, [comment]);
        await mockToggleGroupCommentReactionApi(page, groupId, commentId, 'removed', { emoji: ReactionEmojis.HEART });

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);

        // Expand comments section and verify comment is visible
        await groupDetailPage.ensureCommentsSectionExpanded();
        await groupDetailPage.verifyCommentVisible('Toggle me!');

        // Verify initial state
        await groupDetailPage.verifyGroupCommentReactionVisible('Toggle me!', ReactionEmojis.HEART, 1);
        await groupDetailPage.verifyGroupCommentReactionHighlighted('Toggle me!', ReactionEmojis.HEART);

        // Toggle off
        await groupDetailPage.toggleGroupCommentReaction('Toggle me!', ReactionEmojis.HEART);

        // Verify reaction is removed
        await groupDetailPage.verifyGroupCommentReactionNotVisible('Toggle me!', ReactionEmojis.HEART);
    });
});

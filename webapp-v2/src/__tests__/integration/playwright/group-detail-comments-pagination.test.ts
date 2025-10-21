import { CommentBuilder, GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@splitifyd/test-support';
import type { ListCommentsResponse } from '@splitifyd/shared';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi } from '../../utils/mock-firebase-service';

test.describe('Group Detail - Comment Pagination', () => {
    test('should load additional comments when Load more comments is clicked', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-comment-pagination';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Comment Pagination Group')
            .build();

        const memberSelf = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const memberTwo = new GroupMemberBuilder()
            .withUid('member-2')
            .withDisplayName('Member Two')
            .withGroupDisplayName('Member Two')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const members = [memberSelf, memberTwo];

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts(
                { uid: memberSelf.uid, displayName: memberSelf.displayName! },
                { uid: memberTwo.uid, displayName: memberTwo.displayName! },
            )
            .build();

        const commentPage1Welcome = new CommentBuilder()
            .withId('comment-p1-1')
            .withAuthor(memberSelf.uid, memberSelf.displayName ?? 'Self Member')
            .withText('First page welcome comment')
            .build();

        const commentPage1Reminder = new CommentBuilder()
            .withId('comment-p1-2')
            .withAuthor(memberTwo.uid, memberTwo.displayName ?? 'Member Two')
            .withText('First page reminder comment')
            .build();

        const commentPage2Update = new CommentBuilder()
            .withId('comment-p2-1')
            .withAuthor(memberSelf.uid, memberSelf.displayName ?? 'Self Member')
            .withText('Second page update comment')
            .build();

        const commentPage2FollowUp = new CommentBuilder()
            .withId('comment-p2-2')
            .withAuthor(memberTwo.uid, memberTwo.displayName ?? 'Member Two')
            .withText('Second page follow-up comment')
            .build();

        const initialComments: ListCommentsResponse = {
            comments: [commentPage1Welcome, commentPage1Reminder],
            hasMore: true,
            nextCursor: 'cursor-comments-page-2',
        };

        const nextPageComments: ListCommentsResponse = {
            comments: [commentPage2Update, commentPage2FollowUp],
            hasMore: false,
        };

        const initialFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members, false)
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .withComments(initialComments)
            .build();

        await mockGroupCommentsApi(page, groupId);

        await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
            const url = new URL(route.request().url());
            const commentCursor = url.searchParams.get('commentCursor');

            if (commentCursor) {
                await fulfillWithSerialization(route, { body: initialFullDetails });
                return;
            }

            await fulfillWithSerialization(route, { body: initialFullDetails });
        });

        await page.route(`**/api/groups/${groupId}/comments**`, async (route) => {
            const url = new URL(route.request().url());
            const cursor = url.searchParams.get('cursor');
            const body = cursor === 'cursor-comments-page-2' ? nextPageComments : initialComments;
            await fulfillWithSerialization(route, { body });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await expect(page.getByText('First page welcome comment')).toBeVisible();
        await expect(page.getByText('First page reminder comment')).toBeVisible();
        await expect(groupDetailPage.getCommentItems()).toHaveCount(2);

        const loadMoreButton = page.getByTestId('load-more-comments-button');
        await expect(loadMoreButton).toBeVisible();

        await loadMoreButton.click();

        await expect(page.getByText('Second page update comment')).toBeVisible();
        await expect(page.getByText('Second page follow-up comment')).toBeVisible();
        await expect(groupDetailPage.getCommentItems()).toHaveCount(4);
        await expect(loadMoreButton).not.toBeVisible();
    });
});

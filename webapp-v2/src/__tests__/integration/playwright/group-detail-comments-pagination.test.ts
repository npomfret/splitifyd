import {
    CommentBuilder,
    GroupBalancesBuilder,
    GroupDetailPage,
    GroupDTOBuilder,
    GroupFullDetailsBuilder,
    GroupMemberBuilder,
    ListCommentsResponseBuilder,
    ThemeBuilder,
} from '@billsplit-wl/test-support';
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
                { uid: memberSelf.uid },
                { uid: memberTwo.uid },
            )
            .build();

        const commentPage1Welcome = new CommentBuilder()
            .withId('comment-p1-1')
            .withAuthor(memberSelf.uid, memberSelf.groupDisplayName ?? 'Self Member')
            .withText('First page welcome comment')
            .build();

        const commentPage1Reminder = new CommentBuilder()
            .withId('comment-p1-2')
            .withAuthor(memberTwo.uid, memberTwo.groupDisplayName ?? 'Member Two')
            .withText('First page reminder comment')
            .build();

        const commentPage2Update = new CommentBuilder()
            .withId('comment-p2-1')
            .withAuthor(memberSelf.uid, memberSelf.groupDisplayName ?? 'Self Member')
            .withText('Second page update comment')
            .build();

        const commentPage2FollowUp = new CommentBuilder()
            .withId('comment-p2-2')
            .withAuthor(memberTwo.uid, memberTwo.groupDisplayName ?? 'Member Two')
            .withText('Second page follow-up comment')
            .build();

        const initialComments = new ListCommentsResponseBuilder()
            .withComments([commentPage1Welcome, commentPage1Reminder])
            .withHasMore(true)
            .withNextCursor('cursor-comments-page-2')
            .build();

        const nextPageComments = new ListCommentsResponseBuilder()
            .withComments([commentPage2Update, commentPage2FollowUp])
            .withHasMore(false)
            .withoutNextCursor()
            .build();

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
        await groupDetailPage.expectCommentsCollapsed();
        await groupDetailPage.ensureCommentsSectionExpanded();

        await expect(page.getByText('First page welcome comment')).toBeVisible();
        await expect(page.getByText('First page reminder comment')).toBeVisible();
        await groupDetailPage.verifyCommentItemsCount(2);

        const loadMoreButton = page.getByRole('button', { name: /load more comments/i });
        await expect(loadMoreButton).toBeVisible();

        await loadMoreButton.click();

        await expect(page.getByText('Second page update comment')).toBeVisible();
        await expect(page.getByText('Second page follow-up comment')).toBeVisible();
        await groupDetailPage.verifyCommentItemsCount(4);
        await expect(loadMoreButton).not.toBeVisible();
    });
});

test.describe('Group Detail - Comment Pagination Button', () => {
    test('should show Load more comments button and disable while loading next page', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-comment-load-more-button';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Comment Button Group')
            .build();

        const memberSelf = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const memberTwo = new GroupMemberBuilder()
            .withUid('member-button-2')
            .withDisplayName('Button Member Two')
            .withGroupDisplayName('Button Member Two')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const members = [memberSelf, memberTwo];

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts(
                { uid: memberSelf.uid },
                { uid: memberTwo.uid },
            )
            .build();

        const commentPage1 = new CommentBuilder()
            .withId('comment-button-1')
            .withAuthor(memberSelf.uid, memberSelf.groupDisplayName ?? 'Member One')
            .withText('Initial button comment')
            .build();

        const commentPage2 = new CommentBuilder()
            .withId('comment-button-2')
            .withAuthor(memberTwo.uid, memberTwo.groupDisplayName ?? 'Button Member Two')
            .withText('Next page button comment')
            .build();

        const initialComments = new ListCommentsResponseBuilder()
            .withComments([commentPage1])
            .withHasMore(true)
            .withNextCursor('cursor-comments-page-button')
            .build();

        const nextPageComments = new ListCommentsResponseBuilder()
            .withComments([commentPage2])
            .withHasMore(false)
            .withoutNextCursor()
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members, false)
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([], false)
            .withComments(initialComments)
            .build();

        await mockGroupCommentsApi(page, groupId);

        await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
            await fulfillWithSerialization(route, { body: fullDetails });
        });

        await page.route(`**/api/groups/${groupId}/comments**`, async (route) => {
            const url = new URL(route.request().url());
            const cursor = url.searchParams.get('cursor');

            if (cursor === 'cursor-comments-page-button') {
                await new Promise((resolve) => setTimeout(resolve, 200));
                await fulfillWithSerialization(route, { body: nextPageComments });
                return;
            }

            await fulfillWithSerialization(route, { body: initialComments });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();
        await groupDetailPage.expectCommentsCollapsed();
        await groupDetailPage.ensureCommentsSectionExpanded();

        const loadMoreButton = page.getByRole('button', { name: /load more comments/i });
        await expect(loadMoreButton).toBeVisible();

        await Promise.all([
            page.waitForRequest((request) => request.method() === 'GET' && request.url().includes(`/api/groups/${groupId}/comments?cursor=cursor-comments-page-button`)),
            loadMoreButton.click(),
        ]);

        // During loading, the button text changes to "Loading..." and should be disabled
        const loadingButton = page.getByRole('button', { name: /loading/i });
        await expect(loadingButton).toBeDisabled();

        await expect(page.getByText('Next page button comment')).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: /load more comments/i })).toHaveCount(0);
    });
});

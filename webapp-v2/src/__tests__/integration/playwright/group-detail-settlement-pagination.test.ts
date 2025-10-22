import { GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementWithMembersBuilder, ThemeBuilder } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi } from '../../utils/mock-firebase-service';

test.describe('Group Detail - Settlement Pagination', () => {
    test('should load additional settlements when Load More is clicked', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-settlement-pagination';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Settlement Pagination Group')
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

        const settlementPage1Rent = new SettlementWithMembersBuilder()
            .withId('settlement-p1-1')
            .withGroupId(groupId)
            .withPayer(memberSelf)
            .withPayee(memberTwo)
            .withAmount(50, 'USD')
            .withNote('Rent payment page 1')
            .build();

        const settlementPage1Utilities = new SettlementWithMembersBuilder()
            .withId('settlement-p1-2')
            .withGroupId(groupId)
            .withPayer(memberTwo)
            .withPayee(memberSelf)
            .withAmount(35, 'USD')
            .withNote('Utilities payment page 1')
            .build();

        const settlementPage2Groceries = new SettlementWithMembersBuilder()
            .withId('settlement-p2-1')
            .withGroupId(groupId)
            .withPayer(memberSelf)
            .withPayee(memberTwo)
            .withAmount(20, 'USD')
            .withNote('Groceries payment page 2')
            .build();

        const settlementPage2Internet = new SettlementWithMembersBuilder()
            .withId('settlement-p2-2')
            .withGroupId(groupId)
            .withPayer(memberTwo)
            .withPayee(memberSelf)
            .withAmount(15, 'USD')
            .withNote('Internet payment page 2')
            .build();

        const initialFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members, false)
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([settlementPage1Rent, settlementPage1Utilities], true, 'cursor-settlements-page-2')
            .withComments({ comments: [], hasMore: false })
            .build();

        const subsequentFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members, false)
            .withBalances(balances)
            .withExpenses([], false)
            .withSettlements([settlementPage2Groceries, settlementPage2Internet], false)
            .withComments({ comments: [], hasMore: false })
            .build();

        await mockGroupCommentsApi(page, groupId);

        await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
            const url = new URL(route.request().url());
            const settlementCursor = url.searchParams.get('settlementCursor');
            const responseBody = settlementCursor === 'cursor-settlements-page-2' ? subsequentFullDetails : initialFullDetails;
            await fulfillWithSerialization(route, { body: responseBody });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();
        await groupDetailPage.ensureSettlementHistoryOpen();

        await expect(page.getByTestId('settlement-item')).toHaveCount(2);
        await expect(page.getByText('Rent payment page 1')).toBeVisible();
        await expect(page.getByText('Utilities payment page 1')).toBeVisible();

        const loadMoreButton = page.getByTestId('load-more-settlements-button');
        await expect(loadMoreButton).toBeVisible();

        await loadMoreButton.click();

        await expect(page.getByText('Groceries payment page 2')).toBeVisible();
        await expect(page.getByText('Internet payment page 2')).toBeVisible();
        await expect(page.getByTestId('settlement-item')).toHaveCount(4);
        await expect(loadMoreButton).not.toBeVisible();
    });
});

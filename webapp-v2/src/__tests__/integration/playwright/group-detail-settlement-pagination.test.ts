import { GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementWithMembersBuilder, ThemeBuilder } from '@splitifyd/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

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
                { uid: memberSelf.uid, displayName: memberSelf.groupDisplayName },
                { uid: memberTwo.uid, displayName: memberTwo.groupDisplayName },
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
        // Verify first page settlements by checking amounts
        await expect(page.getByTestId('settlement-item').first()).toContainText('$50.00');
        await expect(page.getByTestId('settlement-item').nth(1)).toContainText('$35.00');

        const loadMoreButton = page.getByTestId('load-more-settlements-button');
        await expect(loadMoreButton).toBeVisible();

        await loadMoreButton.click();

        // Verify second page settlements loaded by checking new amounts
        await expect(page.getByTestId('settlement-item')).toHaveCount(4);
        await expect(page.getByTestId('settlement-item').nth(2)).toContainText('$20.00');
        await expect(page.getByTestId('settlement-item').nth(3)).toContainText('$15.00');
        await expect(loadMoreButton).not.toBeVisible();
    });

    test('should filter settlements to current user by default and show all when toggled', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-settlement-filter';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Settlement Filter Group')
            .build();

        const memberSelf = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const memberTwo = new GroupMemberBuilder()
            .withUid('member-filter-2')
            .withDisplayName('Member Filter Two')
            .withGroupDisplayName('Member Filter Two')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const memberThree = new GroupMemberBuilder()
            .withUid('member-filter-3')
            .withDisplayName('Member Filter Three')
            .withGroupDisplayName('Member Filter Three')
            .withTheme(
                new ThemeBuilder()
                    .withLight('#22C55E')
                    .withDark('#15803D')
                    .withName('green')
                    .build(),
            )
            .build();

        const members = [memberSelf, memberTwo, memberThree];

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts(
                { uid: memberSelf.uid, displayName: memberSelf.groupDisplayName },
                { uid: memberTwo.uid, displayName: memberTwo.groupDisplayName },
                { uid: memberThree.uid, displayName: memberThree.groupDisplayName },
            )
            .build();

        const settlementOthersOnly = new SettlementWithMembersBuilder()
            .withId('settlement-others-only')
            .withGroupId(groupId)
            .withPayer(memberTwo)
            .withPayee(memberThree)
            .withAmount(45, 'USD')
            .withNote('Other members only')
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members, false)
            .withBalances(balances)
            .withSettlements([settlementOthersOnly])
            .withComments({ comments: [], hasMore: false })
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();
        await groupDetailPage.ensureSettlementHistoryOpen();

        await expect(page.getByText(translationEn.settlementHistory.noPaymentsForYou)).toBeVisible();
        await expect(page.getByTestId('settlement-item')).toHaveCount(0);

        await groupDetailPage.toggleShowAllSettlements(true);

        await expect(page.getByText(translationEn.settlementHistory.noPaymentsForYou)).not.toBeVisible();
        await expect(page.getByTestId('settlement-item')).toHaveCount(1);
        await expect(page.getByTestId('settlement-item').first()).toContainText('$45.00');
    });
});

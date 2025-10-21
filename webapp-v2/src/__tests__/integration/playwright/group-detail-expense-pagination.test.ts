import { ExpenseDTOBuilder, GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi } from '../../utils/mock-firebase-service';

test.describe('Group Detail - Expense Pagination', () => {
    test('should load additional expenses when Load More is clicked', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-expense-pagination';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Expense Pagination Group')
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

        const expensePage1Coffee = new ExpenseDTOBuilder()
            .withId('expense-p1-1')
            .withGroupId(groupId)
            .withDescription('Coffee Run Page 1')
            .withAmount(12.5, 'USD')
            .withPaidBy(memberSelf.uid)
            .withCreatedBy(memberSelf.uid)
            .withParticipants([memberSelf.uid, memberTwo.uid])
            .build();

        const expensePage1Lunch = new ExpenseDTOBuilder()
            .withId('expense-p1-2')
            .withGroupId(groupId)
            .withDescription('Lunch Split Page 1')
            .withAmount(28, 'USD')
            .withPaidBy(memberTwo.uid)
            .withCreatedBy(memberTwo.uid)
            .withParticipants([memberSelf.uid, memberTwo.uid])
            .build();

        const expensePage2Taxi = new ExpenseDTOBuilder()
            .withId('expense-p2-1')
            .withGroupId(groupId)
            .withDescription('Taxi Ride Page 2')
            .withAmount(18, 'USD')
            .withPaidBy(memberSelf.uid)
            .withCreatedBy(memberSelf.uid)
            .withParticipants([memberSelf.uid, memberTwo.uid])
            .build();

        const expensePage2Dinner = new ExpenseDTOBuilder()
            .withId('expense-p2-2')
            .withGroupId(groupId)
            .withDescription('Dinner Split Page 2')
            .withAmount(42, 'USD')
            .withPaidBy(memberTwo.uid)
            .withCreatedBy(memberTwo.uid)
            .withParticipants([memberSelf.uid, memberTwo.uid])
            .build();

        const initialFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members, false)
            .withBalances(balances)
            .withExpenses([expensePage1Coffee, expensePage1Lunch], true, 'cursor-expense-page-2')
            .withSettlements([], false)
            .build();

        const subsequentFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members, false)
            .withBalances(balances)
            .withExpenses([expensePage2Taxi, expensePage2Dinner], false)
            .withSettlements([], false)
            .build();

        await mockGroupCommentsApi(page, groupId);

        await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
            const url = new URL(route.request().url());
            const expenseCursor = url.searchParams.get('expenseCursor');
            const responseBody = expenseCursor ? subsequentFullDetails : initialFullDetails;
            await fulfillWithSerialization(route, { body: responseBody });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyExpensesDisplayed(2);
        await groupDetailPage.verifyExpenseDisplayed('Coffee Run Page 1');
        await groupDetailPage.verifyExpenseDisplayed('Lunch Split Page 1');

        const loadMoreButton = page.getByRole('button', { name: 'Load More' });
        await expect(loadMoreButton).toBeVisible();

        await loadMoreButton.click();

        await groupDetailPage.verifyExpensesDisplayed(4);
        await groupDetailPage.verifyExpenseDisplayed('Taxi Ride Page 2');
        await groupDetailPage.verifyExpenseDisplayed('Dinner Split Page 2');
        await expect(loadMoreButton).toBeHidden();
    });
});

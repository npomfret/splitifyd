import { toISOString } from '@splitifyd/shared';
import {
    ExpenseDTOBuilder,
    GroupBalancesBuilder,
    GroupDetailPage,
    GroupDTOBuilder,
    GroupFullDetailsBuilder,
    GroupMemberBuilder,
    SettlementWithMembersBuilder,
    ThemeBuilder,
} from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi } from '../../utils/mock-firebase-service';

test.describe('Group Detail - Include Deleted Controls', () => {
    test('hides include deleted toggles for members without elevated permissions', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-include-deleted-hidden';

        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withCreatedBy('group-owner')
            .withName('Hidden Include Deleted Group')
            .withPermissions({
                expenseEditing: 'admin-only',
                expenseDeletion: 'admin-only',
                settingsManagement: 'admin-only',
            })
            .build();

        const memberSelf = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .asMember()
            .build();

        const ownerMember = new GroupMemberBuilder()
            .withUid('group-owner')
            .withDisplayName('Original Owner')
            .withGroupDisplayName('Original Owner')
            .withTheme(ThemeBuilder.red().build())
            .asAdmin()
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts(
                { uid: memberSelf.uid, displayName: memberSelf.groupDisplayName },
                { uid: ownerMember.uid, displayName: ownerMember.groupDisplayName },
            )
            .build();

        const activeExpense = new ExpenseDTOBuilder()
            .withExpenseId('expense-active-1')
            .withGroupId(groupId)
            .withDescription('Board Games Night')
            .withAmount(45, 'USD')
            .withPaidBy(ownerMember.uid)
            .withCreatedBy(ownerMember.uid)
            .withParticipants([memberSelf.uid, ownerMember.uid])
            .build();

        const activeSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-active-1')
            .withGroupId(groupId)
            .withPayer(ownerMember)
            .withPayee(memberSelf)
            .withAmount(20, 'USD')
            .build();

        const initialFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([memberSelf, ownerMember])
            .withBalances(balances)
            .withExpenses([activeExpense], false)
            .withSettlements([activeSettlement], false)
            .build();

        const requestLog: Array<{ includeDeletedExpenses: string | null; includeDeletedSettlements: string | null; }> = [];

        await mockGroupCommentsApi(page, groupId);

        await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
            const url = new URL(route.request().url());
            requestLog.push({
                includeDeletedExpenses: url.searchParams.get('includeDeletedExpenses'),
                includeDeletedSettlements: url.searchParams.get('includeDeletedSettlements'),
            });
            await fulfillWithSerialization(route, { body: initialFullDetails });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyIncludeDeletedExpensesCheckboxNotExists();

        await groupDetailPage.ensureSettlementsSectionExpanded();
        await groupDetailPage.verifyIncludeDeletedSettlementsCheckboxNotExists();

        expect(requestLog.length).toBeGreaterThan(0);
        for (const entry of requestLog) {
            expect(entry.includeDeletedExpenses).toBe('false');
            expect(entry.includeDeletedSettlements).toBe('false');
        }
    });

    test('allows authorized members to include deleted expenses and settlements', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'group-include-deleted-visible';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Audit Friendly Group')
            .withPermissions({
                expenseEditing: 'owner-and-admin',
                expenseDeletion: 'owner-and-admin',
                settingsManagement: 'admin-only',
            })
            .build();

        const adminMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .asAdmin()
            .build();

        const regularMember = new GroupMemberBuilder()
            .withUid('member-2')
            .withDisplayName('Travel Buddy')
            .withGroupDisplayName('Travel Buddy')
            .withTheme(ThemeBuilder.red().build())
            .asMember()
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withNoDebts(
                { uid: adminMember.uid, displayName: adminMember.groupDisplayName },
                { uid: regularMember.uid, displayName: regularMember.groupDisplayName },
            )
            .build();

        const activeExpense = new ExpenseDTOBuilder()
            .withExpenseId('expense-active-1')
            .withGroupId(groupId)
            .withDescription('Museum Tickets')
            .withAmount(30, 'USD')
            .withPaidBy(adminMember.uid)
            .withCreatedBy(adminMember.uid)
            .withParticipants([adminMember.uid, regularMember.uid])
            .build();

        const deletedExpense = new ExpenseDTOBuilder()
            .withExpenseId('expense-deleted-1')
            .withGroupId(groupId)
            .withDescription('Canceled Tour Deposit')
            .withAmount(120, 'USD')
            .withPaidBy(adminMember.uid)
            .withCreatedBy(adminMember.uid)
            .withParticipants([adminMember.uid, regularMember.uid])
            .withDeletedAt(new Date())
            .withDeletedBy(adminMember.uid)
            .build();

        const activeSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-active-1')
            .withGroupId(groupId)
            .withPayer(adminMember)
            .withPayee(regularMember)
            .withAmount(25, 'USD')
            .build();

        const deletedSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-deleted-1')
            .withGroupId(groupId)
            .withPayer(regularMember)
            .withPayee(adminMember)
            .withAmount(40, 'USD')
            .build();

        deletedSettlement.deletedAt = toISOString(new Date().toISOString());
        deletedSettlement.deletedBy = adminMember.uid;

        const initialFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([adminMember, regularMember])
            .withBalances(balances)
            .withExpenses([activeExpense], false)
            .withSettlements([activeSettlement], false)
            .build();

        const withDeletedExpensesOnly = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([adminMember, regularMember])
            .withBalances(balances)
            .withExpenses([activeExpense, deletedExpense], false)
            .withSettlements([activeSettlement], false)
            .build();

        const withDeletedSettlementsOnly = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([adminMember, regularMember])
            .withBalances(balances)
            .withExpenses([activeExpense], false)
            .withSettlements([activeSettlement, deletedSettlement], false)
            .build();

        const withDeletedAll = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([adminMember, regularMember])
            .withBalances(balances)
            .withExpenses([activeExpense, deletedExpense], false)
            .withSettlements([activeSettlement, deletedSettlement], false)
            .build();

        const requestLog: Array<{ includeDeletedExpenses: string | null; includeDeletedSettlements: string | null; }> = [];

        await mockGroupCommentsApi(page, groupId);

        await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
            const url = new URL(route.request().url());
            const includeDeletedExpenses = url.searchParams.get('includeDeletedExpenses');
            const includeDeletedSettlements = url.searchParams.get('includeDeletedSettlements');

            requestLog.push({ includeDeletedExpenses, includeDeletedSettlements });

            let body = initialFullDetails;
            if (includeDeletedExpenses === 'true' && includeDeletedSettlements === 'true') {
                body = withDeletedAll;
            } else if (includeDeletedExpenses === 'true') {
                body = withDeletedExpensesOnly;
            } else if (includeDeletedSettlements === 'true') {
                body = withDeletedSettlementsOnly;
            }

            await fulfillWithSerialization(route, { body });
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyIncludeDeletedExpensesCheckboxVisible();

        await groupDetailPage.ensureSettlementsSectionExpanded();
        await groupDetailPage.verifyIncludeDeletedSettlementsCheckboxVisible();

        await groupDetailPage.verifyExpenseByDescriptionNotVisible('Canceled Tour Deposit');
        await groupDetailPage.verifySettlementContainerVisible();

        const includeExpensesRequest = page.waitForRequest((request) => {
            if (!request.url().includes(`/api/groups/${groupId}/full-details`)) return false;
            const url = new URL(request.url());
            return url.searchParams.get('includeDeletedExpenses') === 'true';
        });

        await groupDetailPage.clickIncludeDeletedExpensesCheckbox();
        await includeExpensesRequest;
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifyExpenseByDescriptionVisible('Canceled Tour Deposit');
        await groupDetailPage.verifyExpensesContainerVisible();

        const includeSettlementsRequest = page.waitForRequest((request) => {
            if (!request.url().includes(`/api/groups/${groupId}/full-details`)) return false;
            const url = new URL(request.url());
            return url.searchParams.get('includeDeletedSettlements') === 'true';
        });

        await groupDetailPage.clickIncludeDeletedSettlementsCheckbox();
        await includeSettlementsRequest;
        await groupDetailPage.waitForGroupToLoad();

        await groupDetailPage.verifySettlementContainerVisible();

        expect(requestLog.some((entry) => entry.includeDeletedExpenses === 'true')).toBe(true);
        expect(requestLog.some((entry) => entry.includeDeletedSettlements === 'true')).toBe(true);
    });
});

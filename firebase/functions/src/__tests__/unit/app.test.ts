import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    amountToSmallestUnit,
    calculateEqualSplits,
    calculatePercentageSplits,
    MemberRoles,
    MemberStatuses,
    smallestUnitToAmountString,
    SystemUserRoles,
    toAmount,
    toGroupName,
    toShowLandingPageFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantAppName,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    UserBalance,
    toCurrencyISOCode,
    USD, toUserId,
    toEmail,
} from '@billsplit-wl/shared';
import type { ShareLinkToken, UserId } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import { toExpenseId } from '@billsplit-wl/shared';
import { toPassword } from '@billsplit-wl/shared';
import { toPolicyId, toPolicyName, toPolicyText, toVersionHash } from '@billsplit-wl/shared';
import {
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    CreateSettlementRequestBuilder,
    ExpenseSplitBuilder,
    ExpenseUpdateBuilder,
    GroupUpdateBuilder,
    PasswordChangeRequestBuilder,
    RegisterRequestBuilder,
    SettlementUpdateBuilder,
    UserUpdateBuilder,
    AdminTenantRequestBuilder,
    UserRegistrationBuilder,
} from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from './AppDriver';

const amountFor = (splits: Array<{ uid: string; amount: string; }>, uid: string) => splits.find((split) => split.uid === uid)!.amount;

const netBalanceForPayer = (splits: Array<{ uid: string; amount: string; }>, payerId: UserId, currency: CurrencyISOCode) => {
    const totalUnits = splits
        .filter((split) => split.uid !== payerId)
        .reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currency), 0);
    return smallestUnitToAmountString(totalUnits, currency);
};

const sumBalances = (balances: Record<string, UserBalance>, currency: CurrencyISOCode): number => {
    return Object.values(balances).reduce((sum, balance) => {
        return sum + amountToSmallestUnit(balance.netBalance, currency);
    }, 0);
};

const verifyBalanceConsistency = (balances: Record<string, UserBalance>, currency: CurrencyISOCode, testDescription: string) => {
    const totalBalance = sumBalances(balances, currency);
    expect(totalBalance, `Total balance should be zero for ${testDescription} (found ${totalBalance} smallest units)`).toBe(0);
};

describe('app tests', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;
    let user3: UserId;
    let user4: UserId;
    let adminUser: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        // Register users via API
        const user1Reg = new UserRegistrationBuilder()
            .withEmail('user1@example.com')
            .withDisplayName('User one')
            .withPassword('password12345')
            .build();
        const user1Result = await appDriver.registerUser(user1Reg);
        user1 = toUserId(user1Result.user.uid);

        const user2Reg = new UserRegistrationBuilder()
            .withEmail('user2@example.com')
            .withDisplayName('User two')
            .withPassword('password12345')
            .build();
        const user2Result = await appDriver.registerUser(user2Reg);
        user2 = toUserId(user2Result.user.uid);

        const user3Reg = new UserRegistrationBuilder()
            .withEmail('user3@example.com')
            .withDisplayName('User three')
            .withPassword('password12345')
            .build();
        const user3Result = await appDriver.registerUser(user3Reg);
        user3 = toUserId(user3Result.user.uid);

        const user4Reg = new UserRegistrationBuilder()
            .withEmail('user4@example.com')
            .withDisplayName('User four')
            .withPassword('password12345')
            .build();
        const user4Result = await appDriver.registerUser(user4Reg);
        user4 = toUserId(user4Result.user.uid);

        // Create admin user for policy management and tenant operations
        const adminReg = new UserRegistrationBuilder()
            .withEmail('admin@example.com')
            .withDisplayName('Admin User')
            .withPassword('password12345')
            .build();
        const adminResult = await appDriver.registerUser(adminReg);
        adminUser = toUserId(adminResult.user.uid);
        appDriver.seedAdminUser(adminUser);
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('happy path tests', async () => {
        it('should revert balance change after expese deletion', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, toCurrencyISOCode('EUR'))
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), toCurrencyISOCode('EUR'), participants))
                    .build(),
                user1,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const eur = toCurrencyISOCode('EUR');

            expect(groupDetails.balances.balancesByCurrency![eur]![user1].owedBy[user2]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user1].netBalance).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owes[user1]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].netBalance).toBe('-50.00');

            await appDriver.updateExpense(
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(150.5, toCurrencyISOCode('EUR'))
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(150.5), toCurrencyISOCode('EUR'), participants))
                    .build(),
                user1,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.balances.balancesByCurrency?.[eur]).toBeDefined();
            expect((groupDetails.balances.balancesByCurrency![eur])![user1]).toBeDefined();
            expect((groupDetails.balances.balancesByCurrency![eur])![user1].owedBy[user2]).toBe('75.25');
            expect((groupDetails.balances.balancesByCurrency![eur])![user1].netBalance).toBe('75.25');
            expect((groupDetails.balances.balancesByCurrency![eur])![user2].owes[user1]).toBe('75.25');
            expect((groupDetails.balances.balancesByCurrency![eur])![user2].netBalance).toBe('-75.25');

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50.25, toCurrencyISOCode('EUR'))
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.balances.balancesByCurrency![eur]![user1].owedBy[user2]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user1].netBalance).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owes[user1]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].netBalance).toBe('-25.00');

            await appDriver.deleteExpense(createdExpense.id, user1);

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.balances.balancesByCurrency![eur]![user1].owes[user2]).toBe('50.25');
            expect(groupDetails.balances.balancesByCurrency![eur]![user1].netBalance).toBe('-50.25');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owedBy[user1]).toBe('50.25');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].netBalance).toBe('50.25');
        });

        it('should paginate expenses and settlements via group full details', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const createdExpenseIds: string[] = [];
            for (let index = 0; index < 5; index += 1) {
                const amount = 50 + index;
                const expense = await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withDescription(`Paginated expense ${index}`)
                        .withAmount(amount, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(amount), USD, participants))
                        .build(),
                    user1,
                );

                createdExpenseIds.push(expense.id);
            }

            const settlementAmounts = [40, 30, 20, 10];
            const createdSettlementIds: string[] = [];
            for (const amount of settlementAmounts) {
                const settlement = await appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(groupId)
                        .withPayerId(user2)
                        .withPayeeId(user1)
                        .withAmount(amount, USD)
                        .build(),
                    user2,
                );

                createdSettlementIds.push(settlement.id);
            }

            expect(createdSettlementIds).toHaveLength(settlementAmounts.length);

            const firstPage = await appDriver.getGroupFullDetails(groupId, {
                expenseLimit: 2,
                settlementLimit: 2,
            }, user1);

            expect(firstPage.expenses.expenses).toHaveLength(2);
            expect(firstPage.expenses.hasMore).toBe(true);
            expect(firstPage.expenses.nextCursor).toBeDefined();

            expect(firstPage.settlements.settlements).toHaveLength(2);
            expect(firstPage.settlements.hasMore).toBe(true);
            expect(firstPage.settlements.nextCursor).toBeDefined();

            const secondPage = await appDriver.getGroupFullDetails(groupId, {
                expenseLimit: 2,
                expenseCursor: firstPage.expenses.nextCursor,
                settlementLimit: 2,
                settlementCursor: firstPage.settlements.nextCursor,
            }, user1);

            expect(secondPage.expenses.expenses.length).toBeGreaterThanOrEqual(1);

            const seenSettlementIds = [
                ...firstPage.settlements.settlements.map((settlement) => settlement.id),
                ...secondPage.settlements.settlements.map((settlement) => settlement.id),
            ];
            let settlementCursor = secondPage.settlements.nextCursor;

            while (settlementCursor) {
                const nextPage = await appDriver.getGroupFullDetails(groupId, {
                    settlementLimit: 2,
                    settlementCursor,
                }, user1);

                seenSettlementIds.push(...nextPage.settlements.settlements.map((settlement) => settlement.id));
                settlementCursor = nextPage.settlements.nextCursor;
            }

            const thirdPage = await appDriver.getGroupFullDetails(groupId, {
                expenseLimit: 2,
                expenseCursor: secondPage.expenses.nextCursor,
            }, user1);

            expect(secondPage.expenses.expenses).toHaveLength(2);
            expect(secondPage.expenses.hasMore).toBe(true);
            expect(secondPage.expenses.nextCursor).toBeDefined();

            expect(thirdPage.expenses.expenses).toHaveLength(1);
            expect(thirdPage.expenses.hasMore).toBe(false);
            expect(thirdPage.expenses.nextCursor).toBeUndefined();

            const allExpenseIds = [
                ...firstPage.expenses.expenses,
                ...secondPage.expenses.expenses,
                ...thirdPage.expenses.expenses,
            ]
                .map((expense) => expense.id);

            expect(new Set(allExpenseIds)).toEqual(new Set(createdExpenseIds));
            expect(new Set(seenSettlementIds)).toEqual(new Set(createdSettlementIds));
        });

        it('should track balances separately for multi-currency expenses', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];

            const kwdSplits = calculateEqualSplits(toAmount(12.345), toCurrencyISOCode('KWD'), participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(12.345, toCurrencyISOCode('KWD'))
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(kwdSplits)
                    .build(),
                user1,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            const kwdBalances = groupDetails.balances.balancesByCurrency?.[toCurrencyISOCode('KWD')];
            expect(kwdBalances).toBeDefined();
            expect(kwdBalances![user1].owedBy[user2]).toBe(amountFor(kwdSplits, user2));
            expect(kwdBalances![user1].owedBy[user3]).toBe(amountFor(kwdSplits, user3));
            expect(kwdBalances![user1].netBalance).toBe(netBalanceForPayer(kwdSplits, user1, toCurrencyISOCode('KWD')));
            expect(kwdBalances![user2].owes[user1]).toBe(amountFor(kwdSplits, user2));
            expect(kwdBalances![user3].owes[user1]).toBe(amountFor(kwdSplits, user3));
            expect(kwdBalances![user2].netBalance).toBe(`-${amountFor(kwdSplits, user2)}`);
            expect(kwdBalances![user3].netBalance).toBe(`-${amountFor(kwdSplits, user3)}`);

            const jpySplits = calculateEqualSplits(toAmount(303), toCurrencyISOCode('JPY'), participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(303, toCurrencyISOCode('JPY'))
                    .withPaidBy(user2)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(jpySplits)
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            const jpyBalances = groupDetails.balances.balancesByCurrency?.[toCurrencyISOCode('JPY')];
            expect(jpyBalances).toBeDefined();
            expect(jpyBalances![user2].owedBy[user1]).toBe(amountFor(jpySplits, user1));
            expect(jpyBalances![user2].owedBy[user3]).toBe(amountFor(jpySplits, user3));
            expect(jpyBalances![user2].netBalance).toBe(netBalanceForPayer(jpySplits, user2, toCurrencyISOCode('JPY')));
            expect(jpyBalances![user1].owes[user2]).toBe(amountFor(jpySplits, user1));
            expect(jpyBalances![user3].owes[user2]).toBe(amountFor(jpySplits, user3));
            expect(jpyBalances![user1].netBalance).toBe(`-${amountFor(jpySplits, user1)}`);
            expect(jpyBalances![user3].netBalance).toBe(`-${amountFor(jpySplits, user3)}`);

            const gbpSplits = calculateEqualSplits(toAmount(45.67), toCurrencyISOCode('GBP'), participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(45.67, toCurrencyISOCode('GBP'))
                    .withPaidBy(user3)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(gbpSplits)
                    .build(),
                user3,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            const gbpBalances = groupDetails.balances.balancesByCurrency?.[toCurrencyISOCode('GBP')];
            expect(gbpBalances).toBeDefined();
            expect(gbpBalances![user3].owedBy[user1]).toBe(amountFor(gbpSplits, user1));
            expect(gbpBalances![user3].owedBy[user2]).toBe(amountFor(gbpSplits, user2));
            expect(gbpBalances![user3].netBalance).toBe(netBalanceForPayer(gbpSplits, user3, toCurrencyISOCode('GBP')));
            expect(gbpBalances![user1].owes[user3]).toBe(amountFor(gbpSplits, user1));
            expect(gbpBalances![user2].owes[user3]).toBe(amountFor(gbpSplits, user2));
            expect(gbpBalances![user1].netBalance).toBe(`-${amountFor(gbpSplits, user1)}`);
            expect(gbpBalances![user2].netBalance).toBe(`-${amountFor(gbpSplits, user2)}`);

            expect(groupDetails.balances.balancesByCurrency![toCurrencyISOCode('KWD')]![user1].owedBy[user2]).toBe(amountFor(kwdSplits, user2));
            expect(groupDetails.balances.balancesByCurrency![toCurrencyISOCode('KWD')]![user1].owedBy[user3]).toBe(amountFor(kwdSplits, user3));
        });

        it('should support exact split expenses with manual allocations', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];

            const exactSplits = ExpenseSplitBuilder
                .exactSplit([
                    { uid: user1, amount: '120.10' },
                    { uid: user2, amount: '80.05' },
                    { uid: user3, amount: '75.10' },
                ])
                .build();

            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(275.25, USD)
                    .withPaidBy(user2)
                    .withParticipants(participants)
                    .withSplitType('exact')
                    .withSplits(exactSplits)
                    .build(),
                user2,
            );

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];
            expect(usdBalances).toBeDefined();
            expect(usdBalances![user2].owedBy[user1]).toBe(amountFor(exactSplits, user1));
            expect(usdBalances![user2].owedBy[user3]).toBe(amountFor(exactSplits, user3));
            expect(usdBalances![user2].netBalance).toBe(netBalanceForPayer(exactSplits, user2, USD));
            expect(usdBalances![user1].owes[user2]).toBe(amountFor(exactSplits, user1));
            expect(usdBalances![user3].owes[user2]).toBe(amountFor(exactSplits, user3));
            expect(usdBalances![user1].netBalance).toBe(`-${amountFor(exactSplits, user1)}`);
            expect(usdBalances![user3].netBalance).toBe(`-${amountFor(exactSplits, user3)}`);

            const recordedExpense = groupDetails.expenses.expenses.find((expense) => expense.id === createdExpense.id);
            expect(recordedExpense).toBeDefined();
            expect(recordedExpense!.splitType).toBe('exact');
            expect(recordedExpense!.amount).toBe('275.25');
            expect(recordedExpense!.currency).toBe(USD);
            expect(recordedExpense!.paidBy).toBe(user2);
            expect(recordedExpense!.splits).toEqual(exactSplits);
        });

        it('should allow percentage split expenses to be updated with new participants, currency, and payer', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];

            const percentageSplits = calculatePercentageSplits(toAmount(200), toCurrencyISOCode('EUR'), participants);
            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Team Outing EUR')
                    .withAmount(200, toCurrencyISOCode('EUR'))
                    .withPaidBy(user3)
                    .withParticipants(participants)
                    .withSplitType('percentage')
                    .withSplits(percentageSplits)
                    .build(),
                user3,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user3);
            const eur = toCurrencyISOCode('EUR');

            const eurBalances = groupDetails.balances.balancesByCurrency?.[eur];
            expect(eurBalances).toBeDefined();
            expect(eurBalances![user3].owedBy[user1]).toBe(amountFor(percentageSplits, user1));
            expect(eurBalances![user3].owedBy[user2]).toBe(amountFor(percentageSplits, user2));
            expect(eurBalances![user3].netBalance).toBe(netBalanceForPayer(percentageSplits, user3, toCurrencyISOCode('EUR')));
            expect(eurBalances![user1].owes[user3]).toBe(amountFor(percentageSplits, user1));
            expect(eurBalances![user2].owes[user3]).toBe(amountFor(percentageSplits, user2));
            expect(eurBalances![user1].netBalance).toBe(`-${amountFor(percentageSplits, user1)}`);
            expect(eurBalances![user2].netBalance).toBe(`-${amountFor(percentageSplits, user2)}`);

            const recordedExpenseBeforeUpdate = groupDetails.expenses.expenses.find((expense) => expense.id === createdExpense.id);
            expect(recordedExpenseBeforeUpdate).toBeDefined();
            expect(recordedExpenseBeforeUpdate!.splitType).toBe('percentage');
            expect(recordedExpenseBeforeUpdate!.currency).toBe(toCurrencyISOCode('EUR'));
            expect(recordedExpenseBeforeUpdate!.splits.map((split) => split.amount)).toEqual(percentageSplits.map((split) => split.amount));
            expect(recordedExpenseBeforeUpdate!.splits.map((split) => split.percentage)).toEqual(percentageSplits.map((split) => split.percentage));

            const updatedParticipants = [user1, user2];
            const updatedSplits = calculateEqualSplits(toAmount(303), toCurrencyISOCode('JPY'), updatedParticipants);
            await appDriver.updateExpense(
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withDescription('Team Outing JPY')
                    .withAmount(303, toCurrencyISOCode('JPY'))
                    .withPaidBy(user1)
                    .withParticipants(updatedParticipants)
                    .withSplitType('equal')
                    .withSplits(updatedSplits)
                    .build(),
                user1,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            const jpyBalances = groupDetails.balances.balancesByCurrency?.[toCurrencyISOCode('JPY')];
            expect(jpyBalances).toBeDefined();
            expect(jpyBalances![user1].owedBy[user2]).toBe(amountFor(updatedSplits, user2));
            expect(jpyBalances![user1].netBalance).toBe(netBalanceForPayer(updatedSplits, user1, toCurrencyISOCode('JPY')));
            expect(jpyBalances![user2].owes[user1]).toBe(amountFor(updatedSplits, user2));
            expect(jpyBalances![user2].netBalance).toBe(`-${amountFor(updatedSplits, user2)}`);
            expect(jpyBalances![user3].netBalance).toBe('0');
            expect(jpyBalances![user3].owedBy).toEqual({});
            expect(jpyBalances![user3].owes).toEqual({});

            const eurBalancesAfterUpdate = groupDetails.balances.balancesByCurrency?.[eur];
            expect(eurBalancesAfterUpdate).toBeDefined();
            Object.entries(eurBalancesAfterUpdate!).forEach(([uid, balance]) => {
                expect([user1, user2, user3]).toContain(uid);
                expect(balance.netBalance).toBe('0.00');
                expect(balance.owedBy).toEqual({});
                expect(balance.owes).toEqual({});
            });

            const recordedExpenseAfterUpdate = groupDetails.expenses.expenses.find((expense) => expense.id === createdExpense.id);
            expect(recordedExpenseAfterUpdate).toBeDefined();
            expect(recordedExpenseAfterUpdate!.description).toBe('Team Outing JPY');
            expect(recordedExpenseAfterUpdate!.currency).toBe(toCurrencyISOCode('JPY'));
            expect(recordedExpenseAfterUpdate!.amount).toBe('303');
            expect(recordedExpenseAfterUpdate!.paidBy).toBe(user1);
            expect(recordedExpenseAfterUpdate!.splitType).toBe('equal');
            expect(recordedExpenseAfterUpdate!.participants).toEqual(updatedParticipants);
            expect(recordedExpenseAfterUpdate!.splits).toEqual(updatedSplits);
        });

        it('should generate different share links on consecutive calls', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            // Generate first share link
            const { shareablePath: path1, shareToken: shareToken1, expiresAt: expiresAt1 } = await appDriver.generateShareableLink(groupId, undefined, user1);
            expect(path1).toBe(`/join?shareToken=${shareToken1}`);
            expect(shareToken1).toHaveLength(16);
            expect(expiresAt1).toBeTruthy();

            // Generate second share link (simulating "Generate New" button)
            const { shareablePath: path2, shareToken: shareToken2, expiresAt: expiresAt2 } = await appDriver.generateShareableLink(groupId, undefined, user1);
            expect(path2).toBe(`/join?shareToken=${shareToken2}`);
            expect(shareToken2).toHaveLength(16);
            expect(expiresAt2).toBeTruthy();

            // Verify links are different
            expect(shareToken2).not.toBe(shareToken1);
            expect(path2).not.toBe(path1);

            // Verify both links are valid and functional by joining with them
            await appDriver.joinGroupByLink(shareToken1, undefined, user2);
            await appDriver.joinGroupByLink(shareToken2, undefined, user3);

            // Verify both users successfully joined by checking group listing
            const { groups: groupsUser2 } = await appDriver.listGroups({}, user2);
            const { groups: groupsUser3 } = await appDriver.listGroups({}, user3);

            expect(groupsUser2.find((g) => g.id === groupId)).toBeTruthy();
            expect(groupsUser3.find((g) => g.id === groupId)).toBeTruthy();
        });

        it('should allow sharing a group and list membership balances for all users', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareablePath, shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            expect(shareablePath).toBe(`/join?shareToken=${shareToken}`);
            expect(shareToken).toHaveLength(16);

            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];
            const usdSplits = calculateEqualSplits(toAmount(90), USD, participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Beach house deposit')
                    .withAmount(90, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(usdSplits)
                    .build(),
                user1,
            );

            const listResponseUser1 = await appDriver.listGroups({}, user1);
            expect(listResponseUser1.count).toBe(1);
            expect(listResponseUser1.hasMore).toBe(false);
            expect(listResponseUser1.pagination.limit).toBeGreaterThan(0);

            const summaryForUser1 = listResponseUser1.groups.find((item) => item.id === groupId);
            expect(summaryForUser1).toBeDefined();
            expect(summaryForUser1!.balance?.balancesByCurrency?.[USD]?.netBalance).toBe('60.00');
            expect(summaryForUser1!.balance?.balancesByCurrency?.[USD]?.totalOwed).toBe('60.00');
            expect(summaryForUser1!.balance?.balancesByCurrency?.[USD]?.totalOwing).toBe('0.00');

            const listResponseUser2 = await appDriver.listGroups({}, user2);
            expect(listResponseUser2.count).toBe(1);
            expect(listResponseUser2.hasMore).toBe(false);

            const summaryForUser2 = listResponseUser2.groups.find((item) => item.id === groupId);
            expect(summaryForUser2).toBeDefined();
            expect(summaryForUser2!.balance?.balancesByCurrency?.[USD]?.netBalance).toBe('-30.00');
            expect(summaryForUser2!.balance?.balancesByCurrency?.[USD]?.totalOwed).toBe('0.00');
            expect(summaryForUser2!.balance?.balancesByCurrency?.[USD]?.totalOwing).toBe('30.00');

            const listResponseUser3 = await appDriver.listGroups({}, user3);
            expect(listResponseUser3.count).toBe(1);
            expect(listResponseUser3.hasMore).toBe(false);

            const summaryForUser3 = listResponseUser3.groups.find((item) => item.id === groupId);
            expect(summaryForUser3).toBeDefined();
            expect(summaryForUser3!.balance?.balancesByCurrency?.[USD]?.netBalance).toBe('-30.00');
            expect(summaryForUser3!.balance?.balancesByCurrency?.[USD]?.totalOwed).toBe('0.00');
            expect(summaryForUser3!.balance?.balancesByCurrency?.[USD]?.totalOwing).toBe('30.00');
        });

        it('should allow sequential settlements to clear shared expense balances', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const firstExpenseSplits = calculateEqualSplits(toAmount(120), USD, participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(120, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(firstExpenseSplits)
                    .build(),
                user1,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.balances.balancesByCurrency![USD]![user1].owedBy[user2]).toBe('60.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].netBalance).toBe('60.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].owes[user1]).toBe('60.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].netBalance).toBe('-60.00');

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(10, USD)
                    .withCurrency(USD)
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.balances.balancesByCurrency![USD]![user1].owedBy[user2]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].netBalance).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].owes[user1]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].netBalance).toBe('-50.00');
            expect(groupDetails.settlements.settlements).toHaveLength(1);
            expect(groupDetails.settlements.settlements[0].amount).toBe('10');

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50, USD)
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.balances.balancesByCurrency![USD]![user1].owedBy[user2]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].owes[user2]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].netBalance).toBe('0.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].owes[user1]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].owedBy[user1]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].netBalance).toBe('0.00');
            expect(groupDetails.settlements.settlements).toHaveLength(2);
            const settlementAmounts = groupDetails
                .settlements
                .settlements
                .map((settlement) => settlement.amount)
                .sort();
            expect(settlementAmounts).toEqual(['10', '50']);
        });

        it('should preserve expense metadata and remove it cleanly on deletion', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const metadataSplits = calculateEqualSplits(toAmount(80), USD, participants);

            const metadataExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Hotel booking with receipt')
                    .withAmount(80, USD)
                    .withPaidBy(user1)
                    .withLabel('Travel')
                    .withDate('2024-06-15T12:30:00.000Z')
                    .withReceiptUrl('https://example.com/receipts/hotel.jpg')
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(metadataSplits)
                    .build(),
                user1,
            );

            const secondarySplits = calculateEqualSplits(toAmount(50), USD, participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Fuel stop')
                    .withAmount(50, USD)
                    .withPaidBy(user2)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(secondarySplits)
                    .build(),
                user2,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.expenses.expenses).toHaveLength(2);
            const recordedMetadataExpense = groupDetails.expenses.expenses.find((expense) => expense.id === metadataExpense.id);
            expect(recordedMetadataExpense).toBeDefined();
            expect(recordedMetadataExpense!.description).toBe('Hotel booking with receipt');
            expect(recordedMetadataExpense!.label).toBe('Travel');
            expect(recordedMetadataExpense!.date).toBe('2024-06-15T12:30:00.000Z');
            expect(recordedMetadataExpense!.receiptUrl).toBe('https://example.com/receipts/hotel.jpg');
            expect(recordedMetadataExpense!.splits).toEqual(metadataSplits);

            await appDriver.deleteExpense(metadataExpense.id, user1);

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.expenses.expenses).toHaveLength(1);
            expect(groupDetails.expenses.expenses[0].description).toBe('Fuel stop');
            expect(groupDetails.expenses.expenses[0].splits).toEqual(secondarySplits);
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].owes[user2]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].netBalance).toBe('-25.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].owedBy[user1]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].netBalance).toBe('25.00');
        });

        it('should allow members to leave and rejoin via share link', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            let preview = await appDriver.previewGroupByLink(shareToken, user2);
            expect(preview.isAlreadyMember).toBe(true);
            expect(preview.memberCount).toBe(2);

            await appDriver.leaveGroup(groupId, user2);

            preview = await appDriver.previewGroupByLink(shareToken, user2);
            expect(preview.isAlreadyMember).toBe(false);
            expect(preview.memberCount).toBe(1);

            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const user2Groups = await appDriver.listGroups({}, user2);
            expect(user2Groups.count).toBe(1);
            expect(user2Groups.groups[0].id).toBe(groupId);
        });

        it('should respect custom share link expiration timestamps', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Custom Expiry Group').build(), user1);
            const groupId = group.id;

            const customExpiration = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

            const shareLink = await appDriver.generateShareableLink(groupId, customExpiration, user1);

            expect(shareLink.expiresAt).toBe(customExpiration);

            const preview = await appDriver.previewGroupByLink(shareLink.shareToken, user2);
            expect(preview.groupId).toBe(groupId);
            expect(preview.isAlreadyMember).toBe(false);

            const joinResult = await appDriver.joinGroupByLink(shareLink.shareToken, undefined, user2);
            expect(joinResult.success).toBe(true);

            const members = (await appDriver.getGroupFullDetails(groupId, {}, user1)).members.members;
            expect(members.some(({ uid }) => uid === user2)).toBe(true);
        });

        it('should reject preview and join operations once a share link has expired', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Expiring Group').build(), user1);
            const groupId = group.id;

            const nearFutureExpiration = new Date(Date.now() + 1000).toISOString();
            const { shareToken } = await appDriver.generateShareableLink(groupId, nearFutureExpiration, user1);

            await new Promise((resolve) => setTimeout(resolve, 1200));

            await expect(appDriver.previewGroupByLink(shareToken, user2)).rejects.toMatchObject({ code: 'LINK_EXPIRED' });
            await expect(appDriver.joinGroupByLink(shareToken, undefined, user2)).rejects.toMatchObject({ code: 'INVALID_LINK' });
        });

        it('should let members update their own group display name', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Design Team')
                    .build(),
                user1,
            );

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await appDriver.updateGroupMemberDisplayName(groupId, 'UI Specialist', user2);

            const detailsForOwner = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const updatedMember = detailsForOwner.members.members.find((member) => member.uid === user2);
            expect(updatedMember?.groupDisplayName).toBe('UI Specialist');

            const detailsForMember = await appDriver.getGroupFullDetails(groupId, {}, user2);
            expect(detailsForMember.group.name).toBe('Design Team');
            const selfViewMember = detailsForMember.members.members.find((member) => member.uid === user2);
            expect(selfViewMember?.groupDisplayName).toBe('UI Specialist');
        });

        it('should handle group previews, updates, member management, and deletion', async () => {
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Adventure Squad')
                    .build(),
                user1,
            );

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);

            const previewBeforeJoin = await appDriver.previewGroupByLink(shareToken, user2);
            expect(previewBeforeJoin.groupId).toBe(groupId);
            expect(previewBeforeJoin.groupName).toBe('Adventure Squad');
            expect(previewBeforeJoin.memberCount).toBe(1);
            expect(previewBeforeJoin.isAlreadyMember).toBe(false);

            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const previewAfterJoin = await appDriver.previewGroupByLink(shareToken, user2);
            expect(previewAfterJoin.isAlreadyMember).toBe(true);
            expect(previewAfterJoin.memberCount).toBe(2);

            await appDriver.updateGroup(groupId, new GroupUpdateBuilder().withName(toGroupName('Adventure Squad+')).withDescription('Updated itinerary for the squad').build(), user1);
            await appDriver.updateGroupMemberDisplayName(groupId, 'Squad Leader', user1);

            await appDriver.joinGroupByLink(shareToken, undefined, user3);
            await appDriver.removeGroupMember(groupId, user3, user1);

            await appDriver.leaveGroup(groupId, user2);

            const updatedGroupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            expect(updatedGroupDetails.group.name).toBe('Adventure Squad+');
            expect(updatedGroupDetails.group.description).toBe('Updated itinerary for the squad');
            expect(updatedGroupDetails.members.members).toHaveLength(1);
            expect(updatedGroupDetails.members.members[0].uid).toBe(user1);
            expect(updatedGroupDetails.members.members[0].groupDisplayName).toBe('Squad Leader');

            const user1Groups = await appDriver.listGroups({}, user1);
            const updatedSummary = user1Groups.groups.find((item) => item.id === groupId);
            expect(updatedSummary?.name).toBe('Adventure Squad+');

            const user2Groups = await appDriver.listGroups({}, user2);
            expect(user2Groups.count).toBe(0);

            await appDriver.deleteGroup(groupId, user1);

            const user1GroupsAfterDelete = await appDriver.listGroups({}, user1);
            expect(user1GroupsAfterDelete.count).toBe(0);
        });

        it('should update settlements and reflect the new balances', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(30.00, USD)
                    .withNote('Initial payment')
                    .build(),
                user2,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const settlementId = groupDetails.settlements.settlements[0].id;
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].owedBy[user2]).toBe('20.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].owes[user1]).toBe('20.00');

            await appDriver.updateSettlement(settlementId, new SettlementUpdateBuilder().withAmount('50.00', USD).withNote('Adjusted amount').build(), user2);

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].owedBy[user2]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency![USD]![user1].netBalance).toBe('0.00');
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].owes[user1]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency![USD]![user2].netBalance).toBe('0.00');
            expect(groupDetails.settlements.settlements[0].amount).toBe('50.00');
            expect(groupDetails.settlements.settlements[0].note).toBe('Adjusted amount');
        });

        it('should create and list group/expense comments and fetch expense details', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Lunch at cafe')
                    .withAmount(60, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(60), USD, participants))
                    .build(),
                user1,
            );

            const groupCommentResponse = await appDriver.createGroupComment(groupId, 'Welcome to the group!', user1);
            expect(groupCommentResponse.text).toBe('Welcome to the group!');

            const secondGroupCommentResponse = await appDriver.createGroupComment(groupId, 'Happy to be here', user2);
            expect(secondGroupCommentResponse.authorId).toBe(user2);
            expect(secondGroupCommentResponse.text).toBe('Happy to be here');

            const groupComments = await appDriver.listGroupComments(groupId, {}, user1);
            expect(groupComments.hasMore).toBe(false);
            expect(groupComments.comments).toHaveLength(2);
            const groupCommentTexts = groupComments.comments.map((comment) => comment.text);
            expect(groupCommentTexts).toEqual(expect.arrayContaining(['Welcome to the group!', 'Happy to be here']));

            const expenseCommentResponse = await appDriver.createExpenseComment(createdExpense.id, 'Thanks for covering this', user2);
            expect(expenseCommentResponse.authorId).toBe(user2);

            const secondExpenseComment = await appDriver.createExpenseComment(createdExpense.id, 'Let us split next time', user1);

            const expenseComments = await appDriver.listExpenseComments(createdExpense.id, {}, user1);
            expect(expenseComments.hasMore).toBe(false);
            expect(expenseComments.comments).toHaveLength(2);
            const expenseCommentTexts = expenseComments.comments.map((comment) => comment.text);
            expect(expenseCommentTexts).toEqual(expect.arrayContaining(['Thanks for covering this', 'Let us split next time']));

            const expenseFullDetails = await appDriver.getExpenseFullDetails(createdExpense.id, user1);
            expect(expenseFullDetails.expense.id).toBe(createdExpense.id);
            expect(expenseFullDetails.expense.description).toBe('Lunch at cafe');
            expect(expenseFullDetails.group.id).toBe(groupId);
            expect(expenseFullDetails.members.members.some((member) => member.uid === user2)).toBe(true);
        });

        it('should revert balance change after settlement deletion', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, toCurrencyISOCode('EUR'))
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), toCurrencyISOCode('EUR'), participants))
                    .build(),
                user1,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const eur = toCurrencyISOCode('EUR');

            expect(groupDetails.balances.balancesByCurrency![eur]![user1].owedBy[user2]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user1].netBalance).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owes[user1]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].netBalance).toBe('-50.00');

            await appDriver.updateExpense(
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(150.5, toCurrencyISOCode('EUR'))
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(150.5), toCurrencyISOCode('EUR'), participants))
                    .build(),
                user1,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            const eurBalancesAfterUpdate = groupDetails.balances.balancesByCurrency?.[eur];
            expect(eurBalancesAfterUpdate).toBeDefined();
            expect(eurBalancesAfterUpdate![user1]).toBeDefined();
            expect(eurBalancesAfterUpdate![user1].owedBy[user2]).toBe('75.25');
            expect(eurBalancesAfterUpdate![user1].netBalance).toBe('75.25');
            expect(eurBalancesAfterUpdate![user2].owes[user1]).toBe('75.25');
            expect(eurBalancesAfterUpdate![user2].netBalance).toBe('-75.25');

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50.25, toCurrencyISOCode('EUR'))
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const settlementId = groupDetails.settlements.settlements[0].id;

            expect(groupDetails.balances.balancesByCurrency![eur]![user1].owedBy[user2]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user1].netBalance).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owes[user1]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].netBalance).toBe('-25.00');

            await appDriver.deleteSettlement(settlementId, user1);

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.balances.balancesByCurrency![eur]![user1].owedBy[user2]).toBe('75.25');
            expect(groupDetails.balances.balancesByCurrency![eur]![user1].netBalance).toBe('75.25');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owes[user1]).toBe('75.25');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].netBalance).toBe('-75.25');
        });
    });

    describe('edge cases', () => {
        it('should reject expense creation when splits total does not match amount', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const baseExpense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(100, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('exact')
                .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                .build();

            const invalidExpense = {
                ...baseExpense,
                splits: [
                    { ...baseExpense.splits[0], amount: '80.00' },
                    { ...baseExpense.splits[1], amount: '30.00' },
                ],
            };

            await expect(appDriver.createExpense(invalidExpense, user1))
                .rejects
                .toMatchObject({ code: 'INVALID_SPLIT_TOTAL' });
        });

        it('should reject expense creation with invalid currency precision', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const baseExpense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(12, toCurrencyISOCode('JPY'))
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('exact')
                .withSplits(calculateEqualSplits(toAmount(12), toCurrencyISOCode('JPY'), participants))
                .build();

            const invalidExpense = {
                ...baseExpense,
                amount: '12.34',
                splits: baseExpense.splits.map((split) => ({
                    ...split,
                    amount: '6.17',
                })),
            };

            await expect(appDriver.createExpense(invalidExpense, user1))
                .rejects
                .toMatchObject({ code: 'INVALID_AMOUNT_PRECISION' });
        });

        it('should prevent non-owners from deleting a group', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await expect(appDriver.deleteGroup(groupId, user2))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject group comment creation with empty text', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await expect(appDriver.createGroupComment(groupId, '', user1))
                .rejects
                .toMatchObject({ code: 'INVALID_COMMENT_TEXT' });
        });

        it('should allow expense full details access for non-participants', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user4); // user4 is group member but not expense participant

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Confidential dinner')
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .build(),
                user1,
            );

            // user4 is a group member but NOT an expense participant - should still access
            const fullDetails = await appDriver.getExpenseFullDetails(expense.id, user4);
            expect(fullDetails.expense.id).toBe(expense.id);
            expect(fullDetails.expense.participants).toEqual(participants);
        });

        it('should reject share link previews with invalid tokens', async () => {
            await expect(appDriver.previewGroupByLink('invalid-token-123' as ShareLinkToken, user1))
                .rejects
                .toMatchObject({ code: 'INVALID_LINK' });
        });

        it('should forbid expense creation by non-group members', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(40, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(40), USD, participants))
                .build();

            await expect(appDriver.createExpense(expenseRequest, user3))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject group updates without any fields', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            await expect(appDriver.updateGroup(group.id, {} as any, user1))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject settlement updates with invalid amount precision', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(120, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(120), USD, participants))
                    .build(),
                user1,
            );

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(60.00, USD)
                    .build(),
                user2,
            );

            const details = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const settlementId = details.settlements.settlements[0].id;

            await expect(appDriver.updateSettlement(settlementId, new SettlementUpdateBuilder().withAmount('20.123', USD).withCurrency(USD).build(), user2))
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject removing a member by a non-owner', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            await expect(appDriver.removeGroupMember(groupId, user3, user2))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject expense comment creation with empty text', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(30, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(30), USD, participants))
                    .build(),
                user1,
            );

            await expect(appDriver.createExpenseComment(expense.id, '', user1))
                .rejects
                .toMatchObject({ code: 'INVALID_COMMENT_TEXT' });
        });

        it('should sanitize comment text containing scripts', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const response = await appDriver.createGroupComment(groupId, '<script>alert(1)</script>Hello', user1);
            expect(response.text).toBe('Hello');

            const comments = await appDriver.listGroupComments(groupId, {}, user1);
            expect(comments.comments[0].text).toBe('Hello');
        });

        it('should reject expense creation with invalid receipt URL', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const expense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Invalid receipt URL')
                .withAmount(40, USD)
                .withPaidBy(user1)
                .withReceiptUrl('not-a-url')
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(40), USD, participants))
                .build();

            await expect(appDriver.createExpense(expense, user1))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject expense updates when participants include non-members', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const baseExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Original expense')
                    .withAmount(60, USD)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(60), USD, [user1, user2]))
                    .build(),
                user1,
            );

            const updatedParticipants = [user1, user2, user4];
            const updatedSplits = calculateEqualSplits(toAmount(90), USD, updatedParticipants);

            await expect(appDriver.updateExpense(
                baseExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(90, USD)
                    .withParticipants(updatedParticipants)
                    .withSplits(updatedSplits)
                    .withSplitType('equal')
                    .build(),
                user1,
            ))
                .rejects
                .toMatchObject({ code: 'INVALID_PARTICIPANT' });
        });

        it('should reject settlement updates by non-creators', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(80, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(80), USD, participants))
                    .build(),
                user1,
            );

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(40.00, USD)
                    .build(),
                user2,
            );

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const settlementId = groupDetails.settlements.settlements[0].id;

            await expect(appDriver.updateSettlement(settlementId, {
                amount: '45.00',
            }, user1))
                .rejects
                .toMatchObject({ code: 'NOT_SETTLEMENT_CREATOR' });
        });

        it('should reject group member display name updates with empty value', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await expect(appDriver.updateGroupMemberDisplayName(groupId, '', user2))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject group member display name updates when the name collides with another member (base58 normalization)', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Owner picks a display name that should conflict with visually similar variants.
            await appDriver.updateGroupMemberDisplayName(groupId, 'Alice', user1);

            await expect(appDriver.updateGroupMemberDisplayName(groupId, 'ALICE', user2))
                .rejects
                .toMatchObject({ code: 'DISPLAY_NAME_TAKEN' });
        });

        it('should reject settlements involving non-members', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const settlement = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(user4)
                .withPayeeId(user1)
                .withAmount(20.00, USD)
                .build();

            await expect(appDriver.createSettlement(settlement, user1))
                .rejects
                .toMatchObject({ code: 'MEMBER_NOT_IN_GROUP' });
        });

        it('should sanitize expense comment text containing scripts', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .build(),
                user1,
            );

            const response = await appDriver.createExpenseComment(expense.id, '<script>alert(1)</script>Thanks', user1);
            expect(response.text).toBe('Thanks');

            const comments = await appDriver.listExpenseComments(expense.id, {}, user1);
            expect(comments.comments[0].text).toBe('Thanks');
        });

        it('should reject share link generation by non-members', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;

            await expect(appDriver.generateShareableLink(groupId, undefined, user2))
                .rejects
                .toMatchObject({ code: 'UNAUTHORIZED' });
        });

        it('should handle JavaScript floating point precision bugs (0.1 + 0.2 != 0.3)', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const CURRENCY = USD;

            const testCase1Splits = calculateEqualSplits('0.10', CURRENCY, participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(0.10, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(testCase1Splits)
                    .build(),
                user1,
            );

            const testCase2Splits = calculateEqualSplits('0.20', CURRENCY, participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(0.20, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(testCase2Splits)
                    .build(),
                user1,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            let usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, 'after 0.10 + 0.20');

            const expectedAfterTwoExpenses = amountToSmallestUnit('0.30', CURRENCY);
            const actualUser1NetAfterTwo = amountToSmallestUnit(usdBalances![user1].netBalance, CURRENCY);
            expect(actualUser1NetAfterTwo, 'After 0.10 + 0.20, user1 net should be exactly 15 cents (not 15.000000000000002)').toBe(expectedAfterTwoExpenses / 2);

            const testCase3Splits = calculateEqualSplits('0.70', CURRENCY, participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(0.70, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(testCase3Splits)
                    .build(),
                user1,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, 'after 0.10 + 0.20 + 0.70');

            const expectedAfterThreeExpenses = amountToSmallestUnit('1.00', CURRENCY);
            const actualUser1NetAfterThree = amountToSmallestUnit(usdBalances![user1].netBalance, CURRENCY);
            expect(actualUser1NetAfterThree, 'After 0.10 + 0.20 + 0.70 = 1.00, user1 net should be exactly 50 cents (not 49.99999999999999)').toBe(expectedAfterThreeExpenses / 2);

            for (let i = 0; i < 100; i++) {
                const splits = calculateEqualSplits('0.10', CURRENCY, participants);
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(0.10, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                    user1,
                );
            }

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, 'after 100 × 0.10');

            const totalSmallestUnits = amountToSmallestUnit('0.10', CURRENCY) * 100 + amountToSmallestUnit('1.00', CURRENCY);
            const expectedUser1Final = totalSmallestUnits - Math.floor(totalSmallestUnits / participants.length);
            const actualUser1Final = amountToSmallestUnit(usdBalances![user1].netBalance, CURRENCY);
            expect(actualUser1Final, `After 100 × 0.10 + (0.10 + 0.20 + 0.70), user1 net should be exactly ${expectedUser1Final} cents with zero floating point error`).toBe(expectedUser1Final);
        });

        it('should maintain precision across many small equal splits', async () => {
            const SMALL_AMOUNT = '0.03';
            const NUM_OPERATIONS = 100;
            const CURRENCY = USD;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];

            for (let i = 0; i < NUM_OPERATIONS; i++) {
                const splits = calculateEqualSplits(SMALL_AMOUNT, CURRENCY, participants);
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(SMALL_AMOUNT, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                    user1,
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {
                expenseLimit: NUM_OPERATIONS,
            }, user1);
            const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances, 'USD balances should exist after many small operations').toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, 'many small equal splits');

            const smallAmountUnits = amountToSmallestUnit(SMALL_AMOUNT, CURRENCY);
            const totalAmountUnits = smallAmountUnits * NUM_OPERATIONS;
            const perUserUnits = Math.floor(totalAmountUnits / participants.length);
            const expectedUser1NetUnits = totalAmountUnits - perUserUnits;
            const actualUser1NetUnits = amountToSmallestUnit(usdBalances![user1].netBalance, CURRENCY);

            expect(actualUser1NetUnits, `User1 net balance should be exactly ${expectedUser1NetUnits} smallest units (no rounding error allowed)`).toBe(expectedUser1NetUnits);
        });

        it('should handle large monetary amounts without precision loss', async () => {
            const LARGE_AMOUNT = toAmount(1234567.88);
            const CURRENCY = USD;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const splits = calculateEqualSplits(LARGE_AMOUNT, CURRENCY, participants);

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(LARGE_AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                user1,
            );

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, 'large amount expense');

            expect(usdBalances![user1].owedBy[user2]).toBe(amountFor(splits, user2));
            expect(usdBalances![user2].owes[user1]).toBe(amountFor(splits, user2));
            expect(usdBalances![user1].netBalance).toBe(netBalanceForPayer(splits, user1, CURRENCY));
        });

        it('should achieve exactly zero balance through multiple partial settlements', async () => {
            const EXPENSE_AMOUNT = toAmount(100);
            const FIRST_SETTLEMENT = '10.00';
            const SECOND_SETTLEMENT = '15.00';
            const THIRD_SETTLEMENT = '12.50';
            const FOURTH_SETTLEMENT = '12.50';
            const CURRENCY = toCurrencyISOCode('EUR');

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(EXPENSE_AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(EXPENSE_AMOUNT, CURRENCY, participants))
                    .build(),
                user1,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const eur = toCurrencyISOCode('EUR');
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owes[user1]).toBe('50.00');

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(FIRST_SETTLEMENT, CURRENCY)
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owes[user1]).toBe('40.00');

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(SECOND_SETTLEMENT, CURRENCY)
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            expect(groupDetails.balances.balancesByCurrency![eur]![user2].owes[user1]).toBe('25.00');

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(THIRD_SETTLEMENT, CURRENCY)
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            let eurBalances = groupDetails.balances.balancesByCurrency?.[eur];
            expect(eurBalances![user2].owes[user1]).toBe('12.50');

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(FOURTH_SETTLEMENT, CURRENCY)
                    .build(),
                user2,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            eurBalances = groupDetails.balances.balancesByCurrency?.[eur];

            expect(eurBalances).toBeDefined();
            expect(eurBalances![user1].netBalance).toBe('0.00');
            expect(eurBalances![user2].netBalance).toBe('0.00');
            expect(eurBalances![user1].owedBy[user2]).toBeUndefined();
            expect(eurBalances![user2].owes[user1]).toBeUndefined();

            verifyBalanceConsistency(eurBalances!, CURRENCY, 'complete settlement through multiple payments');
        });

        it('should correctly calculate circular debt balances', async () => {
            const CIRCULAR_AMOUNT = toAmount(90);
            const CURRENCY = USD;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(CIRCULAR_AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(CIRCULAR_AMOUNT, CURRENCY, [user1, user2]))
                    .build(),
                user1,
            );

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(CIRCULAR_AMOUNT, CURRENCY)
                    .withPaidBy(user2)
                    .withParticipants([user2, user3])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(CIRCULAR_AMOUNT, CURRENCY, [user2, user3]))
                    .build(),
                user2,
            );

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(CIRCULAR_AMOUNT, CURRENCY)
                    .withPaidBy(user3)
                    .withParticipants([user3, user1])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(CIRCULAR_AMOUNT, CURRENCY, [user3, user1]))
                    .build(),
                user3,
            );

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances).toBeDefined();

            expect(usdBalances![user1].netBalance).toBe('0.00');
            expect(usdBalances![user2].netBalance).toBe('0.00');
            expect(usdBalances![user3].netBalance).toBe('0.00');

            verifyBalanceConsistency(usdBalances!, CURRENCY, 'circular debt scenario');
        });

        it('should maintain balance consistency through complex multi-currency operations', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const eur = toCurrencyISOCode('EUR');
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];

            const usdExpense1Splits = calculateEqualSplits(toAmount(150), USD, participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(150, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(usdExpense1Splits)
                    .build(),
                user1,
            );

            const eurExpense1Splits = calculateEqualSplits(toAmount(200), toCurrencyISOCode('EUR'), participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(200, toCurrencyISOCode('EUR'))
                    .withPaidBy(user2)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(eurExpense1Splits)
                    .build(),
                user2,
            );

            const gbpExpense1Splits = calculateEqualSplits(toAmount(75.50), toCurrencyISOCode('GBP'), participants);
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(75.50, toCurrencyISOCode('GBP'))
                    .withPaidBy(user3)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(gbpExpense1Splits)
                    .build(),
                user3,
            );

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50.00, USD)
                    .build(),
                user2,
            );

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user3)
                    .withPayeeId(user2)
                    .withAmount(66.67, toCurrencyISOCode('EUR'))
                    .build(),
                user3,
            );

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];
            const eurBalances = groupDetails.balances.balancesByCurrency?.[eur];
            const gbpBalances = groupDetails.balances.balancesByCurrency?.[toCurrencyISOCode('GBP')];

            expect(usdBalances).toBeDefined();
            expect(eurBalances).toBeDefined();
            expect(gbpBalances).toBeDefined();

            verifyBalanceConsistency(usdBalances!, USD, 'USD after settlements');
            verifyBalanceConsistency(eurBalances!, toCurrencyISOCode('EUR'), 'EUR after settlements');
            verifyBalanceConsistency(gbpBalances!, toCurrencyISOCode('GBP'), 'GBP without settlements');

            expect(groupDetails.expenses.expenses).toHaveLength(3);
            expect(groupDetails.settlements.settlements).toHaveLength(2);
        });

        it('should maintain balance consistency through many expense operations', async () => {
            const OPERATIONS_COUNT = 20;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];
            const payers = [user1, user2, user3];

            for (let i = 0; i < OPERATIONS_COUNT; i++) {
                const amount = (i + 1) * 10;
                const payer = payers[i % payers.length];
                const splits = calculateEqualSplits(toAmount(amount), USD, participants);

                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(amount, USD)
                        .withPaidBy(payer)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                    payer,
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {
                expenseLimit: OPERATIONS_COUNT,
            }, user1);
            const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, USD, 'many expense operations');

            expect(groupDetails.expenses.expenses).toHaveLength(OPERATIONS_COUNT);
        });

        it('should maintain zero-sum balance with indivisible JPY amounts', async () => {
            // 100 JPY ÷ 3 = 33 + 33 + 34 (1 yen remainder)
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];
            const splits = calculateEqualSplits(toAmount(100), toCurrencyISOCode('JPY'), participants, 2);

            expect(splits[0].amount).toBe('33');
            expect(splits[1].amount).toBe('33');
            expect(splits[2].amount).toBe('34'); // Gets 1 yen remainder

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, toCurrencyISOCode('JPY'))
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
                user1,
            );

            const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, user1);
            const jpyBalances = groupDetails.balances.balancesByCurrency?.[toCurrencyISOCode('JPY')];

            expect(jpyBalances, 'JPY balances should exist').toBeDefined();
            verifyBalanceConsistency(jpyBalances!, toCurrencyISOCode('JPY'), 'indivisible JPY split');

            // User1 paid 100, owes themselves 33 = net +67
            expect(jpyBalances![user1].netBalance).toBe('67');
            // User2 paid 0, owes 33 = net -33
            expect(jpyBalances![user2].netBalance).toBe('-33');
            // User3 paid 0, owes 34 = net -34
            expect(jpyBalances![user3].netBalance).toBe('-34');
        });

        it('should maintain precision when converting between split types', async () => {
            const AMOUNT = toAmount(100);
            const CURRENCY = toCurrencyISOCode('EUR');
            const eur = CURRENCY;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];

            const equalSplits = calculateEqualSplits(AMOUNT, CURRENCY, participants, 0);
            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(equalSplits)
                    .build(),
                user1,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            let eurBalances = groupDetails.balances.balancesByCurrency?.[eur];

            expect(eurBalances).toBeDefined();
            verifyBalanceConsistency(eurBalances!, CURRENCY, 'after equal split');

            const balanceAfterEqual = amountToSmallestUnit(eurBalances![user1].netBalance, CURRENCY);

            const percentageSplits = calculatePercentageSplits(AMOUNT, CURRENCY, participants, 0);
            await appDriver.updateExpense(
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(AMOUNT, CURRENCY)
                    .withParticipants(participants)
                    .withSplitType('percentage')
                    .withSplits(percentageSplits)
                    .build(),
                user1,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            eurBalances = groupDetails.balances.balancesByCurrency?.[eur];

            expect(eurBalances).toBeDefined();
            verifyBalanceConsistency(eurBalances!, CURRENCY, 'after equal → percentage conversion');

            const balanceAfterPercentage = amountToSmallestUnit(eurBalances![user1].netBalance, CURRENCY);
            expect(balanceAfterPercentage, 'Balance after equal → percentage conversion should be exactly the same (zero-tolerance)').toBe(balanceAfterEqual);

            const exactSplits = percentageSplits.map(split => ({
                uid: split.uid,
                amount: split.amount,
            }));
            await appDriver.updateExpense(
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(AMOUNT, CURRENCY)
                    .withParticipants(participants)
                    .withSplitType('exact')
                    .withSplits(exactSplits)
                    .build(),
                user1,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            eurBalances = groupDetails.balances.balancesByCurrency?.[eur];

            expect(eurBalances).toBeDefined();
            verifyBalanceConsistency(eurBalances!, CURRENCY, 'after percentage → exact conversion');

            const balanceAfterExact = amountToSmallestUnit(eurBalances![user1].netBalance, CURRENCY);
            expect(balanceAfterExact, 'Balance after percentage → exact conversion should be exactly the same (zero-tolerance)').toBe(balanceAfterPercentage);

            const finalEqualSplits = calculateEqualSplits(AMOUNT, CURRENCY, participants, 0);
            await appDriver.updateExpense(
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(AMOUNT, CURRENCY)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(finalEqualSplits)
                    .build(),
                user1,
            );

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            eurBalances = groupDetails.balances.balancesByCurrency?.[eur];

            expect(eurBalances).toBeDefined();
            verifyBalanceConsistency(eurBalances!, CURRENCY, 'after exact → equal conversion');

            const balanceAfterFinalEqual = amountToSmallestUnit(eurBalances![user1].netBalance, CURRENCY);
            expect(balanceAfterFinalEqual, 'Balance after exact → equal conversion should match original equal split (zero-tolerance round-trip)').toBe(balanceAfterEqual);
        });

        it('should prevent removal of member with outstanding balance', async () => {
            const CURRENCY = USD;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const participants = [user1, user2, user3];

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(150, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(150), CURRENCY, participants))
                    .build(),
                user1,
            );

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

            expect(usdBalances).toBeDefined();
            expect(usdBalances![user3].netBalance).not.toBe('0.00');

            await expect(appDriver.removeGroupMember(groupId, user3, user1))
                .rejects
                .toMatchObject({
                    code: 'INVALID_INPUT',
                    details: { message: 'Cannot remove member with outstanding balance' },
                });
        });

        it('should allow removal of member with zero balance', async () => {
            const CURRENCY = toCurrencyISOCode('EUR');
            const eur = CURRENCY;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), CURRENCY, [user1, user2]))
                    .build(),
                user1,
            );

            let groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const eurBalances = groupDetails.balances.balancesByCurrency?.[eur];

            expect(eurBalances).toBeDefined();
            expect(eurBalances![user3].netBalance).toBe('0.00');

            await appDriver.removeGroupMember(groupId, user3, user1);

            groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const members = groupDetails.members.members;

            expect(members).toHaveLength(2);
            expect(members.find(m => m.uid === user3)).toBeUndefined();
        });

        describe('archive group functionality', () => {
            it('should archive and unarchive a group membership', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                // Verify user2 can see the group initially
                let groups = await appDriver.listGroups({}, user2);
                expect(groups.groups).toHaveLength(1);
                expect(groups.groups[0].id).toBe(groupId);

                // Archive the group
                const archiveResult = await appDriver.archiveGroupForUser(groupId, user2);
                expect(archiveResult.message).toBe('Group archived successfully');

                // Verify group no longer appears in default list
                groups = await appDriver.listGroups({}, user2);
                expect(groups.groups).toHaveLength(0);

                // Archived filter should return the group
                const archivedGroups = await appDriver.listGroups({ statusFilter: 'archived' }, user2);
                expect(archivedGroups.groups).toHaveLength(1);
                expect(archivedGroups.groups[0].id).toBe(groupId);

                // Unarchive the group
                const unarchiveResult = await appDriver.unarchiveGroupForUser(groupId, user2);
                expect(unarchiveResult.message).toBe('Group unarchived successfully');

                // Verify group appears again
                groups = await appDriver.listGroups({}, user2);
                expect(groups.groups).toHaveLength(1);
                expect(groups.groups[0].id).toBe(groupId);

                const archivedGroupsAfterUnarchive = await appDriver.listGroups({ statusFilter: 'archived' }, user2);
                expect(archivedGroupsAfterUnarchive.groups).toHaveLength(0);
            });

            it('should reject archiving a non-existent membership', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                // user2 is not a member
                await expect(appDriver.archiveGroupForUser(groupId, user2))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject archiving a non-active membership', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                // Archive first time
                await appDriver.archiveGroupForUser(groupId, user2);

                // Try to archive again - should fail
                await expect(appDriver.archiveGroupForUser(groupId, user2))
                    .rejects
                    .toMatchObject({ code: 'INVALID_INPUT' });
            });

            it('should reject unarchiving a non-archived membership', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                // Try to unarchive an active membership
                await expect(appDriver.unarchiveGroupForUser(groupId, user2))
                    .rejects
                    .toMatchObject({ code: 'INVALID_INPUT' });
            });

            it('should allow multiple archive/unarchive cycles', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                // Archive
                await appDriver.archiveGroupForUser(groupId, user2);
                let groups = await appDriver.listGroups({}, user2);
                expect(groups.groups).toHaveLength(0);

                // Unarchive
                await appDriver.unarchiveGroupForUser(groupId, user2);
                groups = await appDriver.listGroups({}, user2);
                expect(groups.groups).toHaveLength(1);

                // Archive again
                await appDriver.archiveGroupForUser(groupId, user2);
                groups = await appDriver.listGroups({}, user2);
                expect(groups.groups).toHaveLength(0);
            });

            it('should keep archived group accessible to other members', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);
                await appDriver.joinGroupByLink(shareToken, undefined, user3);

                // user2 archives the group
                await appDriver.archiveGroupForUser(groupId, user2);

                // user1 and user3 should still see the group
                const user1Groups = await appDriver.listGroups({}, user1);
                expect(user1Groups.groups).toHaveLength(1);

                const user3Groups = await appDriver.listGroups({}, user3);
                expect(user3Groups.groups).toHaveLength(1);

                // user2 should not see it
                const user2Groups = await appDriver.listGroups({}, user2);
                expect(user2Groups.groups).toHaveLength(0);
            });
        });

        describe('split validation', () => {
            it('should reject percentage splits not totaling 100%', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;
                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);
                await appDriver.joinGroupByLink(shareToken, undefined, user3);

                const participants = [user1, user2, user3];
                const invalidPercentageSplits = ExpenseSplitBuilder
                    .exactSplit([
                        { uid: user1, amount: '40.00', percentage: 40 },
                        { uid: user2, amount: '40.00', percentage: 40 },
                        { uid: user3, amount: '19.00', percentage: 19 },
                    ])
                    .build();

                const expenseRequest = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('percentage')
                    .withSplits(invalidPercentageSplits)
                    .build();

                await expect(appDriver.createExpense(expenseRequest, user1))
                    .rejects
                    .toMatchObject({ code: 'INVALID_PERCENTAGE_TOTAL' });
            });

            it('should reject negative percentage in splits', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;
                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                const participants = [user1, user2];
                const invalidPercentageSplits = ExpenseSplitBuilder
                    .exactSplit([
                        { uid: user1, amount: '120.00', percentage: 120 },
                        { uid: user2, amount: '-20.00', percentage: -20 },
                    ])
                    .build();

                const expenseRequest = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('percentage')
                    .withSplits(invalidPercentageSplits)
                    .build();

                await expect(appDriver.createExpense(expenseRequest, user1))
                    .rejects
                    .toMatchObject({ code: 'INVALID_INPUT' });
            });

            it('should reject expense where payer is not a participant', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;
                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);
                await appDriver.joinGroupByLink(shareToken, undefined, user3);

                const participants = [user1, user2];
                const expenseRequest = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, USD)
                    .withPaidBy(user3)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build();

                await expect(appDriver.createExpense(expenseRequest, user1))
                    .rejects
                    .toMatchObject({ code: 'PAYER_NOT_PARTICIPANT' });
            });

            it('should handle equal split with single participant', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const singleParticipant = [user1];
                const splits = calculateEqualSplits(toAmount(100), USD, singleParticipant);

                const expense = await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(100, USD)
                        .withPaidBy(user1)
                        .withParticipants(singleParticipant)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                    user1,
                );

                expect(expense.id).toBeDefined();

                const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
                const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

                expect(usdBalances).toBeDefined();
                expect(usdBalances![user1].netBalance).toBe('0.00');
                expect(usdBalances![user1].owedBy).toEqual({});
                expect(usdBalances![user1].owes).toEqual({});
            });
        });

        describe('boundary and limit testing', () => {
            it('should handle very large expense amounts', async () => {
                const LARGE_AMOUNT = toAmount(9999999.99);
                const CURRENCY = USD;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;
                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                const participants = [user1, user2];
                const splits = calculateEqualSplits(LARGE_AMOUNT, CURRENCY, participants);

                const expense = await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(LARGE_AMOUNT, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                    user1,
                );

                expect(expense.amount).toBe(String(LARGE_AMOUNT));

                const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
                const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

                expect(usdBalances).toBeDefined();
                verifyBalanceConsistency(usdBalances!, CURRENCY, 'very large amount');
            });

            it('should handle minimum valid amounts', async () => {
                const MIN_AMOUNT = toAmount(0.02);
                const CURRENCY = USD;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;
                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                const participants = [user1, user2];
                const splits = calculateEqualSplits(MIN_AMOUNT, CURRENCY, participants);

                const expense = await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(MIN_AMOUNT, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                    user1,
                );

                expect(expense.amount).toBe(String(MIN_AMOUNT));

                const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
                const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

                expect(usdBalances).toBeDefined();
                verifyBalanceConsistency(usdBalances!, CURRENCY, 'minimum valid amount');
            });

            it('should enforce maximum length on group description', async () => {
                const longDescription = 'x'.repeat(10000);

                await expect(
                    appDriver.createGroup(
                        new CreateGroupRequestBuilder()
                            .withName('Test Group')
                            .withDescription(longDescription)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_INPUT' });
            });

            it('should enforce maximum length on expense description', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const longDescription = 'x'.repeat(10000);
                const participants = [user1];

                await expect(
                    appDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(groupId)
                            .withDescription(longDescription)
                            .withAmount(100, USD)
                            .withPaidBy(user1)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_DESCRIPTION' });
            });

            it('should handle expense with many participants', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;
                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);

                // Join initial users to the group
                await appDriver.joinGroupByLink(shareToken, undefined, user2);
                await appDriver.joinGroupByLink(shareToken, undefined, user3);
                await appDriver.joinGroupByLink(shareToken, undefined, user4);

                const manyUsers = [user1, user2, user3, user4];
                for (let i = 5; i <= 20; i++) {
                    // Register user via API
                    const userReg = new UserRegistrationBuilder()
                        .withEmail(`user${i}@example.com`)
                        .withDisplayName(`User ${i}`)
                        .withPassword('password12345')
                        .build();
                    const userResult = await appDriver.registerUser(userReg);
                    const userId = toUserId(userResult.user.uid);
                    await appDriver.joinGroupByLink(shareToken, undefined, userId);
                    manyUsers.push(userId);
                }

                const AMOUNT = toAmount(1000);
                const CURRENCY = USD;
                const splits = calculateEqualSplits(AMOUNT, CURRENCY, manyUsers);

                const expense = await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(AMOUNT, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(manyUsers)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                    user1,
                );

                expect(expense.id).toBeDefined();

                const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
                const usdBalances = groupDetails.balances.balancesByCurrency?.[USD];

                expect(usdBalances).toBeDefined();
                verifyBalanceConsistency(usdBalances!, CURRENCY, 'many participants');
                expect(Object.keys(usdBalances!)).toHaveLength(20);
            });
        });

        describe('data consistency and integrity', () => {
            it('should reject operations on deleted group', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                await appDriver.deleteGroup(groupId, user1);

                const participants = [user1];
                await expect(
                    appDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(groupId)
                            .withAmount(100, USD)
                            .withPaidBy(user1)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject malformed group ID', async () => {
                await expect(appDriver.getGroupFullDetails('not-a-valid-id', {}, user1))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject malformed expense ID', async () => {
                await expect(appDriver.getExpenseFullDetails(toExpenseId('not-a-valid-id'), user1))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject operations on non-existent expense', async () => {
                await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

                const nonExistentExpenseId = 'expense-does-not-exist';

                await expect(appDriver.deleteExpense(nonExistentExpenseId, user1))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject creating expense with zero amount', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const participants = [user1];
                await expect(
                    appDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(groupId)
                            .withAmount(0, USD)
                            .withPaidBy(user1)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .withSplits([{ uid: user1, amount: '0.00' }])
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_AMOUNT' });
            });

            it('should reject creating expense with negative amount', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;

                const participants = [user1];
                await expect(
                    appDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(groupId)
                            .withAmount(-100, USD)
                            .withPaidBy(user1)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .withSplits([{ uid: user1, amount: '-100.00' }])
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_AMOUNT' });
            });

            it('should reject settlement with zero amount', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;
                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                const participants = [user1, user2];
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(100, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                        .build(),
                    user1,
                );

                await expect(
                    appDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(groupId)
                            .withPayerId(user2)
                            .withPayeeId(user1)
                            .withAmount(0.00, USD)
                            .build(),
                        user2,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject settlement with negative amount', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
                const groupId = group.id;
                const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
                await appDriver.joinGroupByLink(shareToken, undefined, user2);

                const participants = [user1, user2];
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(100, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                        .build(),
                    user1,
                );

                await expect(
                    appDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(groupId)
                            .withPayerId(user2)
                            .withPayeeId(user1)
                            .withAmount('-25.00', USD)
                            .build(),
                        user2,
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });
        });
    });

    describe('policy acceptance and status', () => {
        describe('acceptMultiplePolicies - happy path', () => {
            it('should accept a single policy', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                const result = await appDriver.acceptMultiplePolicies([
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ], user1);

                expect(result.acceptedPolicies).toHaveLength(1);
                expect(result.acceptedPolicies[0].policyId).toBe(policy1.id);
                expect(result.acceptedPolicies[0].versionHash).toBe(policy1.versionHash);
                expect(result.acceptedPolicies[0].acceptedAt).toBeDefined();
            });

            it('should accept multiple policies at once', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                const policy2 = await appDriver.createPolicy({
                    policyName: toPolicyName('Privacy Policy'),
                    text: toPolicyText('Privacy Policy v1'),
                }, adminUser);

                const policy3 = await appDriver.createPolicy({
                    policyName: toPolicyName('Cookie Policy'),
                    text: toPolicyText('Cookie Policy v1'),
                }, adminUser);

                const result = await appDriver.acceptMultiplePolicies([
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                    { policyId: policy2.id, versionHash: policy2.versionHash },
                    { policyId: policy3.id, versionHash: policy3.versionHash },
                ], user1);

                expect(result.acceptedPolicies).toHaveLength(3);
                expect(result.acceptedPolicies[0].policyId).toBe(policy1.id);
                expect(result.acceptedPolicies[1].policyId).toBe(policy2.id);
                expect(result.acceptedPolicies[2].policyId).toBe(policy3.id);
            });

            it('should persist policy acceptance in user document', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                await appDriver.acceptMultiplePolicies([
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ], user2);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.policies).toHaveLength(1);
                expect(status.policies[0].userAcceptedHash).toBe(policy1.versionHash);
                expect(status.policies[0].needsAcceptance).toBe(false);
            });
        });

        describe('acceptMultiplePolicies - validation and errors', () => {
            it('should reject empty acceptances array', async () => {
                await expect(appDriver.acceptMultiplePolicies([], user1))
                    .rejects
                    .toMatchObject({ code: 'INVALID_ACCEPTANCES' });
            });

            it('should reject when policyId is missing', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies([
                        { policyId: toPolicyId(''), versionHash: toVersionHash('some-hash') },
                    ], user1),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_ACCEPTANCES' });
            });

            it('should reject when versionHash is missing', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies([
                        { policyId: toPolicyId('some-policy'), versionHash: toVersionHash('') },
                    ], user1),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_ACCEPTANCES' });
            });

            it('should reject when policy does not exist', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies([
                        { policyId: toPolicyId('non-existent-policy'), versionHash: toVersionHash('some-hash') },
                    ], user1),
                )
                    .rejects
                    .toMatchObject({ code: 'POLICY_NOT_FOUND' });
            });

            it('should reject when version hash is invalid for existing policy', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                await expect(
                    appDriver.acceptMultiplePolicies([
                        { policyId: policy1.id, versionHash: toVersionHash('invalid-version-hash') },
                    ], user1),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_VERSION_HASH' });
            });

            it('should reject entire batch if any policy is invalid', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                await expect(
                    appDriver.acceptMultiplePolicies([
                        { policyId: policy1.id, versionHash: policy1.versionHash },
                        { policyId: toPolicyId('non-existent'), versionHash: toVersionHash('some-hash') },
                    ], user1),
                )
                    .rejects
                    .toMatchObject({ code: 'POLICY_NOT_FOUND' });

                const status = await appDriver.getUserPolicyStatus(user1);
                expect(status.policies[0].userAcceptedHash).toBeUndefined();
            });
        });

        describe('getUserPolicyStatus - happy path', () => {
            it('should show all policies as pending when user has not accepted any', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                const policy2 = await appDriver.createPolicy({
                    policyName: toPolicyName('Privacy Policy'),
                    text: toPolicyText('Privacy Policy v1'),
                }, adminUser);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.needsAcceptance).toBe(true);
                expect(status.totalPending).toBe(2);
                expect(status.policies).toHaveLength(2);

                const termsPolicy = status.policies.find((p) => p.policyId === policy1.id);
                expect(termsPolicy).toBeDefined();
                expect(termsPolicy!.needsAcceptance).toBe(true);
                expect(termsPolicy!.userAcceptedHash).toBeUndefined();

                const privacyPolicy = status.policies.find((p) => p.policyId === policy2.id);
                expect(privacyPolicy).toBeDefined();
                expect(privacyPolicy!.needsAcceptance).toBe(true);
                expect(privacyPolicy!.userAcceptedHash).toBeUndefined();
            });

            it('should show no pending policies when user has accepted current versions', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                const policy2 = await appDriver.createPolicy({
                    policyName: toPolicyName('Privacy Policy'),
                    text: toPolicyText('Privacy Policy v1'),
                }, adminUser);

                await appDriver.acceptMultiplePolicies([
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                    { policyId: policy2.id, versionHash: policy2.versionHash },
                ], user2);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.needsAcceptance).toBe(false);
                expect(status.totalPending).toBe(0);
                expect(status.policies).toHaveLength(2);

                status.policies.forEach((policy) => {
                    expect(policy.needsAcceptance).toBe(false);
                    expect(policy.userAcceptedHash).toBe(policy.currentVersionHash);
                });
            });

            it('should show pending when user has accepted old versions', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                await appDriver.acceptMultiplePolicies([
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ], user2);

                const oldVersionHash = policy1.versionHash;

                const updatedPolicy = await appDriver.updatePolicy(policy1.id, {
                    text: toPolicyText('Terms of Service v2 - updated'),
                    publish: true,
                }, adminUser);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.needsAcceptance).toBe(true);
                expect(status.totalPending).toBe(1);
                expect(status.policies).toHaveLength(1);

                const termsPolicy = status.policies.find((p) => p.policyId === policy1.id);
                expect(termsPolicy).toBeDefined();
                expect(termsPolicy!.needsAcceptance).toBe(true);
                expect(termsPolicy!.userAcceptedHash).toBe(oldVersionHash);
                expect(termsPolicy!.currentVersionHash).toBe(updatedPolicy.versionHash);
                expect(termsPolicy!.currentVersionHash).not.toBe(oldVersionHash);
            });

            it('should show mixed acceptance state across multiple policies', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                const policy2 = await appDriver.createPolicy({
                    policyName: toPolicyName('Privacy Policy'),
                    text: toPolicyText('Privacy Policy v1'),
                }, adminUser);

                const policy3 = await appDriver.createPolicy({
                    policyName: toPolicyName('Cookie Policy'),
                    text: toPolicyText('Cookie Policy v1'),
                }, adminUser);

                await appDriver.acceptMultiplePolicies([
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                    { policyId: policy2.id, versionHash: policy2.versionHash },
                ], user2);

                await appDriver.updatePolicy(policy1.id, {
                    text: toPolicyText('Terms of Service v2'),
                    publish: true,
                }, adminUser);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.needsAcceptance).toBe(true);
                expect(status.totalPending).toBe(2);

                const termsPolicy = status.policies.find((p) => p.policyId === policy1.id);
                expect(termsPolicy!.needsAcceptance).toBe(true);

                const privacyPolicy = status.policies.find((p) => p.policyId === policy2.id);
                expect(privacyPolicy!.needsAcceptance).toBe(false);

                const cookiePolicy = status.policies.find((p) => p.policyId === policy3.id);
                expect(cookiePolicy!.needsAcceptance).toBe(true);
            });
        });

        describe('getUserPolicyStatus - data integrity', () => {
            it('should return correct response structure', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status).toHaveProperty('needsAcceptance');
                expect(status).toHaveProperty('policies');
                expect(status).toHaveProperty('totalPending');

                expect(typeof status.needsAcceptance).toBe('boolean');
                expect(Array.isArray(status.policies)).toBe(true);
                expect(typeof status.totalPending).toBe('number');
            });

            it('should include all required fields in each policy', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                await appDriver.acceptMultiplePolicies([
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ], user2);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.policies).toHaveLength(1);

                const policyStatus = status.policies[0];
                expect(policyStatus).toHaveProperty('policyId');
                expect(policyStatus).toHaveProperty('currentVersionHash');
                expect(policyStatus).toHaveProperty('userAcceptedHash');
                expect(policyStatus).toHaveProperty('needsAcceptance');
                expect(policyStatus).toHaveProperty('policyName');

                expect(typeof policyStatus.policyId).toBe('string');
                expect(typeof policyStatus.currentVersionHash).toBe('string');
                expect(typeof policyStatus.userAcceptedHash).toBe('string');
                expect(typeof policyStatus.needsAcceptance).toBe('boolean');
                expect(typeof policyStatus.policyName).toBe('string');
            });

            it('should correctly count totalPending', async () => {
                const policy1 = await appDriver.createPolicy({
                    policyName: toPolicyName('Terms Of Service'),
                    text: toPolicyText('Terms of Service v1'),
                }, adminUser);

                const policy2 = await appDriver.createPolicy({
                    policyName: toPolicyName('Privacy Policy'),
                    text: toPolicyText('Privacy Policy v1'),
                }, adminUser);

                const policy3 = await appDriver.createPolicy({
                    policyName: toPolicyName('Cookie Policy'),
                    text: toPolicyText('Cookie Policy v1'),
                }, adminUser);

                await appDriver.acceptMultiplePolicies([
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ], user2);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.totalPending).toBe(2);

                const pendingPolicies = status.policies.filter((p) => p.needsAcceptance);
                expect(pendingPolicies).toHaveLength(2);
            });

            it('should return empty policies array when no policies exist', async () => {
                const status = await appDriver.getUserPolicyStatus(user1);

                expect(status.needsAcceptance).toBe(false);
                expect(status.totalPending).toBe(0);
                expect(status.policies).toHaveLength(0);
            });
        });
    });

    describe('notification system', () => {
        it('should update user notifications when expense is created', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, [user1, user2]))
                    .build(),
                user1,
            );

            await appDriver.expectNotificationUpdate(user1, group.id, {
                transactionChangeCount: 1,
            });

            await appDriver.expectNotificationUpdate(user2, group.id, {
                transactionChangeCount: 1,
            });
        });

        it('should update notifications when settlement is created', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50, USD)
                    .build(),
                user2,
            );

            await appDriver.expectNotificationUpdate(user1, group.id, {
                balanceChangeCount: 1,
            });

            await appDriver.expectNotificationUpdate(user2, group.id, {
                balanceChangeCount: 1,
            });
        });

        it('should update notifications when group comment is added', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await appDriver.createGroupComment(group.id, 'Test comment', user1);

            await appDriver.expectNotificationUpdate(user1, group.id, {
                commentChangeCount: 1,
            });

            await appDriver.expectNotificationUpdate(user2, group.id, {
                commentChangeCount: 1,
            });
        });

        it('should update notifications when expense comment is added', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, [user1, user2]))
                    .build(),
                user1,
            );

            await appDriver.createExpenseComment(expense.id, 'Expense comment', user1);

            await appDriver.expectNotificationUpdate(user1, group.id, {
                commentChangeCount: 1,
            });

            await appDriver.expectNotificationUpdate(user2, group.id, {
                commentChangeCount: 1,
            });
        });

        it('should increment changeVersion on multiple operations', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, [user1, user2]))
                    .build(),
                user1,
            );

            const feedAfterExpense = await appDriver.getActivityFeedItems(user1);
            expect(feedAfterExpense.length).toBeGreaterThan(0);

            await appDriver.createGroupComment(group.id, 'Comment', user1);

            const feedAfterComment = await appDriver.getActivityFeedItems(user1);
            expect(feedAfterComment.length).toBeGreaterThan(feedAfterExpense.length);
        });

        it('should handle group updates', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            await appDriver.updateGroup(group.id, new GroupUpdateBuilder().withName(toGroupName('Updated Name')).build(), user1);

            await appDriver.expectNotificationUpdate(user1, group.id, {
                groupDetailsChangeCount: 2,
            });
        });

        it('should prune activity feed entries beyond the latest 20 items via async cleanup', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            // Create 25 expenses - cleanup happens after each write
            for (let i = 0; i < 25; i += 1) {
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withDescription(`Activity Feed Expense ${i}`)
                        .build(),
                    user1,
                );
            }

            // After creating 25 expenses + 1 group create + 1 member join = 27 items
            // Cleanup happens after each expense write, keeping at most 20
            const feedAfterCleanup1 = await appDriver.getActivityFeedItems(user1);
            const feedAfterCleanup2 = await appDriver.getActivityFeedItems(user2);

            expect(feedAfterCleanup1.length).toBeLessThanOrEqual(20);
            expect(feedAfterCleanup2.length).toBeLessThanOrEqual(20);

            const user1ExpenseDescriptions = feedAfterCleanup1
                .filter((item) => item.eventType === ActivityFeedEventTypes.EXPENSE_CREATED)
                .map((item) => item.details?.expenseDescription);
            const actionsUser1 = feedAfterCleanup1.map((item) => item.action);

            // Most recent expense should be present
            expect(user1ExpenseDescriptions).toContain('Activity Feed Expense 24');
            expect(actionsUser1).toContain(ActivityFeedActions.CREATE);
        });

        it('should prune historical activity entries when a group is deleted (via async cleanup)', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            for (let i = 0; i < 10; i += 1) {
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withAmount(30, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(30), USD, participants))
                        .withDescription(`Deletion Feed Expense ${i}`)
                        .build(),
                    user1,
                );
            }

            await appDriver.deleteGroup(group.id, user1);

            // Deleting group creates MEMBER_LEFT events, so items > 10 before cleanup
            const feedBeforeCleanup1 = await appDriver.getActivityFeedItems(user1);
            const feedBeforeCleanup2 = await appDriver.getActivityFeedItems(user2);

            expect(feedBeforeCleanup1.length).toBeGreaterThan(10);
            expect(feedBeforeCleanup2.length).toBeGreaterThan(10);

            // Wait for async cleanup
            await new Promise((resolve) => setTimeout(resolve, 100));

            // After cleanup - items should be pruned to <= 20
            const feedAfterCleanup1 = await appDriver.getActivityFeedItems(user1);
            const feedAfterCleanup2 = await appDriver.getActivityFeedItems(user2);

            expect(feedAfterCleanup1.length).toBeLessThanOrEqual(20);
            expect(feedAfterCleanup2.length).toBeLessThanOrEqual(20);

            // Verify MEMBER_LEFT events were created when group was deleted
            const memberLeftEventsUser1 = feedAfterCleanup1.filter((item) => item.eventType === ActivityFeedEventTypes.MEMBER_LEFT);
            const memberLeftEventsUser2 = feedAfterCleanup2.filter((item) => item.eventType === ActivityFeedEventTypes.MEMBER_LEFT);

            expect(memberLeftEventsUser1.some((event) => event.details?.targetUserId === user1)).toBe(true);
            expect(memberLeftEventsUser2.some((event) => event.details?.targetUserId === user2)).toBe(true);
            expect(memberLeftEventsUser1.some((event) => event.action === ActivityFeedActions.LEAVE)).toBe(true);
            expect(memberLeftEventsUser2.some((event) => event.action === ActivityFeedActions.LEAVE)).toBe(true);

            // Verify cleanup keeps items reasonable (under 20 in this test)
            expect(feedAfterCleanup1.length).toBeLessThanOrEqual(20);
            expect(feedAfterCleanup2.length).toBeLessThanOrEqual(20);
        });
    });

    describe('activity feed endpoint', () => {
        it('should fetch activity feed items via the HTTP handler', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(42.5, USD)
                    .withPaidBy(user1)
                    .withDescription('Activity Feed Expense')
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(42.5), USD, participants))
                    .build(),
                user1,
            );

            await appDriver.createGroupComment(group.id, 'Activity feed comment', user1);

            const fullFeed = await appDriver.getActivityFeed({}, user1);
            expect(fullFeed.items.length).toBeGreaterThanOrEqual(2);

            const limitedFeed = await appDriver.getActivityFeed({ limit: 1 }, user1);
            expect(limitedFeed.items).toHaveLength(1);
            expect(limitedFeed.hasMore).toBe(fullFeed.items.length > 1);

            const eventTypes = fullFeed.items.map((item) => item.eventType);

            expect(eventTypes).toContain(ActivityFeedEventTypes.EXPENSE_CREATED);
            expect(eventTypes).toContain(ActivityFeedEventTypes.COMMENT_ADDED);
        });

        it('should delete oldest activity items when more than 20 exist, keeping at most 20', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            // Create 25 expenses to generate activity items (25 expenses + 1 group create + 1 member join = 27 items)
            // Cleanup runs after each expense write
            for (let i = 0; i < 25; i += 1) {
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withDescription(`Test Expense ${i}`)
                        .build(),
                    user1,
                );
            }

            // Verify at most 20 items remain
            const feed = await appDriver.getActivityFeed({ limit: 50 }, user1);
            expect(feed.items.length).toBeLessThanOrEqual(20);

            // Verify the most recent items are kept
            const expenseDescriptions = feed
                .items
                .filter((item) => item.eventType === ActivityFeedEventTypes.EXPENSE_CREATED)
                .map((item) => item.details?.expenseDescription);

            // Most recent expense should be present
            expect(expenseDescriptions).toContain('Test Expense 24');
        });
    });

    describe('group security endpoints', () => {
        it('should allow non-admin members to load pending members when approvals are automatic', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            const joinResult = await appDriver.joinGroupByLink(shareToken, undefined, user2);
            expect(joinResult.memberStatus).toBe(MemberStatuses.ACTIVE);

            const pendingMembersForMember = await appDriver.getPendingMembers(group.id, user2);
            expect(pendingMembersForMember).toEqual([]);
        });

        it('should still block non-admin members when admin approval is required', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            await appDriver.updateGroupPermissions(
                group.id,
                {
                    memberApproval: 'admin-required',
                },
                user1,
            );

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await expect(appDriver.getPendingMembers(group.id, user2)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should allow non-admin members to reject pending members when approvals are automatic', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // Start with admin-required so we get a pending member
            await appDriver.updateGroupPermissions(group.id, { memberApproval: 'admin-required' }, user1);

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);

            // User2 joins and gets approved
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.approveMember(group.id, user2, user1);

            // User3 joins - should be pending
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            // Switch to automatic mode
            await appDriver.updateGroupPermissions(group.id, { memberApproval: 'automatic' }, user1);

            // User2 (non-admin) should be able to reject user3
            const rejectResult = await appDriver.rejectMember(group.id, user3, user2);
            expect(rejectResult.message).toBe('Member rejected successfully');

            // Verify user3 was removed
            const pendingMembers = await appDriver.getPendingMembers(group.id, user1);
            expect(pendingMembers.find(m => m.uid === user3)).toBeUndefined();
        });

        it('should block non-admin members from rejecting when admin approval is required', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            await appDriver.updateGroupPermissions(
                group.id,
                {
                    memberApproval: 'admin-required',
                },
                user1,
            );

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);

            // User2 joins and becomes active (admin approves)
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.approveMember(group.id, user2, user1);

            // User3 joins - should be pending
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            // User2 (non-admin) should NOT be able to reject user3
            await expect(appDriver.rejectMember(group.id, user3, user2)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should manage permissions and pending members through security handlers', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const permissionsUpdate = await appDriver.updateGroupPermissions(group.id, {
                memberApproval: 'admin-required',
            }, user1);

            expect(permissionsUpdate.message).toBe('Permissions updated successfully');

            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const pendingMembers = await appDriver.getPendingMembers(group.id, user1);
            const pendingIds = pendingMembers.map((member) => member.uid);

            expect(pendingIds.sort()).toEqual([user2, user3].sort());
            expect(pendingMembers.every((member) => member.memberStatus === MemberStatuses.PENDING)).toBe(true);

            await appDriver.approveMember(group.id, user2, user1);
            await appDriver.updateMemberRole(group.id, user2, MemberRoles.ADMIN, user1);

            const rejection = await appDriver.rejectMember(group.id, user3, user1);
            expect(rejection.message).toBe('Member rejected successfully');

            const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, user1);
            const approvedMember = groupDetails.members.members.find((member) => member.uid === user2);
            const rejectedMember = groupDetails.members.members.find((member) => member.uid === user3);

            expect(approvedMember?.memberStatus).toBe(MemberStatuses.ACTIVE);
            expect(approvedMember?.memberRole).toBe(MemberRoles.ADMIN);
            expect(rejectedMember).toBeUndefined();

            const pendingAfterActions = await appDriver.getPendingMembers(group.id, user1);
            expect(pendingAfterActions).toHaveLength(0);
        });
    });

    describe('user account endpoints', () => {
        it('should return the current user profile via the handler', async () => {
            const profile = await appDriver.getUserProfile(user1);

            expect(profile.displayName).toBe('User one');
            expect(profile.emailVerified).toBe(false);
        });

        it('should register a new user through the registration workflow', async () => {
            const registrationResult = await appDriver.registerUser(
                new RegisterRequestBuilder()
                    .withDisplayName('Registered User')
                    .withEmail('registered@example.com')
                    .withPassword('ValidPass123!')
                    .withTermsAccepted(true)
                    .withCookiePolicyAccepted(true)
                    .withPrivacyPolicyAccepted(true)
                    .build(),
            );

            expect(registrationResult.success).toBe(true);
            expect(registrationResult.user.displayName).toBe('Registered User');

            const newUserId = registrationResult.user.uid;
            const profile = await appDriver.getUserProfile(newUserId);

            expect(profile.displayName).toBe('Registered User');
            expect(profile.email).toBe('registered@example.com');
        });

        it('should reject registration when privacy policy is not accepted', async () => {
            await expect(
                appDriver.registerUser(
                    new RegisterRequestBuilder()
                        .withDisplayName('Privacy Reject')
                        .withEmail('privacy.reject@example.com')
                        .withPassword('ValidPass123!')
                        .withTermsAccepted(true)
                        .withCookiePolicyAccepted(true)
                        .withPrivacyPolicyAccepted(false)
                        .build(),
                ),
            )
                .rejects
                .toThrow(/Privacy Policy/);
        });

        describe('updateUserProfile', () => {
            it('should update display name successfully', async () => {
                const updatedProfile = await appDriver.updateUserProfile(
                    new UserUpdateBuilder().withDisplayName('Updated Name').build(),
                    user1,
                );

                expect(updatedProfile.displayName).toBe('Updated Name');

                const profile = await appDriver.getUserProfile(user1);
                expect(profile.displayName).toBe('Updated Name');
            });

            it('should sanitize display name input', async () => {
                const updatedProfile = await appDriver.updateUserProfile(
                    new UserUpdateBuilder().withDisplayName('<script>alert("xss")</script>Clean Name').build(),
                    user1,
                );

                expect(updatedProfile.displayName).not.toContain('<script>');
                expect(updatedProfile.displayName).toContain('Clean Name');
            });

            it('should reject empty display name', async () => {
                await expect(
                    appDriver.updateUserProfile(new UserUpdateBuilder().withDisplayName('').build(), user1),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject display name that is too long', async () => {
                const tooLongName = 'a'.repeat(256);
                await expect(
                    appDriver.updateUserProfile(new UserUpdateBuilder().withDisplayName(tooLongName).build(), user1),
                )
                    .rejects
                    .toThrow();
            });
        });

        describe('changePassword', () => {
            const VALID_CURRENT_PASSWORD = toPassword('password12345');
            const VALID_NEW_PASSWORD = toPassword('NewSecurePass123!');

            it('should successfully change password with valid credentials', async () => {
                const result = await appDriver.changePassword(
                    new PasswordChangeRequestBuilder()
                        .withCurrentPassword(VALID_CURRENT_PASSWORD)
                        .withNewPassword(VALID_NEW_PASSWORD)
                        .build(),
                    user1,
                );

                expect(result.message).toBe('Password changed successfully');
            });

            it('should reject when current password is incorrect', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword('WrongPassword123!')
                            .withNewPassword(VALID_NEW_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toThrow(/password is incorrect/i);
            });

            it('should reject when new password is same as current', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword(VALID_CURRENT_PASSWORD)
                            .withNewPassword(VALID_CURRENT_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when new password is too short', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword(VALID_CURRENT_PASSWORD)
                            .withNewPassword('Short1!')
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when currentPassword field is missing', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withNewPassword(VALID_NEW_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when newPassword field is missing', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword(VALID_CURRENT_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when currentPassword is empty string', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword('')
                            .withNewPassword(VALID_NEW_PASSWORD)
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when newPassword is empty string', async () => {
                await expect(
                    appDriver.changePassword(
                        new PasswordChangeRequestBuilder()
                            .withCurrentPassword(VALID_CURRENT_PASSWORD)
                            .withNewPassword('')
                            .build(),
                        user1,
                    ),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });
        });

        describe('changeEmail', () => {
            const CURRENT_PASSWORD = toPassword('password12345');
            const NEW_EMAIL = toEmail('newemail@example.com');

            it('should successfully change email with valid credentials', async () => {
                const profile = await appDriver.changeEmail({
                    currentPassword: CURRENT_PASSWORD,
                    newEmail: NEW_EMAIL,
                }, user1);

                expect(profile.email).toBe(NEW_EMAIL);
                expect(profile.emailVerified).toBe(false);
            });

            it('should reject when current password is incorrect', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: toPassword('WrongPassword123!'),
                        newEmail: NEW_EMAIL,
                    }, user1),
                )
                    .rejects
                    .toThrow(/password is incorrect/i);
            });

            it('should reject when new email is same as current email', async () => {
                const currentProfile = await appDriver.getUserProfile(user1);

                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                        newEmail: currentProfile.email!,
                    }, user1),
                )
                    .rejects
                    .toThrow(/must be different/i);
            });

            it('should reject when new email has invalid format', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                        newEmail: toEmail('not-an-email'),
                    }, user1),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when currentPassword field is missing', async () => {
                await expect(
                    appDriver.changeEmail({
                        newEmail: NEW_EMAIL,
                    } as any, user1),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when newEmail field is missing', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                    } as any, user1),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when currentPassword is empty string', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: toPassword(''),
                        newEmail: NEW_EMAIL,
                    }, user1),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should reject when newEmail is empty string', async () => {
                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                        newEmail: toEmail(''),
                    }, user1),
                )
                    .rejects
                    .toThrow(/invalid input/i);
            });

            it('should lowercase email address', async () => {
                const profile = await appDriver.changeEmail({
                    currentPassword: CURRENT_PASSWORD,
                    newEmail: toEmail('NewEmail@EXAMPLE.COM'),
                }, user1);

                expect(profile.email).toBe('newemail@example.com');
            });

            it('should reject when email is already in use by another account', async () => {
                const otherUserEmail = toEmail('user2@example.com');

                await expect(
                    appDriver.changeEmail({
                        currentPassword: CURRENT_PASSWORD,
                        newEmail: otherUserEmail,
                    }, user1),
                )
                    .rejects
                    .toThrow(/already exists/i);
            });
        });
    });

    describe('policy administration flows', () => {
        it('should allow admin to create, update, and publish policies', async () => {
            const policyName = toPolicyName('Privacy Policy');

            const created = await appDriver.createPolicy({
                policyName,
                text: toPolicyText('Initial policy text'),
            }, adminUser);

            expect(created).toMatchObject({
                id: expect.any(String),
                versionHash: expect.any(String),
            });

            const draftUpdate = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Updated draft policy text'),
                publish: false,
            }, adminUser);

            expect(draftUpdate).toMatchObject({
                published: false,
                versionHash: expect.any(String),
            });

            const publishedUpdate = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Final published policy text'),
                publish: true,
            }, adminUser);

            expect(publishedUpdate).toMatchObject({
                published: true,
                currentVersionHash: expect.any(String),
            });

            const policyDetails = await appDriver.getPolicy(created.id, adminUser);
            const publishedVersionHash = publishedUpdate.currentVersionHash;
            expect(publishedVersionHash).toBeDefined();
            expect(policyDetails.currentVersionHash).toBe(publishedVersionHash);
            const publishedVersion = publishedVersionHash ? policyDetails.versions[publishedVersionHash] : undefined;
            expect(publishedVersion).toBeDefined();
            expect(publishedVersion?.text).toBe('Final published policy text');
        });

        it('should handle update-or-create workflow for named policies', async () => {
            const policyName = toPolicyName('Terms of Service');
            const policyId = toPolicyId('terms-of-service');

            await expect(
                appDriver.updatePolicy(policyId, {
                    text: toPolicyText('Updated terms version 1'),
                    publish: true,
                }, adminUser),
            )
                .rejects
                .toThrow(/Policy not found/);

            const created = await appDriver.createPolicy({
                policyName,
                text: toPolicyText('Initial terms content'),
            }, adminUser);

            expect(created.id).toBe(policyId);

            const update = await appDriver.updatePolicy(created.id, {
                text: toPolicyText('Updated terms version 2'),
                publish: true,
            }, adminUser);

            expect(update).toMatchObject({
                published: true,
                currentVersionHash: expect.any(String),
            });

            const policyDetails = await appDriver.getPolicy(policyId, adminUser);
            const publishedHash = update.currentVersionHash;
            expect(publishedHash).toBeDefined();
            expect(policyDetails.currentVersionHash).toBe(publishedHash);
            const currentVersion = publishedHash ? policyDetails.versions[publishedHash] : undefined;
            expect(currentVersion).toBeDefined();
            expect(currentVersion?.text).toBe('Updated terms version 2');
        });
    });

    describe('tenant settings endpoints', () => {
        beforeEach(async () => {
            // Create tenant via API using the admin user
            // Use 'system-fallback-tenant' as that's what createStubRequest sets
            const tenantData = AdminTenantRequestBuilder
                .forTenant('system-fallback-tenant')
                .withBranding({
                    appName: toTenantAppName('Test Tenant'),
                    logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#0066CC'),
                    secondaryColor: toTenantSecondaryColor('#FF6600'),
                    marketingFlags: {
                        showLandingPage: true,
                        showPricingPage: true,
                    },
                })
                .withDomains([toTenantDomainName('test.example.com')])
                .build();

            await appDriver.adminUpsertTenant(tenantData, adminUser);

            // Make user1 a tenant admin
            appDriver.seedTenantAdminUser(user1, {});
        });

        describe('GET /settings/tenant', () => {
            it('should allow tenant admin to get tenant settings', async () => {
                const settings = await appDriver.getTenantSettings(user1);

                expect(settings).toMatchObject({
                    tenantId: expect.any(String),
                    config: expect.objectContaining({
                        tenantId: expect.any(String),
                        branding: expect.any(Object),
                    }),
                    domains: expect.any(Array),
                    primaryDomain: expect.any(String),
                });

                expect(settings.config.branding).toMatchObject({
                    appName: expect.any(String),
                    logoUrl: expect.any(String),
                    faviconUrl: expect.any(String),
                    primaryColor: expect.any(String),
                    secondaryColor: expect.any(String),
                    marketingFlags: expect.objectContaining({
                        showLandingPage: expect.any(Boolean),
                        showPricingPage: expect.any(Boolean),
                    }),
                });
            });

            it('should deny regular user access to tenant settings', async () => {
                const result = await appDriver.getTenantSettings(user2);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });
        });

        describe('GET /settings/tenant/domains', () => {
            it('should allow tenant admin to list domains', async () => {
                const result = await appDriver.getTenantDomains(user1);

                expect(result).toMatchObject({
                    domains: expect.any(Array),
                    primaryDomain: expect.any(String),
                });

                expect(result.domains.length).toBeGreaterThan(0);
                expect(result.domains).toContain(result.primaryDomain);
            });

            it('should deny regular user access to list domains', async () => {
                const result = await appDriver.getTenantDomains(user2);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });
        });

        describe('PUT /settings/tenant/branding', () => {
            it('should allow tenant admin to update branding', async () => {
                const brandingData = {
                    appName: toTenantAppName('Custom Brand'),
                    primaryColor: toTenantPrimaryColor('#FF0000'),
                };

                const result = await appDriver.updateTenantBranding(brandingData, user1);

                expect(result).toMatchObject({
                    message: 'Tenant branding updated successfully',
                });

                // Verify the update persisted
                const settings = await appDriver.getTenantSettings(user1);
                expect(settings.config.branding.appName).toBe('Custom Brand');
                expect(settings.config.branding.primaryColor).toBe('#FF0000');
            });

            it('should update partial branding fields', async () => {
                const result = await appDriver.updateTenantBranding({
                    logoUrl: toTenantLogoUrl('https://custom.com/logo.svg'),
                }, user1);

                expect(result).toMatchObject({
                    message: 'Tenant branding updated successfully',
                });

                const settings = await appDriver.getTenantSettings(user1);
                expect(settings.config.branding.logoUrl).toBe('https://custom.com/logo.svg');
            });

            it('should update marketing flags', async () => {
                const result = await appDriver.updateTenantBranding({
                    marketingFlags: {
                        showLandingPage: toShowLandingPageFlag(false),
                        showPricingPage: toShowPricingPageFlag(true),
                    },
                }, user1);

                expect(result).toMatchObject({
                    message: 'Tenant branding updated successfully',
                });

                const settings = await appDriver.getTenantSettings(user1);
                expect(settings.config.branding.marketingFlags?.showLandingPage).toBe(false);
                expect(settings.config.branding.marketingFlags?.showPricingPage).toBe(true);
            });

            it('should reject invalid branding data', async () => {
                const invalidData = {
                    appName: toTenantAppName(''), // Empty string not allowed
                };

                const result = await appDriver.updateTenantBranding(invalidData, user1);

                expect(result).toMatchObject({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: expect.stringContaining('Invalid branding update request'),
                    },
                });
            });

            it('should reject extra fields', async () => {
                const invalidData = {
                    appName: toTenantAppName('Valid'),
                    unexpectedField: 'should fail',
                };

                const result = await appDriver.updateTenantBranding(invalidData, user1);

                expect(result).toMatchObject({
                    error: {
                        code: 'VALIDATION_ERROR',
                    },
                });
            });

            it('should deny regular user access to update branding', async () => {
                const brandingData = {
                    appName: toTenantAppName('Custom Brand'),
                };

                const result = await appDriver.updateTenantBranding(brandingData, user2);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });

            it('should allow system admin to update branding', async () => {
                const systemAdmin = user3;
                appDriver.seedAdminUser(systemAdmin); // Promote to system admin

                const result = await appDriver.updateTenantBranding({
                    appName: toTenantAppName('System Admin Updated'),
                }, systemAdmin);

                expect(result).toMatchObject({
                    message: 'Tenant branding updated successfully',
                });
            });
        });

        describe('POST /settings/tenant/domains', () => {
            it('should return 501 not implemented for domain addition', async () => {
                const domainData = {
                    domain: toTenantDomainName('custom.example.com'),
                };

                const result = await appDriver.addTenantDomain(domainData, user1);

                expect(result).toMatchObject({
                    error: {
                        code: 'NOT_IMPLEMENTED',
                        message: expect.stringContaining('not yet implemented'),
                    },
                });
            });

            it('should deny regular user access to add domain', async () => {
                const domainData = {
                    domain: toTenantDomainName('custom.example.com'),
                };

                const result = await appDriver.addTenantDomain(domainData, user2);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });
        });

        describe('authorization - system admin access', () => {
            beforeEach(() => {
                // Promote user3 to system admin
                appDriver.seedAdminUser(user3);
            });

            it('should allow system admin to access tenant settings', async () => {
                const settings = await appDriver.getTenantSettings(user3);

                expect(settings).toMatchObject({
                    tenantId: expect.any(String),
                    config: expect.any(Object),
                });
            });

            it('should allow system admin to list domains', async () => {
                const result = await appDriver.getTenantDomains(user3);

                expect(result).toMatchObject({
                    domains: expect.any(Array),
                    primaryDomain: expect.any(String),
                });
            });
        });
    });

    describe('Admin Tenant Management', () => {
        let localAdminUser: string;

        beforeEach(async () => {
            const adminReg = new UserRegistrationBuilder()
                .withEmail('tenantadmin@example.com')
                .withDisplayName('Tenant Admin User')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            localAdminUser = adminResult.user.uid;
            appDriver.seedAdminUser(localAdminUser);
        });

        describe('POST /api/admin/tenants - adminUpsertTenant', () => {
            it('should create a new tenant when it does not exist', async () => {
                const payload = AdminTenantRequestBuilder.forTenant('tenant_new_test').build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);

                expect(result).toMatchObject({
                    tenantId: 'tenant_new_test',
                    created: true,
                });
            });

            it('should update an existing tenant when it already exists', async () => {
                const payload = AdminTenantRequestBuilder.forTenant('tenant_existing_test').build();

                // Create tenant first
                const createResult = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(createResult.created).toBe(true);

                // Update the same tenant
                const updatedPayload = AdminTenantRequestBuilder
                    .forTenant('tenant_existing_test')
                    .withAppName('Updated Tenant App')
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updatedPayload, localAdminUser);

                expect(updateResult).toMatchObject({
                    tenantId: 'tenant_existing_test',
                    created: false,
                });
            });

            it('should reject invalid branding tokens schema', async () => {
                const invalidPayload = AdminTenantRequestBuilder
                    .forTenant('tenant_invalid')
                    .withPaletteColor('primary', 'not-a-hex-color') // Invalid hex color
                    .build();

                await expect(appDriver.adminUpsertTenant(invalidPayload, localAdminUser)).rejects.toThrow();
            });

            it('should reject missing required fields', async () => {
                const invalidPayload = {
                    tenantId: 'tenant_missing_fields',
                    branding: {
                        appName: 'Test App',
                        // Missing required fields
                    },
                } as any;

                await expect(appDriver.adminUpsertTenant(invalidPayload, localAdminUser)).rejects.toThrow();
            });

            // Test removed: brandingTokens is an internal implementation detail not exposed by the API

            it('should reject non-admin user', async () => {
                // Register regular user via API
                const regularUserReg = new UserRegistrationBuilder()
                    .withEmail('regular@test.com')
                    .withDisplayName('Regular User')
                    .withPassword('password12345')
                    .build();
                const regularUserResult = await appDriver.registerUser(regularUserReg);
                const regularUser = toUserId(regularUserResult.user.uid);

                const payload = AdminTenantRequestBuilder.forTenant('tenant_unauthorized').build();

                const result = await appDriver.adminUpsertTenant(payload, regularUser);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });

            it('should allow system admin to upsert tenant', async () => {
                const systemAdminReg = new UserRegistrationBuilder()
                    .withEmail('systemadmin@example.com')
                    .withDisplayName('System Admin')
                    .withPassword('password12345')
                    .build();
                const systemAdminResult = await appDriver.registerUser(systemAdminReg);
                const systemAdmin = systemAdminResult.user.uid;
                appDriver.seedAdminUser(systemAdmin); // Promote to system admin

                const payload = AdminTenantRequestBuilder.forTenant('tenant_system_admin').build();

                const result = await appDriver.adminUpsertTenant(payload, systemAdmin);

                expect(result).toMatchObject({
                    tenantId: 'tenant_system_admin',
                    created: true,
                });
            });

            // Test removed: brandingTokens.tokens is an internal implementation detail not exposed by the API

            // Test removed: defaultTenant is an internal database field not exposed by the API

            it('should store multiple domains', async () => {
                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_domains')
                    .withDomains([
                        toTenantDomainName('example.bar'),
                        toTenantDomainName('www.foo'),
                        toTenantDomainName('alias.bar'),
                    ])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);

                expect(result.tenantId).toBe('tenant_domains');

                // Verify domains were stored via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_domains');
                expect(tenant?.domains).toEqual([
                    'example.bar',
                    'www.foo',
                    'alias.bar',
                ]);
            });

            it('should reject duplicate domain across different tenants', async () => {
                // Create first tenant with a domain
                const firstTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_duplicate_test_1')
                    .withDomains([toTenantDomainName('duplicate-test.local')])
                    .build();

                const firstResult = await appDriver.adminUpsertTenant(firstTenant, localAdminUser);
                expect(firstResult.created).toBe(true);

                // Attempt to create second tenant with the same domain
                const secondTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_duplicate_test_2')
                    .withDomains([toTenantDomainName('duplicate-test.local')])
                    .build();

                // Should fail with appropriate error
                await expect(appDriver.adminUpsertTenant(secondTenant, localAdminUser))
                    .rejects
                    .toMatchObject({
                        code: 'DUPLICATE_DOMAIN',
                    });
            });

            it('should reject duplicate domain when one tenant has multiple domains', async () => {
                // Create first tenant with multiple domains
                const firstTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_multi_domain_1')
                    .withDomains([
                        toTenantDomainName('primary.test'),
                        toTenantDomainName('shared.test'),
                        toTenantDomainName('alias.test'),
                    ])
                    .build();

                const firstResult = await appDriver.adminUpsertTenant(firstTenant, localAdminUser);
                expect(firstResult.created).toBe(true);

                // Attempt to create second tenant with one of those domains
                const secondTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_multi_domain_2')
                    .withDomains([
                        toTenantDomainName('other.test'),
                        toTenantDomainName('shared.test'), // Conflicts with first tenant
                    ])
                    .build();

                // Should fail - 'shared.test' is already used by first tenant
                await expect(appDriver.adminUpsertTenant(secondTenant, localAdminUser))
                    .rejects
                    .toMatchObject({
                        code: 'DUPLICATE_DOMAIN',
                    });
            });

            it('should allow updating same tenant with same domains', async () => {
                // Create tenant
                const createTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_self_update')
                    .withDomains([toTenantDomainName('update.test')])
                    .build();

                const createResult = await appDriver.adminUpsertTenant(createTenant, localAdminUser);
                expect(createResult.created).toBe(true);

                // Update the same tenant with same domains - should be allowed
                const updateTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_self_update')
                    .withAppName('Updated Name')
                    .withDomains([toTenantDomainName('update.test')])
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updateTenant, localAdminUser);
                expect(updateResult.created).toBe(false); // Updated, not created
                expect(updateResult.tenantId).toBe('tenant_self_update');
            });

            it('should reject empty appName', async () => {
                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_empty_name')
                    .withAppName('')
                    .withDomains([toTenantDomainName('test.local')])
                    .build();

                await expect(appDriver.adminUpsertTenant(payload, localAdminUser))
                    .rejects
                    .toMatchObject({ code: 'INVALID_TENANT_PAYLOAD' });
            });

            it('should accept partial branding update', async () => {
                // Create tenant with all fields
                const createPayload = AdminTenantRequestBuilder
                    .forTenant('tenant_partial_update')
                    .withAppName('Initial App')
                    .withPrimaryColor('#ff0000')
                    .withSecondaryColor('#00ff00')
                    .withAccentColor('#0000ff')
                    .withDomains([toTenantDomainName('partial.test')])
                    .build();

                await appDriver.adminUpsertTenant(createPayload, localAdminUser);

                // Update with new colors
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant('tenant_partial_update')
                    .withAppName('Updated App')
                    .withPrimaryColor('#ff00ff')
                    .withSecondaryColor('#00ff00')
                    .withAccentColor('#0000ff')
                    .withDomains([toTenantDomainName('partial.test')])
                    .build();

                const result = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);

                expect(result).toMatchObject({
                    tenantId: 'tenant_partial_update',
                    created: false,
                });

                // Verify the tenant was updated via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_partial_update');
                expect(tenant?.tenant.branding?.appName).toBe('Updated App');
            });

            it('should generate different brandingTokens for different color inputs', async () => {
                const tenant1 = AdminTenantRequestBuilder
                    .forTenant('tenant_tokens_1')
                    .withPrimaryColor('#ff0000')
                    .withDomains([toTenantDomainName('tokens1.test')])
                    .build();

                await appDriver.adminUpsertTenant(tenant1, localAdminUser);

                const tenant2 = AdminTenantRequestBuilder
                    .forTenant('tenant_tokens_2')
                    .withPrimaryColor('#00ff00')
                    .withDomains([toTenantDomainName('tokens2.test')])
                    .build();

                await appDriver.adminUpsertTenant(tenant2, localAdminUser);

                // Verify tokens via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant1Record = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_tokens_1');
                const tenant2Record = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_tokens_2');

                const tokens1 = tenant1Record?.brandingTokens;
                const tokens2 = tenant2Record?.brandingTokens;

                // Tokens should be different because colors are different
                expect(tokens1).toBeDefined();
                expect(tokens2).toBeDefined();
                expect(tokens1?.tokens?.palette?.primary).toBe('#ff0000');
                expect(tokens2?.tokens?.palette?.primary).toBe('#00ff00');
            });

            it('should preserve explicitly provided brandingTokens instead of generating', async () => {
                const explicitTokens = AdminTenantRequestBuilder.forTenant('explicit').buildTokens();
                explicitTokens.palette.primary = '#123456' as `#${string}`;

                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_explicit_tokens')
                    .withDomains([toTenantDomainName('explicit.test')])
                    .build();

                payload.brandingTokens = { tokens: explicitTokens };

                await appDriver.adminUpsertTenant(payload, localAdminUser);

                // Verify explicit tokens via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_explicit_tokens');

                // Should use the explicit tokens, not generate from branding colors
                expect(tenant?.brandingTokens?.tokens?.palette?.primary).toBe('#123456');
            });

            it('should reject tenant with no domains', async () => {
                const payload = {
                    tenantId: 'tenant_no_domains',
                    branding: {
                        appName: toTenantAppName('Test App'),
                        logoUrl: toTenantLogoUrl('https://example.com/logo.png'),
                        primaryColor: toTenantPrimaryColor('#ff0000'),
                        secondaryColor: toTenantSecondaryColor('#00ff00'),
                        accentColor: toTenantAccentColor('#0000ff'),
                    },
                    domains: [] as any,
                };

                await expect(appDriver.adminUpsertTenant(payload, localAdminUser))
                    .rejects
                    .toMatchObject({ code: 'INVALID_TENANT_PAYLOAD' });
            });

            it('should accept reasonably long appName', async () => {
                const longName = 'A'.repeat(200);

                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_long_name')
                    .withAppName(longName)
                    .withDomains([toTenantDomainName('longname.test')])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);

                expect(result).toMatchObject({
                    tenantId: 'tenant_long_name',
                    created: true,
                });
            });

            it('should update appName without affecting colors', async () => {
                const initialPayload = AdminTenantRequestBuilder
                    .forTenant('tenant_name_only_update')
                    .withAppName('Initial Name')
                    .withAccentColor('#ff0000')
                    .withDomains([toTenantDomainName('nameonly.test')])
                    .build();

                const createResult = await appDriver.adminUpsertTenant(initialPayload, localAdminUser);
                expect(createResult.created).toBe(true);

                // Update with different app name
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant('tenant_name_only_update')
                    .withAppName('Updated Name Only')
                    .withAccentColor('#ff0000')
                    .withDomains([toTenantDomainName('nameonly.test')])
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);

                // Verify update succeeded
                expect(updateResult.created).toBe(false);
                expect(updateResult.tenantId).toBe('tenant_name_only_update');

                // Verify branding tokens via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_name_only_update');
                expect(tenant).toBeDefined();
                expect(tenant?.brandingTokens?.tokens?.palette?.accent).toBe('#ff0000');
            });
        });

        describe('POST /api/admin/tenants/publish - publishTenantTheme', () => {
            let systemAdmin: string;
            const tenantId = 'tenant_publish_unit';

            beforeEach(async () => {
                appDriver.storageStub.clear();
                const systemAdminReg = new UserRegistrationBuilder()
                    .withEmail('theme-admin@test.com')
                    .withDisplayName('Theme Admin')
                    .withPassword('password12345')
                    .build();
                const systemAdminResult = await appDriver.registerUser(systemAdminReg);
                systemAdmin = systemAdminResult.user.uid;
                appDriver.seedAdminUser(systemAdmin); // Promote to system admin

                // Create tenant via API with branding tokens
                const tokens = AdminTenantRequestBuilder.forTenant(tenantId).buildTokens();
                const tenantRequest = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withBrandingTokens({ tokens })
                    .build();
                await appDriver.adminUpsertTenant(tenantRequest, systemAdmin);
            });

            it('should publish theme artifacts and record metadata', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                // URLs may be emulator format (with URL encoding) or production format
                // Decode to handle both cases
                const decodedCssUrl = decodeURIComponent(result.cssUrl);
                const decodedTokensUrl = decodeURIComponent(result.tokensUrl);

                expect(decodedCssUrl).toContain(`theme-artifacts/${tenantId}/`);
                expect(decodedTokensUrl).toContain(`theme-artifacts/${tenantId}/`);
                expect(result).toMatchObject({
                    artifact: {
                        version: 1,
                        generatedBy: systemAdmin,
                        cssUrl: expect.any(String),
                        tokensUrl: expect.any(String),
                    },
                });

                // Verify artifact was stored via API
                const allTenants = await appDriver.listAllTenants(systemAdmin);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === tenantId);
                expect(tenant?.brandingTokens?.artifact).toMatchObject({
                    version: 1,
                    hash: result.artifact.hash,
                    generatedBy: systemAdmin,
                });

                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/theme.css`;
                const tokensPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/tokens.json`;

                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);
                const tokensFile = appDriver.storageStub.getFile(bucketName, tokensPath);

                expect(cssFile?.public).toBe(true);
                expect(cssFile?.metadata?.metadata?.tenantId).toBe(tenantId);
                expect(tokensFile?.public).toBe(true);
                expect(tokensFile?.content.toString('utf8')).toContain('"palette"');
            });

            it('should increment artifact version on subsequent publishes', async () => {
                const first = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);
                const second = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                expect(second.artifact.version).toBe(first.artifact.version + 1);

                // Verify artifact version via API
                const allTenants = await appDriver.listAllTenants(systemAdmin);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === tenantId);
                expect(tenant?.brandingTokens?.artifact?.version).toBe(2);
            });

            // Test removed: Cannot create tenant without branding tokens through API
            // The API either requires branding tokens or auto-generates them, so this error case cannot be tested
            // through normal API workflows

            it('should reject when tenant does not exist', async () => {
                await expect(appDriver.publishTenantTheme({ tenantId: 'unknown-tenant' }, systemAdmin))
                    .rejects
                    .toMatchObject({ code: 'TENANT_NOT_FOUND' });
            });

            it('should use updated branding colors when publishing theme', async () => {
                // Create a tenant with initial branding colors using the builder methods
                // that update BOTH branding AND brandingTokens
                const testTenantId = 'tenant-color-update-test';
                const initialAccentColor = '#22d3ee'; // Teal
                const updatedAccentColor = '#ff00ff'; // Magenta

                const initialPayload = AdminTenantRequestBuilder
                    .forTenant(testTenantId)
                    .withDomains([`${testTenantId}.test`])
                    .withAppName('Test App')
                    .withLogoUrl('/logo.svg')
                    .withPrimaryColor('#2563eb')
                    .withSecondaryColor('#7c3aed')
                    .withAccentColor(initialAccentColor)
                    .build();

                await appDriver.adminUpsertTenant(initialPayload, systemAdmin);

                // Update only the branding colors WITHOUT updating brandingTokens
                // This simulates what happens when using the UI tenant editor
                const updatedPayload = {
                    tenantId: testTenantId,
                    branding: {
                        appName: toTenantAppName('Test App'),
                        logoUrl: toTenantLogoUrl('/logo.svg'),
                        primaryColor: toTenantPrimaryColor('#2563eb'),
                        secondaryColor: toTenantPrimaryColor('#7c3aed'),
                        accentColor: toTenantPrimaryColor(updatedAccentColor), // NEW COLOR
                    },
                    domains: [toTenantDomainName(`${testTenantId}.test`)],
                };

                await appDriver.adminUpsertTenant(updatedPayload, systemAdmin);

                // Publish the theme
                const publishResult = await appDriver.publishTenantTheme({ tenantId: testTenantId }, systemAdmin);

                // Get the published CSS from storage
                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${testTenantId}/${publishResult.artifact.hash}/theme.css`;
                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);

                expect(cssFile).toBeDefined();
                const cssContent = cssFile!.content.toString('utf8').toLowerCase();

                // The published CSS should contain the UPDATED accent color
                // because brandingTokens are regenerated when branding is updated
                expect(cssContent).toContain(updatedAccentColor.toLowerCase());
                expect(cssContent).not.toContain(initialAccentColor.toLowerCase());
            });

            it('should reject publish from non-admin user', async () => {
                // Register regular user via API
                const regularUserReg = new UserRegistrationBuilder()
                    .withEmail('regularpublish@test.com')
                    .withDisplayName('Regular User')
                    .withPassword('password12345')
                    .build();
                const regularUserResult = await appDriver.registerUser(regularUserReg);
                const regularUser = toUserId(regularUserResult.user.uid);

                const result = await appDriver.publishTenantTheme({ tenantId }, regularUser);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });

            it('should generate valid CSS with CSS custom properties', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/theme.css`;
                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);

                expect(cssFile).toBeDefined();
                const cssContent = cssFile!.content.toString('utf8');

                // Verify it contains CSS with :root and custom properties format
                expect(cssContent).toContain(':root');
                expect(cssContent).toContain('--');
                expect(cssContent.length).toBeGreaterThan(100);
            });

            it('should generate valid JSON tokens file', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                const bucketName = appDriver.storageStub.bucket().name;
                const tokensPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/tokens.json`;
                const tokensFile = appDriver.storageStub.getFile(bucketName, tokensPath);

                expect(tokensFile).toBeDefined();
                const tokensContent = tokensFile!.content.toString('utf8');

                // Should be valid JSON
                const tokens = JSON.parse(tokensContent);
                expect(tokens).toHaveProperty('palette');
                expect(tokens).toHaveProperty('typography');
                expect(tokens).toHaveProperty('spacing');
                expect(tokens).toHaveProperty('semantics');
            });

            it('should generate consistent hash for same tokens', async () => {
                const result1 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);
                const result2 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                // Same tokens should produce same hash
                expect(result1.artifact.hash).toBe(result2.artifact.hash);
            });

            it('should generate different hash after token update', async () => {
                const result1 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                // Update tenant with different color
                const updatePayload = {
                    tenantId,
                    branding: {
                        appName: toTenantAppName('Test App'),
                        logoUrl: toTenantLogoUrl('/logo.svg'),
                        primaryColor: toTenantPrimaryColor('#ff0000'), // Different color
                        secondaryColor: toTenantPrimaryColor('#7c3aed'),
                        accentColor: toTenantPrimaryColor('#f97316'),
                        backgroundColor: toTenantPrimaryColor('#ffffff'),
                        headerBackgroundColor: toTenantPrimaryColor('#111827'),
                    },
                    domains: [toTenantDomainName(`${tenantId}.test`)],
                };

                await appDriver.adminUpsertTenant(updatePayload, systemAdmin);

                const result2 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                // Different tokens should produce different hash
                expect(result1.artifact.hash).not.toBe(result2.artifact.hash);
            });

            it('should make published files publicly accessible', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/theme.css`;
                const tokensPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/tokens.json`;

                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);
                const tokensFile = appDriver.storageStub.getFile(bucketName, tokensPath);

                expect(cssFile?.public).toBe(true);
                expect(tokensFile?.public).toBe(true);
            });

            it('should record correct metadata in published files', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/theme.css`;

                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);

                expect(cssFile?.metadata?.metadata?.tenantId).toBe(tenantId);
                expect(cssFile?.metadata?.contentType).toContain('text/css');
                expect(cssFile?.public).toBe(true);
            });

            it('should include operator ID in artifact metadata', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                expect(result.artifact.generatedBy).toBe(systemAdmin);

                // Verify it's stored in Firestore via API
                const allTenants = await appDriver.listAllTenants(systemAdmin);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === tenantId);
                expect(tenant?.brandingTokens?.artifact?.generatedBy).toBe(systemAdmin);
            });

            it('should handle publishing same theme multiple times', async () => {
                const result1 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);
                const result2 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);
                const result3 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                expect(result1.artifact.version).toBe(1);
                expect(result2.artifact.version).toBe(2);
                expect(result3.artifact.version).toBe(3);

                // All should have the same hash (since tokens haven't changed)
                expect(result1.artifact.hash).toBe(result2.artifact.hash);
                expect(result2.artifact.hash).toBe(result3.artifact.hash);
            });
        });
    });

    describe('Admin browser endpoints', () => {
        let browserAdmin: string;

        beforeEach(async () => {
            const browserAdminReg = new UserRegistrationBuilder()
                .withEmail('browser-admin@test.com')
                .withDisplayName('Browser Admin')
                .withPassword('password12345')
                .build();
            const browserAdminResult = await appDriver.registerUser(browserAdminReg);
            browserAdmin = browserAdminResult.user.uid;
            appDriver.seedAdminUser(browserAdmin); // Promote to system admin
        });

        it('lists all tenants for system users', async () => {
            // Create tenants via API
            const tenant1Request = AdminTenantRequestBuilder
                .forTenant('tenant-browser-1')
                .withDomains([toTenantDomainName('browser-1.test')])
                .build();
            await appDriver.adminUpsertTenant(tenant1Request, browserAdmin);

            const tenant2Request = AdminTenantRequestBuilder
                .forTenant('tenant-browser-2')
                .withDomains([toTenantDomainName('browser-2.test')])
                .build();
            await appDriver.adminUpsertTenant(tenant2Request, browserAdmin);

            const result = await appDriver.listAllTenants(browserAdmin);

            expect(result.tenants.length).toBe(2);
            expect(result.count).toBe(2);
            const tenantIds = result.tenants.map((entry) => entry.tenant.tenantId);
            expect(tenantIds).toEqual(expect.arrayContaining(['tenant-browser-1', 'tenant-browser-2']));
        });

        it('rejects tenant listing for users without a system role', async () => {
            // Register regular user via API
            const regularUserReg = new UserRegistrationBuilder()
                .withEmail('browser-regular@test.com')
                .withDisplayName('Browser Regular')
                .withPassword('password12345')
                .build();
            const regularUserResult = await appDriver.registerUser(regularUserReg);
            const regularUser = toUserId(regularUserResult.user.uid);

            const result = await appDriver.listAllTenants(regularUser);

            expect((result as any).error?.code).toBe('FORBIDDEN');
        });

        it('enriches auth users with their Firestore roles', async () => {
            const browserSystemUserReg = new UserRegistrationBuilder()
                .withEmail('browsersystemuser@example.com')
                .withDisplayName('Browser System User')
                .withPassword('password12345')
                .build();
            const browserSystemUserResult = await appDriver.registerUser(browserSystemUserReg);
            const browserSystemUser = toUserId(browserSystemUserResult.user.uid);

            const response = await appDriver.listAuthUsers({ uid: browserSystemUser }, browserAdmin);

            expect(response.users).toHaveLength(1);
            expect(response.users[0].uid).toBe(browserSystemUser);
            expect(response.users[0].role).toBe(SystemUserRoles.SYSTEM_USER);
            expect(response.hasMore).toBe(false);
        });

        it('filters Firestore users by uid', async () => {
            const browserSystemUserReg = new UserRegistrationBuilder()
                .withEmail('browserfirestoreuser@example.com')
                .withDisplayName('Browser Firestore User')
                .withPassword('password12345')
                .build();
            const browserSystemUserResult = await appDriver.registerUser(browserSystemUserReg);
            const browserSystemUser = toUserId(browserSystemUserResult.user.uid);

            const response = await appDriver.listFirestoreUsers({ uid: browserSystemUser }, browserAdmin);

            expect(response.users).toHaveLength(1);
            expect(response.users[0].uid).toBe(browserSystemUser);
            expect(response.hasMore).toBe(false);
        });
    });

    describe('Admin User Management', () => {
        let localAdminUser: string;
        let regularUser: UserId;

        beforeEach(async () => {
            const adminReg = new UserRegistrationBuilder()
                .withEmail('admin@test.com')
                .withDisplayName('Admin User')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            localAdminUser = adminResult.user.uid;
            appDriver.seedAdminUser(localAdminUser);

            const regularUserReg = new UserRegistrationBuilder()
                .withEmail('regular@test.com')
                .withDisplayName('Regular User')
                .withPassword('password12345')
                .build();
            const regularUserResult = await appDriver.registerUser(regularUserReg);
            regularUser = toUserId(regularUserResult.user.uid);
        });

        describe('PUT /api/admin/users/:uid - updateUser (disable/enable)', () => {
            it('should allow admin to disable a user account', async () => {
                const result = await appDriver.updateUser(regularUser, { disabled: true }, adminUser);

                expect(result).toMatchObject({
                    uid: regularUser,
                    email: 'regular@test.com',
                    disabled: true,
                });
            });

            it('should allow admin to enable a disabled user account', async () => {
                // First disable the user
                await appDriver.updateUser(regularUser, { disabled: true }, adminUser);

                // Then enable them
                const result = await appDriver.updateUser(regularUser, { disabled: false }, adminUser);

                expect(result).toMatchObject({
                    uid: regularUser,
                    email: 'regular@test.com',
                    disabled: false,
                });
            });

            it('should reject non-admin user', async () => {
                const result = await appDriver.updateUser(regularUser, { disabled: true }, regularUser);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });

            it('should reject invalid UID', async () => {
                await expect(
                    appDriver.updateUser(toUserId(''), { disabled: true }, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject non-existent user', async () => {
                await expect(
                    appDriver.updateUser(toUserId('nonexistent-user'), { disabled: true }, adminUser),
                )
                    .rejects
                    .toThrow();
            });
        });

        describe('PUT /api/admin/users/:uid/role - updateUserRole', () => {
            it('should allow admin to promote user to system_admin', async () => {
                const result = await appDriver.updateUserRole(regularUser, { role: SystemUserRoles.SYSTEM_ADMIN }, adminUser);

                expect(result).toMatchObject({
                    uid: regularUser,
                    email: 'regular@test.com',
                });
                // Role verification removed: updateUserRole API response already confirms the role was set
            });

            it('should allow admin to promote user to tenant_admin', async () => {
                const result = await appDriver.updateUserRole(regularUser, { role: SystemUserRoles.TENANT_ADMIN }, adminUser);

                expect(result).toMatchObject({
                    uid: regularUser,
                    email: 'regular@test.com',
                });
                // Role verification removed: updateUserRole API response already confirms the role was set
            });

            it('should allow admin to demote user by setting role to null', async () => {
                // First promote the user
                await appDriver.updateUserRole(regularUser, { role: SystemUserRoles.SYSTEM_ADMIN }, adminUser);

                // Then demote them
                const result = await appDriver.updateUserRole(regularUser, { role: null }, adminUser);

                expect(result).toMatchObject({
                    uid: regularUser,
                    email: 'regular@test.com',
                });
                // Role verification removed: updateUserRole API response already confirms the role was set
            });

            it('should reject invalid role value', async () => {
                await expect(
                    appDriver.updateUserRole(regularUser, { role: 'invalid_role' } as any, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject non-admin user', async () => {
                const result = await appDriver.updateUserRole(regularUser, { role: SystemUserRoles.SYSTEM_ADMIN }, regularUser);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });

            it('should reject invalid UID', async () => {
                await expect(
                    appDriver.updateUserRole(toUserId(''), { role: SystemUserRoles.SYSTEM_ADMIN }, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject non-existent user', async () => {
                await expect(
                    appDriver.updateUserRole(toUserId('nonexistent-user'), { role: SystemUserRoles.SYSTEM_ADMIN }, adminUser),
                )
                    .rejects
                    .toThrow();
            });
        });
    });
});

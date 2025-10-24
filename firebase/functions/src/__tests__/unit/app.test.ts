import { amountToSmallestUnit, calculateEqualSplits, calculatePercentageSplits, smallestUnitToAmountString, UserBalance } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from './AppDriver';

const amountFor = (splits: Array<{ uid: string; amount: string; }>, uid: string) => splits.find((split) => split.uid === uid)!.amount;

const netBalanceForPayer = (splits: Array<{ uid: string; amount: string; }>, payerId: string, currency: string) => {
    const totalUnits = splits
        .filter((split) => split.uid !== payerId)
        .reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currency), 0);
    return smallestUnitToAmountString(totalUnits, currency);
};

const sumBalances = (balances: Record<string, UserBalance>, currency: string): number => {
    return Object.values(balances).reduce((sum, balance) => {
        return sum + amountToSmallestUnit(balance.netBalance, currency);
    }, 0);
};

const verifyBalanceConsistency = (balances: Record<string, UserBalance>, currency: string, testDescription: string) => {
    const totalBalance = sumBalances(balances, currency);
    expect(totalBalance, `Total balance should be zero for ${testDescription} (found ${totalBalance} smallest units)`).toBe(0);
};

describe('app tests', () => {
    let appDriver: AppDriver;

    const user1 = 'user-1';
    const user2 = 'user-2';
    const user3 = 'user-3';
    const user4 = 'user-4';

    beforeEach(() => {
        appDriver = new AppDriver();

        appDriver.seedUser(user1, { displayName: 'User one' });
        appDriver.seedUser(user2, { displayName: 'User two' });
        appDriver.seedUser(user3, { displayName: 'User three' });
        appDriver.seedUser(user4, { displayName: 'User four' });
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('happy path tests', async () => {
        it('should revert balance change after expese deletion', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            const createdExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, 'EUR')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, 'EUR', participants))
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].owedBy[user2]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].netBalance).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owes[user1]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].netBalance).toBe('-50.00');

            await appDriver.updateExpense(
                user1,
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(150.5, 'EUR')
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(150.5, 'EUR', participants))
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency?.EUR).toBeDefined();
            expect((groupDetails.balances.balancesByCurrency!.EUR)![user1]).toBeDefined();
            expect((groupDetails.balances.balancesByCurrency!.EUR)![user1].owedBy[user2]).toBe('75.25');
            expect((groupDetails.balances.balancesByCurrency!.EUR)![user1].netBalance).toBe('75.25');
            expect((groupDetails.balances.balancesByCurrency!.EUR)![user2].owes[user1]).toBe('75.25');
            expect((groupDetails.balances.balancesByCurrency!.EUR)![user2].netBalance).toBe('-75.25');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50.25, 'EUR')
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].owedBy[user2]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].netBalance).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owes[user1]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].netBalance).toBe('-25.00');

            await appDriver.deleteExpense(user1, createdExpense.id);

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].owes[user2]).toBe('50.25');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].netBalance).toBe('-50.25');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owedBy[user1]).toBe('50.25');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].netBalance).toBe('50.25');
        });

        it('should paginate expenses and settlements via group full details', async () => {
            const group = await appDriver.createGroup(user1);
            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            const createdExpenseIds: string[] = [];
            for (let index = 0; index < 5; index += 1) {
                const amount = 50 + index;
                const expense = await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withDescription(`Paginated expense ${index}`)
                        .withAmount(amount, 'USD')
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(amount, 'USD', participants))
                        .build(),
                );

                createdExpenseIds.push(expense.id);
            }

            const settlementAmounts = [40, 30, 20, 10];
            const createdSettlementIds: string[] = [];
            for (const amount of settlementAmounts) {
                const settlement = await appDriver.createSettlement(
                    user2,
                    new CreateSettlementRequestBuilder()
                        .withGroupId(groupId)
                        .withPayerId(user2)
                        .withPayeeId(user1)
                        .withAmount(amount, 'USD')
                        .build(),
                );

                createdSettlementIds.push(settlement.id);
            }

            expect(createdSettlementIds).toHaveLength(settlementAmounts.length);

            const firstPage = await appDriver.getGroupFullDetails(user1, groupId, {
                expenseLimit: 2,
                settlementLimit: 2,
            });

            expect(firstPage.expenses.expenses).toHaveLength(2);
            expect(firstPage.expenses.hasMore).toBe(true);
            expect(firstPage.expenses.nextCursor).toBeDefined();

            expect(firstPage.settlements.settlements).toHaveLength(2);
            expect(firstPage.settlements.hasMore).toBe(true);
            expect(firstPage.settlements.nextCursor).toBeDefined();

            const secondPage = await appDriver.getGroupFullDetails(user1, groupId, {
                expenseLimit: 2,
                expenseCursor: firstPage.expenses.nextCursor,
                settlementLimit: 2,
                settlementCursor: firstPage.settlements.nextCursor,
            });

            expect(secondPage.expenses.expenses.length).toBeGreaterThanOrEqual(1);

            const seenSettlementIds = [
                ...firstPage.settlements.settlements.map((settlement) => settlement.id),
                ...secondPage.settlements.settlements.map((settlement) => settlement.id),
            ];
            let settlementCursor = secondPage.settlements.nextCursor;

            while (settlementCursor) {
                const nextPage = await appDriver.getGroupFullDetails(user1, groupId, {
                    settlementLimit: 2,
                    settlementCursor,
                });

                seenSettlementIds.push(...nextPage.settlements.settlements.map((settlement) => settlement.id));
                settlementCursor = nextPage.settlements.nextCursor;
            }

            const thirdPage = await appDriver.getGroupFullDetails(user1, groupId, {
                expenseLimit: 2,
                expenseCursor: secondPage.expenses.nextCursor,
            });

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
            const group = await appDriver.createGroup(user1);
            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            const kwdSplits = calculateEqualSplits(12.345, 'KWD', participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(12.345, 'KWD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(kwdSplits)
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            const kwdBalances = groupDetails.balances.balancesByCurrency?.KWD;
            expect(kwdBalances).toBeDefined();
            expect(kwdBalances![user1].owedBy[user2]).toBe(amountFor(kwdSplits, user2));
            expect(kwdBalances![user1].owedBy[user3]).toBe(amountFor(kwdSplits, user3));
            expect(kwdBalances![user1].netBalance).toBe(netBalanceForPayer(kwdSplits, user1, 'KWD'));
            expect(kwdBalances![user2].owes[user1]).toBe(amountFor(kwdSplits, user2));
            expect(kwdBalances![user3].owes[user1]).toBe(amountFor(kwdSplits, user3));
            expect(kwdBalances![user2].netBalance).toBe(`-${amountFor(kwdSplits, user2)}`);
            expect(kwdBalances![user3].netBalance).toBe(`-${amountFor(kwdSplits, user3)}`);

            const jpySplits = calculateEqualSplits(303, 'JPY', participants);
            await appDriver.createExpense(
                user2,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(303, 'JPY')
                    .withPaidBy(user2)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(jpySplits)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            const jpyBalances = groupDetails.balances.balancesByCurrency?.JPY;
            expect(jpyBalances).toBeDefined();
            expect(jpyBalances![user2].owedBy[user1]).toBe(amountFor(jpySplits, user1));
            expect(jpyBalances![user2].owedBy[user3]).toBe(amountFor(jpySplits, user3));
            expect(jpyBalances![user2].netBalance).toBe(netBalanceForPayer(jpySplits, user2, 'JPY'));
            expect(jpyBalances![user1].owes[user2]).toBe(amountFor(jpySplits, user1));
            expect(jpyBalances![user3].owes[user2]).toBe(amountFor(jpySplits, user3));
            expect(jpyBalances![user1].netBalance).toBe(`-${amountFor(jpySplits, user1)}`);
            expect(jpyBalances![user3].netBalance).toBe(`-${amountFor(jpySplits, user3)}`);

            const gbpSplits = calculateEqualSplits(45.67, 'GBP', participants);
            await appDriver.createExpense(
                user3,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(45.67, 'GBP')
                    .withPaidBy(user3)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(gbpSplits)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            const gbpBalances = groupDetails.balances.balancesByCurrency?.GBP;
            expect(gbpBalances).toBeDefined();
            expect(gbpBalances![user3].owedBy[user1]).toBe(amountFor(gbpSplits, user1));
            expect(gbpBalances![user3].owedBy[user2]).toBe(amountFor(gbpSplits, user2));
            expect(gbpBalances![user3].netBalance).toBe(netBalanceForPayer(gbpSplits, user3, 'GBP'));
            expect(gbpBalances![user1].owes[user3]).toBe(amountFor(gbpSplits, user1));
            expect(gbpBalances![user2].owes[user3]).toBe(amountFor(gbpSplits, user2));
            expect(gbpBalances![user1].netBalance).toBe(`-${amountFor(gbpSplits, user1)}`);
            expect(gbpBalances![user2].netBalance).toBe(`-${amountFor(gbpSplits, user2)}`);

            expect(groupDetails.balances.balancesByCurrency!.KWD![user1].owedBy[user2]).toBe(amountFor(kwdSplits, user2));
            expect(groupDetails.balances.balancesByCurrency!.KWD![user1].owedBy[user3]).toBe(amountFor(kwdSplits, user3));
        });

        it('should support exact split expenses with manual allocations', async () => {
            const group = await appDriver.createGroup(user1);
            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            const exactSplits = [
                { uid: user1, amount: '120.10' },
                { uid: user2, amount: '80.05' },
                { uid: user3, amount: '75.10' },
            ];

            const createdExpense = await appDriver.createExpense(
                user2,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(275.25, 'USD')
                    .withPaidBy(user2)
                    .withParticipants(participants)
                    .withSplitType('exact')
                    .withSplits(exactSplits)
                    .build(),
            );

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;
            expect(usdBalances).toBeDefined();
            expect(usdBalances![user2].owedBy[user1]).toBe(amountFor(exactSplits, user1));
            expect(usdBalances![user2].owedBy[user3]).toBe(amountFor(exactSplits, user3));
            expect(usdBalances![user2].netBalance).toBe(netBalanceForPayer(exactSplits, user2, 'USD'));
            expect(usdBalances![user1].owes[user2]).toBe(amountFor(exactSplits, user1));
            expect(usdBalances![user3].owes[user2]).toBe(amountFor(exactSplits, user3));
            expect(usdBalances![user1].netBalance).toBe(`-${amountFor(exactSplits, user1)}`);
            expect(usdBalances![user3].netBalance).toBe(`-${amountFor(exactSplits, user3)}`);

            const recordedExpense = groupDetails.expenses.expenses.find((expense) => expense.id === createdExpense.id);
            expect(recordedExpense).toBeDefined();
            expect(recordedExpense!.splitType).toBe('exact');
            expect(recordedExpense!.amount).toBe('275.25');
            expect(recordedExpense!.currency).toBe('USD');
            expect(recordedExpense!.paidBy).toBe(user2);
            expect(recordedExpense!.splits).toEqual(exactSplits);
        });

        it('should allow percentage split expenses to be updated with new participants, currency, and payer', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            const percentageSplits = calculatePercentageSplits(200, 'EUR', participants);
            const createdExpense = await appDriver.createExpense(
                user3,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Team Outing EUR')
                    .withAmount(200, 'EUR')
                    .withPaidBy(user3)
                    .withParticipants(participants)
                    .withSplitType('percentage')
                    .withSplits(percentageSplits)
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user3, groupId);

            const eurBalances = groupDetails.balances.balancesByCurrency?.EUR;
            expect(eurBalances).toBeDefined();
            expect(eurBalances![user3].owedBy[user1]).toBe(amountFor(percentageSplits, user1));
            expect(eurBalances![user3].owedBy[user2]).toBe(amountFor(percentageSplits, user2));
            expect(eurBalances![user3].netBalance).toBe(netBalanceForPayer(percentageSplits, user3, 'EUR'));
            expect(eurBalances![user1].owes[user3]).toBe(amountFor(percentageSplits, user1));
            expect(eurBalances![user2].owes[user3]).toBe(amountFor(percentageSplits, user2));
            expect(eurBalances![user1].netBalance).toBe(`-${amountFor(percentageSplits, user1)}`);
            expect(eurBalances![user2].netBalance).toBe(`-${amountFor(percentageSplits, user2)}`);

            const recordedExpenseBeforeUpdate = groupDetails.expenses.expenses.find((expense) => expense.id === createdExpense.id);
            expect(recordedExpenseBeforeUpdate).toBeDefined();
            expect(recordedExpenseBeforeUpdate!.splitType).toBe('percentage');
            expect(recordedExpenseBeforeUpdate!.currency).toBe('EUR');
            expect(recordedExpenseBeforeUpdate!.splits.map((split) => split.amount)).toEqual(percentageSplits.map((split) => split.amount));
            expect(recordedExpenseBeforeUpdate!.splits.map((split) => split.percentage)).toEqual(percentageSplits.map((split) => split.percentage));

            const updatedParticipants = [user1, user2];
            const updatedSplits = calculateEqualSplits(303, 'JPY', updatedParticipants);
            await appDriver.updateExpense(
                user1,
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withDescription('Team Outing JPY')
                    .withAmount(303, 'JPY')
                    .withPaidBy(user1)
                    .withParticipants(updatedParticipants)
                    .withSplitType('equal')
                    .withSplits(updatedSplits)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            const jpyBalances = groupDetails.balances.balancesByCurrency?.JPY;
            expect(jpyBalances).toBeDefined();
            expect(jpyBalances![user1].owedBy[user2]).toBe(amountFor(updatedSplits, user2));
            expect(jpyBalances![user1].netBalance).toBe(netBalanceForPayer(updatedSplits, user1, 'JPY'));
            expect(jpyBalances![user2].owes[user1]).toBe(amountFor(updatedSplits, user2));
            expect(jpyBalances![user2].netBalance).toBe(`-${amountFor(updatedSplits, user2)}`);
            expect(jpyBalances![user3].netBalance).toBe('0');
            expect(jpyBalances![user3].owedBy).toEqual({});
            expect(jpyBalances![user3].owes).toEqual({});

            const eurBalancesAfterUpdate = groupDetails.balances.balancesByCurrency?.EUR;
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
            expect(recordedExpenseAfterUpdate!.currency).toBe('JPY');
            expect(recordedExpenseAfterUpdate!.amount).toBe('303');
            expect(recordedExpenseAfterUpdate!.paidBy).toBe(user1);
            expect(recordedExpenseAfterUpdate!.splitType).toBe('equal');
            expect(recordedExpenseAfterUpdate!.participants).toEqual(updatedParticipants);
            expect(recordedExpenseAfterUpdate!.splits).toEqual(updatedSplits);
        });

        it('should generate different share links on consecutive calls', async () => {
            const group = await appDriver.createGroup(user1);
            const groupId = group.id;

            // Generate first share link
            const { shareablePath: path1, linkId: linkId1, expiresAt: expiresAt1 } = await appDriver.generateShareableLink(user1, groupId);
            expect(path1).toBe(`/join?linkId=${linkId1}`);
            expect(linkId1).toHaveLength(16);
            expect(expiresAt1).toBeTruthy();

            // Generate second share link (simulating "Generate New" button)
            const { shareablePath: path2, linkId: linkId2, expiresAt: expiresAt2 } = await appDriver.generateShareableLink(user1, groupId);
            expect(path2).toBe(`/join?linkId=${linkId2}`);
            expect(linkId2).toHaveLength(16);
            expect(expiresAt2).toBeTruthy();

            // Verify links are different
            expect(linkId2).not.toBe(linkId1);
            expect(path2).not.toBe(path1);

            // Verify both links are valid and functional by joining with them
            await appDriver.joinGroupByLink(user2, linkId1);
            await appDriver.joinGroupByLink(user3, linkId2);

            // Verify both users successfully joined by checking group listing
            const { groups: groupsUser2 } = await appDriver.listGroups(user2);
            const { groups: groupsUser3 } = await appDriver.listGroups(user3);

            expect(groupsUser2.find((g) => g.id === groupId)).toBeTruthy();
            expect(groupsUser3.find((g) => g.id === groupId)).toBeTruthy();
        });

        it('should allow sharing a group and list membership balances for all users', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { shareablePath, linkId } = await appDriver.generateShareableLink(user1, groupId);
            expect(shareablePath).toBe(`/join?linkId=${linkId}`);
            expect(linkId).toHaveLength(16);

            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];
            const usdSplits = calculateEqualSplits(90, 'USD', participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Beach house deposit')
                    .withAmount(90, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(usdSplits)
                    .build(),
            );

            const listResponseUser1 = await appDriver.listGroups(user1);
            expect(listResponseUser1.count).toBe(1);
            expect(listResponseUser1.hasMore).toBe(false);
            expect(listResponseUser1.pagination.limit).toBeGreaterThan(0);

            const summaryForUser1 = listResponseUser1.groups.find((item) => item.id === groupId);
            expect(summaryForUser1).toBeDefined();
            expect(summaryForUser1!.balance?.balancesByCurrency?.USD?.netBalance).toBe('60.00');
            expect(summaryForUser1!.balance?.balancesByCurrency?.USD?.totalOwed).toBe('60.00');
            expect(summaryForUser1!.balance?.balancesByCurrency?.USD?.totalOwing).toBe('0.00');

            const listResponseUser2 = await appDriver.listGroups(user2);
            expect(listResponseUser2.count).toBe(1);
            expect(listResponseUser2.hasMore).toBe(false);

            const summaryForUser2 = listResponseUser2.groups.find((item) => item.id === groupId);
            expect(summaryForUser2).toBeDefined();
            expect(summaryForUser2!.balance?.balancesByCurrency?.USD?.netBalance).toBe('-30.00');
            expect(summaryForUser2!.balance?.balancesByCurrency?.USD?.totalOwed).toBe('0.00');
            expect(summaryForUser2!.balance?.balancesByCurrency?.USD?.totalOwing).toBe('30.00');

            const listResponseUser3 = await appDriver.listGroups(user3);
            expect(listResponseUser3.count).toBe(1);
            expect(listResponseUser3.hasMore).toBe(false);

            const summaryForUser3 = listResponseUser3.groups.find((item) => item.id === groupId);
            expect(summaryForUser3).toBeDefined();
            expect(summaryForUser3!.balance?.balancesByCurrency?.USD?.netBalance).toBe('-30.00');
            expect(summaryForUser3!.balance?.balancesByCurrency?.USD?.totalOwed).toBe('0.00');
            expect(summaryForUser3!.balance?.balancesByCurrency?.USD?.totalOwing).toBe('30.00');
        });

        it('should allow sequential settlements to clear shared expense balances', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            const firstExpenseSplits = calculateEqualSplits(120, 'USD', participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(120, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(firstExpenseSplits)
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.USD![user1].owedBy[user2]).toBe('60.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].netBalance).toBe('60.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].owes[user1]).toBe('60.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].netBalance).toBe('-60.00');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(10, 'USD')
                    .withCurrency('USD')
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.USD![user1].owedBy[user2]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].netBalance).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].owes[user1]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].netBalance).toBe('-50.00');
            expect(groupDetails.settlements.settlements).toHaveLength(1);
            expect(groupDetails.settlements.settlements[0].amount).toBe('10');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50, 'USD')
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.USD![user1].owedBy[user2]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].owes[user2]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].netBalance).toBe('0.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].owes[user1]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].owedBy[user1]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].netBalance).toBe('0.00');
            expect(groupDetails.settlements.settlements).toHaveLength(2);
            const settlementAmounts = groupDetails
                .settlements
                .settlements
                .map((settlement) => settlement.amount)
                .sort();
            expect(settlementAmounts).toEqual(['10', '50']);
        });

        it('should preserve expense metadata and remove it cleanly on deletion', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const metadataSplits = calculateEqualSplits(80, 'USD', participants);

            const metadataExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Hotel booking with receipt')
                    .withAmount(80, 'USD')
                    .withPaidBy(user1)
                    .withCategory('Travel')
                    .withDate('2024-06-15T12:30:00.000Z')
                    .withReceiptUrl('https://example.com/receipts/hotel.jpg')
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(metadataSplits)
                    .build(),
            );

            const secondarySplits = calculateEqualSplits(50, 'USD', participants);
            await appDriver.createExpense(
                user2,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Fuel stop')
                    .withAmount(50, 'USD')
                    .withPaidBy(user2)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(secondarySplits)
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.expenses.expenses).toHaveLength(2);
            const recordedMetadataExpense = groupDetails.expenses.expenses.find((expense) => expense.id === metadataExpense.id);
            expect(recordedMetadataExpense).toBeDefined();
            expect(recordedMetadataExpense!.description).toBe('Hotel booking with receipt');
            expect(recordedMetadataExpense!.category).toBe('Travel');
            expect(recordedMetadataExpense!.date).toBe('2024-06-15T12:30:00.000Z');
            expect(recordedMetadataExpense!.receiptUrl).toBe('https://example.com/receipts/hotel.jpg');
            expect(recordedMetadataExpense!.splits).toEqual(metadataSplits);

            await appDriver.deleteExpense(user1, metadataExpense.id);

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.expenses.expenses).toHaveLength(1);
            expect(groupDetails.expenses.expenses[0].description).toBe('Fuel stop');
            expect(groupDetails.expenses.expenses[0].splits).toEqual(secondarySplits);
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].owes[user2]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].netBalance).toBe('-25.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].owedBy[user1]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].netBalance).toBe('25.00');
        });

        it('should allow members to leave and rejoin via share link', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            let preview = await appDriver.previewGroupByLink(user2, linkId);
            expect(preview.isAlreadyMember).toBe(true);
            expect(preview.memberCount).toBe(2);

            await appDriver.leaveGroup(user2, groupId);

            preview = await appDriver.previewGroupByLink(user2, linkId);
            expect(preview.isAlreadyMember).toBe(false);
            expect(preview.memberCount).toBe(1);

            await appDriver.joinGroupByLink(user2, linkId);

            const user2Groups = await appDriver.listGroups(user2);
            expect(user2Groups.count).toBe(1);
            expect(user2Groups.groups[0].id).toBe(groupId);
        });

        it('should persist custom share link expiration timestamps', async () => {
            const group = await appDriver.createGroup(user1, new CreateGroupRequestBuilder().withName('Custom Expiry Group').build());
            const groupId = group.id;

            const customExpiration = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

            const shareLink = await appDriver.generateShareableLink(user1, groupId, customExpiration);

            expect(shareLink.expiresAt).toBe(customExpiration);

            const { db } = appDriver.getTestHarness();
            const shareLinksSnapshot = await db.collection('groups').doc(groupId).collection('shareLinks').get();
            const storedDoc = shareLinksSnapshot.docs.find((doc) => doc.data()?.token === shareLink.linkId);
            expect(storedDoc).toBeDefined();
            expect(storedDoc?.data()?.expiresAt).toBe(customExpiration);
        });

        it('should reject preview and join operations once a share link has expired', async () => {
            const group = await appDriver.createGroup(user1, new CreateGroupRequestBuilder().withName('Expiring Group').build());
            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);

            const { db } = appDriver.getTestHarness();
            const shareLinksSnapshot = await db.collection('groups').doc(groupId).collection('shareLinks').get();
            const storedDoc = shareLinksSnapshot.docs.find((doc) => doc.data()?.token === linkId);
            expect(storedDoc).toBeDefined();

            const expiredAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const shareLinkPath = `groups/${groupId}/shareLinks/${storedDoc!.id}`;
            db.seed(shareLinkPath, {
                ...storedDoc!.data(),
                expiresAt: expiredAt,
            });

            await expect(appDriver.previewGroupByLink(user2, linkId)).rejects.toMatchObject({ code: 'LINK_EXPIRED' });
            await expect(appDriver.joinGroupByLink(user2, linkId)).rejects.toMatchObject({ code: 'LINK_EXPIRED' });
        });

        it('should let members update their own group display name', async () => {
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Design Team')
                    .build(),
            );

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await appDriver.updateGroupMemberDisplayName(user2, groupId, 'UI Specialist');

            const detailsForOwner = await appDriver.getGroupFullDetails(user1, groupId);
            const updatedMember = detailsForOwner.members.members.find((member) => member.uid === user2);
            expect(updatedMember?.groupDisplayName).toBe('UI Specialist');

            const detailsForMember = await appDriver.getGroupFullDetails(user2, groupId);
            expect(detailsForMember.group.name).toBe('Design Team');
            const selfViewMember = detailsForMember.members.members.find((member) => member.uid === user2);
            expect(selfViewMember?.groupDisplayName).toBe('UI Specialist');
        });

        it('should handle group previews, updates, member management, and deletion', async () => {
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Adventure Squad')
                    .build(),
            );

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);

            const previewBeforeJoin = await appDriver.previewGroupByLink(user2, linkId);
            expect(previewBeforeJoin.groupId).toBe(groupId);
            expect(previewBeforeJoin.groupName).toBe('Adventure Squad');
            expect(previewBeforeJoin.memberCount).toBe(1);
            expect(previewBeforeJoin.isAlreadyMember).toBe(false);

            await appDriver.joinGroupByLink(user2, linkId);

            const previewAfterJoin = await appDriver.previewGroupByLink(user2, linkId);
            expect(previewAfterJoin.isAlreadyMember).toBe(true);
            expect(previewAfterJoin.memberCount).toBe(2);

            await appDriver.updateGroup(user1, groupId, {
                name: 'Adventure Squad+',
                description: 'Updated itinerary for the squad',
            });
            await appDriver.updateGroupMemberDisplayName(user1, groupId, 'Squad Leader');

            await appDriver.joinGroupByLink(user3, linkId);
            await appDriver.removeGroupMember(user1, groupId, user3);

            await appDriver.leaveGroup(user2, groupId);

            const updatedGroupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            expect(updatedGroupDetails.group.name).toBe('Adventure Squad+');
            expect(updatedGroupDetails.group.description).toBe('Updated itinerary for the squad');
            expect(updatedGroupDetails.members.members).toHaveLength(1);
            expect(updatedGroupDetails.members.members[0].uid).toBe(user1);
            expect(updatedGroupDetails.members.members[0].groupDisplayName).toBe('Squad Leader');

            const user1Groups = await appDriver.listGroups(user1);
            const updatedSummary = user1Groups.groups.find((item) => item.id === groupId);
            expect(updatedSummary?.name).toBe('Adventure Squad+');

            const user2Groups = await appDriver.listGroups(user2);
            expect(user2Groups.count).toBe(0);

            await appDriver.deleteGroup(user1, groupId);

            const user1GroupsAfterDelete = await appDriver.listGroups(user1);
            expect(user1GroupsAfterDelete.count).toBe(0);
        });

        it('should update settlements and reflect the new balances', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, 'USD', participants))
                    .build(),
            );

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(30.00, 'USD')
                    .withNote('Initial payment')
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const settlementId = groupDetails.settlements.settlements[0].id;
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].owedBy[user2]).toBe('20.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].owes[user1]).toBe('20.00');

            await appDriver.updateSettlement(user2, settlementId, {
                amount: '50.00',
                note: 'Adjusted amount',
            });

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].owedBy[user2]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].netBalance).toBe('0.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].owes[user1]).toBeUndefined();
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].netBalance).toBe('0.00');
            expect(groupDetails.settlements.settlements[0].amount).toBe('50.00');
            expect(groupDetails.settlements.settlements[0].note).toBe('Adjusted amount');
        });

        it('should create and list group/expense comments and fetch expense details', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const createdExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Lunch at cafe')
                    .withAmount(60, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(60, 'USD', participants))
                    .build(),
            );

            const groupCommentResponse = await appDriver.createGroupComment(user1, groupId, 'Welcome to the group!');
            expect(groupCommentResponse.text).toBe('Welcome to the group!');

            const secondGroupCommentResponse = await appDriver.createGroupComment(user2, groupId, 'Happy to be here');
            expect(secondGroupCommentResponse.authorId).toBe(user2);
            expect(secondGroupCommentResponse.text).toBe('Happy to be here');

            const groupComments = await appDriver.listGroupComments(user1, groupId);
            expect(groupComments.hasMore).toBe(false);
            expect(groupComments.comments).toHaveLength(2);
            const groupCommentTexts = groupComments.comments.map((comment) => comment.text);
            expect(groupCommentTexts).toEqual(expect.arrayContaining(['Welcome to the group!', 'Happy to be here']));

            const expenseCommentResponse = await appDriver.createExpenseComment(user2, createdExpense.id, 'Thanks for covering this');
            expect(expenseCommentResponse.authorId).toBe(user2);

            const secondExpenseComment = await appDriver.createExpenseComment(user1, createdExpense.id, 'Let us split next time');

            const expenseComments = await appDriver.listExpenseComments(user1, createdExpense.id);
            expect(expenseComments.hasMore).toBe(false);
            expect(expenseComments.comments).toHaveLength(2);
            const expenseCommentTexts = expenseComments.comments.map((comment) => comment.text);
            expect(expenseCommentTexts).toEqual(expect.arrayContaining(['Thanks for covering this', 'Let us split next time']));

            const expenseFullDetails = await appDriver.getExpenseFullDetails(user1, createdExpense.id);
            expect(expenseFullDetails.expense.id).toBe(createdExpense.id);
            expect(expenseFullDetails.expense.description).toBe('Lunch at cafe');
            expect(expenseFullDetails.group.id).toBe(groupId);
            expect(expenseFullDetails.members.members.some((member) => member.uid === user2)).toBe(true);
        });

        it('should revert balance change after settlement deletion', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            const createdExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, 'EUR')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, 'EUR', participants))
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].owedBy[user2]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].netBalance).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owes[user1]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].netBalance).toBe('-50.00');

            await appDriver.updateExpense(
                user1,
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(150.5, 'EUR')
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(150.5, 'EUR', participants))
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            const eurBalancesAfterUpdate = groupDetails.balances.balancesByCurrency?.EUR;
            expect(eurBalancesAfterUpdate).toBeDefined();
            expect(eurBalancesAfterUpdate![user1]).toBeDefined();
            expect(eurBalancesAfterUpdate![user1].owedBy[user2]).toBe('75.25');
            expect(eurBalancesAfterUpdate![user1].netBalance).toBe('75.25');
            expect(eurBalancesAfterUpdate![user2].owes[user1]).toBe('75.25');
            expect(eurBalancesAfterUpdate![user2].netBalance).toBe('-75.25');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50.25, 'EUR')
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const settlementId = groupDetails.settlements.settlements[0].id;

            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].owedBy[user2]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].netBalance).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owes[user1]).toBe('25.00');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].netBalance).toBe('-25.00');

            await appDriver.deleteSettlement(user1, settlementId);

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].owedBy[user2]).toBe('75.25');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user1].netBalance).toBe('75.25');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owes[user1]).toBe('75.25');
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].netBalance).toBe('-75.25');
        });
    });

    describe('edge cases', () => {
        it('should reject expense creation when splits total does not match amount', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const baseExpense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(100, 'USD')
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('exact')
                .withSplits(calculateEqualSplits(100, 'USD', participants))
                .build();

            const invalidExpense = {
                ...baseExpense,
                splits: [
                    { ...baseExpense.splits[0], amount: '80.00' },
                    { ...baseExpense.splits[1], amount: '30.00' },
                ],
            };

            await expect(appDriver.createExpense(user1, invalidExpense))
                .rejects
                .toMatchObject({ code: 'INVALID_SPLIT_TOTAL' });
        });

        it('should reject expense creation with invalid currency precision', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const baseExpense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(12, 'JPY')
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('exact')
                .withSplits(calculateEqualSplits(12, 'JPY', participants))
                .build();

            const invalidExpense = {
                ...baseExpense,
                amount: '12.34',
                splits: baseExpense.splits.map((split) => ({
                    ...split,
                    amount: '6.17',
                })),
            };

            await expect(appDriver.createExpense(user1, invalidExpense))
                .rejects
                .toMatchObject({ code: 'INVALID_AMOUNT_PRECISION' });
        });

        it('should prevent non-owners from deleting a group', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.deleteGroup(user2, groupId))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject group comment creation with empty text', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.createGroupComment(user1, groupId, ''))
                .rejects
                .toMatchObject({ code: 'INVALID_COMMENT_TEXT' });
        });

        it('should allow expense full details access for non-participants', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user4, linkId); // user4 is group member but not expense participant

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Confidential dinner')
                    .withAmount(50, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(50, 'USD', participants))
                    .build(),
            );

            // user4 is a group member but NOT an expense participant - should still access
            const fullDetails = await appDriver.getExpenseFullDetails(user4, expense.id);
            expect(fullDetails.expense.id).toBe(expense.id);
            expect(fullDetails.expense.participants).toEqual(participants);
        });

        it('should reject share link previews with invalid tokens', async () => {
            await expect(appDriver.previewGroupByLink(user1, 'invalid-token-123'))
                .rejects
                .toMatchObject({ code: 'INVALID_LINK' });
        });

        it('should forbid expense creation by non-group members', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(40, 'USD')
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(40, 'USD', participants))
                .build();

            await expect(appDriver.createExpense(user3, expenseRequest))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject group updates without any fields', async () => {
            const group = await appDriver.createGroup(user1);

            await expect(appDriver.updateGroup(user1, group.id, {} as any))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject settlement updates with invalid amount precision', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(120, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(120, 'USD', participants))
                    .build(),
            );

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(60.00, 'USD')
                    .build(),
            );

            const details = await appDriver.getGroupFullDetails(user1, groupId);
            const settlementId = details.settlements.settlements[0].id;

            await expect(appDriver.updateSettlement(user2, settlementId, {
                amount: '20.123',
                currency: 'USD',
            }))
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject removing a member by a non-owner', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            await expect(appDriver.removeGroupMember(user2, groupId, user3))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject expense comment creation with empty text', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(30, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(30, 'USD', participants))
                    .build(),
            );

            await expect(appDriver.createExpenseComment(user1, expense.id, ''))
                .rejects
                .toMatchObject({ code: 'INVALID_COMMENT_TEXT' });
        });

        it('should sanitize comment text containing scripts', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const response = await appDriver.createGroupComment(user1, groupId, '<script>alert(1)</script>Hello');
            expect(response.text).toBe('Hello');

            const comments = await appDriver.listGroupComments(user1, groupId);
            expect(comments.comments[0].text).toBe('Hello');
        });

        it('should reject expense creation with invalid receipt URL', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Invalid receipt URL')
                .withAmount(40, 'USD')
                .withPaidBy(user1)
                .withReceiptUrl('not-a-url')
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(40, 'USD', participants))
                .build();

            await expect(appDriver.createExpense(user1, expense))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject expense updates when participants include non-members', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const baseExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Original expense')
                    .withAmount(60, 'USD')
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(60, 'USD', [user1, user2]))
                    .build(),
            );

            const updatedParticipants = [user1, user2, user4];
            const updatedSplits = calculateEqualSplits(90, 'USD', updatedParticipants);

            await expect(appDriver.updateExpense(
                user1,
                baseExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(90, 'USD')
                    .withParticipants(updatedParticipants)
                    .withSplits(updatedSplits)
                    .withSplitType('equal')
                    .build(),
            ))
                .rejects
                .toMatchObject({ code: 'INVALID_PARTICIPANT' });
        });

        it('should reject settlement updates by non-creators', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(80, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(80, 'USD', participants))
                    .build(),
            );

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(40.00, 'USD')
                    .build(),
            );

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const settlementId = groupDetails.settlements.settlements[0].id;

            await expect(appDriver.updateSettlement(user1, settlementId, {
                amount: '45.00',
            }))
                .rejects
                .toMatchObject({ code: 'NOT_SETTLEMENT_CREATOR' });
        });

        it('should reject group member display name updates with empty value', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.updateGroupMemberDisplayName(user2, groupId, ''))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject settlements involving non-members', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const settlement = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(user4)
                .withPayeeId(user1)
                .withAmount(20.00, 'USD')
                .build();

            await expect(appDriver.createSettlement(user1, settlement))
                .rejects
                .toMatchObject({ code: 'MEMBER_NOT_IN_GROUP' });
        });

        it('should sanitize expense comment text containing scripts', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(50, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(50, 'USD', participants))
                    .build(),
            );

            const response = await appDriver.createExpenseComment(user1, expense.id, '<script>alert(1)</script>Thanks');
            expect(response.text).toBe('Thanks');

            const comments = await appDriver.listExpenseComments(user1, expense.id);
            expect(comments.comments[0].text).toBe('Thanks');
        });

        it('should reject share link generation by non-members', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;

            await expect(appDriver.generateShareableLink(user2, groupId))
                .rejects
                .toMatchObject({ code: 'UNAUTHORIZED' });
        });

        it('should handle JavaScript floating point precision bugs (0.1 + 0.2 != 0.3)', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const CURRENCY = 'USD';

            const testCase1Splits = calculateEqualSplits('0.10', CURRENCY, participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(0.10, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(testCase1Splits)
                    .build(),
            );

            const testCase2Splits = calculateEqualSplits('0.20', CURRENCY, participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(0.20, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(testCase2Splits)
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            let usdBalances = groupDetails.balances.balancesByCurrency?.USD;

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, 'after 0.10 + 0.20');

            const expectedAfterTwoExpenses = amountToSmallestUnit('0.30', CURRENCY);
            const actualUser1NetAfterTwo = amountToSmallestUnit(usdBalances![user1].netBalance, CURRENCY);
            expect(actualUser1NetAfterTwo, 'After 0.10 + 0.20, user1 net should be exactly 15 cents (not 15.000000000000002)').toBe(expectedAfterTwoExpenses / 2);

            const testCase3Splits = calculateEqualSplits('0.70', CURRENCY, participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(0.70, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(testCase3Splits)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            usdBalances = groupDetails.balances.balancesByCurrency?.USD;

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, 'after 0.10 + 0.20 + 0.70');

            const expectedAfterThreeExpenses = amountToSmallestUnit('1.00', CURRENCY);
            const actualUser1NetAfterThree = amountToSmallestUnit(usdBalances![user1].netBalance, CURRENCY);
            expect(actualUser1NetAfterThree, 'After 0.10 + 0.20 + 0.70 = 1.00, user1 net should be exactly 50 cents (not 49.99999999999999)').toBe(expectedAfterThreeExpenses / 2);

            for (let i = 0; i < 100; i++) {
                const splits = calculateEqualSplits('0.10', CURRENCY, participants);
                await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(0.10, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );
            }

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            usdBalances = groupDetails.balances.balancesByCurrency?.USD;

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
            const CURRENCY = 'USD';

            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            for (let i = 0; i < NUM_OPERATIONS; i++) {
                const splits = calculateEqualSplits(SMALL_AMOUNT, CURRENCY, participants);
                await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(SMALL_AMOUNT, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId, {
                expenseLimit: NUM_OPERATIONS,
            });
            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

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
            const LARGE_AMOUNT = 1234567.88;
            const CURRENCY = 'USD';

            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const splits = calculateEqualSplits(LARGE_AMOUNT, CURRENCY, participants);

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(LARGE_AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
            );

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, 'large amount expense');

            expect(usdBalances![user1].owedBy[user2]).toBe(amountFor(splits, user2));
            expect(usdBalances![user2].owes[user1]).toBe(amountFor(splits, user2));
            expect(usdBalances![user1].netBalance).toBe(netBalanceForPayer(splits, user1, CURRENCY));
        });

        it('should achieve exactly zero balance through multiple partial settlements', async () => {
            const EXPENSE_AMOUNT = 100;
            const FIRST_SETTLEMENT = '10.00';
            const SECOND_SETTLEMENT = '15.00';
            const THIRD_SETTLEMENT = '12.50';
            const FOURTH_SETTLEMENT = '12.50';
            const CURRENCY = 'EUR';

            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(EXPENSE_AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(EXPENSE_AMOUNT, CURRENCY, participants))
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owes[user1]).toBe('50.00');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(FIRST_SETTLEMENT, CURRENCY)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owes[user1]).toBe('40.00');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(SECOND_SETTLEMENT, CURRENCY)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            expect(groupDetails.balances.balancesByCurrency!.EUR![user2].owes[user1]).toBe('25.00');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(THIRD_SETTLEMENT, CURRENCY)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            let eurBalances = groupDetails.balances.balancesByCurrency?.EUR;
            expect(eurBalances![user2].owes[user1]).toBe('12.50');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(FOURTH_SETTLEMENT, CURRENCY)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            eurBalances = groupDetails.balances.balancesByCurrency?.EUR;

            expect(eurBalances).toBeDefined();
            expect(eurBalances![user1].netBalance).toBe('0.00');
            expect(eurBalances![user2].netBalance).toBe('0.00');
            expect(eurBalances![user1].owedBy[user2]).toBeUndefined();
            expect(eurBalances![user2].owes[user1]).toBeUndefined();

            verifyBalanceConsistency(eurBalances!, CURRENCY, 'complete settlement through multiple payments');
        });

        it('should correctly calculate circular debt balances', async () => {
            const CIRCULAR_AMOUNT = 90;
            const CURRENCY = 'USD';

            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(CIRCULAR_AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(CIRCULAR_AMOUNT, CURRENCY, [user1, user2]))
                    .build(),
            );

            await appDriver.createExpense(
                user2,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(CIRCULAR_AMOUNT, CURRENCY)
                    .withPaidBy(user2)
                    .withParticipants([user2, user3])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(CIRCULAR_AMOUNT, CURRENCY, [user2, user3]))
                    .build(),
            );

            await appDriver.createExpense(
                user3,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(CIRCULAR_AMOUNT, CURRENCY)
                    .withPaidBy(user3)
                    .withParticipants([user3, user1])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(CIRCULAR_AMOUNT, CURRENCY, [user3, user1]))
                    .build(),
            );

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

            expect(usdBalances).toBeDefined();

            expect(usdBalances![user1].netBalance).toBe('0.00');
            expect(usdBalances![user2].netBalance).toBe('0.00');
            expect(usdBalances![user3].netBalance).toBe('0.00');

            verifyBalanceConsistency(usdBalances!, CURRENCY, 'circular debt scenario');
        });

        it('should maintain balance consistency through complex multi-currency operations', async () => {
            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            const usdExpense1Splits = calculateEqualSplits(150, 'USD', participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(150, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(usdExpense1Splits)
                    .build(),
            );

            const eurExpense1Splits = calculateEqualSplits(200, 'EUR', participants);
            await appDriver.createExpense(
                user2,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(200, 'EUR')
                    .withPaidBy(user2)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(eurExpense1Splits)
                    .build(),
            );

            const gbpExpense1Splits = calculateEqualSplits(75.50, 'GBP', participants);
            await appDriver.createExpense(
                user3,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(75.50, 'GBP')
                    .withPaidBy(user3)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(gbpExpense1Splits)
                    .build(),
            );

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50.00, 'USD')
                    .build(),
            );

            await appDriver.createSettlement(
                user3,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user3)
                    .withPayeeId(user2)
                    .withAmount(66.67, 'EUR')
                    .build(),
            );

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;
            const eurBalances = groupDetails.balances.balancesByCurrency?.EUR;
            const gbpBalances = groupDetails.balances.balancesByCurrency?.GBP;

            expect(usdBalances).toBeDefined();
            expect(eurBalances).toBeDefined();
            expect(gbpBalances).toBeDefined();

            verifyBalanceConsistency(usdBalances!, 'USD', 'USD after settlements');
            verifyBalanceConsistency(eurBalances!, 'EUR', 'EUR after settlements');
            verifyBalanceConsistency(gbpBalances!, 'GBP', 'GBP without settlements');

            expect(groupDetails.expenses.expenses).toHaveLength(3);
            expect(groupDetails.settlements.settlements).toHaveLength(2);
        });

        it('should maintain balance consistency through many expense operations', async () => {
            const OPERATIONS_COUNT = 20;

            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];
            const payers = [user1, user2, user3];

            for (let i = 0; i < OPERATIONS_COUNT; i++) {
                const amount = (i + 1) * 10;
                const payer = payers[i % payers.length];
                const splits = calculateEqualSplits(amount, 'USD', participants);

                await appDriver.createExpense(
                    payer,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(amount, 'USD')
                        .withPaidBy(payer)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId, {
                expenseLimit: OPERATIONS_COUNT,
            });
            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, 'USD', 'many expense operations');

            expect(groupDetails.expenses.expenses).toHaveLength(OPERATIONS_COUNT);
        });

        it('should maintain zero-sum balance with indivisible JPY amounts', async () => {
            // 100 JPY ÷ 3 = 33 + 33 + 34 (1 yen remainder)
            const group = await appDriver.createGroup(user1);

            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];
            const splits = calculateEqualSplits(100, 'JPY', participants, 2);

            expect(splits[0].amount).toBe('33');
            expect(splits[1].amount).toBe('33');
            expect(splits[2].amount).toBe('34'); // Gets 1 yen remainder

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'JPY')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(splits)
                    .build(),
            );

            const groupDetails = await appDriver.getGroupFullDetails(user1, group.id);
            const jpyBalances = groupDetails.balances.balancesByCurrency?.JPY;

            expect(jpyBalances, 'JPY balances should exist').toBeDefined();
            verifyBalanceConsistency(jpyBalances!, 'JPY', 'indivisible JPY split');

            // User1 paid 100, owes themselves 33 = net +67
            expect(jpyBalances![user1].netBalance).toBe('67');
            // User2 paid 0, owes 33 = net -33
            expect(jpyBalances![user2].netBalance).toBe('-33');
            // User3 paid 0, owes 34 = net -34
            expect(jpyBalances![user3].netBalance).toBe('-34');
        });

        it('should maintain precision when converting between split types', async () => {
            const AMOUNT = 100;
            const CURRENCY = 'EUR';

            const group = await appDriver.createGroup(user1);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            const equalSplits = calculateEqualSplits(AMOUNT, CURRENCY, participants, 0);
            const createdExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(AMOUNT, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(equalSplits)
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            let eurBalances = groupDetails.balances.balancesByCurrency?.EUR;

            expect(eurBalances).toBeDefined();
            verifyBalanceConsistency(eurBalances!, CURRENCY, 'after equal split');

            const balanceAfterEqual = amountToSmallestUnit(eurBalances![user1].netBalance, CURRENCY);

            const percentageSplits = calculatePercentageSplits(AMOUNT, CURRENCY, participants, 0);
            await appDriver.updateExpense(
                user1,
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(AMOUNT, CURRENCY)
                    .withParticipants(participants)
                    .withSplitType('percentage')
                    .withSplits(percentageSplits)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            eurBalances = groupDetails.balances.balancesByCurrency?.EUR;

            expect(eurBalances).toBeDefined();
            verifyBalanceConsistency(eurBalances!, CURRENCY, 'after equal → percentage conversion');

            const balanceAfterPercentage = amountToSmallestUnit(eurBalances![user1].netBalance, CURRENCY);
            expect(balanceAfterPercentage, 'Balance after equal → percentage conversion should be exactly the same (zero-tolerance)').toBe(balanceAfterEqual);

            const exactSplits = percentageSplits.map(split => ({
                uid: split.uid,
                amount: split.amount,
            }));
            await appDriver.updateExpense(
                user1,
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(AMOUNT, CURRENCY)
                    .withParticipants(participants)
                    .withSplitType('exact')
                    .withSplits(exactSplits)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            eurBalances = groupDetails.balances.balancesByCurrency?.EUR;

            expect(eurBalances).toBeDefined();
            verifyBalanceConsistency(eurBalances!, CURRENCY, 'after percentage → exact conversion');

            const balanceAfterExact = amountToSmallestUnit(eurBalances![user1].netBalance, CURRENCY);
            expect(balanceAfterExact, 'Balance after percentage → exact conversion should be exactly the same (zero-tolerance)').toBe(balanceAfterPercentage);

            const finalEqualSplits = calculateEqualSplits(AMOUNT, CURRENCY, participants, 0);
            await appDriver.updateExpense(
                user1,
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(AMOUNT, CURRENCY)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(finalEqualSplits)
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            eurBalances = groupDetails.balances.balancesByCurrency?.EUR;

            expect(eurBalances).toBeDefined();
            verifyBalanceConsistency(eurBalances!, CURRENCY, 'after exact → equal conversion');

            const balanceAfterFinalEqual = amountToSmallestUnit(eurBalances![user1].netBalance, CURRENCY);
            expect(balanceAfterFinalEqual, 'Balance after exact → equal conversion should match original equal split (zero-tolerance round-trip)').toBe(balanceAfterEqual);
        });

        it('should prevent removal of member with outstanding balance', async () => {
            const CURRENCY = 'USD';

            const group = await appDriver.createGroup(user1);
            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(150, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(150, CURRENCY, participants))
                    .build(),
            );

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

            expect(usdBalances).toBeDefined();
            expect(usdBalances![user3].netBalance).not.toBe('0.00');

            await expect(appDriver.removeGroupMember(user1, groupId, user3))
                .rejects
                .toMatchObject({
                    code: 'INVALID_INPUT',
                    details: { message: 'Cannot remove member with outstanding balance' },
                });
        });

        it('should allow removal of member with zero balance', async () => {
            const CURRENCY = 'EUR';

            const group = await appDriver.createGroup(user1);
            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, CURRENCY)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, CURRENCY, [user1, user2]))
                    .build(),
            );

            let groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const eurBalances = groupDetails.balances.balancesByCurrency?.EUR;

            expect(eurBalances).toBeDefined();
            expect(eurBalances![user3].netBalance).toBe('0.00');

            await appDriver.removeGroupMember(user1, groupId, user3);

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const members = groupDetails.members.members;

            expect(members).toHaveLength(2);
            expect(members.find(m => m.uid === user3)).toBeUndefined();
        });

        describe('archive group functionality', () => {
            it('should archive and unarchive a group membership', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                // Verify user2 can see the group initially
                let groups = await appDriver.listGroups(user2);
                expect(groups.groups).toHaveLength(1);
                expect(groups.groups[0].id).toBe(groupId);

                // Archive the group
                const archiveResult = await appDriver.archiveGroupForUser(user2, groupId);
                expect(archiveResult.message).toBe('Group archived successfully');

                // Verify group no longer appears in default list
                groups = await appDriver.listGroups(user2);
                expect(groups.groups).toHaveLength(0);

                // Archived filter should return the group
                const archivedGroups = await appDriver.listGroups(user2, { statusFilter: 'archived' });
                expect(archivedGroups.groups).toHaveLength(1);
                expect(archivedGroups.groups[0].id).toBe(groupId);

                // Unarchive the group
                const unarchiveResult = await appDriver.unarchiveGroupForUser(user2, groupId);
                expect(unarchiveResult.message).toBe('Group unarchived successfully');

                // Verify group appears again
                groups = await appDriver.listGroups(user2);
                expect(groups.groups).toHaveLength(1);
                expect(groups.groups[0].id).toBe(groupId);

                const archivedGroupsAfterUnarchive = await appDriver.listGroups(user2, { statusFilter: 'archived' });
                expect(archivedGroupsAfterUnarchive.groups).toHaveLength(0);
            });

            it('should reject archiving a non-existent membership', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                // user2 is not a member
                await expect(appDriver.archiveGroupForUser(user2, groupId))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject archiving a non-active membership', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                // Archive first time
                await appDriver.archiveGroupForUser(user2, groupId);

                // Try to archive again - should fail
                await expect(appDriver.archiveGroupForUser(user2, groupId))
                    .rejects
                    .toMatchObject({ code: 'INVALID_INPUT' });
            });

            it('should reject unarchiving a non-archived membership', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                // Try to unarchive an active membership
                await expect(appDriver.unarchiveGroupForUser(user2, groupId))
                    .rejects
                    .toMatchObject({ code: 'INVALID_INPUT' });
            });

            it('should allow multiple archive/unarchive cycles', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                // Archive
                await appDriver.archiveGroupForUser(user2, groupId);
                let groups = await appDriver.listGroups(user2);
                expect(groups.groups).toHaveLength(0);

                // Unarchive
                await appDriver.unarchiveGroupForUser(user2, groupId);
                groups = await appDriver.listGroups(user2);
                expect(groups.groups).toHaveLength(1);

                // Archive again
                await appDriver.archiveGroupForUser(user2, groupId);
                groups = await appDriver.listGroups(user2);
                expect(groups.groups).toHaveLength(0);
            });

            it('should keep archived group accessible to other members', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);
                await appDriver.joinGroupByLink(user3, linkId);

                // user2 archives the group
                await appDriver.archiveGroupForUser(user2, groupId);

                // user1 and user3 should still see the group
                const user1Groups = await appDriver.listGroups(user1);
                expect(user1Groups.groups).toHaveLength(1);

                const user3Groups = await appDriver.listGroups(user3);
                expect(user3Groups.groups).toHaveLength(1);

                // user2 should not see it
                const user2Groups = await appDriver.listGroups(user2);
                expect(user2Groups.groups).toHaveLength(0);
            });
        });

        describe('split validation', () => {
            it('should reject percentage splits not totaling 100%', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;
                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);
                await appDriver.joinGroupByLink(user3, linkId);

                const participants = [user1, user2, user3];
                const invalidPercentageSplits = [
                    { uid: user1, amount: '40.00', percentage: 40 },
                    { uid: user2, amount: '40.00', percentage: 40 },
                    { uid: user3, amount: '19.00', percentage: 19 },
                ];

                const expenseRequest = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('percentage')
                    .withSplits(invalidPercentageSplits)
                    .build();

                await expect(appDriver.createExpense(user1, expenseRequest))
                    .rejects
                    .toMatchObject({ code: 'INVALID_PERCENTAGE_TOTAL' });
            });

            it('should reject negative percentage in splits', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;
                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                const participants = [user1, user2];
                const invalidPercentageSplits = [
                    { uid: user1, amount: '120.00', percentage: 120 },
                    { uid: user2, amount: '-20.00', percentage: -20 },
                ];

                const expenseRequest = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('percentage')
                    .withSplits(invalidPercentageSplits)
                    .build();

                await expect(appDriver.createExpense(user1, expenseRequest))
                    .rejects
                    .toMatchObject({ code: 'INVALID_INPUT' });
            });

            it('should reject expense where payer is not a participant', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;
                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);
                await appDriver.joinGroupByLink(user3, linkId);

                const participants = [user1, user2];
                const expenseRequest = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100, 'USD')
                    .withPaidBy(user3)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, 'USD', participants))
                    .build();

                await expect(appDriver.createExpense(user1, expenseRequest))
                    .rejects
                    .toMatchObject({ code: 'PAYER_NOT_PARTICIPANT' });
            });

            it('should handle equal split with single participant', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const singleParticipant = [user1];
                const splits = calculateEqualSplits(100, 'USD', singleParticipant);

                const expense = await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(100, 'USD')
                        .withPaidBy(user1)
                        .withParticipants(singleParticipant)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );

                expect(expense.id).toBeDefined();

                const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
                const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

                expect(usdBalances).toBeDefined();
                expect(usdBalances![user1].netBalance).toBe('0.00');
                expect(usdBalances![user1].owedBy).toEqual({});
                expect(usdBalances![user1].owes).toEqual({});
            });
        });

        describe('boundary and limit testing', () => {
            it('should handle very large expense amounts', async () => {
                const LARGE_AMOUNT = 9999999.99;
                const CURRENCY = 'USD';

                const group = await appDriver.createGroup(user1);
                const groupId = group.id;
                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                const participants = [user1, user2];
                const splits = calculateEqualSplits(LARGE_AMOUNT, CURRENCY, participants);

                const expense = await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(LARGE_AMOUNT, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );

                expect(expense.amount).toBe(String(LARGE_AMOUNT));

                const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
                const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

                expect(usdBalances).toBeDefined();
                verifyBalanceConsistency(usdBalances!, CURRENCY, 'very large amount');
            });

            it('should handle minimum valid amounts', async () => {
                const MIN_AMOUNT = 0.02;
                const CURRENCY = 'USD';

                const group = await appDriver.createGroup(user1);
                const groupId = group.id;
                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                const participants = [user1, user2];
                const splits = calculateEqualSplits(MIN_AMOUNT, CURRENCY, participants);

                const expense = await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(MIN_AMOUNT, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );

                expect(expense.amount).toBe(String(MIN_AMOUNT));

                const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
                const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

                expect(usdBalances).toBeDefined();
                verifyBalanceConsistency(usdBalances!, CURRENCY, 'minimum valid amount');
            });

            it('should enforce maximum length on group description', async () => {
                const longDescription = 'x'.repeat(10000);

                await expect(
                    appDriver.createGroup(
                        user1,
                        new CreateGroupRequestBuilder()
                            .withName('Test Group')
                            .withDescription(longDescription)
                            .build(),
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_INPUT' });
            });

            it('should enforce maximum length on expense description', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const longDescription = 'x'.repeat(10000);
                const participants = [user1];

                await expect(
                    appDriver.createExpense(
                        user1,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(groupId)
                            .withDescription(longDescription)
                            .withAmount(100, 'USD')
                            .withPaidBy(user1)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .withSplits(calculateEqualSplits(100, 'USD', participants))
                            .build(),
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_DESCRIPTION' });
            });

            it('should handle expense with many participants', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;
                const { linkId } = await appDriver.generateShareableLink(user1, groupId);

                // Join initial users to the group
                await appDriver.joinGroupByLink(user2, linkId);
                await appDriver.joinGroupByLink(user3, linkId);
                await appDriver.joinGroupByLink(user4, linkId);

                const manyUsers = [user1, user2, user3, user4];
                for (let i = 5; i <= 20; i++) {
                    const userId = `user-${i}`;
                    appDriver.seedUser(userId, { displayName: `User ${i}` });
                    await appDriver.joinGroupByLink(userId, linkId);
                    manyUsers.push(userId);
                }

                const AMOUNT = 1000;
                const CURRENCY = 'USD';
                const splits = calculateEqualSplits(AMOUNT, CURRENCY, manyUsers);

                const expense = await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(AMOUNT, CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(manyUsers)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );

                expect(expense.id).toBeDefined();

                const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
                const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

                expect(usdBalances).toBeDefined();
                verifyBalanceConsistency(usdBalances!, CURRENCY, 'many participants');
                expect(Object.keys(usdBalances!)).toHaveLength(20);
            });
        });

        describe('data consistency and integrity', () => {
            it('should reject operations on deleted group', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                await appDriver.deleteGroup(user1, groupId);

                const participants = [user1];
                await expect(
                    appDriver.createExpense(
                        user1,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(groupId)
                            .withAmount(100, 'USD')
                            .withPaidBy(user1)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .withSplits(calculateEqualSplits(100, 'USD', participants))
                            .build(),
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject malformed group ID', async () => {
                await expect(appDriver.getGroupFullDetails(user1, 'not-a-valid-id'))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject malformed expense ID', async () => {
                await expect(appDriver.getExpenseFullDetails(user1, 'not-a-valid-id'))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject operations on non-existent expense', async () => {
                await appDriver.createGroup(user1);

                const nonExistentExpenseId = 'expense-does-not-exist';

                await expect(appDriver.deleteExpense(user1, nonExistentExpenseId))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });

            it('should reject creating expense with zero amount', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const participants = [user1];
                await expect(
                    appDriver.createExpense(
                        user1,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(groupId)
                            .withAmount(0, 'USD')
                            .withPaidBy(user1)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .withSplits([{ uid: user1, amount: '0.00' }])
                            .build(),
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_AMOUNT' });
            });

            it('should reject creating expense with negative amount', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;

                const participants = [user1];
                await expect(
                    appDriver.createExpense(
                        user1,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(groupId)
                            .withAmount(-100, 'USD')
                            .withPaidBy(user1)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .withSplits([{ uid: user1, amount: '-100.00' }])
                            .build(),
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_AMOUNT' });
            });

            it('should reject settlement with zero amount', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;
                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                const participants = [user1, user2];
                await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(100, 'USD')
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(100, 'USD', participants))
                        .build(),
                );

                await expect(
                    appDriver.createSettlement(
                        user2,
                        new CreateSettlementRequestBuilder()
                            .withGroupId(groupId)
                            .withPayerId(user2)
                            .withPayeeId(user1)
                            .withAmount(0.00, 'USD')
                            .build(),
                    ),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject settlement with negative amount', async () => {
                const group = await appDriver.createGroup(user1);
                const groupId = group.id;
                const { linkId } = await appDriver.generateShareableLink(user1, groupId);
                await appDriver.joinGroupByLink(user2, linkId);

                const participants = [user1, user2];
                await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(100, 'USD')
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(100, 'USD', participants))
                        .build(),
                );

                await expect(
                    appDriver.createSettlement(
                        user2,
                        new CreateSettlementRequestBuilder()
                            .withGroupId(groupId)
                            .withPayerId(user2)
                            .withPayeeId(user1)
                            .withAmount('-25.00', 'USD')
                            .build(),
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
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                const result = await appDriver.acceptMultiplePolicies(user1, [
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ]);

                expect(result.success).toBe(true);
                expect(result.acceptedPolicies).toHaveLength(1);
                expect(result.acceptedPolicies[0].policyId).toBe(policy1.id);
                expect(result.acceptedPolicies[0].versionHash).toBe(policy1.versionHash);
                expect(result.acceptedPolicies[0].acceptedAt).toBeDefined();
            });

            it('should accept multiple policies at once', async () => {
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                const policy2 = await appDriver.createPolicy(user1, {
                    policyName: 'privacy',
                    text: 'Privacy Policy v1',
                });

                const policy3 = await appDriver.createPolicy(user1, {
                    policyName: 'cookies',
                    text: 'Cookie Policy v1',
                });

                const result = await appDriver.acceptMultiplePolicies(user1, [
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                    { policyId: policy2.id, versionHash: policy2.versionHash },
                    { policyId: policy3.id, versionHash: policy3.versionHash },
                ]);

                expect(result.success).toBe(true);
                expect(result.acceptedPolicies).toHaveLength(3);
                expect(result.acceptedPolicies[0].policyId).toBe(policy1.id);
                expect(result.acceptedPolicies[1].policyId).toBe(policy2.id);
                expect(result.acceptedPolicies[2].policyId).toBe(policy3.id);
            });

            it('should persist policy acceptance in user document', async () => {
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                await appDriver.acceptMultiplePolicies(user2, [
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ]);

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status.policies).toHaveLength(1);
                expect(status.policies[0].userAcceptedHash).toBe(policy1.versionHash);
                expect(status.policies[0].needsAcceptance).toBe(false);
            });
        });

        describe('acceptMultiplePolicies - validation and errors', () => {
            it('should reject empty acceptances array', async () => {
                await expect(appDriver.acceptMultiplePolicies(user1, []))
                    .rejects
                    .toMatchObject({ code: 'INVALID_ACCEPTANCES' });
            });

            it('should reject when policyId is missing', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies(user1, [
                        { policyId: '', versionHash: 'some-hash' },
                    ]),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_ACCEPTANCES' });
            });

            it('should reject when versionHash is missing', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies(user1, [
                        { policyId: 'some-policy', versionHash: '' },
                    ]),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_ACCEPTANCES' });
            });

            it('should reject when policy does not exist', async () => {
                await expect(
                    appDriver.acceptMultiplePolicies(user1, [
                        { policyId: 'non-existent-policy', versionHash: 'some-hash' },
                    ]),
                )
                    .rejects
                    .toMatchObject({ code: 'POLICY_NOT_FOUND' });
            });

            it('should reject when version hash is invalid for existing policy', async () => {
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                await expect(
                    appDriver.acceptMultiplePolicies(user1, [
                        { policyId: policy1.id, versionHash: 'invalid-version-hash' },
                    ]),
                )
                    .rejects
                    .toMatchObject({ code: 'INVALID_VERSION_HASH' });
            });

            it('should reject entire batch if any policy is invalid', async () => {
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                await expect(
                    appDriver.acceptMultiplePolicies(user1, [
                        { policyId: policy1.id, versionHash: policy1.versionHash },
                        { policyId: 'non-existent', versionHash: 'some-hash' },
                    ]),
                )
                    .rejects
                    .toMatchObject({ code: 'POLICY_NOT_FOUND' });

                const status = await appDriver.getUserPolicyStatus(user1);
                expect(status.policies[0].userAcceptedHash).toBeUndefined();
            });
        });

        describe('getUserPolicyStatus - happy path', () => {
            it('should show all policies as pending when user has not accepted any', async () => {
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                const policy2 = await appDriver.createPolicy(user1, {
                    policyName: 'privacy',
                    text: 'Privacy Policy v1',
                });

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
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                const policy2 = await appDriver.createPolicy(user1, {
                    policyName: 'privacy',
                    text: 'Privacy Policy v1',
                });

                await appDriver.acceptMultiplePolicies(user2, [
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                    { policyId: policy2.id, versionHash: policy2.versionHash },
                ]);

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
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                await appDriver.acceptMultiplePolicies(user2, [
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ]);

                const oldVersionHash = policy1.versionHash;

                const updatedPolicy = await appDriver.updatePolicy(user1, policy1.id, {
                    text: 'Terms of Service v2 - updated',
                    publish: true,
                });

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
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                const policy2 = await appDriver.createPolicy(user1, {
                    policyName: 'privacy',
                    text: 'Privacy Policy v1',
                });

                const policy3 = await appDriver.createPolicy(user1, {
                    policyName: 'cookies',
                    text: 'Cookie Policy v1',
                });

                await appDriver.acceptMultiplePolicies(user2, [
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                    { policyId: policy2.id, versionHash: policy2.versionHash },
                ]);

                await appDriver.updatePolicy(user1, policy1.id, {
                    text: 'Terms of Service v2',
                    publish: true,
                });

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
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                const status = await appDriver.getUserPolicyStatus(user2);

                expect(status).toHaveProperty('needsAcceptance');
                expect(status).toHaveProperty('policies');
                expect(status).toHaveProperty('totalPending');

                expect(typeof status.needsAcceptance).toBe('boolean');
                expect(Array.isArray(status.policies)).toBe(true);
                expect(typeof status.totalPending).toBe('number');
            });

            it('should include all required fields in each policy', async () => {
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                await appDriver.acceptMultiplePolicies(user2, [
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ]);

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
                const policy1 = await appDriver.createPolicy(user1, {
                    policyName: 'terms',
                    text: 'Terms of Service v1',
                });

                const policy2 = await appDriver.createPolicy(user1, {
                    policyName: 'privacy',
                    text: 'Privacy Policy v1',
                });

                const policy3 = await appDriver.createPolicy(user1, {
                    policyName: 'cookies',
                    text: 'Cookie Policy v1',
                });

                await appDriver.acceptMultiplePolicies(user2, [
                    { policyId: policy1.id, versionHash: policy1.versionHash },
                ]);

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
            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, 'USD', [user1, user2]))
                    .build(),
            );

            await appDriver.expectNotificationUpdate(user1, group.id, {
                transactionChangeCount: 1,
                balanceChangeCount: 1,
            });

            await appDriver.expectNotificationUpdate(user2, group.id, {
                transactionChangeCount: 1,
                balanceChangeCount: 1,
            });
        });

        it('should update notifications when settlement is created', async () => {
            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(50, 'USD')
                    .build(),
            );

            await appDriver.expectNotificationUpdate(user1, group.id, {
                transactionChangeCount: 1,
                balanceChangeCount: 1,
            });

            await appDriver.expectNotificationUpdate(user2, group.id, {
                transactionChangeCount: 1,
                balanceChangeCount: 1,
            });
        });

        it('should update notifications when group comment is added', async () => {
            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            await appDriver.createGroupComment(user1, group.id, 'Test comment');

            await appDriver.expectNotificationUpdate(user1, group.id, {
                commentChangeCount: 1,
            });

            await appDriver.expectNotificationUpdate(user2, group.id, {
                commentChangeCount: 1,
            });
        });

        it('should update notifications when expense comment is added', async () => {
            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, 'USD', [user1, user2]))
                    .build(),
            );

            await appDriver.createExpenseComment(user1, expense.id, 'Expense comment');

            await appDriver.expectNotificationUpdate(user1, group.id, {
                commentChangeCount: 1,
            });

            await appDriver.expectNotificationUpdate(user2, group.id, {
                commentChangeCount: 1,
            });
        });

        it('should increment changeVersion on multiple operations', async () => {
            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, 'USD', [user1, user2]))
                    .build(),
            );

            let notif = await appDriver.getUserNotifications(user1);
            expect(notif.changeVersion).toBe(5);

            await appDriver.createGroupComment(user1, group.id, 'Comment');

            notif = await appDriver.getUserNotifications(user1);
            expect(notif.changeVersion).toBe(6);
        });

        it('should handle group updates', async () => {
            const group = await appDriver.createGroup(user1);

            await appDriver.updateGroup(user1, group.id, { name: 'Updated Name' });

            await appDriver.expectNotificationUpdate(user1, group.id, {
                groupDetailsChangeCount: 2,
            });
        });
    });

    describe('policy administration flows', () => {
        const policyAdmin = user1;

        it('should allow admin to create, update, and publish policies', async () => {
            const policyName = `Test Policy ${Date.now()}`;

            const created = await appDriver.createPolicy(policyAdmin, {
                policyName,
                text: 'Initial policy text',
            });

            expect(created).toMatchObject({
                success: true,
                id: expect.any(String),
                versionHash: expect.any(String),
            });

            const draftUpdate = await appDriver.updatePolicy(policyAdmin, created.id, {
                text: 'Updated draft policy text',
                publish: false,
            });

            expect(draftUpdate).toMatchObject({
                success: true,
                published: false,
                versionHash: expect.any(String),
            });

            const publishedUpdate = await appDriver.updatePolicy(policyAdmin, created.id, {
                text: 'Final published policy text',
                publish: true,
            });

            expect(publishedUpdate).toMatchObject({
                success: true,
                published: true,
                currentVersionHash: expect.any(String),
            });

            const policyDetails = await appDriver.getPolicy(policyAdmin, created.id);
            const publishedVersionHash = publishedUpdate.currentVersionHash;
            expect(publishedVersionHash).toBeDefined();
            expect(policyDetails.currentVersionHash).toBe(publishedVersionHash);
            const publishedVersion = publishedVersionHash ? policyDetails.versions[publishedVersionHash] : undefined;
            expect(publishedVersion).toBeDefined();
            expect(publishedVersion?.text).toBe('Final published policy text');
        });

        it('should handle update-or-create workflow for named policies', async () => {
            const policyName = 'Terms of Service';
            const policyId = 'terms-of-service';

            await expect(
                appDriver.updatePolicy(policyAdmin, policyId, {
                    text: 'Updated terms version 1',
                    publish: true,
                }),
            )
                .rejects
                .toThrow(/Policy not found/);

            const created = await appDriver.createPolicy(policyAdmin, {
                policyName,
                text: 'Initial terms content',
            });

            expect(created.id).toBe(policyId);

            const update = await appDriver.updatePolicy(policyAdmin, created.id, {
                text: 'Updated terms version 2',
                publish: true,
            });

            expect(update).toMatchObject({
                success: true,
                published: true,
                currentVersionHash: expect.any(String),
            });

            const policyDetails = await appDriver.getPolicy(policyAdmin, policyId);
            const publishedHash = update.currentVersionHash;
            expect(publishedHash).toBeDefined();
            expect(policyDetails.currentVersionHash).toBe(publishedHash);
            const currentVersion = publishedHash ? policyDetails.versions[publishedHash] : undefined;
            expect(currentVersion).toBeDefined();
            expect(currentVersion?.text).toBe('Updated terms version 2');
        });
    });
});

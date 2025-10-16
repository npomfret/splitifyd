import { UserBalance, amountToSmallestUnit, calculateEqualSplits, calculatePercentageSplits, smallestUnitToAmountString } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, it } from 'vitest';
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
                    .withAmount(100)
                    .withCurrency('EUR')
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
                    .withAmount(150.5)
                    .withCurrency('EUR')
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
                    .withAmount('50.25')
                    .withCurrency('EUR')
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

        it('should track balances separately for multi-currency expenses', async () => {
            const group = await appDriver.createGroup(user1,);
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
                    .withAmount(12.345)
                    .withCurrency('KWD')
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
                    .withAmount(303)
                    .withCurrency('JPY')
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
                    .withAmount(45.67)
                    .withCurrency('GBP')
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
            const group = await appDriver.createGroup(user1,);
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
                    .withAmount('275.25')
                    .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

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
                    .withAmount(200)
                    .withCurrency('EUR')
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
                    .withAmount(303)
                    .withCurrency('JPY')
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

        it('should allow sharing a group and list membership balances for all users', async () => {
            const group = await appDriver.createGroup(user1,);

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
                    .withAmount(90)
                    .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            const firstExpenseSplits = calculateEqualSplits(120, 'USD', participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(120)
                    .withCurrency('USD')
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
                    .withAmount('10.00')
                    .withCurrency('USD')
                    .build(),
            );

            groupDetails = await appDriver.getGroupFullDetails(user1, groupId);

            expect(groupDetails.balances.balancesByCurrency!.USD![user1].owedBy[user2]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user1].netBalance).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].owes[user1]).toBe('50.00');
            expect(groupDetails.balances.balancesByCurrency!.USD![user2].netBalance).toBe('-50.00');
            expect(groupDetails.settlements.settlements).toHaveLength(1);
            expect(groupDetails.settlements.settlements[0].amount).toBe('10.00');

            await appDriver.createSettlement(
                user2,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount('50.00')
                    .withCurrency('USD')
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
            expect(settlementAmounts).toEqual(['10.00', '50.00']);
        });

        it('should preserve expense metadata and remove it cleanly on deletion', async () => {
            const group = await appDriver.createGroup(user1,);

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
                    .withAmount(80)
                    .withCurrency('USD')
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
                    .withAmount(50)
                    .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('USD')
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
                    .withAmount('30.00')
                    .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const createdExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Lunch at cafe')
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(60, 'USD', participants))
                    .build(),
            );

            const groupCommentResponse = await appDriver.createGroupComment(user1, groupId, 'Welcome to the group!');
            expect(groupCommentResponse.success).toBe(true);
            expect(groupCommentResponse.data.text).toBe('Welcome to the group!');

            const secondGroupCommentResponse = await appDriver.createGroupComment(user2, groupId, 'Happy to be here');
            expect(secondGroupCommentResponse.success).toBe(true);

            const { data: groupComments } = await appDriver.listGroupComments(user1, groupId);
            expect(groupComments.hasMore).toBe(false);
            expect(groupComments.comments).toHaveLength(2);
            const groupCommentTexts = groupComments.comments.map((comment) => comment.text);
            expect(groupCommentTexts).toEqual(expect.arrayContaining(['Welcome to the group!', 'Happy to be here']));

            const expenseCommentResponse = await appDriver.createExpenseComment(user2, createdExpense.id, 'Thanks for covering this');
            expect(expenseCommentResponse.success).toBe(true);
            expect(expenseCommentResponse.data.authorId).toBe(user2);

            const secondExpenseComment = await appDriver.createExpenseComment(user1, createdExpense.id, 'Let us split next time');
            expect(secondExpenseComment.success).toBe(true);

            const { data: expenseComments } = await appDriver.listExpenseComments(user1, createdExpense.id);
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            const createdExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100)
                    .withCurrency('EUR')
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
                    .withAmount(150.5)
                    .withCurrency('EUR')
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
                    .withAmount('50.25')
                    .withCurrency('EUR')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const baseExpense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(100)
                .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const baseExpense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(12)
                .withCurrency('JPY')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.deleteGroup(user2, groupId))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject group comment creation with empty text', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.createGroupComment(user1, groupId, ''))
                .rejects
                .toMatchObject({ code: 'INVALID_COMMENT_TEXT' });
        });

        it('should reject expense full details access for non-participants', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Confidential dinner')
                    .withAmount(50)
                    .withCurrency('USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(50, 'USD', participants))
                    .build(),
            );

            await expect(appDriver.getExpenseFullDetails(user4, expense.id))
                .rejects
                .toMatchObject({ code: 'NOT_AUTHORIZED' });
        });

        it('should reject share link previews with invalid tokens', async () => {
            await expect(appDriver.previewGroupByLink(user1, 'invalid-token-123'))
                .rejects
                .toMatchObject({ code: 'INVALID_LINK' });
        });

        it('should forbid expense creation by non-group members', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(40)
                .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

            await expect(appDriver.updateGroup(user1, group.id, {} as any))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject settlement updates with invalid amount precision', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(120)
                    .withCurrency('USD')
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
                    .withAmount('60.00')
                    .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            await expect(appDriver.removeGroupMember(user2, groupId, user3))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject expense comment creation with empty text', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(30)
                    .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const response = await appDriver.createGroupComment(user1, groupId, '<script>alert(1)</script>Hello');
            expect(response.data.text).toBe('Hello');

            const { data: comments } = await appDriver.listGroupComments(user1, groupId);
            expect(comments.comments[0].text).toBe('Hello');
        });

        it('should reject expense creation with invalid receipt URL', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Invalid receipt URL')
                .withAmount(40)
                .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const baseExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Original expense')
                    .withAmount(60)
                    .withCurrency('USD')
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
                    .withAmount(90)
                    .withCurrency('USD')
                    .withParticipants(updatedParticipants)
                    .withSplits(updatedSplits)
                    .withSplitType('equal')
                    .build(),
            ))
                .rejects
                .toMatchObject({ code: 'INVALID_PARTICIPANT' });
        });

        it('should reject settlement updates by non-creators', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(80)
                    .withCurrency('USD')
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
                    .withAmount('40.00')
                    .withCurrency('USD')
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
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.updateGroupMemberDisplayName(user2, groupId, ''))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject settlements involving non-members', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const settlement = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(user4)
                .withPayeeId(user1)
                .withAmount('20.00')
                .withCurrency('USD')
                .build();

            await expect(appDriver.createSettlement(user1, settlement))
                .rejects
                .toMatchObject({ code: 'MEMBER_NOT_IN_GROUP' });
        });

        it('should sanitize expense comment text containing scripts', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(50)
                    .withCurrency('USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(50, 'USD', participants))
                    .build(),
            );

            const response = await appDriver.createExpenseComment(user1, expense.id, '<script>alert(1)</script>Thanks');
            expect(response.data.text).toBe('Thanks');

            const { data: comments } = await appDriver.listExpenseComments(user1, expense.id);
            expect(comments.comments[0].text).toBe('Thanks');
        });

        it('should reject share link generation by non-members', async () => {
            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;

            await expect(appDriver.generateShareableLink(user2, groupId))
                .rejects
                .toMatchObject({ code: 'UNAUTHORIZED' });
        });

        it('should handle JavaScript floating point precision bugs (0.1 + 0.2 != 0.3)', async () => {
            const group = await appDriver.createGroup(user1,);

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
                    .withAmount('0.10')
                    .withCurrency(CURRENCY)
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
                    .withAmount('0.20')
                    .withCurrency(CURRENCY)
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
                    .withAmount('0.70')
                    .withCurrency(CURRENCY)
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
                        .withAmount('0.10')
                        .withCurrency(CURRENCY)
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

            const group = await appDriver.createGroup(user1,);

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
                        .withAmount(SMALL_AMOUNT)
                        .withCurrency(CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
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

            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const splits = calculateEqualSplits(LARGE_AMOUNT, CURRENCY, participants);

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(LARGE_AMOUNT)
                    .withCurrency(CURRENCY)
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

            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(EXPENSE_AMOUNT)
                    .withCurrency(CURRENCY)
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
                    .withAmount(FIRST_SETTLEMENT)
                    .withCurrency(CURRENCY)
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
                    .withAmount(SECOND_SETTLEMENT)
                    .withCurrency(CURRENCY)
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
                    .withAmount(THIRD_SETTLEMENT)
                    .withCurrency(CURRENCY)
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
                    .withAmount(FOURTH_SETTLEMENT)
                    .withCurrency(CURRENCY)
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

            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(CIRCULAR_AMOUNT)
                    .withCurrency(CURRENCY)
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
                    .withAmount(CIRCULAR_AMOUNT)
                    .withCurrency(CURRENCY)
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
                    .withAmount(CIRCULAR_AMOUNT)
                    .withCurrency(CURRENCY)
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
            const group = await appDriver.createGroup(user1,);

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
                    .withAmount(150)
                    .withCurrency('USD')
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
                    .withAmount(200)
                    .withCurrency('EUR')
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
                    .withAmount(75.50)
                    .withCurrency('GBP')
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
                    .withAmount('50.00')
                    .withCurrency('USD')
                    .build(),
            );

            await appDriver.createSettlement(
                user3,
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user3)
                    .withPayeeId(user2)
                    .withAmount('66.67')
                    .withCurrency('EUR')
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

            const group = await appDriver.createGroup(user1,);

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
                        .withAmount(amount)
                        .withCurrency('USD')
                        .withPaidBy(payer)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

            expect(usdBalances).toBeDefined();
            verifyBalanceConsistency(usdBalances!, 'USD', 'many expense operations');

            expect(groupDetails.expenses.expenses).toHaveLength(OPERATIONS_COUNT);
        });

        it('should maintain precision across 100 percentage split operations', async () => {
            const NUM_OPERATIONS = 100;
            const AMOUNT = 100;
            const CURRENCY = 'USD';

            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            for (let i = 0; i < NUM_OPERATIONS; i++) {
                const percentageSplits = calculatePercentageSplits(AMOUNT, CURRENCY, participants);
                await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(AMOUNT)
                        .withCurrency(CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('percentage')
                        .withSplits(percentageSplits)
                        .build(),
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const usdBalances = groupDetails.balances.balancesByCurrency?.USD;

            expect(usdBalances, 'USD balances should exist after many percentage operations').toBeDefined();
            verifyBalanceConsistency(usdBalances!, CURRENCY, '100 percentage split operations');

            const amountUnits = amountToSmallestUnit(String(AMOUNT), CURRENCY);
            const totalUnits = amountUnits * NUM_OPERATIONS;
            const perUserUnits = Math.floor(totalUnits / participants.length);
            const expectedUser1NetUnits = totalUnits - perUserUnits;
            const actualUser1NetUnits = amountToSmallestUnit(usdBalances![user1].netBalance, CURRENCY);

            expect(actualUser1NetUnits, `User1 net balance should be exactly ${expectedUser1NetUnits} smallest units after 100 percentage operations (no rounding error allowed)`).toBe(expectedUser1NetUnits);
        });

        it('should maintain precision for JPY (0 decimals) across 100 operations', async () => {
            const NUM_OPERATIONS = 100;
            const CURRENCY = 'JPY';

            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            for (let i = 0; i < NUM_OPERATIONS; i++) {
                const amount = (i % 2 === 0) ? 100 : 101;
                const splits = calculateEqualSplits(amount, CURRENCY, participants);
                await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(amount)
                        .withCurrency(CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const jpyBalances = groupDetails.balances.balancesByCurrency?.JPY;

            expect(jpyBalances, 'JPY balances should exist after many operations').toBeDefined();
            verifyBalanceConsistency(jpyBalances!, CURRENCY, '100 JPY operations with 0 decimals');

            const totalAmount = (50 * 100) + (50 * 101);
            const perUserAmount = Math.floor(totalAmount / participants.length);
            const expectedUser1Net = totalAmount - perUserAmount;
            const actualUser1Net = amountToSmallestUnit(jpyBalances![user1].netBalance, CURRENCY);

            expect(actualUser1Net, `User1 net balance should be exactly ${expectedUser1Net} yen (no fractional precision allowed for JPY)`).toBe(expectedUser1Net);
        });

        it('should maintain precision for KWD (3 decimals) across 100 operations', async () => {
            const AMOUNT = '12.345';
            const NUM_OPERATIONS = 100;
            const CURRENCY = 'KWD';

            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            for (let i = 0; i < NUM_OPERATIONS; i++) {
                const splits = calculateEqualSplits(AMOUNT, CURRENCY, participants);
                await appDriver.createExpense(
                    user1,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withAmount(AMOUNT)
                        .withCurrency(CURRENCY)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(splits)
                        .build(),
                );
            }

            const groupDetails = await appDriver.getGroupFullDetails(user1, groupId);
            const kwdBalances = groupDetails.balances.balancesByCurrency?.KWD;

            expect(kwdBalances, 'KWD balances should exist after many operations').toBeDefined();
            verifyBalanceConsistency(kwdBalances!, CURRENCY, '100 KWD operations with 3 decimals');

            const amountUnits = amountToSmallestUnit(AMOUNT, CURRENCY);
            const totalUnits = amountUnits * NUM_OPERATIONS;
            const perUserUnits = Math.floor(totalUnits / participants.length);
            const expectedUser1NetUnits = totalUnits - perUserUnits;
            const actualUser1NetUnits = amountToSmallestUnit(kwdBalances![user1].netBalance, CURRENCY);

            expect(actualUser1NetUnits, `User1 net balance should be exactly ${expectedUser1NetUnits} fils (no rounding error allowed for 3-decimal KWD)`).toBe(expectedUser1NetUnits);
        });

        it('should maintain precision when converting between split types', async () => {
            const AMOUNT = 100;
            const CURRENCY = 'EUR';

            const group = await appDriver.createGroup(user1,);

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const participants = [user1, user2, user3];

            const equalSplits = calculateEqualSplits(AMOUNT, CURRENCY, participants);
            const createdExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(AMOUNT)
                    .withCurrency(CURRENCY)
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

            const percentageSplits = calculatePercentageSplits(AMOUNT, CURRENCY, participants);
            await appDriver.updateExpense(
                user1,
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(AMOUNT)
                    .withCurrency(CURRENCY)
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
                    .withAmount(AMOUNT)
                    .withCurrency(CURRENCY)
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

            const finalEqualSplits = calculateEqualSplits(AMOUNT, CURRENCY, participants);
            await appDriver.updateExpense(
                user1,
                createdExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withAmount(AMOUNT)
                    .withCurrency(CURRENCY)
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
                    .withAmount(150)
                    .withCurrency(CURRENCY)
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
                    .withAmount(100)
                    .withCurrency(CURRENCY)
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
    });
});

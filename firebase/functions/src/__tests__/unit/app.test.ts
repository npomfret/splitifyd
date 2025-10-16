import { amountToSmallestUnit, calculateEqualSplits, calculatePercentageSplits, smallestUnitToAmountString } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, it } from 'vitest';

const amountFor = (splits: Array<{ uid: string; amount: string; }>, uid: string) => splits.find((split) => split.uid === uid)!.amount;

const netBalanceForPayer = (splits: Array<{ uid: string; amount: string; }>, payerId: string, currency: string) => {
    const totalUnits = splits
        .filter((split) => split.uid !== payerId)
        .reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currency), 0);
    return smallestUnitToAmountString(totalUnits, currency);
};
import { AppDriver } from './AppDriver';

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
                    .withDescription('Initial Expense')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .build(),
            );

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
                    .withDescription('KWD Expense')
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
                    .withDescription('JPY Expense')
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
                    .withDescription('GBP Expense')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .build(),
            );

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
                    .withDescription('Exact USD Expense')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .build(),
            );

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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Beach Trip Crew')
                    .withDescription('Planning expenses for the summer beach trip')
                    .build(),
            );

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
            expect(summaryForUser1!.name).toBe('Beach Trip Crew');
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Monthly Bills')
                    .build(),
            );

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            const firstExpenseSplits = calculateEqualSplits(120, 'USD', participants);
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Utilities')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Weekend Getaway')
                    .build(),
            );

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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Hiking Crew')
                    .build(),
            );

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
                    .withDescription('Original itinerary')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Shared Bills')
                    .build(),
            );

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Electricity Bill')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Comment Testers')
                    .build(),
            );

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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .build(),
            );

            const groupId = group.id;

            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];

            const createdExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Initial Expense')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Invalid Split Group')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const baseExpense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Dinner mismatch')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Invalid Precision Group')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const baseExpense = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('JPY invalid precision')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Ownership Test')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.deleteGroup(user2, groupId))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject group comment creation with empty text', async () => {
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Comment Guard')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.createGroupComment(user1, groupId, ''))
                .rejects
                .toMatchObject({ code: 'INVALID_COMMENT_TEXT' });
        });

        it('should reject expense full details access for non-participants', async () => {
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Private Expenses')
                    .build(),
            );

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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Member Only Expenses')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Attempted outsider expense')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Update Validation')
                    .build(),
            );

            await expect(appDriver.updateGroup(user1, group.id, {} as any))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject settlement updates with invalid amount precision', async () => {
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Settlement Precision')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Invoice')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Member Removal Guard')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            await expect(appDriver.removeGroupMember(user2, groupId, user3))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject expense comment creation with empty text', async () => {
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Expense Comment Guard')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Shared ride')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Sanitize Comments')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const response = await appDriver.createGroupComment(user1, groupId, '<script>alert(1)</script>Hello');
            expect(response.data.text).toBe('Hello');

            const { data: comments } = await appDriver.listGroupComments(user1, groupId);
            expect(comments.comments[0].text).toBe('Hello');
        });

        it('should reject expense creation with invalid receipt URL', async () => {
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Receipt Validation')
                    .build(),
            );

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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Participant Validation')
                    .build(),
            );

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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Settlement Ownership')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Shared purchase')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Display Name Guard')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            await expect(appDriver.updateGroupMemberDisplayName(user2, groupId, ''))
                .rejects
                .toMatchObject({ code: 'INVALID_INPUT' });
        });

        it('should reject settlements involving non-members', async () => {
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Settlement Membership Guard')
                    .build(),
            );

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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Expense Comment Sanitize')
                    .build(),
            );

            const groupId = group.id;
            const { linkId } = await appDriver.generateShareableLink(user1, groupId);
            await appDriver.joinGroupByLink(user2, linkId);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Lunch share')
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
            const group = await appDriver.createGroup(
                user1,
                new CreateGroupRequestBuilder()
                    .withName('Share Guard')
                    .build(),
            );

            const groupId = group.id;

            await expect(appDriver.generateShareableLink(user2, groupId))
                .rejects
                .toMatchObject({ code: 'UNAUTHORIZED' });
        });
    });
});

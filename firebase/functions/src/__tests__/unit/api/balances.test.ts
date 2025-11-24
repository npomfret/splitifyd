import { amountToSmallestUnit, calculateEqualSplits, calculatePercentageSplits, smallestUnitToAmountString, toAmount, toCurrencyISOCode, USD, UserBalance } from '@billsplit-wl/shared';
import type { CurrencyISOCode, UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

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

describe('balances', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;
    let user3: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users } = await appDriver.createTestUsers({ count: 3 });
        [user1, user2, user3] = users;
    });

    afterEach(() => {
        appDriver.dispose();
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
});

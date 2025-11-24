import { calculateEqualSplits, toAmount, toCurrencyISOCode, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder, SettlementUpdateBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('settlements', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users } = await appDriver.createTestUsers({ count: 2 });
        [user1, user2] = users;
    });

    afterEach(() => {
        appDriver.dispose();
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

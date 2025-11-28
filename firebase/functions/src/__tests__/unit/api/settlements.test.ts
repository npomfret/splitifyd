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

    describe('settlement edge cases', () => {
        it('should reject creating settlement in non-existent group', async () => {
            await expect(
                appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId('non-existent-group-id')
                        .withPayerId(user2)
                        .withPayeeId(user1)
                        .withAmount(50, USD)
                        .build(),
                    user2,
                ),
            ).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject creating settlement by non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // user2 is NOT a member
            await expect(
                appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(group.id)
                        .withPayerId(user2)
                        .withPayeeId(user1)
                        .withAmount(50, USD)
                        .build(),
                    user2,
                ),
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject updating non-existent settlement', async () => {
            await expect(
                appDriver.updateSettlement(
                    'non-existent-settlement-id',
                    new SettlementUpdateBuilder().withAmount('100.00', USD).build(),
                    user1,
                ),
            ).rejects.toMatchObject({ code: 'SETTLEMENT_NOT_FOUND' });
        });

        it('should reject updating settlement by non-creator', async () => {
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

            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(30, USD)
                    .build(),
                user2,
            );

            // user1 (not the creator) trying to update
            await expect(
                appDriver.updateSettlement(
                    settlement.id,
                    new SettlementUpdateBuilder().withAmount('50.00', USD).build(),
                    user1,
                ),
            ).rejects.toMatchObject({ code: 'NOT_SETTLEMENT_CREATOR' });
        });

        it('should reject deleting non-existent settlement', async () => {
            await expect(
                appDriver.deleteSettlement('non-existent-settlement-id', user1),
            ).rejects.toMatchObject({ code: 'SETTLEMENT_NOT_FOUND' });
        });

        it('should reject deleting already-deleted settlement (returns SETTLEMENT_NOT_FOUND)', async () => {
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

            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(30, USD)
                    .build(),
                user2,
            );

            // Delete once
            await appDriver.deleteSettlement(settlement.id, user1);

            // Try to delete again - returns NOT_FOUND because soft-deleted settlements are filtered out
            await expect(
                appDriver.deleteSettlement(settlement.id, user1),
            ).rejects.toMatchObject({ code: 'SETTLEMENT_NOT_FOUND' });
        });
    });

    describe('listGroupSettlements edge cases', () => {
        it('should reject listing settlements for non-existent group (returns FORBIDDEN for security)', async () => {
            // For security reasons, returns FORBIDDEN instead of NOT_FOUND to avoid leaking group existence
            await expect(
                appDriver.listGroupSettlements('non-existent-group-id', {}, user1),
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject listing settlements as non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // user2 is NOT a member
            await expect(
                appDriver.listGroupSettlements(group.id, {}, user2),
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should return empty list for group with no settlements', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const result = await appDriver.listGroupSettlements(group.id, {}, user1);
            expect(result.settlements).toEqual([]);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeUndefined();
        });

        it('should support pagination for group settlements', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            // Create an expense to have a balance
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(500, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(500), USD, participants))
                    .build(),
                user1,
            );

            // Create 5 settlements
            for (let i = 0; i < 5; i += 1) {
                await appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(groupId)
                        .withPayerId(user2)
                        .withPayeeId(user1)
                        .withAmount(10 + i, USD)
                        .build(),
                    user2,
                );
            }

            // Request with limit of 2
            const firstPage = await appDriver.listGroupSettlements(groupId, { limit: 2 }, user1);
            expect(firstPage.settlements).toHaveLength(2);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            // Get next page
            const secondPage = await appDriver.listGroupSettlements(groupId, { limit: 2, cursor: firstPage.nextCursor }, user1);
            expect(secondPage.settlements).toHaveLength(2);
            expect(secondPage.hasMore).toBe(true);
        });

        it('should not include deleted settlements by default', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            // Create an expense to have a balance
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(200, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(200), USD, participants))
                    .build(),
                user1,
            );

            const settlement1 = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(30, USD)
                    .build(),
                user2,
            );

            const settlement2 = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(20, USD)
                    .build(),
                user2,
            );

            // Delete second settlement
            await appDriver.deleteSettlement(settlement2.id, user1);

            // By default, deleted settlements should not appear
            const result = await appDriver.listGroupSettlements(groupId, {}, user1);
            expect(result.settlements).toHaveLength(1);
            expect(result.settlements[0].id).toBe(settlement1.id);
        });
    });

    describe('edit history (supersededBy)', () => {
        it('should return new settlement with new ID when updating', async () => {
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

            const originalSettlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(30, USD)
                    .withNote('Original payment')
                    .build(),
                user2,
            );

            const updatedSettlement = await appDriver.updateSettlement(
                originalSettlement.id,
                new SettlementUpdateBuilder()
                    .withAmount('40.00', USD)
                    .withNote('Updated payment')
                    .build(),
                user2,
            );

            // The returned settlement should have a NEW ID (not the original)
            expect(updatedSettlement.id).not.toBe(originalSettlement.id);
            expect(updatedSettlement.amount).toBe('40.00');
            expect(updatedSettlement.note).toBe('Updated payment');
        });

        it('should set supersededBy on original settlement when updated', async () => {
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

            const originalSettlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(30, USD)
                    .withNote('Original payment')
                    .build(),
                user2,
            );

            const updatedSettlement = await appDriver.updateSettlement(
                originalSettlement.id,
                new SettlementUpdateBuilder()
                    .withAmount('40.00', USD)
                    .withNote('Updated payment')
                    .build(),
                user2,
            );

            // Fetch the original settlement directly to verify supersededBy was set
            const originalSettlementAfterUpdate = await appDriver.getSettlementById(originalSettlement.id);
            expect(originalSettlementAfterUpdate.supersededBy).toBe(updatedSettlement.id);
            expect(originalSettlementAfterUpdate.deletedAt).not.toBeNull();
            expect(originalSettlementAfterUpdate.deletedBy).toBe(user2);
        });

        it('should prevent deletion of superseded settlement', async () => {
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

            const originalSettlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user2)
                    .withPayeeId(user1)
                    .withAmount(30, USD)
                    .withNote('Original payment')
                    .build(),
                user2,
            );

            // Update the settlement (which soft-deletes the original and creates a new one)
            await appDriver.updateSettlement(
                originalSettlement.id,
                new SettlementUpdateBuilder()
                    .withAmount('40.00', USD)
                    .withNote('Updated payment')
                    .build(),
                user2,
            );

            // Attempting to delete the original (superseded) settlement should fail
            await expect(appDriver.deleteSettlement(originalSettlement.id, user1))
                .rejects.toThrow('Cannot delete a superseded settlement');
        });
    });
});

import { ActivityFeedEventTypes, calculateEqualSplits, calculatePercentageSplits, toAmount, toCurrencyISOCode, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseSplitBuilder, ExpenseUpdateBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('expenses', () => {
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

        const updatedExpense = await appDriver.updateExpense(
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

        // Delete the NEW expense (update creates a new ID, original is soft-deleted)
        await appDriver.deleteExpense(updatedExpense.id, user1);

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

    it('should support exact split expenses with manual allocations', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
        const groupId = group.id;

        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);
        await appDriver.joinGroupByLink(shareToken, undefined, user3);

        const participants = [user1, user2, user3];

        const exactSplits = new ExpenseSplitBuilder()
            .withSplit(user1, '120.10')
            .withSplit(user2, '80.05')
            .withSplit(user3, '75.10')
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

        const recordedExpenseBeforeUpdate = groupDetails.expenses.expenses.find((expense) => expense.id === createdExpense.id);
        expect(recordedExpenseBeforeUpdate).toBeDefined();
        expect(recordedExpenseBeforeUpdate!.splitType).toBe('percentage');
        expect(recordedExpenseBeforeUpdate!.currency).toBe(toCurrencyISOCode('EUR'));
        expect(recordedExpenseBeforeUpdate!.splits.map((split) => split.amount)).toEqual(percentageSplits.map((split) => split.amount));
        expect(recordedExpenseBeforeUpdate!.splits.map((split) => split.percentage)).toEqual(percentageSplits.map((split) => split.percentage));

        const updatedParticipants = [user1, user2];
        const updatedSplits = calculateEqualSplits(toAmount(303), toCurrencyISOCode('JPY'), updatedParticipants);
        const updatedExpense = await appDriver.updateExpense(
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

        // Update creates a new expense with a new ID (original is soft-deleted)
        const recordedExpenseAfterUpdate = groupDetails.expenses.expenses.find((expense) => expense.id === updatedExpense.id);
        expect(recordedExpenseAfterUpdate).toBeDefined();
        expect(recordedExpenseAfterUpdate!.description).toBe('Team Outing JPY');
        expect(recordedExpenseAfterUpdate!.currency).toBe(toCurrencyISOCode('JPY'));
        expect(recordedExpenseAfterUpdate!.amount).toBe('303');
        expect(recordedExpenseAfterUpdate!.paidBy).toBe(user1);
        expect(recordedExpenseAfterUpdate!.splitType).toBe('equal');
        expect(recordedExpenseAfterUpdate!.participants).toEqual(updatedParticipants);
        expect(recordedExpenseAfterUpdate!.splits).toEqual(updatedSplits);
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
        expect(recordedMetadataExpense!.labels).toContain('Travel');
        expect(recordedMetadataExpense!.date).toBe('2024-06-15T12:30:00.000Z');
        expect(recordedMetadataExpense!.receiptUrl).toBe('https://example.com/receipts/hotel.jpg');
        expect(recordedMetadataExpense!.splits).toEqual(metadataSplits);

        await appDriver.deleteExpense(metadataExpense.id, user1);

        groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

        expect(groupDetails.expenses.expenses).toHaveLength(1);
        expect(groupDetails.expenses.expenses[0].description).toBe('Fuel stop');
        expect(groupDetails.expenses.expenses[0].splits).toEqual(secondarySplits);
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

        const groupCommentResponse = await appDriver.createGroupComment(groupId, 'Welcome to the group!', undefined, user1);
        expect(groupCommentResponse.text).toBe('Welcome to the group!');

        const secondGroupCommentResponse = await appDriver.createGroupComment(groupId, 'Happy to be here', undefined, user2);
        expect(secondGroupCommentResponse.authorId).toBe(user2);
        expect(secondGroupCommentResponse.text).toBe('Happy to be here');

        const groupComments = await appDriver.listGroupComments(groupId, {}, user1);
        expect(groupComments.hasMore).toBe(false);
        expect(groupComments.comments).toHaveLength(2);
        const groupCommentTexts = groupComments.comments.map((comment) => comment.text);
        expect(groupCommentTexts).toEqual(expect.arrayContaining(['Welcome to the group!', 'Happy to be here']));

        const expenseCommentResponse = await appDriver.createExpenseComment(createdExpense.id, 'Thanks for covering this', undefined, user2);
        expect(expenseCommentResponse.authorId).toBe(user2);

        await appDriver.createExpenseComment(createdExpense.id, 'Let us split next time', undefined, user1);

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

    describe('expense edge cases', () => {
        it('should reject creating expense in non-existent group', async () => {
            const participants = [user1];
            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId('non-existent-group-id')
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

        it('should reject creating expense by non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            // user2 is NOT a member
            const participants = [user1];

            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withAmount(100, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                        .build(),
                    user2,
                ),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject creating expense with payer not in participants', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            // user2 is NOT in participants list but is set as payer
            const participants = [user1];

            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withAmount(100, USD)
                        .withPaidBy(user2)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                        .build(),
                    user1,
                ),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject creating expense with non-member participant', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            // user2 is NOT a member but is in participants list
            const participants = [user1, user2];

            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
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
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject updating non-existent expense', async () => {
            await expect(
                appDriver.updateExpense(
                    'non-existent-expense-id',
                    ExpenseUpdateBuilder.minimal().withDescription('Updated').build(),
                    user1,
                ),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject deleting non-existent expense', async () => {
            await expect(
                appDriver.deleteExpense('non-existent-expense-id', user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject getting details for non-existent expense', async () => {
            await expect(
                appDriver.getExpenseFullDetails('non-existent-expense-id', user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject getting expense details as non-member (returns NOT_FOUND for security)', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const participants = [user1];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            // user2 is NOT a member - returns NOT_FOUND to avoid leaking existence info
            await expect(
                appDriver.getExpenseFullDetails(expense.id, user2),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });
    });

    describe('listGroupExpenses edge cases', () => {
        it('should reject listing expenses for non-existent group (returns FORBIDDEN for security)', async () => {
            // For security reasons, returns FORBIDDEN instead of NOT_FOUND to avoid leaking group existence
            await expect(
                appDriver.listGroupExpenses('non-existent-group-id', {}, user1),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject listing expenses as non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // user2 is NOT a member
            await expect(
                appDriver.listGroupExpenses(group.id, {}, user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should return empty list for group with no expenses', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const result = await appDriver.listGroupExpenses(group.id, {}, user1);
            expect(result.expenses).toEqual([]);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeUndefined();
        });

        it('should support pagination for group expenses', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            // Create 5 expenses
            for (let i = 0; i < 5; i += 1) {
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withDescription(`Expense ${i}`)
                        .withAmount(50 + i, USD)
                        .withPaidBy(user1)
                        .withParticipants(participants)
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(50 + i), USD, participants))
                        .build(),
                    user1,
                );
            }

            // Request with limit of 2
            const firstPage = await appDriver.listGroupExpenses(groupId, { limit: 2 }, user1);
            expect(firstPage.expenses).toHaveLength(2);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            // Get next page
            const secondPage = await appDriver.listGroupExpenses(groupId, { limit: 2, cursor: firstPage.nextCursor }, user1);
            expect(secondPage.expenses).toHaveLength(2);
            expect(secondPage.hasMore).toBe(true);
        });

        it('should not include deleted expenses by default', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const expense1 = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Active expense')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Expense to delete')
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .build(),
                user1,
            );

            // Delete second expense
            const allExpenses = await appDriver.listGroupExpenses(groupId, {}, user1);
            const expenseToDelete = allExpenses.expenses.find(e => e.description === 'Expense to delete');
            if (expenseToDelete) {
                await appDriver.deleteExpense(expenseToDelete.id, user1);
            }

            // By default, deleted expenses should not appear
            const result = await appDriver.listGroupExpenses(groupId, {}, user1);
            expect(result.expenses).toHaveLength(1);
            expect(result.expenses[0].id).toBe(expense1.id);
        });

        it('should include labels in listed expenses', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            // Create expense with labels
            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Labeled expense')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .withLabels(['Food', 'Lunch'])
                    .build(),
                user1,
            );

            // Verify labels are present when fetching single expense
            const singleExpense = await appDriver.getExpense(createdExpense.id, user1);
            expect(singleExpense.labels).toHaveLength(2);
            expect(singleExpense.labels).toContain('Food');
            expect(singleExpense.labels).toContain('Lunch');

            // Verify labels are present when LISTING expenses (this is the bug)
            const listResult = await appDriver.listGroupExpenses(groupId, {}, user1);
            expect(listResult.expenses).toHaveLength(1);
            const listedExpense = listResult.expenses[0];
            expect(listedExpense.labels).toHaveLength(2);
            expect(listedExpense.labels).toContain('Food');
            expect(listedExpense.labels).toContain('Lunch');
        });
    });

    describe('edit history (supersededBy)', () => {
        it('should return new expense with new ID when updating', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const originalExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Original expense')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            const updatedExpense = await appDriver.updateExpense(
                originalExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withDescription('Updated expense')
                    .withAmount(150, USD)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(150), USD, participants))
                    .build(),
                user1,
            );

            // The returned expense should have a NEW ID (not the original)
            expect(updatedExpense.id).not.toBe(originalExpense.id);
            expect(updatedExpense.description).toBe('Updated expense');
            expect(updatedExpense.amount).toBe('150');
            expect(updatedExpense.supersededBy).toBeNull();
        });

        it('should set supersededBy on original expense when updated', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const originalExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Original expense')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            const updatedExpense = await appDriver.updateExpense(
                originalExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withDescription('Updated expense')
                    .withAmount(150, USD)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(150), USD, participants))
                    .build(),
                user1,
            );

            // Fetch the original expense directly to verify supersededBy was set
            const originalExpenseAfterUpdate = await appDriver.getExpenseById(originalExpense.id);
            expect(originalExpenseAfterUpdate.supersededBy).toBe(updatedExpense.id);
            expect(originalExpenseAfterUpdate.deletedAt).not.toBeNull();
            expect(originalExpenseAfterUpdate.deletedBy).toBe(user1);
        });

        it('should prevent deletion of superseded expense', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const originalExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Original expense')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            // Update the expense (which soft-deletes the original and creates a new one)
            await appDriver.updateExpense(
                originalExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withDescription('Updated expense')
                    .withAmount(150, USD)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(150), USD, participants))
                    .build(),
                user1,
            );

            // Attempting to delete the original (superseded) expense should fail
            await expect(appDriver.deleteExpense(originalExpense.id, user1))
                .rejects
                .toMatchObject({ code: 'INVALID_REQUEST' });
        });

        it('should not return superseded expense in group details', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const originalExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Original expense')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            // Update the expense (which soft-deletes the original)
            const updatedExpense = await appDriver.updateExpense(
                originalExpense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withDescription('Updated expense')
                    .withAmount(150, USD)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(150), USD, participants))
                    .build(),
                user1,
            );

            // Fetch group details - should only return the new expense, not the superseded one
            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);

            expect(groupDetails.expenses.expenses).toHaveLength(1);
            expect(groupDetails.expenses.expenses[0].id).toBe(updatedExpense.id);
            expect(groupDetails.expenses.expenses.find((e) => e.id === originalExpense.id)).toBeUndefined();
        });
    });

    describe('expense activity feed events', () => {
        it('should generate activity event when expense is updated', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Original expense')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            await appDriver.updateExpense(
                expense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withDescription('Updated expense')
                    .withAmount(150, USD)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(150), USD, participants))
                    .build(),
                user1,
            );

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const expenseUpdatedEvent = response.items.find(
                (item) => item.eventType === ActivityFeedEventTypes.EXPENSE_UPDATED,
            );

            expect(expenseUpdatedEvent).toBeDefined();
            expect(expenseUpdatedEvent?.actorId).toBe(user1);
            expect(expenseUpdatedEvent?.action).toBe('update');
        });

        it('should generate activity event when expense is deleted', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Expense to delete')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            await appDriver.deleteExpense(expense.id, user1);

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const expenseDeletedEvent = response.items.find(
                (item) => item.eventType === ActivityFeedEventTypes.EXPENSE_DELETED,
            );

            expect(expenseDeletedEvent).toBeDefined();
            expect(expenseDeletedEvent?.actorId).toBe(user1);
            expect(expenseDeletedEvent?.action).toBe('delete');
        });

        it('should generate activity event when expense comment is added', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Expense with comment')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            await appDriver.createExpenseComment(expense.id, 'This is a comment on the expense', undefined, user2);

            const response = await appDriver.getGroupActivityFeed(groupId, {}, user1);
            const commentAddedEvent = response.items.find(
                (item) =>
                    item.eventType === ActivityFeedEventTypes.COMMENT_ADDED
                    && item.details?.expenseId === expense.id,
            );

            expect(commentAddedEvent).toBeDefined();
            expect(commentAddedEvent?.actorId).toBe(user2);
            expect(commentAddedEvent?.action).toBe('comment');
            expect(commentAddedEvent?.details?.commentPreview).toContain('This is a comment');
        });
    });

    describe('expense location', () => {
        it('should create expense with location name only', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Dinner at Restaurant')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .withLocationName('The Italian Place')
                    .build(),
                user1,
            );

            expect(expense.location).toBeDefined();
            expect(expense.location?.name).toBe('The Italian Place');
            expect(expense.location?.url).toBeUndefined();
        });

        it('should create expense with location name and URL', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const mapsUrl = 'https://maps.google.com/maps/place/The+Italian+Place/@40.123,-73.456';

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Dinner at Restaurant')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .withLocationNameAndUrl('The Italian Place', mapsUrl)
                    .build(),
                user1,
            );

            expect(expense.location).toBeDefined();
            expect(expense.location?.name).toBe('The Italian Place');
            expect(expense.location?.url).toBe(mapsUrl);
        });

        it('should create expense without location', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Dinner')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            expect(expense.location).toBeUndefined();
        });

        it('should update expense to add location', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Dinner')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .build(),
                user1,
            );

            expect(expense.location).toBeUndefined();

            const updatedExpense = await appDriver.updateExpense(
                expense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withLocationName('Coffee Shop')
                    .build(),
                user1,
            );

            expect(updatedExpense.location).toBeDefined();
            expect(updatedExpense.location?.name).toBe('Coffee Shop');
        });

        it('should update expense to change location', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Dinner')
                    .withAmount(100, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(100), USD, participants))
                    .withLocationName('Old Restaurant')
                    .build(),
                user1,
            );

            expect(expense.location?.name).toBe('Old Restaurant');

            const updatedExpense = await appDriver.updateExpense(
                expense.id,
                ExpenseUpdateBuilder
                    .minimal()
                    .withLocationNameAndUrl('New Restaurant', 'https://maps.google.com/maps/place/New+Restaurant')
                    .build(),
                user1,
            );

            expect(updatedExpense.location?.name).toBe('New Restaurant');
            expect(updatedExpense.location?.url).toBe('https://maps.google.com/maps/place/New+Restaurant');
        });

        it('should return location in expense full details', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];
            const mapsUrl = 'https://maps.google.com/maps/place/Starbucks';

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Coffee')
                    .withAmount(15, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(15), USD, participants))
                    .withLocationNameAndUrl('Starbucks', mapsUrl)
                    .build(),
                user1,
            );

            const details = await appDriver.getExpenseFullDetails(expense.id, user1);

            expect(details.expense.location).toBeDefined();
            expect(details.expense.location?.name).toBe('Starbucks');
            expect(details.expense.location?.url).toBe(mapsUrl);
        });

        it('should return location in group full details expenses list', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const participants = [user1, user2];

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withDescription('Lunch')
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .withLocationName('Cafe Milano')
                    .build(),
                user1,
            );

            const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
            const expenseWithLocation = groupDetails.expenses.expenses.find(e => e.description === 'Lunch');

            expect(expenseWithLocation).toBeDefined();
            expect(expenseWithLocation?.location).toBeDefined();
            expect(expenseWithLocation?.location?.name).toBe('Cafe Milano');
        });
    });
});

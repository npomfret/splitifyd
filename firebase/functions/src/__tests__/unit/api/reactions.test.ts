import { calculateEqualSplits, isoStringNow, ReactionEmojis, toAmount, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('reactions', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;
    let user3: UserId; // Non-member user for authorization tests

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users } = await appDriver.createTestUsers({ count: 3 });
        [user1, user2, user3] = users;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('expense reactions', () => {
        it('should add a reaction to an expense', async () => {
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

            const result = await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.THUMBS_UP, user1);

            expect(result.action).toBe('added');
            expect(result.emoji).toBe(ReactionEmojis.THUMBS_UP);
            expect(result.newCount).toBe(1);
        });

        it('should toggle off a reaction when called twice', async () => {
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

            // First toggle - add
            await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.HEART, user1);

            // Second toggle - remove
            const result = await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.HEART, user1);

            expect(result.action).toBe('removed');
            expect(result.emoji).toBe(ReactionEmojis.HEART);
            expect(result.newCount).toBe(0);
        });

        it('should allow multiple users to react', async () => {
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

            await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.THUMBS_UP, user1);
            const result = await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.THUMBS_UP, user2);

            expect(result.action).toBe('added');
            expect(result.newCount).toBe(2);
        });

        it('should allow user to add multiple different reactions', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            const participants = [user1];
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

            // Add thumbs up
            const result1 = await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.THUMBS_UP, user1);
            expect(result1.action).toBe('added');
            expect(result1.emoji).toBe(ReactionEmojis.THUMBS_UP);

            // Add heart
            const result2 = await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.HEART, user1);
            expect(result2.action).toBe('added');
            expect(result2.emoji).toBe(ReactionEmojis.HEART);
        });

        it('should reject reaction from non-group-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const participants = [user1];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .build(),
                user1,
            );

            // user2 is NOT a member
            await expect(
                appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.THUMBS_UP, user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject reaction on non-existent expense', async () => {
            await expect(
                appDriver.toggleExpenseReaction('non-existent-expense-id', ReactionEmojis.THUMBS_UP, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });
    });

    describe('group comment reactions', () => {
        it('should add a reaction to a group comment', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const comment = await appDriver.createGroupComment(group.id, 'Test comment', user1);

            const result = await appDriver.toggleGroupCommentReaction(group.id, comment.id, ReactionEmojis.LAUGH, user1);

            expect(result.action).toBe('added');
            expect(result.emoji).toBe(ReactionEmojis.LAUGH);
            expect(result.newCount).toBe(1);
        });

        it('should toggle off a reaction on a group comment', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const comment = await appDriver.createGroupComment(group.id, 'Test comment', user1);

            await appDriver.toggleGroupCommentReaction(group.id, comment.id, ReactionEmojis.CELEBRATE, user1);
            const result = await appDriver.toggleGroupCommentReaction(group.id, comment.id, ReactionEmojis.CELEBRATE, user1);

            expect(result.action).toBe('removed');
            expect(result.newCount).toBe(0);
        });

        it('should reject reaction from non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const comment = await appDriver.createGroupComment(group.id, 'Test comment', user1);

            await expect(
                appDriver.toggleGroupCommentReaction(group.id, comment.id, ReactionEmojis.THUMBS_UP, user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject reaction on non-existent comment', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            await expect(
                appDriver.toggleGroupCommentReaction(group.id, 'non-existent-comment-id', ReactionEmojis.THUMBS_UP, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });
    });

    describe('expense comment reactions', () => {
        it('should add a reaction to an expense comment', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const participants = [user1];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .build(),
                user1,
            );

            const comment = await appDriver.createExpenseComment(expense.id, 'Test comment', user1);
            const result = await appDriver.toggleExpenseCommentReaction(expense.id, comment.id, ReactionEmojis.WOW, user1);

            expect(result.action).toBe('added');
            expect(result.emoji).toBe(ReactionEmojis.WOW);
            expect(result.newCount).toBe(1);
        });

        it('should reject reaction on non-existent expense comment', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const participants = [user1];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .build(),
                user1,
            );

            await expect(
                appDriver.toggleExpenseCommentReaction(expense.id, 'non-existent-comment-id', ReactionEmojis.THUMBS_UP, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });
    });

    describe('settlement reactions', () => {
        it('should add a reaction to a settlement', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const settlement = await appDriver.createSettlement(
                {
                    groupId,
                    payerId: user1,
                    payeeId: user2,
                    amount: '25.00',
                    currency: USD,
                    date: isoStringNow(),
                    note: 'Test settlement',
                },
                user1,
            );

            const result = await appDriver.toggleSettlementReaction(settlement.id, ReactionEmojis.SAD, user1);

            expect(result.action).toBe('added');
            expect(result.emoji).toBe(ReactionEmojis.SAD);
            expect(result.newCount).toBe(1);
        });

        it('should reject reaction from non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const settlement = await appDriver.createSettlement(
                {
                    groupId,
                    payerId: user1,
                    payeeId: user2,
                    amount: '25.00',
                    currency: USD,
                    date: isoStringNow(),
                    note: 'Test settlement',
                },
                user1,
            );

            // user3 is NOT a member of this group
            await expect(
                appDriver.toggleSettlementReaction(settlement.id, ReactionEmojis.THUMBS_UP, user3),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject reaction on non-existent settlement', async () => {
            await expect(
                appDriver.toggleSettlementReaction('non-existent-settlement-id', ReactionEmojis.THUMBS_UP, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });
    });

    describe('validation', () => {
        it('should reject invalid emoji', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const participants = [user1];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .build(),
                user1,
            );

            await expect(
                appDriver.toggleExpenseReaction(expense.id, 'invalid-emoji' as any, user1),
            )
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });
    });
});

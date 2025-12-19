import { calculateEqualSplits, ReactionEmojis, toAmount, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder } from '@billsplit-wl/test-support';
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

        it('should return userReactions in getExpenseFullDetails', async () => {
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

            // Add reactions
            await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.THUMBS_UP, user1);
            await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.HEART, user1);
            await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.THUMBS_UP, user2);

            // Verify all users' reactions are visible (new format: Record<UserId, ReactionEmoji[]>)
            const fullDetails1 = await appDriver.getExpenseFullDetails(expense.id, user1);
            expect(fullDetails1.expense.userReactions).toBeDefined();
            expect(fullDetails1.expense.userReactions![user1]).toEqual(
                expect.arrayContaining([ReactionEmojis.THUMBS_UP, ReactionEmojis.HEART]),
            );
            expect(fullDetails1.expense.userReactions![user2]).toEqual([ReactionEmojis.THUMBS_UP]);
            expect(fullDetails1.expense.reactionCounts).toEqual({
                [ReactionEmojis.THUMBS_UP]: 2,
                [ReactionEmojis.HEART]: 1,
            });

            // Both users see the same userReactions map
            const fullDetails2 = await appDriver.getExpenseFullDetails(expense.id, user2);
            expect(fullDetails2.expense.userReactions).toEqual(fullDetails1.expense.userReactions);
            expect(fullDetails2.expense.reactionCounts).toEqual({
                [ReactionEmojis.THUMBS_UP]: 2,
                [ReactionEmojis.HEART]: 1,
            });
        });

        it('should return userReactions in getExpense', async () => {
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

            // Add reactions
            await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.LAUGH, user1);
            await appDriver.toggleExpenseReaction(expense.id, ReactionEmojis.LAUGH, user2);

            // Verify all users' reactions are visible (new format: Record<UserId, ReactionEmoji[]>)
            const expense1 = await appDriver.getExpense(expense.id, user1);
            expect(expense1.userReactions).toBeDefined();
            expect(expense1.userReactions![user1]).toEqual([ReactionEmojis.LAUGH]);
            expect(expense1.userReactions![user2]).toEqual([ReactionEmojis.LAUGH]);
            expect(expense1.reactionCounts).toEqual({
                [ReactionEmojis.LAUGH]: 2,
            });

            // Both users see the same userReactions map
            const expense2 = await appDriver.getExpense(expense.id, user2);
            expect(expense2.userReactions).toEqual(expense1.userReactions);
        });
    });

    describe('group comment reactions', () => {
        it('should add a reaction to a group comment', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const comment = await appDriver.createGroupComment(group.id, 'Test comment', undefined, user1);

            const result = await appDriver.toggleGroupCommentReaction(group.id, comment.id, ReactionEmojis.LAUGH, user1);

            expect(result.action).toBe('added');
            expect(result.emoji).toBe(ReactionEmojis.LAUGH);
            expect(result.newCount).toBe(1);
        });

        it('should toggle off a reaction on a group comment', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const comment = await appDriver.createGroupComment(group.id, 'Test comment', undefined, user1);

            await appDriver.toggleGroupCommentReaction(group.id, comment.id, ReactionEmojis.CELEBRATE, user1);
            const result = await appDriver.toggleGroupCommentReaction(group.id, comment.id, ReactionEmojis.CELEBRATE, user1);

            expect(result.action).toBe('removed');
            expect(result.newCount).toBe(0);
        });

        it('should reject reaction from non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const comment = await appDriver.createGroupComment(group.id, 'Test comment', undefined, user1);

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

        it('should return userReactions in listGroupComments', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const comment = await appDriver.createGroupComment(groupId, 'Test comment', undefined, user1);

            // Add reactions from both users
            await appDriver.toggleGroupCommentReaction(groupId, comment.id, ReactionEmojis.THUMBS_UP, user1);
            await appDriver.toggleGroupCommentReaction(groupId, comment.id, ReactionEmojis.HEART, user1);
            await appDriver.toggleGroupCommentReaction(groupId, comment.id, ReactionEmojis.THUMBS_UP, user2);

            // Verify all users' reactions are visible (new format: Record<UserId, ReactionEmoji[]>)
            const result1 = await appDriver.listGroupComments(groupId, {}, user1);
            const comment1 = result1.comments.find(c => c.id === comment.id);
            expect(comment1?.userReactions).toBeDefined();
            expect(comment1?.userReactions![user1]).toEqual(
                expect.arrayContaining([ReactionEmojis.THUMBS_UP, ReactionEmojis.HEART]),
            );
            expect(comment1?.userReactions![user2]).toEqual([ReactionEmojis.THUMBS_UP]);
            expect(comment1?.reactionCounts).toEqual({
                [ReactionEmojis.THUMBS_UP]: 2,
                [ReactionEmojis.HEART]: 1,
            });

            // Both users see the same userReactions map
            const result2 = await appDriver.listGroupComments(groupId, {}, user2);
            const comment2 = result2.comments.find(c => c.id === comment.id);
            expect(comment2?.userReactions).toEqual(comment1?.userReactions);
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

            const comment = await appDriver.createExpenseComment(expense.id, 'Test comment', undefined, user1);
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

        it('should return userReactions in listExpenseComments', async () => {
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

            const comment = await appDriver.createExpenseComment(expense.id, 'Test expense comment', undefined, user1);

            // Add reactions from both users
            await appDriver.toggleExpenseCommentReaction(expense.id, comment.id, ReactionEmojis.WOW, user1);
            await appDriver.toggleExpenseCommentReaction(expense.id, comment.id, ReactionEmojis.SAD, user1);
            await appDriver.toggleExpenseCommentReaction(expense.id, comment.id, ReactionEmojis.WOW, user2);

            // Verify all users' reactions are visible (new format: Record<UserId, ReactionEmoji[]>)
            const result1 = await appDriver.listExpenseComments(expense.id, {}, user1);
            const comment1 = result1.comments.find(c => c.id === comment.id);
            expect(comment1?.userReactions).toBeDefined();
            expect(comment1?.userReactions![user1]).toEqual(
                expect.arrayContaining([ReactionEmojis.WOW, ReactionEmojis.SAD]),
            );
            expect(comment1?.userReactions![user2]).toEqual([ReactionEmojis.WOW]);
            expect(comment1?.reactionCounts).toEqual({
                [ReactionEmojis.WOW]: 2,
                [ReactionEmojis.SAD]: 1,
            });

            // Both users see the same userReactions map
            const result2 = await appDriver.listExpenseComments(expense.id, {}, user2);
            const comment2 = result2.comments.find(c => c.id === comment.id);
            expect(comment2?.userReactions).toEqual(comment1?.userReactions);
        });
    });

    describe('settlement reactions', () => {
        it('should add a reaction to a settlement', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user1)
                    .withPayeeId(user2)
                    .withAmount(25, USD)
                    .withNote('Test settlement')
                    .build(),
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
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user1)
                    .withPayeeId(user2)
                    .withAmount(25, USD)
                    .withNote('Test settlement')
                    .build(),
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

        it('should return userReactions in listSettlements', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(user1)
                    .withPayeeId(user2)
                    .withAmount(25, USD)
                    .withNote('Test settlement')
                    .build(),
                user1,
            );

            // Add reactions from both users
            await appDriver.toggleSettlementReaction(settlement.id, ReactionEmojis.CELEBRATE, user1);
            await appDriver.toggleSettlementReaction(settlement.id, ReactionEmojis.HEART, user1);
            await appDriver.toggleSettlementReaction(settlement.id, ReactionEmojis.CELEBRATE, user2);

            // Verify all users' reactions are visible (new format: Record<UserId, ReactionEmoji[]>)
            const result1 = await appDriver.listGroupSettlements(groupId, {}, user1);
            const settlement1 = result1.settlements.find(s => s.id === settlement.id);
            expect(settlement1?.userReactions).toBeDefined();
            expect(settlement1?.userReactions![user1]).toEqual(
                expect.arrayContaining([ReactionEmojis.CELEBRATE, ReactionEmojis.HEART]),
            );
            expect(settlement1?.userReactions![user2]).toEqual([ReactionEmojis.CELEBRATE]);
            expect(settlement1?.reactionCounts).toEqual({
                [ReactionEmojis.CELEBRATE]: 2,
                [ReactionEmojis.HEART]: 1,
            });

            // Both users see the same userReactions map
            const result2 = await appDriver.listGroupSettlements(groupId, {}, user2);
            const settlement2 = result2.settlements.find(s => s.id === settlement.id);
            expect(settlement2?.userReactions).toEqual(settlement1?.userReactions);
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

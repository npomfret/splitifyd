import { ActivityFeedActions, ActivityFeedEventTypes, calculateEqualSplits, toAmount, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, GroupUpdateBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('notification system', () => {
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

        await appDriver.updateGroup(group.id, new GroupUpdateBuilder().withName('Updated Name').build(), user1);

        await appDriver.expectNotificationUpdate(user1, group.id, {
            groupDetailsChangeCount: 2,
        });
    });

    it('should create activity feed item when group is created', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Test Group').build(), user1);

        const feed = await appDriver.getActivityFeed({}, user1);

        const groupCreatedItem = feed.items.find(
            (item) => item.eventType === ActivityFeedEventTypes.GROUP_CREATED && item.groupId === group.id,
        );

        expect(groupCreatedItem).toBeDefined();
        expect(groupCreatedItem?.groupName).toBe('Test Group');
        expect(groupCreatedItem?.actorId).toBe(user1);
        expect(groupCreatedItem?.action).toBe(ActivityFeedActions.CREATE);
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

    describe('activity feed endpoint', () => {
        describe('pagination edge cases', () => {
            it('should reject limit of 0', async () => {
                await expect(
                    appDriver.getActivityFeed({ limit: 0 }, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR', data: expect.objectContaining({ detail: 'INVALID_QUERY_PARAMS' }) });
            });

            it('should reject negative limit', async () => {
                await expect(
                    appDriver.getActivityFeed({ limit: -1 }, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR', data: expect.objectContaining({ detail: 'INVALID_QUERY_PARAMS' }) });
            });

            it('should reject limit exceeding maximum (100)', async () => {
                await expect(
                    appDriver.getActivityFeed({ limit: 101 }, user1),
                )
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR', data: expect.objectContaining({ detail: 'INVALID_QUERY_PARAMS' }) });
            });

            it('should handle empty activity feed gracefully', async () => {
                // New user with no activity
                const result = await appDriver.getActivityFeed({}, user1);
                expect(result.items).toEqual([]);
                expect(result.hasMore).toBe(false);
                expect(result.nextCursor).toBeUndefined();
            });

            it('should respect limit parameter', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

                // Create a few activities
                await appDriver.createGroupComment(group.id, 'Comment 1', user1);
                await appDriver.createGroupComment(group.id, 'Comment 2', user1);

                // Request with limit of 1
                const result = await appDriver.getActivityFeed({ limit: 1 }, user1);
                expect(result.items).toHaveLength(1);
            });

            it('should return hasMore=true when more items exist', async () => {
                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

                // Create enough activities
                await appDriver.createGroupComment(group.id, 'Comment 1', user1);
                await appDriver.createGroupComment(group.id, 'Comment 2', user1);
                await appDriver.createGroupComment(group.id, 'Comment 3', user1);

                const result = await appDriver.getActivityFeed({ limit: 2 }, user1);
                expect(result.hasMore).toBe(true);
                expect(result.nextCursor).toBeDefined();
            });

            it('should use default limit when not specified', async () => {
                // Default is 10 per ActivityFeedQuerySchema
                const result = await appDriver.getActivityFeed({}, user1);
                expect(result.items).toBeDefined();
                // Should not throw
            });
        });

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
});

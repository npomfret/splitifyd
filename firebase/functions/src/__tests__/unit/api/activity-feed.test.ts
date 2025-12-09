import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('activity-feed', () => {
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

    describe('user activity feed (GET /activity-feed)', () => {
        it('should return empty activity feed for new user', async () => {
            const response = await appDriver.getActivityFeed({}, user1);
            expect(response.items).toEqual([]);
            expect(response.hasMore).toBe(false);
        });

        it('should return activity after creating a group', async () => {
            await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Test Group').build(), user1);

            const response = await appDriver.getActivityFeed({}, user1);
            expect(response.items.length).toBeGreaterThanOrEqual(1);

            const groupCreatedEvent = response.items.find((item) => item.eventType === 'group-created');
            expect(groupCreatedEvent).toBeDefined();
            expect(groupCreatedEvent?.groupName).toBe('Test Group');
        });
    });

    describe('group activity feed (GET /groups/:groupId/activity-feed)', () => {
        it('should require authentication', async () => {
            await expect(
                appDriver.getGroupActivityFeed('any-group-id' as any, {}, undefined as any),
            )
                .rejects
                .toMatchObject({ code: 'AUTH_REQUIRED' });
        });

        it('should reject non-member access', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            await expect(
                appDriver.getGroupActivityFeed(group.id, {}, user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should return activity for group members', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Activity Test').build(), user1);

            const response = await appDriver.getGroupActivityFeed(group.id, {}, user1);
            expect(response.items.length).toBeGreaterThanOrEqual(1);

            const groupCreatedEvent = response.items.find((item) => item.eventType === 'group-created');
            expect(groupCreatedEvent).toBeDefined();
            expect(groupCreatedEvent?.groupName).toBe('Activity Test');
        });

        it('should only return activity for the specified group', async () => {
            const group1 = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Group One').build(), user1);
            const group2 = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Group Two').build(), user1);

            const response1 = await appDriver.getGroupActivityFeed(group1.id, {}, user1);
            const response2 = await appDriver.getGroupActivityFeed(group2.id, {}, user1);

            expect(response1.items.every((item) => item.groupId === group1.id)).toBe(true);
            expect(response2.items.every((item) => item.groupId === group2.id)).toBe(true);
        });

        it('should record expense activity in group feed', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Team Lunch')
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .build(),
                user1,
            );

            const response = await appDriver.getGroupActivityFeed(group.id, {}, user1);
            const expenseEvent = response.items.find((item) => item.eventType === 'expense-created');
            expect(expenseEvent).toBeDefined();
            expect(expenseEvent?.details?.expenseDescription).toBe('Team Lunch');
        });

        it('should support pagination with limit', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Create multiple expenses to generate activity
            for (let i = 0; i < 5; i++) {
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withDescription(`Expense ${i}`)
                        .withPaidBy(user1)
                        .withParticipants([user1, user2])
                        .build(),
                    user1,
                );
            }

            const response = await appDriver.getGroupActivityFeed(group.id, { limit: 3 }, user1);
            expect(response.items.length).toBeLessThanOrEqual(3);
        });

        it('should allow joined members to access group activity feed', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // user2 should now be able to access the activity feed
            const response = await appDriver.getGroupActivityFeed(group.id, {}, user2);
            expect(response.items.length).toBeGreaterThanOrEqual(1);
        });

        it('should not return duplicate activity items when group has multiple members', async () => {
            // Setup: Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().withName('Dedup Test').build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Create an expense - this records activity for BOTH members
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Shared Dinner')
                    .withPaidBy(user1)
                    .withParticipants([user1, user2])
                    .build(),
                user1,
            );

            // Get the group activity feed
            const response = await appDriver.getGroupActivityFeed(group.id, {}, user1);

            // Count expense-created events for 'Shared Dinner'
            const expenseCreatedEvents = response.items.filter(
                (item) => item.eventType === 'expense-created' && item.details?.expenseDescription === 'Shared Dinner',
            );

            // Each event should appear only once (deduplication working correctly)
            expect(expenseCreatedEvents.length).toBe(1);

            // Also verify no duplicate member-joined events
            const memberJoinedEvents = response.items.filter((item) => item.eventType === 'member-joined');
            const uniqueMemberJoins = new Set(memberJoinedEvents.map((e) => e.details?.targetUserId));
            expect(memberJoinedEvents.length).toBe(uniqueMemberJoins.size);
        });
    });
});

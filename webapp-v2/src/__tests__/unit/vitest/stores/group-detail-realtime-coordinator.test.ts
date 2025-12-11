import type { ActivityFeedRealtimeConsumer } from '@/app/services/activity-feed-realtime-service';
import { GroupDetailRealtimeCoordinator } from '@/app/stores/helpers/group-detail-realtime-coordinator';
import type { GroupId } from '@billsplit-wl/shared';
import { toGroupId, toGroupName, toUserId } from '@billsplit-wl/shared';
import { ActivityFeedItemBuilder, ActivityFeedRealtimePayloadBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface TestContext {
    coordinator: GroupDetailRealtimeCoordinator;
    registerConsumer: ReturnType<typeof vi.fn>;
    deregisterConsumer: ReturnType<typeof vi.fn>;
    onActivityRefresh: ReturnType<typeof vi.fn>;
    onSelfRemoval: ReturnType<typeof vi.fn>;
    setActiveGroup: (groupId: GroupId | null) => void;
    getConsumer: () => ActivityFeedRealtimeConsumer | undefined;
}

const createContext = (): TestContext => {
    let currentGroupId: GroupId | null = null;
    let capturedConsumer: ActivityFeedRealtimeConsumer | undefined;

    const registerConsumer = vi.fn().mockImplementation(async (_id, _userId, consumer: ActivityFeedRealtimeConsumer) => {
        capturedConsumer = consumer;
    });
    const deregisterConsumer = vi.fn();
    const onActivityRefresh = vi.fn().mockResolvedValue(undefined);
    const onSelfRemoval = vi.fn();

    const coordinator = new GroupDetailRealtimeCoordinator({
        activityFeed: {
            registerConsumer,
            deregisterConsumer,
        } as any,
        listenerId: 'group-detail',
        debounceDelay: 10,
        getCurrentGroupId: () => currentGroupId,
        onActivityRefresh,
        onSelfRemoval,
    });

    return {
        coordinator,
        registerConsumer,
        deregisterConsumer,
        onActivityRefresh,
        onSelfRemoval,
        setActiveGroup: (groupId) => {
            currentGroupId = groupId;
        },
        getConsumer: () => capturedConsumer,
    };
};

describe('GroupDetailRealtimeCoordinator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('registers the activity feed consumer for the first component', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, toUserId('user-1'));
        ctx.setActiveGroup(groupId);

        expect(ctx.registerConsumer).toHaveBeenCalledTimes(1);
        expect(ctx.coordinator.getSubscriberCount(groupId)).toBe(1);
    });

    it('increments and decrements subscriber counts per group', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, toUserId('user-1'));
        await ctx.coordinator.registerComponent(groupId, toUserId('user-1'));

        expect(ctx.coordinator.getSubscriberCount(groupId)).toBe(2);

        const remaining = ctx.coordinator.deregisterComponent(groupId);
        expect(remaining).toBe(1);

        ctx.coordinator.deregisterComponent(groupId);
        expect(ctx.coordinator.getSubscriberCount(groupId)).toBe(0);
        expect(ctx.deregisterConsumer).toHaveBeenCalledTimes(1);
    });

    it('invokes onSelfRemoval when the current user is removed from the active group', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, toUserId('user-1'));
        ctx.setActiveGroup(groupId);

        const consumer = ctx.getConsumer();
        expect(consumer).toBeDefined();

        const memberLeftEvent = ActivityFeedItemBuilder
            .memberLeft('event-1', toUserId('user-1'), groupId, toGroupName('Test Group'), 'Test User', 'user-1', toUserId('user-1'))
            .build();

        const payload = new ActivityFeedRealtimePayloadBuilder()
            .withItems([])
            .withNewItems([memberLeftEvent])
            .withHasMore(false)
            .withNullCursor()
            .build();

        consumer?.onUpdate(payload);

        expect(ctx.onSelfRemoval).toHaveBeenCalledWith({
            groupId,
            eventId: 'event-1',
        });
    });

    it('routes other events to the refresh callback when viewing the group', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, toUserId('user-1'));
        ctx.setActiveGroup(groupId);

        const consumer = ctx.getConsumer();
        const expenseCreatedEvent = ActivityFeedItemBuilder
            .expenseCreated('event-2', toUserId('user-1'), groupId, toGroupName('Test Group'), 'Test User', 'Lunch')
            .build();

        const payload = new ActivityFeedRealtimePayloadBuilder()
            .withItems([])
            .withNewItems([expenseCreatedEvent])
            .withHasMore(false)
            .withNullCursor()
            .build();

        consumer?.onUpdate(payload);

        // Advance timers past the debounce delay
        await vi.advanceTimersByTimeAsync(20);

        expect(ctx.onActivityRefresh).toHaveBeenCalledWith({
            groupId,
            eventType: 'expense-created',
            eventId: 'event-2',
        });
    });

    it('ignores events for groups without subscribers', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, toUserId('user-1'));
        ctx.setActiveGroup(groupId);

        const consumer = ctx.getConsumer();
        ctx.coordinator.deregisterComponent(groupId);
        ctx.coordinator.deregisterComponent(groupId); // remove remaining subscriber & deregister

        const expenseCreatedEvent = ActivityFeedItemBuilder
            .expenseCreated('event-3', toUserId('user-1'), groupId, toGroupName('Test Group'), 'Test User', 'Lunch')
            .build();

        const payload = new ActivityFeedRealtimePayloadBuilder()
            .withItems([])
            .withNewItems([expenseCreatedEvent])
            .withHasMore(false)
            .withNullCursor()
            .build();

        consumer?.onUpdate(payload);

        // Advance timers to ensure debounce would have fired if scheduled
        await vi.advanceTimersByTimeAsync(20);

        expect(ctx.onActivityRefresh).not.toHaveBeenCalled();
    });

    it('debounces multiple rapid events into a single refresh', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, toUserId('user-1'));
        ctx.setActiveGroup(groupId);

        const consumer = ctx.getConsumer();

        // Fire multiple events in rapid succession
        for (let i = 0; i < 5; i++) {
            const event = ActivityFeedItemBuilder
                .expenseCreated(`event-${i}`, toUserId('user-1'), groupId, toGroupName('Test Group'), 'Test User', `Expense ${i}`)
                .build();

            const payload = new ActivityFeedRealtimePayloadBuilder()
                .withItems([])
                .withNewItems([event])
                .withHasMore(false)
                .withNullCursor()
                .build();

            consumer?.onUpdate(payload);
        }

        // Advance timers past the debounce delay
        await vi.advanceTimersByTimeAsync(20);

        // Should only have been called once despite 5 events
        expect(ctx.onActivityRefresh).toHaveBeenCalledTimes(1);
    });
});

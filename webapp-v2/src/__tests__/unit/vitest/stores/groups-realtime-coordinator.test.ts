import type { ActivityFeedRealtimeConsumer } from '@/app/services/activity-feed-realtime-service';
import { GroupsRealtimeCoordinator } from '@/app/stores/helpers/groups-realtime-coordinator';
import { type GroupId, toGroupId, toGroupName, toUserId } from '@billsplit-wl/shared';
import { ActivityFeedItemBuilder, ActivityFeedRealtimePayloadBuilder } from '@billsplit-wl/test-support';
import { signal } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface TestContext {
    coordinator: GroupsRealtimeCoordinator;
    registerConsumer: ReturnType<typeof vi.fn>;
    deregisterConsumer: ReturnType<typeof vi.fn>;
    onRefresh: ReturnType<typeof vi.fn>;
    onGroupRemoval: ReturnType<typeof vi.fn>;
    getConsumer: () => ActivityFeedRealtimeConsumer | undefined;
}

const createContext = (): TestContext => {
    let capturedConsumer: ActivityFeedRealtimeConsumer | undefined;

    const registerConsumer = vi.fn().mockImplementation(async (_id, _userId, consumer: ActivityFeedRealtimeConsumer) => {
        capturedConsumer = consumer;
    });
    const deregisterConsumer = vi.fn();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onGroupRemoval = vi.fn();

    const coordinator = new GroupsRealtimeCoordinator({
        activityFeed: {
            registerConsumer,
            deregisterConsumer,
        } as any,
        listenerId: 'groups',
        debounceDelay: 10,
        isRefreshingSignal: signal(false),
        onRefresh,
        onGroupRemoval,
    });

    return {
        coordinator,
        registerConsumer,
        deregisterConsumer,
        onRefresh,
        onGroupRemoval,
        getConsumer: () => capturedConsumer,
    };
};

describe('GroupsRealtimeCoordinator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    const userId = toUserId('user-1');

    it('registers the activity feed consumer on first component and schedules refresh', async () => {
        const ctx = createContext();

        ctx.coordinator.registerComponent('component-1', userId);
        await Promise.resolve(); // allow setupSubscription promise to resolve

        expect(ctx.registerConsumer).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10);

        expect(ctx.onRefresh).toHaveBeenCalledTimes(1);
    });

    it('does not double-register for additional components with same user', async () => {
        const ctx = createContext();

        ctx.coordinator.registerComponent('component-1', userId);
        ctx.coordinator.registerComponent('component-2', userId);
        await Promise.resolve();

        expect(ctx.registerConsumer).toHaveBeenCalledTimes(1);
    });

    it('deregisters the consumer when the last component is removed', async () => {
        const ctx = createContext();

        ctx.coordinator.registerComponent('component-1', userId);
        ctx.coordinator.registerComponent('component-2', userId);
        await Promise.resolve();

        ctx.coordinator.deregisterComponent('component-1');
        expect(ctx.deregisterConsumer).not.toHaveBeenCalled();

        ctx.coordinator.deregisterComponent('component-2');
        expect(ctx.deregisterConsumer).toHaveBeenCalledTimes(1);
    });

    it('invokes onGroupRemoval when the current user leaves a group', async () => {
        const ctx = createContext();
        const groupId: GroupId = toGroupId('group-1');

        ctx.coordinator.registerComponent('component-1', userId);
        await Promise.resolve();

        const consumer = ctx.getConsumer();
        expect(consumer).toBeDefined();

        const memberLeftEvent = ActivityFeedItemBuilder
            .memberLeft('event-1', userId, groupId, toGroupName('Test Group'), 'User One', 'User One', userId)
            .build();

        const payload = new ActivityFeedRealtimePayloadBuilder()
            .withItems([])
            .withNewItems([memberLeftEvent])
            .withHasMore(false)
            .withNullCursor()
            .build();

        consumer?.onUpdate(payload);

        expect(ctx.onGroupRemoval).toHaveBeenCalledWith(groupId, 'User One');
    });

    it('triggers a refresh when other activity events arrive', async () => {
        const ctx = createContext();

        ctx.coordinator.registerComponent('component-1', userId);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(10);
        ctx.onRefresh.mockClear();

        const consumer = ctx.getConsumer();

        const expenseCreatedEvent = ActivityFeedItemBuilder
            .expenseCreated('event-2', userId, toGroupId('group-1'), toGroupName('Test Group'), 'Test User', 'Test Expense')
            .build();

        const payload = new ActivityFeedRealtimePayloadBuilder()
            .withItems([])
            .withNewItems([expenseCreatedEvent])
            .withHasMore(false)
            .withNullCursor()
            .build();

        consumer?.onUpdate(payload);

        await vi.advanceTimersByTimeAsync(10);
        expect(ctx.onRefresh).toHaveBeenCalledTimes(1);
    });
});

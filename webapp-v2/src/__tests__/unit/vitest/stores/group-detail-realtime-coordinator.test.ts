import { describe, expect, it, vi } from 'vitest';
import type { ActivityFeedRealtimeConsumer, ActivityFeedRealtimePayload, ActivityFeedRealtimeService } from '@/app/services/activity-feed-realtime-service';
import { GroupDetailRealtimeCoordinator } from '@/app/stores/helpers/group-detail-realtime-coordinator';
import type { GroupId } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';

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

    const activityFeed = {
        registerConsumer,
        deregisterConsumer,
    } as unknown as ActivityFeedRealtimeService;

    const coordinator = new GroupDetailRealtimeCoordinator({
        activityFeed: {
            registerConsumer,
            deregisterConsumer,
        } as any,
        listenerId: 'group-detail',
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
    it('registers the activity feed consumer for the first component', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, 'user-1');
        ctx.setActiveGroup(groupId);

        expect(ctx.registerConsumer).toHaveBeenCalledTimes(1);
        expect(ctx.coordinator.getSubscriberCount(groupId)).toBe(1);
    });

    it('increments and decrements subscriber counts per group', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, 'user-1');
        await ctx.coordinator.registerComponent(groupId, 'user-1');

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

        await ctx.coordinator.registerComponent(groupId, 'user-1');
        ctx.setActiveGroup(groupId);

        const consumer = ctx.getConsumer();
        expect(consumer).toBeDefined();

        const payload: ActivityFeedRealtimePayload = {
            items: [],
            newItems: [
                {
                    id: 'event-1',
                    eventType: 'member-left',
                    groupId,
                    details: { targetUserId: 'user-1' },
                } as any,
            ],
            hasMore: false,
            nextCursor: null,
        };

        consumer?.onUpdate(payload);

        expect(ctx.onSelfRemoval).toHaveBeenCalledWith({
            groupId,
            eventId: 'event-1',
        });
    });

    it('routes other events to the refresh callback when viewing the group', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, 'user-1');
        ctx.setActiveGroup(groupId);

        const consumer = ctx.getConsumer();
        const payload: ActivityFeedRealtimePayload = {
            items: [],
            newItems: [
                {
                    id: 'event-2',
                    eventType: 'expense-created',
                    groupId,
                    details: {},
                } as any,
            ],
            hasMore: false,
            nextCursor: null,
        };

        consumer?.onUpdate(payload);

        expect(ctx.onActivityRefresh).toHaveBeenCalledWith({
            groupId,
            eventType: 'expense-created',
            eventId: 'event-2',
        });
    });

    it('ignores events for groups without subscribers', async () => {
        const ctx = createContext();
        const groupId = toGroupId('group-1');

        await ctx.coordinator.registerComponent(groupId, 'user-1');
        ctx.setActiveGroup(groupId);

        const consumer = ctx.getConsumer();
        ctx.coordinator.deregisterComponent(groupId);
        ctx.coordinator.deregisterComponent(groupId); // remove remaining subscriber & deregister

        consumer?.onUpdate({
            items: [],
            newItems: [
                {
                    id: 'event-3',
                    eventType: 'expense-created',
                    groupId,
                    details: {},
                } as any,
            ],
            hasMore: false,
            nextCursor: null,
        });

        expect(ctx.onActivityRefresh).not.toHaveBeenCalled();
    });
});

import type { ActivityFeedRealtimeConsumer, ActivityFeedRealtimePayload, ActivityFeedRealtimeService } from '@/app/services/activity-feed-realtime-service';
import { ActivityFeedStoreImpl } from '@/app/stores/activity-feed-store';
import { type ActivityFeedItem, toGroupId, toGroupName, toUserId, type UserId } from '@billsplit-wl/shared';
import { ActivityFeedItemBuilder, ActivityFeedRealtimePayloadBuilder, ActivityFeedResponseBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/app/apiClient', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/app/apiClient')>();
    return {
        ...actual,
        apiClient: {
            getActivityFeed: vi.fn(),
        },
    };
});

vi.mock('@/utils/browser-logger', () => ({
    logError: vi.fn(),
    logWarning: vi.fn(),
}));

import { apiClient } from '@/app/apiClient';

const mockedApiClient = apiClient as unknown as {
    getActivityFeed: Mock;
};

const baseTimestamp = new Date('2024-01-01T12:00:00.000Z').getTime();

function minutesAgo(minutes: number): string {
    return new Date(baseTimestamp - minutes * 60_000).toISOString();
}

function buildItem(id: string, minutes: number, overrides?: Partial<ActivityFeedItem>): ActivityFeedItem {
    const timestamp = minutesAgo(minutes);
    const baseItem = ActivityFeedItemBuilder
        .create()
        .withId(id)
        .withUserId(toUserId('user-1'))
        .withGroupId(toGroupId('group-1'))
        .withGroupName(toGroupName('Brunch Buddies'))
        .withActorName('Ada Lovelace')
        .withTimestamp(timestamp)
        .withCreatedAt(timestamp)
        .build();

    return {
        ...baseItem,
        ...overrides,
    };
}

class ActivityFeedRealtimeServiceStub {
    public registerConsumer = vi.fn(async (_id: string, _userId: UserId | null, consumer: ActivityFeedRealtimeConsumer) => {
        this.consumer = consumer;
    });

    public deregisterConsumer = vi.fn((_id: string) => {
        this.consumer = null;
    });

    public reset = vi.fn();

    private consumer: ActivityFeedRealtimeConsumer | null = null;

    emit(update: ActivityFeedRealtimePayload) {
        this.consumer?.onUpdate(update);
    }

    emitError(error: Error) {
        this.consumer?.onError?.(error);
    }
}

describe('ActivityFeedStoreImpl', () => {
    let realtimeStub: ActivityFeedRealtimeServiceStub;
    let store: ActivityFeedStoreImpl;

    beforeEach(() => {
        realtimeStub = new ActivityFeedRealtimeServiceStub();
        store = new ActivityFeedStoreImpl(realtimeStub as unknown as ActivityFeedRealtimeService);
        mockedApiClient.getActivityFeed.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Pagination with Real-time Updates', () => {
        it('preserves paginated items when realtime snapshot updates the first page', () => {
            const initialItems = Array.from({ length: 10 }, (_, index) => buildItem(`item-${index}`, index));
            const olderItems = [buildItem('older-0', 10), buildItem('older-1', 11), buildItem('older-2', 12)];

            const initialResponse = new ActivityFeedResponseBuilder()
                .withItems(initialItems)
                .withHasMore(true)
                .withNextCursor(initialItems[initialItems.length - 1]!.id)
                .build();

            const loadMoreResponse = new ActivityFeedResponseBuilder()
                .withItems(olderItems)
                .withHasMore(false)
                .withoutNextCursor()
                .build();

            (store as any).applyInitialResponse(initialResponse, true);
            (store as any).applyLoadMoreResponse(loadMoreResponse);

            expect(store.items).toHaveLength(13);

            const newTopItem = buildItem('realtime-new', -1);
            const realtimeFirstPage = [newTopItem, ...initialItems.slice(0, 9)];
            const realtimeUpdate = new ActivityFeedRealtimePayloadBuilder()
                .withItems(realtimeFirstPage)
                .withNewItems([newTopItem])
                .withHasMore(true)
                .withNextCursor(realtimeFirstPage[realtimeFirstPage.length - 1]!.id)
                .build();

            (store as any).handleRealtimeUpdate(realtimeUpdate);

            const expectedOrder = [...realtimeFirstPage, initialItems[9]!, ...olderItems];

            expect(store.items).toEqual(expectedOrder);
        });

        it('merges load more response without duplicates', () => {
            const initialItems = Array.from({ length: 10 }, (_, index) => buildItem(`item-${index}`, index));

            const initialResponse = new ActivityFeedResponseBuilder()
                .withItems(initialItems)
                .withHasMore(true)
                .withNextCursor('item-9')
                .build();

            (store as any).applyInitialResponse(initialResponse, true);

            const olderItems = [buildItem('older-0', 10), buildItem('item-9', 9), buildItem('older-1', 11)];

            const loadMoreResponse = new ActivityFeedResponseBuilder()
                .withItems(olderItems)
                .withHasMore(false)
                .withoutNextCursor()
                .build();

            (store as any).applyLoadMoreResponse(loadMoreResponse);

            expect(store.items).toHaveLength(12);
            expect(store.items.filter((item) => item.id === 'item-9')).toHaveLength(1);
        });
    });

    describe('Component Registration Lifecycle', () => {
        it('initializes on first component registration', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: false,
                nextCursor: undefined,
            });

            await store.registerComponent('comp-1', toUserId('user-1'));

            expect(realtimeStub.registerConsumer).toHaveBeenCalledTimes(1);
            expect(realtimeStub.registerConsumer).toHaveBeenCalledWith(
                'activity-feed-store',
                toUserId('user-1'),
                expect.objectContaining({ onUpdate: expect.any(Function) }),
            );
            expect(mockedApiClient.getActivityFeed).toHaveBeenCalledTimes(1);
            expect(store.initialized).toBe(true);
            expect(store.items).toEqual(items);
        });

        it('does not reinitialize when second component registers', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: false,
                nextCursor: undefined,
            });

            await store.registerComponent('comp-1', toUserId('user-1'));
            await store.registerComponent('comp-2', toUserId('user-1'));

            expect(realtimeStub.registerConsumer).toHaveBeenCalledTimes(1);
            expect(mockedApiClient.getActivityFeed).toHaveBeenCalledTimes(1);
        });

        it('tears down subscription when all components deregister', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: false,
                nextCursor: undefined,
            });

            await store.registerComponent('comp-1', toUserId('user-1'));
            await store.registerComponent('comp-2', toUserId('user-1'));

            store.deregisterComponent('comp-1');
            store.deregisterComponent('comp-2');
            expect(realtimeStub.deregisterConsumer).toHaveBeenCalledTimes(1);
            expect(realtimeStub.deregisterConsumer).toHaveBeenCalledWith('activity-feed-store');
        });
    });

    describe('Error Handling', () => {
        it('sets error state when API fetch fails', async () => {
            const error = new Error('Network error');
            mockedApiClient.getActivityFeed.mockRejectedValue(error);

            await expect(store.registerComponent('comp-1', toUserId('user-1'))).rejects.toThrow('Network error');

            expect(store.error).toBe('Network error');
            expect(store.initialized).toBe(false);
        });

        it('sets error state when loadMore fails', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient
                .getActivityFeed
                .mockResolvedValueOnce({
                    items,
                    hasMore: true,
                    nextCursor: '1',
                })
                .mockRejectedValueOnce(new Error('Load more failed'));

            await store.registerComponent('comp-1', toUserId('user-1'));

            await store.loadMore();

            expect(store.error).toBe('Load more failed');
            expect(store.loadingMore).toBe(false);
        });

        it('allows retry after initialization failure', async () => {
            mockedApiClient
                .getActivityFeed
                .mockRejectedValueOnce(new Error('First attempt failed'))
                .mockResolvedValueOnce({ items: [buildItem('1', 1)], hasMore: false, nextCursor: undefined });

            await expect(store.registerComponent('comp-1', toUserId('user-1'))).rejects.toThrow('First attempt failed');

            expect(store.error).toBe('First attempt failed');
            expect(store.initialized).toBe(false);
        });
    });

    describe('Load More', () => {
        it('prevents concurrent load more operations', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: true,
                nextCursor: '1',
            });

            await store.registerComponent('comp-1', toUserId('user-1'));

            const loadMore1 = store.loadMore();
            const loadMore2 = store.loadMore();

            await Promise.all([loadMore1, loadMore2]);

            expect(mockedApiClient.getActivityFeed).toHaveBeenCalledTimes(2);
        });

        it('does not load more when hasMore is false', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: false,
                nextCursor: undefined,
            });

            await store.registerComponent('comp-1', toUserId('user-1'));

            await store.loadMore();

            expect(mockedApiClient.getActivityFeed).toHaveBeenCalledTimes(1);
        });

        it('does not load more when no cursor available', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: true,
                nextCursor: undefined,
            });

            await store.registerComponent('comp-1', toUserId('user-1'));

            await store.loadMore();

            expect(mockedApiClient.getActivityFeed).toHaveBeenCalledTimes(1);
        });
    });

    describe('Empty State', () => {
        it('handles empty initial response', async () => {
            mockedApiClient.getActivityFeed.mockResolvedValue(
                new ActivityFeedResponseBuilder()
                    .withItems([])
                    .withHasMore(false)
                    .withoutNextCursor()
                    .build(),
            );

            await store.registerComponent('comp-1', toUserId('user-1'));

            expect(store.items).toEqual([]);
            expect(store.initialized).toBe(true);
            expect(store.hasMore).toBe(false);
        });

        it('sets initialized when realtime update is empty', () => {
            const update = new ActivityFeedRealtimePayloadBuilder()
                .withItems([])
                .withNewItems([])
                .withHasMore(false)
                .withNullCursor()
                .build();

            (store as any).handleRealtimeUpdate(update);

            expect(store.initialized).toBe(true);
            expect(store.items).toEqual([]);
        });
    });

    describe('Reset', () => {
        it('clears all state and subscriptions', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue(
                new ActivityFeedResponseBuilder()
                    .withItems(items)
                    .withHasMore(true)
                    .withNextCursor('1')
                    .build(),
            );

            await store.registerComponent('comp-1', toUserId('user-1'));

            store.reset();

            expect(store.items).toEqual([]);
            expect(store.initialized).toBe(false);
            expect(store.loading).toBe(false);
            expect(store.error).toBe(null);
            expect(store.hasMore).toBe(false);
            expect(realtimeStub.deregisterConsumer).toHaveBeenCalledWith('activity-feed-store');
        });
    });
});

import type { ActivityFeedGateway, ActivityFeedRealtimeUpdate } from '@/app/gateways/activity-feed-gateway';
import { ActivityFeedStoreImpl } from '@/app/stores/activity-feed-store';
import {ActivityFeedActions, ActivityFeedEventTypes, type ActivityFeedItem, type ActivityFeedResponse, toGroupId} from '@splitifyd/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/app/apiClient', () => ({
    apiClient: {
        getActivityFeed: vi.fn(),
    },
}));

vi.mock('@/utils/browser-logger', () => ({
    logInfo: vi.fn(),
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
    return {
        id,
        userId: 'user-1',
        groupId: toGroupId('group-1'),
        groupName: 'Brunch Buddies',
        eventType: ActivityFeedEventTypes.EXPENSE_CREATED,
        action: ActivityFeedActions.CREATE,
        actorId: 'actor-1',
        actorName: 'Ada Lovelace',
        timestamp,
        details: {},
        createdAt: timestamp,
        ...overrides,
    };
}

function createActivityFeedGatewayStub(): ActivityFeedGateway {
    return {
        connect: vi.fn().mockResolvedValue(undefined),
        subscribeToFeed: vi.fn().mockReturnValue(() => {}),
    };
}

describe('ActivityFeedStoreImpl', () => {
    let gatewayStub: ActivityFeedGateway;
    let store: ActivityFeedStoreImpl;

    beforeEach(() => {
        gatewayStub = createActivityFeedGatewayStub();
        store = new ActivityFeedStoreImpl(gatewayStub);
        mockedApiClient.getActivityFeed.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Pagination with Real-time Updates', () => {
        it('preserves paginated items when realtime snapshot updates the first page', () => {
            const initialItems = Array.from({ length: 10 }, (_, index) => buildItem(`item-${index}`, index));
            const olderItems = [buildItem('older-0', 10), buildItem('older-1', 11), buildItem('older-2', 12)];

            const initialResponse: ActivityFeedResponse = {
                items: initialItems,
                hasMore: true,
                nextCursor: initialItems[initialItems.length - 1]!.id,
            };

            const loadMoreResponse: ActivityFeedResponse = {
                items: olderItems,
                hasMore: false,
                nextCursor: undefined,
            };

            (store as any).applyInitialResponse(initialResponse, true);
            (store as any).applyLoadMoreResponse(loadMoreResponse);

            expect(store.items).toHaveLength(13);

            const newTopItem = buildItem('realtime-new', -1);
            const realtimeFirstPage = [newTopItem, ...initialItems.slice(0, 9)];
            const realtimeUpdate: ActivityFeedRealtimeUpdate = {
                items: realtimeFirstPage,
                hasMore: true,
                nextCursor: realtimeFirstPage[realtimeFirstPage.length - 1]!.id,
            };

            (store as any).handleRealtimeUpdate(realtimeUpdate);

            const expectedOrder = [...realtimeFirstPage, initialItems[9]!, ...olderItems];

            expect(store.items).toEqual(expectedOrder);
        });

        it('merges load more response without duplicates', () => {
            const initialItems = Array.from({ length: 10 }, (_, index) => buildItem(`item-${index}`, index));

            const initialResponse: ActivityFeedResponse = {
                items: initialItems,
                hasMore: true,
                nextCursor: 'item-9',
            };

            (store as any).applyInitialResponse(initialResponse, true);

            const olderItems = [buildItem('older-0', 10), buildItem('item-9', 9), buildItem('older-1', 11)];

            const loadMoreResponse: ActivityFeedResponse = {
                items: olderItems,
                hasMore: false,
                nextCursor: undefined,
            };

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

            (gatewayStub.subscribeToFeed as Mock).mockReturnValue(() => {});

            await store.registerComponent('comp-1', 'user-1');

            expect(gatewayStub.connect).toHaveBeenCalledTimes(1);
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

            (gatewayStub.subscribeToFeed as Mock).mockReturnValue(() => {});

            await store.registerComponent('comp-1', 'user-1');
            await store.registerComponent('comp-2', 'user-1');

            expect(gatewayStub.connect).toHaveBeenCalledTimes(1);
            expect(mockedApiClient.getActivityFeed).toHaveBeenCalledTimes(1);
        });

        it('tears down subscription when all components deregister', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: false,
                nextCursor: undefined,
            });

            const unsubscribeMock = vi.fn();
            (gatewayStub.subscribeToFeed as Mock).mockReturnValue(unsubscribeMock);

            await store.registerComponent('comp-1', 'user-1');
            await store.registerComponent('comp-2', 'user-1');

            store.deregisterComponent('comp-1');
            expect(unsubscribeMock).not.toHaveBeenCalled();

            store.deregisterComponent('comp-2');
            expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('Listener Notifications', () => {
        it('notifies listeners when new items arrive via realtime', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: false,
                nextCursor: undefined,
            });

            const listenerCallback = vi.fn();
            (gatewayStub.subscribeToFeed as Mock).mockReturnValue(() => {});
            await store.registerListener('listener-1', 'user-1', listenerCallback);

            const newItem = buildItem('new-item', -1);
            const update: ActivityFeedRealtimeUpdate = {
                items: [newItem, ...items],
                hasMore: false,
                nextCursor: null,
            };

            (store as any).handleRealtimeUpdate(update);

            expect(listenerCallback).toHaveBeenCalledTimes(1);
            expect(listenerCallback).toHaveBeenCalledWith(newItem);
        });

        it('does not notify listeners for items already in the feed', async () => {
            const items = [buildItem('1', 1), buildItem('2', 2)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: false,
                nextCursor: undefined,
            });

            const listenerCallback = vi.fn();
            (gatewayStub.subscribeToFeed as Mock).mockReturnValue(() => {});
            await store.registerListener('listener-1', 'user-1', listenerCallback);

            const update: ActivityFeedRealtimeUpdate = {
                items,
                hasMore: false,
                nextCursor: null,
            };

            (store as any).handleRealtimeUpdate(update);

            expect(listenerCallback).not.toHaveBeenCalled();
        });

        it('tears down subscription when all listeners deregister', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: false,
                nextCursor: undefined,
            });

            const unsubscribeMock = vi.fn();
            (gatewayStub.subscribeToFeed as Mock).mockReturnValue(unsubscribeMock);

            await store.registerListener('listener-1', 'user-1', vi.fn());
            await store.registerListener('listener-2', 'user-1', vi.fn());

            store.deregisterListener('listener-1');
            expect(unsubscribeMock).not.toHaveBeenCalled();

            store.deregisterListener('listener-2');
            expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error Handling', () => {
        it('sets error state when API fetch fails', async () => {
            const error = new Error('Network error');
            mockedApiClient.getActivityFeed.mockRejectedValue(error);

            await expect(store.registerComponent('comp-1', 'user-1')).rejects.toThrow('Network error');

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

            await store.registerComponent('comp-1', 'user-1');

            await store.loadMore();

            expect(store.error).toBe('Load more failed');
            expect(store.loadingMore).toBe(false);
        });

        it('allows retry after initialization failure', async () => {
            mockedApiClient
                .getActivityFeed
                .mockRejectedValueOnce(new Error('First attempt failed'))
                .mockResolvedValueOnce({ items: [buildItem('1', 1)], hasMore: false, nextCursor: undefined });

            await expect(store.registerComponent('comp-1', 'user-1')).rejects.toThrow('First attempt failed');

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

            await store.registerComponent('comp-1', 'user-1');

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

            await store.registerComponent('comp-1', 'user-1');

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

            await store.registerComponent('comp-1', 'user-1');

            await store.loadMore();

            expect(mockedApiClient.getActivityFeed).toHaveBeenCalledTimes(1);
        });
    });

    describe('Empty State', () => {
        it('handles empty initial response', async () => {
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items: [],
                hasMore: false,
                nextCursor: undefined,
            });

            await store.registerComponent('comp-1', 'user-1');

            expect(store.items).toEqual([]);
            expect(store.initialized).toBe(true);
            expect(store.hasMore).toBe(false);
        });

        it('sets initialized when realtime update is empty', () => {
            const update: ActivityFeedRealtimeUpdate = {
                items: [],
                hasMore: false,
                nextCursor: null,
            };

            (store as any).handleRealtimeUpdate(update);

            expect(store.initialized).toBe(true);
            expect(store.items).toEqual([]);
        });
    });

    describe('Reset', () => {
        it('clears all state and subscriptions', async () => {
            const items = [buildItem('1', 1)];
            mockedApiClient.getActivityFeed.mockResolvedValue({
                items,
                hasMore: true,
                nextCursor: '1',
            });

            const unsubscribeMock = vi.fn();
            (gatewayStub.subscribeToFeed as Mock).mockReturnValue(unsubscribeMock);

            await store.registerComponent('comp-1', 'user-1');

            store.reset();

            expect(store.items).toEqual([]);
            expect(store.initialized).toBe(false);
            expect(store.loading).toBe(false);
            expect(store.error).toBe(null);
            expect(store.hasMore).toBe(false);
            expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        });
    });
});

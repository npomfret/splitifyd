import { describe, expect, it, vi } from 'vitest';
import type { FirebaseService } from '@/app/firebase';
import { ActivityFeedStoreImpl } from '@/app/stores/activity-feed-store';
import { ActivityFeedEventTypes, type ActivityFeedItem, type ActivityFeedResponse } from '@splitifyd/shared';

const baseTimestamp = new Date('2024-01-01T12:00:00.000Z').getTime();

function minutesAgo(minutes: number): string {
    return new Date(baseTimestamp - minutes * 60_000).toISOString();
}

function buildItem(id: string, minutes: number): ActivityFeedItem {
    const timestamp = minutesAgo(minutes);
    return {
        id,
        userId: 'user-1',
        groupId: 'group-1',
        groupName: 'Brunch Buddies',
        eventType: ActivityFeedEventTypes.EXPENSE_CREATED,
        actorId: 'actor-1',
        actorName: 'Ada Lovelace',
        timestamp,
        details: {},
        createdAt: timestamp,
    };
}

function toDoc(item: ActivityFeedItem) {
    return {
        id: item.id,
        data: () => ({
            userId: item.userId,
            groupId: item.groupId,
            groupName: item.groupName,
            eventType: item.eventType,
            actorId: item.actorId,
            actorName: item.actorName,
            timestamp: item.timestamp,
            details: item.details,
            createdAt: item.createdAt,
        }),
    };
}

const firebaseServiceStub: FirebaseService = {
    connect: vi.fn().mockResolvedValue(undefined),
    performTokenRefresh: vi.fn().mockResolvedValue('token'),
    performUserRefresh: vi.fn().mockResolvedValue(undefined),
    getCurrentUserId: vi.fn().mockReturnValue(null),
    signInWithEmailAndPassword: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChanged: vi.fn().mockReturnValue(() => {}),
    onDocumentSnapshot: vi.fn().mockReturnValue(() => {}),
    onCollectionSnapshot: vi.fn().mockReturnValue(() => {}),
};

describe('ActivityFeedStoreImpl', () => {
    it('preserves paginated items when realtime snapshot updates the first page', () => {
        const store = new ActivityFeedStoreImpl(firebaseServiceStub);

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
        const extraDocument = buildItem('extra', 9.5);

        const snapshot = {
            docs: [...realtimeFirstPage.map(toDoc), toDoc(extraDocument)],
        };

        (store as any).handleRealtimeSnapshot(snapshot);

        const expectedOrder = [
            ...realtimeFirstPage,
            initialItems[9]!,
            ...olderItems,
        ];

        expect(store.items).toEqual(expectedOrder);
    });
});

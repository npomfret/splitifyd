import { logError } from '@/utils/browser-logger';
import { type ActivityFeedItem, type ISOString, toISOString, type UserId } from '@splitifyd/shared';
import { documentId, Timestamp } from 'firebase/firestore';
import type { FirebaseService } from '../firebase';
import { getFirebaseService } from '../firebase';
import { deriveActivityFeedAction, normalizeActivityFeedItem } from '../utils/activity-feed-utils';

export interface ActivityFeedRealtimeUpdate {
    items: ActivityFeedItem[];
    hasMore: boolean;
    nextCursor: string | null;
}

export interface ActivityFeedGateway {
    connect(): Promise<void>;
    subscribeToFeed(
        userId: UserId,
        limit: number,
        onUpdate: (update: ActivityFeedRealtimeUpdate) => void,
        onError: (error: Error) => void,
    ): () => void;
}

class FirebaseActivityFeedGateway implements ActivityFeedGateway {
    constructor(private readonly firebaseService: FirebaseService) {}

    async connect(): Promise<void> {
        await this.firebaseService.connect();
    }

    subscribeToFeed(
        userId: UserId,
        limit: number,
        onUpdate: (update: ActivityFeedRealtimeUpdate) => void,
        onError: (error: Error) => void,
    ): () => void {
        return this.firebaseService.onCollectionSnapshot(
            ['activity-feed', userId, 'items'],
            {
                orderBy: [
                    { field: 'createdAt', direction: 'desc' },
                    { field: documentId(), direction: 'desc' },
                ],
                limit: limit + 1,
            },
            (snapshot: any) => {
                try {
                    const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
                    const parsed = docs
                        .map((docSnapshot: any) => this.convertDocSnapshot(docSnapshot))
                        .filter((item: ActivityFeedItem | null): item is ActivityFeedItem => item !== null);

                    const hasMore = parsed.length > limit;
                    const trimmed = hasMore ? parsed.slice(0, limit) : parsed;
                    const normalized = trimmed.map(normalizeActivityFeedItem);
                    const nextCursor = hasMore && normalized.length > 0 ? normalized[normalized.length - 1]!.id : null;

                    onUpdate({
                        items: normalized,
                        hasMore,
                        nextCursor,
                    });
                } catch (error) {
                    logError('ActivityFeedGateway: failed to process realtime snapshot', error);
                    onError(error instanceof Error ? error : new Error(String(error)));
                }
            },
            onError,
        );
    }

    private convertDocSnapshot(docSnapshot: any): ActivityFeedItem | null {
        try {
            const data = typeof docSnapshot?.data === 'function' ? docSnapshot.data() : docSnapshot?.data;
            if (!data) {
                return null;
            }

            const timestamp = this.toISOString(data.timestamp, 'timestamp');
            if (!timestamp) {
                throw new Error('Activity feed document missing timestamp');
            }
            const createdAt = this.toISOString(data.createdAt, 'createdAt', true);
            const action = typeof data.action === 'string'
                ? (data.action as ActivityFeedItem['action'])
                : deriveActivityFeedAction(data.eventType);

            return {
                id: docSnapshot.id,
                userId: data.userId,
                groupId: data.groupId,
                groupName: data.groupName,
                eventType: data.eventType,
                action,
                actorId: data.actorId,
                actorName: data.actorName,
                timestamp,
                details: typeof data.details === 'object' && data.details !== null ? { ...data.details } : {},
                createdAt: createdAt ?? undefined,
            };
        } catch (error) {
            logError('ActivityFeedGateway: failed to parse realtime document', error, {
                docId: docSnapshot?.id,
            });
            return null;
        }
    }

    /**
     * @deprecated
     * we ALWAYS know what the type is - this bulllshit is not needed
     */
    private toISOString(value: unknown, field: string, optional: boolean = false): ISOString | null {
        if (value instanceof Timestamp) {
            return toISOString(value.toDate().toISOString());
        }

        if (typeof value === 'string') {
            return toISOString(value);
        }

        if (optional && (value === null || value === undefined)) {
            return null;
        }

        throw new Error(`Activity feed document missing ${field}`);
    }
}

const defaultActivityFeedGateway = new FirebaseActivityFeedGateway(getFirebaseService());

export const getDefaultActivityFeedGateway = (): ActivityFeedGateway => defaultActivityFeedGateway;

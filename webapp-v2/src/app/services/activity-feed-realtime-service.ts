import { logError, logWarning } from '@/utils/browser-logger.ts';
import type { ActivityFeedItem, UserId } from '@billsplit-wl/shared';
import { type ActivityFeedGateway, type ActivityFeedRealtimeUpdate, getDefaultActivityFeedGateway } from '../gateways/activity-feed-gateway';

export interface ActivityFeedRealtimePayload {
    items: ActivityFeedItem[];
    newItems: ActivityFeedItem[];
    hasMore: boolean;
    nextCursor: string | null;
}

export interface ActivityFeedRealtimeConsumer {
    onUpdate: (payload: ActivityFeedRealtimePayload) => void;
    onError?: (error: Error) => void;
}

export const ACTIVITY_FEED_PAGE_SIZE = 10;

class ActivityFeedRealtimeService {
    private readonly consumers = new Map<string, { userId: UserId; consumer: ActivityFeedRealtimeConsumer; }>();
    private realtimeUnsubscribe: (() => void) | null = null;
    private currentUserId: UserId | null = null;
    private initializationPromise: Promise<void> | null = null;
    private readonly seenItemIds = new Set<string>();

    constructor(private readonly gateway: ActivityFeedGateway) {}

    /**
     * Register a consumer for realtime activity feed updates.
     */
    async registerConsumer(consumerId: string, userId: UserId | null, consumer: ActivityFeedRealtimeConsumer): Promise<void> {
        const effectiveUserId = userId ?? this.currentUserId;

        if (!effectiveUserId) {
            throw new Error('Cannot register activity feed consumer without a known user id');
        }

        this.consumers.set(consumerId, { userId: effectiveUserId, consumer });

        if (this.currentUserId && this.currentUserId !== effectiveUserId) {
            logWarning('ActivityFeedRealtimeService: switching realtime subscription to new user', {
                previousUserId: this.currentUserId,
                nextUserId: effectiveUserId,
            });
            await this.restartSubscription(effectiveUserId);
            return;
        }

        await this.ensureSubscription(effectiveUserId);
    }

    /**
     * Deregister a previously registered consumer.
     */
    deregisterConsumer(consumerId: string): void {
        this.consumers.delete(consumerId);

        if (this.consumers.size === 0) {
            this.teardownSubscription();
        }
    }

    /**
     * Reset service state (primarily for tests).
     */
    reset(): void {
        this.consumers.clear();
        this.teardownSubscription();
        this.seenItemIds.clear();
    }

    private async ensureSubscription(userId: UserId): Promise<void> {
        if (this.realtimeUnsubscribe && this.currentUserId === userId) {
            return;
        }

        if (!this.initializationPromise) {
            this.initializationPromise = this.initializeSubscription(userId).finally(() => {
                this.initializationPromise = null;
            });
        }

        await this.initializationPromise;
    }

    private async restartSubscription(userId: UserId): Promise<void> {
        this.teardownSubscription();
        this.seenItemIds.clear();
        await this.ensureSubscription(userId);
    }

    private async initializeSubscription(userId: UserId): Promise<void> {
        await this.gateway.connect();
        this.startSubscription(userId);
        this.currentUserId = userId;
    }

    private startSubscription(userId: UserId): void {
        this.teardownSubscription();

        this.realtimeUnsubscribe = this.gateway.subscribeToFeed(
            userId,
            ACTIVITY_FEED_PAGE_SIZE,
            (update) => this.handleRealtimeUpdate(update),
            (error) => this.handleRealtimeError(error),
        );
    }

    private handleRealtimeUpdate(update: ActivityFeedRealtimeUpdate): void {
        const trimmedItems = update.items ?? [];
        const newItems = trimmedItems.filter((item) => !this.seenItemIds.has(item.id));

        for (const item of newItems) {
            this.seenItemIds.add(item.id);
        }

        const payload: ActivityFeedRealtimePayload = {
            items: trimmedItems,
            newItems,
            hasMore: update.hasMore,
            nextCursor: update.hasMore
                ? update.nextCursor ?? (trimmedItems.length > 0 ? trimmedItems[trimmedItems.length - 1]!.id : null)
                : null,
        };

        for (const { consumer } of this.consumers.values()) {
            try {
                consumer.onUpdate(payload);
            } catch (error) {
                logError('ActivityFeedRealtimeService: consumer onUpdate failed', error);
            }
        }
    }

    private handleRealtimeError(error: Error): void {
        for (const { consumer } of this.consumers.values()) {
            try {
                consumer.onError?.(error);
            } catch (listenerError) {
                logError('ActivityFeedRealtimeService: consumer onError failed', listenerError);
            }
        }
    }

    private teardownSubscription(): void {
        if (this.realtimeUnsubscribe) {
            this.realtimeUnsubscribe();
            this.realtimeUnsubscribe = null;
        }

        this.currentUserId = null;
        this.seenItemIds.clear();
    }
}

const defaultRealtimeService = new ActivityFeedRealtimeService(getDefaultActivityFeedGateway());

export const activityFeedRealtimeService = defaultRealtimeService;

export { ActivityFeedRealtimeService };

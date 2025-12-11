import { logError, logWarning } from '@/utils/browser-logger';
import type { ActivityFeedItem, GroupId, UserId } from '@billsplit-wl/shared';
import type { ActivityFeedRealtimePayload, ActivityFeedRealtimeService } from '../../services/activity-feed-realtime-service';

interface GroupDetailRealtimeCoordinatorOptions {
    activityFeed: ActivityFeedRealtimeService;
    listenerId: string;
    debounceDelay: number;
    getCurrentGroupId: () => GroupId | null;
    onActivityRefresh: (context: { groupId: GroupId; eventType: string; eventId: string; }) => Promise<void> | void;
    onSelfRemoval: (context: { groupId: GroupId; eventId: string; }) => void;
}

/**
 * Handles activity-feed subscriptions and event routing for the group-detail store.
 * Keeps track of per-group subscriber counts and ensures events are only processed
 * when a group is actively viewed.
 */
export class GroupDetailRealtimeCoordinator {
    private readonly subscriberCounts = new Map<GroupId, number>();
    private activityListenerRegistered = false;
    private currentUserId: string | null = null;
    private refreshDebounceTimer: NodeJS.Timeout | null = null;
    private pendingRefresh = false;
    private pendingRefreshContext: { groupId: GroupId; eventType: string; eventId: string; } | null = null;

    constructor(private readonly options: GroupDetailRealtimeCoordinatorOptions) {}

    getSubscriberCount(groupId: GroupId): number {
        return this.subscriberCounts.get(groupId) ?? 0;
    }

    async registerComponent(groupId: GroupId, userId: UserId): Promise<void> {
        const count = this.getSubscriberCount(groupId);
        this.subscriberCounts.set(groupId, count + 1);

        const shouldRegisterListener = !this.activityListenerRegistered || this.currentUserId !== userId;

        if (!shouldRegisterListener) {
            return;
        }

        this.currentUserId = userId;

        try {
            await this.options.activityFeed.registerConsumer(this.options.listenerId, userId, {
                onUpdate: this.handleRealtimeUpdate,
                onError: (error) => {
                    logError('GroupDetailRealtimeCoordinator.onError', {
                        error: error instanceof Error ? error.message : String(error),
                        groupId,
                        userId,
                    });
                },
            });
            this.activityListenerRegistered = true;
        } catch (error) {
            logError('GroupDetailRealtimeCoordinator.registerConsumer.failed', {
                error: error instanceof Error ? error.message : String(error),
                groupId,
                userId,
            });
        }
    }

    deregisterComponent(groupId: GroupId): number {
        const count = this.getSubscriberCount(groupId);

        if (count <= 1) {
            this.subscriberCounts.delete(groupId);
        } else {
            this.subscriberCounts.set(groupId, count - 1);
        }

        const remaining = this.getSubscriberCount(groupId);

        if (this.totalSubscribers() === 0) {
            this.disposeSubscription();
        }

        return remaining;
    }

    dispose(): void {
        this.clearRefreshState();
        this.subscriberCounts.clear();
        this.disposeSubscription();
    }

    disposeIfIdle(): void {
        if (this.totalSubscribers() === 0) {
            this.disposeSubscription();
        }
    }

    clearRefreshState(): void {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = null;
        }
        this.pendingRefresh = false;
        this.pendingRefreshContext = null;
    }

    private totalSubscribers(): number {
        let total = 0;
        for (const count of this.subscriberCounts.values()) {
            total += count;
        }
        return total;
    }

    private disposeSubscription(): void {
        if (this.activityListenerRegistered) {
            this.options.activityFeed.deregisterConsumer(this.options.listenerId);
            this.activityListenerRegistered = false;
            this.currentUserId = null;
        }
    }

    private handleRealtimeUpdate = (payload: ActivityFeedRealtimePayload): void => {
        for (const item of payload.newItems) {
            this.handleActivityEvent(item);
        }
    };

    private handleActivityEvent(event: ActivityFeedItem): void {
        const { groupId, eventType } = event;
        const activeGroupId = this.options.getCurrentGroupId();
        const subscriberCount = groupId ? this.getSubscriberCount(groupId) : 0;

        if (!groupId || subscriberCount === 0) {
            return;
        }

        if (!activeGroupId || activeGroupId !== groupId) {
            return;
        }

        if (eventType === 'member-left' && event.details?.targetUserId && event.details.targetUserId === this.currentUserId) {
            this.options.onSelfRemoval({ groupId, eventId: event.id });
            return;
        }

        this.scheduleRefresh({ groupId, eventType, eventId: event.id });
    }

    private scheduleRefresh(context: { groupId: GroupId; eventType: string; eventId: string; }): void {
        if (this.pendingRefresh) {
            return;
        }

        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        this.pendingRefreshContext = context;

        this.refreshDebounceTimer = setTimeout(() => {
            this.pendingRefresh = true;
            const refreshContext = this.pendingRefreshContext;

            if (!refreshContext) {
                this.pendingRefresh = false;
                return;
            }

            Promise
                .resolve(this.options.onActivityRefresh(refreshContext))
                .catch((error) => {
                    logWarning('GroupDetailRealtimeCoordinator.activity-event.refresh-failed', {
                        error: error instanceof Error ? error.message : String(error),
                        groupId: refreshContext.groupId,
                        eventType: refreshContext.eventType,
                        eventId: refreshContext.eventId,
                    });
                })
                .finally(() => {
                    this.pendingRefresh = false;
                    this.pendingRefreshContext = null;
                    this.refreshDebounceTimer = null;
                });
        }, this.options.debounceDelay);
    }
}

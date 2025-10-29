import { logError, logInfo, logWarning } from '@/utils/browser-logger';
import type { ActivityFeedItem, GroupId, UserId } from '@splitifyd/shared';
import type { ActivityFeedRealtimePayload, ActivityFeedRealtimeService } from '../../services/activity-feed-realtime-service';

interface GroupDetailRealtimeCoordinatorOptions {
    activityFeed: ActivityFeedRealtimeService;
    listenerId: string;
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

    constructor(private readonly options: GroupDetailRealtimeCoordinatorOptions) {}

    getSubscriberCount(groupId: GroupId): number {
        return this.subscriberCounts.get(groupId) ?? 0;
    }

    async registerComponent(groupId: GroupId, userId: UserId): Promise<void> {
        const count = this.getSubscriberCount(groupId);
        this.subscriberCounts.set(groupId, count + 1);

        logInfo('GroupDetailRealtimeCoordinator.register', {
            groupId,
            userId,
            subscriberCount: count + 1,
            listenerRegistered: this.activityListenerRegistered,
            currentUserId: this.currentUserId,
        });

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

            logInfo('GroupDetailRealtimeCoordinator.listener-registered', {
                groupId,
                userId,
            });
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

        logInfo('GroupDetailRealtimeCoordinator.deregister', {
            groupId,
            subscriberCount: remaining,
            listenerRegistered: this.activityListenerRegistered,
        });

        if (this.totalSubscribers() === 0) {
            this.disposeSubscription();
        }

        return remaining;
    }

    dispose(): void {
        this.subscriberCounts.clear();
        this.disposeSubscription();
    }

    disposeIfIdle(): void {
        if (this.totalSubscribers() === 0) {
            this.disposeSubscription();
        }
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
            logInfo('GroupDetailRealtimeCoordinator.listener-deregistered', {
                currentUserId: this.currentUserId,
            });
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

        logInfo('GroupDetailRealtimeCoordinator.activity-event', {
            eventId: event.id,
            eventType,
            groupId,
            activeGroupId,
            subscriberCount,
            listenerRegistered: this.activityListenerRegistered,
        });

        if (!groupId || subscriberCount === 0) {
            logInfo('GroupDetailRealtimeCoordinator.activity-event.ignored', {
                eventId: event.id,
                reason: 'no-subscribers',
            });
            return;
        }

        if (!activeGroupId || activeGroupId !== groupId) {
            logInfo('GroupDetailRealtimeCoordinator.activity-event.ignored', {
                eventId: event.id,
                reason: 'not-active-group',
            });
            return;
        }

        if (eventType === 'member-left' && event.details?.targetUserId && event.details.targetUserId === this.currentUserId) {
            logInfo('GroupDetailRealtimeCoordinator.activity-event.self-removal', {
                groupId,
                eventId: event.id,
            });
            this.options.onSelfRemoval({ groupId, eventId: event.id });
            return;
        }

        Promise.resolve(
            this.options.onActivityRefresh({
                groupId,
                eventType,
                eventId: event.id,
            })
        ).catch((error) => {
            logWarning('GroupDetailRealtimeCoordinator.activity-event.refresh-failed', {
                error: error instanceof Error ? error.message : String(error),
                groupId,
                eventType,
                eventId: event.id,
            });
        });
    }
}

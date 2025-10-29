import { logInfo, logWarning } from '@/utils/browser-logger.ts';
import type { ActivityFeedItem, GroupId, UserId } from '@splitifyd/shared';
import type { Signal } from '@preact/signals';
import type { ActivityFeedRealtimePayload, ActivityFeedRealtimeService } from '../../services/activity-feed-realtime-service';

interface GroupsRealtimeCoordinatorOptions {
    readonly activityFeed: ActivityFeedRealtimeService;
    readonly listenerId: string;
    readonly debounceDelay: number;
    readonly isRefreshingSignal: Signal<boolean>;
    readonly onRefresh: () => Promise<void>;
    readonly onGroupRemoval: (groupId: GroupId, groupNameHint?: string) => void;
}

export class GroupsRealtimeCoordinator {
    private refreshDebounceTimer: NodeJS.Timeout | null = null;
    private pendingRefresh = false;
    private subscriberCount = 0;
    private readonly subscriberIds = new Set<string>();
    private currentUserId: string | null = null;
    private activityListenerRegistered = false;

    constructor(private readonly options: GroupsRealtimeCoordinatorOptions) {}

    registerComponent(componentId: string, userId: UserId): void {
        if (!this.subscriberIds.has(componentId)) {
            this.subscriberIds.add(componentId);
            this.subscriberCount++;
        }

        if (this.subscriberCount === 1 || this.currentUserId !== userId) {
            this.currentUserId = userId;
            this.setupSubscription(userId).catch((error) =>
                logWarning('Failed to set up activity feed subscription for groups store', {
                    error: error instanceof Error ? error.message : String(error),
                    userId,
                })
            );
        }
    }

    deregisterComponent(componentId: string): void {
        if (!this.subscriberIds.has(componentId)) {
            return;
        }

        this.subscriberIds.delete(componentId);
        this.subscriberCount = Math.max(0, this.subscriberCount - 1);

        if (this.subscriberCount === 0) {
            this.disposeSubscription();
            this.currentUserId = null;
        }
    }

    subscribeToChanges(userId: UserId): void {
        this.setupSubscription(userId).catch((error) =>
            logWarning('Legacy subscribeToChanges failed to register listener', {
                error: error instanceof Error ? error.message : String(error),
                userId,
            })
        );
    }

    refresh(): Promise<void> | void {
        if (this.pendingRefresh) {
            logInfo('refreshGroups: Refresh already pending, skipping duplicate request');
            return;
        }

        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        return new Promise<void>((resolve, reject) => {
            this.refreshDebounceTimer = setTimeout(async () => {
                this.pendingRefresh = true;
                this.options.isRefreshingSignal.value = true;

                logInfo('refreshGroups: Starting debounced refresh');

                try {
                    await this.options.onRefresh();
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    this.options.isRefreshingSignal.value = false;
                    this.pendingRefresh = false;
                    this.refreshDebounceTimer = null;
                }
            }, this.options.debounceDelay);
        });
    }

    dispose(): void {
        this.clearRefreshState();
        this.disposeSubscription();
        this.subscriberIds.clear();
        this.subscriberCount = 0;
        this.currentUserId = null;
    }

    disposeIfIdle(): void {
        if (this.subscriberCount === 0) {
            this.disposeSubscription();
        }
    }

    clearRefreshState(): void {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = null;
        }

        this.pendingRefresh = false;
        this.options.isRefreshingSignal.value = false;
    }

    private async setupSubscription(userId: UserId): Promise<void> {
        if (this.activityListenerRegistered) {
            this.options.activityFeed.deregisterConsumer(this.options.listenerId);
            this.activityListenerRegistered = false;
        }

        await this.options.activityFeed.registerConsumer(this.options.listenerId, userId, {
            onUpdate: this.handleRealtimeUpdate,
            onError: (error) => {
                logWarning('Failed to process activity feed update for groups store', {
                    error: error instanceof Error ? error.message : String(error),
                    userId,
                });
            },
        });

        this.activityListenerRegistered = true;

        this.refresh()?.catch((error) =>
            logWarning('Failed to refresh groups after subscription setup', {
                error: error instanceof Error ? error.message : String(error),
                userId,
            })
        );
    }

    private disposeSubscription(): void {
        if (this.activityListenerRegistered) {
            this.options.activityFeed.deregisterConsumer(this.options.listenerId);
            this.activityListenerRegistered = false;
        }
    }

    private handleRealtimeUpdate = (payload: ActivityFeedRealtimePayload): void => {
        for (const item of payload.newItems) {
            this.handleActivityEvent(item);
        }
    };

    private handleActivityEvent(event: ActivityFeedItem): void {
        const { groupId, eventType, details } = event;
        const userId = this.currentUserId;

        if (!groupId || !userId) {
            return;
        }

        logInfo('Activity feed event received for groups store', {
            eventType,
            groupId,
        });

        if (eventType === 'member-left' && details?.targetUserId === userId) {
            this.options.onGroupRemoval(groupId, details?.targetUserName ?? event.groupName);
            return;
        }

        this.refresh()?.catch((error) =>
            logWarning('Failed to refresh groups after activity event', {
                error: error instanceof Error ? error.message : String(error),
                groupId,
                eventType,
            })
        );
    }
}

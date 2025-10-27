import { ReadonlySignal, signal } from '@preact/signals';
import type { ActivityFeedItem, CommentDTO, ExpenseId, GroupId, ListCommentsResponse } from '@splitifyd/shared';
import { apiClient } from '../app/apiClient';
import type { ActivityFeedRealtimePayload, ActivityFeedRealtimeService } from '../app/services/activity-feed-realtime-service';
import { activityFeedRealtimeService } from '../app/services/activity-feed-realtime-service';
import { getAuthStore } from '../app/stores/auth-store';
import { logError, logInfo } from '../utils/browser-logger';

type GroupTarget = { type: 'group'; groupId: GroupId; };
type ExpenseTarget = { type: 'expense'; expenseId: ExpenseId; };
export type CommentsStoreTarget = GroupTarget | ExpenseTarget;
type CommentScope = CommentsStoreTarget['type'];

const isGroupTarget = (target: CommentsStoreTarget): target is GroupTarget => target.type === 'group';

const targetKey = (target: CommentsStoreTarget): string => {
    if (isGroupTarget(target)) {
        return `group:${target.groupId}`;
    }

    return `expense:${target.expenseId}`;
};

const targetsEqual = (a: CommentsStoreTarget, b: CommentsStoreTarget): boolean => {
    if (a.type !== b.type) {
        return false;
    }

    return isGroupTarget(a)
        ? a.groupId === (b as GroupTarget).groupId
        : a.expenseId === (b as ExpenseTarget).expenseId;
};

const targetDetails = (target: CommentsStoreTarget): Record<string, string> => {
    if (isGroupTarget(target)) {
        return { groupId: target.groupId };
    }

    return { expenseId: target.expenseId };
};

interface CommentsStore {
    // State getters - readonly values for external consumers
    readonly comments: CommentDTO[];
    readonly loading: boolean;
    readonly submitting: boolean;
    readonly error: string | null;
    readonly hasMore: boolean;
    readonly target: CommentsStoreTarget | null;
    readonly targetType: CommentScope | null;
    readonly groupId: GroupId | null;
    readonly expenseId: ExpenseId | null;

    // Signal accessors for reactive components - return readonly signals
    readonly commentsSignal: ReadonlySignal<CommentDTO[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly submittingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly hasMoreSignal: ReadonlySignal<boolean>;

    // Actions
    registerComponent(target: CommentsStoreTarget, initialData?: ListCommentsResponse | null): void;
    deregisterComponent(target: CommentsStoreTarget): void;
    addComment(text: string): Promise<void>;
    loadMoreComments(): Promise<void>;
    reset(): void;
}

export class CommentsStoreImpl implements CommentsStore {
    // Private signals - encapsulated within the class
    readonly #commentsSignal = signal<CommentDTO[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #submittingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #hasMoreSignal = signal<boolean>(false);
    readonly #targetSignal = signal<CommentsStoreTarget | null>(null);

    // Private subscription management
    #subscriberCounts = new Map<string, number>();

    // API-based pagination state
    #apiCursor: string | null = null;
    #apiHasMore: boolean = false;

    // Activity feed dependencies
    #activityFeed: ActivityFeedRealtimeService;
    #listenerId = 'comments-store';
    #listenerRegistered = false;
    #listenerRegistrationPromise: Promise<void> | null = null;

    constructor(activityFeed: ActivityFeedRealtimeService = activityFeedRealtimeService) {
        this.#activityFeed = activityFeed;
    }

    // State getters - readonly values for external consumers
    get comments() {
        return this.#commentsSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get submitting() {
        return this.#submittingSignal.value;
    }
    get error() {
        return this.#errorSignal.value;
    }
    get hasMore() {
        return this.#hasMoreSignal.value;
    }
    get target() {
        return this.#targetSignal.value;
    }
    get targetType() {
        return this.#targetSignal.value?.type ?? null;
    }
    get groupId() {
        const target = this.#targetSignal.value;
        return target?.type === 'group' ? target.groupId : null;
    }
    get expenseId() {
        const target = this.#targetSignal.value;
        return target?.type === 'expense' ? target.expenseId : null;
    }

    // Signal accessors for reactive components - return readonly signals
    get commentsSignal(): ReadonlySignal<CommentDTO[]> {
        return this.#commentsSignal;
    }
    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }
    get submittingSignal(): ReadonlySignal<boolean> {
        return this.#submittingSignal;
    }
    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }
    get hasMoreSignal(): ReadonlySignal<boolean> {
        return this.#hasMoreSignal;
    }

    registerComponent(target: CommentsStoreTarget, initialData?: ListCommentsResponse | null): void {
        const key = targetKey(target);
        const currentCount = this.#subscriberCounts.get(key) || 0;
        this.#subscriberCounts.set(key, currentCount + 1);

        const currentTarget = this.#targetSignal.value;
        const targetChanged = !currentTarget || !targetsEqual(currentTarget, target);

        if (currentCount === 0 || targetChanged) {
            this.#activateTarget(target);
            this.#ensureActivityListener();

            if (initialData) {
                this.#applyInitialData(target, initialData);
            } else {
                void this.#fetchCommentsViaApi(target);
            }
        }
    }

    deregisterComponent(target: CommentsStoreTarget): void {
        const key = targetKey(target);
        const currentCount = this.#subscriberCounts.get(key) || 0;

        if (currentCount <= 1) {
            this.#subscriberCounts.delete(key);
            this.#dispose();
        } else {
            this.#subscriberCounts.set(key, currentCount - 1);
        }
    }

    /**
     * Apply initial comment data without an API call
     */
    #applyInitialData(target: CommentsStoreTarget, initialData: ListCommentsResponse) {
        this.#targetSignal.value = target;
        this.#loadingSignal.value = false;
        this.#errorSignal.value = null;

        this.#apiHasMore = initialData.hasMore;
        this.#apiCursor = initialData.nextCursor ?? null;
        this.#commentsSignal.value = initialData.comments;
        this.#hasMoreSignal.value = this.#apiHasMore;

        logInfo('Comments initialized from preloaded data', {
            targetType: target.type,
            ...targetDetails(target),
            count: initialData.comments.length,
            hasMore: initialData.hasMore,
        });
    }

    async #ensureActivityListener() {
        if (this.#listenerRegistered || this.#listenerRegistrationPromise) {
            return;
        }

        this.#listenerRegistrationPromise = (async () => {
            try {
                const authStore = await getAuthStore();
                const userId = authStore.user?.uid ?? null;

                await this.#activityFeed.registerConsumer(this.#listenerId, userId, {
                    onUpdate: this.#handleRealtimeUpdate,
                    onError: (error) => {
                        logError('CommentsStore realtime listener error', error);
                    },
                });

                this.#listenerRegistered = true;
            } catch (error) {
                logError('Failed to register activity feed listener for comments store', error);
            } finally {
                this.#listenerRegistrationPromise = null;
            }
        })();

        await this.#listenerRegistrationPromise;
    }

    #handleRealtimeUpdate = (payload: ActivityFeedRealtimePayload): void => {
        for (const item of payload.newItems) {
            this.#handleActivityEvent(item);
        }
    };

    #handleActivityEvent = (event: ActivityFeedItem): void => {
        if (event.eventType !== 'comment-added') {
            return;
        }

        const currentTarget = this.#targetSignal.value;
        if (!currentTarget) {
            return;
        }

        if (currentTarget.type === 'group' && event.groupId !== currentTarget.groupId) {
            return;
        }
        if (currentTarget.type === 'expense' && event.details?.expenseId !== currentTarget.expenseId) {
            return;
        }

        logInfo('Activity feed comment event matched current target, refreshing comments', {
            targetType: currentTarget.type,
            ...targetDetails(currentTarget),
            eventId: event.id,
        });

        void this.#refreshComments();
    };

    #disposeActivityListener(): void {
        if (this.#listenerRegistered) {
            this.#activityFeed.deregisterConsumer(this.#listenerId);
            this.#listenerRegistered = false;
        }
        this.#listenerRegistrationPromise = null;
    }

    #activateTarget(target: CommentsStoreTarget) {
        const currentTarget = this.#targetSignal.value;
        const targetChanged = !currentTarget || !targetsEqual(currentTarget, target);

        if (targetChanged) {
            this.#commentsSignal.value = [];
            this.#hasMoreSignal.value = false;
            this.#apiCursor = null;
            this.#apiHasMore = false;
        }

        this.#targetSignal.value = target;
        this.#errorSignal.value = null;
    }

    /**
     * Refresh comments when notified of changes
     */
    async #refreshComments() {
        const target = this.#targetSignal.value;
        if (!target) {
            return;
        }

        try {
            this.#apiCursor = null;
            await this.#fetchCommentsViaApi(target, true);
        } catch (error) {
            logError('Failed to refresh comments', error);
        }
    }

    /**
     * Fetch comments via API
     */
    async #fetchCommentsViaApi(target: CommentsStoreTarget, isRefresh: boolean = false) {
        if (!isRefresh) {
            this.#loadingSignal.value = true;
        }
        this.#errorSignal.value = null;

        try {
            let response: ListCommentsResponse;

            if (target.type === 'group') {
                response = await apiClient.getGroupComments(target.groupId, this.#apiCursor || undefined);
            } else {
                response = await apiClient.getExpenseComments(target.expenseId, this.#apiCursor || undefined);
            }

            this.#apiHasMore = response.hasMore;
            this.#apiCursor = response.nextCursor || null;

            if (isRefresh || this.#commentsSignal.value.length === 0) {
                this.#commentsSignal.value = response.comments;
            } else {
                this.#commentsSignal.value = [...this.#commentsSignal.value, ...response.comments];
            }

            this.#hasMoreSignal.value = this.#apiHasMore;

            logInfo('Comments fetched via API', {
                targetType: target.type,
                ...targetDetails(target),
                count: response.comments.length,
                hasMore: response.hasMore,
                isRefresh,
            });
        } catch (error) {
            logError('Failed to fetch comments via API', error);
            this.#errorSignal.value = 'Failed to load comments';
        } finally {
            if (!isRefresh) {
                this.#loadingSignal.value = false;
            }
        }
    }

    /**
     * Add a new comment
     */
    async addComment(text: string): Promise<void> {
        const target = this.#targetSignal.value;
        if (!target) {
            this.#errorSignal.value = 'No target selected for comment';
            return;
        }

        this.#submittingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            if (target.type === 'group') {
                await apiClient.createGroupComment(target.groupId, text);
            } else {
                await apiClient.createExpenseComment(target.expenseId, text);
            }

            this.#submittingSignal.value = false;
        } catch (error) {
            logError('Failed to add comment', error);
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to add comment';
            this.#submittingSignal.value = false;
            throw error;
        }
    }

    /**
     * Load more comments (pagination)
     */
    async loadMoreComments(): Promise<void> {
        await this.#loadMoreCommentsViaApi();
    }

    /**
     * Load more comments via API (pagination)
     */
    async #loadMoreCommentsViaApi(): Promise<void> {
        if (!this.#apiHasMore || this.#loadingSignal.value || !this.#apiCursor) {
            return;
        }

        const target = this.#targetSignal.value;
        if (!target) {
            return;
        }

        this.#loadingSignal.value = true;

        try {
            let response: ListCommentsResponse;

            if (target.type === 'group') {
                response = await apiClient.getGroupComments(target.groupId, this.#apiCursor);
            } else {
                response = await apiClient.getExpenseComments(target.expenseId, this.#apiCursor);
            }

            this.#apiHasMore = response.hasMore;
            this.#apiCursor = response.nextCursor || null;
            this.#hasMoreSignal.value = this.#apiHasMore;
            this.#commentsSignal.value = [...this.#commentsSignal.value, ...response.comments];

            logInfo('More comments loaded via API', {
                targetType: target.type,
                ...targetDetails(target),
                count: response.comments.length,
                hasMore: response.hasMore,
            });
        } catch (error) {
            logError('Failed to load more comments via API', error);
            this.#errorSignal.value = 'Failed to load more comments';
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    /**
     * Reset the store state
     */
    reset() {
        this.#commentsSignal.value = [];
        this.#loadingSignal.value = false;
        this.#submittingSignal.value = false;
        this.#errorSignal.value = null;
        this.#hasMoreSignal.value = false;
        this.#targetSignal.value = null;
        this.#apiCursor = null;
        this.#apiHasMore = false;
        this.#subscriberCounts.clear();
        this.#dispose();
    }

    /**
     * Clean up subscriptions
     */
    #dispose() {
        this.#disposeActivityListener();
    }
}

// Export singleton instance
export const commentsStore = new CommentsStoreImpl(activityFeedRealtimeService);

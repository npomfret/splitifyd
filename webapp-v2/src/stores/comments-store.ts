import { ReadonlySignal, signal } from '@preact/signals';
import type { ActivityFeedItem, CommentDTO, CommentTargetType, ListCommentsResponse } from '@splitifyd/shared';
import { apiClient } from '../app/apiClient';
import type { ActivityFeedStore } from '../app/stores/activity-feed-store';
import { activityFeedStore } from '../app/stores/activity-feed-store';
import { logError, logInfo } from '../utils/browser-logger';

interface CommentsStore {
    // State getters - readonly values for external consumers
    readonly comments: CommentDTO[];
    readonly loading: boolean;
    readonly submitting: boolean;
    readonly error: string | null;
    readonly hasMore: boolean;
    readonly targetType: CommentTargetType | null;
    readonly targetId: string | null;

    // Signal accessors for reactive components - return readonly signals
    readonly commentsSignal: ReadonlySignal<CommentDTO[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly submittingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly hasMoreSignal: ReadonlySignal<boolean>;

    // Actions
    registerComponent(targetType: CommentTargetType, targetId: string, initialData?: ListCommentsResponse | null): void;
    deregisterComponent(targetId: string): void;
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
    readonly #targetTypeSignal = signal<CommentTargetType | null>(null);
    readonly #targetIdSignal = signal<string | null>(null);

    // Private subscription management
    #subscriberCounts = new Map<string, number>();

    // API-based pagination state
    #apiCursor: string | null = null;
    #apiHasMore: boolean = false;

    // Activity feed dependencies
    #activityFeed: ActivityFeedStore;
    #listenerId = 'comments-store';
    #listenerRegistered = false;
    #listenerRegistrationPromise: Promise<void> | null = null;

    constructor(activityFeed: ActivityFeedStore = activityFeedStore) {
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
    get targetType() {
        return this.#targetTypeSignal.value;
    }
    get targetId() {
        return this.#targetIdSignal.value;
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

    registerComponent(targetType: CommentTargetType, targetId: string, initialData?: ListCommentsResponse | null): void {
        const currentCount = this.#subscriberCounts.get(targetId) || 0;
        this.#subscriberCounts.set(targetId, currentCount + 1);

        const targetChanged = this.#targetIdSignal.value !== targetId || this.#targetTypeSignal.value !== targetType;
        if (currentCount === 0 || targetChanged) {
            this.#activateTarget(targetType, targetId);
            this.#ensureActivityListener();

            // Fetch initial data via API
            if (initialData) {
                this.#applyInitialData(targetType, targetId, initialData);
            } else {
                void this.#fetchCommentsViaApi(targetType, targetId);
            }
        }
    }

    deregisterComponent(targetId: string): void {
        // Deregistering component for comments target (routine)
        const currentCount = this.#subscriberCounts.get(targetId) || 0;

        if (currentCount <= 1) {
            // Last component for target, disposing subscription
            this.#subscriberCounts.delete(targetId);
            this.#dispose();
        } else {
            this.#subscriberCounts.set(targetId, currentCount - 1);
        }
    }

    /**
     * Apply initial comment data without an API call
     */
    #applyInitialData(targetType: CommentTargetType, targetId: string, initialData: ListCommentsResponse) {
        this.#targetTypeSignal.value = targetType;
        this.#targetIdSignal.value = targetId;
        this.#loadingSignal.value = false;
        this.#errorSignal.value = null;

        this.#apiHasMore = initialData.hasMore;
        this.#apiCursor = initialData.nextCursor ?? null;
        this.#commentsSignal.value = initialData.comments;
        this.#hasMoreSignal.value = this.#apiHasMore;

        logInfo('Comments initialized from preloaded data', {
            targetType,
            targetId,
            count: initialData.comments.length,
            hasMore: initialData.hasMore,
        });
    }

    #ensureActivityListener() {
        if (this.#listenerRegistered || this.#listenerRegistrationPromise) {
            return;
        }

        this.#listenerRegistrationPromise = this.#activityFeed
            .registerListener(this.#listenerId, null, this.#handleActivityEvent)
            .then(() => {
                this.#listenerRegistered = true;
            })
            .catch((error) => {
                logError('Failed to register activity feed listener for comments store', error);
            })
            .finally(() => {
                this.#listenerRegistrationPromise = null;
            });
    }

    #handleActivityEvent = (event: ActivityFeedItem): void => {
        if (event.eventType !== 'comment-added') {
            return;
        }

        const currentTargetType = this.#targetTypeSignal.value;
        const currentTargetId = this.#targetIdSignal.value;

        if (!currentTargetType || !currentTargetId) {
            return;
        }

        if (currentTargetType === 'group') {
            if (event.groupId !== currentTargetId) {
                return;
            }
        } else if (currentTargetType === 'expense') {
            if (event.details?.expenseId !== currentTargetId) {
                return;
            }
        }

        logInfo('Activity feed comment event matched current target, refreshing comments', {
            targetType: currentTargetType,
            targetId: currentTargetId,
            eventId: event.id,
        });

        void this.#refreshComments();
    };

    #disposeActivityListener(): void {
        if (this.#listenerRegistered) {
            this.#activityFeed.deregisterListener(this.#listenerId);
            this.#listenerRegistered = false;
        }

        this.#listenerRegistrationPromise = null;
    }

    #activateTarget(targetType: CommentTargetType, targetId: string) {
        const targetChanged = this.#targetTypeSignal.value !== targetType || this.#targetIdSignal.value !== targetId;

        if (targetChanged) {
            this.#commentsSignal.value = [];
            this.#hasMoreSignal.value = false;
            this.#apiCursor = null;
            this.#apiHasMore = false;
        }

        this.#targetTypeSignal.value = targetType;
        this.#targetIdSignal.value = targetId;
        this.#errorSignal.value = null;
    }

    /**
     * Refresh comments when notified of changes
     */
    async #refreshComments() {
        if (!this.#targetTypeSignal.value || !this.#targetIdSignal.value) {
            return;
        }

        // Refresh using API to get latest comments
        // This preserves pagination state by fetching from the beginning
        try {
            const targetType = this.#targetTypeSignal.value;
            const targetId = this.#targetIdSignal.value;

            // Reset API pagination and fetch fresh data
            this.#apiCursor = null;
            await this.#fetchCommentsViaApi(targetType, targetId, true);
        } catch (error) {
            logError('Failed to refresh comments', error);
        }
    }

    /**
     * Fetch comments via API
     */
    async #fetchCommentsViaApi(targetType: CommentTargetType, targetId: string, isRefresh: boolean = false) {
        if (!isRefresh) {
            this.#loadingSignal.value = true;
        }
        this.#errorSignal.value = null;

        try {
            let response: ListCommentsResponse;

            if (targetType === 'group') {
                response = await apiClient.getGroupComments(targetId, this.#apiCursor || undefined);
            } else {
                response = await apiClient.getExpenseComments(targetId, this.#apiCursor || undefined);
            }

            // Update API pagination state
            this.#apiHasMore = response.hasMore;
            this.#apiCursor = response.nextCursor || null;

            // Update comments (replace if initial/refresh, append if pagination)
            if (isRefresh || this.#commentsSignal.value.length === 0) {
                // Replace existing comments
                this.#commentsSignal.value = response.comments;
            } else {
                // Append new comments for pagination
                this.#commentsSignal.value = [...this.#commentsSignal.value, ...response.comments];
            }

            // Update hasMore signal with API state
            this.#hasMoreSignal.value = this.#apiHasMore;

            logInfo('Comments fetched via API', {
                targetType,
                targetId,
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
        if (!this.#targetTypeSignal.value || !this.#targetIdSignal.value) {
            this.#errorSignal.value = 'No target selected for comment';
            return;
        }

        this.#submittingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            if (this.#targetTypeSignal.value === 'group') {
                await apiClient.createGroupComment(this.#targetIdSignal.value, text);
            } else {
                await apiClient.createExpenseComment(this.#targetIdSignal.value, text);
            }

            // The real-time notification system will trigger a refresh
            // New comments will appear when the API is refreshed

            this.#submittingSignal.value = false;
        } catch (error) {
            logError('Failed to add comment', error);
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to add comment';
            this.#submittingSignal.value = false;
            throw error; // Re-throw for component error handling
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

        if (!this.#targetTypeSignal.value || !this.#targetIdSignal.value) {
            return;
        }

        this.#loadingSignal.value = true;

        try {
            const targetType = this.#targetTypeSignal.value;
            const targetId = this.#targetIdSignal.value;

            let response: ListCommentsResponse;

            if (targetType === 'group') {
                response = await apiClient.getGroupComments(targetId, this.#apiCursor);
            } else {
                response = await apiClient.getExpenseComments(targetId, this.#apiCursor);
            }

            // Update API pagination state
            this.#apiHasMore = response.hasMore;
            this.#apiCursor = response.nextCursor || null;
            this.#hasMoreSignal.value = this.#apiHasMore;

            // Append new comments
            this.#commentsSignal.value = [...this.#commentsSignal.value, ...response.comments];

            logInfo('More comments loaded via API', {
                targetType,
                targetId,
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
        this.#targetTypeSignal.value = null;
        this.#targetIdSignal.value = null;
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
export const commentsStore = new CommentsStoreImpl(activityFeedStore);

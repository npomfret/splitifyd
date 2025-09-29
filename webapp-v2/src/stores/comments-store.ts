import { signal, ReadonlySignal } from '@preact/signals';
import type { CommentApiResponse, CommentTargetType, ListCommentsResponse } from '@splitifyd/shared';
import { apiClient } from '../app/apiClient';
import { logError, logInfo } from '../utils/browser-logger';
import type { FirebaseService } from '../app/firebase';
import { firebaseService } from '../app/firebase';
import { UserNotificationDetector } from '../utils/user-notification-detector';

interface CommentsStore {
    // State getters - readonly values for external consumers
    readonly comments: CommentApiResponse[];
    readonly loading: boolean;
    readonly submitting: boolean;
    readonly error: string | null;
    readonly hasMore: boolean;
    readonly targetType: CommentTargetType | null;
    readonly targetId: string | null;

    // Signal accessors for reactive components - return readonly signals
    readonly commentsSignal: ReadonlySignal<CommentApiResponse[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly submittingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly hasMoreSignal: ReadonlySignal<boolean>;

    // Actions
    registerComponent(targetType: CommentTargetType, targetId: string): void;
    deregisterComponent(targetId: string): void;
    addComment(text: string): Promise<void>;
    loadMoreComments(): Promise<void>;
    reset(): void;
}

class CommentsStoreImpl implements CommentsStore {
    // Private signals - encapsulated within the class
    readonly #commentsSignal = signal<CommentApiResponse[]>([]);
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

    // Notification system dependencies
    #notificationUnsubscribe: (() => void) | null = null;

    constructor(
        private firebaseService: FirebaseService,
        private userNotificationDetector: UserNotificationDetector
    ) {}

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
    get commentsSignal(): ReadonlySignal<CommentApiResponse[]> {
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

    registerComponent(targetType: CommentTargetType, targetId: string): void {
        // Registering component for comments target (routine)
        const currentCount = this.#subscriberCounts.get(targetId) || 0;
        this.#subscriberCounts.set(targetId, currentCount + 1);

        if (currentCount === 0) {
            // Setup notification listener for real-time updates
            this.#setupNotificationListener(targetType, targetId);

            // Fetch initial data via API
            this.#fetchCommentsViaApi(targetType, targetId);
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
     * Setup notification listener for comment changes
     */
    #setupNotificationListener(targetType: CommentTargetType, targetId: string) {
        // Get current user ID from Firebase service
        const auth = this.firebaseService.getAuth();
        const userId = auth.currentUser?.uid;
        if (!userId) {
            logError('Cannot setup notification listener: user not authenticated');
            return;
        }

        // Setup notification listener to detect comment changes
        this.#notificationUnsubscribe = this.userNotificationDetector.subscribe(userId, {
            onCommentChange: (notificationTargetType, notificationTargetId) => {
                // Handle comment notifications based on our current target type
                if (targetType === 'group' && notificationTargetType === 'group' && notificationTargetId === targetId) {
                    // Direct match for group comments
                    logInfo('Group comment change notification received, refreshing comments');
                    this.#refreshComments();
                } else if (targetType === 'expense' && notificationTargetType === 'expense') {
                    // For expense comments, check if the notification is for the group containing our expense
                    // The notificationTargetId is the groupId, so we need to check if this expense belongs to that group
                    // We don't have direct access to the expense's groupId here, but we can refresh
                    // and let the API call determine if there are new comments for this expense
                    logInfo('Expense comment change notification received, refreshing comments');
                    this.#refreshComments();
                } else if (targetType === 'expense' && notificationTargetType === 'group') {
                    // This might be a group-level comment, but we only care about expense comments when in expense mode
                    // Skip group comment notifications when we're listening for expense comments
                    return;
                }
            }
        });
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
        // Always set target signals for the current target (store is singleton, may be reused)
        if (!isRefresh) {
            this.#targetTypeSignal.value = targetType;
            this.#targetIdSignal.value = targetId;
        }

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
                isRefresh
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
                hasMore: response.hasMore
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
        // Clean up notification listener
        if (this.#notificationUnsubscribe) {
            this.#notificationUnsubscribe();
            this.#notificationUnsubscribe = null;
        }
    }
}

// Export singleton instance
export const commentsStore = new CommentsStoreImpl(
    firebaseService,
    new UserNotificationDetector(firebaseService)
);
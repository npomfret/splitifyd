import { signal, ReadonlySignal } from '@preact/signals';
import {
    onSnapshot,
    collection,
    query,
    orderBy,
    limit,
    startAfter,
    getDocs,
    QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { CommentApiResponse, CommentTargetType } from '@splitifyd/shared';
import { apiClient } from '../app/apiClient';
import { getDb } from '../app/firebase';
import { logError, logInfo } from '../utils/browser-logger';
import { assertTimestampAndConvert } from '../utils/dateUtils';

type SubscriptionState = 'idle' | 'subscribing' | 'subscribed' | 'disposed';

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
    #subscriptionState: SubscriptionState = 'idle';
    #unsubscribe: (() => void) | null = null;
    #lastDoc: QueryDocumentSnapshot | null = null;
    #subscriberCounts = new Map<string, number>();

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
        logInfo(`Registering component for comments target: ${targetId}`);
        const currentCount = this.#subscriberCounts.get(targetId) || 0;
        this.#subscriberCounts.set(targetId, currentCount + 1);

        if (currentCount === 0) {
            logInfo(`First component for ${targetId}, creating subscription.`);
            this.#subscribeToComments(targetType, targetId);
        }
    }

    deregisterComponent(targetId: string): void {
        logInfo(`Deregistering component for comments target: ${targetId}`);
        const currentCount = this.#subscriberCounts.get(targetId) || 0;

        if (currentCount <= 1) {
            logInfo(`Last component for ${targetId}, disposing subscription.`);
            this.#subscriberCounts.delete(targetId);
            this.#dispose();
        } else {
            this.#subscriberCounts.set(targetId, currentCount - 1);
        }
    }

    /**
     * Subscribe to real-time comments for a target (group or expense).
     * This is a private method managed by the register/deregister logic.
     */
    #subscribeToComments(targetType: CommentTargetType, targetId: string) {
        // If we are already subscribed to the same target, do nothing.
        if (this.#subscriptionState === 'subscribed' && this.#targetTypeSignal.value === targetType && this.#targetIdSignal.value === targetId) {
            logInfo(`Already subscribed to ${targetType}:${targetId}`);
            return;
        }

        // Prevent multiple simultaneous subscription attempts
        if (this.#subscriptionState === 'subscribing') {
            logInfo(`Already subscribing to comments, ignoring duplicate request`);
            return;
        }

        // Clean up previous subscription if the target is different
        if (this.#subscriptionState !== 'idle') {
            this.#dispose();
        }

        this.#subscriptionState = 'subscribing';
        this.#targetTypeSignal.value = targetType;
        this.#targetIdSignal.value = targetId;
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            const db = getDb();
            const collectionPath = targetType === 'group' ? `groups/${targetId}/comments` : `expenses/${targetId}/comments`;

            const commentsQuery = query(collection(db, collectionPath), orderBy('createdAt', 'desc'), limit(20));

            this.#unsubscribe = onSnapshot(
                commentsQuery,
                (snapshot) => {
                    // Only process if we're still subscribing/subscribed to this target
                    if (this.#subscriptionState === 'disposed' || 
                        this.#targetTypeSignal.value !== targetType || 
                        this.#targetIdSignal.value !== targetId) {
                        logInfo('Subscription callback received for stale target, ignoring');
                        return;
                    }

                    const comments: CommentApiResponse[] = [];

                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        comments.push({
                            id: doc.id,
                            authorId: data.authorId,
                            authorName: data.authorName,
                            authorAvatar: data.authorAvatar || undefined,
                            text: data.text,
                            createdAt: assertTimestampAndConvert(data.createdAt, 'createdAt'),
                            updatedAt: assertTimestampAndConvert(data.updatedAt, 'updatedAt'),
                        });
                    });

                    // Store last document for pagination
                    this.#lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
                    this.#hasMoreSignal.value = snapshot.docs.length === 20;

                    this.#commentsSignal.value = comments;
                    this.#loadingSignal.value = false;
                    this.#subscriptionState = 'subscribed';
                },
                (error) => {
                    logError('Comments subscription error', error);
                    this.#errorSignal.value = 'Failed to load comments. Please try refreshing the page.';
                    this.#loadingSignal.value = false;
                    this.#subscriptionState = 'idle';
                },
            );
        } catch (error) {
            logError('Failed to subscribe to comments', error);
            this.#errorSignal.value = 'Failed to connect to comments. Please check your connection.';
            this.#loadingSignal.value = false;
            this.#subscriptionState = 'idle';
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

            // The real-time subscription will automatically update the list
            // Since we're using desc order, new comments should appear at the top

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
        if (!this.#hasMoreSignal.value || this.#loadingSignal.value || !this.#lastDoc) {
            return;
        }

        if (!this.#targetTypeSignal.value || !this.#targetIdSignal.value) {
            return;
        }

        this.#loadingSignal.value = true;

        try {
            const db = getDb();
            const collectionPath = this.#targetTypeSignal.value === 'group' ? `groups/${this.#targetIdSignal.value}/comments` : `expenses/${this.#targetIdSignal.value}/comments`;

            const nextQuery = query(collection(db, collectionPath), orderBy('createdAt', 'desc'), startAfter(this.#lastDoc), limit(20));

            // Use getDocs instead of onSnapshot for pagination to avoid conflicts
            const snapshot = await getDocs(nextQuery);

            const moreComments: CommentApiResponse[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                moreComments.push({
                    id: doc.id,
                    authorId: data.authorId,
                    authorName: data.authorName,
                    authorAvatar: data.authorAvatar || undefined,
                    text: data.text,
                    createdAt: assertTimestampAndConvert(data.createdAt, 'createdAt'),
                    updatedAt: assertTimestampAndConvert(data.updatedAt, 'updatedAt'),
                });
            });

            // Update pagination state
            this.#lastDoc = snapshot.docs[snapshot.docs.length - 1] || this.#lastDoc;
            this.#hasMoreSignal.value = snapshot.docs.length === 20;

            // Append to existing comments
            this.#commentsSignal.value = [...this.#commentsSignal.value, ...moreComments];
            this.#loadingSignal.value = false;
        } catch (error) {
            logError('Failed to load more comments', error);
            this.#errorSignal.value = 'Failed to load more comments';
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
        this.#lastDoc = null;
        this.#subscriberCounts.clear();
        this.#dispose();
    }

    /**
     * Clean up subscriptions
     */
    #dispose() {
        this.#subscriptionState = 'disposed';
        if (this.#unsubscribe) {
            this.#unsubscribe();
            this.#unsubscribe = null;
        }
        // Reset to idle after cleanup
        this.#subscriptionState = 'idle';
    }
}

// Export singleton instance
export const commentsStore = new CommentsStoreImpl();
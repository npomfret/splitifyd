import { signal } from '@preact/signals';
import { onSnapshot, collection, query, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { CommentApiResponse, CommentTargetType } from '@splitifyd/shared';
import { apiClient } from '../app/apiClient';
import { getDb } from '../app/firebase';
import { logError } from '../utils/browser-logger';

// Signals for comments state
const commentsSignal = signal<CommentApiResponse[]>([]);
const loadingSignal = signal<boolean>(false);
const submittingSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const hasMoreSignal = signal<boolean>(false);
const targetTypeSignal = signal<CommentTargetType | null>(null);
const targetIdSignal = signal<string | null>(null);

// Real-time subscription management
let unsubscribe: (() => void) | null = null;
let lastDoc: QueryDocumentSnapshot | null = null;

interface CommentsStore {
    // State
    comments: CommentApiResponse[];
    loading: boolean;
    submitting: boolean;
    error: string | null;
    hasMore: boolean;
    targetType: CommentTargetType | null;
    targetId: string | null;

    // Actions
    subscribeToComments(targetType: CommentTargetType, targetId: string): void;
    addComment(text: string): Promise<void>;
    loadMoreComments(): Promise<void>;
    reset(): void;
    dispose(): void;
}

class CommentsStoreImpl implements CommentsStore {
    // State getters
    get comments() {
        return commentsSignal.value;
    }
    get loading() {
        return loadingSignal.value;
    }
    get submitting() {
        return submittingSignal.value;
    }
    get error() {
        return errorSignal.value;
    }
    get hasMore() {
        return hasMoreSignal.value;
    }
    get targetType() {
        return targetTypeSignal.value;
    }
    get targetId() {
        return targetIdSignal.value;
    }

    // Signal accessors for reactive components
    get commentsSignal() {
        return commentsSignal;
    }
    get loadingSignal() {
        return loadingSignal;
    }
    get submittingSignal() {
        return submittingSignal;
    }
    get errorSignal() {
        return errorSignal;
    }
    get hasMoreSignal() {
        return hasMoreSignal;
    }

    /**
     * Subscribe to real-time comments for a target (group or expense)
     */
    subscribeToComments(targetType: CommentTargetType, targetId: string) {
        // If we are already subscribed to the same target, do nothing.
        if (unsubscribe && targetTypeSignal.value === targetType && targetIdSignal.value === targetId) {
            return;
        }

        // Clean up previous subscription
        this.dispose();

        targetTypeSignal.value = targetType;
        targetIdSignal.value = targetId;
        loadingSignal.value = true;
        errorSignal.value = null;

        try {
            const db = getDb();
            const collectionPath = targetType === 'group' 
                ? `groups/${targetId}/comments`
                : `expenses/${targetId}/comments`;

            const commentsQuery = query(
                collection(db, collectionPath),
                orderBy('createdAt', 'desc'),
                limit(20)
            );

            unsubscribe = onSnapshot(
                commentsQuery,
                (snapshot) => {
                    const comments: CommentApiResponse[] = [];
                    
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        comments.push({
                            id: doc.id,
                            authorId: data.authorId,
                            authorName: data.authorName,
                            authorAvatar: data.authorAvatar || undefined,
                            text: data.text,
                            createdAt: data.createdAt instanceof Timestamp 
                                ? data.createdAt.toDate().toISOString()
                                : data.createdAt,
                            updatedAt: data.updatedAt instanceof Timestamp
                                ? data.updatedAt.toDate().toISOString()
                                : data.updatedAt,
                        });
                    });

                    // Store last document for pagination
                    lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
                    hasMoreSignal.value = snapshot.docs.length === 20;
                    
                    commentsSignal.value = comments;
                    loadingSignal.value = false;
                },
                (error) => {
                    logError('Comments subscription error', error);
                    errorSignal.value = 'Failed to load comments. Please try refreshing the page.';
                    loadingSignal.value = false;
                }
            );
        } catch (error) {
            logError('Failed to subscribe to comments', error);
            errorSignal.value = 'Failed to connect to comments. Please check your connection.';
            loadingSignal.value = false;
        }
    }

    /**
     * Add a new comment with optimistic update
     */
    async addComment(text: string): Promise<void> {
        if (!targetTypeSignal.value || !targetIdSignal.value) {
            errorSignal.value = 'No target selected for comment';
            return;
        }

        submittingSignal.value = true;
        errorSignal.value = null;

        try {
            if (targetTypeSignal.value === 'group') {
                await apiClient.createGroupComment(targetIdSignal.value, text);
            } else {
                await apiClient.createExpenseComment(targetIdSignal.value, text);
            }

            // The real-time subscription will automatically update the list
            // Since we're using desc order, new comments should appear at the top
            
            submittingSignal.value = false;
        } catch (error) {
            logError('Failed to add comment', error);
            errorSignal.value = error instanceof Error ? error.message : 'Failed to add comment';
            submittingSignal.value = false;
            throw error; // Re-throw for component error handling
        }
    }

    /**
     * Load more comments (pagination)
     */
    async loadMoreComments(): Promise<void> {
        if (!hasMoreSignal.value || loadingSignal.value || !lastDoc) {
            return;
        }

        if (!targetTypeSignal.value || !targetIdSignal.value) {
            return;
        }

        loadingSignal.value = true;

        try {
            const db = getDb();
            const collectionPath = targetTypeSignal.value === 'group' 
                ? `groups/${targetIdSignal.value}/comments`
                : `expenses/${targetIdSignal.value}/comments`;

            const nextQuery = query(
                collection(db, collectionPath),
                orderBy('createdAt', 'desc'),
                startAfter(lastDoc),
                limit(20)
            );

            const snapshot = await new Promise<QuerySnapshot<DocumentData>>((resolve, reject) => {
                const unsubscribeNext = onSnapshot(
                    nextQuery,
                    (snap) => {
                        unsubscribeNext();
                        resolve(snap);
                    },
                    reject
                );
            });

            const moreComments: CommentApiResponse[] = [];
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                moreComments.push({
                    id: doc.id,
                    authorId: data.authorId,
                    authorName: data.authorName,
                    authorAvatar: data.authorAvatar || undefined,
                    text: data.text,
                    createdAt: data.createdAt instanceof Timestamp 
                        ? data.createdAt.toDate().toISOString()
                        : data.createdAt,
                    updatedAt: data.updatedAt instanceof Timestamp
                        ? data.updatedAt.toDate().toISOString()
                        : data.updatedAt,
                });
            });

            // Update pagination state
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || lastDoc;
            hasMoreSignal.value = snapshot.docs.length === 20;
            
            // Append to existing comments
            commentsSignal.value = [...commentsSignal.value, ...moreComments];
            loadingSignal.value = false;
        } catch (error) {
            logError('Failed to load more comments', error);
            errorSignal.value = 'Failed to load more comments';
            loadingSignal.value = false;
        }
    }

    /**
     * Reset the store state
     */
    reset() {
        commentsSignal.value = [];
        loadingSignal.value = false;
        submittingSignal.value = false;
        errorSignal.value = null;
        hasMoreSignal.value = false;
        targetTypeSignal.value = null;
        targetIdSignal.value = null;
        lastDoc = null;
        this.dispose();
    }

    /**
     * Clean up subscriptions
     */
    dispose() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    }
}

// Export singleton instance
export const commentsStore = new CommentsStoreImpl();
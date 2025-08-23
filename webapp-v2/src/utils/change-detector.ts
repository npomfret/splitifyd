import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getDb } from '../app/firebase';
import { logInfo, logWarning } from './browser-logger';
import { FirestoreCollections } from '@shared/shared-types';
import { streamingMetrics } from './streaming-metrics';

export type ChangeCallback = () => void;
export type ErrorCallback = (error: Error) => void;

interface SubscriptionConfig {
    maxRetries?: number;
    retryDelay?: number;
    onError?: ErrorCallback;
}

export class ChangeDetector {
    private listeners = new Map<string, Unsubscribe>();
    private callbacks = new Map<string, Set<ChangeCallback>>();
    private retryCount = new Map<string, number>();
    private retryTimers = new Map<string, NodeJS.Timeout>();
    private subscriptionConfigs = new Map<string, SubscriptionConfig>();

    constructor() {}

    /**
     * Subscribe to any changes for a user's groups
     */
    subscribeToGroupChanges(userId: string, callback: ChangeCallback, config?: SubscriptionConfig): () => void {
        return this.subscribe(FirestoreCollections.GROUP_CHANGES, { userId }, callback, config);
    }

    /**
     * Subscribe to any changes for a group's transactions (expenses and settlements)
     */
    subscribeToExpenseChanges(groupId: string, callback: ChangeCallback, config?: SubscriptionConfig): () => void {
        // Note: userId parameter kept for compatibility but not currently used in the query
        // Note: Method name kept as subscribeToExpenseChanges for backward compatibility
        return this.subscribe(FirestoreCollections.TRANSACTION_CHANGES, { groupId }, callback, config);
    }

    /**
     * Subscribe to balance changes for a group
     */
    subscribeToBalanceChanges(groupId: string, callback: ChangeCallback, config?: SubscriptionConfig): () => void {
        return this.subscribe(FirestoreCollections.BALANCE_CHANGES, { groupId }, callback, config);
    }

    private subscribe(collectionName: string, filters: Record<string, string>, callback: ChangeCallback, config?: SubscriptionConfig): () => void {
        const key = `${collectionName}-${Object.values(filters).join('-')}`;
        logInfo('ChangeDetector: subscribe', { key, collectionName, filters });

        // Store config for this subscription
        if (config) {
            this.subscriptionConfigs.set(key, config);
        }

        // Add callback
        if (!this.callbacks.has(key)) {
            logInfo('ChangeDetector: creating new callback set', { key });
            this.callbacks.set(key, new Set());
        }
        this.callbacks.get(key)!.add(callback);

        // Start listener if not already running
        if (!this.listeners.has(key)) {
            logInfo('ChangeDetector: starting new listener', { key });
            this.startListener(collectionName, filters, key);
        }

        // Return unsubscribe function
        return () => {
            logInfo('ChangeDetector: unsubscribe', { key });
            const callbacks = this.callbacks.get(key);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    logInfo('ChangeDetector: stopping listener', { key });
                    this.stopListener(key);
                }
            }
        };
    }

    private startListener(collectionName: string, filters: Record<string, string>, key: string) {
        // Build query directly without intermediate array
        const collectionRef = collection(getDb(), collectionName);

        // Apply filters directly to the query
        let q;
        if (filters.groupId) {
            q = query(collectionRef, where('groupId', '==', filters.groupId));
        } else if (filters.userId) {
            // For GROUP_CHANGES collection, filter by users field (not metadata.affectedUsers)
            q = query(collectionRef, where('users', 'array-contains', filters.userId));
        } else {
            q = query(collectionRef);
        }

        logInfo('ChangeDetector: Starting change listener', {
            collection: collectionName,
            filters,
            key,
        });

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                logInfo('ChangeDetector: Snapshot received', {
                    collection: collectionName,
                    empty: snapshot.empty,
                    size: snapshot.size,
                    docs: snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
                });

                // We are only interested in 'added' changes, as the change documents are never updated.
                const addedChanges = snapshot.docChanges().filter((change) => change.type === 'added');

                if (addedChanges.length > 0) {
                    logInfo('ChangeDetector: Change detected, triggering refresh', {
                        collection: collectionName,
                        changeCount: addedChanges.length,
                        firstChange: addedChanges[0].doc.data(),
                    });

                    // Track notification metrics
                    streamingMetrics.trackNotification();

                    this.triggerCallbacks(key);
                }
            },
            (error) => {
                this.handleListenerError(error, collectionName, filters, key);
            },
        );

        this.listeners.set(key, unsubscribe);
        logInfo('ChangeDetector: Change listener setup complete', {
            collection: collectionName,
            key,
            listenersCount: this.listeners.size,
        });
    }

    private triggerCallbacks(key: string) {
        const callbacks = this.callbacks.get(key);
        if (callbacks) {
            callbacks.forEach((callback) => {
                try {
                    callback();
                } catch (error) {
                    logWarning('Callback error', { error });
                }
            });
        }
    }

    private handleListenerError(error: unknown, collectionName: string, filters: Record<string, string>, key: string) {
        const config = this.subscriptionConfigs.get(key);
        const maxRetries = config?.maxRetries ?? 3;
        const retryDelay = config?.retryDelay ?? 2000;

        logWarning('ChangeDetector: Change listener error', {
            error: error instanceof Error ? error.message : String(error),
            collection: collectionName,
            filters,
            key,
        });

        // Track error metrics
        streamingMetrics.trackSubscriptionError();

        // Call error callback if provided
        if (config?.onError && error instanceof Error) {
            try {
                config.onError(error);
            } catch (callbackError) {
                logWarning('ChangeDetector: Error callback failed', { callbackError });
            }
        }

        const currentRetries = this.retryCount.get(key) ?? 0;

        if (currentRetries < maxRetries) {
            logInfo('ChangeDetector: Scheduling retry', {
                key,
                attempt: currentRetries + 1,
                maxRetries,
                delay: retryDelay,
            });

            // Clear any existing timer
            const existingTimer = this.retryTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // Schedule retry with exponential backoff
            const delay = retryDelay * Math.pow(2, currentRetries);
            const timer = setTimeout(() => {
                streamingMetrics.trackSubscriptionRetry();
                this.retryCount.set(key, currentRetries + 1);
                this.retryTimers.delete(key);

                // Stop existing listener and start new one
                this.stopListener(key, false); // Don't clear callbacks
                this.startListener(collectionName, filters, key);
            }, delay);

            this.retryTimers.set(key, timer);
        } else {
            logWarning('ChangeDetector: Max retries exceeded, giving up', {
                key,
                maxRetries,
            });

            // Clean up after max retries
            this.stopListener(key);
        }
    }

    private stopListener(key: string, clearCallbacks: boolean = true) {
        const unsubscribe = this.listeners.get(key);
        if (unsubscribe) {
            unsubscribe();
            this.listeners.delete(key);
        }

        // Clear retry state
        this.retryCount.delete(key);
        const timer = this.retryTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.retryTimers.delete(key);
        }

        if (clearCallbacks) {
            this.callbacks.delete(key);
            this.subscriptionConfigs.delete(key);
        }
    }

    /**
     * Clean up all listeners
     */
    dispose() {
        this.listeners.forEach((unsubscribe) => unsubscribe());
        this.listeners.clear();
        this.callbacks.clear();

        // Clear retry timers
        this.retryTimers.forEach((timer) => clearTimeout(timer));
        this.retryTimers.clear();

        // Clear retry state
        this.retryCount.clear();
        this.subscriptionConfigs.clear();
    }
}

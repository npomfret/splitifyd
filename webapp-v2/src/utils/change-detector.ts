import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getDb } from '../app/firebase';
import { logInfo, logWarning } from './browser-logger';
import { FirestoreCollections } from '@shared/shared-types';

export type ChangeCallback = () => void;

export class ChangeDetector {
    private listeners = new Map<string, Unsubscribe>();
    private callbacks = new Map<string, Set<ChangeCallback>>();

    constructor() {}

    /**
     * Subscribe to any changes for a user's groups
     */
    subscribeToGroupChanges(userId: string, callback: ChangeCallback): () => void {
        return this.subscribe(FirestoreCollections.GROUP_CHANGES, { userId }, callback);
    }

    /**
     * Subscribe to any changes for a group's transactions (expenses and settlements)
     */
    subscribeToExpenseChanges(groupId: string, callback: ChangeCallback): () => void {
        // Note: userId parameter kept for compatibility but not currently used in the query
        // Note: Method name kept as subscribeToExpenseChanges for backward compatibility
        return this.subscribe(FirestoreCollections.TRANSACTION_CHANGES, { groupId }, callback);
    }

    /**
     * Subscribe to balance changes for a group
     */
    subscribeToBalanceChanges(groupId: string, callback: ChangeCallback): () => void {
        return this.subscribe(FirestoreCollections.BALANCE_CHANGES, { groupId }, callback);
    }

    private subscribe(collectionName: string, filters: Record<string, string>, callback: ChangeCallback): () => void {
        const key = `${collectionName}-${Object.values(filters).join('-')}`;
        logInfo('ChangeDetector: subscribe', { key, collectionName, filters });

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
            q = query(collectionRef, where('metadata.affectedUsers', 'array-contains', filters.userId));
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
                    this.triggerCallbacks(key);
                }
            },
            (error) => {
                logWarning('ChangeDetector: Change listener error', {
                    error: error instanceof Error ? error.message : String(error),
                    collection: collectionName,
                    filters,
                });
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

    private stopListener(key: string) {
        const unsubscribe = this.listeners.get(key);
        if (unsubscribe) {
            unsubscribe();
            this.listeners.delete(key);
        }
        this.callbacks.delete(key);
    }

    /**
     * Clean up all listeners
     */
    dispose() {
        this.listeners.forEach((unsubscribe) => unsubscribe());
        this.listeners.clear();
        this.callbacks.clear();
    }
}

import {Timestamp} from 'firebase/firestore';
import {firebaseService, FirebaseService} from '../app/firebase';
import {logError, logInfo} from './browser-logger';

/**
 * User notification detector callbacks
 * These match the ChangeDetector interface for backward compatibility
 */
export interface NotificationCallbacks {
    onGroupChange?: (groupId: string) => void;
    onTransactionChange?: (groupId: string) => void;
    onBalanceChange?: (groupId: string) => void;
    onCommentChange?: (targetType: 'group' | 'expense', targetId: string) => void;
    onGroupRemoved?: (groupId: string) => void;
}

/**
 * Configuration for notification subscriptions
 */
export interface NotificationConfig {
    maxRetries?: number;
    retryDelay?: number;
    onError?: (error: Error) => void;
}

/**
 * Per-group notification state tracking
 */
interface GroupNotificationState {
    lastTransactionChange: Timestamp | null;
    lastBalanceChange: Timestamp | null;
    lastGroupDetailsChange: Timestamp | null;
    lastCommentChange: Timestamp | null;
    transactionChangeCount: number;
    balanceChangeCount: number;
    groupDetailsChangeCount: number;
    commentChangeCount: number;
}

/**
 * User notification document structure (matches backend schema)
 */
interface UserNotificationDocument {
    changeVersion: number;
    groups: {
        [groupId: string]: GroupNotificationState;
    };
    lastModified: Timestamp;
    recentChanges?: Array<{
        groupId: string;
        type: 'transaction' | 'balance' | 'group' | 'comment';
        timestamp: Timestamp;
    }>;
}

/**
 * UserNotificationDetector - New notification system client
 *
 * Replaces ChangeDetector by listening to a single per-user notification document
 * instead of multiple change document collections. This provides:
 *
 * - 90% fewer Firestore operations
 * - Single listener per user instead of 3+
 * - No cleanup required (documents persist)
 * - Atomic consistency via FieldValue operations
 * - Reliable change detection via counters
 */
// Internal subscription tracking
interface Subscription {
    id: string;
    callbacks: NotificationCallbacks;
    config: NotificationConfig;
}

export class UserNotificationDetector {
    private listener: (() => void) | null = null;
    private lastVersion = 0;
    private lastGroupStates = new Map<string, GroupNotificationState>();
    private subscriptions = new Map<string, Subscription>();
    private retryCount = 0;
    private retryTimer: NodeJS.Timeout | null = null;
    private isDisposed = false;
    private isFirstDocument = true;
    // Track baseline states when groups are first seen to distinguish new changes from pre-existing ones
    private baselineGroupStates = new Map<string, GroupNotificationState>();

    constructor(private firebaseService: FirebaseService) {}

    /**
     * Subscribe to user notifications
     * Returns unsubscribe function
     */
    subscribe(callbacks: NotificationCallbacks, config?: NotificationConfig): () => void {
        if (this.isDisposed) {
            throw new Error('UserNotificationDetector has been disposed');
        }

        // Generate unique subscription ID
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store subscription
        const subscription: Subscription = {
            id: subscriptionId,
            callbacks,
            config: config || {},
        };
        this.subscriptions.set(subscriptionId, subscription);

        this.startListener();

        // Return unsubscribe function that removes this specific subscription
        return () => this.unsubscribeSubscription(subscriptionId);
    }

    /**
     * Start the Firestore listener
     */
    private startListener(): void {
        if (this.listener) {
            return;
        }

        const userId = this.firebaseService.getCurrentUserId();
        if (!userId) {
            throw new Error('Cannot setup notification listener: user not authenticated');
        }

        this.listener = this.firebaseService.onDocumentSnapshot(
            'user-notifications',
            userId,
            (snapshot) => this.handleSnapshot(snapshot),
            (error) => this.handleError(error),
        );
    }

    /**
     * Helper method to call a specific callback across all active subscriptions
     */
    private callAllSubscriptions(callbackName: keyof NotificationCallbacks, ...args: any[]): void {
        for (const subscription of this.subscriptions.values()) {
            const callback = subscription.callbacks[callbackName];
            if (callback && typeof callback === 'function') {
                try {
                    (callback as any)(...args);
                } catch (error) {
                    logError(`Error in ${callbackName} callback:`, error);
                }
            }
        }
    }

    /**
     * Handle snapshot updates
     */
    private handleSnapshot(snapshot: any): void {
        try {
            if (!snapshot.exists()) {
                // No notification document yet - this is normal for new users
                return;
            }

            const data = snapshot.data() as UserNotificationDocument;

            // Only log when we actually have new changes to process
            const hasNewChanges = data.changeVersion > this.lastVersion;
            if (!hasNewChanges) {
                return;
            }

            logInfo('UserNotificationDetector: processing changes', {
                changeVersion: data.changeVersion,
                lastVersion: this.lastVersion,
                groupCount: Object.keys(data.groups || {}).length,
            });

            // Process changes
            this.processChanges(data);

            // Update version and mark that we've processed at least one document
            this.lastVersion = data.changeVersion;
            this.isFirstDocument = false;

            // Reset retry count on successful update
            this.retryCount = 0;
        } catch (error) {
            logError('UserNotificationDetector: error processing snapshot', error as Error);
            this.handleError(error as Error);
        }
    }

    /**
     * Process changes and trigger appropriate callbacks
     */
    private processChanges(data: UserNotificationDocument): void {
        if (!data.groups) {
            return;
        }

        for (const [groupId, groupData] of Object.entries(data.groups)) {
            const lastState = this.lastGroupStates.get(groupId);

            // Check for group details changes
            if (this.hasGroupDetailsChanged(groupData, lastState)) {
                logInfo('UserNotificationDetector: group change detected', { groupId });
                this.callAllSubscriptions('onGroupChange', groupId);
            }

            // Check for transaction changes (expenses/settlements)
            if (this.hasTransactionChanged(groupId, groupData, lastState)) {
                logInfo('UserNotificationDetector: transaction change detected', { groupId });
                this.callAllSubscriptions('onTransactionChange', groupId);
            }

            // Check for balance changes
            if (this.hasBalanceChanged(groupId, groupData, lastState)) {
                logInfo('UserNotificationDetector: balance change detected', { groupId });
                this.callAllSubscriptions('onBalanceChange', groupId);
            }

            // Check for comment changes
            if (this.hasCommentChanged(groupId, groupData, lastState)) {
                logInfo('UserNotificationDetector: comment change detected', { groupId });

                // Since the backend notification system doesn't distinguish between group and expense comments,
                // and we don't have the specific expense ID here, we need a different approach.
                //
                // The comments store should listen for comment changes in the entire group,
                // and then decide internally whether to refresh based on its current target.
                // We'll pass the group ID for both types and let the store handle the logic.

                this.callAllSubscriptions('onCommentChange', 'group', groupId);
                // Also trigger for any expense comments in this group
                this.callAllSubscriptions('onCommentChange', 'expense', groupId);
            }

            // Update last state
            this.lastGroupStates.set(groupId, { ...groupData });
        }

        // Clean up states for groups that no longer exist in the document
        const currentGroupIds = new Set(Object.keys(data.groups));
        for (const [groupId] of this.lastGroupStates) {
            if (!currentGroupIds.has(groupId)) {
                logInfo('UserNotificationDetector: group removed from user notifications', { groupId });
                this.lastGroupStates.delete(groupId);

                // Notify callback that the group was removed (deleted or user was removed)
                this.callAllSubscriptions('onGroupRemoved', groupId);
            }
        }
    }

    /**
     * Check if group details have changed
     */
    private hasGroupDetailsChanged(current: GroupNotificationState, last: GroupNotificationState | undefined): boolean {
        if (!last) {
            // First time seeing this group in our tracking map
            // Never trigger on first document if there are existing changes (prevents spurious callbacks)
            // But allow subsequent documents to trigger normally
            if (this.isFirstDocument && current.groupDetailsChangeCount > 0) {
                // logInfo('UserNotificationDetector: Skipping group details callback for first document with existing changes', {
                //     groupId,
                //     groupDetailsChangeCount: current.groupDetailsChangeCount
                // });
                return false;
            }

            // For non-first documents, trigger based on change count
            return current.groupDetailsChangeCount > 0;
        }

        return current.groupDetailsChangeCount > last.groupDetailsChangeCount;
    }

    /**
     * Check if transactions have changed
     */
    private hasTransactionChanged(groupId: string, current: GroupNotificationState, last: GroupNotificationState | undefined): boolean {
        if (!last) {
            // First time seeing this group in our tracking map
            // Set baseline for comparison and check if this is a new change
            const baseline = this.baselineGroupStates.get(groupId);
            if (!baseline) {
                // First time ever seeing this group - store as baseline
                this.baselineGroupStates.set(groupId, {
                    transactionChangeCount: current.transactionChangeCount || 0,
                    balanceChangeCount: current.balanceChangeCount || 0,
                    groupDetailsChangeCount: current.groupDetailsChangeCount || 0,
                    commentChangeCount: current.commentChangeCount || 0,
                    lastTransactionChange: current.lastTransactionChange || null,
                    lastBalanceChange: current.lastBalanceChange || null,
                    lastGroupDetailsChange: current.lastGroupDetailsChange || null,
                    lastCommentChange: current.lastCommentChange || null,
                });

                // Only trigger if this is not the first document and has transaction changes
                return !this.isFirstDocument && (current.transactionChangeCount || 0) > 0;
            }

            // We have a baseline - check if transaction count increased since baseline
            const currentCount = current.transactionChangeCount || 0;
            const baselineCount = baseline.transactionChangeCount || 0;
            const shouldTrigger = currentCount > baselineCount;

            return shouldTrigger;
        }

        return (current.transactionChangeCount || 0) > (last.transactionChangeCount || 0);
    }

    /**
     * Check if balances have changed
     */
    private hasBalanceChanged(groupId: string, current: GroupNotificationState, last: GroupNotificationState | undefined): boolean {
        if (!last) {
            // First time seeing this group in our tracking map
            // Set baseline for comparison and check if this is a new change
            const baseline = this.baselineGroupStates.get(groupId);
            if (!baseline) {
                // Baseline already set in hasTransactionChanged - no need to set again
                // Only trigger if this is not the first document and has balance changes
                return !this.isFirstDocument && (current.balanceChangeCount || 0) > 0;
            }

            // We have a baseline - check if balance count increased since baseline
            const currentCount = current.balanceChangeCount || 0;
            const baselineCount = baseline.balanceChangeCount || 0;
            const shouldTrigger = currentCount > baselineCount;

            return shouldTrigger;
        }

        return (current.balanceChangeCount || 0) > (last.balanceChangeCount || 0);
    }

    /**
     * Check if comments have changed
     */
    private hasCommentChanged(groupId: string, current: GroupNotificationState, last: GroupNotificationState | undefined): boolean {
        if (!last) {
            // First time seeing this group in our tracking map
            // Set baseline for comparison and check if this is a new change
            const baseline = this.baselineGroupStates.get(groupId);
            if (!baseline) {
                // Baseline already set in hasTransactionChanged - no need to set again
                // Only trigger if this is not the first document and has comment changes
                return !this.isFirstDocument && (current.commentChangeCount || 0) > 0;
            }

            // We have a baseline - check if comment count increased since baseline
            const currentCount = current.commentChangeCount || 0;
            const baselineCount = baseline.commentChangeCount || 0;
            const shouldTrigger = currentCount > baselineCount;

            return shouldTrigger;
        }

        return (current.commentChangeCount || 0) > (last.commentChangeCount || 0);
    }

    /**
     * Handle subscription errors with retry logic
     */
    private handleError(error: Error): void {
        logError('UserNotificationDetector: subscription error', error, {
            retryCount: this.retryCount,
        });

        // Call error callbacks for all subscriptions
        for (const subscription of this.subscriptions.values()) {
            if (subscription.config.onError) {
                try {
                    subscription.config.onError(error);
                } catch (callbackError) {
                    logError('Error in onError callback:', callbackError);
                }
            }
        }

        // Implement retry logic - use max values from all subscriptions
        let maxRetries = 3;
        let retryDelay = 2000;
        for (const subscription of this.subscriptions.values()) {
            maxRetries = Math.max(maxRetries, subscription.config.maxRetries || 3);
            retryDelay = Math.max(retryDelay, subscription.config.retryDelay || 2000);
        }

        if (this.retryCount < maxRetries && !this.isDisposed) {
            this.retryCount++;

            // Retry subscription with exponential backoff

            // Stop current listener
            if (this.listener) {
                this.listener();
                this.listener = null;
            }

            // Retry after delay
            this.retryTimer = setTimeout(
                () => {
                    if (!this.isDisposed) {
                        this.startListener();
                    }
                },
                retryDelay * Math.pow(2, this.retryCount - 1),
            ); // Exponential backoff
        } else {
            logError('UserNotificationDetector: max retries exceeded, giving up');
        }
    }

    /**
     * Unsubscribe a specific subscription
     */
    private unsubscribeSubscription(subscriptionId: string): void {
        this.subscriptions.delete(subscriptionId);

        // If no more subscriptions, stop the listener
        if (this.subscriptions.size === 0) {
            this.stopListener();
        }
    }

    /**
     * Stop the Firebase listener and reset state
     */
    private stopListener(): void {
        // Clear retry timer
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        // Stop listener
        if (this.listener) {
            this.listener();
            this.listener = null;
        }

        // Reset state for potential reuse
        this.lastVersion = 0;
        this.lastGroupStates.clear();
        this.baselineGroupStates.clear();
        this.isFirstDocument = true;
        this.retryCount = 0;
    }

    /**
     * Unsubscribe from current listener without disposing detector
     * @deprecated Use the unsubscribe function returned by subscribe() instead
     */
    unsubscribe(): void {
        // Clear all subscriptions and stop listener
        this.subscriptions.clear();
        this.stopListener();
    }

    /**
     * Dispose the detector and clean up resources
     * This permanently disables the detector
     */
    dispose(): void {
        if (this.isDisposed) {
            return;
        }

        // Disposing detector - routine cleanup

        this.isDisposed = true;

        // Unsubscribe first
        this.unsubscribe();

        // Clear baseline states
        this.baselineGroupStates.clear();
    }

    /**
     * Get current state for debugging
     */
    getDebugInfo(): any {
        return {
            isDisposed: this.isDisposed,
            hasListener: !!this.listener,
            lastVersion: this.lastVersion,
            trackedGroups: Array.from(this.lastGroupStates.keys()),
            retryCount: this.retryCount,
            activeSubscriptions: this.subscriptions.size,
            subscriptionIds: Array.from(this.subscriptions.keys()),
        };
    }
}

export const userNotificationDetector = new UserNotificationDetector(firebaseService)
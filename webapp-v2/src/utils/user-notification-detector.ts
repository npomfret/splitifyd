import { doc, onSnapshot, Unsubscribe, Timestamp } from 'firebase/firestore';
import { getDb } from '../app/firebase';
import { logInfo, logError } from './browser-logger';

/**
 * User notification detector callbacks
 * These match the ChangeDetector interface for backward compatibility
 */
export interface NotificationCallbacks {
    onGroupChange?: (groupId: string) => void;
    onTransactionChange?: (groupId: string) => void;
    onBalanceChange?: (groupId: string) => void;
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
    transactionChangeCount: number;
    balanceChangeCount: number;
    groupDetailsChangeCount: number;
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
        type: 'transaction' | 'balance' | 'group';
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
export class UserNotificationDetector {
    private listener: Unsubscribe | null = null;
    private lastVersion = 0;
    private lastGroupStates = new Map<string, GroupNotificationState>();
    private callbacks: NotificationCallbacks = {};
    private config: NotificationConfig = {};
    private retryCount = 0;
    private retryTimer: NodeJS.Timeout | null = null;
    private isDisposed = false;
    private userId: string | null = null;

    constructor() {
        logInfo('UserNotificationDetector: created');
    }

    /**
     * Subscribe to user notifications
     * Returns unsubscribe function
     */
    subscribe(userId: string, callbacks: NotificationCallbacks, config?: NotificationConfig): () => void {
        if (this.isDisposed) {
            throw new Error('UserNotificationDetector has been disposed');
        }

        logInfo('UserNotificationDetector: subscribe', { userId });
        
        this.userId = userId;
        this.callbacks = callbacks;
        this.config = config || {};
        
        // Start listening immediately
        this.startListener();
        
        // Return unsubscribe function that cleans up without disposing
        return () => this.unsubscribe();
    }

    /**
     * Start the Firestore listener
     */
    private startListener(): void {
        if (!this.userId || this.listener) {
            return;
        }

        logInfo('UserNotificationDetector: starting listener', { userId: this.userId });
        
        const docRef = doc(getDb(), 'user-notifications', this.userId);
        
        this.listener = onSnapshot(
            docRef,
            (snapshot) => this.handleSnapshot(snapshot),
            (error) => this.handleError(error)
        );
    }

    /**
     * Handle snapshot updates
     */
    private handleSnapshot(snapshot: any): void {
        try {
            if (!snapshot.exists()) {
                logInfo('UserNotificationDetector: no notification document yet', { userId: this.userId });
                return;
            }

            const data = snapshot.data() as UserNotificationDocument;
            
            logInfo('UserNotificationDetector: received update', { 
                userId: this.userId,
                changeVersion: data.changeVersion,
                lastVersion: this.lastVersion,
                groupCount: Object.keys(data.groups || {}).length
            });

            // Skip if no new changes (first load or duplicate)
            if (data.changeVersion <= this.lastVersion) {
                logInfo('UserNotificationDetector: skipping - no new changes');
                return;
            }

            // Process changes
            this.processChanges(data);
            
            // Update version
            this.lastVersion = data.changeVersion;
            
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
            if (this.callbacks.onGroupChange && this.hasGroupDetailsChanged(groupId, groupData, lastState)) {
                logInfo('UserNotificationDetector: group change detected', { groupId });
                this.callbacks.onGroupChange(groupId);
            }
            
            // Check for transaction changes (expenses/settlements)
            if (this.callbacks.onTransactionChange && this.hasTransactionChanged(groupId, groupData, lastState)) {
                logInfo('UserNotificationDetector: transaction change detected', { groupId });
                this.callbacks.onTransactionChange(groupId);
            }
            
            // Check for balance changes
            if (this.callbacks.onBalanceChange && this.hasBalanceChanged(groupId, groupData, lastState)) {
                logInfo('UserNotificationDetector: balance change detected', { groupId });
                this.callbacks.onBalanceChange(groupId);
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
                if (this.callbacks.onGroupRemoved) {
                    this.callbacks.onGroupRemoved(groupId);
                }
            }
        }
    }

    /**
     * Check if group details have changed
     */
    private hasGroupDetailsChanged(
        groupId: string, 
        current: GroupNotificationState, 
        last: GroupNotificationState | undefined
    ): boolean {
        if (!last) {
            // First time seeing this group - trigger change if there have been any updates
            return current.groupDetailsChangeCount > 0;
        }
        
        return current.groupDetailsChangeCount > last.groupDetailsChangeCount;
    }

    /**
     * Check if transactions have changed
     */
    private hasTransactionChanged(
        groupId: string, 
        current: GroupNotificationState, 
        last: GroupNotificationState | undefined
    ): boolean {
        if (!last) {
            // First time seeing this group - trigger change if there have been any updates
            return current.transactionChangeCount > 0;
        }
        
        return current.transactionChangeCount > last.transactionChangeCount;
    }

    /**
     * Check if balances have changed
     */
    private hasBalanceChanged(
        groupId: string, 
        current: GroupNotificationState, 
        last: GroupNotificationState | undefined
    ): boolean {
        if (!last) {
            // First time seeing this group - trigger change if there have been any updates
            return current.balanceChangeCount > 0;
        }
        
        return current.balanceChangeCount > last.balanceChangeCount;
    }

    /**
     * Handle subscription errors with retry logic
     */
    private handleError(error: Error): void {
        logError('UserNotificationDetector: subscription error', error, { 
            userId: this.userId,
            retryCount: this.retryCount
        });

        // Call error callback if provided
        if (this.config.onError) {
            this.config.onError(error);
        }

        // Implement retry logic
        const maxRetries = this.config.maxRetries || 3;
        const retryDelay = this.config.retryDelay || 2000;

        if (this.retryCount < maxRetries && !this.isDisposed) {
            this.retryCount++;
            
            logInfo('UserNotificationDetector: retrying subscription', { 
                retryCount: this.retryCount,
                maxRetries,
                retryDelay
            });
            
            // Stop current listener
            if (this.listener) {
                this.listener();
                this.listener = null;
            }
            
            // Retry after delay
            this.retryTimer = setTimeout(() => {
                if (!this.isDisposed) {
                    this.startListener();
                }
            }, retryDelay * Math.pow(2, this.retryCount - 1)); // Exponential backoff
        } else {
            logError('UserNotificationDetector: max retries exceeded, giving up');
        }
    }

    /**
     * Unsubscribe from current listener without disposing detector
     * Allows detector to be reused for new subscriptions
     */
    unsubscribe(): void {
        logInfo('UserNotificationDetector: unsubscribing', { userId: this.userId });
        
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
        
        // Clear subscription state but keep detector alive
        this.lastVersion = 0;
        this.lastGroupStates.clear();
        this.callbacks = {};
        this.config = {};
        this.retryCount = 0;
        this.userId = null;
    }

    /**
     * Dispose the detector and clean up resources
     * This permanently disables the detector
     */
    dispose(): void {
        if (this.isDisposed) {
            return;
        }

        logInfo('UserNotificationDetector: disposing', { userId: this.userId });
        
        this.isDisposed = true;
        
        // Unsubscribe first
        this.unsubscribe();
    }

    /**
     * Get current state for debugging
     */
    getDebugInfo(): any {
        return {
            userId: this.userId,
            isDisposed: this.isDisposed,
            hasListener: !!this.listener,
            lastVersion: this.lastVersion,
            trackedGroups: Array.from(this.lastGroupStates.keys()),
            retryCount: this.retryCount
        };
    }
}
import * as admin from 'firebase-admin';
import {GroupId} from "@splitifyd/shared";

/**
 * User notification document structure (matches webapp's UserNotificationDetector)
 */
export interface UserNotificationDocument {
    changeVersion: number;
    groups: {
        [groupId: GroupId]: GroupNotificationState;
    };
    lastModified: admin.firestore.Timestamp;
    recentChanges?: Array<{
        groupId: GroupId;
        type: 'transaction' | 'balance' | 'group' | 'comment';
        timestamp: admin.firestore.Timestamp;
    }>;
}

export interface GroupNotificationState {
    lastTransactionChange: admin.firestore.Timestamp | null;
    lastBalanceChange: admin.firestore.Timestamp | null;
    lastGroupDetailsChange: admin.firestore.Timestamp | null;
    lastCommentChange: admin.firestore.Timestamp | null;
    transactionChangeCount: number;
    balanceChangeCount: number;
    groupDetailsChangeCount: number;
    commentChangeCount: number;
}

/**
 * Notification event data
 */
export interface NotificationEvent {
    userId: string;
    groupId: GroupId;
    type: 'transaction' | 'balance' | 'group' | 'comment';
    version: number;
    groupState?: GroupNotificationState;
}

/**
 * NotificationDriver - Test helper for Firebase real-time notifications
 *
 * Provides a clean API for testing the user notification system that
 * the webapp relies on. Follows the same pattern as ApiDriver.
 */
export class NotificationDriver {
    private activeListeners = new Map<string, NotificationListener>();

    constructor(private firestore: admin.firestore.Firestore) {}

    /**
     * Stop all active listeners
     */
    async stopAllListeners(): Promise<void> {
        // Stop all listeners and wait for Firestore cleanup
        await Promise.all(Array.from(this.activeListeners.values()).map((listener) => listener.stop()));
        this.activeListeners.clear();
    }

    /**
     * Clear events for all active listeners
     */
    clearEvents(): void {
        for (const [_, listener] of this.activeListeners) {
            listener.clearEvents();
        }
    }

    /**
     * Wait for the ENTIRE notification system to be quiet by checking Firestore directly
     * This detects activity from ANY user, including zombie listeners from previous tests
     *
     * @param quietDurationMs - How long the system must be quiet (default: 200ms)
     * @param timeoutMs - Maximum time to wait (default: 10000ms) ... it can take a long time for the emulator to process them all
     * @returns Promise that resolves when system is quiet or timeout occurs
     */
    async waitForQuiet(quietDurationMs: number = 200, timeoutMs: number = 10000): Promise<void> {
        const startTime = Date.now();
        const checkIntervalMs = 50; // Poll every 50ms

        while (Date.now() - startTime < timeoutMs) {
            // Query Firestore directly for recent notification updates
            const cutoffTime = new Date(Date.now() - quietDurationMs);
            const recentUpdates = await this.firestore.collection('user-notifications').where('lastModified', '>', cutoffTime).get();

            if (recentUpdates.empty) {
                // System is quiet - no notifications updated in the last quietDurationMs
                return;
            }

            // System still busy - wait before checking again
            await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
        }

        // Timeout - query again to see which users are still active
        const cutoffTime = new Date(Date.now() - quietDurationMs);
        const recentUpdates = await this.firestore.collection('user-notifications').where('lastModified', '>', cutoffTime).get();

        const activeUsers = recentUpdates.docs.map((doc) => doc.id);
        console.warn(`⚠️  waitForQuiet timed out after ${timeoutMs}ms. Recent activity from ${activeUsers.length} users: ${activeUsers.join(', ')}`);
    }

    /**
     * Set up listeners for multiple users BEFORE any test actions
     * This captures ALL events from the beginning
     */
    async setupListeners(userIds: string[]): Promise<NotificationListener[]> {
        const listeners = [];

        for (const userId of userIds) {
            if (this.activeListeners.has(userId)) {
                throw new Error(`Already listening to notifications for user: ${userId}`);
            }

            const listener = new NotificationListener(this.firestore, userId);
            await listener.start();

            this.activeListeners.set(userId, listener);
            listeners.push(listener);
        }

        return listeners;
    }
}

/**
 * Individual notification listener that mimics webapp behavior
 */
export class NotificationListener {
    private listener: (() => void) | null = null;
    private receivedEvents: UserNotificationDocument[] = [];
    private isStarted = false;
    private baselineCounters: Map<string, GroupNotificationState> = new Map();

    constructor(
        private firestore: admin.firestore.Firestore,
        private userId: string,
    ) {}

    async start(): Promise<void> {
        if (this.isStarted) {
            throw new Error('Listener already started');
        }

        return new Promise((resolve, reject) => {
            const docRef = this.firestore.collection('user-notifications').doc(this.userId);

            let hasInitialSnapshot = false;

            this.listener = docRef.onSnapshot(
                (snapshot) => {
                    try {
                        if (!hasInitialSnapshot) {
                            hasInitialSnapshot = true;
                            this.isStarted = true;
                            resolve();
                        }

                        this.handleSnapshot(snapshot);
                    } catch (error) {
                        if (!hasInitialSnapshot) {
                            reject(error);
                        }
                    }
                },
                (error) => {
                    if (!hasInitialSnapshot) {
                        reject(error);
                    }
                },
            );
        });
    }

    private handleSnapshot(snapshot: admin.firestore.DocumentSnapshot): void {
        if (!snapshot.exists) {
            console.log(`📭 No notification document exists for user [${this.userId}]`);
            return;
        }

        const data = snapshot.data() as UserNotificationDocument;

        // Get the last version from our events, or 0 if no events yet
        const lastVersion = this.receivedEvents.length > 0 ? this.receivedEvents[this.receivedEvents.length - 1].changeVersion : 0;

        // Skip if no new changes
        if (data.changeVersion <= lastVersion) {
            return;
        }

        // Just store the raw notification document update!
        this.receivedEvents.push({ ...data });
    }

    async stop(): Promise<void> {
        if (this.listener) {
            this.listener(); // Synchronous unsubscribe call
            this.listener = null;
        }
        this.isStarted = false;
    }

    /**
     * Clear all received events (useful for isolating test actions)
     * Saves current counter values as baseline to prevent counting pre-clear events
     */
    clearEvents(): void {
        // Save current counter values as baseline before clearing
        if (this.receivedEvents.length > 0) {
            const lastDoc = this.receivedEvents[this.receivedEvents.length - 1];
            if (lastDoc.groups) {
                for (const [groupId, groupState] of Object.entries(lastDoc.groups)) {
                    this.baselineCounters.set(groupId, { ...groupState });
                }
            }
        }
        this.receivedEvents = [];
    }

    /**
     * Get events for a group, optionally filtered by type
     * Only creates events when a counter actually changes (increments), not just when it exists
     * Uses baseline counters from clearEvents() to avoid counting pre-clear events
     */
    getGroupEvents(groupId: GroupId, eventType?: 'transaction' | 'balance' | 'group' | 'comment'): NotificationEvent[] {
        const events: NotificationEvent[] = [];
        const baseline = this.baselineCounters.get(groupId);
        let previousGroupState: GroupNotificationState | null = baseline ?? null;

        for (const doc of this.receivedEvents) {
            if (!doc.groups || !doc.groups[groupId]) continue;

            const groupState = doc.groups[groupId];
            const baseEvent = {
                userId: this.userId,
                groupId,
                version: doc.changeVersion,
                groupState,
            };

            // Only create events for counters that changed (increased)
            if (!eventType || eventType === 'transaction') {
                const prevCount = previousGroupState?.transactionChangeCount ?? 0;
                const currCount = groupState.transactionChangeCount ?? 0;
                if (currCount > prevCount) {
                    events.push({ ...baseEvent, type: 'transaction' });
                }
            }
            if (!eventType || eventType === 'balance') {
                const prevCount = previousGroupState?.balanceChangeCount ?? 0;
                const currCount = groupState.balanceChangeCount ?? 0;
                if (currCount > prevCount) {
                    events.push({ ...baseEvent, type: 'balance' });
                }
            }
            if (!eventType || eventType === 'group') {
                const prevCount = previousGroupState?.groupDetailsChangeCount ?? 0;
                const currCount = groupState.groupDetailsChangeCount ?? 0;
                if (currCount > prevCount) {
                    events.push({ ...baseEvent, type: 'group' });
                }
            }
            if (!eventType || eventType === 'comment') {
                const prevCount = previousGroupState?.commentChangeCount ?? 0;
                const currCount = groupState.commentChangeCount ?? 0;
                if (currCount > prevCount) {
                    events.push({ ...baseEvent, type: 'comment' });
                }
            }

            // Update previous state for next iteration
            previousGroupState = groupState;
        }

        return events;
    }

    /**
     * Wait for a specific number of events of a given type for a group
     */
    async waitForEventCount(groupId: GroupId, eventType: 'transaction' | 'balance' | 'group' | 'comment', minCount: number, timeoutMs: number = 3000): Promise<NotificationEvent[]> {
        const startTime = Date.now();

        while (true) {
            const events = this.getGroupEvents(groupId, eventType);

            if (events.length >= minCount) {
                return events.slice(0, minCount);
            }

            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout after ${timeoutMs}ms waiting for ${minCount} "${eventType}" events for group ${groupId}. Got ${events.length}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    /**
     * Assert exact number of events for a group with detailed error message
     */
    assertEventCount(groupId: GroupId, expectedCount: number, eventType?: 'transaction' | 'balance' | 'group' | 'comment'): void {
        const events = this.getGroupEvents(groupId, eventType);
        const actualCount = events.length;
        const typeStr = eventType ? ` ${eventType}` : '';

        if (actualCount !== expectedCount) {
            const eventDetails = events
                .map((e, index) => {
                    return `\t${index + 1}. ${JSON.stringify(e)}`;
                })
                .join('\n');

            const allEventsDetails = this
                .receivedEvents
                .map((doc, index) => {
                    const eventJson = {
                        version: doc.changeVersion,
                        groupCount: Object.keys(doc.groups || {}).length,
                        groupIds: Object.keys(doc.groups || {}),
                    };
                    return `\t${index + 1}. ${JSON.stringify(eventJson)}`;
                })
                .join('\n');

            const errorMessage = [
                `User [${this.userId}] expected ${expectedCount}${typeStr} events for group [${groupId}] but got ${actualCount}:`,
                eventDetails || '\t(no events)',
                '',
                `All events for this user (${this.receivedEvents.length}):`,
                allEventsDetails || '\t(no events)',
            ]
                .join('\n');

            throw new Error(errorMessage);
        }
    }

    /**
     * Wait for a group event and validate its structure
     */
    async waitForGroupEvent(groupId: GroupId, expectedChangeCount: number = 1, timeoutMs: number = 10000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'group', 1, timeoutMs);
        const event = events[0];

        if (event.groupState?.groupDetailsChangeCount !== expectedChangeCount) {
            throw new Error(`Expected groupDetailsChangeCount to be ${expectedChangeCount}, but got ${event.groupState?.groupDetailsChangeCount}`);
        }

        return event;
    }

    /**
     * Wait for a transaction event and validate its structure
     */
    async waitForTransactionEvent(groupId: GroupId, expectedChangeCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'transaction', 1, timeoutMs);
        const event = events[0];

        if (event.groupState?.transactionChangeCount !== expectedChangeCount) {
            throw new Error(`Expected transactionChangeCount to be ${expectedChangeCount}, but got ${event.groupState?.transactionChangeCount}`);
        }

        return event;
    }

    /**
     * Wait for a balance event and validate its structure
     */
    async waitForBalanceEvent(groupId: GroupId, expectedChangeCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'balance', 1, timeoutMs);
        const event = events[0];

        if (event.groupState?.balanceChangeCount !== expectedChangeCount) {
            throw new Error(`Expected balanceChangeCount to be ${expectedChangeCount}, but got ${event.groupState?.balanceChangeCount}`);
        }

        return event;
    }

    /**
     * Wait for a comment event and validate its structure
     */
    async waitForCommentEvent(groupId: GroupId, expectedChangeCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'comment', 1, timeoutMs);
        const event = events[0];

        if (event.groupState?.commentChangeCount !== expectedChangeCount) {
            throw new Error(`Expected commentChangeCount to be ${expectedChangeCount}, but got ${event.groupState?.commentChangeCount}`);
        }

        return event;
    }
}

import * as admin from 'firebase-admin';

/**
 * User notification document structure (matches webapp's UserNotificationDetector)
 */
export interface UserNotificationDocument {
    changeVersion: number;
    groups: {
        [groupId: string]: GroupNotificationState;
    };
    lastModified: admin.firestore.Timestamp;
    recentChanges?: Array<{
        groupId: string;
        type: 'transaction' | 'balance' | 'group';
        timestamp: admin.firestore.Timestamp;
    }>;
}

export interface GroupNotificationState {
    lastTransactionChange: admin.firestore.Timestamp | null;
    lastBalanceChange: admin.firestore.Timestamp | null;
    lastGroupDetailsChange: admin.firestore.Timestamp | null;
    transactionChangeCount: number;
    balanceChangeCount: number;
    groupDetailsChangeCount: number;
}

/**
 * Notification event data
 */
export interface NotificationEvent {
    userId: string;
    groupId: string;
    type: 'transaction' | 'balance' | 'group';
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
    stopAllListeners(): void {
        for (const [userId, listener] of this.activeListeners) {
            listener.stop();
        }
        this.activeListeners.clear();
    }

    /**
     * Clear events for all active listeners
     */
    clearEvents(): void {
        for (const [userId, listener] of this.activeListeners) {
            listener.clearEvents();
        }
    }

    /**
     * Set up listeners for multiple users BEFORE any test actions
     * This captures ALL events from the beginning
     */
    async setupListenersFirst(userIds: string[]): Promise<NotificationListener[]> {
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

    stop(): void {
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        this.isStarted = false;
    }

    /**
     * Clear all received events (useful for isolating test actions)
     */
    clearEvents(): void {
        this.receivedEvents = [];
    }

    /**
     * Get events for a group, optionally filtered by type
     */
    getGroupEvents(groupId: string, eventType?: 'transaction' | 'balance' | 'group'): NotificationEvent[] {
        const events: NotificationEvent[] = [];

        for (const doc of this.receivedEvents) {
            if (!doc.groups || !doc.groups[groupId]) continue;

            const groupState = doc.groups[groupId];
            const baseEvent = {
                userId: this.userId,
                groupId,
                version: doc.changeVersion,
                groupState,
            };

            // Create events for each type that has counters
            if (!eventType || eventType === 'transaction') {
                if (groupState.transactionChangeCount !== undefined) {
                    events.push({ ...baseEvent, type: 'transaction' });
                }
            }
            if (!eventType || eventType === 'balance') {
                if (groupState.balanceChangeCount !== undefined) {
                    events.push({ ...baseEvent, type: 'balance' });
                }
            }
            if (!eventType || eventType === 'group') {
                if (groupState.groupDetailsChangeCount !== undefined) {
                    events.push({ ...baseEvent, type: 'group' });
                }
            }
        }

        return events;
    }

    /**
     * Wait for a specific number of events of a given type for a group
     */
    async waitForEventCount(groupId: string, eventType: 'transaction' | 'balance' | 'group', minCount: number, timeoutMs: number = 3000): Promise<NotificationEvent[]> {
        const startTime = Date.now();

        while (true) {
            const events = this.getGroupEvents(groupId, eventType);

            if (events.length >= minCount) {
                return events.slice(0, minCount);
            }

            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout waiting for ${minCount} ${eventType} events for group ${groupId}. Got ${events.length}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    /**
     * Assert exact number of events for a group with detailed error message
     */
    assertEventCount(groupId: string, expectedCount: number, eventType?: 'transaction' | 'balance' | 'group'): void {
        const events = this.getGroupEvents(groupId, eventType);
        const actualCount = events.length;
        const typeStr = eventType ? ` ${eventType}` : '';

        if (actualCount !== expectedCount) {
            const eventDetails = events
                .map((e, index) => {
                    return `\t${index + 1}. ${JSON.stringify(e)}`;
                })
                .join('\n');

            const allEventsDetails = this.receivedEvents
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
            ].join('\n');

            throw new Error(errorMessage);
        }
    }

    /**
     * Wait for a group event and validate its structure
     */
    async waitForGroupEvent(groupId: string, expectedChangeCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
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
    async waitForTransactionEvent(groupId: string, expectedChangeCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
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
    async waitForBalanceEvent(groupId: string, expectedChangeCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'balance', 1, timeoutMs);
        const event = events[0];

        if (event.groupState?.balanceChangeCount !== expectedChangeCount) {
            throw new Error(`Expected balanceChangeCount to be ${expectedChangeCount}, but got ${event.groupState?.balanceChangeCount}`);
        }

        return event;
    }
}

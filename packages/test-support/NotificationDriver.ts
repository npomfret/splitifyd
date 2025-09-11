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
    type: 'transaction' | 'balance' | 'group' | 'group_removed';
    version: number;
    timestamp: Date;
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
     * Stop listening for a specific user
     */
    stopListening(userId: string): void {
        const listener = this.activeListeners.get(userId);
        if (listener) {
            listener.stop();
            this.activeListeners.delete(userId);
        }
    }

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
     * Set up listeners for multiple users BEFORE any test actions
     * This captures ALL events from the beginning
     */
    async setupListenersFirst(userIds: string[]): Promise<NotificationListener[]> {
        console.log('🎧 Setting up listeners FIRST for all users...');
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

        console.log('✅ All listeners started and ready to capture events');
        return listeners;
    }

    /**
     * Clear all events from multiple listeners (useful after setup)
     */
    clearAllListenerEvents(listeners: NotificationListener[]): void {
        console.log('🧹 Clearing all listener events...');
        listeners.forEach((listener) => listener.clearEvents());
    }

    /**
     * Wait for all listeners to receive a specific event type for a group after a timestamp
     */
    async waitForAllListenersToReceiveEvent(
        listeners: NotificationListener[],
        groupId: string,
        eventType: 'transaction' | 'balance' | 'group' | 'group_removed',
        afterTimestamp: number,
        timeoutMs: number = 2000,
    ): Promise<void> {
        console.log(`⏳ Waiting for all listeners to receive ${eventType} event for group ${groupId.slice(-8)}...`);
        await Promise.all(listeners.map((listener) => listener.waitForNewEvent(groupId, eventType, afterTimestamp, timeoutMs)));
        console.log(`✅ All listeners received ${eventType} event for group ${groupId.slice(-8)}`);
    }

    getDebugInfo(): any {
        return {
            activeListeners: Array.from(this.activeListeners.keys()),
            listenerCount: this.activeListeners.size,
            listeners: Object.fromEntries(Array.from(this.activeListeners.entries()).map(([userId, listener]) => [userId, listener.getDebugInfo()])),
        };
    }
}

/**
 * Individual notification listener that mimics webapp behavior
 */
export class NotificationListener {
    private listener: (() => void) | null = null;
    private lastVersion = 0;
    private lastGroupStates = new Map<string, GroupNotificationState>();
    private receivedEvents: NotificationEvent[] = [];
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
        console.log(`🔄 NotificationListener [${this.userId.slice(-8)}] received snapshot, exists: ${snapshot.exists}`);

        if (!snapshot.exists) {
            console.log(`📭 No notification document exists for user [${this.userId.slice(-8)}]`);
            return;
        }

        const data = snapshot.data() as UserNotificationDocument;
        console.log(`📄 NotificationListener [${this.userId.slice(-8)}] snapshot data:`, {
            version: data.changeVersion,
            lastVersion: this.lastVersion,
            groupCount: Object.keys(data.groups || {}).length,
            groupIds: Object.keys(data.groups || {}).map((id) => id.slice(-8)),
        });

        // Handle version reset/corruption - reset listener state if document version went backwards
        if (data.changeVersion < this.lastVersion) {
            console.log(`🔧 Document version went backwards (${this.lastVersion} → ${data.changeVersion}), resetting listener state for user [${this.userId.slice(-8)}]`);
            this.lastVersion = data.changeVersion - 1; // Set to one less so this update gets processed
            this.lastGroupStates.clear();
        }

        // Skip if no new changes
        if (data.changeVersion <= this.lastVersion) {
            console.log(`⏭️ Skipping - no new changes for user [${this.userId.slice(-8)}]`);
            return;
        }

        this.processChanges(data);
        this.lastVersion = data.changeVersion;
        console.log(`✅ Processed changes, new version: ${data.changeVersion} for user [${this.userId.slice(-8)}]`);
    }

    private processChanges(data: UserNotificationDocument): void {
        if (!data.groups) return;

        const timestamp = new Date();

        for (const [groupId, groupData] of Object.entries(data.groups)) {
            const lastState = this.lastGroupStates.get(groupId);

            // Check for different types of changes
            if (this.hasTransactionChanged(groupData, lastState)) {
                const event = {
                    userId: this.userId,
                    groupId,
                    type: 'transaction' as const,
                    version: data.changeVersion,
                    timestamp,
                    groupState: { ...groupData },
                };
                this.receivedEvents.push(event);
                console.log(`📨 NotificationListener [${this.userId.slice(-8)}] received TRANSACTION event:`, {
                    groupId: groupId.slice(-8),
                    version: data.changeVersion,
                    transactionCount: groupData.transactionChangeCount,
                });
            }

            if (this.hasBalanceChanged(groupData, lastState)) {
                const event = {
                    userId: this.userId,
                    groupId,
                    type: 'balance' as const,
                    version: data.changeVersion,
                    timestamp,
                    groupState: { ...groupData },
                };
                this.receivedEvents.push(event);
                console.log(`📨 NotificationListener [${this.userId.slice(-8)}] received BALANCE event:`, {
                    groupId: groupId.slice(-8),
                    version: data.changeVersion,
                    balanceCount: groupData.balanceChangeCount,
                });
            }

            if (this.hasGroupDetailsChanged(groupData, lastState)) {
                const event = {
                    userId: this.userId,
                    groupId,
                    type: 'group' as const,
                    version: data.changeVersion,
                    timestamp,
                    groupState: { ...groupData },
                };
                this.receivedEvents.push(event);
                console.log(`📨 NotificationListener [${this.userId.slice(-8)}] received GROUP event:`, {
                    groupId: groupId.slice(-8),
                    version: data.changeVersion,
                    groupCount: groupData.groupDetailsChangeCount,
                });
            }

            this.lastGroupStates.set(groupId, { ...groupData });
        }

        // Check for removed groups
        const currentGroupIds = new Set(Object.keys(data.groups));
        for (const groupId of Array.from(this.lastGroupStates.keys())) {
            if (!currentGroupIds.has(groupId)) {
                const event = {
                    userId: this.userId,
                    groupId,
                    type: 'group_removed' as const,
                    version: data.changeVersion,
                    timestamp,
                };
                this.receivedEvents.push(event);
                console.log(`📨 NotificationListener [${this.userId.slice(-8)}] received GROUP_REMOVED event:`, {
                    groupId: groupId.slice(-8),
                    version: data.changeVersion,
                });
                this.lastGroupStates.delete(groupId);
            }
        }
    }

    private hasTransactionChanged(current: GroupNotificationState, last?: GroupNotificationState): boolean {
        if (!last) return current.transactionChangeCount > 0;
        return current.transactionChangeCount > last.transactionChangeCount;
    }

    private hasBalanceChanged(current: GroupNotificationState, last?: GroupNotificationState): boolean {
        if (!last) return current.balanceChangeCount > 0;
        return current.balanceChangeCount > last.balanceChangeCount;
    }

    private hasGroupDetailsChanged(current: GroupNotificationState, last?: GroupNotificationState): boolean {
        if (!last) return current.groupDetailsChangeCount > 0;
        return current.groupDetailsChangeCount > last.groupDetailsChangeCount;
    }

    stop(): void {
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        this.isStarted = false;
    }

    /**
     * Get all events received by this listener
     */
    getEvents(): NotificationEvent[] {
        return [...this.receivedEvents];
    }

    /**
     * Get events for a specific group
     */
    getEventsForGroup(groupId: string): NotificationEvent[] {
        return this.receivedEvents.filter((event) => event.groupId === groupId);
    }

    /**
     * Wait for a specific number of events
     */
    async waitForEvents(minCount: number, timeoutMs: number = 2000): Promise<NotificationEvent[]> {
        const startTime = Date.now();

        while (this.receivedEvents.length < minCount) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout waiting for ${minCount} events. Got ${this.receivedEvents.length}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return [...this.receivedEvents];
    }

    /**
     * Clear all received events (useful for isolating test actions)
     */
    clearEvents(): void {
        this.receivedEvents = [];
        console.log(`🗑️ Cleared all events for user [${this.userId.slice(-8)}]`);
    }

    /**
     * Get events received after a specific timestamp
     */
    getEventsSince(timestamp: number): NotificationEvent[] {
        return this.receivedEvents.filter((event) => event.timestamp.getTime() >= timestamp);
    }

    /**
     * Get events for a specific group after a timestamp
     */
    getGroupEventsSince(groupId: string, timestamp: number): NotificationEvent[] {
        return this.receivedEvents.filter((event) => event.groupId === groupId && event.timestamp.getTime() >= timestamp);
    }

    /**
     * Get the latest event of a specific type for a group
     */
    getLatestEvent(groupId: string, eventType: 'transaction' | 'balance' | 'group' | 'group_removed'): NotificationEvent | undefined {
        const events = this.receivedEvents.filter((e) => e.groupId === groupId && e.type === eventType).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return events[0];
    }

    /**
     * Wait for a new event of a specific type after a given timestamp
     */
    async waitForNewEvent(groupId: string, eventType: 'transaction' | 'balance' | 'group' | 'group_removed', afterTimestamp: number, timeoutMs: number = 2000): Promise<NotificationEvent> {
        const startTime = Date.now();

        while (true) {
            const event = this.receivedEvents.find((e) => e.groupId === groupId && e.type === eventType && e.timestamp.getTime() >= afterTimestamp);

            if (event) {
                console.log(`✅ Found new ${eventType} event for group ${groupId.slice(-8)} after timestamp`);
                return event;
            }

            if (Date.now() - startTime > timeoutMs) {
                const existingEvents = this.receivedEvents.filter((e) => e.groupId === groupId);
                throw new Error(
                    `Timeout waiting for new ${eventType} event for group ${groupId} after timestamp ${new Date(afterTimestamp).toISOString()}. ` +
                        `Found ${existingEvents.length} existing events: ${existingEvents.map((e) => `${e.type}@${e.timestamp.toISOString()}`).join(', ')}`,
                );
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    /**
     * Wait for a specific number of events of a given type for a group
     */
    async waitForEventCount(groupId: string, eventType: 'transaction' | 'balance' | 'group' | 'group_removed', minCount: number, timeoutMs: number = 2000): Promise<NotificationEvent[]> {
        const startTime = Date.now();

        while (true) {
            const events = this.receivedEvents.filter((e) => e.groupId === groupId && e.type === eventType);

            if (events.length >= minCount) {
                return events.slice(0, minCount);
            }

            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout waiting for ${minCount} ${eventType} events for group ${groupId}. Got ${events.length}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    getDebugInfo(): any {
        return {
            userId: this.userId,
            isStarted: this.isStarted,
            hasListener: !!this.listener,
            lastVersion: this.lastVersion,
            trackedGroups: Array.from(this.lastGroupStates.keys()),
            eventCount: this.receivedEvents.length,
            recentEvents: this.receivedEvents.slice(-5).map((e) => ({
                groupId: e.groupId,
                type: e.type,
                version: e.version,
                timestamp: e.timestamp.toISOString(),
            })),
        };
    }
}

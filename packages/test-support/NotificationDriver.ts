import * as admin from 'firebase-admin';
import { getFirebaseEmulatorConfig } from './firebase-emulator-config';
import { pollUntil, Matcher, PollOptions } from './Polling';

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
    private firestore: any;
    private activeListeners = new Map<string, NotificationListener>();

    static readonly matchers = {
        hasGroupNotifications: (groupId: string): Matcher<UserNotificationDocument | null> => 
            (doc) => !!doc && !!doc.groups && !!doc.groups[groupId],
            
        hasTransactionChange: (groupId: string, minCount: number = 1): Matcher<UserNotificationDocument | null> => 
            (doc) => !!doc && !!doc.groups[groupId] && doc.groups[groupId].transactionChangeCount >= minCount,
            
        hasBalanceChange: (groupId: string, minCount: number = 1): Matcher<UserNotificationDocument | null> => 
            (doc) => !!doc && !!doc.groups[groupId] && doc.groups[groupId].balanceChangeCount >= minCount,
            
        hasGroupChange: (groupId: string, minCount: number = 1): Matcher<UserNotificationDocument | null> => 
            (doc) => !!doc && !!doc.groups[groupId] && doc.groups[groupId].groupDetailsChangeCount >= minCount,
            
        hasVersion: (minVersion: number): Matcher<UserNotificationDocument | null> =>
            (doc) => !!doc && doc.changeVersion >= minVersion,
            
        groupRemoved: (groupId: string): Matcher<UserNotificationDocument | null> =>
            (doc) => !doc || !doc.groups || !doc.groups[groupId]
    };

    constructor(firestore?: admin.firestore.Firestore) {
        // Use provided firestore instance or default admin instance
        this.firestore = firestore || admin.firestore();
    }

    /**
     * Start listening to user notifications
     * Returns a NotificationListener that can be used to wait for events
     */
    async startListening(userId: string): Promise<NotificationListener> {
        if (this.activeListeners.has(userId)) {
            throw new Error(`Already listening to notifications for user: ${userId}`);
        }

        const listener = new NotificationListener(this.firestore, userId);
        await listener.start();
        
        this.activeListeners.set(userId, listener);
        return listener;
    }

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
     * Get current notification document for a user
     */
    async getCurrentNotifications(userId: string): Promise<UserNotificationDocument | null> {
        const docRef = this.firestore.collection('user-notifications').doc(userId);
        const snapshot = await docRef.get();
        
        if (!snapshot.exists) {
            return null;
        }
        
        return snapshot.data() as UserNotificationDocument;
    }

    /**
     * Poll for notification changes using the same pattern as ApiDriver
     */
    async pollForNotificationChange<T>(
        userId: string,
        matcher: Matcher<UserNotificationDocument | null>,
        options: PollOptions = {}
    ): Promise<UserNotificationDocument | null> {
        return pollUntil(
            () => this.getCurrentNotifications(userId),
            matcher,
            {
                timeout: 10000,
                interval: 500,
                errorMsg: `Notification change not detected for user ${userId}`,
                ...options
            }
        );
    }

    /**
     * Wait for transaction change in a specific group
     */
    async waitForTransactionChange(
        userId: string, 
        groupId: string, 
        minCount: number = 1,
        options: PollOptions = {}
    ): Promise<UserNotificationDocument> {
        const result = await this.pollForNotificationChange(
            userId,
            NotificationDriver.matchers.hasTransactionChange(groupId, minCount),
            {
                errorMsg: `Transaction change not detected for group ${groupId}`,
                ...options
            }
        );
        
        if (!result) {
            throw new Error(`No notification document found for user ${userId}`);
        }
        
        return result;
    }

    /**
     * Wait for balance change in a specific group
     */
    async waitForBalanceChange(
        userId: string, 
        groupId: string, 
        minCount: number = 1,
        options: PollOptions = {}
    ): Promise<UserNotificationDocument> {
        const result = await this.pollForNotificationChange(
            userId,
            NotificationDriver.matchers.hasBalanceChange(groupId, minCount),
            {
                errorMsg: `Balance change not detected for group ${groupId}`,
                ...options
            }
        );
        
        if (!result) {
            throw new Error(`No notification document found for user ${userId}`);
        }
        
        return result;
    }

    /**
     * Wait for group details change
     */
    async waitForGroupChange(
        userId: string, 
        groupId: string, 
        minCount: number = 1,
        options: PollOptions = {}
    ): Promise<UserNotificationDocument> {
        const result = await this.pollForNotificationChange(
            userId,
            NotificationDriver.matchers.hasGroupChange(groupId, minCount),
            {
                errorMsg: `Group change not detected for group ${groupId}`,
                ...options
            }
        );
        
        if (!result) {
            throw new Error(`No notification document found for user ${userId}`);
        }
        
        return result;
    }

    /**
     * Wait for group to be removed from user notifications
     */
    async waitForGroupRemoval(
        userId: string, 
        groupId: string,
        options: PollOptions = {}
    ): Promise<UserNotificationDocument | null> {
        return this.pollForNotificationChange(
            userId,
            NotificationDriver.matchers.groupRemoved(groupId),
            {
                errorMsg: `Group ${groupId} was not removed from user notifications`,
                ...options
            }
        );
    }

    /**
     * Wait for notification version to reach a minimum value
     */
    async waitForVersion(
        userId: string, 
        minVersion: number,
        options: PollOptions = {}
    ): Promise<UserNotificationDocument> {
        const result = await this.pollForNotificationChange(
            userId,
            NotificationDriver.matchers.hasVersion(minVersion),
            {
                errorMsg: `Notification version ${minVersion} not reached`,
                ...options
            }
        );
        
        if (!result) {
            throw new Error(`No notification document found for user ${userId}`);
        }
        
        return result;
    }

    /**
     * Get debug information about active listeners
     */
    getDebugInfo(): any {
        return {
            activeListeners: Array.from(this.activeListeners.keys()),
            listenerCount: this.activeListeners.size,
            listeners: Object.fromEntries(
                Array.from(this.activeListeners.entries()).map(([userId, listener]) => [
                    userId, 
                    listener.getDebugInfo()
                ])
            )
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

    constructor(private firestore: admin.firestore.Firestore, private userId: string) {}

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
                }
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
            groupIds: Object.keys(data.groups || {}).map(id => id.slice(-8))
        });
        
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
                    groupState: { ...groupData }
                };
                this.receivedEvents.push(event);
                console.log(`📨 NotificationListener [${this.userId.slice(-8)}] received TRANSACTION event:`, {
                    groupId: groupId.slice(-8),
                    version: data.changeVersion,
                    transactionCount: groupData.transactionChangeCount
                });
            }
            
            if (this.hasBalanceChanged(groupData, lastState)) {
                const event = {
                    userId: this.userId,
                    groupId,
                    type: 'balance' as const,
                    version: data.changeVersion,
                    timestamp,
                    groupState: { ...groupData }
                };
                this.receivedEvents.push(event);
                console.log(`📨 NotificationListener [${this.userId.slice(-8)}] received BALANCE event:`, {
                    groupId: groupId.slice(-8),
                    version: data.changeVersion,
                    balanceCount: groupData.balanceChangeCount
                });
            }
            
            if (this.hasGroupDetailsChanged(groupData, lastState)) {
                const event = {
                    userId: this.userId,
                    groupId,
                    type: 'group' as const,
                    version: data.changeVersion,
                    timestamp,
                    groupState: { ...groupData }
                };
                this.receivedEvents.push(event);
                console.log(`📨 NotificationListener [${this.userId.slice(-8)}] received GROUP event:`, {
                    groupId: groupId.slice(-8),
                    version: data.changeVersion,
                    groupCount: groupData.groupDetailsChangeCount
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
                    timestamp
                };
                this.receivedEvents.push(event);
                console.log(`📨 NotificationListener [${this.userId.slice(-8)}] received GROUP_REMOVED event:`, {
                    groupId: groupId.slice(-8),
                    version: data.changeVersion
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
        return this.receivedEvents.filter(event => event.groupId === groupId);
    }

    /**
     * Wait for a specific number of events
     */
    async waitForEvents(minCount: number, timeoutMs: number = 10000): Promise<NotificationEvent[]> {
        const startTime = Date.now();
        
        while (this.receivedEvents.length < minCount) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout waiting for ${minCount} events. Got ${this.receivedEvents.length}`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return [...this.receivedEvents];
    }

    /**
     * Wait for specific event type for a group
     */
    async waitForGroupEvent(
        groupId: string, 
        eventType: 'transaction' | 'balance' | 'group' | 'group_removed',
        timeoutMs: number = 10000
    ): Promise<NotificationEvent> {
        const startTime = Date.now();
        
        while (true) {
            const event = this.receivedEvents.find(e => 
                e.groupId === groupId && e.type === eventType
            );
            
            if (event) {
                return event;
            }
            
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout waiting for ${eventType} event for group ${groupId}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
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
            recentEvents: this.receivedEvents.slice(-5).map(e => ({
                groupId: e.groupId,
                type: e.type,
                version: e.version,
                timestamp: e.timestamp.toISOString()
            }))
        };
    }
}
import { ActivityFeedEventType, ActivityFeedItem, GroupId } from '@splitifyd/shared';
import * as admin from 'firebase-admin';

type NotificationCategory = 'transaction' | 'balance' | 'group' | 'comment';

const activityEventTypeMap: Record<ActivityFeedEventType, NotificationCategory> = {
    'expense-created': 'transaction',
    'expense-updated': 'transaction',
    'expense-deleted': 'transaction',
    'settlement-created': 'balance',
    'settlement-updated': 'balance',
    'member-joined': 'group',
    'member-left': 'group',
    'group-updated': 'group',
    'comment-added': 'comment',
};

export interface NotificationEvent {
    userId: string;
    groupId: GroupId;
    type: NotificationCategory;
    item: ActivityFeedItem;
}

export class NotificationDriver {
    private activeListeners = new Map<string, NotificationListener>();

    constructor(private firestore: admin.firestore.Firestore) {}

    async stopAllListeners(): Promise<void> {
        await Promise.all(Array.from(this.activeListeners.values()).map((listener) => listener.stop()));
        this.activeListeners.clear();
    }

    clearEvents(): void {
        for (const listener of this.activeListeners.values()) {
            listener.clearEvents();
        }
    }

    async waitForQuiet(quietDurationMs: number = 200, timeoutMs: number = 10000): Promise<void> {
        const startTime = Date.now();
        const pollIntervalMs = 50;

        while (Date.now() - startTime < timeoutMs) {
            const allQuiet = Array.from(this.activeListeners.values()).every((listener) => listener.isQuiet(quietDurationMs));
            if (allQuiet) {
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        console.warn(`⚠️  waitForQuiet timed out after ${timeoutMs}ms. Active listeners: ${this.activeListeners.size}`);
    }

    async setupListeners(userIds: string[]): Promise<NotificationListener[]> {
        const listeners: NotificationListener[] = [];

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

export class NotificationListener {
    private unsubscribe: (() => void) | null = null;
    private initialized = false;
    private seenIds = new Set<string>();
    private receivedItems: ActivityFeedItem[] = [];
    private lastEventAt = 0;

    constructor(private firestore: admin.firestore.Firestore, private userId: string) {}

    async start(): Promise<void> {
        if (this.unsubscribe) {
            throw new Error('Listener already started');
        }

        return new Promise((resolve, reject) => {
            const query = this.firestore
                .collection('activity-feed')
                .doc(this.userId)
                .collection('items')
                .orderBy('createdAt', 'desc')
                .orderBy(admin.firestore.FieldPath.documentId(), 'desc')
                .limit(50);

            this.unsubscribe = query.onSnapshot(
                (snapshot) => {
                    if (!this.initialized) {
                        snapshot.docs.forEach((doc) => this.seenIds.add(doc.id));
                        this.initialized = true;
                        resolve();
                        return;
                    }

                    let hasNewEvents = false;
                    for (const change of snapshot.docChanges()) {
                        if (change.type !== 'added') {
                            continue;
                        }

                        const doc = change.doc;
                        if (this.seenIds.has(doc.id)) {
                            continue;
                        }

                        const item = this.parseItem(doc);
                        this.receivedItems.push(item);
                        this.seenIds.add(doc.id);
                        hasNewEvents = true;
                    }

                    if (hasNewEvents) {
                        this.lastEventAt = Date.now();
                    }
                },
                (error) => {
                    if (!this.initialized) {
                        reject(error);
                    }
                },
            );
        });
    }

    async stop(): Promise<void> {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.initialized = false;
        this.seenIds.clear();
        this.receivedItems = [];
        this.lastEventAt = 0;
    }

    clearEvents(): void {
        this.receivedItems = [];
    }

    isQuiet(quietDurationMs: number): boolean {
        if (!this.initialized) {
            return true;
        }
        if (this.lastEventAt === 0) {
            return true;
        }
        return Date.now() - this.lastEventAt >= quietDurationMs;
    }

    getGroupEvents(groupId: GroupId, type?: NotificationCategory): NotificationEvent[] {
        return this.receivedItems
            .filter((item) => {
                if (item.groupId !== groupId) {
                    return false;
                }
                if (!type) {
                    return true;
                }
                return activityEventTypeMap[item.eventType] === type;
            })
            .map((item) => ({
                userId: this.userId,
                groupId,
                type: activityEventTypeMap[item.eventType],
                item,
            }));
    }

    async waitForEventCount(groupId: GroupId, type: NotificationCategory, minCount: number, timeoutMs: number = 3000): Promise<NotificationEvent[]> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const events = this.getGroupEvents(groupId, type);
            if (events.length >= minCount) {
                return events.slice(-minCount);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const events = this.getGroupEvents(groupId, type);
        throw new Error(`Timeout after ${timeoutMs}ms waiting for ${minCount} "${type}" events for group ${groupId}. Got ${events.length}`);
    }

    assertEventCount(groupId: GroupId, expectedCount: number, type?: NotificationCategory): void {
        const events = this.getGroupEvents(groupId, type);
        if (events.length !== expectedCount) {
            const details = events
                .map((event, index) => `\t${index + 1}. ${event.type} -> ${event.item.eventType}`)
                .join('\n');

            throw new Error([
                `User [${this.userId}] expected ${expectedCount}${type ? ` ${type}` : ''} events for group [${groupId}] but got ${events.length}:`,
                details || '\t(no events)',
            ].join('\n'));
        }
    }

    async waitForGroupEvent(groupId: GroupId, minCount: number = 1, timeoutMs: number = 10000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'group', minCount, timeoutMs);
        return events[events.length - 1];
    }

    async waitForTransactionEvent(groupId: GroupId, minCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'transaction', minCount, timeoutMs);
        return events[events.length - 1];
    }

    async waitForBalanceEvent(groupId: GroupId, minCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'balance', minCount, timeoutMs);
        return events[events.length - 1];
    }

    async waitForCommentEvent(groupId: GroupId, minCount: number = 1, timeoutMs: number = 3000): Promise<NotificationEvent> {
        const events = await this.waitForEventCount(groupId, 'comment', minCount, timeoutMs);
        return events[events.length - 1];
    }

    private parseItem(doc: admin.firestore.QueryDocumentSnapshot): ActivityFeedItem {
        const data = doc.data();
        const timestamp = this.toIsoString(data.timestamp);
        const createdAt = data.createdAt ? this.toIsoString(data.createdAt) : undefined;

        return {
            id: doc.id,
            userId: data.userId,
            groupId: data.groupId,
            groupName: data.groupName,
            eventType: data.eventType,
            action: data.action,
            actorId: data.actorId,
            actorName: data.actorName,
            timestamp,
            details: data.details ?? {},
            createdAt,
        } as ActivityFeedItem;
    }

    private toIsoString(value: unknown): string {
        if (value instanceof admin.firestore.Timestamp) {
            return value.toDate().toISOString();
        }
        if (typeof value === 'string') {
            return value;
        }
        throw new Error('Unexpected timestamp value in activity feed');
    }
}

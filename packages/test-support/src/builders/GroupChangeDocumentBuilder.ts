import { Timestamp } from 'firebase-admin/firestore';

// Define GroupChangeDocument type locally to avoid cross-package imports
type GroupChangeDocument = {
    id: string;
    type: 'group';
    action: 'created' | 'updated' | 'deleted';
    timestamp: Timestamp;
    users: string[];
};

/**
 * Builder for GroupChangeDocument - used for testing change tracking
 * Used for testing group change notifications and real-time updates
 */
export class GroupChangeDocumentBuilder {
    private changeDoc: GroupChangeDocument;

    constructor(groupId: string = 'test-group-id') {
        // Default group change document with sensible defaults
        this.changeDoc = {
            id: groupId,
            type: 'group' as const,
            action: 'updated' as const,
            timestamp: Timestamp.now(),
            users: ['test-user-1'],
        };
    }

    withId(id: string): this {
        this.changeDoc.id = id;
        return this;
    }

    withAction(action: 'created' | 'updated' | 'deleted'): this {
        this.changeDoc.action = action;
        return this;
    }

    withTimestamp(timestamp: Timestamp): this {
        this.changeDoc.timestamp = timestamp;
        return this;
    }

    withTimestampMs(timestampMs: number): this {
        this.changeDoc.timestamp = Timestamp.fromMillis(timestampMs);
        return this;
    }

    withUsers(users: string[]): this {
        this.changeDoc.users = [...users];
        return this;
    }

    withUser(userId: string): this {
        if (!this.changeDoc.users.includes(userId)) {
            this.changeDoc.users.push(userId);
        }
        return this;
    }

    asCreated(): this {
        this.changeDoc.action = 'created';
        return this;
    }

    asUpdated(): this {
        this.changeDoc.action = 'updated';
        return this;
    }

    asDeleted(): this {
        this.changeDoc.action = 'deleted';
        return this;
    }

    fromNow(offsetMs: number = 0): this {
        this.changeDoc.timestamp = Timestamp.fromMillis(Date.now() + offsetMs);
        return this;
    }

    build(): GroupChangeDocument {
        return {
            ...this.changeDoc,
            users: [...this.changeDoc.users], // Clone array
        };
    }
}

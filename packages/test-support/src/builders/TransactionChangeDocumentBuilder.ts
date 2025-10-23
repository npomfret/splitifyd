import { GroupId } from '@splitifyd/shared';
import { BuilderTimestamp, generateShortId, timestampToISOString } from '../test-helpers';

interface TransactionChangeDocument {
    groupId: GroupId;
    type: 'expense' | 'settlement' | 'group';
    users: string[];
    createdAt: string; // ISO string for consistency with DTO pattern
}

/**
 * Builder for creating transaction change documents for tests
 * Used for testing Firestore security rules and real-time notifications
 */
export class TransactionChangeDocumentBuilder {
    private document: TransactionChangeDocument;

    constructor() {
        this.document = {
            groupId: `group-${generateShortId()}`,
            type: 'expense',
            users: [],
            createdAt: new Date().toISOString(),
        };
    }

    withGroupId(groupId: GroupId): this {
        this.document.groupId = groupId;
        return this;
    }

    withType(type: 'expense' | 'settlement' | 'group'): this {
        this.document.type = type;
        return this;
    }

    withUsers(users: string[]): this {
        this.document.users = [...users];
        return this;
    }

    withCreatedAt(timestamp: BuilderTimestamp): this {
        this.document.createdAt = timestampToISOString(timestamp);
        return this;
    }

    build(): TransactionChangeDocument {
        return { ...this.document, users: [...this.document.users] };
    }
}

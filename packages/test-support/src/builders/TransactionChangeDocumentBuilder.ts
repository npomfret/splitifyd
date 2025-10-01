import { generateShortId } from '../test-helpers';

export interface TransactionChangeDocument {
    groupId: string;
    type: 'expense' | 'settlement' | 'group';
    users: string[];
    createdAt: Date;
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
            createdAt: new Date(),
        };
    }

    withGroupId(groupId: string): this {
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

    withCreatedAt(date: Date): this {
        this.document.createdAt = date;
        return this;
    }

    build(): TransactionChangeDocument {
        return { ...this.document, users: [...this.document.users] };
    }
}
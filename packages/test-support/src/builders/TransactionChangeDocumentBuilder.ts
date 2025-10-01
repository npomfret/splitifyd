import { generateShortId } from '../test-helpers';

/**
 * Builder for creating transaction change documents for tests
 * Used for testing Firestore security rules and real-time notifications
 */
export class TransactionChangeDocumentBuilder {
    private document: any;

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
        this.document.users = users;
        return this;
    }

    withCreatedAt(date: Date): this {
        this.document.createdAt = date;
        return this;
    }

    build(): any {
        return { ...this.document };
    }
}
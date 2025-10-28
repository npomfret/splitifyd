import { GroupId, ISOString } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';
import { convertToISOString, generateShortId } from '../test-helpers';

interface TransactionChangeDocument {
    groupId: GroupId;
    type: 'expense' | 'settlement' | 'group';
    users: string[];
    createdAt: ISOString; // ISO string for consistency with DTO pattern
}

/**
 * Builder for creating transaction change documents for tests
 * Used for testing Firestore security rules and real-time notifications
 */
export class TransactionChangeDocumentBuilder {
    private document: TransactionChangeDocument;

    constructor() {
        this.document = {
            groupId: toGroupId(`group-${generateShortId()}`),
            type: 'expense',
            users: [],
            createdAt: convertToISOString(new Date()),
        };
    }

    withGroupId(groupId: GroupId | string): this {
        this.document.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
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

    withCreatedAt(timestamp: Date | string | ISOString): this {
        this.document.createdAt = convertToISOString(timestamp);
        return this;
    }

    build(): TransactionChangeDocument {
        return { ...this.document, users: [...this.document.users] };
    }
}

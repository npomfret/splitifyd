import { generateShortId } from '../test-helpers';

export interface GroupBalanceDocument {
    groupId: string;
    balances: Record<string, Record<string, number>>;
    lastUpdated: Date;
}

/**
 * Builder for creating group balance documents for tests
 * Used for testing Firestore security rules
 */
export class GroupBalanceDocumentBuilder {
    private document: GroupBalanceDocument;

    constructor() {
        const groupId = `group-${generateShortId()}`;
        this.document = {
            groupId: groupId,
            balances: {},
            lastUpdated: new Date(),
        };
    }

    withGroupId(groupId: string): this {
        this.document.groupId = groupId;
        return this;
    }

    withBalance(userId: string, currency: string, amount: number): this {
        if (!this.document.balances[userId]) {
            this.document.balances[userId] = {};
        }
        this.document.balances[userId][currency] = amount;
        return this;
    }

    withBalances(balances: Record<string, Record<string, number>>): this {
        this.document.balances = balances;
        return this;
    }

    withLastUpdated(date: Date): this {
        this.document.lastUpdated = date;
        return this;
    }

    build(): GroupBalanceDocument {
        return { ...this.document, balances: { ...this.document.balances } };
    }
}
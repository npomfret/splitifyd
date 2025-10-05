import { generateShortId, BuilderTimestamp, timestampToISOString } from '../test-helpers';

interface GroupBalanceDocument {
    groupId: string;
    balances: Record<string, Record<string, number>>;
    lastUpdated: string; // ISO string for consistency with DTO pattern
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
            lastUpdated: new Date().toISOString(),
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

    withLastUpdated(timestamp: BuilderTimestamp): this {
        this.document.lastUpdated = timestampToISOString(timestamp);
        return this;
    }

    build(): GroupBalanceDocument {
        return { ...this.document, balances: { ...this.document.balances } };
    }
}
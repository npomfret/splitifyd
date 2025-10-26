import { Amount } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import type { CurrencyISOCode, UserId } from '@splitifyd/shared';
import { BuilderTimestamp, generateShortId, timestampToISOString } from '../test-helpers';
import {toGroupId} from "@splitifyd/shared";

interface GroupBalanceDocument {
    groupId: GroupId;
    balances: Record<string, Record<string, Amount>>;
    lastUpdated: string; // ISO string for consistency with DTO pattern
}

/**
 * Builder for creating group balance documents for tests
 * Used for testing Firestore security rules
 */
export class GroupBalanceDocumentBuilder {
    private document: GroupBalanceDocument;

    constructor() {
        const groupId = toGroupId(`group-${generateShortId()}`);
        this.document = {
            groupId: groupId,
            balances: {},
            lastUpdated: new Date().toISOString(),
        };
    }

    withGroupId(groupId: GroupId | string): this {
        this.document.groupId = typeof groupId === "string" ? toGroupId(groupId) : groupId;
        return this;
    }

    withBalance(userId: UserId, currency: CurrencyISOCode, amount: Amount): this {
        if (!this.document.balances[userId]) {
            this.document.balances[userId] = {};
        }
        this.document.balances[userId][currency] = amount;
        return this;
    }

    withBalances(balances: Record<string, Record<string, Amount>>): this {
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

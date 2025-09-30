import type { UserNotificationDocument, UserNotificationGroup, RecentChange } from '@splitifyd/shared';

/**
 * Builder for creating UserNotificationDocument objects for tests
 * Creates the notification structure used by Firebase real-time notifications
 */
export class UserNotificationDocumentBuilder {
    private document: UserNotificationDocument;

    constructor() {
        const now = new Date();
        this.document = {
            changeVersion: 1,
            groups: {},
            lastModified: now,
        };
    }

    withChangeVersion(version: number): this {
        this.document.changeVersion = version;
        return this;
    }

    withGroup(groupId: string, groupData: UserNotificationGroup): this {
        this.document.groups[groupId] = groupData;
        return this;
    }

    withGroupDetails(groupId: string, changeCount: number = 1): this {
        const existing = this.document.groups[groupId] || this.createDefaultGroupData();
        this.document.groups[groupId] = {
            ...existing,
            groupDetailsChangeCount: changeCount,
            lastGroupDetailsChange: new Date(),
        };
        return this;
    }

    withTransactionChange(groupId: string, changeCount: number = 1): this {
        const existing = this.document.groups[groupId] || this.createDefaultGroupData();
        this.document.groups[groupId] = {
            ...existing,
            transactionChangeCount: changeCount,
            lastTransactionChange: new Date(),
        };
        return this;
    }

    withBalanceChange(groupId: string, changeCount: number = 1): this {
        const existing = this.document.groups[groupId] || this.createDefaultGroupData();
        this.document.groups[groupId] = {
            ...existing,
            balanceChangeCount: changeCount,
            lastBalanceChange: new Date(),
        };
        return this;
    }

    withCommentChange(groupId: string, changeCount: number = 1): this {
        const existing = this.document.groups[groupId] || this.createDefaultGroupData();
        this.document.groups[groupId] = {
            ...existing,
            commentChangeCount: changeCount,
            lastCommentChange: new Date(),
        };
        return this;
    }

    withGroupChangeCounts(groupId: string, counts: {
        groupDetailsChangeCount?: number;
        transactionChangeCount?: number;
        balanceChangeCount?: number;
        commentChangeCount?: number;
    }): this {
        const existing = this.document.groups[groupId] || this.createDefaultGroupData();
        this.document.groups[groupId] = {
            ...existing,
            ...counts,
        };
        return this;
    }

    withLastModified(timestamp: Date): this {
        this.document.lastModified = timestamp;
        return this;
    }

    withRecentChanges(changes: RecentChange[]): this {
        this.document.recentChanges = changes;
        return this;
    }

    addRecentChange(groupId: string, type: 'transaction' | 'balance' | 'group' | 'comment', timestamp?: Date): this {
        if (!this.document.recentChanges) {
            this.document.recentChanges = [];
        }
        this.document.recentChanges.push({
            groupId,
            type,
            timestamp: timestamp || new Date(),
        });
        return this;
    }

    private createDefaultGroupData(): UserNotificationGroup {
        return {
            lastTransactionChange: null,
            lastBalanceChange: null,
            lastGroupDetailsChange: null,
            lastCommentChange: null,
            transactionChangeCount: 0,
            balanceChangeCount: 0,
            groupDetailsChangeCount: 0,
            commentChangeCount: 0,
        };
    }

    build(): UserNotificationDocument {
        return {
            changeVersion: this.document.changeVersion,
            groups: JSON.parse(JSON.stringify(this.document.groups)), // Deep copy
            lastModified: this.document.lastModified,
            ...(this.document.recentChanges && { recentChanges: [...this.document.recentChanges] }),
        };
    }

    static withBaseline(groupId: string, changeVersion: number = 1): UserNotificationDocumentBuilder {
        return new UserNotificationDocumentBuilder()
            .withChangeVersion(changeVersion)
            .withGroupChangeCounts(groupId, {
                groupDetailsChangeCount: 1,
                transactionChangeCount: 1,
                balanceChangeCount: 1,
                commentChangeCount: 0,
            });
    }

    static withGroupDetailsChange(groupId: string, changeVersion: number = 2): UserNotificationDocumentBuilder {
        return UserNotificationDocumentBuilder.withBaseline(groupId, changeVersion)
            .withGroupDetails(groupId, 2);
    }

    static withTransactionChange(groupId: string, changeVersion: number = 2): UserNotificationDocumentBuilder {
        return UserNotificationDocumentBuilder.withBaseline(groupId, changeVersion)
            .withTransactionChange(groupId, 2);
    }

    static withBalanceChange(groupId: string, changeVersion: number = 2): UserNotificationDocumentBuilder {
        return UserNotificationDocumentBuilder.withBaseline(groupId, changeVersion)
            .withBalanceChange(groupId, 2);
    }

    static withCommentChange(groupId: string, changeVersion: number = 2): UserNotificationDocumentBuilder {
        return UserNotificationDocumentBuilder.withBaseline(groupId, changeVersion)
            .withCommentChange(groupId, 2);
    }
}
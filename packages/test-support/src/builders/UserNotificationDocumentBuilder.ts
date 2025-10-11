/**
 * Browser-safe builder for creating UserNotificationDocument objects for tests
 * Uses Date objects instead of Firestore Timestamps for webapp compatibility
 *
 * Note: This is a simplified version adapted for browser tests.
 * The server version uses Firestore Timestamps from firebase-admin.
 */

// Browser-safe type definitions (using Date instead of Timestamp)
interface UserNotificationGroupDocument {
    lastTransactionChange: Date | null;
    lastBalanceChange: Date | null;
    lastGroupDetailsChange: Date | null;
    lastCommentChange: Date | null;
    transactionChangeCount: number;
    balanceChangeCount: number;
    groupDetailsChangeCount: number;
    commentChangeCount: number;
}

interface RecentChangeDocument {
    groupId: string;
    type: 'transaction' | 'balance' | 'group' | 'comment';
    timestamp: Date;
}

// Using `any` for browser-safe notification data - tests don't need strict typing here
interface UserNotificationDocument {
    changeVersion: number;
    groups: Record<string, UserNotificationGroupDocument>;
    lastModified: Date;
    recentChanges?: RecentChangeDocument[];
}

/**
 * Builder for creating UserNotificationDocument objects for webapp tests
 * Creates the notification structure used by Firebase real-time notifications
 */
export class UserNotificationDocumentBuilder {
    private document: UserNotificationDocument;

    constructor() {
        this.document = {
            changeVersion: 1,
            groups: {},
            lastModified: new Date(),
        };
    }

    withChangeVersion(version: number): this {
        this.document.changeVersion = version;
        return this;
    }

    withGroup(groupId: string, groupData: UserNotificationGroupDocument): this {
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

    withGroupChangeCounts(
        groupId: string,
        counts: {
            groupDetailsChangeCount?: number;
            transactionChangeCount?: number;
            balanceChangeCount?: number;
            commentChangeCount?: number;
        },
    ): this {
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

    withRecentChanges(changes: RecentChangeDocument[]): this {
        this.document.recentChanges = changes;
        return this;
    }

    private createDefaultGroupData(): UserNotificationGroupDocument {
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

    build(): any {
        // Return `any` type for browser compatibility - test mocks don't need strict typing
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
        return UserNotificationDocumentBuilder
            .withBaseline(groupId, changeVersion)
            .withGroupDetails(groupId, 2);
    }
}

import * as admin from "firebase-admin";
import {ApiDriver, BalanceChangeDocument, ExpenseChangeDocument, GroupChangeDocument, MinimalChangeDocument, SettlementChangeDocument} from "./ApiDriver";
import {Matcher, pollUntil} from "./Polling";
import {FirestoreCollections, AuthenticatedFirebaseUser} from "@splitifyd/shared";

// Types for user notification documents (mirrors backend schema)
interface UserNotificationGroup {
    lastTransactionChange: admin.firestore.Timestamp | null;
    lastBalanceChange: admin.firestore.Timestamp | null;
    lastGroupDetailsChange: admin.firestore.Timestamp | null;
    transactionChangeCount: number;
    balanceChangeCount: number;
    groupDetailsChangeCount: number;
}

interface UserNotificationDocument {
    changeVersion: number;
    groups: Record<string, UserNotificationGroup>;
    lastModified: admin.firestore.Timestamp;
    recentChanges?: Array<{
        groupId: string;
        type: 'transaction' | 'balance' | 'group';
        timestamp: admin.firestore.Timestamp;
    }>;
}

export class AppDriver {
    constructor(public apiDriver: ApiDriver, private readonly firestoreDb: admin.firestore.Firestore) {
    }

    // New notification system methods
    async getUserNotificationDocument(userId: string): Promise<UserNotificationDocument | null> {
        const doc = await this.firestoreDb.collection('user-notifications').doc(userId).get();
        return doc.exists ? doc.data() as UserNotificationDocument : null;
    }

    async waitForGroupDetailsChangeCount(groupId: string, userId:string, expectedGroupDetailsChangeCount: number) {
        return this.waitForNotificationWithMatcher(
            userId,
            groupId,
            (doc) => {
                const currentCount = doc.groups[groupId]?.groupDetailsChangeCount || 0;
                return currentCount >= expectedGroupDetailsChangeCount;
            },
            {
                timeout: 1000,
                errorMsg: 'Failed to receive all 3 group update notifications'
            }
        );
    }

    async waitForTransactionChangeCount(groupId: string, userId: string, expectedTransactionChangeCount: number) {
        return this.waitForNotificationWithMatcher(
            userId,
            groupId,
            (doc) => {
                const currentCount = doc.groups[groupId]?.transactionChangeCount || 0;
                return currentCount >= expectedTransactionChangeCount;
            },
            {
                timeout: 5000,
                errorMsg: `Failed to reach expected transaction change count: ${expectedTransactionChangeCount}`
            }
        );
    }

    async waitForBalanceChangeCount(groupId: string, userId: string, expectedBalanceChangeCount: number) {
        return this.waitForNotificationWithMatcher(
            userId,
            groupId,
            (doc) => {
                const currentCount = doc.groups[groupId]?.balanceChangeCount || 0;
                return currentCount >= expectedBalanceChangeCount;
            },
            {
                timeout: 5000,
                errorMsg: `Failed to reach expected balance change count: ${expectedBalanceChangeCount}`
            }
        );
    }

    async waitForTransactionAndBalanceChangeCounts(groupId: string, userId: string, expectedTransactionCount: number, expectedBalanceCount: number) {
        return this.waitForNotificationWithMatcher(
            userId,
            groupId,
            (doc) => {
                const transactionCount = doc.groups[groupId]?.transactionChangeCount || 0;
                const balanceCount = doc.groups[groupId]?.balanceChangeCount || 0;
                return transactionCount >= expectedTransactionCount && balanceCount >= expectedBalanceCount;
            },
            {
                timeout: 5000,
                errorMsg: `Failed to reach expected counts - transaction: ${expectedTransactionCount}, balance: ${expectedBalanceCount}`
            }
        );
    }

    async waitForMultiUserTransactionAndBalanceNotifications(groupId: string, userIds: string[], timeout = 5000) {
        await Promise.all(userIds.map(userId => Promise.all([
            this.waitForUserNotificationUpdate(userId, groupId, 'transaction', timeout),
            this.waitForUserNotificationUpdate(userId, groupId, 'balance', timeout)
        ])));
    }

    async waitForMultiUserAllNotifications(groupId: string, userIds: string[], timeout = 5000) {
        await Promise.all(userIds.map(userId => Promise.all([
            this.waitForUserNotificationUpdate(userId, groupId, 'group', timeout),
            this.waitForUserNotificationUpdate(userId, groupId, 'transaction', timeout),
            this.waitForUserNotificationUpdate(userId, groupId, 'balance', timeout)
        ])));
    }


    async waitForUserNotificationUpdate(userId: string, groupId: string, changeType: 'transaction' | 'balance' | 'group', timeout = 5000, expectedCount?: number): Promise<void> {
        let attempts = 0;
        
        await pollUntil(
            () => this.getUserNotificationDocument(userId),
            (doc) => {
                attempts++;

                if (!doc || !doc.groups[groupId]) {
                    return false; // Keep waiting for document/group to exist
                }
                
                const group = doc.groups[groupId];
                const currentCount = changeType === 'transaction' ? group.transactionChangeCount 
                    : changeType === 'balance' ? group.balanceChangeCount 
                    : group.groupDetailsChangeCount;
                
                // If expectedCount is provided, wait for that specific count
                if (expectedCount !== undefined) {
                    return currentCount >= expectedCount;
                }
                
                // Legacy behavior: just wait for any count > 0
                return currentCount > 0;
            },
            {
                timeout,
                interval: 50,
                errorMsg: `Timeout waiting for ${changeType} notification for user ${userId} in group ${groupId}${expectedCount !== undefined ? ` (expected count: ${expectedCount})` : ''}`,
                onRetry: (attempt, error) => {
                    if (error) {
                        console.log(`[DEBUG] Polling attempt ${attempt} failed:`, error.message);
                    }
                }
            }
        );
    }

    async waitForNotificationWithMatcher(
        userId: string, 
        groupId: string, 
        matcher: Matcher<UserNotificationDocument>, 
        options: {
            timeout?: number;
            interval?: number;
            errorMsg?: string;
        } = {}
    ): Promise<UserNotificationDocument> {
        const { timeout = 5000, interval = 50, errorMsg = `Timeout waiting for notification matcher for user ${userId} in group ${groupId}` } = options;
        
        const result = await pollUntil(
            () => this.getUserNotificationDocument(userId),
            async (doc: UserNotificationDocument | null) => {
                if (!doc || !doc.groups[groupId]) {
                    return false; // Keep waiting for document/group to exist
                }
                return await matcher(doc);
            },
            {
                timeout,
                interval,
                errorMsg,
                onRetry: (attempt, error) => {
                    if (error) {
                        console.log(`[DEBUG] Polling attempt ${attempt} failed:`, error.message);
                    }
                }
            }
        );
        
        // At this point, we know the document exists because pollUntil succeeded
        return result!;
    }

    async waitForMultiUserNotificationUpdate(userIds: string[], groupId: string, changeType: 'transaction' | 'balance' | 'group', timeout = 3000): Promise<void> {
        await Promise.all(userIds.map(userId => 
            this.waitForUserNotificationUpdate(userId, groupId, changeType, timeout)
        ));
    }

    // Wait for multiple change types for a single user in parallel
    async waitForAllNotifications(userId: string, groupId: string, changeTypes: ('transaction' | 'balance' | 'group')[], timeout = 3000): Promise<void> {
        await Promise.all(changeTypes.map(changeType => 
            this.waitForUserNotificationUpdate(userId, groupId, changeType, timeout)
        ));
    }

    // Wait for multiple change types across multiple users efficiently
    async waitForBatchNotifications(userIds: string[], groupId: string, changeTypes: ('transaction' | 'balance' | 'group')[], timeout = 3000): Promise<void> {
        const allPromises: Promise<void>[] = [];
        
        for (const userId of userIds) {
            for (const changeType of changeTypes) {
                allPromises.push(this.waitForUserNotificationUpdate(userId, groupId, changeType, timeout));
            }
        }
        
        await Promise.all(allPromises);
    }

    // Adapter methods that maintain compatibility with existing tests
    async waitForGroupCreationEvent(groupId: string, creator: AuthenticatedFirebaseUser): Promise<void> {
        await this.waitForUserNotificationUpdate(creator.uid, groupId, 'group');
    }

    async waitForGroupUpdatedEvent(groupId: string, creator: AuthenticatedFirebaseUser): Promise<void> {
        await this.waitForUserNotificationUpdate(creator.uid, groupId, 'group');
    }

    async waitForExpenseCreationEvent(groupId: string, participants: AuthenticatedFirebaseUser[]): Promise<void> {
        const userIds = participants.map(p => p.uid);
        await this.waitForMultiUserNotificationUpdate(userIds, groupId, 'transaction');
    }

    async waitForExpenseUpdatedEvent(groupId: string, participants: AuthenticatedFirebaseUser[]): Promise<void> {
        const userIds = participants.map(p => p.uid);
        await this.waitForMultiUserNotificationUpdate(userIds, groupId, 'transaction');
    }

    async waitForBalanceRecalculationEvent(groupId: string, participants: AuthenticatedFirebaseUser[]): Promise<void> {
        const userIds = participants.map(p => p.uid);
        await this.waitForMultiUserNotificationUpdate(userIds, groupId, 'balance');
    }

    async waitForSettlementCreationEvent(groupId: string, participants: AuthenticatedFirebaseUser[]): Promise<void> {
        const userIds = participants.map(p => p.uid);
        await this.waitForMultiUserNotificationUpdate(userIds, groupId, 'transaction');
    }

    async waitForSettlementUpdatedEvent(groupId: string, participants: AuthenticatedFirebaseUser[]): Promise<void> {
        const userIds = participants.map(p => p.uid);
        await this.waitForMultiUserNotificationUpdate(userIds, groupId, 'transaction');
    }

    async waitForSettlementDeletedEvent(groupId: string, participants: AuthenticatedFirebaseUser[]): Promise<void> {
        const userIds = participants.map(p => p.uid);
        await this.waitForMultiUserNotificationUpdate(userIds, groupId, 'transaction');
    }

    // Count methods adapted for notification system
    async countGroupChanges(groupId: string): Promise<number> {
        // For the new system, we look at the recent changes in any user's notification document
        // This is a best-effort approach for backward compatibility
        const snapshot = await this.firestoreDb.collection('user-notifications').limit(10).get();
        let totalChanges = 0;
        
        for (const doc of snapshot.docs) {
            const data = doc.data() as UserNotificationDocument;
            if (data.recentChanges) {
                totalChanges += data.recentChanges.filter(change => 
                    change.groupId === groupId && change.type === 'group'
                ).length;
            }
        }
        
        return totalChanges;
    }

    async countExpenseChanges(groupId: string): Promise<number> {
        const snapshot = await this.firestoreDb.collection('user-notifications').limit(10).get();
        let totalChanges = 0;
        
        for (const doc of snapshot.docs) {
            const data = doc.data() as UserNotificationDocument;
            if (data.recentChanges) {
                totalChanges += data.recentChanges.filter(change => 
                    change.groupId === groupId && change.type === 'transaction'
                ).length;
            }
        }
        
        return totalChanges;
    }

    async countBalanceChanges(groupId: string): Promise<number> {
        const snapshot = await this.firestoreDb.collection('user-notifications').limit(10).get();
        let totalChanges = 0;
        
        for (const doc of snapshot.docs) {
            const data = doc.data() as UserNotificationDocument;
            if (data.recentChanges) {
                totalChanges += data.recentChanges.filter(change => 
                    change.groupId === groupId && change.type === 'balance'
                ).length;
            }
        }
        
        return totalChanges;
    }


}
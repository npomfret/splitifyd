import * as admin from "firebase-admin";
import {ApiDriver, BalanceChangeDocument, ExpenseChangeDocument, GroupChangeDocument, MinimalChangeDocument, SettlementChangeDocument} from "./ApiDriver";
import {Matcher} from "./Polling";
import {FirestoreCollections, Group, AuthenticatedFirebaseUser} from "@splitifyd/shared";

export class AppDriver {
    constructor(public apiDriver: ApiDriver, private readonly firestoreDb: admin.firestore.Firestore) {
    }

    async getTransactionChanges(groupId: string, type: string) {
        const snapshot = await this.firestoreDb.collection(FirestoreCollections.TRANSACTION_CHANGES).where('groupId', '==', groupId).where('type', '==', type).orderBy('timestamp', 'desc').get();

        return snapshot.docs.map((doc) => doc.data() as MinimalChangeDocument);
    }

    async getBalanceChanges(groupId: string): Promise<BalanceChangeDocument[]> {
        const snapshot = await this.firestoreDb.collection(FirestoreCollections.BALANCE_CHANGES).where('groupId', '==', groupId).orderBy('timestamp', 'desc').get();

        return snapshot.docs.map((doc) => doc.data() as BalanceChangeDocument);
    }

    async getGroupChanges(groupId: string): Promise<GroupChangeDocument[]> {
        const snapshot = await this.firestoreDb.collection(FirestoreCollections.GROUP_CHANGES).where('id', '==', groupId).orderBy('timestamp', 'desc').get();

        return snapshot.docs.map((doc) => doc.data() as GroupChangeDocument);
    }

    async mostRecentGroupChangeEvent(group: Group) {
        const changes = await this.getGroupChanges(group.id);
        return changes[0]; // they are most recent first
    }

    async countGroupChanges(groupId: string) {
        return (await this.getGroupChanges(groupId)).length;
    }

    async countExpenseChanges(groupId: string) {
        return (await this.getExpenseChanges(groupId)).length;
    }

    async countBalanceChanges(groupId: string) {
        return (await this.getBalanceChanges(groupId)).length;
    }

    async mostRecentExpenseChangeEvent(groupId: string) {
        const changes = await this.getExpenseChanges(groupId);
        return changes[0]; // they are most recent first
    }

    async waitForGroupCreationEvent(groupId: string, creator: AuthenticatedFirebaseUser) {
        await this.waitForGroupEvent('created', groupId, creator, 1);
    }

    async waitForGroupUpdatedEvent(groupId: string, creator: AuthenticatedFirebaseUser, expectedCount = 1) {
        await this.waitForGroupEvent('updated', groupId, creator, expectedCount);
    }

    async waitForExpenseCreationEvent(groupId: string, expenseId: string, participants: AuthenticatedFirebaseUser[]) {
        await this.waitForExpenseEvent('created', groupId, expenseId, participants, 1);
    }

    async waitForExpenseUpdatedEvent(groupId: string, expenseId: string, participants: AuthenticatedFirebaseUser[], expectedCount = 1) {
        await this.waitForExpenseEvent('updated', groupId, expenseId, participants, expectedCount);
    }

    async waitForExpenseEvent(action: string, groupId: string, expenseId: string, participants: AuthenticatedFirebaseUser[], expectedCount: number) {
        await this.waitForExpenseChanges(groupId, (changes) => {
            const found = changes.filter((doc) => {
                if (doc.type !== 'expense') throw Error('should not get here');

                if (doc.id !== expenseId) return false;

                if (doc.action !== action) return false;

                // Check all participants are in the users array
                return participants.every((p) => doc.users.includes(p.uid));
            });

            return found.length === expectedCount;
        });
    }

    async waitForBalanceRecalculationEvent(groupId: string, participants: AuthenticatedFirebaseUser[], expectedCount = 1) {
        await this.waitForBalanceChanges(groupId, (changes) => {
            const found = changes.filter((doc) => {
                if (doc.type !== 'balance') throw Error('should not get here');

                if (doc.action !== 'recalculated') return false;

                // Check all participants are in the users array
                return participants.every((p) => doc.users.includes(p.uid));
            });

            return found.length >= expectedCount;
        });
    }

    async waitForGroupEvent(action: string, groupId: string, creator: AuthenticatedFirebaseUser, expectedCount: number, timeout: number = 2000) {
        await this.waitForGroupChanges(
            groupId,
            (changes) => {
                const found = changes.filter((doc) => {
                    if (doc.type !== 'group') throw Error('should not get here');

                    if (doc.action !== action) return false;

                    return doc.users.includes(creator.uid);
                });

                return found.length === expectedCount;
            },
            timeout,
        );
    }

    async waitForGroupChanges(groupId: string, matcher: Matcher<GroupChangeDocument[]>, timeout = 2000) {
        const endTime = Date.now() + timeout;
        while (Date.now() < endTime) {
            const changes = await this.getGroupChanges(groupId);
            if (matcher(changes)) return;
        }

        const changes = await this.getGroupChanges(groupId);
        console.error(`${changes.length} observed`);
        for (const change of changes) {
            console.error(` * ${JSON.stringify(change)}`);
        }

        throw Error(`timeout waiting for group changes`);
    }

    async waitForExpenseChanges(groupId: string, matcher: Matcher<ExpenseChangeDocument[]>, timeout = 2000) {
        const endTime = Date.now() + timeout;
        while (Date.now() < endTime) {
            const changes = await this.getExpenseChanges(groupId);
            if (matcher(changes)) return;
        }
        throw Error(`timeout waiting for expense changes`);
    }

    async waitForSettlementChanges(groupId: string, matcher: Matcher<SettlementChangeDocument[]>, timeout = 2000) {
        const endTime = Date.now() + timeout;
        while (Date.now() < endTime) {
            const changes = await this.getSettlementChanges(groupId);
            if (matcher(changes)) return;
        }
        throw Error(`timeout waiting for settlement changes`);
    }

    async waitForBalanceChanges(groupId: string, matcher: Matcher<BalanceChangeDocument[]>, timeout = 2000) {
        const endTime = Date.now() + timeout;
        while (Date.now() < endTime) {
            const changes = await this.getBalanceChanges(groupId);
            if (matcher(changes)) return;
        }
        throw Error(`timeout waiting for balance changes`);
    }

    async getExpenseChanges(groupId: string): Promise<ExpenseChangeDocument[]> {
        return (await this.getTransactionChanges(groupId, 'expense')) as ExpenseChangeDocument[];
    }

    async getSettlementChanges(groupId: string): Promise<SettlementChangeDocument[]> {
        return (await this.getTransactionChanges(groupId, 'settlement')) as SettlementChangeDocument[];
    }

    /**
     * Wait for settlement creation event to be tracked
     */
    async waitForSettlementCreationEvent(groupId: string, settlementId: string, participants: AuthenticatedFirebaseUser[]) {
        return this.waitForSettlementEvent('created', groupId, settlementId, participants, 1);
    }

    /**
     * Wait for settlement updated event to be tracked
     */
    async waitForSettlementUpdatedEvent(groupId: string, settlementId: string, participants: AuthenticatedFirebaseUser[], expectedCount = 1) {
        return this.waitForSettlementEvent('updated', groupId, settlementId, participants, expectedCount);
    }

    /**
     * Wait for settlement deleted event to be tracked
     */
    async waitForSettlementDeletedEvent(groupId: string, settlementId: string, participants: AuthenticatedFirebaseUser[]) {
        return this.waitForSettlementEvent('deleted', groupId, settlementId, participants, 1);
    }

    /**
     * Generic method to wait for settlement events
     */
    async waitForSettlementEvent(action: string, groupId: string, settlementId: string, participants: AuthenticatedFirebaseUser[], expectedCount: number) {
        const participantUids = participants.map((p) => p.uid);

        return this.waitForSettlementChanges(groupId, (changes) => {
            const relevantChanges = changes.filter(
                (change) => change.id === settlementId && change.action === action && change.type === 'settlement' && participantUids.every((uid) => change.users.includes(uid)),
            );
            return relevantChanges.length >= expectedCount;
        });
    }

    /**
     * Count settlement changes for a group
     */
    async countSettlementChanges(groupId: string): Promise<number> {
        const changes = await this.getSettlementChanges(groupId);
        return changes.length;
    }

    /**
     * Get most recent settlement change event
     */
    async mostRecentSettlementChangeEvent(groupId: string) {
        const changes = await this.getSettlementChanges(groupId);
        return changes.length > 0 ? changes[0] : null;
    }
}
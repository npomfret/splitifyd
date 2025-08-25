import { firestoreDb } from '../../firebase';
import { userService } from '../userService';
import { FirestoreCollections, DELETED_AT_FIELD } from '../../shared/shared-types';
import { Expense, Settlement, GroupData, BalanceCalculationInput } from './types';

export class DataFetcher {
    async fetchBalanceCalculationData(groupId: string): Promise<BalanceCalculationInput> {
        // Fetch all required data in parallel for better performance
        const [expenses, settlements, groupData] = await Promise.all([
            this.fetchExpenses(groupId),
            this.fetchSettlements(groupId),
            this.fetchGroupData(groupId)
        ]);

        // Fetch member profiles after we have group data
        const memberIds = Object.keys(groupData.data.members);
        const memberProfiles = await userService.getUsers(memberIds);

        return {
            groupId,
            expenses,
            settlements,
            groupData,
            memberProfiles
        };
    }

    private async fetchExpenses(groupId: string): Promise<Expense[]> {
        const expensesSnapshot = await firestoreDb.collection(FirestoreCollections.EXPENSES)
            .where('groupId', '==', groupId)
            .get();

        return expensesSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Expense))
            .filter(expense => !expense[DELETED_AT_FIELD as keyof Expense]);
    }

    private async fetchSettlements(groupId: string): Promise<Settlement[]> {
        const settlementsSnapshot = await firestoreDb.collection(FirestoreCollections.SETTLEMENTS)
            .where('groupId', '==', groupId)
            .get();

        return settlementsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Settlement));
    }

    private async fetchGroupData(groupId: string): Promise<GroupData> {
        const groupDoc = await firestoreDb.collection(FirestoreCollections.GROUPS)
            .doc(groupId)
            .get();

        if (!groupDoc.exists) {
            throw new Error('Group not found');
        }

        const groupData = groupDoc.data() as any;
        if (!groupData.data?.members) {
            throw new Error('Group missing members - invalid data structure');
        }

        const memberIds = Object.keys(groupData.data.members);
        if (memberIds.length === 0) {
            throw new Error(`Group ${groupId} has no members for balance calculation`);
        }

        return {
            id: groupId,
            data: groupData.data
        };
    }

}
import { getUserService, getGroupMemberService } from '../serviceRegistration';
import { DELETED_AT_FIELD } from '@splitifyd/shared';
import { Expense, Settlement, GroupData, BalanceCalculationInput } from './types';
import { logger } from '../../logger';
import { timestampToISO } from '../../utils/dateHelpers';
import type { IFirestoreReader } from '../firestore/IFirestoreReader';
import type { ExpenseDocument, SettlementDocument, GroupDocument } from '../../schemas';

export class DataFetcher {
    constructor(private firestoreReader: IFirestoreReader) {}
    async fetchBalanceCalculationData(groupId: string): Promise<BalanceCalculationInput> {
        // Fetch all required data in parallel for better performance
        const [expenses, settlements, groupData] = await Promise.all([this.fetchExpenses(groupId), this.fetchSettlements(groupId), this.fetchGroupData(groupId)]);

        // Fetch member profiles after we have group data
        const memberIds = Object.keys(groupData.members);
        const memberProfiles = await getUserService().getUsers(memberIds);

        return {
            groupId,
            expenses,
            settlements,
            groupData,
            memberProfiles,
        };
    }

    private async fetchExpenses(groupId: string): Promise<Expense[]> {
        // Use FirestoreReader for validated data - it handles the Zod parsing and validation
        const expenseDocuments = await this.firestoreReader.getExpensesForGroup(groupId);

        // Transform ExpenseDocument to local Expense interface
        const expenses: Expense[] = expenseDocuments.map((expenseDoc) => {
            // Transform to match local Expense interface - convert Timestamp to ISO string and extract required fields  
            return {
                id: expenseDoc.id,
                groupId: expenseDoc.groupId,
                description: expenseDoc.description,
                amount: expenseDoc.amount,
                currency: expenseDoc.currency,
                paidBy: expenseDoc.paidBy,
                splitType: expenseDoc.splitType,
                participants: expenseDoc.participants,
                splits: expenseDoc.splits,
                date: timestampToISO(expenseDoc.date),
                category: expenseDoc.category,
                receiptUrl: expenseDoc.receiptUrl || undefined,
                createdAt: expenseDoc.createdAt,
                deletedAt: expenseDoc.deletedAt,
            } satisfies Expense;
        });

        // Filter out soft-deleted expenses - FirestoreReader already does this filtering
        return expenses.filter((expense) => !expense[DELETED_AT_FIELD as keyof typeof expense]);
    }

    private async fetchSettlements(groupId: string): Promise<Settlement[]> {
        // Use FirestoreReader for validated data - it handles the Zod parsing and validation
        const settlementDocuments = await this.firestoreReader.getSettlementsForGroup(groupId);

        // Transform SettlementDocument to local Settlement interface
        const settlements: Settlement[] = settlementDocuments.map((settlementDoc) => {
            // Transform to match local Settlement interface - extract required fields only
            return {
                id: settlementDoc.id,
                groupId: settlementDoc.groupId,
                payerId: settlementDoc.payerId,
                payeeId: settlementDoc.payeeId,
                amount: settlementDoc.amount,
                currency: settlementDoc.currency,
                date: settlementDoc.date ? timestampToISO(settlementDoc.date) : undefined,
                note: settlementDoc.note,
                createdAt: settlementDoc.createdAt,
            } satisfies Settlement;
        });

        return settlements;
    }

    private async fetchGroupData(groupId: string): Promise<GroupData> {
        // Use FirestoreReader for validated data
        const groupDoc = await this.firestoreReader.getGroup(groupId);

        if (!groupDoc) {
            throw new Error('Group not found');
        }

        // Fetch members from subcollection
        const memberDocs = await getGroupMemberService().getMembersFromSubcollection(groupId);
        if (memberDocs.length === 0) {
            throw new Error(`Group ${groupId} has no members for balance calculation`);
        }

        // Convert GroupMemberDocument[] to Record<string, GroupMember> for compatibility
        const members: Record<string, import('./types').GroupMember> = {};
        for (const memberDoc of memberDocs) {
            members[memberDoc.userId] = {
                memberRole: memberDoc.memberRole,
                memberStatus: memberDoc.memberStatus,
                joinedAt: memberDoc.joinedAt,
            };
        }

        return {
            id: groupId,
            name: groupDoc.name,
            members,
        };
    }
}

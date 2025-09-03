import { firestoreDb } from '../../firebase';
import { getUserService, getGroupMemberService } from '../serviceRegistration';
import { FirestoreCollections, DELETED_AT_FIELD } from '@splitifyd/shared';
import { Expense, Settlement, GroupData, BalanceCalculationInput } from './types';
import { ExpenseDocumentSchema } from '../../schemas/expense';
import { SettlementDocumentSchema } from '../../schemas/settlement';
import { transformGroupDocument } from '../../groups/handlers';
import { z } from 'zod';
import { logger } from '../../logger';
import { timestampToISO } from '../../utils/dateHelpers';

// Strict schemas for balance calculation - require all fields for fail-fast validation
const BalanceExpenseSchema = ExpenseDocumentSchema;
const BalanceSettlementSchema = SettlementDocumentSchema;

export class DataFetcher {
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
        const expensesSnapshot = await firestoreDb.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId).get();

        const expenses: Expense[] = expensesSnapshot.docs.map((doc) => {
            const rawData = doc.data();
            if (!rawData) {
                logger.error('Empty expense document in balance calculation', { docId: doc.id, groupId });
                throw new Error(`Expense ${doc.id} document is empty - invalid state`);
            }

            const dataWithId = { ...rawData, id: doc.id };
            try {
                const validatedExpense = BalanceExpenseSchema.parse(dataWithId);
                // Transform to match local Expense interface - convert Timestamp to ISO string and extract required fields  
                return {
                    id: validatedExpense.id,
                    groupId: validatedExpense.groupId,
                    description: validatedExpense.description,
                    amount: validatedExpense.amount,
                    currency: validatedExpense.currency,
                    paidBy: validatedExpense.paidBy,
                    splitType: validatedExpense.splitType,
                    participants: validatedExpense.participants,
                    splits: validatedExpense.splits,
                    date: timestampToISO(validatedExpense.date),
                    category: validatedExpense.category,
                    receiptUrl: validatedExpense.receiptUrl || undefined,
                    createdAt: validatedExpense.createdAt,
                    deletedAt: validatedExpense.deletedAt,
                } satisfies Expense;
            } catch (error) {
                logger.error('Invalid expense document in balance calculation', error as Error, {
                    docId: doc.id,
                    groupId,
                    validationErrors: error instanceof z.ZodError ? error.issues : undefined,
                });
                // Fail-fast validation: throw on invalid data instead of silently skipping
                throw new Error(`Expense ${doc.id} is missing currency - invalid state`);
            }
        });

        return expenses.filter((expense) => !expense[DELETED_AT_FIELD as keyof typeof expense]);
    }

    private async fetchSettlements(groupId: string): Promise<Settlement[]> {
        const settlementsSnapshot = await firestoreDb.collection(FirestoreCollections.SETTLEMENTS).where('groupId', '==', groupId).get();

        const settlements: Settlement[] = settlementsSnapshot.docs.map((doc) => {
            const rawData = doc.data();
            if (!rawData) {
                logger.error('Empty settlement document in balance calculation', { docId: doc.id, groupId });
                throw new Error(`Settlement ${doc.id} document is empty - invalid state`);
            }

            const dataWithId = { ...rawData, id: doc.id };
            try {
                const validatedSettlement = BalanceSettlementSchema.parse(dataWithId);
                // Transform to match local Settlement interface - extract required fields only
                return {
                    id: validatedSettlement.id,
                    groupId: validatedSettlement.groupId,
                    payerId: validatedSettlement.payerId,
                    payeeId: validatedSettlement.payeeId,
                    amount: validatedSettlement.amount,
                    currency: validatedSettlement.currency,
                    date: validatedSettlement.date ? timestampToISO(validatedSettlement.date) : undefined,
                    note: validatedSettlement.note,
                    createdAt: validatedSettlement.createdAt,
                } satisfies Settlement;
            } catch (error) {
                logger.error('Invalid settlement document in balance calculation', error as Error, {
                    docId: doc.id,
                    groupId,
                    validationErrors: error instanceof z.ZodError ? error.issues : undefined,
                });
                // Fail-fast validation: throw on invalid data instead of silently skipping
                throw new Error(`Settlement ${doc.id} is missing currency - invalid state`);
            }
        });

        return settlements;
    }

    private async fetchGroupData(groupId: string): Promise<GroupData> {
        const groupDoc = await firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId).get();

        if (!groupDoc.exists) {
            throw new Error('Group not found');
        }

        // Use proper validation for group document
        const group = transformGroupDocument(groupDoc);

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
            name: group.name,
            members,
        };
    }
}

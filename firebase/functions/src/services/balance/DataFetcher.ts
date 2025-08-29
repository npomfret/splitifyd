import { firestoreDb } from '../../firebase';
import { userService } from '../UserService2';
import { FirestoreCollections, DELETED_AT_FIELD } from '@splitifyd/shared';
import { Expense, Settlement, GroupData, BalanceCalculationInput } from './types';
import { ExpenseDocumentSchema } from '../../schemas/expense';
import { SettlementDocumentSchema } from '../../schemas/settlement';
import { transformGroupDocument } from '../../groups/handlers';
import { z } from 'zod';
import { logger } from '../../logger';
import { timestampToISO } from '../../utils/dateHelpers';

// Lenient schemas for balance calculation - allow missing currency since it's validated in processors
const BalanceExpenseSchema = ExpenseDocumentSchema.partial({ currency: true });
const BalanceSettlementSchema = SettlementDocumentSchema.partial({ currency: true });

export class DataFetcher {
    async fetchBalanceCalculationData(groupId: string): Promise<BalanceCalculationInput> {
        // Fetch all required data in parallel for better performance
        const [expenses, settlements, groupData] = await Promise.all([this.fetchExpenses(groupId), this.fetchSettlements(groupId), this.fetchGroupData(groupId)]);

        // Fetch member profiles after we have group data
        const memberIds = Object.keys(groupData.data.members);
        const memberProfiles = await userService.getUsers(memberIds);

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

        return expensesSnapshot.docs
            .map((doc) => {
                const rawData = doc.data();
                if (!rawData) {
                    logger.warn('Empty expense document in balance calculation', { docId: doc.id, groupId });
                    return null;
                }

                const dataWithId = { ...rawData, id: doc.id };
                try {
                    const validatedExpense = BalanceExpenseSchema.parse(dataWithId);
                    // Transform to match Expense interface - convert Timestamp to ISO string  
                    return {
                        ...validatedExpense,
                        date: timestampToISO(validatedExpense.date),
                    };
                } catch (error) {
                    logger.error('Invalid expense document in balance calculation', error as Error, {
                        docId: doc.id,
                        groupId,
                        validationErrors: error instanceof z.ZodError ? error.issues : undefined,
                    });
                    return null; // Skip invalid documents
                }
            })
            .filter((expense) => expense !== null && !expense[DELETED_AT_FIELD as keyof typeof expense]) as Expense[];
    }

    private async fetchSettlements(groupId: string): Promise<Settlement[]> {
        const settlementsSnapshot = await firestoreDb.collection(FirestoreCollections.SETTLEMENTS).where('groupId', '==', groupId).get();

        return settlementsSnapshot.docs
            .map((doc) => {
                const rawData = doc.data();
                if (!rawData) {
                    logger.warn('Empty settlement document in balance calculation', { docId: doc.id, groupId });
                    return null;
                }

                const dataWithId = { ...rawData, id: doc.id };
                try {
                    const validatedSettlement = BalanceSettlementSchema.parse(dataWithId);
                    // Transform to match Settlement interface - convert Timestamp to ISO string
                    return {
                        ...validatedSettlement,
                        date: validatedSettlement.date ? timestampToISO(validatedSettlement.date) : undefined,
                    };
                } catch (error) {
                    logger.error('Invalid settlement document in balance calculation', error as Error, {
                        docId: doc.id,
                        groupId,
                        validationErrors: error instanceof z.ZodError ? error.issues : undefined,
                    });
                    return null; // Skip invalid documents
                }
            })
            .filter((settlement) => settlement !== null) as Settlement[];
    }

    private async fetchGroupData(groupId: string): Promise<GroupData> {
        const groupDoc = await firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId).get();

        if (!groupDoc.exists) {
            throw new Error('Group not found');
        }

        // Use proper validation for group document
        const group = transformGroupDocument(groupDoc);
        if (!group.members) {
            throw new Error('Group missing members - invalid data structure');
        }

        const memberIds = Object.keys(group.members);
        if (memberIds.length === 0) {
            throw new Error(`Group ${groupId} has no members for balance calculation`);
        }

        return {
            id: groupId,
            data: {
                members: group.members,
                name: group.name,
            },
        };
    }
}

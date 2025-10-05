import type { IFirestoreReader } from './firestore';

interface ExpenseMetadata {
    expenseCount: number;
    lastExpenseTime?: Date;
    lastExpense?: {
        description: string;
        amount: number;
        date: Date;
    };
}

/**
 * Service for calculating expense metadata for groups
 */
export class ExpenseMetadataService {
    constructor(private firestoreReader: IFirestoreReader) {}

    /**
     * Calculate expense metadata for a group on-demand
     */
    async calculateExpenseMetadata(groupId: string): Promise<ExpenseMetadata> {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        // Get all expenses for the group, sorted by creation date descending
        const expenses = await this.firestoreReader.getExpensesForGroup(groupId, {
            orderBy: {
                field: 'createdAt',
                direction: 'desc',
            },
        });

        const expenseCount = expenses.length;

        if (expenseCount === 0) {
            return {
                expenseCount: 0,
                lastExpenseTime: undefined,
                lastExpense: undefined,
            };
        }

        // Get the most recent expense (first in the sorted array)
        const latestExpense = expenses[0];

        // ExpenseDTO has ISO strings from FirestoreReader
        return {
            expenseCount,
            lastExpenseTime: new Date(latestExpense.createdAt),
            lastExpense: {
                description: latestExpense.description,
                amount: latestExpense.amount,
                date: new Date(latestExpense.date),
            },
        };
    }
}

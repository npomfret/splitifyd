import type { IFirestoreReader } from './firestore';

/**
 * Service for fetching the most recent expense timestamp for groups
 * Used to display "last activity" information
 */
export class ExpenseMetadataService {
    constructor(private firestoreReader: IFirestoreReader) {}

    /**
     * Get the timestamp of the most recent expense for a group
     * @param groupId - The group ID
     * @returns The creation timestamp of the most recent expense, or undefined if no expenses exist
     */
    async getLastExpenseTime(groupId: string): Promise<Date | undefined> {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        // Fetch ONLY the most recent expense - single document query
        const recentExpenses = await this.firestoreReader.getExpensesForGroup(groupId, {
            limit: 1,
            orderBy: {
                field: 'createdAt',
                direction: 'desc',
            },
        });

        if (recentExpenses.length === 0) {
            return undefined;
        }

        return new Date(recentExpenses[0].createdAt);
    }
}

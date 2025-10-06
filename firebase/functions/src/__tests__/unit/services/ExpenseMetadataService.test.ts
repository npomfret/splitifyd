import { describe, it, expect, beforeEach } from 'vitest';
import { StubFirestoreReader } from '../mocks/firestore-stubs';
import { ExpenseMetadataService } from '../../../services/expenseMetadataService';
import { ExpenseDTOBuilder } from '@splitifyd/test-support';

describe('ExpenseMetadataService', () => {
    let expenseMetadataService: ExpenseMetadataService;
    let stubFirestoreReader: StubFirestoreReader;

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        expenseMetadataService = new ExpenseMetadataService(stubFirestoreReader);
    });

    describe('getLastExpenseTime', () => {
        it('should return the most recent expense timestamp', async () => {
            const groupId = 'test-group-id';

            // Set up test expenses using builders - StubFirestoreReader expects DTOs with ISO strings
            const latestExpense = new ExpenseDTOBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withDescription('Latest Expense')
                .withAmount(150)
                .withDate('2024-01-15T00:00:00Z')
                .withCreatedAt('2024-01-15T10:00:00Z')
                .build();

            const olderExpense = new ExpenseDTOBuilder()
                .withId('expense-2')
                .withGroupId(groupId)
                .withDescription('Older Expense')
                .withAmount(100)
                .withDate('2024-01-10T00:00:00Z')
                .withCreatedAt('2024-01-10T10:00:00Z')
                .build();

            stubFirestoreReader.setDocument('expenses', 'expense-1', latestExpense);
            stubFirestoreReader.setDocument('expenses', 'expense-2', olderExpense);

            const result = await expenseMetadataService.getLastExpenseTime(groupId);

            expect(result).toEqual(new Date('2024-01-15T10:00:00Z'));
        });

        it('should return undefined for group with no expenses', async () => {
            const groupId = 'empty-group-id';
            // No expenses set for this group in stub, so getExpensesForGroup will return empty array

            const result = await expenseMetadataService.getLastExpenseTime(groupId);

            expect(result).toBeUndefined();
        });

        it('should throw error for empty groupId', async () => {
            await expect(expenseMetadataService.getLastExpenseTime('')).rejects.toThrow('Group ID is required');
        });
    });
});

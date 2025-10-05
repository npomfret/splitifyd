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

    describe('calculateExpenseMetadata', () => {
        it('should calculate metadata for group with expenses', async () => {
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

            const result = await expenseMetadataService.calculateExpenseMetadata(groupId);

            expect(result.expenseCount).toBe(2);
            expect(result.lastExpenseTime).toEqual(new Date('2024-01-15T10:00:00Z'));
            expect(result.lastExpense).toEqual({
                description: 'Latest Expense',
                amount: 150,
                date: new Date('2024-01-15T00:00:00Z'),
            });
        });

        it('should return zero metadata for group with no expenses', async () => {
            const groupId = 'empty-group-id';
            // No expenses set for this group in stub, so getExpensesForGroup will return empty array

            const result = await expenseMetadataService.calculateExpenseMetadata(groupId);

            expect(result.expenseCount).toBe(0);
            expect(result.lastExpenseTime).toBeUndefined();
            expect(result.lastExpense).toBeUndefined();
        });

        it('should throw error for empty groupId', async () => {
            await expect(expenseMetadataService.calculateExpenseMetadata('')).rejects.toThrow('Group ID is required');
        });
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StubFirestoreReader } from '../mocks/firestore-stubs';

// Mock the problematic dependencies before importing
vi.mock('../../../services/serviceRegistration', () => ({
    getExpenseMetadataService: vi.fn(),
}));

vi.mock('../../../services/balance/index', () => ({}));

// Import the service class
import { ExpenseMetadataService } from '../../../services/expenseMetadataService';

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

            // Set up the stub to return our test expenses for this group
            stubFirestoreReader.setDocument('expenses', 'expense-1', {
                id: 'expense-1',
                groupId: groupId,
                description: 'Latest Expense',
                amount: 150,
                date: { toDate: () => new Date('2024-01-15') },
                createdAt: { toDate: () => new Date('2024-01-15T10:00:00Z') },
            });
            stubFirestoreReader.setDocument('expenses', 'expense-2', {
                id: 'expense-2',
                groupId: groupId,
                description: 'Older Expense',
                amount: 100,
                date: { toDate: () => new Date('2024-01-10') },
                createdAt: { toDate: () => new Date('2024-01-10T10:00:00Z') },
            });

            const result = await expenseMetadataService.calculateExpenseMetadata(groupId);

            expect(result.expenseCount).toBe(2);
            expect(result.lastExpenseTime).toEqual(new Date('2024-01-15T10:00:00Z'));
            expect(result.lastExpense).toEqual({
                description: 'Latest Expense',
                amount: 150,
                date: new Date('2024-01-15'),
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

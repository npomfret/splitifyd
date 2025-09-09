import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';

// Mock the problematic dependencies before importing
vi.mock('../../../services/serviceRegistration', () => ({
    getExpenseMetadataService: vi.fn()
}));

vi.mock('../../../services/balance/index', () => ({}));

// Import the service class
import { ExpenseMetadataService } from '../../../services/expenseMetadataService';

describe('ExpenseMetadataService', () => {
    let expenseMetadataService: ExpenseMetadataService;
    let mockFirestoreReader: MockFirestoreReader;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        expenseMetadataService = new ExpenseMetadataService(mockFirestoreReader);
        mockFirestoreReader.resetAllMocks();
    });

    describe('calculateExpenseMetadata', () => {
        it('should calculate metadata for group with expenses', async () => {
            const groupId = 'test-group-id';
            const mockExpenses = [
                {
                    id: 'expense-1',
                    description: 'Latest Expense',
                    amount: 150,
                    date: { toDate: () => new Date('2024-01-15') },
                    createdAt: { toDate: () => new Date('2024-01-15T10:00:00Z') }
                },
                {
                    id: 'expense-2',
                    description: 'Older Expense',
                    amount: 100,
                    date: { toDate: () => new Date('2024-01-10') },
                    createdAt: { toDate: () => new Date('2024-01-10T10:00:00Z') }
                }
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);

            const result = await expenseMetadataService.calculateExpenseMetadata(groupId);

            expect(result.expenseCount).toBe(2);
            expect(result.lastExpenseTime).toEqual(new Date('2024-01-15T10:00:00Z'));
            expect(result.lastExpense).toEqual({
                description: 'Latest Expense',
                amount: 150,
                date: new Date('2024-01-15')
            });

            // Verify correct parameters passed to getExpensesForGroup
            expect(mockFirestoreReader.getExpensesForGroup).toHaveBeenCalledWith(groupId, {
                orderBy: {
                    field: 'createdAt',
                    direction: 'desc'
                }
            });
        });

        it('should return zero metadata for group with no expenses', async () => {
            const groupId = 'empty-group-id';
            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);

            const result = await expenseMetadataService.calculateExpenseMetadata(groupId);

            expect(result.expenseCount).toBe(0);
            expect(result.lastExpenseTime).toBeUndefined();
            expect(result.lastExpense).toBeUndefined();
        });

        it('should throw error for empty groupId', async () => {
            await expect(expenseMetadataService.calculateExpenseMetadata(''))
                .rejects
                .toThrow('Group ID is required');
        });

    });
});
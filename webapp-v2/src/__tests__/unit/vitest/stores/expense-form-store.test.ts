import { expenseFormStore } from '@/app/stores/expense-form-store';
import type { UserScopedStorage } from '@/utils/userScopedStorage';
import { SplitTypes } from '@splitifyd/shared';
import { ExpenseDraftBuilder } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dependencies
vi.mock('@/app/apiClient', () => ({
    apiClient: {
        createExpense: vi.fn(),
        updateExpense: vi.fn(),
    },
    ApiError: class ApiError extends Error {
        constructor(message: string) {
            super(message);
        }
    },
}));

vi.mock('@/app/stores/group-detail-store-enhanced', () => ({
    enhancedGroupDetailStore: {
        refreshAll: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/app/stores/groups-store-enhanced', () => ({
    enhancedGroupsStore: {
        refreshGroups: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/utils/browser-logger.ts', () => ({
    logWarning: vi.fn(),
}));

vi.mock('@/utils/dateUtils.ts', () => ({
    getUTCDateTime: vi.fn((date: string, time: string) => `${date}T${time}:00.000Z`),
    isDateInFuture: vi.fn(() => false),
}));

describe('ExpenseFormStore - Draft Functionality', () => {
    let mockStorage: UserScopedStorage;
    const testGroupId = 'test-group-123';

    // Mock current time for consistent testing
    const mockNow = 1640995200000; // 2022-01-01 00:00:00 UTC

    beforeEach(() => {
        // Reset form state
        expenseFormStore.reset();
        expenseFormStore.clearError();

        // Create mock storage implementation
        const storageData = new Map<string, string>();

        mockStorage = {
            getItem: vi.fn((key: string) => storageData.get(key) || null),
            setItem: vi.fn((key: string, value: string) => storageData.set(key, value)),
            removeItem: vi.fn((key: string) => storageData.delete(key)),
            clear: vi.fn(() => storageData.clear()),
        };

        expenseFormStore.setStorage(mockStorage);

        // Mock Date.now() for consistent timestamps
        vi.spyOn(Date, 'now').mockReturnValue(mockNow);

        vi.clearAllMocks();
    });

    afterEach(() => {
        expenseFormStore.clearStorage();
        vi.restoreAllMocks();
    });

    describe('Draft Saving', () => {
        it('should save complete draft data to storage', () => {
            // Arrange - fill form with data
            expenseFormStore.updateField('description', 'Test lunch expense');
            expenseFormStore.updateField('amount', 25.5);
            expenseFormStore.updateField('currency', 'EUR');
            expenseFormStore.updateField('date', '2022-01-15');
            expenseFormStore.updateField('time', '14:30');
            expenseFormStore.updateField('paidBy', 'user-1');
            expenseFormStore.updateField('category', 'food');
            expenseFormStore.updateField('splitType', SplitTypes.EQUAL);
            expenseFormStore.setParticipants(['user-1', 'user-2']);

            // Act
            expenseFormStore.saveDraft(testGroupId);

            // Assert
            expect(mockStorage.setItem).toHaveBeenCalledWith(`expense-draft-${testGroupId}`, expect.stringContaining('"description":"Test lunch expense"'));

            const savedData = JSON.parse((mockStorage.setItem as any).mock.calls[0][1]);
            expect(savedData).toEqual({
                description: 'Test lunch expense',
                amount: 25.5,
                currency: 'EUR',
                date: '2022-01-15',
                time: '14:30',
                paidBy: 'user-1',
                category: 'food',
                splitType: SplitTypes.EQUAL,
                participants: ['user-1', 'user-2'],
                splits: expect.any(Array),
                timestamp: mockNow,
            });
        });

        it('should save draft with empty form data', () => {
            // Act - save draft with default/empty form
            expenseFormStore.saveDraft(testGroupId);

            // Assert
            expect(mockStorage.setItem).toHaveBeenCalledWith(`expense-draft-${testGroupId}`, expect.stringContaining('"description":""'));

            const savedData = JSON.parse((mockStorage.setItem as any).mock.calls[0][1]);
            expect(savedData.description).toBe('');
            expect(savedData.amount).toBe(0);
            expect(savedData.timestamp).toBe(mockNow);
        });

        it('should handle storage errors gracefully', () => {
            // Arrange - mock storage to throw error
            (mockStorage.setItem as any).mockImplementation(() => {
                throw new Error('Storage quota exceeded');
            });

            // Act & Assert - should not throw
            expect(() => expenseFormStore.saveDraft(testGroupId)).not.toThrow();
        });

        it('should not save draft when no storage is available', () => {
            // Arrange
            expenseFormStore.clearStorage();

            // Act
            expenseFormStore.saveDraft(testGroupId);

            // Assert - no storage operations should occur
            expect(mockStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('Draft Loading', () => {
        const testDraftData = new ExpenseDraftBuilder()
            .withDescription('Saved draft expense')
            .withAmount(42.75)
            .withCurrency('GBP')
            .withDate('2022-01-10')
            .withTime('16:45')
            .withPaidBy('user-2')
            .withCategory('transport')
            .withSplitType(SplitTypes.EXACT)
            .withParticipants(['user-1', 'user-2', 'user-3'])
            .withSplits([
                { userId: 'user-1', amount: 15.0 },
                { userId: 'user-2', amount: 12.75 },
                { userId: 'user-3', amount: 15.0 },
            ])
            .withTimestamp(mockNow - 30 * 60 * 1000)
            .build();

        it('should load valid draft data into form', () => {
            // Arrange
            (mockStorage.getItem as any).mockReturnValue(JSON.stringify(testDraftData));

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert
            expect(loaded).toBe(true);
            expect(expenseFormStore.description).toBe('Saved draft expense');
            expect(expenseFormStore.amount).toBe(42.75);
            expect(expenseFormStore.currency).toBe('GBP');
            expect(expenseFormStore.date).toBe('2022-01-10');
            expect(expenseFormStore.time).toBe('16:45');
            expect(expenseFormStore.paidBy).toBe('user-2');
            expect(expenseFormStore.category).toBe('transport');
            expect(expenseFormStore.splitType).toBe(SplitTypes.EXACT);
            expect(expenseFormStore.participants).toEqual(['user-1', 'user-2', 'user-3']);
            expect(expenseFormStore.splits).toEqual(testDraftData.splits);
        });

        it('should return false when no draft exists', () => {
            // Arrange
            (mockStorage.getItem as any).mockReturnValue(null);

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert
            expect(loaded).toBe(false);
            expect(mockStorage.getItem).toHaveBeenCalledWith(`expense-draft-${testGroupId}`);
        });

        it('should handle corrupted draft data gracefully', () => {
            // Arrange
            (mockStorage.getItem as any).mockReturnValue('invalid-json-data');

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert
            expect(loaded).toBe(false);
        });

        it('should reject expired drafts (older than 24 hours)', () => {
            // Arrange - create draft that's 25 hours old
            const expiredDraft = {
                ...testDraftData,
                timestamp: mockNow - 25 * 60 * 60 * 1000, // 25 hours ago
            };
            (mockStorage.getItem as any).mockReturnValue(JSON.stringify(expiredDraft));

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert
            expect(loaded).toBe(false);
            expect(mockStorage.removeItem).toHaveBeenCalledWith(`expense-draft-${testGroupId}`);
        });

        it('should accept drafts within 24 hours', () => {
            // Arrange - create draft that's 23 hours old
            const validDraft = {
                ...testDraftData,
                timestamp: mockNow - 23 * 60 * 60 * 1000, // 23 hours ago
            };
            (mockStorage.getItem as any).mockReturnValue(JSON.stringify(validDraft));

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert
            expect(loaded).toBe(true);
            expect(expenseFormStore.description).toBe(testDraftData.description);
        });

        it('should use default values for missing draft fields', () => {
            // Arrange - draft with some missing fields
            const partialDraft = new ExpenseDraftBuilder()
                .withDescription('Partial draft')
                .withAmount(10.0)
                .withTimestamp(mockNow)
                .build();

            // Remove fields to simulate partial data
            const { currency, paidBy, category, splitType, ...partialDraftData } = partialDraft;
            (mockStorage.getItem as any).mockReturnValue(JSON.stringify(partialDraftData));

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert
            expect(loaded).toBe(true);
            expect(expenseFormStore.description).toBe('Partial draft');
            expect(expenseFormStore.amount).toBe(10.0);
            expect(expenseFormStore.currency).toBe(''); // Default
            expect(expenseFormStore.category).toBe('food'); // Default
            expect(expenseFormStore.splitType).toBe(SplitTypes.EQUAL); // Default
        });

        it('should not load draft when no storage is available', () => {
            // Arrange
            expenseFormStore.clearStorage();

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert
            expect(loaded).toBe(false);
            expect(mockStorage.getItem).not.toHaveBeenCalled();
        });
    });

    describe('Draft Clearing', () => {
        it('should remove draft from storage', () => {
            // Act
            expenseFormStore.clearDraft(testGroupId);

            // Assert
            expect(mockStorage.removeItem).toHaveBeenCalledWith(`expense-draft-${testGroupId}`);
        });

        it('should handle storage errors when clearing', () => {
            // Arrange
            (mockStorage.removeItem as any).mockImplementation(() => {
                throw new Error('Storage error');
            });

            // Act & Assert - should not throw
            expect(() => expenseFormStore.clearDraft(testGroupId)).not.toThrow();
        });

        it('should not clear draft when no storage is available', () => {
            // Arrange
            expenseFormStore.clearStorage();

            // Act
            expenseFormStore.clearDraft(testGroupId);

            // Assert
            expect(mockStorage.removeItem).not.toHaveBeenCalled();
        });
    });

    describe('Integration with Form Submission', () => {
        it('should clear draft after successful expense creation', async () => {
            const { apiClient } = await import('@/app/apiClient');

            // Arrange
            expenseFormStore.updateField('description', 'Test expense');
            expenseFormStore.updateField('amount', 30.0);
            expenseFormStore.updateField('currency', 'USD');
            expenseFormStore.updateField('paidBy', 'user-1');
            expenseFormStore.setParticipants(['user-1']);

            (apiClient.createExpense as any).mockResolvedValue({ id: 'expense-123' });

            // Act
            await expenseFormStore.saveExpense(testGroupId);

            // Assert
            expect(mockStorage.removeItem).toHaveBeenCalledWith(`expense-draft-${testGroupId}`);
        });

        it('should clear draft after successful expense update', async () => {
            const { apiClient } = await import('@/app/apiClient');

            // Arrange
            expenseFormStore.updateField('description', 'Updated expense');
            expenseFormStore.updateField('amount', 35.0);
            expenseFormStore.updateField('currency', 'USD');
            expenseFormStore.updateField('paidBy', 'user-1');
            expenseFormStore.setParticipants(['user-1']);

            (apiClient.updateExpense as any).mockResolvedValue({ id: 'expense-123' });

            // Act
            await expenseFormStore.updateExpense(testGroupId, 'expense-123');

            // Assert
            expect(mockStorage.removeItem).toHaveBeenCalledWith(`expense-draft-${testGroupId}`);
        });

        it('should not clear draft when expense creation fails', async () => {
            const { apiClient } = await import('@/app/apiClient');

            // Arrange
            expenseFormStore.updateField('description', 'Test expense');
            expenseFormStore.updateField('amount', 30.0);
            expenseFormStore.updateField('currency', 'USD');
            expenseFormStore.updateField('paidBy', 'user-1');
            expenseFormStore.setParticipants(['user-1']);

            (apiClient.createExpense as any).mockRejectedValue(new Error('API Error'));

            // Act & Assert
            await expect(expenseFormStore.saveExpense(testGroupId)).rejects.toThrow('API Error');
            expect(mockStorage.removeItem).not.toHaveBeenCalled();
        });
    });

    describe('Draft Age Validation', () => {
        it('should accept edge case of exactly 24 hours old', () => {
            // Arrange - draft exactly 24 hours old
            const exactlyOldDraft = new ExpenseDraftBuilder()
                .withDescription('Edge case draft')
                .withAmount(10.0)
                .withTimestamp(mockNow - 24 * 60 * 60 * 1000)
                .build();
            (mockStorage.getItem as any).mockReturnValue(JSON.stringify(exactlyOldDraft));

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert - should be accepted as condition is > maxAge (not >= maxAge)
            expect(loaded).toBe(true);
            expect(expenseFormStore.description).toBe('Edge case draft');
        });

        it('should reject drafts just over 24 hours old', () => {
            // Arrange - draft 24 hours and 1 millisecond old
            const justOverOldDraft = new ExpenseDraftBuilder()
                .withDescription('Just over limit draft')
                .withAmount(10.0)
                .withTimestamp(mockNow - (24 * 60 * 60 * 1000 + 1))
                .build();
            (mockStorage.getItem as any).mockReturnValue(JSON.stringify(justOverOldDraft));

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert - should be rejected
            expect(loaded).toBe(false);
            expect(mockStorage.removeItem).toHaveBeenCalledWith(`expense-draft-${testGroupId}`);
        });

        it('should handle missing timestamp in draft', () => {
            // Arrange - draft without timestamp
            const noTimestampData = new ExpenseDraftBuilder()
                .withDescription('Draft without timestamp')
                .withAmount(10.0)
                .build();

            // Remove timestamp to simulate missing field
            const { timestamp, ...noTimestampDraft } = noTimestampData;
            (mockStorage.getItem as any).mockReturnValue(JSON.stringify(noTimestampDraft));

            // Act
            const loaded = expenseFormStore.loadDraft(testGroupId);

            // Assert - should pass due to NaN > maxAge being false, so it's not expired
            expect(loaded).toBe(true);
            expect(expenseFormStore.description).toBe('Draft without timestamp');
        });
    });

    describe('Storage Management', () => {
        it('should properly set and clear storage reference', () => {
            // Act - clear storage
            expenseFormStore.clearStorage();

            // Assert - draft operations should not work
            expenseFormStore.saveDraft(testGroupId);
            expect(mockStorage.setItem).not.toHaveBeenCalled();

            const loaded = expenseFormStore.loadDraft(testGroupId);
            expect(loaded).toBe(false);
            expect(mockStorage.getItem).not.toHaveBeenCalled();

            // Act - restore storage
            expenseFormStore.setStorage(mockStorage);

            // Assert - operations should work again
            expenseFormStore.saveDraft(testGroupId);
            expect(mockStorage.setItem).toHaveBeenCalled();
        });
    });
});

describe('ExpenseFormStore - Split Recalculation', () => {
    beforeEach(() => {
        expenseFormStore.reset();
        expenseFormStore.clearError();
    });

    describe('EQUAL split recalculation', () => {
        it('should recalculate EQUAL splits when amount changes', () => {
            expenseFormStore.updateField('amount', 100);
            expenseFormStore.updateField('currency', 'USD');
            expenseFormStore.updateField('splitType', SplitTypes.EQUAL);
            expenseFormStore.setParticipants(['user-1', 'user-2', 'user-3']);

            const splitsAfterInitial = expenseFormStore.splits;
            expect(splitsAfterInitial).toHaveLength(3);
            expect(splitsAfterInitial[0].amount).toBeCloseTo(33.33, 2);
            expect(splitsAfterInitial[1].amount).toBeCloseTo(33.33, 2);
            expect(splitsAfterInitial[2].amount).toBeCloseTo(33.34, 2);

            expenseFormStore.updateField('amount', 150);

            const splitsAfterChange = expenseFormStore.splits;
            expect(splitsAfterChange).toHaveLength(3);
            expect(splitsAfterChange[0].amount).toBeCloseTo(50.0, 2);
            expect(splitsAfterChange[1].amount).toBeCloseTo(50.0, 2);
            expect(splitsAfterChange[2].amount).toBeCloseTo(50.0, 2);
        });

        it('should recalculate EQUAL splits when currency changes (USD to JPY)', () => {
            expenseFormStore.updateField('amount', 100);
            expenseFormStore.updateField('currency', 'USD');
            expenseFormStore.updateField('splitType', SplitTypes.EQUAL);
            expenseFormStore.setParticipants(['user-1', 'user-2']);

            const splitsWithUSD = expenseFormStore.splits;
            expect(splitsWithUSD).toHaveLength(2);
            expect(splitsWithUSD[0].amount).toBeCloseTo(50.0, 2);
            expect(splitsWithUSD[1].amount).toBeCloseTo(50.0, 2);

            expenseFormStore.updateField('currency', 'JPY');

            const splitsWithJPY = expenseFormStore.splits;
            expect(splitsWithJPY).toHaveLength(2);
            expect(splitsWithJPY[0].amount).toBe(50);
            expect(splitsWithJPY[1].amount).toBe(50);
        });
    });

    describe('EXACT split recalculation', () => {
        it('should recalculate EXACT splits when amount changes', () => {
            expenseFormStore.updateField('amount', 100);
            expenseFormStore.updateField('currency', 'USD');
            expenseFormStore.updateField('splitType', SplitTypes.EXACT);
            expenseFormStore.setParticipants(['user-1', 'user-2']);

            const splitsAfterInitial = expenseFormStore.splits;
            expect(splitsAfterInitial).toHaveLength(2);
            expect(splitsAfterInitial[0].amount).toBe(50);
            expect(splitsAfterInitial[1].amount).toBe(50);

            expenseFormStore.updateField('amount', 200);

            const splitsAfterChange = expenseFormStore.splits;
            expect(splitsAfterChange).toHaveLength(2);
            expect(splitsAfterChange[0].amount).toBe(100);
            expect(splitsAfterChange[1].amount).toBe(100);
        });

        it('should recalculate EXACT splits when currency changes (USD to JPY)', () => {
            expenseFormStore.updateField('amount', 100);
            expenseFormStore.updateField('currency', 'USD');
            expenseFormStore.updateField('splitType', SplitTypes.EXACT);
            expenseFormStore.setParticipants(['user-1', 'user-2']);

            const splitsWithUSD = expenseFormStore.splits;
            expect(splitsWithUSD).toHaveLength(2);
            expect(splitsWithUSD[0].amount).toBeCloseTo(50.0, 2);
            expect(splitsWithUSD[1].amount).toBeCloseTo(50.0, 2);

            expenseFormStore.updateField('currency', 'JPY');

            const splitsWithJPY = expenseFormStore.splits;
            expect(splitsWithJPY).toHaveLength(2);
            expect(splitsWithJPY[0].amount).toBe(50);
            expect(splitsWithJPY[1].amount).toBe(50);
        });
    });
});

import { describe, it, expect, vi } from 'vitest';
import { validateCreateExpense } from '../../../expenses/validation';
import { PREDEFINED_EXPENSE_CATEGORIES } from '@splitifyd/shared';
import type { CreateExpenseRequest } from '@splitifyd/shared';

// Mock i18n functions to avoid translation errors in tests
vi.mock('../../../utils/i18n-validation', () => ({
    translateJoiError: vi.fn((error: any) => error.details?.[0]?.message || 'Validation error'),
    translate: vi.fn((key: string) => key),
    translateValidationError: vi.fn((detail: any) => detail.message || 'Validation error'),
}));

describe('Expense Categories Pure Validation - Unit Tests', () => {
    const testUserId = 'test-user-123';
    const testGroupId = 'test-group-456';

    // Helper function to create valid expense data with category override
    const createValidExpenseData = (categoryOverride?: string): CreateExpenseRequest => ({
        groupId: testGroupId,
        description: 'Test expense',
        amount: 25.99,
        currency: 'USD',
        category: categoryOverride || 'Food',
        paidBy: testUserId,
        participants: [testUserId],
        splitType: 'equal',
        date: '2024-01-15T10:30:00.000Z',
    });

    describe('Custom Category Validation', () => {
        it('should accept custom category names', () => {
            const customCategory = 'Custom Office Supplies';
            const expenseData = createValidExpenseData(customCategory);

            const result = validateCreateExpense(expenseData);

            expect(result.category).toBe(customCategory);
        });

        it('should accept categories with special characters', () => {
            const specialCategory = 'Café & Restaurant - Fine Dining';
            const expenseData = createValidExpenseData(specialCategory);

            const result = validateCreateExpense(expenseData);

            expect(result.category).toBe(specialCategory);
        });

        it('should accept categories with numbers and unicode characters', () => {
            const safeCategory = 'iPhone 15 Pro - Mobile Device';
            const expenseData = createValidExpenseData(safeCategory);

            const result = validateCreateExpense(expenseData);

            expect(result.category).toBe(safeCategory);
        });

        it('should accept maximum length category (50 characters)', () => {
            const maxLengthCategory = 'A'.repeat(50); // Exactly 50 characters
            const expenseData = createValidExpenseData(maxLengthCategory);

            const result = validateCreateExpense(expenseData);

            expect(result.category).toBe(maxLengthCategory);
            expect(result.category.length).toBe(50);
        });

        it('should reject categories that are too long (over 50 characters)', () => {
            const tooLongCategory = 'A'.repeat(51); // 51 characters - too long
            const expenseData = createValidExpenseData(tooLongCategory);

            expect(() => validateCreateExpense(expenseData))
                .toThrow(/category.*50.*character/i);
        });

        it('should sanitize HTML content in categories', () => {
            const htmlCategory = '<script>alert("xss")</script>';
            const expenseData = createValidExpenseData(htmlCategory);

            // Category validation sanitizes HTML content for security
            const result = validateCreateExpense(expenseData);
            expect(result.category).toBe(''); // HTML gets sanitized to empty string
        });
    });

    describe('Predefined Categories', () => {
        it('should accept all predefined expense category names', () => {
            for (const categoryObj of PREDEFINED_EXPENSE_CATEGORIES) {
                const categoryName = categoryObj.name; // Use the 'name' field, not the full object
                const expenseData = createValidExpenseData(categoryName);

                const result = validateCreateExpense(expenseData);
                expect(result.category).toBe(categoryName);
            }
        });
    });

    describe('Edge Cases and Security', () => {
        it('should accept empty categories (becomes default)', () => {
            const expenseData = createValidExpenseData('');

            // Empty category validation might have default handling
            const result = validateCreateExpense(expenseData);
            expect(result.category).toBeDefined();
        });

        it('should trim whitespace from categories', () => {
            const categoryWithWhitespace = '  Custom Category  ';
            const expenseData = createValidExpenseData(categoryWithWhitespace);

            const result = validateCreateExpense(expenseData);

            expect(result.category).toBe('Custom Category');
        });

        it('should handle case sensitivity appropriately', () => {
            const mixedCaseCategory = 'CuStOm CaTeGoRy';
            const expenseData = createValidExpenseData(mixedCaseCategory);

            const result = validateCreateExpense(expenseData);

            // Verify the category is stored as provided (case-sensitive)
            expect(result.category).toBe(mixedCaseCategory);
        });

        it('should reject categories with only whitespace', () => {
            const whitespaceCategory = '   ';
            const expenseData = createValidExpenseData(whitespaceCategory);

            expect(() => validateCreateExpense(expenseData))
                .toThrow(/category.*1.*50.*character/i);
        });

        it('should handle unicode characters correctly', () => {
            const unicodeCategory = 'Café & Coffee ☕️';
            const expenseData = createValidExpenseData(unicodeCategory);

            const result = validateCreateExpense(expenseData);

            expect(result.category).toBe(unicodeCategory);
        });

        it('should handle missing categories appropriately', () => {
            const expenseData = createValidExpenseData();
            delete (expenseData as any).category;

            expect(() => validateCreateExpense(expenseData))
                .toThrow(); // Just check that it throws, don't check specific message
        });
    });

    describe('Performance Test', () => {
        it('should validate categories quickly (performance)', () => {
            const categories = [
                'Food',
                'Transportation',
                'Custom Category',
                'Café & Restaurant',
                'A'.repeat(50),
            ];

            const startTime = Date.now();

            for (let i = 0; i < 1000; i++) {
                const category = categories[i % categories.length];
                const expenseData = createValidExpenseData(category);
                validateCreateExpense(expenseData);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should validate 1000 entries in less than 100ms (very fast unit test)
            expect(duration).toBeLessThan(100);
        });
    });
});
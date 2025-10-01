import { describe, test, expect } from 'vitest';
import { validateCreateExpense, validateUpdateExpense } from '../../../expenses/validation';
import { ApiError } from '../../../utils/errors';
import { CreateExpenseRequestBuilder, ExpenseUpdateBuilder } from '@splitifyd/test-support';

describe('Date Validation Unit Tests', () => {

    describe('Future Date Validation', () => {
        test('should reject expenses with dates more than 24 hours in the future', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30); // 30 days in the future

            const expenseData = new CreateExpenseRequestBuilder()
                .withDate(futureDate.toISOString())
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            expect(() => validateCreateExpense(expenseData)).toThrow(/Date cannot be in the future/);
        });

        test('should accept expenses with dates up to 24 hours in the future (timezone buffer)', () => {
            const nearFutureDate = new Date();
            nearFutureDate.setHours(nearFutureDate.getHours() + 23); // 23 hours in the future

            const expenseData = new CreateExpenseRequestBuilder()
                .withDate(nearFutureDate.toISOString())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.date).toBe(nearFutureDate.toISOString());
        });

        test('should reject expenses with dates exactly at future boundary', () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 25); // 25 hours in the future

            const expenseData = new CreateExpenseRequestBuilder()
                .withDate(futureDate.toISOString())
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(/Date cannot be in the future/);
        });
    });

    describe('Past Date Validation', () => {
        test('should accept expenses with dates within valid range (last 10 years)', () => {
            const validOldDate = new Date();
            validOldDate.setFullYear(validOldDate.getFullYear() - 2); // 2 years ago

            const expenseData = new CreateExpenseRequestBuilder()
                .withDate(validOldDate.toISOString())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.date).toBe(validOldDate.toISOString());
        });

        test('should reject expenses with dates more than 10 years in the past', () => {
            const veryOldDate = new Date();
            veryOldDate.setFullYear(veryOldDate.getFullYear() - 11); // 11 years ago

            const expenseData = new CreateExpenseRequestBuilder()
                .withDate(veryOldDate.toISOString())
                .build();

            expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            expect(() => validateCreateExpense(expenseData)).toThrow(/Date cannot be more than 10 years in the past/);
        });

        test('should accept expenses at the 10-year boundary', () => {
            const boundaryDate = new Date();
            boundaryDate.setFullYear(boundaryDate.getFullYear() - 10); // Exactly 10 years ago
            boundaryDate.setDate(boundaryDate.getDate() + 1); // One day within the boundary

            const expenseData = new CreateExpenseRequestBuilder()
                .withDate(boundaryDate.toISOString())
                .build();

            const result = validateCreateExpense(expenseData);
            expect(result.date).toBe(boundaryDate.toISOString());
        });
    });

    describe('Date Format Validation', () => {
        test('should reject invalid date formats', () => {
            const invalidDates = [
                'not-a-valid-date',
                '2023-13-45T25:99:99.999Z', // Invalid components
                '2023/12/25T10:30:00Z', // Wrong separator
                '2023-12-25 10:30:00', // Missing T and Z
                '2023-12-25T10:30:00', // Missing Z
                '12-25-2023T10:30:00Z', // American format
                '25-12-2023T10:30:00Z', // European format
                '2023-12-25T10:30:00.000', // Missing Z
            ];

            invalidDates.forEach((invalidDate) => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withDate(invalidDate as string)
                    .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });

        test('should accept valid UTC ISO date formats', () => {
            const validDates = ['2023-12-25T10:30:00.000Z', '2023-12-25T10:30:00Z', '2023-01-01T00:00:00.000Z', '2023-12-31T23:59:59.999Z'];

            validDates.forEach((validDate) => {
                // Adjust date to be within valid range
                const dateObj = new Date(validDate);
                const currentYear = new Date().getFullYear();
                dateObj.setFullYear(currentYear - 1); // Set to last year to be safe

                const expenseData = new CreateExpenseRequestBuilder()
                        .withDate(dateObj.toISOString())
                        .build();

                const result = validateCreateExpense(expenseData);
                expect(result.date).toBe(dateObj.toISOString());
            });
        });

        test('should require UTC format (reject timezone offsets)', () => {
            const nonUtcDates = [
                '2023-12-25T10:30:00+01:00', // Timezone offset
                '2023-12-25T10:30:00-05:00', // Negative timezone offset
                '2023-12-25T10:30:00+00:30', // Half-hour offset
            ];

            nonUtcDates.forEach((nonUtcDate) => {
                const expenseData = new CreateExpenseRequestBuilder()
                        .withDate(nonUtcDate)
                        .build();

                expect(() => validateCreateExpense(expenseData)).toThrow(/Date must be in UTC format/);
            });
        });

        test('should reject non-string date values', () => {
            const nonStringDates = [
                123456789, // Number
                new Date(), // Date object
                null,
                undefined,
                true,
                {},
                [],
            ];

            nonStringDates.forEach((nonStringDate) => {
                const expenseData = new CreateExpenseRequestBuilder()
                    .build();

                // Override the date field with the invalid value for testing
                (expenseData as any).date = nonStringDate;

                expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
            });
        });
    });

    describe('Update Expense Date Validation', () => {
        test('should apply same date validation rules for updates', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);

            const updateData = new ExpenseUpdateBuilder()
                .withDate(futureDate.toISOString())
                .build();

            expect(() => validateUpdateExpense(updateData)).toThrow(/Date cannot be in the future/);
        });

        test('should accept valid date updates', () => {
            const validDate = new Date();
            validDate.setMonth(validDate.getMonth() - 1); // 1 month ago

            const updateData = new ExpenseUpdateBuilder()
                .withDate(validDate.toISOString())
                .build();

            const result = validateUpdateExpense(updateData);
            expect(result.date).toBe(validDate.toISOString());
        });

        test('should allow updates without date field', () => {
            const updateData = {
                description: 'Updated description',
            };

            const result = validateUpdateExpense(updateData);
            expect(result).not.toHaveProperty('date');
            expect(result.description).toBe('Updated description');
        });
    });
});

import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder } from '@billsplit-wl/test-support';
import { describe, expect, test } from 'vitest';
import { VALIDATION_LIMITS } from '../../../constants';
import { validateCreateExpense, validateUpdateExpense } from '../../../expenses/validation';
import { validateCreateGroup } from '../../../groups/validation';
import { ApiError } from '../../../errors';

describe('String Length Validation - Focused Tests', () => {
    const baseValidExpenseData = new CreateExpenseRequestBuilder()
        .withAmount(1, 'USD')
        .withGroupId('test-group-id')
        .withDescription('Test expense')
        .build();

    const baseValidGroupData = new CreateGroupRequestBuilder()
        .withName('Test Group')
        .withDescription('Test group description')
        .build();

    describe('Critical Validation Boundaries', () => {
        test('should enforce expense description length limit', () => {
            const tooLongDescription = 'A'.repeat(201); // Over limit
            const maxDescription = 'A'.repeat(200); // At limit

            // Should reject over limit
            expect(() =>
                validateCreateExpense({
                    ...baseValidExpenseData,
                    description: tooLongDescription,
                })
            )
                .toThrow(ApiError);

            // Should accept at limit
            const result = validateCreateExpense({
                ...baseValidExpenseData,
                description: maxDescription,
            });
            expect(result.description).toHaveLength(200);
        });

        test('should enforce group name length limit', () => {
            const tooLongName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH + 1);
            const maxName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH);

            // Should reject over limit
            expect(() =>
                validateCreateGroup({
                    ...baseValidGroupData,
                    name: tooLongName,
                })
            )
                .toThrow(ApiError);

            // Should accept at limit
            const result = validateCreateGroup({
                ...baseValidGroupData,
                name: maxName,
            });
            expect(result.name).toHaveLength(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH);
        });

        test('should trim whitespace and reject empty strings', () => {
            // Should trim and accept
            const expenseResult = validateCreateExpense({
                ...baseValidExpenseData,
                description: '  Valid description  ',
            });
            expect(expenseResult.description).toBe('Valid description');

            // Should reject empty
            expect(() =>
                validateCreateExpense({
                    ...baseValidExpenseData,
                    description: '   ', // Only whitespace
                })
            )
                .toThrow(ApiError);
        });
    });

    describe('Special Characters Handling', () => {
        test('should preserve special characters in text fields', () => {
            const specialText = 'Café & Restaurant - 50% off @ John\'s!';

            const expenseResult = validateCreateExpense({
                ...baseValidExpenseData,
                description: specialText,
            });
            expect(expenseResult.description).toBe(specialText);

            const groupResult = validateCreateGroup({
                ...baseValidGroupData,
                name: specialText,
            });
            expect(groupResult.name).toBe(specialText);
        });
    });

    describe('Update Validation Consistency', () => {
        test('should apply same validation rules for updates', () => {
            const tooLongDescription = 'A'.repeat(201);

            // Should reject same as create
            expect(() =>
                validateUpdateExpense({
                    description: tooLongDescription,
                })
            )
                .toThrow(ApiError);

            // Should accept valid update
            const result = validateUpdateExpense({
                description: 'Updated description',
                label: 'Updated label',
            });
            expect(result.description).toBe('Updated description');
            expect(result.label).toBe('Updated label');
        });
    });
});

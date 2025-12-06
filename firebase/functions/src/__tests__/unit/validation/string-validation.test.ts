import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, ExpenseUpdateBuilder } from '@billsplit-wl/test-support';
import { describe, expect, test } from 'vitest';
import { VALIDATION_LIMITS } from '../../../constants';
import { ApiError } from '../../../errors';
import { validateCreateExpense, validateUpdateExpense } from '../../../expenses/validation';
import { validateCreateGroup } from '../../../groups/validation';

describe('String Length Validation - Focused Tests', () => {
    const createBaseExpenseBuilder = () =>
        new CreateExpenseRequestBuilder()
            .withAmount(1, 'USD')
            .withGroupId('test-group-id')
            .withDescription('Test expense');

    const createBaseGroupBuilder = () =>
        new CreateGroupRequestBuilder()
            .withName('Test Group')
            .withDescription('Test group description');

    describe('Critical Validation Boundaries', () => {
        test('should enforce expense description length limit', () => {
            const tooLongDescription = 'A'.repeat(201); // Over limit
            const maxDescription = 'A'.repeat(200); // At limit

            // Should reject over limit
            expect(() =>
                validateCreateExpense(
                    createBaseExpenseBuilder()
                        .withDescription(tooLongDescription)
                        .build(),
                )
            )
                .toThrow(ApiError);

            // Should accept at limit
            const result = validateCreateExpense(
                createBaseExpenseBuilder()
                    .withDescription(maxDescription)
                    .build(),
            );
            expect(result.description).toHaveLength(200);
        });

        test('should enforce group name length limit', () => {
            const tooLongName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH + 1);
            const maxName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH);

            // Should reject over limit
            expect(() =>
                validateCreateGroup(
                    createBaseGroupBuilder()
                        .withName(tooLongName)
                        .build(),
                )
            )
                .toThrow(ApiError);

            // Should accept at limit
            const result = validateCreateGroup(
                createBaseGroupBuilder()
                    .withName(maxName)
                    .build(),
            );
            expect(result.name).toHaveLength(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH);
        });

        test('should trim whitespace and reject empty strings', () => {
            // Should trim and accept
            const expenseResult = validateCreateExpense(
                createBaseExpenseBuilder()
                    .withDescription('  Valid description  ')
                    .build(),
            );
            expect(expenseResult.description).toBe('Valid description');

            // Should reject empty
            expect(() =>
                validateCreateExpense(
                    createBaseExpenseBuilder()
                        .withDescription('   ') // Only whitespace
                        .build(),
                )
            )
                .toThrow(ApiError);
        });
    });

    describe('Special Characters Handling', () => {
        test('should preserve special characters in text fields', () => {
            const specialText = 'Café & Restaurant - 50% off @ John\'s!';

            const expenseResult = validateCreateExpense(
                createBaseExpenseBuilder()
                    .withDescription(specialText)
                    .build(),
            );
            expect(expenseResult.description).toBe(specialText);

            const groupResult = validateCreateGroup(
                createBaseGroupBuilder()
                    .withName(specialText)
                    .build(),
            );
            expect(groupResult.name).toBe(specialText);
        });
    });

    describe('Update Validation Consistency', () => {
        test('should apply same validation rules for updates', () => {
            const tooLongDescription = 'A'.repeat(201);

            // Should reject same as create
            expect(() =>
                validateUpdateExpense(
                    ExpenseUpdateBuilder
                        .minimal()
                        .withDescription(tooLongDescription)
                        .build(),
                )
            )
                .toThrow(ApiError);

            // Should accept valid update
            const result = validateUpdateExpense(
                ExpenseUpdateBuilder
                    .minimal()
                    .withDescription('Updated description')
                    .withLabel('Updated label')
                    .build(),
            );
            expect(result.description).toBe('Updated description');
            expect(result.label).toBe('Updated label');
        });
    });
});

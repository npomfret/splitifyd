import { validateCreateExpense, validateUpdateExpense } from '../../../expenses/validation';
import { validateCreateGroup, validateUpdateGroup } from '../../../groups/validation';
import { ApiError } from '../../../utils/errors';
import { VALIDATION_LIMITS } from '../../../constants';

describe('String Length Validation Unit Tests', () => {
    const baseValidExpenseData = {
        groupId: 'test-group-id',
        paidBy: 'test-user-id',
        amount: 50.00,
        currency: 'USD',
        description: 'Test expense',
        category: 'Food',
        date: new Date().toISOString(),
        splitType: 'equal',
        participants: ['test-user-id'],
    };

    const baseValidGroupData = {
        name: 'Test Group',
        description: 'Test group description',
    };

    describe('Expense Description Validation', () => {
        test('should reject expense descriptions that exceed maximum length (200 chars)', () => {
            const longDescription = 'A'.repeat(201); // 201 characters

            const expenseData = {
                ...baseValidExpenseData,
                description: longDescription,
            };

            expect(() => validateCreateExpense(expenseData))
                .toThrow(ApiError);
        });

        test('should accept expense descriptions at maximum length (200 chars)', () => {
            const maxLengthDescription = 'A'.repeat(200); // Exactly 200 characters

            const expenseData = {
                ...baseValidExpenseData,
                description: maxLengthDescription,
            };

            const result = validateCreateExpense(expenseData);
            expect(result.description).toBe(maxLengthDescription);
            expect(result.description.length).toBe(200);
        });

        test('should accept expense descriptions within length limits', () => {
            const validDescription = 'A'.repeat(150); // Well within limits

            const expenseData = {
                ...baseValidExpenseData,
                description: validDescription,
            };

            const result = validateCreateExpense(expenseData);
            expect(result.description).toBe(validDescription);
            expect(result.description.length).toBe(150);
        });

        test('should reject empty expense descriptions', () => {
            const expenseData = {
                ...baseValidExpenseData,
                description: '',
            };

            expect(() => validateCreateExpense(expenseData))
                .toThrow(ApiError);
        });

        test('should reject whitespace-only descriptions', () => {
            const expenseData = {
                ...baseValidExpenseData,
                description: '   ', // Only whitespace
            };

            expect(() => validateCreateExpense(expenseData))
                .toThrow(ApiError);
        });

        test('should trim whitespace from descriptions', () => {
            const expenseData = {
                ...baseValidExpenseData,
                description: '  Valid description  ',
            };

            const result = validateCreateExpense(expenseData);
            expect(result.description).toBe('Valid description');
        });
    });

    describe('Expense Category Validation', () => {
        test('should reject categories that exceed maximum length (50 chars)', () => {
            const longCategory = 'A'.repeat(51); // 51 characters

            const expenseData = {
                ...baseValidExpenseData,
                category: longCategory,
            };

            expect(() => validateCreateExpense(expenseData))
                .toThrow(ApiError);
        });

        test('should accept categories at maximum length (50 chars)', () => {
            const maxLengthCategory = 'A'.repeat(50); // Exactly 50 characters

            const expenseData = {
                ...baseValidExpenseData,
                category: maxLengthCategory,
            };

            const result = validateCreateExpense(expenseData);
            expect(result.category).toBe(maxLengthCategory);
            expect(result.category.length).toBe(50);
        });

        test('should reject empty categories', () => {
            const expenseData = {
                ...baseValidExpenseData,
                category: '',
            };

            expect(() => validateCreateExpense(expenseData))
                .toThrow(ApiError);
        });

        test('should accept custom category names', () => {
            const customCategories = [
                'Custom Category',
                'business-lunch',
                'team-outing',
                'Food & Drinks',
                'Travel/Transport',
            ];

            customCategories.forEach(category => {
                const expenseData = {
                    ...baseValidExpenseData,
                    category,
                };

                const result = validateCreateExpense(expenseData);
                expect(result.category).toBe(category);
            });
        });
    });

    describe('Group Name Validation', () => {
        test('should reject group names that exceed maximum length', () => {
            const longGroupName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH + 1);

            const groupData = {
                ...baseValidGroupData,
                name: longGroupName,
            };

            expect(() => validateCreateGroup(groupData))
                .toThrow(ApiError);
        });

        test('should accept group names at maximum length', () => {
            const maxLengthGroupName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH);

            const groupData = {
                ...baseValidGroupData,
                name: maxLengthGroupName,
            };

            const result = validateCreateGroup(groupData);
            expect(result.name).toBe(maxLengthGroupName);
            expect(result.name.length).toBe(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH);
        });

        test('should reject empty group names', () => {
            const groupData = {
                ...baseValidGroupData,
                name: '',
            };

            expect(() => validateCreateGroup(groupData))
                .toThrow(ApiError);
        });

        test('should reject whitespace-only group names', () => {
            const groupData = {
                ...baseValidGroupData,
                name: '   ',
            };

            expect(() => validateCreateGroup(groupData))
                .toThrow(ApiError);
        });

        test('should trim whitespace from group names', () => {
            const groupData = {
                ...baseValidGroupData,
                name: '  Valid Group Name  ',
            };

            const result = validateCreateGroup(groupData);
            expect(result.name).toBe('Valid Group Name');
        });
    });

    describe('Group Description Validation', () => {
        test('should reject group descriptions that exceed maximum length', () => {
            const longDescription = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH + 1);

            const groupData = {
                ...baseValidGroupData,
                description: longDescription,
            };

            expect(() => validateCreateGroup(groupData))
                .toThrow(ApiError);
        });

        test('should accept group descriptions at maximum length', () => {
            const maxLengthDescription = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH);

            const groupData = {
                ...baseValidGroupData,
                description: maxLengthDescription,
            };

            const result = validateCreateGroup(groupData);
            expect(result.description).toBe(maxLengthDescription);
            expect(result.description!.length).toBe(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH);
        });

        test('should accept empty group descriptions', () => {
            const groupData = {
                name: 'Test Group',
                description: '',
            };

            const result = validateCreateGroup(groupData);
            expect(result.description).toBe('');
        });

        test('should accept missing group descriptions', () => {
            const groupData = {
                name: 'Test Group',
            };

            const result = validateCreateGroup(groupData);
            expect(result).not.toHaveProperty('description');
        });
    });

    describe('Update Validation', () => {
        test('should apply same string length rules for expense updates', () => {
            const longDescription = 'A'.repeat(201);

            const updateData = {
                description: longDescription,
            };

            expect(() => validateUpdateExpense(updateData))
                .toThrow(ApiError);
        });

        test('should apply same string length rules for group updates', () => {
            const longName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH + 1);

            const updateData = {
                name: longName,
            };

            expect(() => validateUpdateGroup(updateData))
                .toThrow(ApiError);
        });

        test('should accept valid string updates', () => {
            const validDescription = 'Updated description';
            const validCategory = 'Updated category';

            const updateData = {
                description: validDescription,
                category: validCategory,
            };

            const result = validateUpdateExpense(updateData);
            expect(result.description).toBe(validDescription);
            expect(result.category).toBe(validCategory);
        });
    });

    describe('Special Characters in Strings', () => {
        test('should handle basic special characters in descriptions', () => {
            const specialCharDescription = 'Café & Restaurant - 50% off!';

            const expenseData = {
                ...baseValidExpenseData,
                description: specialCharDescription,
            };

            const result = validateCreateExpense(expenseData);
            expect(result.description).toContain('Café');
            expect(result.description).toContain('&');
            expect(result.description).toContain('%');
        });

        test('should handle punctuation and symbols in group names', () => {
            const specialCharName = "John's Travel Group - 2024!";

            const groupData = {
                ...baseValidGroupData,
                name: specialCharName,
            };

            const result = validateCreateGroup(groupData);
            expect(result.name).toContain("John's");
            expect(result.name).toContain('-');
            expect(result.name).toContain('2024!');
        });
    });
});
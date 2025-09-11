import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { borrowTestUsers } from '@splitifyd/test-support/test-pool-helpers';
import { CreateExpenseRequestBuilder, ApiDriver, TestGroupManager } from '@splitifyd/test-support';
import { PREDEFINED_EXPENSE_CATEGORIES } from '@splitifyd/shared';
import { UserToken } from '@splitifyd/shared';

describe('Freeform Categories API Integration', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;

    let users: UserToken[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 3 });
    });

    describe('Expense Creation with Custom Categories', () => {
        test('should create expense with custom category name', async () => {
            const uniqueId = uuidv4().slice(0, 8);
            const customCategory = `Custom Office Supplies ${uniqueId}`;
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription(`Pens and notebooks ${uniqueId}`)
                .withAmount(25.99)
                .withCategory(customCategory)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);

            expect(response.category).toBe(customCategory);
            expect(response.description).toBe(`Pens and notebooks ${uniqueId}`);
            expect(response.amount).toBe(25.99);
        });

        test('should create expense with category containing special characters', async () => {
            const specialCategory = 'Café & Restaurant - Fine Dining';
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Business lunch')
                .withAmount(75.5)
                .withCategory(specialCategory)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);

            expect(response.category).toBe(specialCategory);
            expect(response.description).toBe('Business lunch');
        });

        test('should create expense with category containing numbers and safe unicode characters', async () => {
            const safeCategory = 'iPhone 15 Pro - Mobile Device';
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('New phone')
                .withAmount(999.0)
                .withCategory(safeCategory)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);

            expect(response.category).toBe(safeCategory);
            expect(response.amount).toBe(999.0);
        });

        test('should create expense with maximum length category (50 characters)', async () => {
            const maxLengthCategory = 'A'.repeat(50); // Exactly 50 characters
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Test expense')
                .withAmount(10.0)
                .withCategory(maxLengthCategory)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);

            expect(response.category).toBe(maxLengthCategory);
            expect(response.category).toHaveLength(50);
        });
    });

    describe('Category Validation Edge Cases', () => {
        test('should reject expense with category exceeding 50 characters', async () => {
            const tooLongCategory = 'A'.repeat(51); // 51 characters
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Test expense')
                .withAmount(10.0)
                .withCategory(tooLongCategory)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/between 1 and 50 characters|INVALID_CATEGORY/i);
        });

        test('should reject expense with empty category', async () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Test expense')
                .withAmount(10.0)
                .withCategory('')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/between 1 and 50 characters|INVALID_CATEGORY/i);
        });

        test('should reject expense with whitespace-only category', async () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Test expense')
                .withAmount(10.0)
                .withCategory('   ')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/between 1 and 50 characters|INVALID_CATEGORY/i);
        });
    });

    describe('Expense Updates with Custom Categories', () => {
        test('should update expense from predefined to custom category', async () => {
            // Create expense with predefined category
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Dinner')
                .withAmount(45.0)
                .withCategory('food')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);
            expect(createdExpense.category).toBe('food');

            // Update to custom category
            const customCategory = 'Gourmet Restaurant Experience';
            await apiDriver.updateExpense(
                createdExpense.id,
                {
                    category: customCategory,
                },
                users[0].token,
            );

            // Fetch the updated expense to verify the changes
            const updatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);

            expect(updatedExpense.category).toBe(customCategory);
            expect(updatedExpense.description).toBe('Dinner'); // Other fields unchanged
        });

        test('should update expense from custom to predefined category', async () => {
            // Create expense with custom category
            const customCategory = 'Custom Business Expense';
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Office supplies')
                .withAmount(35.0)
                .withCategory(customCategory)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);
            expect(createdExpense.category).toBe(customCategory);

            // Update to predefined category
            await apiDriver.updateExpense(
                createdExpense.id,
                {
                    category: 'shopping',
                },
                users[0].token,
            );

            // Fetch the updated expense to verify the changes
            const updatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);

            expect(updatedExpense.category).toBe('shopping');
            expect(updatedExpense.description).toBe('Office supplies');
        });

        test('should update expense between different custom categories', async () => {
            // Create expense with first custom category
            const firstCategory = 'Home Improvement - Kitchen';
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Kitchen renovation')
                .withAmount(150.0)
                .withCategory(firstCategory)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);
            expect(createdExpense.category).toBe(firstCategory);

            // Update to second custom category
            const secondCategory = 'Home Improvement - Bathroom';
            await apiDriver.updateExpense(
                createdExpense.id,
                {
                    category: secondCategory,
                },
                users[0].token,
            );

            // Fetch the updated expense to verify the changes
            const updatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);

            expect(updatedExpense.category).toBe(secondCategory);
            expect(updatedExpense.amount).toBe(150.0);
        });

        test('should still accept predefined categories', async () => {
            const predefinedCategories = PREDEFINED_EXPENSE_CATEGORIES.map((cat) => cat.name).slice(0, 3); // just try some of them

            for (const category of predefinedCategories) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(`Test ${category}`)
                    .withAmount(20.0)
                    .withCategory(category)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .withSplitType('equal')
                    .build();

                const response = await apiDriver.createExpense(expenseData, users[0].token);

                expect(response.category).toBe(category);
                expect(response.description).toBe(`Test ${category}`);
            }
        });
    });

    describe('Category Security and Sanitization', () => {
        test('should reject categories with potential HTML content for security', async () => {
            const categoryWithHtml = '<script>alert("xss")</script>Office Supplies';
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Test security')
                .withAmount(10.0)
                .withCategory(categoryWithHtml)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            // XSS content should be rejected entirely
            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/400|invalid|dangerous/i);
        });

        test('should handle categories with special SQL-like characters', async () => {
            const sqlLikeCategory = "'; DROP TABLE expenses; --";
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Test SQL-like input')
                .withAmount(10.0)
                .withCategory(sqlLikeCategory)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            // Should be safely stored without causing database issues
            const response = await apiDriver.createExpense(expenseData, users[0].token);

            expect(response.category).toBe(sqlLikeCategory);
            expect(response.amount).toBe(10.0);
        });
    });
});

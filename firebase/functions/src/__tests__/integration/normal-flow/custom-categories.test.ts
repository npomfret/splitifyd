
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '@splitifyd/test-support';
import { ExpenseBuilder, UserBuilder } from '@splitifyd/test-support';
import { PREDEFINED_EXPENSE_CATEGORIES } from '@splitifyd/shared';

describe('Custom Categories Feature Tests', () => {
    let driver: ApiDriver;
    let users: User[] = [];
    let testGroup: any;

    beforeAll(async () => {

        driver = new ApiDriver();
        users = await Promise.all([driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build())]);
    });


    beforeEach(async () => {
        const groupId = uuidv4();
        testGroup = await driver.createGroupWithMembers(`Test Group ${groupId}`, users, users[0].token);
    });

    describe('Custom Category Acceptance', () => {
        test('should accept custom category names', async () => {
            const customCategories = ['Books & Magazines', 'Home Improvement', 'Pet Care', 'Gym Membership', 'Professional Development'];

            for (const category of customCategories) {
                const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withCategory(category).withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).build();

                const response = await driver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                const createdExpense = await driver.getExpense(response.id, users[0].token);
                expect(createdExpense.category).toBe(category);
            }
        });

        test('should accept categories that were previously invalid', async () => {
            const previouslyInvalidCategories = [
                'invalid-category-name',
                'FOOD', // uppercase
                'Custom-Category-123',
            ];

            for (const category of previouslyInvalidCategories) {
                const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withCategory(category).withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).build();

                const response = await driver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                const createdExpense = await driver.getExpense(response.id, users[0].token);
                expect(createdExpense.category).toBe(category);
            }
        });

        test('should still enforce length limits', async () => {
            const tooLongCategory = 'A'.repeat(51); // 51 characters

            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withCategory(tooLongCategory).withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).build();

            await expect(driver.createExpense(expenseData, users[0].token)).rejects.toThrow(/category.*50.*characters|INVALID_CATEGORY/i);
        });

        test('should accept maximum length categories', async () => {
            const maxLengthCategory = 'A'.repeat(50); // 50 characters

            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withCategory(maxLengthCategory).withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).build();

            const response = await driver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            const createdExpense = await driver.getExpense(response.id, users[0].token);
            expect(createdExpense.category).toBe(maxLengthCategory);
        });

        test('should allow updating to custom categories', async () => {
            // Create expense with predefined category
            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withCategory('food').withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).build();

            const createResponse = await driver.createExpense(expenseData, users[0].token);

            // Update to custom category
            const customCategory = 'Fine Dining & Wine Tasting';
            await driver.updateExpense(createResponse.id, { category: customCategory }, users[0].token);

            const updatedExpense = await driver.getExpense(createResponse.id, users[0].token);
            expect(updatedExpense.category).toBe(customCategory);
        });
    });

    describe('Backward Compatibility', () => {
        test('should still accept all predefined categories', async () => {
            const predefinedCategories = PREDEFINED_EXPENSE_CATEGORIES.map((cat) => cat.name);

            for (const category of predefinedCategories) {
                const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withCategory(category).withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).build();

                const response = await driver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                const createdExpense = await driver.getExpense(response.id, users[0].token);
                expect(createdExpense.category).toBe(category);
            }
        });
    });
});

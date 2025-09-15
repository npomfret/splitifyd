import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { borrowTestUsers, generateShortId } from '@splitifyd/test-support';
import { ApiDriver, CreateExpenseRequestBuilder, TestGroupManager } from '@splitifyd/test-support';
import { UserToken } from '@splitifyd/shared';

describe('Custom Categories Feature Tests', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;

    let users: UserToken[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 3 });
    });

    describe('Custom Category Acceptance', () => {
        test('should accept custom category names', async () => {
            const uniqueId = generateShortId();
            const customCategories = ['Books & Magazines', 'Home Improvement', 'Pet Care', 'Gym Membership', 'Professional Development'];

            for (const category of customCategories) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withCategory(category)
                    .withDescription(`${category} expense ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build();

                const response = await apiDriver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
                expect(createdExpense.category).toBe(category);
            }
        });

        test('should accept categories that were previously invalid', async () => {
            const uniqueId = generateShortId();
            const previouslyInvalidCategories = [
                'invalid-category-name',
                'FOOD', // uppercase
                'Custom-Category-123',
            ];

            for (const category of previouslyInvalidCategories) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withCategory(category)
                    .withDescription(`${category} expense ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build();

                const response = await apiDriver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
                expect(createdExpense.category).toBe(category);
            }
        });

        test('should still enforce length limits', async () => {
            const uniqueId = generateShortId();
            const tooLongCategory = 'A'.repeat(51); // 51 characters

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withCategory(tooLongCategory)
                .withDescription(`Long category test ${uniqueId}`)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/category.*50.*characters|INVALID_CATEGORY/i);
        });

        test('should accept maximum length categories', async () => {
            const uniqueId = generateShortId();
            const maxLengthCategory = 'A'.repeat(50); // 50 characters

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withCategory(maxLengthCategory)
                .withDescription(`Max length category test ${uniqueId}`)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
            expect(createdExpense.category).toBe(maxLengthCategory);
        });

        test('should allow updating to custom categories', async () => {
            const uniqueId = generateShortId();
            // Create expense with predefined category
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withCategory('food')
                .withDescription(`Update category test ${uniqueId}`)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createResponse = await apiDriver.createExpense(expenseData, users[0].token);

            // Update to custom category
            const customCategory = 'Fine Dining & Wine Tasting';
            await apiDriver.updateExpense(createResponse.id, { category: customCategory }, users[0].token);

            const updatedExpense = await apiDriver.getExpense(createResponse.id, users[0].token);
            expect(updatedExpense.category).toBe(customCategory);
        });
    });
});

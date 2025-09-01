// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, borrowTestUsers, ExpenseBuilder, User} from '@splitifyd/test-support';

describe('Expense Management', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);
        testGroup = await apiDriver.createGroupWithMembers(`Test Group ${uuidv4()}`, users, users[0].token);
    });

    describe('Expense Creation', () => {
        test('should add an expense to the group', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withParticipants(users.map((u) => u.uid))
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();
            const createdExpense = { id: response.id, ...expenseData };

            // Verify the expense was created by fetching it
            const fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(fetchedExpense.description).toBe(expenseData.description);
            expect(fetchedExpense.amount).toBe(expenseData.amount);
            expect(fetchedExpense.paidBy).toBe(users[0].uid);
        });

        test('should add an expense with an unequal split', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Unequal Split Expense')
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants(users.map((u) => u.uid))
                .withSplits([
                    { userId: users[0].uid, amount: 80 },
                    { userId: users[1].uid, amount: 20 },
                ])
                .withCategory('utilities')
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            // Verify the expense was created correctly with unequal splits
            const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
            expect(createdExpense.amount).toBe(100);
            expect(createdExpense.splitType).toBe('exact');
            expect(createdExpense.splits).toHaveLength(2);
            const user0Split = createdExpense.splits.find((s: any) => s.userId === users[0].uid);
            const user1Split = createdExpense.splits.find((s: any) => s.userId === users[1].uid);
            expect(user0Split?.amount).toBe(80);
            expect(user1Split?.amount).toBe(20);

            // Verify the splits add up to the total amount
            const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBe(100);
        });

        test("should list all of a group's expenses", async () => {
            // Add multiple expenses
            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withParticipants(users.map((u) => u.uid))
                    .withDescription('First Test Expense')
                    .build(),
                users[0].token,
            );

            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(50)
                    .withPaidBy(users[1].uid)
                    .withParticipants(users.map((u) => u.uid))
                    .withDescription('Second Test Expense')
                    .build(),
                users[1].token,
            );

            const response = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            expect(response).toHaveProperty('expenses');
            expect(Array.isArray(response.expenses)).toBe(true);
            expect(response.expenses.length).toBe(2);
            const expenseDescriptions = response.expenses.map((e: any) => e.description);
            expect(expenseDescriptions).toContain('First Test Expense');
            expect(expenseDescriptions).toContain('Second Test Expense');
        });
    });

    describe('Expense Updates', () => {
        test('should update an expense', async () => {
            const initialExpenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants(users.map((u) => u.uid))
                .build();
            const createdExpense = await apiDriver.createExpense(initialExpenseData, users[0].token);

            const updatedData = {
                description: 'Updated Test Expense',
                amount: 150.5,
                category: 'food',
            };

            // Use PUT for updates, passing the expense ID in the query
            await apiDriver.updateExpense(createdExpense.id, updatedData, users[0].token);

            const fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);

            expect(fetchedExpense.description).toBe(updatedData.description);
            expect(fetchedExpense.amount).toBe(updatedData.amount);
            expect(fetchedExpense.category).toBe(updatedData.category);
        });

        test('should recalculate splits when amount is updated with exact split type', async () => {
            // Create a new expense specifically for this test
            const testExpenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Split Recalculation Test')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants(users.map((u) => u.uid))
                .build();

            const createResponse = await apiDriver.createExpense(testExpenseData, users[0].token);
            expect(createResponse.id).toBeDefined();

            // Fetch the created expense to verify initial splits
            const initialExpense = await apiDriver.getExpense(createResponse.id, users[0].token);
            expect(initialExpense.amount).toBe(100);
            expect(initialExpense.splits).toHaveLength(2);
            expect(initialExpense.splits[0].amount).toBe(50);
            expect(initialExpense.splits[1].amount).toBe(50);

            // Update only the amount
            const updatedData = {
                amount: 150.5,
            };

            await apiDriver.updateExpense(createResponse.id, updatedData, users[0].token);

            // Fetch the updated expense to verify splits were recalculated
            const updatedExpense = await apiDriver.getExpense(createResponse.id, users[0].token);

            expect(updatedExpense.amount).toBe(150.5);
            expect(updatedExpense.splits).toHaveLength(2);
            expect(updatedExpense.splits[0].amount).toBe(75.25);
            expect(updatedExpense.splits[1].amount).toBe(75.25);

            // Verify that the total of splits equals the new amount
            const totalSplits = updatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBe(150.5);
        });

        test('should recalculate splits when amount is updated with exact split type', async () => {
            // Create an expense with exact splits
            const testExpenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Exact Split Test')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants(users.map((u) => u.uid))
                .withSplits([
                    { userId: users[0].uid, amount: 60 },
                    { userId: users[1].uid, amount: 40 },
                ])
                .build();

            const createResponse = await apiDriver.createExpense(testExpenseData, users[0].token);
            expect(createResponse.id).toBeDefined();

            // Fetch the created expense to verify initial splits
            const initialExpense = await apiDriver.getExpense(createResponse.id, users[0].token);
            expect(initialExpense.amount).toBe(100);
            expect(initialExpense.splits).toHaveLength(2);
            const user0Split = initialExpense.splits.find((s: any) => s.userId === users[0].uid);
            const user1Split = initialExpense.splits.find((s: any) => s.userId === users[1].uid);
            expect(user0Split?.amount).toBe(60);
            expect(user1Split?.amount).toBe(40);

            // Update only the amount - should revert to equal splits since no new splits provided
            const updatedData = {
                amount: 150,
            };

            await apiDriver.updateExpense(createResponse.id, updatedData, users[0].token);

            // Fetch the updated expense to verify splits were recalculated to equal
            const updatedExpense = await apiDriver.getExpense(createResponse.id, users[0].token);

            expect(updatedExpense.amount).toBe(150);
            expect(updatedExpense.splits).toHaveLength(2);
            expect(updatedExpense.splits[0].amount).toBe(75);
            expect(updatedExpense.splits[1].amount).toBe(75);

            // Verify that the total of splits equals the new amount
            const totalSplits = updatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBe(150);
        });
    });

    describe('Expense Deletion', () => {
        test('should delete an expense', async () => {
            // First, create an expense to be deleted
            const expenseToDeleteData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('To be deleted')
                .withAmount(50)
                .withPaidBy(users[1].uid)
                .withParticipants(users.map((u) => u.uid))
                .build();
            const createdExpense = await apiDriver.createExpense(expenseToDeleteData, users[1].token);
            expect(createdExpense.id).toBeDefined();

            // Now, delete it
            await apiDriver.deleteExpense(createdExpense.id, users[1].token);

            // Verify it's gone
            await expect(apiDriver.getExpense(createdExpense.id, users[1].token)).rejects.toThrow(/status 404/);
        });
    });
});
// Comprehensive expense management API integration tests
// Consolidates tests from expense-management.test.ts, edit-expense.test.ts, ExpenseService.integration.test.ts

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, ExpenseBuilder, borrowTestUsers, TestGroupManager } from '@splitifyd/test-support';
import { ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import {PooledTestUser} from "@splitifyd/shared";
import {ApplicationBuilder} from "../../services/ApplicationBuilder";
import {getFirestore} from "../../firebase";

describe('Expenses API', () => {
    const apiDriver = new ApiDriver();
    const expenseService = new ApplicationBuilder(getFirestore()).buildExpenseService()
    let testGroup: any;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 3 });
    });

    describe('Expense Creation', () => {
        test('should add an expense to the group', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withParticipants(users.slice(0, 3).map((u) => u.uid)) // Only use the 3 members in the group
                .withSplitType('equal')
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            // Verify the expense was created by fetching it
            const fetchedExpense = await apiDriver.getExpense(response.id, users[0].token);
            expect(fetchedExpense.description).toBe(expenseData.description);
            expect(fetchedExpense.amount).toBe(expenseData.amount);
            expect(fetchedExpense.paidBy).toBe(users[0].uid);
        });

        test('should add an expense with an unequal split', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Unequal Split Expense')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid]) // Only 2 participants for cleaner split
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
            // Add multiple expenses with unique descriptions for this test
            const uniqueId = uuidv4().slice(0, 8);
            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withParticipants(users.slice(0, 3).map((u) => u.uid))
                    .withDescription(`First Test Expense ${uniqueId}`)
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(50)
                    .withPaidBy(users[1].uid)
                    .withParticipants(users.slice(0, 3).map((u) => u.uid))
                    .withDescription(`Second Test Expense ${uniqueId}`)
                    .withSplitType('equal')
                    .build(),
                users[1].token,
            );

            const response = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            expect(response).toHaveProperty('expenses');
            expect(Array.isArray(response.expenses)).toBe(true);
            expect(response.expenses.length).toBeGreaterThanOrEqual(2);
            const expenseDescriptions = response.expenses.map((e: any) => e.description);
            expect(expenseDescriptions).toContain(`First Test Expense ${uniqueId}`);
            expect(expenseDescriptions).toContain(`Second Test Expense ${uniqueId}`);
        });
    });

    describe('Expense Updates', () => {
        test('should update an expense', async () => {
            const initialExpenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants(users.slice(0, 3).map((u) => u.uid))
                .withSplitType('equal')
                .build();
            const createdExpense = await apiDriver.createExpense(initialExpenseData, users[0].token);

            const updatedData = {
                description: 'Updated Test Expense',
                amount: 150.5,
                category: 'food',
            };

            await apiDriver.updateExpense(createdExpense.id, updatedData, users[0].token);

            const fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);

            expect(fetchedExpense.description).toBe(updatedData.description);
            expect(fetchedExpense.amount).toBe(updatedData.amount);
            expect(fetchedExpense.category).toBe(updatedData.category);
        });

        test('should allow expense creator to edit their expense', async () => {
            const uniqueId = uuidv4().slice(0, 8);
            const initialExpenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription(`Original Expense ${uniqueId}`)
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withCategory('food')
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(initialExpenseData, users[0].token);
            expect(createdExpense.id).toBeDefined();

            const updateData = {
                amount: 150,
                description: `Updated Expense ${uniqueId}`,
                category: 'transport',
            };

            await apiDriver.updateExpense(createdExpense.id, updateData, users[0].token);

            // Verify the update
            const updatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(updatedExpense.amount).toBe(150);
            expect(updatedExpense.description).toBe(`Updated Expense ${uniqueId}`);
            expect(updatedExpense.category).toBe('transport');

            // Verify splits were recalculated
            expect(updatedExpense.splits).toHaveLength(2);
            const totalSplits = updatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBeCloseTo(150, 1);
            expect(updatedExpense.splits[0].amount).toBeCloseTo(75, 1);
            expect(updatedExpense.splits[1].amount).toBeCloseTo(75, 1);
        });

        test('should allow group owner to edit any expense', async () => {
            // Create expense by user 1
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('User 1 Expense')
                .withAmount(50)
                .withPaidBy(users[1].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[1].token);

            // Group owner (user 0) should be able to edit it
            const updateData = {
                amount: 75,
                description: 'Owner Updated Expense',
            };

            await apiDriver.updateExpense(createdExpense.id, updateData, users[0].token);

            const updatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(updatedExpense.amount).toBe(75);
            expect(updatedExpense.description).toBe('Owner Updated Expense');
        });

        test('should prevent non-creator/non-owner from editing expense', async () => {
            // Switch group to MANAGED preset to enforce strict permissions
            await apiDriver.apiRequest(
                `/groups/${testGroup.id}/security/preset`,
                'POST',
                {
                    preset: 'managed',
                },
                users[0].token,
            );

            // Create expense by user 0
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Owner Expense')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);

            // User 1 (not creator, not owner) should not be able to edit
            await expect(apiDriver.updateExpense(createdExpense.id, { amount: 200 }, users[1].token)).rejects.toThrow(/failed with status 403/);
        });

        test('should recalculate splits when amount is updated with equal split type', async () => {
            const testExpenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Split Recalculation Test')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(testExpenseData, users[0].token);

            // Update the amount
            const updateData = {
                amount: 200,
            };

            await apiDriver.updateExpense(createdExpense.id, updateData, users[0].token);

            const fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(fetchedExpense.amount).toBe(200);

            // Verify splits were recalculated - should be 100 each for equal split
            expect(fetchedExpense.splits).toHaveLength(2);
            const totalSplits = fetchedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBeCloseTo(200, 1);
            fetchedExpense.splits.forEach((split: any) => {
                expect(split.amount).toBeCloseTo(100, 1);
            });
        });
    });

    describe('Expense Access Control', () => {
        let expenseId: string;
        let managedGroupId: string;

        beforeEach(async () => {
            // Create a managed group for access control tests
            const group = await apiDriver.createGroupWithMembers('Access Control Test Group', [users[0], users[1], users[2]], users[0].token);
            managedGroupId = group.id;
            
            // Set to managed group preset to enforce stricter permissions
            await apiDriver.apiRequest(
                `/groups/${managedGroupId}/security/preset`,
                'POST',
                { preset: 'managed' },
                users[0].token
            );

            // Create a test expense for access control tests
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(managedGroupId)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withAmount(100)
                    .withDescription('Access Control Test Expense')
                    .withSplitType('equal')
                    .build(),
                users[0].token
            );
            expenseId = expense.id;
        });

        test('should successfully get expense for participant', async () => {
            const result = await expenseService.getExpense(expenseId, users[0].uid);

            expect(result).toBeDefined();
            expect(result.id).toBe(expenseId);
            expect(result.groupId).toBe(managedGroupId);
            expect(result.paidBy).toBe(users[0].uid);
            expect(result.amount).toBe(100);
            expect(result.description).toBe('Access Control Test Expense');
            expect(result.participants).toEqual(expect.arrayContaining([users[0].uid, users[1].uid]));
            expect(result.splits).toHaveLength(2);
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });

        test('should successfully get expense for other participant', async () => {
            const result = await expenseService.getExpense(expenseId, users[1].uid);

            expect(result.id).toBe(expenseId);
            expect(result.paidBy).toBe(users[0].uid);
            expect(result.participants).toContain(users[1].uid);
        });

        test('should deny access to group member who is not participant', async () => {
            await expect(expenseService.getExpense(expenseId, users[2].uid)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense')
            );
        });

        test('should deny access to non-group member', async () => {
            await expect(expenseService.getExpense(expenseId, users[3].uid)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense')
            );
        });

        test('should throw NOT_FOUND for non-existent expense', async () => {
            await expect(expenseService.getExpense('nonexistent', users[0].uid)).rejects.toThrow('not found');
        });
    });

    describe('Edit History Tracking', () => {
        test('should track edit history when expense is updated', async () => {
            // Create expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('History Test Expense')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withCategory('food')
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);

            // Make first update
            await apiDriver.updateExpense(
                createdExpense.id,
                {
                    amount: 150,
                    description: 'First Update',
                },
                users[0].token,
            );

            // Make second update
            await apiDriver.updateExpense(
                createdExpense.id,
                {
                    amount: 200,
                    category: 'transport',
                },
                users[0].token,
            );

            // Fetch the final expense and verify updates
            const finalExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(finalExpense.amount).toBe(200);
            expect(finalExpense.description).toBe('First Update');
            expect(finalExpense.category).toBe('transport');
            expect(finalExpense.updatedAt).toBeDefined();
            expect(new Date(finalExpense.updatedAt!).getTime()).toBeGreaterThan(new Date(finalExpense.createdAt).getTime());
        });
    });
});
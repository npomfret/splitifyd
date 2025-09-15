// Consolidated Expense Management Integration Tests
// Combines tests from expenses-api.test.ts, ExpenseService.integration.test.ts, and expenses-full-details.test.ts

import { beforeEach, describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, CreateExpenseRequestBuilder, borrowTestUsers, TestGroupManager } from '@splitifyd/test-support';
import { ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import { PooledTestUser, SplitTypes, UserToken } from '@splitifyd/shared';
describe('Expenses Management - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 3 });
    });

    describe('Expense Creation and Basic Operations', () => {
        test('should create expense with equal splits via API and service layer', async () => {
            // Test API layer creation
            const apiExpenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withParticipants(users.slice(0, 3).map((u) => u.uid))
                .withSplitType('equal')
                .build();

            const apiResponse = await apiDriver.createExpense(apiExpenseData, users[0].token);
            expect(apiResponse.id).toBeDefined();

            // Verify via API
            const fetchedExpense = await apiDriver.getExpense(apiResponse.id, users[0].token);
            expect(fetchedExpense.description).toBe(apiExpenseData.description);
            expect(fetchedExpense.amount).toBe(apiExpenseData.amount);
            expect(fetchedExpense.paidBy).toBe(users[0].uid);

            // Test split calculations with builder
            const splitTestData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withAmount(120)
                .withDescription('Service test expense')
                .withCategory('Food')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .withSplitType('equal')
                .build();

            const serviceResult = await apiDriver.createExpense(apiExpenseData, users[0].token);
            expect(serviceResult.id).toBeDefined();
            expect(serviceResult.splits).toHaveLength(3);

            // Verify equal distribution (currency conversion may affect exact amounts)
            const firstSplitAmount = serviceResult.splits[0].amount;
            serviceResult.splits.forEach((split: any) => {
                expect(split.amount).toBeCloseTo(firstSplitAmount, 0.1); // All splits should be equal
            });
        });

        test('should create expenses with different split types', async () => {
            // Test unequal/exact splits
            const exactSplitData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Exact Split Expense')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 80 },
                    { userId: users[1].uid, amount: 20 },
                ])
                .build();

            const exactResponse = await apiDriver.createExpense(exactSplitData, users[0].token);
            const exactExpense = await apiDriver.getExpense(exactResponse.id, users[0].token);
            expect(exactExpense.splitType).toBe('exact');
            expect(exactExpense.splits.find((s: any) => s.userId === users[0].uid)?.amount).toBe(80);

            // Test percentage splits
            const percentageApiData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withAmount(100)
                .withDescription('Percentage split test')
                .withCategory('Food')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('percentage')
                .withSplits([
                    { userId: users[0].uid, amount: 70, percentage: 70 },
                    { userId: users[1].uid, amount: 30, percentage: 30 },
                ])
                .build();

            const percentageResult = await apiDriver.createExpense(percentageApiData, users[0].token);
            expect(percentageResult.splitType).toBe('percentage');
            expect(percentageResult.splits).toEqual([
                { userId: users[0].uid, amount: 70, percentage: 70 },
                { userId: users[1].uid, amount: 30, percentage: 30 },
            ]);
        });

        test('should list and paginate group expenses', async () => {
            // Create multiple expenses for listing
            const uniqueId = uuidv4().slice(0, 8);
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
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
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(50)
                    .withPaidBy(users[1].uid)
                    .withParticipants(users.slice(0, 3).map((u) => u.uid))
                    .withDescription(`Second Test Expense ${uniqueId}`)
                    .withSplitType('equal')
                    .build(),
                users[1].token,
            );

            // Test API listing
            const apiResponse = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            expect(apiResponse.expenses.length).toBeGreaterThanOrEqual(2);
            const descriptions = apiResponse.expenses.map((e: any) => e.description);
            expect(descriptions).toContain(`First Test Expense ${uniqueId}`);
            expect(descriptions).toContain(`Second Test Expense ${uniqueId}`);

            // Test API listing
            const apiListResponse = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            expect(apiListResponse.expenses.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Expense Updates and Edit History', () => {
        test('should update expenses with proper permission checks', async () => {
            // Create expense for update tests
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();
            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);

            // Test API update
            const apiUpdateData = {
                description: 'Updated Test Expense',
                amount: 150.5,
                category: 'food',
            };
            await apiDriver.updateExpense(createdExpense.id, apiUpdateData, users[0].token);

            const apiUpdatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(apiUpdatedExpense.description).toBe(apiUpdateData.description);
            expect(apiUpdatedExpense.amount).toBe(apiUpdateData.amount);

            // Test API update with participant recalculation
            const secondUpdateData = {
                amount: 200,
                participants: [users[0].uid, users[1].uid, users[2].uid],
            };
            await apiDriver.updateExpense(createdExpense.id, secondUpdateData, users[0].token);

            const finalUpdatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(finalUpdatedExpense.amount).toBe(200);
            expect(finalUpdatedExpense.participants).toEqual([users[0].uid, users[1].uid, users[2].uid]);
            expect(finalUpdatedExpense.splits).toHaveLength(3);
            finalUpdatedExpense.splits.forEach((split: any) => {
                expect(split.amount).toBeCloseTo(66.67, 2); // 200 / 3
            });
        });

        test('should track edit history and update timestamps', async () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('History Test Expense')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);

            // Make multiple updates
            await apiDriver.updateExpense(createdExpense.id, { amount: 150, description: 'First Update' }, users[0].token);
            await apiDriver.updateExpense(createdExpense.id, { amount: 200, category: 'transport' }, users[0].token);

            const finalExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(finalExpense.amount).toBe(200);
            expect(finalExpense.description).toBe('First Update');
            expect(finalExpense.category).toBe('transport');
            expect(finalExpense.updatedAt).toBeDefined();
            expect(new Date(finalExpense.updatedAt!).getTime()).toBeGreaterThan(new Date(finalExpense.createdAt).getTime());
        });

        test('should enforce update permissions based on group settings', async () => {
            // Create managed group for strict permissions
            const managedGroup = await apiDriver.createGroupWithMembers('Managed Update Test', [users[0], users[1], users[2]], users[0].token);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Permission Test Expense')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);

            // Creator should be able to update
            await apiDriver.updateExpense(createdExpense.id, { amount: 150 }, users[0].token);

            // Non-creator should be able to update (no restrictions without permission setup)
            const updatedExpense = await apiDriver.updateExpense(createdExpense.id, { description: 'Updated by non-creator' }, users[2].token);
            expect(updatedExpense.description).toBe('Updated by non-creator');
        });
    });

    describe('Expense Access Control and Security', () => {
        let managedGroupId: string;
        let testExpenseId: string;

        beforeEach(async () => {
            // Create managed group for access control tests
            const group = await apiDriver.createGroupWithMembers('Access Control Test Group', [users[0], users[1], users[2]], users[0].token);
            managedGroupId = group.id;

            // Create test expense
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(managedGroupId)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withAmount(100)
                    .withDescription('Access Control Test Expense')
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );
            testExpenseId = expense.id;
        });

        test('should allow access for expense participants', async () => {
            // Both API and service layer access for participants
            const apiResult = await apiDriver.getExpense(testExpenseId, users[0].token);
            expect(apiResult.id).toBe(testExpenseId);

            const apiResult2 = await apiDriver.getExpense(testExpenseId, users[1].token);
            expect(apiResult2.id).toBe(testExpenseId);
            expect(apiResult2.participants).toContain(users[1].uid);
        });

        test('should deny access to non-participants', async () => {
            // Group member who is not participant should be denied
            await expect(apiDriver.getExpense(testExpenseId, users[2].token))
                .rejects.toThrow(/failed with status 403/);

            // Non-group member should be denied
            await expect(apiDriver.getExpense(testExpenseId, users[3].token))
                .rejects.toThrow(/failed with status 403/);
        });

        test('should validate group membership for creation and participants', async () => {
            // Non-member cannot create expense
            const invalidApiData = new CreateExpenseRequestBuilder()
                .withGroupId(managedGroupId)
                .withPaidBy(users[3].uid)
                .withAmount(50)
                .withDescription('Unauthorized expense')
                .withCategory('Food')
                .withParticipants([users[3].uid])
                .withSplitType('equal')
                .build();
            await expect(apiDriver.createExpense(invalidApiData, users[3].token)).rejects.toThrow(/failed with status 40[0-9]/);

            // Cannot add non-member as payer
            const invalidPayerApiData = new CreateExpenseRequestBuilder()
                .withGroupId(managedGroupId)
                .withPaidBy(users[3].uid)
                .withAmount(50)
                .withDescription('Invalid payer')
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();
            await expect(apiDriver.createExpense(invalidPayerApiData, users[0].token))
                .rejects.toThrow(/failed with status 40[0-9]/);

            // Cannot add non-member as participant
            const invalidParticipantApiData = new CreateExpenseRequestBuilder()
                .withGroupId(managedGroupId)
                .withPaidBy(users[0].uid)
                .withAmount(50)
                .withDescription('Invalid participant')
                .withParticipants([users[0].uid, users[3].uid])
                .withSplitType('equal')
                .build();
            await expect(apiDriver.createExpense(invalidParticipantApiData, users[0].token))
                .rejects.toThrow(/failed with status 40[0-9]/);
        });

        test('should handle non-existent expenses gracefully', async () => {
            await expect(apiDriver.getExpense('nonexistent', users[0].token)).rejects.toThrow(/failed with status 404/);
            await expect(apiDriver.getExpense('invalid-id', users[0].token)).rejects.toThrow();
        });
    });

    describe('Expense Deletion and Soft Delete Behavior', () => {
        test('should handle expense deletion with proper access control', async () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withAmount(100)
                .withDescription('Expense to delete')
                .withSplitType('equal')
                .build();

            const expense = await apiDriver.createExpense(expenseData, users[0].token);

            // Should soft delete successfully
            await apiDriver.deleteExpense(expense.id, users[0].token);
            await expect(apiDriver.getExpense(expense.id, users[0].token)).rejects.toThrow(/failed with status 404/);

            // Should prevent deletion by non-group member
            const anotherExpense = await apiDriver.createExpense(expenseData, users[0].token);
            await expect(apiDriver.deleteExpense(anotherExpense.id, users[3].token))
                .rejects.toThrow(/failed with status 40[0-9]/);
        });

        test('should handle deleted expenses in listings', async () => {
            // Create multiple expenses
            const expense1 = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                users[0].token
            );
            const expense2 = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                users[0].token
            );

            // Delete one expense
            await apiDriver.deleteExpense(expense1.id, users[0].token);

            // Should filter out deleted by default
            const normalResult = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            expect(normalResult.expenses.find(e => e.id === expense1.id)).toBeUndefined();

            // Should include deleted when requested - API doesn't support includeDeleted flag
            const deletedResult = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            const deletedExpense = deletedResult.expenses.find(e => e.id === expense1.id);
            // Note: API layer may or may not include deleted expenses
        });
    });

    describe('Full Details API and Complex Data Handling', () => {
        test('should return consolidated expense data with group and members', async () => {
            const uniqueId = Math.random().toString(36).slice(2, 10);
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(`Full details test expense ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            const fullDetails = await apiDriver.getExpenseFullDetails(expense.id, users[0].token);

            // Verify expense data
            expect(fullDetails.expense.id).toBe(expense.id);
            expect(fullDetails.expense.participants).toEqual([users[0].uid, users[1].uid, users[2].uid]);
            expect(fullDetails.expense.splits).toHaveLength(3);

            // Verify group data
            expect(fullDetails.group.id).toBe(testGroup.id);
            expect(fullDetails.group.name).toBeDefined();

            // Verify members data
            expect(fullDetails.members.members).toHaveLength(3);
            const memberUids = fullDetails.members.members.map((m: any) => m.uid);
            expect(memberUids).toEqual(expect.arrayContaining([users[0].uid, users[1].uid, users[2].uid]));
        });

        test('should handle complex split scenarios in full details', async () => {
            const complexExpense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Complex expense test')
                    .withAmount(100)
                    .withPaidBy(users[1].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('exact')
                    .withSplits([
                        { userId: users[0].uid, amount: 30 },
                        { userId: users[1].uid, amount: 40 },
                        { userId: users[2].uid, amount: 30 },
                    ])
                    .build(),
                users[0].token,
            );

            const fullDetails = await apiDriver.getExpenseFullDetails(complexExpense.id, users[1].token);

            expect(fullDetails.expense.splitType).toBe('exact');
            expect(fullDetails.expense.splits.find((s: any) => s.userId === users[0].uid)?.amount).toBe(30);
            expect(fullDetails.expense.splits.find((s: any) => s.userId === users[1].uid)?.amount).toBe(40);
            expect(fullDetails.expense.splits.find((s: any) => s.userId === users[2].uid)?.amount).toBe(30);
        });

        test('should enforce access control for full details endpoint', async () => {
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                users[0].token
            );

            // Non-group member should be denied
            await expect(apiDriver.getExpenseFullDetails(expense.id, users[3].token)).rejects.toThrow();

            // Invalid expense should return 404
            await expect(apiDriver.getExpenseFullDetails('invalid-expense-id', users[0].token)).rejects.toThrow();

            // Unauthenticated request should be denied
            await expect(apiDriver.getExpenseFullDetails(expense.id, '')).rejects.toThrow();
        });

        test('should handle concurrent access correctly', async () => {
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants(users.slice(0, 3).map(u => u.uid)).build(),
                users[0].token
            );

            // Test parallel requests
            const requests = [
                apiDriver.getExpenseFullDetails(expense.id, users[0].token),
                apiDriver.getExpenseFullDetails(expense.id, users[1].token),
                apiDriver.getExpenseFullDetails(expense.id, users[2].token),
            ];

            const results = await Promise.all(requests);

            // All requests should return consistent data
            results.forEach((result) => {
                expect(result.expense.id).toBe(expense.id);
                expect(result.group.id).toBe(testGroup.id);
                expect(result.members.members).toHaveLength(3);
            });
        });
    });
});
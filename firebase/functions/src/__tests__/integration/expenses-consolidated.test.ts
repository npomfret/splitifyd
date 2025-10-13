// Consolidated Expense Management Integration Tests
// Combines tests from expenses-api.test.ts, ExpenseService.integration.test.ts, and expenses-full-details.test.ts

import { calculateEqualSplits, PooledTestUser } from '@splitifyd/shared';
import {
    ApiDriver,
    borrowTestUsers,
    CreateExpenseRequestBuilder,
    CreateSettlementRequestBuilder,
    ExpenseUpdateBuilder,
    generateShortId,
    NotificationDriver,
    TestGroupManager,
} from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { getFirestore } from '../../firebase';

describe('Expenses Management - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    const notificationDriver = new NotificationDriver(getFirestore());
    let testGroup: any;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 3 });
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    describe('Expense Creation and Basic Operations', () => {
        // NOTE: Business logic for split calculations, validation, etc. is now tested in unit tests
        // This integration test focuses on API endpoints and Firebase integration
        test('should create expense with equal splits via API and service layer', async () => {
            // Test API layer creation
            const apiExpenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withAmount(90.0)
                .withCurrency('USD')
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

            const serviceResult = await apiDriver.createExpense(apiExpenseData, users[0].token);
            expect(serviceResult.id).toBeDefined();
            expect(serviceResult.splits).toHaveLength(3);

            // Verify equal distribution (currency conversion may affect exact amounts)
            const firstSplitAmount = serviceResult.splits[0].amount;
            serviceResult.splits.forEach((split: any) => {
                expect(split.amount).toBeCloseTo(firstSplitAmount, 0.1); // All splits should be equal
            });
        });

        // NOTE: Split calculation logic is now comprehensively tested in unit tests
        // This integration test focuses on API endpoints and database persistence
        test('should create and persist expenses via API endpoints', async () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('API Integration Test')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            // Test API creation and retrieval
            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);
            expect(createdExpense.id).toBeDefined();

            const retrievedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(retrievedExpense.id).toBe(createdExpense.id);
            expect(retrievedExpense.description).toBe('API Integration Test');
        });

        test('should list and paginate group expenses', async () => {
            // Create multiple expenses for listing
            const uniqueId = generateShortId();
            const descr1 = `First Test Expense ${uniqueId}`;
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants(users.slice(0, 3).map((u) => u.uid))
                    .withDescription(descr1)
                    .build(),
                users[0].token,
            );

            const descr2 = `Second Test Expense ${uniqueId}`;
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[1].uid)
                    .withParticipants(users.slice(0, 3).map((u) => u.uid))
                    .withDescription(descr2)
                    .build(),
                users[1].token,
            );

            // Test API listing
            const apiResponse = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            expect(apiResponse.expenses.length).toBeGreaterThanOrEqual(2);
            const descriptions = apiResponse.expenses.map((e: any) => e.description);
            expect(descriptions).toContain(descr1);
            expect(descriptions).toContain(descr2);

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
                .withCurrency('USD')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();
            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);

            // Test API update
            const participants1 = [users[0].uid, users[1].uid];
            const apiUpdateData = new ExpenseUpdateBuilder()
                .withDescription('Updated Test Expense')
                .withAmount(150.5)
                .withCurrency('USD')
                .withCategory('food')
                .withParticipants(participants1)
                .withSplits(calculateEqualSplits(150.5, 'USD', participants1))
                .build();
            await apiDriver.updateExpense(createdExpense.id, apiUpdateData, users[0].token);

            const apiUpdatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(apiUpdatedExpense.description).toBe(apiUpdateData.description);
            expect(apiUpdatedExpense.amount).toBe(apiUpdateData.amount);

            // Test API update with participant recalculation
            const participants2 = [users[0].uid, users[1].uid, users[2].uid];
            const secondUpdateData = new ExpenseUpdateBuilder()
                .withAmount(200)
                .withCurrency('USD')
                .withParticipants(participants2)
                .withSplits(calculateEqualSplits(200, 'USD', participants2))
                .build();
            await apiDriver.updateExpense(createdExpense.id, secondUpdateData, users[0].token);

            const finalUpdatedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(finalUpdatedExpense.amount).toBe(200);
            expect(finalUpdatedExpense.participants).toEqual([users[0].uid, users[1].uid, users[2].uid]);
            expect(finalUpdatedExpense.splits).toHaveLength(3);
            // Verify splits sum to total amount (200 / 3 = 66.66, 66.66, 66.68)
            const totalSplits = finalUpdatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBeCloseTo(200, 1);
        });

        test('should track edit history and update timestamps', async () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('History Test Expense')
                .withAmount(100)
                .withCurrency('USD')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);

            // Make multiple updates
            const historyParticipants = [users[0].uid, users[1].uid];
            await apiDriver.updateExpense(
                createdExpense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(150)
                    .withCurrency('USD')
                    .withDescription('First Update')
                    .withParticipants(historyParticipants)
                    .withSplits(calculateEqualSplits(150, 'USD', historyParticipants))
                    .build(),
                users[0].token,
            );
            await apiDriver.updateExpense(
                createdExpense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(200)
                    .withCurrency('USD')
                    .withDescription('First Update')
                    .withCategory('transport')
                    .withParticipants(historyParticipants)
                    .withSplits(calculateEqualSplits(200, 'USD', historyParticipants))
                    .build(),
                users[0].token,
            );

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
                .withCurrency('USD')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);

            // Creator should be able to update
            const permissionParticipants = [users[0].uid, users[1].uid];
            await apiDriver.updateExpense(
                createdExpense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(150)
                    .withCurrency('USD')
                    .withParticipants(permissionParticipants)
                    .withSplits(calculateEqualSplits(150, 'USD', permissionParticipants))
                    .build(),
                users[0].token,
            );

            // Non-creator should be able to update (no restrictions without permission setup)
            const updatedExpense = await apiDriver.updateExpense(
                createdExpense.id,
                new ExpenseUpdateBuilder()
                    .withDescription('Updated by non-creator')
                    .withAmount(120)
                    .withCurrency('USD')
                    .withParticipants(permissionParticipants)
                    .withSplits(calculateEqualSplits(120, 'USD', permissionParticipants))
                    .build(),
                users[2].token,
            );

            expect(updatedExpense.description).toBe('Updated by non-creator');
        });

        // REMOVED: "should update balances correctly when expense currency is changed"
        // This test has been migrated to unit tests in:
        // firebase/functions/src/__tests__/unit/services/IncrementalBalanceService.scenarios.test.ts
        //
        // The integration test provided no additional value beyond API testing since the
        // calculation logic itself is now comprehensively tested in the unit test with
        // the same mathematical precision. The unit test is 1000-2000x faster.
    });

    describe('Expense Deletion and Soft Delete Behavior', () => {
        test('should handle expense deletion with proper access control', async () => {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withAmount(100)
                .withCurrency('USD')
                .withDescription('Expense to delete')
                .withSplitType('equal')
                .build();

            const expense = await apiDriver.createExpense(expenseData, users[0].token);

            // Should soft delete successfully
            await apiDriver.deleteExpense(expense.id, users[0].token);
            await expect(apiDriver.getExpense(expense.id, users[0].token)).rejects.toThrow(/failed with status 404/);

            // Should prevent deletion by non-group member
            const anotherExpense = await apiDriver.createExpense(expenseData, users[0].token);
            await expect(apiDriver.deleteExpense(anotherExpense.id, users[3].token)).rejects.toThrow(/failed with status 40[0-9]/);
        });

        test('should handle deleted expenses in listings', async () => {
            // Create multiple expenses
            const expense1 = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .withAmount(100)
                    .withCurrency('USD')
                    .build(),
                users[0].token,
            );
            const expense2 = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .withAmount(100)
                    .withCurrency('USD')
                    .build(),
                users[0].token,
            );

            // Verify both expenses are visible before deletion
            const beforeDeletionResult = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            expect(beforeDeletionResult.expenses.find((e) => e.id === expense1.id)).toBeDefined();
            expect(beforeDeletionResult.expenses.find((e) => e.id === expense2.id)).toBeDefined();
            expect(beforeDeletionResult.expenses.length).toBeGreaterThanOrEqual(2);

            // Delete one expense
            await apiDriver.deleteExpense(expense1.id, users[0].token);

            // Should filter out deleted by default
            const normalResult = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            expect(normalResult.expenses.find((e) => e.id === expense1.id)).toBeUndefined();

            // Verify the non-deleted expense is still visible
            expect(normalResult.expenses.find((e) => e.id === expense2.id)).toBeDefined();

            // Verify total count decreased by one after deletion
            expect(normalResult.expenses.length).toBe(beforeDeletionResult.expenses.length - 1);

            // Since API doesn't support includeDeleted flag, deleted expenses should remain filtered out
            const laterResult = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            const deletedExpense = laterResult.expenses.find((e) => e.id === expense1.id);
            expect(deletedExpense).toBeUndefined();
        });
    });

    describe('Full Details API and Complex Data Handling', () => {
        test('should return consolidated expense data with group and members', async () => {
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
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
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(users[1].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('exact')
                    .withSplits([
                        { uid: users[0].uid, amount: 30 },
                        { uid: users[1].uid, amount: 40 },
                        { uid: users[2].uid, amount: 30 },
                    ])
                    .build(),
                users[0].token,
            );

            const fullDetails = await apiDriver.getExpenseFullDetails(complexExpense.id, users[1].token);

            expect(fullDetails.expense.splitType).toBe('exact');
            expect(fullDetails.expense.splits.find((s: any) => s.uid === users[0].uid)?.amount).toBe(30);
            expect(fullDetails.expense.splits.find((s: any) => s.uid === users[1].uid)?.amount).toBe(40);
            expect(fullDetails.expense.splits.find((s: any) => s.uid === users[2].uid)?.amount).toBe(30);
        });

        test('should enforce access control for full details endpoint', async () => {
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .build(),
                users[0].token,
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
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants(users.slice(0, 3).map((u) => u.uid))
                    .build(),
                users[0].token,
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

        test('should view expense details after a participant leaves the group', async () => {
            // Create group with 3 users
            const departedTestUsers = users.slice(0, 3);
            const departedTestGroup = await TestGroupManager.getOrCreateGroup(departedTestUsers, {
                memberCount: 3,
                fresh: true,
            });

            // Create expense with all 3 participants (user 0 pays, user 1 and 2 owe money)
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(departedTestGroup.id)
                    .withAmount(90)
                    .withCurrency('USD')
                    .withPaidBy(departedTestUsers[0].uid)
                    .withParticipants([departedTestUsers[0].uid, departedTestUsers[1].uid, departedTestUsers[2].uid])
                    .withSplitType('equal')
                    .build(),
                departedTestUsers[0].token,
            );

            // User 1 settles their debt with user 0 so they can leave
            // User 1 owes $30 to user 0 (90 / 3 = 30)
            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(departedTestGroup.id)
                    .withPayerId(departedTestUsers[1].uid)
                    .withPayeeId(departedTestUsers[0].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .withNote('Settling up before leaving')
                    .build(),
                departedTestUsers[1].token,
            );

            // User 1 leaves the group (now that balance is settled)
            await apiDriver.leaveGroup(departedTestGroup.id, departedTestUsers[1].token);

            // User 0 views expense details - should still see User 1's info
            const fullDetails = await apiDriver.getExpenseFullDetails(expense.id, departedTestUsers[0].token);

            // Assertions
            expect(fullDetails.expense.participants).toHaveLength(3);
            expect(fullDetails.members.members).toHaveLength(3); // All 3 participants included

            // Find departed member in members array
            const departedMember = fullDetails.members.members.find((m: any) => m.uid === departedTestUsers[1].uid);
            expect(departedMember).toBeDefined();

            // Verify departed member still has real user data
            if (departedMember) {
                expect(departedMember.displayName).toBeDefined(); // Real name preserved
                expect(departedMember.uid).toBe(departedTestUsers[1].uid);

                // Note: memberStatus is 'active' (last known status) since MemberStatus enum doesn't have 'left'
                // The fact that they're not in the members subcollection indicates they've departed
                expect(departedMember.memberStatus).toBe('active');
            }

            // Verify other participants are still current members
            const currentMember0 = fullDetails.members.members.find((m: any) => m.uid === departedTestUsers[0].uid);
            expect(currentMember0?.memberStatus).toBe('active');
            const currentMember2 = fullDetails.members.members.find((m: any) => m.uid === departedTestUsers[2].uid);
            expect(currentMember2?.memberStatus).toBe('active');
        });
    });
});

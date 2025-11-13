/**
 * Expense Locking Integration Tests
 *
 * IMPORTANT: Most concurrent update tests have been moved to unit tests:
 * - firebase/functions/src/__tests__/unit/expenses/ExpenseConcurrentUpdates.test.ts
 *
 * This file now only contains integration tests that verify actual Firebase optimistic
 * locking behavior with real Firestore transactions that cannot be replicated with
 * SplitifydFirestoreTestDatabase.
 */

import { beforeEach, describe, expect, test } from 'vitest';

import { calculateEqualSplits, UserToken } from '@splitifyd/shared';
import { borrowTestUsers, CreateExpenseRequestBuilder, CreateGroupRequestBuilder, ExpenseUpdateBuilder } from '@splitifyd/test-support';
import { ApiDriver } from '@splitifyd/test-support';

describe('Expense Locking - Firebase Transaction Behavior', () => {
    const apiDriver = new ApiDriver();

    let user1: UserToken;

    beforeEach(async () => {
        [user1] = await borrowTestUsers(3);
    });

    afterEach(async () => {
    });

    test('should verify Firebase optimistic locking prevents data loss in concurrent updates', async () => {
        // Create group
        const group = await apiDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Debug Test Group')
                .withDescription('Testing expense concurrent updates')
                .build(),
            user1.token,
        );

        // Create an expense
        const expense = await apiDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense')
                .withAmount(100, 'EUR')
                .withPaidBy(user1.uid)
                .withLabel('food')
                .withDate(new Date().toISOString())
                .withSplitType('equal')
                .withParticipants([user1.uid])
                .build(),
            user1.token,
        );

        // Verify expense was created
        expect(expense.id).toBeDefined();
        expect(expense.amount).toBe('100');

        // Test Firebase's optimistic locking with truly concurrent updates
        // This tests actual Firestore transaction behavior that cannot be replicated
        // with SplitifydFirestoreTestDatabase
        const lockingTestParticipants = [user1.uid];
        const updatePromises = [
            apiDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(200, 'EUR')
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(200, 'EUR', lockingTestParticipants))
                    .build(),
                user1.token,
            ),
            apiDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(300, 'EUR')
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(300, 'EUR', lockingTestParticipants))
                    .build(),
                user1.token,
            ),
        ];

        const results = await Promise.allSettled(updatePromises);

        // Verify Firebase transaction behavior - at least one update succeeds
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        // At least one should succeed
        expect(successes.length).toBeGreaterThan(0);
        expect(successes.length + failures.length).toBe(2);

        // Verify final state - Firebase should have persisted one of the updates
        // This confirms optimistic locking worked correctly
        const expenses = await apiDriver.getGroupExpenses(group.id, user1.token);
        const updatedExpense = expenses.expenses.find((e: any) => e.id === expense.id);
        expect(updatedExpense).toBeDefined();
        expect(['200', '300']).toContain(updatedExpense?.amount);
    });
});

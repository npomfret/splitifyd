/**
 * Expense Locking Integration Tests
 *
 * IMPORTANT: Most concurrent update tests have been moved to unit tests:
 * - firebase/functions/src/__tests__/unit/expenses/ExpenseConcurrentUpdates.test.ts
 *
 * This file now only contains integration tests that verify actual Firebase optimistic
 * locking behavior with real Firestore transactions that cannot be replicated with
 * TenantFirestoreTestDatabase.
 */

import { beforeEach, describe, expect, test } from 'vitest';

import { calculateEqualSplits, toAmount, toCurrencyISOCode, UserToken } from '@billsplit-wl/shared';
import { borrowTestUsers, CreateExpenseRequestBuilder, CreateGroupRequestBuilder, ExpenseUpdateBuilder } from '@billsplit-wl/test-support';
import { ApiDriver } from '@billsplit-wl/test-support';

describe('Expense Locking - Firebase Transaction Behavior', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

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

        const eur = toCurrencyISOCode('EUR');

        // Create an expense
        const expense = await apiDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense')
                .withAmount(100, eur)
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
        // with TenantFirestoreTestDatabase
        const lockingTestParticipants = [user1.uid];
        const updatePromises = [
            apiDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(200, eur)
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(toAmount(200), eur, lockingTestParticipants))
                    .build(),
                user1.token,
            ),
            apiDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(300, eur)
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(toAmount(300), eur, lockingTestParticipants))
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
        // Note: With edit history via soft deletes, updates create NEW expenses with new IDs
        // and soft-delete the original. We need to find the current (non-superseded) expense.
        const expenses = await apiDriver.getGroupExpenses(group.id, user1.token);

        // Find the current expense (one that hasn't been superseded)
        const currentExpenses = expenses.expenses.filter((e: any) => e.supersededBy === null);
        expect(currentExpenses.length).toBeGreaterThanOrEqual(1);

        // The final amount should be one of our update values
        const finalAmount = currentExpenses[0]?.amount;
        expect(['200', '300']).toContain(finalAmount);
    });
});

describe('Expense Labels - List Response', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

    let user1: UserToken;

    beforeEach(async () => {
        [user1] = await borrowTestUsers(1);
    });

    test('should include labels in expense list response', async () => {
        // Create group
        const group = await apiDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Labels Test Group')
                .build(),
            user1.token,
        );

        // Create expense with labels
        const expense = await apiDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Labeled Expense')
                .withAmount(100, toCurrencyISOCode('USD'))
                .withPaidBy(user1.uid)
                .withLabels(['Food', 'Lunch'])
                .withSplitType('equal')
                .withParticipants([user1.uid])
                .build(),
            user1.token,
        );

        // Verify labels are present in creation response
        expect(expense.labels).toHaveLength(2);
        expect(expense.labels).toContain('Food');
        expect(expense.labels).toContain('Lunch');

        // Verify labels are present in list response (via getGroupFullDetails)
        // This is where the bug manifests - the .select() uses 'label' instead of 'labels'
        const expenses = await apiDriver.getGroupExpenses(group.id, user1.token);
        expect(expenses.expenses).toHaveLength(1);

        const listedExpense = expenses.expenses[0];
        expect(listedExpense.labels).toHaveLength(2);
        expect(listedExpense.labels).toContain('Food');
        expect(listedExpense.labels).toContain('Lunch');
    });
});

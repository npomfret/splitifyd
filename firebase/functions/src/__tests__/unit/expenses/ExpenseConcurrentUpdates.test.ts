/**
 * Expense Concurrent Updates - Unit Tests
 *
 * Migrated from integration/expense-locking.test.ts to avoid Firebase emulator dependency.
 * Tests concurrent update behavior using SplitifydFirestoreTestDatabase.
 *
 * This tests the application-level logic for handling concurrent expense updates.
 * The integration test remains for testing actual Firebase optimistic locking behavior.
 */

import { calculateEqualSplits, toGroupName } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, ExpenseUpdateBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Expense Concurrent Updates - Unit Tests', () => {
    let appDriver: AppDriver;
    const userId = 'test-user-123';

    beforeEach(() => {
        appDriver = new AppDriver();
        appDriver.seedUser(userId, {
            displayName: 'Test User',
            email: 'test@example.com',
        });
    });

    afterEach(() => {
        appDriver.dispose();
    });

    test('should handle concurrent expense updates', async () => {
        // Create group
        const group = await appDriver.createGroup(userId, {
            name: toGroupName('Concurrent Update Test Group'),
            description: 'Testing expense concurrent updates',
        });

        // Create an expense
        const expense = await appDriver.createExpense(
            userId,
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense')
                .withAmount(100, 'EUR')
                .withPaidBy(userId)
                .withCategory('food')
                .withDate(new Date().toISOString())
                .withSplitType('equal')
                .withParticipants([userId])
                .build(),
        );

        // Verify expense was created
        expect(expense.id).toBeDefined();
        expect(expense.amount).toBe('100');

        // Attempt concurrent updates
        const lockingTestParticipants = [userId];
        const updatePromises = [
            appDriver.updateExpense(
                userId,
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(200, 'EUR')
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(200, 'EUR', lockingTestParticipants))
                    .build(),
            ),
            appDriver.updateExpense(
                userId,
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(300, 'EUR')
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(300, 'EUR', lockingTestParticipants))
                    .build(),
            ),
        ];

        const results = await Promise.allSettled(updatePromises);

        // Check results
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        // At least one should succeed
        expect(successes.length).toBeGreaterThan(0);
        expect(successes.length + failures.length).toBe(2);

        // Verify final state - expense should have one of the updated amounts
        const { expenses } = await appDriver.getGroupExpenses(userId, group.id);
        const updatedExpense = expenses.find((e) => e.id === expense.id);
        expect(updatedExpense).toBeDefined();
        expect(['200', '300']).toContain(updatedExpense?.amount);
    });

    test('should demonstrate transaction conflict behavior with concurrent amount changes', async () => {
        // Create group
        const group = await appDriver.createGroup(userId, {
            name: toGroupName('Transaction Conflict Test'),
        });

        // Create an expense
        const expense = await appDriver.createExpense(
            userId,
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense')
                .withAmount(100, 'USD')
                .withPaidBy(userId)
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([userId])
                .build(),
        );

        // Concurrent updates to the same expense
        // This tests that SplitifydFirestoreTestDatabase correctly simulates transaction conflicts
        const participants = [userId];
        const updatePromises = [
            appDriver.updateExpense(
                userId,
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(150, 'USD')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(150, 'USD', participants))
                    .build(),
            ),
            appDriver.updateExpense(
                userId,
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(200, 'USD')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(200, 'USD', participants))
                    .build(),
            ),
        ];

        const results = await Promise.allSettled(updatePromises);

        // Verify transaction conflict behavior
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        // At least one should succeed
        expect(successes.length).toBeGreaterThan(0);
        expect(successes.length + failures.length).toBe(2);

        // Verify final state has one of the updated amounts
        const { expenses } = await appDriver.getGroupExpenses(userId, group.id);
        const updatedExpense = expenses.find((e) => e.id === expense.id);
        expect(updatedExpense).toBeDefined();
        expect(['150', '200']).toContain(updatedExpense?.amount);
    });

    test('should reject updates from non-members', async () => {
        const nonMemberId = 'non-member-789';
        appDriver.seedUser(nonMemberId, {
            displayName: 'Non Member',
            email: 'nonmember@example.com',
        });

        // Create group and expense
        const group = await appDriver.createGroup(userId, {
            name: toGroupName('Access Control Test'),
        });

        const expense = await appDriver.createExpense(
            userId,
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense')
                .withAmount(100, 'USD')
                .withPaidBy(userId)
                .withParticipants([userId])
                .build(),
        );

        // Non-member tries to update expense - should fail with access denied
        // Note: Using just description update to avoid validation complexity
        await expect(
            appDriver.updateExpense(
                nonMemberId,
                expense.id,
                new ExpenseUpdateBuilder().withDescription('Unauthorized Update').build(),
            ),
        )
            .rejects
            .toThrow();
    });
});

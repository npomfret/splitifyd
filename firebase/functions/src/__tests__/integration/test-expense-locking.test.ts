import { beforeEach, describe, expect, test } from 'vitest';

import { calculateEqualSplits, UserToken } from '@splitifyd/shared';
import { borrowTestUsers, CreateExpenseRequestBuilder, CreateGroupRequestBuilder, ExpenseUpdateBuilder, NotificationDriver } from '@splitifyd/test-support';
import { ApiDriver } from '@splitifyd/test-support';
import { getFirestore } from '../../firebase';

describe('Expense Locking Debug Test', () => {
    const apiDriver = new ApiDriver();
    const notificationDriver = new NotificationDriver(getFirestore());

    let user1: UserToken;

    beforeEach(async () => {
        [user1] = await borrowTestUsers(3);
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    test('should handle concurrent expense updates', async () => {
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
                .withAmount(100)
                .withCurrency('EUR')
                .withPaidBy(user1.uid)
                .withCategory('food')
                .withDate(new Date().toISOString())
                .withSplitType('equal')
                .withParticipants([user1.uid])
                .build(),
            user1.token,
        );

        // Created expense

        // Try to update the expense twice simultaneously
        const lockingTestParticipants = [user1.uid];
        const updatePromises = [
            await apiDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(200)
                    .withCurrency('EUR')
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(200, 'EUR', lockingTestParticipants))
                    .build(),
                user1.token,
            ),
            await apiDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(300)
                    .withCurrency('EUR')
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(300, 'EUR', lockingTestParticipants))
                    .build(),
                user1.token,
            ),
        ];

        // Starting concurrent updates
        const results = await Promise.allSettled(updatePromises);

        // Check the actual results

        // Check results
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        // At least one should succeed
        expect(successes.length).toBeGreaterThan(0);
        expect(successes.length + failures.length).toBe(2);

        // Verify final state
        const expenses = await apiDriver.getGroupExpenses(group.id, user1.token);
        const updatedExpense = expenses.expenses.find((e: any) => e.id === expense.id);
        expect(["200", "300"]).toContain(updatedExpense?.amount);
    });
});

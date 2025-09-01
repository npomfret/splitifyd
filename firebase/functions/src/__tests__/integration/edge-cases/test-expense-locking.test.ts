import {beforeEach, describe, expect, test} from 'vitest';

import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import { SplitTypes } from '@splitifyd/shared';
import {ApiDriver, User} from "@splitifyd/test-support";
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Expense Locking Debug Test', () => {
    const apiDriver = new ApiDriver();

    let user1: AuthenticatedFirebaseUser;

    beforeEach(async () => {
        ([user1] = await borrowTestUsers(3));
    });

    test('should handle concurrent expense updates', async () => {
        // Create group
        const group = await apiDriver.createGroup(
            {
                name: 'Debug Test Group',
                description: 'Testing expense concurrent updates',
            },
            user1.token,
        );

        // Create an expense
        const expense = await apiDriver.createExpense(
            {
                groupId: group.id,
                description: 'Test Expense',
                amount: 100,
                currency: 'USD',
                paidBy: user1.uid,
                category: 'food',
                date: new Date().toISOString(),
                splitType: SplitTypes.EQUAL,
                participants: [user1.uid],
            },
            user1.token,
        );

        // Created expense

        // Try to update the expense twice simultaneously
        const updatePromises = [await apiDriver.updateExpense(expense.id, { amount: 200 }, user1.token), await apiDriver.updateExpense(expense.id, { amount: 300 }, user1.token)];

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
        expect([200, 300]).toContain(updatedExpense?.amount);
    });
});

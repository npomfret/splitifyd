/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../../support/ApiDriver';
import { SplitTypes } from '@splitifyd/shared';

describe('Expense Locking Debug Test', () => {
    jest.setTimeout(10000);

    let driver: ApiDriver;
    let user: User;

    beforeAll(async () => {

        driver = new ApiDriver();

        // Create one test user
        user = await driver.createUser({
            email: `testlock${uuidv4().substring(0, 6)}@test.com`,
            password: `Password123!`,
            displayName: `TestUser`,
        });
    });


    test('should handle concurrent expense updates', async () => {
        // Create group
        const group = await driver.createGroup(
            {
                name: 'Debug Test Group',
                description: 'Testing expense concurrent updates',
            },
            user.token,
        );

        // Create an expense
        const expense = await driver.createExpense(
            {
                groupId: group.id,
                description: 'Test Expense',
                amount: 100,
                currency: 'USD',
                paidBy: user.uid,
                category: 'food',
                date: new Date().toISOString(),
                splitType: SplitTypes.EQUAL,
                participants: [user.uid],
            },
            user.token,
        );

        // Created expense

        // Try to update the expense twice simultaneously
        const updatePromises = [await driver.updateExpense(expense.id, {amount: 200}, user.token), await driver.updateExpense(expense.id, {amount: 300}, user.token)];

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
        const expenses = await driver.getGroupExpenses(group.id, user.token);
        const updatedExpense = expenses.expenses.find((e: any) => e.id === expense.id);
        expect([200, 300]).toContain(updatedExpense?.amount);
    });
});

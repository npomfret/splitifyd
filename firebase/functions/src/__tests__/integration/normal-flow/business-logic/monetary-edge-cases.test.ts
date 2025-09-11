import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, borrowTestUsers, TestGroupManager} from '@splitifyd/test-support';
import { CreateExpenseRequestBuilder } from '@splitifyd/test-support';
import {UserToken} from "@splitifyd/shared";

describe('Additional Monetary Edge Cases', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let users: UserToken[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 3 });
    });

    test('should handle currency-style formatting for display', async () => {
        const uniqueId = uuidv4().slice(0, 8);
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(testGroup.id)
            .withAmount(12.34) // Common currency format - this is what the test is about
            .withDescription(`Currency format test ${uniqueId}`)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid])
            .withSplitType('equal')
            .build();

        const response = await apiDriver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(12.34);

        // Verify splits handle currency precision properly
        const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBeCloseTo(12.34, 2);
    });

    test('should handle odd number divisions with proper rounding', async () => {
        const uniqueId = uuidv4().slice(0, 8);
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(testGroup.id)
            .withAmount(10.0) // $10 split 3 ways = $3.33, $3.33, $3.34 - this is what the test is about
            .withDescription(`Odd division test ${uniqueId}`)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid, users[2].uid])
            .withSplitType('equal')
            .build();

        const response = await apiDriver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(10.0);
        expect(createdExpense.splits).toHaveLength(3);

        // Total should be close to original amount (rounding may cause small differences)
        const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBeCloseTo(10.0, 1); // Allow 0.1 difference for rounding

        // Each split should be reasonable (between 3.33 and 3.34)
        createdExpense.splits.forEach((split: any) => {
            expect(split.amount).toBeGreaterThanOrEqual(3.33);
            expect(split.amount).toBeLessThanOrEqual(3.34);
        });
    });

    test('should handle fractional cents properly', async () => {
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(testGroup.id)
            .withAmount(0.999) // Nearly 1 cent - this is what the test is about
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid])
            .withSplitType('equal')
            .build();

        const response = await apiDriver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(0.999);

        // Verify splits handle fractional amounts reasonably (rounding may occur)
        const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBeCloseTo(0.999, 2); // Allow for rounding differences
    });
});
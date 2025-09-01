import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, User, borrowTestUsers} from '@splitifyd/test-support';
import { ExpenseBuilder, CreateGroupRequestBuilder } from '@splitifyd/test-support';

describe('Amount Validation Edge Cases', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });
    
    beforeEach(async () => {
        const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).withMembers(users).build();
        testGroup = await apiDriver.createGroup(groupData, users[0].token);
    });

    describe('Decimal Precision Edge Cases', () => {
        test('should handle very small amounts with proper precision', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withAmount(0.01) // 1 cent - this is what the test is about
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
            expect(createdExpense.amount).toBe(0.01);
            expect(createdExpense.splits).toHaveLength(2);

            // With equal split of 0.01 between 2 people, rounding may result in 0.01 each (total 0.02)
            const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBeGreaterThanOrEqual(0.01);
            expect(totalSplits).toBeLessThanOrEqual(0.02);
        });

        test('should handle amounts with many decimal places', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withAmount(33.333333) // Many decimal places - this is what the test is about
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
            expect(createdExpense.amount).toBe(33.333333);

            // Verify splits are reasonable (within 1 cent of expected)
            const expectedSplitAmount = 33.333333 / 3;
            createdExpense.splits.forEach((split: any) => {
                expect(split.amount).toBeCloseTo(expectedSplitAmount, 2);
            });
        });
    });

    describe('Large Amount Edge Cases', () => {
        test('should handle very large amounts', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withAmount(999999.99) // Nearly one million - this is what the test is about
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
            expect(createdExpense.amount).toBe(999999.99);
            expect(createdExpense.splits).toHaveLength(2);

            // For large amounts, rounding might cause small differences
            const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBeCloseTo(999999.99, 1); // Allow 0.1 difference for rounding

            // Each split should be approximately half the total
            createdExpense.splits.forEach((split: any) => {
                expect(split.amount).toBeCloseTo(999999.99 / 2, 1);
            });
        });

        test('should reject zero amounts', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withAmount(0) // Zero amount - this is what the test is about
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive|amount.*required|INVALID_AMOUNT/i);
        });

        test('should reject negative amounts', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withAmount(-50) // Negative amount - this is what the test is about
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive|amount.*invalid|INVALID_AMOUNT/i);
        });
    });
});
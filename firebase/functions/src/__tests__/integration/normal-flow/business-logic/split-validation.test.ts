import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, borrowTestUsers, User} from '@splitifyd/test-support';
import { ExpenseBuilder, CreateGroupRequestBuilder } from '@splitifyd/test-support';

describe('Split Validation Edge Cases', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);

        const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).withMembers(users).build();
        testGroup = await apiDriver.createGroup(groupData, users[0].token);
    });

    describe('Exact Split Validation', () => {
        test('should reject splits that do not add up to total amount', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 60 },
                    { userId: users[1].uid, amount: 30 }, // Only adds up to 90, not 100
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/split.*total|amounts.*equal|INVALID_SPLIT_TOTAL/i);
        });

        test('should accept splits with minor rounding differences (within 1 cent)', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 33.33 },
                    { userId: users[1].uid, amount: 33.33 },
                    { userId: users[2].uid, amount: 33.34 }, // Total: 100.00 (acceptable rounding)
                ])
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
            expect(createdExpense.amount).toBe(100);
            expect(createdExpense.splits).toHaveLength(3);
        });

        test('should reject splits with differences greater than 1 cent', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 50.0 },
                    { userId: users[1].uid, amount: 49.0 }, // Total: 99.00 (difference > 1 cent)
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/split.*total|amounts.*equal|INVALID_SPLIT_TOTAL/i);
        });

        test('should reject negative split amounts', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 120 },
                    { userId: users[1].uid, amount: -20 }, // Negative amount - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive|negative|amount.*invalid/i);
        });

        test('should reject zero split amounts', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 100 },
                    { userId: users[1].uid, amount: 0 }, // Zero amount - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive|amount.*required|amount.*invalid/i);
        });

        test('should reject duplicate users in splits', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 50 },
                    { userId: users[0].uid, amount: 50 }, // Duplicate user - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/duplicate.*user|participant.*once|DUPLICATE_SPLIT_USERS/i);
        });

        test('should reject splits for users not in participants list', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid]) // Only user 0 is a participant
                .withSplits([
                    { userId: users[0].uid, amount: 50 },
                    { userId: users[1].uid, amount: 50 }, // User 1 is not a participant - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/participant|split.*user|INVALID_SPLIT_USER/i);
        });
    });

    describe('Percentage Split Validation', () => {
        test('should reject percentages that do not add up to 100%', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('percentage')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 60, percentage: 60 },
                    { userId: users[1].uid, amount: 30, percentage: 30 }, // Only adds up to 90% - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/percentage.*100|percentages.*add.*up|INVALID_PERCENTAGE_TOTAL/i);
        });

        test('should accept percentages with minor rounding differences (within 0.01%)', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('percentage')
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 33.33, percentage: 33.33 },
                    { userId: users[1].uid, amount: 33.33, percentage: 33.33 },
                    { userId: users[2].uid, amount: 33.34, percentage: 33.34 }, // Total: 100.00% - acceptable rounding
                ])
                .build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();

            const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
            expect(createdExpense.amount).toBe(100);
            expect(createdExpense.splits).toHaveLength(3);
        });

        test('should reject negative percentages', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('percentage')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 120, percentage: 120 },
                    { userId: users[1].uid, amount: -20, percentage: -20 }, // Negative percentage - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/percentage.*100|INVALID_INPUT|less than or equal to 100/i);
        });

        test('should reject percentages over 100%', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('percentage')
                .withParticipants([users[0].uid])
                .withSplits([
                    { userId: users[0].uid, amount: 100, percentage: 150 }, // 150% is over limit - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/percentage.*100|max.*100|percentage.*invalid/i);
        });
    });

    describe('Split Count Validation', () => {
        test('should require splits for all participants in exact split type', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid, users[2].uid]) // 3 participants
                .withSplits([
                    { userId: users[0].uid, amount: 50 },
                    { userId: users[1].uid, amount: 50 }, // Missing split for user 2 - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/splits.*participants|splits.*all|INVALID_SPLITS/i);
        });

        test('should require splits for all participants in percentage split type', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withSplitType('percentage')
                .withParticipants([users[0].uid, users[1].uid]) // 2 participants
                .withSplits([
                    { userId: users[0].uid, amount: 100, percentage: 100 }, // Missing split for user 1 - this is what the test is about
                ])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/splits.*participants|splits.*all|INVALID_SPLITS/i);
        });
    });
});
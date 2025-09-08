// Comprehensive input validation integration tests
// Consolidates validation tests from amount-validation.test.ts, split-validation.test.ts, negative-value-validation.test.ts, and data-validation.test.ts

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, borrowTestUsers, TestGroupManager, ExpenseBuilder, SettlementBuilder } from '@splitifyd/test-support';
import { Group } from '@splitifyd/shared';
import {PooledTestUser} from "@splitifyd/shared";

describe('Input Validation', () => {
    const apiDriver = new ApiDriver();
    let testGroup: Group;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 4 });
    });

    describe('Amount Validation', () => {
        describe('Decimal Precision Edge Cases', () => {
            test('should handle very small amounts with proper precision', async () => {
                const uniqueId = uuidv4().slice(0, 8);
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(0.01) // 1 cent
                    .withDescription(`Small amount test ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build();

                const response = await apiDriver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
                expect(createdExpense.amount).toBe(0.01);
                expect(createdExpense.splits).toHaveLength(2);

                const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
                expect(totalSplits).toBeGreaterThanOrEqual(0.01);
                expect(totalSplits).toBeLessThanOrEqual(0.02);
            });

            test('should handle amounts with many decimal places', async () => {
                const uniqueId = uuidv4().slice(0, 8);
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(33.333333) // Many decimal places
                    .withDescription(`Decimal places test ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build();

                const response = await apiDriver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
                expect(createdExpense.amount).toBe(33.333333);

                const expectedSplitAmount = 33.333333 / 3;
                createdExpense.splits.forEach((split: any) => {
                    expect(split.amount).toBeCloseTo(expectedSplitAmount, 2);
                });
            });

            test('should handle very large amounts', async () => {
                const uniqueId = uuidv4().slice(0, 8);
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(999999.99) // Nearly one million
                    .withDescription(`Large amount test ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build();

                const response = await apiDriver.createExpense(expenseData, users[0].token);
                expect(response.id).toBeDefined();

                const createdExpense = await apiDriver.getExpense(response.id, users[0].token);
                expect(createdExpense.amount).toBe(999999.99);
                expect(createdExpense.splits).toHaveLength(2);

                const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
                expect(totalSplits).toBeCloseTo(999999.99, 1);
            });
        });

        describe('Invalid Amount Validation', () => {
            test('should reject zero amounts', async () => {
                const uniqueId = uuidv4().slice(0, 8);
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(0)
                    .withDescription(`Zero amount test ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive|amount.*required|INVALID_AMOUNT|Amount must be greater than 0/i);
            });

            test('should reject negative amounts', async () => {
                const uniqueId = uuidv4().slice(0, 8);
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(-50)
                    .withDescription(`Negative amount test ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive|amount.*invalid|INVALID_AMOUNT|Amount must be a positive number/i);
            });

            test('should reject very small negative numbers', async () => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withAmount(-0.01)
                    .withDescription('Test tiny negative')
                    .withCategory('food')
                    .withSplitType('equal')
                    .withParticipants([users[0].uid, users[1].uid])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
            });

            test('should reject negative infinity', async () => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withAmount(Number.NEGATIVE_INFINITY)
                    .withDescription('Test negative infinity')
                    .withCategory('food')
                    .withSplitType('equal')
                    .withParticipants([users[0].uid, users[1].uid])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0|invalid/i);
            });

            test('should handle NaN values gracefully', async () => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withAmount(NaN)
                    .withDescription('Test NaN')
                    .withCategory('food')
                    .withSplitType('equal')
                    .withParticipants([users[0].uid, users[1].uid])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0|invalid/i);
            });

            test('should reject negative amounts when updating expense', async () => {
                const uniqueId = uuidv4().slice(0, 8);
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withAmount(100)
                    .withDescription(`Valid expense ${uniqueId}`)
                    .withCategory('food')
                    .withSplitType('equal')
                    .withParticipants([users[0].uid, users[1].uid])
                    .build();

                const expense = await apiDriver.createExpense(expenseData, users[0].token);

                const updateData = {
                    amount: -50,
                };

                await expect(apiDriver.updateExpense(expense.id, updateData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
            });
        });
    });

    describe('Split Validation', () => {
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
                const uniqueId = uuidv4().slice(0, 8);
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(`Rounding test ${uniqueId}`)
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withSplitType('exact')
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplits([
                        { userId: users[0].uid, amount: 33.33 },
                        { userId: users[1].uid, amount: 33.33 },
                        { userId: users[2].uid, amount: 33.34 }, // Total: 100.00
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
                        { userId: users[1].uid, amount: 49.0 }, // Total: 99.00
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
                        { userId: users[1].uid, amount: -20 }, // Negative amount
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
                        { userId: users[1].uid, amount: 0 }, // Zero amount
                    ])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive|amount.*required|amount.*invalid/i);
            });

            test('should reject duplicate users in splits', async () => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withSplitType('exact')
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplits([
                        { userId: users[0].uid, amount: 50 },
                        { userId: users[0].uid, amount: 50 }, // Duplicate user
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
                        { userId: users[1].uid, amount: 50 }, // User 1 is not a participant
                    ])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/participant|split.*user|INVALID_SPLIT_USER/i);
            });

            test('should require splits for all participants in exact split type', async () => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withSplitType('exact')
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid]) // 3 participants
                    .withSplits([
                        { userId: users[0].uid, amount: 50 },
                        { userId: users[1].uid, amount: 50 }, // Missing split for user 2
                    ])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/splits.*participants|splits.*all|INVALID_SPLITS/i);
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
                        { userId: users[1].uid, amount: 30, percentage: 30 }, // Only adds up to 90%
                    ])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/percentage.*100|percentages.*add.*up|INVALID_PERCENTAGE_TOTAL/i);
            });

            test('should accept percentages with minor rounding differences (within 0.01%)', async () => {
                const uniqueId = uuidv4().slice(0, 8);
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(`Percentage rounding test ${uniqueId}`)
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withSplitType('percentage')
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplits([
                        { userId: users[0].uid, amount: 33.33, percentage: 33.33 },
                        { userId: users[1].uid, amount: 33.33, percentage: 33.33 },
                        { userId: users[2].uid, amount: 33.34, percentage: 33.34 }, // Total: 100.00%
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
                        { userId: users[1].uid, amount: -20, percentage: -20 }, // Negative percentage
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
                        { userId: users[0].uid, amount: 100, percentage: 150 }, // 150% is over limit
                    ])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/percentage.*100|max.*100|percentage.*invalid/i);
            });

            test('should require splits for all participants in percentage split type', async () => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withSplitType('percentage')
                    .withParticipants([users[0].uid, users[1].uid]) // 2 participants
                    .withSplits([
                        { userId: users[0].uid, amount: 100, percentage: 100 }, // Missing split for user 1
                    ])
                    .build();

                await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/splits.*participants|splits.*all|INVALID_SPLITS/i);
            });
        });
    });

    describe('Settlement Validation', () => {
        test('should reject negative settlement amounts', async () => {
            const uniqueId = uuidv4().slice(0, 8);
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(-50) // Negative amount
                .withNote(`Test negative settlement ${uniqueId}`)
                .build();

            await expect(apiDriver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/Amount must be greater than 0/);
        });

        test('should reject zero settlement amounts', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(0) // Zero amount
                .withNote('Test zero settlement')
                .build();

            await expect(apiDriver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/Amount must be greater than 0/);
        });

        test('should reject negative amounts when updating settlement', async () => {
            const uniqueId = uuidv4().slice(0, 8);
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(100)
                .withNote(`Valid settlement ${uniqueId}`)
                .build();

            const settlement = await apiDriver.createSettlement(settlementData, users[0].token);

            const updateData = {
                amount: -75,
            };

            await expect(apiDriver.updateSettlement(settlement.id, updateData, users[0].token)).rejects.toThrow(/Amount must be greater than 0/);
        });

        test('should validate settlement amount does not exceed maximum', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(1000000) // Amount exceeds max of 999,999.99
                .withNote('Test max amount')
                .build();

            await expect(apiDriver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/Amount cannot exceed 999,999.99/);
        });
    });

    describe('Date Validation', () => {
        test('should reject invalid date formats', async () => {
            const expenseData = {
                ...new ExpenseBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).withSplitType('equal').build(),
                date: 'invalid-date-format',
            };

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow();
        });

        test('should reject future dates', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDate(futureDate.toISOString()).withPaidBy(users[0].uid).withParticipants([users[0].uid]).withSplitType('equal').build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow();
        });

        test('should accept valid dates', async () => {
            const uniqueId = uuidv4().slice(0, 8);
            const validDate = new Date();
            validDate.setMonth(validDate.getMonth() - 1);

            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDescription(`Valid date test ${uniqueId}`).withDate(validDate.toISOString()).withPaidBy(users[0].uid).withParticipants([users[0].uid]).withSplitType('equal').build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();
        });
    });

    describe('Category Validation', () => {
        test('should accept valid category', async () => {
            const uniqueId = uuidv4().slice(0, 8);
            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDescription(`Valid category test ${uniqueId}`).withCategory('food').withPaidBy(users[0].uid).withParticipants([users[0].uid]).withSplitType('equal').build();

            const response = await apiDriver.createExpense(expenseData, users[0].token);
            expect(response.id).toBeDefined();
        });
    });
});
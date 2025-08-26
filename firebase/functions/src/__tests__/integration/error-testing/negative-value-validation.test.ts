/**
 * @jest-environment node
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '@splitifyd/test-support';
import { UserBuilder, ExpenseBuilder, SettlementBuilder } from '@splitifyd/test-support';

describe('Negative Value Validation', () => {
    let driver: ApiDriver;
    let users: User[] = [];
    let testGroup: any;

    jest.setTimeout(10000);

    beforeAll(async () => {

        driver = new ApiDriver();
        users = await Promise.all([driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build())]);
    });


    beforeEach(async () => {
        testGroup = await driver.createGroupWithMembers(`Negative Validation Test Group ${uuidv4()}`, users, users[0].token);
    });

    describe('Expense Validation', () => {
        it('should reject negative expense amounts', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(-100) // Negative amount
                .withDescription('Test negative expense')
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(driver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
        });

        it('should reject zero expense amounts', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(0) // Zero amount
                .withDescription('Test zero expense')
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(driver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
        });

        it('should reject negative amounts in expense splits', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(100)
                .withDescription('Test expense with negative split')
                .withCategory('food')
                .withSplitType('exact')
                .withParticipants([users[0].uid, users[1].uid])
                .withSplits([
                    { userId: users[0].uid, amount: -50 }, // Negative split
                    { userId: users[1].uid, amount: 150 },
                ])
                .build();

            await expect(driver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive/);
        });

        it('should reject negative amounts when updating expense', async () => {
            // First create a valid expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(100)
                .withDescription('Valid expense')
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            const expense = await driver.createExpense(expenseData, users[0].token);

            // Try to update with negative amount
            const updateData = {
                amount: -50, // Negative amount
            };

            await expect(driver.updateExpense(expense.id, updateData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
        });
    });

    describe('Settlement Validation', () => {
        it('should reject negative settlement amounts', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(-50) // Negative amount
                .withNote('Test negative settlement')
                .build();

            await expect(driver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/Amount must be greater than 0/);
        });

        it('should reject zero settlement amounts', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(0) // Zero amount
                .withNote('Test zero settlement')
                .build();

            await expect(driver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/Amount must be greater than 0/);
        });

        it('should reject negative amounts when updating settlement', async () => {
            // First create a valid settlement
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(100).withNote('Valid settlement').build();

            const settlement = await driver.createSettlement(settlementData, users[0].token);

            // Try to update with negative amount
            const updateData = {
                amount: -75, // Negative amount
            };

            await expect(driver.updateSettlement(settlement.id, updateData, users[0].token)).rejects.toThrow(/Amount must be greater than 0/);
        });

        it('should validate settlement amount does not exceed maximum', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(1000000) // Amount exceeds max of 999,999.99
                .withNote('Test max amount')
                .build();

            await expect(driver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/Amount cannot exceed 999,999.99/);
        });
    });

    describe('Edge Cases', () => {
        it('should reject very small negative numbers', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(-0.01) // Very small negative
                .withDescription('Test tiny negative')
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(driver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
        });

        it('should reject negative infinity', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(Number.NEGATIVE_INFINITY)
                .withDescription('Test negative infinity')
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(driver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0|invalid/i);
        });

        it('should handle NaN values gracefully', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(NaN) // NaN value
                .withDescription('Test NaN')
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(driver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0|invalid/i);
        });
    });
});

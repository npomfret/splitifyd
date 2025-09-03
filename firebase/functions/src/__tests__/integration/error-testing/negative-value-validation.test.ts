import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, ExpenseBuilder, SettlementBuilder, TestGroupManager} from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Negative Value Validation', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);

        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 2 });
    });

    describe('Expense Validation', () => {
        it('should reject negative expense amounts', async () => {
            const uniqueId = uuidv4().slice(0, 8);
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(-100) // Negative amount
                .withDescription(`Test negative expense ${uniqueId}`)
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
        });

        it('should reject zero expense amounts', async () => {
            const uniqueId = uuidv4().slice(0, 8);
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withPaidBy(users[0].uid)
                .withAmount(0) // Zero amount
                .withDescription(`Test zero expense ${uniqueId}`)
                .withCategory('food')
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
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

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/positive/);
        });

        it('should reject negative amounts when updating expense', async () => {
            // First create a valid expense
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

            // Try to update with negative amount
            const updateData = {
                amount: -50, // Negative amount
            };

            await expect(apiDriver.updateExpense(expense.id, updateData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
        });
    });

    describe('Settlement Validation', () => {
        it('should reject negative settlement amounts', async () => {
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

        it('should reject zero settlement amounts', async () => {
            const settlementData = new SettlementBuilder()
                .withGroupId(testGroup.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(0) // Zero amount
                .withNote('Test zero settlement')
                .build();

            await expect(apiDriver.createSettlement(settlementData, users[0].token)).rejects.toThrow(/Amount must be greater than 0/);
        });

        it('should reject negative amounts when updating settlement', async () => {
            // First create a valid settlement
            const uniqueId = uuidv4().slice(0, 8);
            const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(100).withNote(`Valid settlement ${uniqueId}`).build();

            const settlement = await apiDriver.createSettlement(settlementData, users[0].token);

            // Try to update with negative amount
            const updateData = {
                amount: -75, // Negative amount
            };

            await expect(apiDriver.updateSettlement(settlement.id, updateData, users[0].token)).rejects.toThrow(/Amount must be greater than 0/);
        });

        it('should validate settlement amount does not exceed maximum', async () => {
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

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0/);
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

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0|invalid/i);
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

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(/Amount must be a positive number|Amount must be greater than 0|invalid/i);
        });
    });
});

// Integration tests for departed member transaction locking
// Tests that expenses and settlements involving departed members become read-only (locked)

import { calculateEqualSplits, PooledTestUser } from '@splitifyd/shared';
import {
    ApiDriver,
    borrowTestUsers,
    CreateExpenseRequestBuilder,
    CreateSettlementRequestBuilder,
    ExpenseUpdateBuilder,
    NotificationDriver,
    TestGroupManager,
} from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { getFirestore } from '../../firebase';

describe('Departed Member Transaction Locking', () => {
    const apiDriver = new ApiDriver();
    const notificationDriver = new NotificationDriver(getFirestore());
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    afterEach(async () => {
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    describe('Expense Locking - Read Operations', () => {
        test('should include isLocked=false for expenses with all current members', async () => {
            // Create group with 3 members
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense with all current members
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(90)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Get expense details
            const fetchedExpense = await apiDriver.getExpense(expense.id, users[0].token);

            // Verify isLocked is false
            expect(fetchedExpense).toHaveProperty('isLocked');
            expect(fetchedExpense.isLocked).toBe(false);
        });

        test('should include isLocked=true for expenses when a participant has left', async () => {
            // Create group with 3 members
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense with all participants
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(90)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Settle user 1's balance (they owe $30)
            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );

            // User 1 leaves the group
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Get expense details - should now be locked
            const fetchedExpense = await apiDriver.getExpense(expense.id, users[0].token);

            // Verify isLocked is true
            expect(fetchedExpense).toHaveProperty('isLocked');
            expect(fetchedExpense.isLocked).toBe(true);
        });

        test('should include isLocked flag in expense list responses', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create two expenses
            const lockedExpense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Will be locked')
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            const unlockedExpense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Will remain unlocked')
                    .withAmount(90)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Settle and remove user 1 (they owe $30)
            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // List expenses
            const listResponse = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);

            // Find our expenses in the list
            const lockedInList = listResponse.expenses.find((e) => e.id === lockedExpense.id);
            const unlockedInList = listResponse.expenses.find((e) => e.id === unlockedExpense.id);

            // Verify lock status
            expect(lockedInList).toBeDefined();
            expect(lockedInList?.isLocked).toBe(true);
            expect(unlockedInList).toBeDefined();
            expect(unlockedInList?.isLocked).toBe(false);
        });

        test('should include isLocked flag in full details response', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Settle and remove user 1 (they owe $30)
            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Get full details
            const fullDetails = await apiDriver.getExpenseFullDetails(expense.id, users[0].token);

            // Verify lock status in full details
            expect(fullDetails.expense).toHaveProperty('isLocked');
            expect(fullDetails.expense.isLocked).toBe(true);
        });
    });

    describe('Expense Locking - Write Operations', () => {
        test('should prevent editing expense when any participant has left', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(90)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Settle and remove user 1 (they owe $30)
            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Attempt to update expense - should fail
            const updateData = new ExpenseUpdateBuilder()
                .withAmount(120)
                .withCurrency('USD')
                .withDescription('Attempted update')
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .withSplits(calculateEqualSplits(120, 'USD', [users[0].uid, users[1].uid, users[2].uid]))
                .build();

            await expect(apiDriver.updateExpense(expense.id, updateData, users[0].token)).rejects.toThrow(
                /EXPENSE_LOCKED|failed with status 400/,
            );
        });

        test('should allow editing expense when no participants have left', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(90)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Update should succeed (no one has left)
            const updateData = new ExpenseUpdateBuilder()
                .withAmount(120)
                .withCurrency('USD')
                .withDescription('Updated successfully')
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .withSplits(calculateEqualSplits(120, 'USD', [users[0].uid, users[1].uid, users[2].uid]))
                .build();

            await expect(apiDriver.updateExpense(expense.id, updateData, users[0].token)).resolves.toBeDefined();

            // Verify update succeeded
            const updated = await apiDriver.getExpense(expense.id, users[0].token);
            expect(updated.amount).toBe(120);
            expect(updated.description).toBe('Updated successfully');
        });

        test('should prevent creating expense with departed member', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // User 1 leaves (with settled balance)
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Attempt to create expense with departed member - should fail
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withAmount(60)
                .withCurrency('USD')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid]) // includes departed member
                .withSplitType('equal')
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).rejects.toThrow(
                /MEMBER_NOT_IN_GROUP|failed with status 400/,
            );
        });

        test('should allow creating expense with only current members', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // User 1 leaves
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Create expense with only current members - should succeed
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withAmount(60)
                .withCurrency('USD')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[2].uid]) // only current members
                .withSplitType('equal')
                .build();

            await expect(apiDriver.createExpense(expenseData, users[0].token)).resolves.toBeDefined();
        });
    });

    describe('Settlement Locking - Read Operations', () => {
        test('should include isLocked=false for settlements with current members', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense so there's a balance
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Create settlement
            const settlement = await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .build(),
                users[1].token,
            );

            // Get settlements list
            const fullDetails = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

            // Find our settlement
            const fetchedSettlement = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);

            // Verify isLocked is false
            expect(fetchedSettlement).toBeDefined();
            expect(fetchedSettlement).toHaveProperty('isLocked');
            expect(fetchedSettlement?.isLocked).toBe(false);
        });

        test('should include isLocked=true when payer has left', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Create settlement (user 1 owes $30, settle it fully)
            const settlement = await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );

            // User 1 (payer) leaves
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Get settlements list
            const fullDetails = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

            // Find our settlement
            const fetchedSettlement = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);

            // Verify isLocked is true
            expect(fetchedSettlement).toBeDefined();
            expect(fetchedSettlement).toHaveProperty('isLocked');
            expect(fetchedSettlement?.isLocked).toBe(true);
        });

        test('should include isLocked=true when payee has left', async () => {
            // Create group with 4 users so we have more flexibility
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 4), {
                memberCount: 4,
                fresh: true,
            });

            // Create expense so user 1 owes user 3 money
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(users[3].uid)
                    .withParticipants([users[1].uid, users[3].uid])
                    .withSplitType('equal')
                    .build(),
                users[3].token,
            );

            // Create settlement: user 1 pays user 3 (user 3 is payee)
            const settlement = await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[3].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );

            // User 3 (payee) leaves
            await apiDriver.leaveGroup(testGroup.id, users[3].token);

            // Get settlements list (as user 0)
            const fullDetails = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

            // Find our settlement
            const fetchedSettlement = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);

            // Verify isLocked is true
            expect(fetchedSettlement).toBeDefined();
            expect(fetchedSettlement).toHaveProperty('isLocked');
            expect(fetchedSettlement?.isLocked).toBe(true);
        });
    });

    describe('Settlement Locking - Write Operations', () => {
        test('should prevent editing settlement when payer has left', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Create settlement (user 1 owes $30, settle it fully)
            const settlement = await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );

            // User 1 (payer) leaves
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Attempt to update settlement - should fail
            const updateData = {
                amount: 40,
                note: 'Attempted update',
            };

            await expect(apiDriver.updateSettlement(settlement.id, updateData, users[0].token)).rejects.toThrow(
                /SETTLEMENT_LOCKED|failed with status 400/,
            );
        });

        test('should prevent editing settlement when payee has left', async () => {
            // Create group with 4 users so we have more flexibility
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 4), {
                memberCount: 4,
                fresh: true,
            });

            // Create expense so user 1 owes user 3 money
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(users[3].uid)
                    .withParticipants([users[1].uid, users[3].uid])
                    .withSplitType('equal')
                    .build(),
                users[3].token,
            );

            // Create settlement: user 1 pays user 3 (user 3 is payee who will leave)
            const settlement = await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[3].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );

            // User 3 (payee) leaves
            await apiDriver.leaveGroup(testGroup.id, users[3].token);

            // Attempt to update settlement - should fail
            const updateData = {
                amount: 40,
                note: 'Attempted update',
            };

            await expect(apiDriver.updateSettlement(settlement.id, updateData, users[1].token)).rejects.toThrow(
                /SETTLEMENT_LOCKED|failed with status 400/,
            );
        });

        test('should allow editing settlement when both parties are current members', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Create settlement
            const settlement = await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .build(),
                users[1].token,
            );

            // Update should succeed (no one has left) - update as creator (user 1)
            const updateData = {
                amount: 40,
                note: 'Updated payment amount',
            };

            await expect(
                apiDriver.updateSettlement(settlement.id, updateData, users[1].token),
            ).resolves.toBeDefined();

            // Verify update succeeded
            const fullDetails = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
            const updated = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);
            expect(updated?.amount).toBe(40);
            expect(updated?.note).toBe('Updated payment amount');
        });

        test('should prevent creating settlement with departed payer', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // User 1 leaves
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Attempt to create settlement with departed payer - should fail
            await expect(
                apiDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPayerId(users[1].uid) // departed member
                        .withPayeeId(users[0].uid)
                        .build(),
                    users[0].token,
                ),
            ).rejects.toThrow(/MEMBER_NOT_IN_GROUP|failed with status 400/);
        });

        test('should prevent creating settlement with departed payee', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // User 2 leaves
            await apiDriver.leaveGroup(testGroup.id, users[2].token);

            // Attempt to create settlement with departed payee - should fail
            await expect(
                apiDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPayerId(users[1].uid)
                        .withPayeeId(users[2].uid) // departed member
                        .build(),
                    users[1].token,
                ),
            ).rejects.toThrow(/MEMBER_NOT_IN_GROUP|failed with status 400/);
        });
    });

    describe('Edge Cases and Race Conditions', () => {
        test('should handle expense locking when multiple participants leave', async () => {
            // Create group with 4 members
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 4), {
                memberCount: 4,
                fresh: true,
            });

            // Create expense with all 4 participants
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(100)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants(users.slice(0, 4).map((u) => u.uid))
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Settle balances for users 1 and 2 (each owes $25)
            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(25)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );

            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[2].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(25)
                    .withCurrency('USD')
                    .build(),
                users[2].token,
            );

            // Users 1 and 2 leave
            await apiDriver.leaveGroup(testGroup.id, users[1].token);
            await apiDriver.leaveGroup(testGroup.id, users[2].token);

            // Expense should be locked
            const fetchedExpense = await apiDriver.getExpense(expense.id, users[0].token);
            expect(fetchedExpense.isLocked).toBe(true);

            // Should still prevent edits
            await expect(
                apiDriver.updateExpense(
                    expense.id,
                    new ExpenseUpdateBuilder()
                        .withAmount(150)
                        .withCurrency('USD')
                        .withParticipants(users.slice(0, 4).map((u) => u.uid))
                        .withSplits(calculateEqualSplits(150, 'USD', users.slice(0, 4).map((u) => u.uid)))
                        .build(),
                    users[0].token,
                ),
            ).rejects.toThrow(/EXPENSE_LOCKED|failed with status 400/);
        });

        test('should compute lock status dynamically on each read', async () => {
            // Create group
            const testGroup = await TestGroupManager.getOrCreateGroup(users.slice(0, 3), {
                memberCount: 3,
                fresh: true,
            });

            // Create expense
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(60)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Initial read - should NOT be locked
            const beforeLeave = await apiDriver.getExpense(expense.id, users[0].token);
            expect(beforeLeave.isLocked).toBe(false);

            // User 1 settles and leaves (they owe $30)
            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[1].uid)
                    .withPayeeId(users[0].uid)
                    .withAmount(30)
                    .withCurrency('USD')
                    .build(),
                users[1].token,
            );
            await apiDriver.leaveGroup(testGroup.id, users[1].token);

            // Second read - should NOW be locked
            const afterLeave = await apiDriver.getExpense(expense.id, users[0].token);
            expect(afterLeave.isLocked).toBe(true);

            // This confirms lock status is computed dynamically, not stored
        });
    });
});

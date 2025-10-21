// Unit tests for departed member transaction locking
// Tests that expenses and settlements involving departed members become read-only (locked)

import { calculateEqualSplits, GroupId } from '@splitifyd/shared';
import {
    CreateExpenseRequestBuilder,
    CreateSettlementRequestBuilder,
    ExpenseUpdateBuilder,
    SettlementUpdateBuilder,
} from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Departed Member Transaction Locking - Unit Tests', () => {
    let appDriver: AppDriver;
    const userIds = ['user-0', 'user-1', 'user-2', 'user-3'];

    beforeEach(() => {
        appDriver = new AppDriver();

        // Seed users
        userIds.forEach((userId, index) => {
            appDriver.seedUser(userId, {
                displayName: `User ${index}`,
                email: `user${index}@test.local`,
            });
        });
    });

    afterEach(() => {
        appDriver.dispose();
    });

    // Helper function to add members to a group
    const addMembersToGroup = async (groupId: GroupId, ownerUserId: string, memberUserIds: string[]) => {
        const shareLink = await appDriver.generateShareableLink(ownerUserId, groupId);
        for (const userId of memberUserIds) {
            await appDriver.joinGroupByLink(userId, shareLink.linkId);
        }
    };

    describe('Expense Locking - Read Operations', () => {
        test('should include isLocked=false for expenses with all current members', async () => {
            // Create group with 3 members
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1], userIds[2]]);

            // Create expense with all current members
            const expense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
            );

            // Get expense details
            const fetchedExpense = await appDriver.getExpense(userIds[0], expense.id);

            // Verify isLocked is false
            expect(fetchedExpense).toHaveProperty('isLocked');
            expect(fetchedExpense.isLocked).toBe(false);
        });

        test('should include isLocked=true for expenses when a participant has left', async () => {
            // Create group with 3 members
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create expense with all participants
            const expense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
            );

            // Settle user 1's balance (they owe $30)
            await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
            );

            // User 1 leaves the group
            await appDriver.leaveGroup(userIds[1], group.id);

            // Get expense details - should now be locked
            const fetchedExpense = await appDriver.getExpense(userIds[0], expense.id);

            // Verify isLocked is true
            expect(fetchedExpense).toHaveProperty('isLocked');
            expect(fetchedExpense.isLocked).toBe(true);
        });

        test('should include isLocked flag in expense list responses', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create two expenses
            const lockedExpense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Will be locked')
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
            );

            const unlockedExpense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Will remain unlocked')
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[2]])
                    .withSplitType('equal')
                    .build(),
            );

            // Settle and remove user 1 (they owe $30)
            await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
            );
            await appDriver.leaveGroup(userIds[1], group.id);

            // List expenses
            const listResponse = await appDriver.getGroupExpenses(userIds[0], group.id);

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
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            const expense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
            );

            // Settle and remove user 1 (they owe $30)
            await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
            );
            await appDriver.leaveGroup(userIds[1], group.id);

            // Get full details
            const fullDetails = await appDriver.getExpenseFullDetails(userIds[0], expense.id);

            // Verify lock status in full details
            expect(fullDetails.expense).toHaveProperty('isLocked');
            expect(fullDetails.expense.isLocked).toBe(true);
        });
    });

    describe('Expense Locking - Write Operations', () => {
        test('should prevent editing expense when any participant has left', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create expense
            const expense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
            );

            // Settle and remove user 1 (they owe $30)
            await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
            );
            await appDriver.leaveGroup(userIds[1], group.id);

            // Attempt to update expense - should fail
            const updateData = new ExpenseUpdateBuilder()
                .withAmount(120, 'USD')
                .withDescription('Attempted update')
                .withParticipants([userIds[0], userIds[1], userIds[2]])
                .withSplits(calculateEqualSplits(120, 'USD', [userIds[0], userIds[1], userIds[2]]))
                .build();

            await expect(appDriver.updateExpense(userIds[0], expense.id, updateData)).rejects.toThrow(
                /expense.*locked|cannot.*edit.*locked|cannot.*edit.*expense|participants.*left/i,
            );
        });

        test('should allow editing expense when no participants have left', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create expense
            const expense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
            );

            // Update should succeed (no one has left)
            const updateData = new ExpenseUpdateBuilder()
                .withAmount(120, 'USD')
                .withDescription('Updated successfully')
                .withParticipants([userIds[0], userIds[1], userIds[2]])
                .withSplits(calculateEqualSplits(120, 'USD', [userIds[0], userIds[1], userIds[2]]))
                .build();

            await expect(appDriver.updateExpense(userIds[0], expense.id, updateData)).resolves.toBeDefined();

            // Verify update succeeded
            const updated = await appDriver.getExpense(userIds[0], expense.id);
            expect(updated.amount).toBe('120');
            expect(updated.description).toBe('Updated successfully');
        });

        test('should prevent creating expense with departed member', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // User 1 leaves (with settled balance)
            await appDriver.leaveGroup(userIds[1], group.id);

            // Attempt to create expense with departed member - should fail
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(60, 'USD')
                .withPaidBy(userIds[0])
                .withParticipants([userIds[0], userIds[1]]) // includes departed member
                .withSplitType('equal')
                .build();

            await expect(appDriver.createExpense(userIds[0], expenseData)).rejects.toThrow(
                /not.*member|departed|left.*group|cannot.*create.*expense|participant.*not/i,
            );
        });

        test('should allow creating expense with only current members', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // User 1 leaves
            await appDriver.leaveGroup(userIds[1], group.id);

            // Create expense with only current members - should succeed
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(60, 'USD')
                .withPaidBy(userIds[0])
                .withParticipants([userIds[0], userIds[2]]) // only current members
                .withSplitType('equal')
                .build();

            await expect(appDriver.createExpense(userIds[0], expenseData)).resolves.toBeDefined();
        });
    });

    describe('Settlement Locking - Read Operations', () => {
        test('should include isLocked=false for settlements with current members', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense so there's a balance
            await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
            );

            // Create settlement
            const settlement = await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .build(),
            );

            // Get settlements list
            const fullDetails = await appDriver.getGroupFullDetails(userIds[0], group.id);

            // Find our settlement
            const fetchedSettlement = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);

            // Verify isLocked is false
            expect(fetchedSettlement).toBeDefined();
            expect(fetchedSettlement).toHaveProperty('isLocked');
            expect(fetchedSettlement?.isLocked).toBe(false);
        });

        test('should include isLocked=true when payer has left', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
            );

            // Create settlement (user 1 owes $30, settle it fully)
            const settlement = await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
            );

            // User 1 (payer) leaves
            await appDriver.leaveGroup(userIds[1], group.id);

            // Get settlements list
            const fullDetails = await appDriver.getGroupFullDetails(userIds[0], group.id);

            // Find our settlement
            const fetchedSettlement = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);

            // Verify isLocked is true
            expect(fetchedSettlement).toBeDefined();
            expect(fetchedSettlement).toHaveProperty('isLocked');
            expect(fetchedSettlement?.isLocked).toBe(true);
        });

        test('should include isLocked=true when payee has left', async () => {
            // Create group with 4 users so we have more flexibility
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[3]]);

            // Create expense so user 1 owes user 3 money
            await appDriver.createExpense(
                userIds[3],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[3])
                    .withParticipants([userIds[1], userIds[3]])
                    .withSplitType('equal')
                    .build(),
            );

            // Create settlement: user 1 pays user 3 (user 3 is payee)
            const settlement = await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[3])
                    .withAmount(30, 'USD')
                    .build(),
            );

            // User 3 (payee) leaves
            await appDriver.leaveGroup(userIds[3], group.id);

            // Get settlements list (as user 0)
            const fullDetails = await appDriver.getGroupFullDetails(userIds[0], group.id);

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
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
            );

            // Create settlement (user 1 owes $30, settle it fully)
            const settlement = await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
            );

            // User 1 (payer) leaves
            await appDriver.leaveGroup(userIds[1], group.id);

            // Attempt to update settlement - should fail
            const updateData = new SettlementUpdateBuilder()
                .withNote('Attempted update')
                .build();

            await expect(appDriver.updateSettlement(userIds[0], settlement.id, updateData)).rejects.toThrow(
                /settlement.*locked|cannot.*edit.*locked|cannot.*edit.*settlement|payer.*left|payee.*left/i,
            );
        });

        test('should prevent editing settlement when payee has left', async () => {
            // Create group with 4 users so we have more flexibility
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[3]]);

            // Create expense so user 1 owes user 3 money
            await appDriver.createExpense(
                userIds[3],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[3])
                    .withParticipants([userIds[1], userIds[3]])
                    .withSplitType('equal')
                    .build(),
            );

            // Create settlement: user 1 pays user 3 (user 3 is payee who will leave)
            const settlement = await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[3])
                    .withAmount(30, 'USD')
                    .build(),
            );

            // User 3 (payee) leaves
            await appDriver.leaveGroup(userIds[3], group.id);

            // Attempt to update settlement - should fail
            const updateData = new SettlementUpdateBuilder()
                .withNote('Attempted update')
                .build();

            await expect(appDriver.updateSettlement(userIds[1], settlement.id, updateData)).rejects.toThrow(
                /settlement.*locked|cannot.*edit.*locked|cannot.*edit.*settlement|payer.*left|payee.*left/i,
            );
        });

        test('should allow editing settlement when both parties are current members', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create expense
            await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
            );

            // Create settlement
            const settlement = await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withAmount(40, 'USD')
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .build(),
            );

            // Update should succeed (no one has left) - update as creator (user 1)
            const updateData = new SettlementUpdateBuilder()
                .withNote('Updated payment amount')
                .withAmount(40, 'USD')
                .build();

            await expect(appDriver.updateSettlement(userIds[1], settlement.id, updateData)).resolves.toBeDefined();

            // Verify update succeeded
            const fullDetails = await appDriver.getGroupFullDetails(userIds[0], group.id);
            const updated = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);
            expect(updated?.amount).toBe('40');
            expect(updated?.note).toBe('Updated payment amount');
        });

        test('should prevent creating settlement with departed payer', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // User 1 leaves
            await appDriver.leaveGroup(userIds[1], group.id);

            // Attempt to create settlement with departed payer - should fail
            await expect(
                appDriver.createSettlement(
                    userIds[0],
                    new CreateSettlementRequestBuilder()
                        .withGroupId(group.id)
                        .withPayerId(userIds[1]) // departed member
                        .withPayeeId(userIds[0])
                        .build(),
                ),
            ).rejects.toThrow(/not.*member|departed|left.*group|cannot.*create.*settlement/i);
        });

        test('should prevent creating settlement with departed payee', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // User 2 leaves
            await appDriver.leaveGroup(userIds[2], group.id);

            // Attempt to create settlement with departed payee - should fail
            await expect(
                appDriver.createSettlement(
                    userIds[1],
                    new CreateSettlementRequestBuilder()
                        .withGroupId(group.id)
                        .withPayerId(userIds[1])
                        .withPayeeId(userIds[2]) // departed member
                        .build(),
                ),
            ).rejects.toThrow(/not.*member|departed|left.*group|cannot.*create.*settlement/i);
        });
    });

    describe('Edge Cases and Race Conditions', () => {
        test('should handle expense locking when multiple participants leave', async () => {
            // Create group with 4 members
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[3]]);

            // Create expense with all 4 participants
            const expense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants(userIds)
                    .withSplitType('equal')
                    .build(),
            );

            // Settle balances for users 1 and 2 (each owes $25)
            await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(25, 'USD')
                    .build(),
            );

            await appDriver.createSettlement(
                userIds[2],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[2])
                    .withPayeeId(userIds[0])
                    .withAmount(25, 'USD')
                    .build(),
            );

            // Users 1 and 2 leave
            await appDriver.leaveGroup(userIds[1], group.id);
            await appDriver.leaveGroup(userIds[2], group.id);

            // Expense should be locked
            const fetchedExpense = await appDriver.getExpense(userIds[0], expense.id);
            expect(fetchedExpense.isLocked).toBe(true);

            // Should still prevent edits
            await expect(
                appDriver.updateExpense(
                    userIds[0],
                    expense.id,
                    new ExpenseUpdateBuilder()
                        .withAmount(150, 'USD')
                        .withParticipants(userIds)
                        .withSplits(calculateEqualSplits(150, 'USD', userIds))
                        .build(),
                ),
            ).rejects.toThrow(/expense.*locked|cannot.*edit.*locked|cannot.*edit.*expense|participants.*left/i);
        });

        test('should compute lock status dynamically on each read', async () => {
            // Create group
            const group = await appDriver.createGroup(userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            const expense = await appDriver.createExpense(
                userIds[0],
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
            );

            // Initial read - should NOT be locked
            const beforeLeave = await appDriver.getExpense(userIds[0], expense.id);
            expect(beforeLeave.isLocked).toBe(false);

            // User 1 settles and leaves (they owe $30)
            await appDriver.createSettlement(
                userIds[1],
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
            );
            await appDriver.leaveGroup(userIds[1], group.id);

            // Second read - should NOW be locked
            const afterLeave = await appDriver.getExpense(userIds[0], expense.id);
            expect(afterLeave.isLocked).toBe(true);

            // This confirms lock status is computed dynamically, not stored
        });
    });
});

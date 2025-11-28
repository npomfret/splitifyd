// Unit tests for departed member transaction locking
// Tests that expenses and settlements involving departed members become read-only (locked)

import { calculateEqualSplits, GroupId, toAmount, toUserId, USD } from '@billsplit-wl/shared';
import {
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    CreateSettlementRequestBuilder,
    ExpenseUpdateBuilder,
    SettlementUpdateBuilder,
    UserRegistrationBuilder,
} from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Departed Member Transaction Locking - Unit Tests', () => {
    let appDriver: AppDriver;
    let userIds: string[];
    const usd = USD;

    beforeEach(async () => {
        appDriver = new AppDriver();

        // Register users via API instead of seeding
        userIds = [];
        for (let index = 0; index < 4; index++) {
            const registration = new UserRegistrationBuilder()
                .withDisplayName(`User ${index}`)
                .withEmail(`user${index}@test.local`)
                .withPassword('password123456')
                .build();
            const registered = await appDriver.registerUser(registration);
            userIds.push(registered.user.uid);
        }
    });

    afterEach(() => {
        appDriver.dispose();
    });

    // Helper function to add members to a group
    const addMembersToGroup = async (groupId: GroupId, ownerUserId: string, memberUserIds: string[]) => {
        const shareLink = await appDriver.generateShareableLink(groupId, undefined, ownerUserId);
        for (const userId of memberUserIds) {
            await appDriver.joinGroupByLink(shareLink.shareToken, undefined, userId);
        }
    };

    describe('Expense Locking - Read Operations', () => {
        test('should include isLocked=false for expenses with all current members', async () => {
            // Create group with 3 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1], userIds[2]]);

            // Create expense with all current members
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Get expense details
            const fetchedExpense = await appDriver.getExpense(expense.id, userIds[0]);

            // Verify isLocked is false
            expect(fetchedExpense).toHaveProperty('isLocked');
            expect(fetchedExpense.isLocked).toBe(false);
        });

        test('should include isLocked=true for expenses when a participant has left', async () => {
            // Create group with 3 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create expense with all participants
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Settle user 1's balance (they owe $30)
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );

            // User 1 leaves the group
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Get expense details - should now be locked
            const fetchedExpense = await appDriver.getExpense(expense.id, userIds[0]);

            // Verify isLocked is true
            expect(fetchedExpense).toHaveProperty('isLocked');
            expect(fetchedExpense.isLocked).toBe(true);
        });

        test('should include isLocked flag in expense list responses', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create two expenses
            const lockedExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Will be locked')
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            const unlockedExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Will remain unlocked')
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[2]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Settle and remove user 1 (they owe $30)
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // List expenses
            const listResponse = await appDriver.getGroupExpenses(group.id, {}, userIds[0]);

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
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Settle and remove user 1 (they owe $30)
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Get full details
            const fullDetails = await appDriver.getExpenseFullDetails(expense.id, userIds[0]);

            // Verify lock status in full details
            expect(fullDetails.expense).toHaveProperty('isLocked');
            expect(fullDetails.expense.isLocked).toBe(true);
        });
    });

    describe('Expense Locking - Write Operations', () => {
        test('should prevent editing expense when any participant has left', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create expense
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Settle and remove user 1 (they owe $30)
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Attempt to update expense - should fail
            const updateData = new ExpenseUpdateBuilder()
                .withAmount(120, 'USD')
                .withDescription('Attempted update')
                .withParticipants([userIds[0], userIds[1], userIds[2]])
                .withSplits(calculateEqualSplits(toAmount(120), usd, [toUserId(userIds[0]), toUserId(userIds[1]), toUserId(userIds[2])]))
                .build();

            await expect(appDriver.updateExpense(expense.id, updateData, userIds[0])).rejects.toThrow(
                /expense.*locked|cannot.*edit.*locked|cannot.*edit.*expense|participants.*left/i,
            );
        });

        test('should allow editing expense when no participants have left', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create expense
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Update should succeed (no one has left)
            const updateData = new ExpenseUpdateBuilder()
                .withAmount(120, 'USD')
                .withDescription('Updated successfully')
                .withParticipants([userIds[0], userIds[1], userIds[2]])
                .withSplits(calculateEqualSplits(toAmount(120), usd, [toUserId(userIds[0]), toUserId(userIds[1]), toUserId(userIds[2])]))
                .build();

            // Update creates new expense with new ID (edit history via soft deletes)
            const newExpense = await appDriver.updateExpense(expense.id, updateData, userIds[0]);

            // Verify update succeeded using the NEW expense ID
            const updated = await appDriver.getExpense(newExpense.id, userIds[0]);
            expect(updated.amount).toBe('120');
            expect(updated.description).toBe('Updated successfully');
        });

        test('should prevent creating expense with departed member', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // User 1 leaves (with settled balance)
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Attempt to create expense with departed member - should fail
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(60, 'USD')
                .withPaidBy(userIds[0])
                .withParticipants([userIds[0], userIds[1]]) // includes departed member
                .withSplitType('equal')
                .build();

            await expect(appDriver.createExpense(expenseData, userIds[0])).rejects.toThrow(
                /not.*member|departed|left.*group|cannot.*create.*expense|participant.*not/i,
            );
        });

        test('should allow creating expense with only current members', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // User 1 leaves
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Create expense with only current members - should succeed
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(60, 'USD')
                .withPaidBy(userIds[0])
                .withParticipants([userIds[0], userIds[2]]) // only current members
                .withSplitType('equal')
                .build();

            await expect(appDriver.createExpense(expenseData, userIds[0])).resolves.toBeDefined();
        });
    });

    describe('Settlement Locking - Read Operations', () => {
        test('should include isLocked=false for settlements with current members', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense so there's a balance
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Create settlement
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .build(),
                userIds[1],
            );

            // Get settlements list
            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, userIds[0]);

            // Find our settlement
            const fetchedSettlement = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);

            // Verify isLocked is false
            expect(fetchedSettlement).toBeDefined();
            expect(fetchedSettlement).toHaveProperty('isLocked');
            expect(fetchedSettlement?.isLocked).toBe(false);
        });

        test('should include isLocked=true when payer has left', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Create settlement (user 1 owes $30, settle it fully)
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );

            // User 1 (payer) leaves
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Get settlements list
            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, userIds[0]);

            // Find our settlement
            const fetchedSettlement = fullDetails.settlements.settlements.find((s) => s.id === settlement.id);

            // Verify isLocked is true
            expect(fetchedSettlement).toBeDefined();
            expect(fetchedSettlement).toHaveProperty('isLocked');
            expect(fetchedSettlement?.isLocked).toBe(true);
        });

        test('should include isLocked=true when payee has left', async () => {
            // Create group with 4 users so we have more flexibility
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[3]]);

            // Create expense so user 1 owes user 3 money
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[3])
                    .withParticipants([userIds[1], userIds[3]])
                    .withSplitType('equal')
                    .build(),
                userIds[3],
            );

            // Create settlement: user 1 pays user 3 (user 3 is payee)
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[3])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );

            // User 3 (payee) leaves
            await appDriver.leaveGroup(group.id, userIds[3]);

            // Get settlements list (as user 0)
            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, userIds[0]);

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
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Create settlement (user 1 owes $30, settle it fully)
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );

            // User 1 (payer) leaves
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Attempt to update settlement - should fail
            const updateData = new SettlementUpdateBuilder()
                .withNote('Attempted update')
                .build();

            await expect(appDriver.updateSettlement(settlement.id, updateData, userIds[0])).rejects.toThrow(
                /settlement.*locked|cannot.*edit.*locked|cannot.*edit.*settlement|payer.*left|payee.*left/i,
            );
        });

        test('should prevent editing settlement when payee has left', async () => {
            // Create group with 4 users so we have more flexibility
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[3]]);

            // Create expense so user 1 owes user 3 money
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[3])
                    .withParticipants([userIds[1], userIds[3]])
                    .withSplitType('equal')
                    .build(),
                userIds[3],
            );

            // Create settlement: user 1 pays user 3 (user 3 is payee who will leave)
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[3])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );

            // User 3 (payee) leaves
            await appDriver.leaveGroup(group.id, userIds[3]);

            // Attempt to update settlement - should fail
            const updateData = new SettlementUpdateBuilder()
                .withNote('Attempted update')
                .build();

            await expect(appDriver.updateSettlement(settlement.id, updateData, userIds[1])).rejects.toThrow(
                /settlement.*locked|cannot.*edit.*locked|cannot.*edit.*settlement|payer.*left|payee.*left/i,
            );
        });

        test('should allow editing settlement when both parties are current members', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // Create expense
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Create settlement
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withAmount(40, 'USD')
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .build(),
                userIds[1],
            );

            // Update should succeed (no one has left) - update as creator (user 1)
            const updateData = new SettlementUpdateBuilder()
                .withNote('Updated payment amount')
                .withAmount(40, 'USD')
                .build();

            // Update creates new settlement with new ID (edit history via soft deletes)
            const newSettlement = await appDriver.updateSettlement(settlement.id, updateData, userIds[1]);

            // Verify update succeeded using the NEW settlement ID
            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, userIds[0]);
            const updated = fullDetails.settlements.settlements.find((s) => s.id === newSettlement.id);
            expect(updated?.amount).toBe('40');
            expect(updated?.note).toBe('Updated payment amount');
        });

        test('should prevent creating settlement with departed payer', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // User 1 leaves
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Attempt to create settlement with departed payer - should fail
            await expect(
                appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(group.id)
                        .withPayerId(userIds[1]) // departed member
                        .withPayeeId(userIds[0])
                        .build(),
                    userIds[0],
                ),
            )
                .rejects
                .toThrow(/not.*member|departed|left.*group|cannot.*create.*settlement/i);
        });

        test('should prevent creating settlement with departed payee', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);

            // User 2 leaves
            await appDriver.leaveGroup(group.id, userIds[2]);

            // Attempt to create settlement with departed payee - should fail
            await expect(
                appDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(group.id)
                        .withPayerId(userIds[1])
                        .withPayeeId(userIds[2]) // departed member
                        .build(),
                    userIds[1],
                ),
            )
                .rejects
                .toThrow(/not.*member|departed|left.*group|cannot.*create.*settlement/i);
        });
    });

    describe('Edge Cases and Race Conditions', () => {
        test('should handle expense locking when multiple participants leave', async () => {
            // Create group with 4 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[2]]);
            await addMembersToGroup(group.id, userIds[0], [userIds[3]]);

            // Create expense with all 4 participants
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants(userIds)
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Settle balances for users 1 and 2 (each owes $25)
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(25, 'USD')
                    .build(),
                userIds[1],
            );

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[2])
                    .withPayeeId(userIds[0])
                    .withAmount(25, 'USD')
                    .build(),
                userIds[2],
            );

            // Users 1 and 2 leave
            await appDriver.leaveGroup(group.id, userIds[1]);
            await appDriver.leaveGroup(group.id, userIds[2]);

            // Expense should be locked
            const fetchedExpense = await appDriver.getExpense(expense.id, userIds[0]);
            expect(fetchedExpense.isLocked).toBe(true);

            // Should still prevent edits
            await expect(
                appDriver.updateExpense(
                    expense.id,
                    new ExpenseUpdateBuilder()
                        .withAmount(150, 'USD')
                        .withParticipants(userIds)
                        .withSplits(calculateEqualSplits(toAmount(150), usd, userIds.map(toUserId)))
                        .build(),
                    userIds[0],
                ),
            )
                .rejects
                .toThrow(/expense.*locked|cannot.*edit.*locked|cannot.*edit.*expense|participants.*left/i);
        });

        test('should compute lock status dynamically on each read', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(60, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // Initial read - should NOT be locked
            const beforeLeave = await appDriver.getExpense(expense.id, userIds[0]);
            expect(beforeLeave.isLocked).toBe(false);

            // User 1 settles and leaves (they owe $30)
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(30, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Second read - should NOW be locked
            const afterLeave = await appDriver.getExpense(expense.id, userIds[0]);
            expect(afterLeave.isLocked).toBe(true);

            // This confirms lock status is computed dynamically, not stored
        });
    });
});

// Unit tests for departed member access control
// Tests that users who have left a group cannot access expenses, settlements, or group data

import { GroupId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Departed Member Access Control - Unit Tests', () => {
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
        const shareLink = await appDriver.generateShareableLink(groupId, undefined, ownerUserId);
        for (const userId of memberUserIds) {
            await appDriver.joinGroupByLink(shareLink.shareToken, undefined, userId);
        }
    };

    describe('Expense Access After Leaving', () => {
        test('should prevent departed member from viewing individual expense they participated in', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense with both participants
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // User 1 settles their balance and leaves
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 tries to view the expense - should be denied
            await expect(appDriver.getExpense(expense.id, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });

        test('should prevent departed member from viewing expense full details', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // User 1 settles and leaves
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 tries to view full details - should be denied
            await expect(appDriver.getExpenseFullDetails(expense.id, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });

        test('should prevent departed member from listing group expenses', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

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

            // User 1 settles and leaves
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 tries to list group expenses - should be denied
            await expect(appDriver.getGroupExpenses(group.id, {}, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });

        test('should allow departed member to view expenses BEFORE leaving', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // User 1 can view BEFORE leaving
            const expenseBeforeLeaving = await appDriver.getExpense(expense.id, userIds[1]);
            expect(expenseBeforeLeaving.id).toBe(expense.id);
            expect(expenseBeforeLeaving.amount).toBe('100');

            // User 1 settles and leaves
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Now cannot view
            await expect(appDriver.getExpense(expense.id, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });

        test('should prevent departed expense creator from viewing their own expense', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // User 1 creates an expense (they are the creator and payer)
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[1])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[1],
            );

            // User 0 settles their debt ($50 owed to user 1)
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[0])
                    .withPayeeId(userIds[1])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[0],
            );

            // User 1 leaves (now they can leave - balance is settled)
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 (creator) tries to view their own expense - should still be denied
            await expect(appDriver.getExpense(expense.id, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });
    });

    describe('Settlement Access After Leaving', () => {
        test('should prevent departed payer from viewing settlement via group details', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense so there's a balance
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

            // User 1 (payer) creates settlement and leaves
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 tries to access group (which includes settlements) - should be denied
            await expect(appDriver.getGroupFullDetails(group.id, {}, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });

        test('should prevent departed payee from viewing settlement via group details', async () => {
            // Create group with 3 members for flexibility
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1], userIds[2]]);

            // Create expense: user 2 pays, user 1 participates (so user 1 owes user 2)
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[2])
                    .withParticipants([userIds[1], userIds[2]])
                    .withSplitType('equal')
                    .build(),
                userIds[2],
            );

            // User 1 pays user 2 (user 2 is payee)
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[2])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );

            // User 2 (payee) leaves
            await appDriver.leaveGroup(group.id, userIds[2]);

            // User 2 tries to access group - should be denied
            await expect(appDriver.getGroupFullDetails(group.id, {}, userIds[2])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });
    });

    describe('Group-Level Access After Leaving', () => {
        test('should prevent departed member from viewing group full details', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // User 1 leaves
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 tries to view group details - should be denied
            await expect(appDriver.getGroupFullDetails(group.id, {}, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });

        test('should prevent departed member from viewing group balances', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create some balances
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

            // User 1 settles and leaves
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 tries to view balances - should be denied
            await expect(appDriver.getGroupBalances(group.id, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });

        test('should remove departed member from group list', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // User 1 can see the group in their list BEFORE leaving
            const groupsBeforeLeaving = await appDriver.listGroups({}, userIds[1]);
            const foundBeforeLeaving = groupsBeforeLeaving.groups.find((g) => g.id === group.id);
            expect(foundBeforeLeaving).toBeDefined();

            // User 1 leaves
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 should NOT see the group in their list AFTER leaving
            const groupsAfterLeaving = await appDriver.listGroups({}, userIds[1]);
            const foundAfterLeaving = groupsAfterLeaving.groups.find((g) => g.id === group.id);
            expect(foundAfterLeaving).toBeUndefined();
        });

        test('should prevent departed member from viewing group even with outstanding balance', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense but DON'T settle (user 1 still owes money)
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

            // Note: We can't actually leave with outstanding balance, so settle first
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 tries to view group - should be denied
            await expect(appDriver.getGroupFullDetails(group.id, {}, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });
    });

    describe('Edge Cases and Consistency', () => {
        test('should consistently deny access across all endpoints after leaving', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // Create expense
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(userIds[0])
                    .withParticipants([userIds[0], userIds[1]])
                    .withSplitType('equal')
                    .build(),
                userIds[0],
            );

            // User 1 settles and leaves
            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(userIds[1])
                    .withPayeeId(userIds[0])
                    .withAmount(50, 'USD')
                    .build(),
                userIds[1],
            );
            await appDriver.leaveGroup(group.id, userIds[1]);

            // Test ALL endpoints consistently deny access
            await expect(appDriver.getGroupFullDetails(group.id, {}, userIds[1])).rejects.toThrow();
            await expect(appDriver.getGroupBalances(group.id, userIds[1])).rejects.toThrow();
            await expect(appDriver.getGroupExpenses(group.id, {}, userIds[1])).rejects.toThrow();
            await expect(appDriver.getExpense(expense.id, userIds[1])).rejects.toThrow();
            await expect(appDriver.getExpenseFullDetails(expense.id, userIds[1])).rejects.toThrow();
        });

        test('should allow other members to access data after someone leaves', async () => {
            // Create group with 3 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1], userIds[2]]);

            // Create expense with all 3
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

            // User 1 settles and leaves
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

            // User 0 and User 2 can still access everything
            const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, userIds[0]);
            expect(groupDetails.group.id).toBe(group.id);

            const expenseDetails = await appDriver.getExpense(expense.id, userIds[2]);
            expect(expenseDetails.id).toBe(expense.id);
            expect(expenseDetails.isLocked).toBe(true); // Locked because user 1 left

            // User 1 cannot access
            await expect(appDriver.getExpense(expense.id, userIds[1])).rejects.toThrow();
        });

        test('should prevent access immediately after leaving, not with delay', async () => {
            // Create group with 2 members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userIds[0]);
            await addMembersToGroup(group.id, userIds[0], [userIds[1]]);

            // User 1 can access before leaving
            const detailsBeforeLeaving = await appDriver.getGroupFullDetails(group.id, {}, userIds[1]);
            expect(detailsBeforeLeaving.group.id).toBe(group.id);

            // User 1 leaves
            await appDriver.leaveGroup(group.id, userIds[1]);

            // User 1 IMMEDIATELY cannot access (no delay/eventual consistency)
            await expect(appDriver.getGroupFullDetails(group.id, {}, userIds[1])).rejects.toThrow(
                /not.*found|not.*member|access.*denied|404|403/i,
            );
        });
    });
});

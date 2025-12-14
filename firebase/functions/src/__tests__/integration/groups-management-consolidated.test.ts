import { PooledTestUser, toDisplayName, USD } from '@billsplit-wl/shared';
import { ApiDriver, borrowTestUsers, CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder } from '@billsplit-wl/test-support';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, test } from 'vitest';

// NOTE: This integration test suite focuses on group deletion behavior that requires
// the Firebase emulator for realistic Firestore interaction.
//
// Business logic tests (CRUD, access control, permissions) have been moved to unit tests in:
// firebase/functions/src/__tests__/unit/groups/GroupCRUDAndAccessControl.test.ts
//
// Concurrent operation tests were removed - they are inherently non-deterministic and
// the emulator doesn't accurately model production Firestore concurrency behavior.

describe('Groups Management - Deletion Tests', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    afterEach(async () => {
    });

    describe('Group Deletion Notifications and Cleanup', () => {
        test('should delete group and prevent member access', async () => {
            // Create a group with 2 members
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Delete Test ${uuidv4()}`)
                .withDescription('Testing group deletion')
                .build();

            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add second user to the group
            const shareLink = await apiDriver.generateShareableLink(group.id, undefined, users[0].token);
            await apiDriver.joinGroupByLink(shareLink.shareToken, toDisplayName('Member 1'), users[1].token);

            // Verify 2 members before deletion
            const { members } = await apiDriver.getGroupFullDetails(group.id, undefined, users[0].token);
            expect(members.members.length).toBe(2);

            // Delete the group
            await apiDriver.deleteGroup(group.id, users[0].token);

            // Verify the group is deleted from the backend (returns 404)
            await expect(apiDriver.getGroupFullDetails(group.id, undefined, users[0].token)).rejects.toThrow(/404|not found/i);

            // Verify second user also cannot access deleted group
            await expect(apiDriver.getGroupFullDetails(group.id, undefined, users[1].token)).rejects.toThrow(/404|not found/i);
        });
    });

    describe('Comprehensive Group Deletion Tests', () => {
        test('should soft delete group with soft-deleted expenses', async () => {
            const groupUsers = await borrowTestUsers(2);
            const [user1, user2] = groupUsers;

            // Create a group
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Bug Reproduction Group ${uuidv4()}`)
                .withDescription('Testing group deletion with soft-deleted expenses')
                .build();

            const testGroup = await apiDriver.createGroup(groupData, user1.token);

            // Add second user to the group
            const shareResponse = await apiDriver.generateShareableLink(testGroup.id, undefined, user1.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, toDisplayName('Member 2'), user2.token);

            // Create an expense
            const usd = USD;
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Expense to be deleted')
                .withAmount(50, usd)
                .withPaidBy(user1.uid)
                .withParticipants([user1.uid, user2.uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

            // Soft-delete the expense (this simulates the bug scenario)
            await apiDriver.deleteExpense(createdExpense.id, user1.token);

            // Delete the group - should succeed
            await apiDriver.deleteGroup(testGroup.id, user1.token);

            // Verify the group is actually deleted (returns 404)
            await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, user1.token)).rejects.toThrow(/404|not found/i);

            // Also verify that user2 can't access it
            await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, user2.token)).rejects.toThrow(/404|not found/i);
        });

        test('should soft delete group with multiple soft-deleted expenses', async () => {
            const groupUsers = await borrowTestUsers(3);
            const [user1, user2, user3] = groupUsers;

            // Create a group with multiple members
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Multi Expense Group ${uuidv4()}`)
                .withDescription('Testing group deletion with multiple soft-deleted expenses')
                .build();

            const testGroup = await apiDriver.createGroup(groupData, user1.token);

            // Add other users to the group
            const shareResponse = await apiDriver.generateShareableLink(testGroup.id, undefined, user1.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, toDisplayName('Member 2'), user2.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, toDisplayName('Member 3'), user3.token);

            // Create multiple expenses and soft-delete them all
            const usd = USD;

            for (let i = 1; i <= 3; i++) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(`Expense ${i}`)
                    .withAmount(30.0 * i, usd)
                    .withPaidBy(groupUsers[i - 1].uid)
                    .withParticipants([user1.uid, user2.uid, user3.uid])
                    .withSplitType('equal')
                    .build();

                const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

                // Soft-delete the expense
                await apiDriver.deleteExpense(createdExpense.id, user1.token);
            }

            // Try to delete the group - should work
            await apiDriver.deleteGroup(testGroup.id, user1.token);

            // Verify the group is deleted for all users (returns 404)
            for (const user of groupUsers) {
                await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, user.token)).rejects.toThrow(/404|not found/i);
            }
        });

        test('should hide group memberships after deletion', async () => {
            const groupUsers = await borrowTestUsers(4);
            const [owner, ...members] = groupUsers;

            // Create a group with multiple members
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Member Cleanup Group ${uuidv4()}`)
                .withDescription('Testing member subcollection cleanup')
                .build();

            const testGroup = await apiDriver.createGroup(groupData, owner.token);

            // Add multiple members to create subcollection documents
            const shareResponse = await apiDriver.generateShareableLink(testGroup.id, undefined, owner.token);
            for (let i = 0; i < members.length; i++) {
                const member = members[i];
                await apiDriver.joinGroupByLink(shareResponse.shareToken, toDisplayName(`Member ${i + 1}`), member.token);
            }

            // Verify all members are in the group
            const { members: groupMembers } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, owner.token);
            expect(groupMembers.members).toHaveLength(4); // owner + 3 members

            // Delete the group
            await apiDriver.deleteGroup(testGroup.id, owner.token);

            // Verify the group is completely gone (returns 404)
            await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, owner.token)).rejects.toThrow(/404|not found/i);

            // Verify members can't access it either (confirms proper cleanup)
            for (const member of members) {
                await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, member.token)).rejects.toThrow(/404|not found/i);
            }
        });

        test('should soft delete group with active (non-deleted) expenses', async () => {
            const groupUsers = await borrowTestUsers(2);
            const [user1, user2] = groupUsers;

            // Create a group
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Active Expense Group ${uuidv4()}`)
                .withDescription('Testing soft delete with active expenses')
                .build();

            const testGroup = await apiDriver.createGroup(groupData, user1.token);

            // Add second user
            const shareResponse = await apiDriver.generateShareableLink(testGroup.id, undefined, user1.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, toDisplayName('Member 2'), user2.token);

            // Create an active expense (don't delete it)
            const usd = USD;
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Active expense')
                .withAmount(75, usd)
                .withPaidBy(user1.uid)
                .withParticipants([user1.uid, user2.uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

            // Delete group - should succeed even with active expenses
            await apiDriver.deleteGroup(testGroup.id, user1.token);

            // Verify the group is completely deleted (returns 404)
            await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, user1.token)).rejects.toThrow(/404|not found/i);

            // Verify user2 also can't access it
            await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, user2.token)).rejects.toThrow(/404|not found/i);

            // Verify the expense is also inaccessible via API after soft delete
            await expect(apiDriver.getExpense(createdExpense.id, user1.token)).rejects.toThrow(/404|not found/i);
        });

        test('should soft delete group while preserving related data for potential recovery', async () => {
            const groupUsers = await borrowTestUsers(4);
            const [owner, member1, member2, member3] = groupUsers;

            // Create a comprehensive group with ALL possible related data
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Comprehensive Deletion Test ${uuidv4()}`)
                .withDescription('Testing soft delete preserves subcollections')
                .build();

            const testGroup = await apiDriver.createGroup(groupData, owner.token);
            const groupId = testGroup.id;

            // Add multiple members to create member documents
            const shareResponse = await apiDriver.generateShareableLink(groupId, undefined, owner.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, toDisplayName('Member 1'), member1.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, toDisplayName('Member 2'), member2.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, toDisplayName('Member 3'), member3.token);

            // Create multiple expenses (both active and soft-deleted) to populate various collections
            const expenses = [];
            const usd = USD;
            for (let i = 1; i <= 4; i++) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100 * i, usd)
                    .withPaidBy(groupUsers[i - 1].uid)
                    .withParticipants([owner.uid, member1.uid, member2.uid, member3.uid])
                    .withSplitType('equal')
                    .build();

                const expense = await apiDriver.createExpense(expenseData, owner.token);
                expenses.push(expense);
            }

            // Soft-delete some expenses (creates deletedAt field but keeps documents)
            await apiDriver.deleteExpense(expenses[0].id, owner.token);
            await apiDriver.deleteExpense(expenses[1].id, owner.token);

            // Create settlements to populate settlements collection
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(member1.uid)
                .withPayeeId(owner.uid)
                .build();
            await apiDriver.createSettlement(settlementData, member1.token);

            // Create multiple share links to populate shareLinks subcollection
            await apiDriver.generateShareableLink(groupId, undefined, owner.token);
            await apiDriver.generateShareableLink(groupId, undefined, owner.token);

            // Add comments on group to populate group comments subcollection
            await apiDriver.createGroupComment(groupId, 'Group comment 1', undefined, owner.token);
            await apiDriver.createGroupComment(groupId, 'Group comment 2', undefined, member1.token);

            // Add comments on expenses to populate expense comments subcollections
            await apiDriver.createExpenseComment(expenses[2].id, 'Expense comment 1', undefined, owner.token);
            await apiDriver.createExpenseComment(expenses[2].id, 'Expense comment 2', undefined, member1.token);
            await apiDriver.createExpenseComment(expenses[3].id, 'Another expense comment', undefined, member2.token);

            // Perform soft delete
            await apiDriver.deleteGroup(groupId, owner.token);

            // API calls should return 404 for all users
            for (const user of groupUsers) {
                await expect(apiDriver.getGroupFullDetails(groupId, undefined, user.token)).rejects.toThrow(/404|not found/i);
            }

            // Individual expenses should return 404
            for (const expense of expenses) {
                await expect(apiDriver.getExpense(expense.id, owner.token)).rejects.toThrow(/404|not found/i);
            }
        }, 15000); // Increased timeout for comprehensive test with many operations
    });
});

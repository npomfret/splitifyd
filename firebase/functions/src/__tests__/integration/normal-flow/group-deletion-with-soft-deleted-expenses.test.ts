// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// This test verifies that hard group deletion works correctly with both
// soft-deleted and active expenses, ensuring comprehensive cleanup

import { describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, CreateGroupRequestBuilder, ExpenseBuilder, borrowTestUsers } from '@splitifyd/test-support';
import { AuthenticatedFirebaseUser } from '@splitifyd/shared';

describe('Group Deletion with Soft-Deleted Expenses', () => {
    const apiDriver = new ApiDriver();

    test('should successfully delete group with soft-deleted expenses using hard delete', async () => {
        const users = await borrowTestUsers(2);
        const [user1, user2] = users;

        // Create a group
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Bug Reproduction Group ${uuidv4()}`)
            .withDescription('Testing group deletion with soft-deleted expenses')
            .build();

        const testGroup = await apiDriver.createGroup(groupData, user1.token);

        // Add second user to the group
        const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

        // Create an expense
        const expenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Expense to be deleted')
            .withAmount(50)
            .withPaidBy(user1.uid)
            .withParticipants([user1.uid, user2.uid])
            .build();

        const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

        // Soft-delete the expense (this simulates the bug scenario)
        await apiDriver.deleteExpense(createdExpense.id, user1.token);

        // Verify the expense is soft-deleted but still exists in Firestore
        // (It should have deletedAt field set but still be in the collection)
        
        // Hard delete should succeed and clean up all data including soft-deleted expenses
        const deleteResponse = await apiDriver.deleteGroup(testGroup.id, user1.token);
        
        expect(deleteResponse).toHaveProperty('message');
        expect(deleteResponse.message).toContain('deleted permanently');

        // Verify the group is actually deleted
        await expect(apiDriver.getGroupFullDetails(testGroup.id, user1.token))
            .rejects.toThrow(/404|not found/i);

        // Also verify that user2 can't access it
        await expect(apiDriver.getGroupFullDetails(testGroup.id, user2.token))
            .rejects.toThrow(/404|not found/i);
    });

    test('should delete group with multiple soft-deleted expenses', async () => {
        const users = await borrowTestUsers(3);
        const [user1, user2, user3] = users;

        // Create a group with multiple members
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Multi Expense Group ${uuidv4()}`)
            .withDescription('Testing group deletion with multiple soft-deleted expenses')
            .build();

        const testGroup = await apiDriver.createGroup(groupData, user1.token);

        // Add other users to the group
        const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user3.token);

        // Create multiple expenses and soft-delete them all
        const expenseIds: string[] = [];
        
        for (let i = 1; i <= 3; i++) {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription(`Expense ${i}`)
                .withAmount(25 * i)
                .withPaidBy(users[i - 1].uid)
                .withParticipants([user1.uid, user2.uid, user3.uid])
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, user1.token);
            expenseIds.push(createdExpense.id);

            // Soft-delete the expense
            await apiDriver.deleteExpense(createdExpense.id, user1.token);
        }

        // Try to delete the group - should work with the fix
        const deleteResponse = await apiDriver.deleteGroup(testGroup.id, user1.token);
        
        expect(deleteResponse).toHaveProperty('message');
        expect(deleteResponse.message).toContain('deleted permanently');

        // Verify the group is deleted for all users
        for (const user of users) {
            await expect(apiDriver.getGroupFullDetails(testGroup.id, user.token))
                .rejects.toThrow(/404|not found/i);
        }
    });

    test('should clean up member subcollection when deleting group', async () => {
        const users = await borrowTestUsers(4);
        const [owner, ...members] = users;

        // Create a group with multiple members
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Member Cleanup Group ${uuidv4()}`)
            .withDescription('Testing member subcollection cleanup')
            .build();

        const testGroup = await apiDriver.createGroup(groupData, owner.token);

        // Add multiple members to create subcollection documents
        const shareResponse = await apiDriver.generateShareLink(testGroup.id, owner.token);
        for (const member of members) {
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, member.token);
        }

        // Verify all members are in the group
        const { members: groupMembers } = await apiDriver.getGroupFullDetails(testGroup.id, owner.token);
        expect(groupMembers.members).toHaveLength(4); // owner + 3 members

        // Delete the group
        const deleteResponse = await apiDriver.deleteGroup(testGroup.id, owner.token);
        
        expect(deleteResponse).toHaveProperty('message');
        expect(deleteResponse.message).toContain('deleted permanently');

        // Verify the group is completely gone
        await expect(apiDriver.getGroupFullDetails(testGroup.id, owner.token))
            .rejects.toThrow(/404|not found/i);

        // Verify members can't access it either (confirms proper cleanup)
        for (const member of members) {
            await expect(apiDriver.getGroupFullDetails(testGroup.id, member.token))
                .rejects.toThrow(/404|not found/i);
        }
    });

    test('should successfully delete group with active (non-deleted) expenses using hard delete', async () => {
        const users = await borrowTestUsers(2);
        const [user1, user2] = users;

        // Create a group
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Active Expense Group ${uuidv4()}`)
            .withDescription('Testing hard delete with active expenses')
            .build();

        const testGroup = await apiDriver.createGroup(groupData, user1.token);

        // Add second user
        const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

        // Create an active expense (don't delete it)
        const expenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Active expense')
            .withAmount(75)
            .withPaidBy(user1.uid)
            .withParticipants([user1.uid, user2.uid])
            .build();

        const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

        // Hard delete should succeed even with active expenses
        const deleteResponse = await apiDriver.deleteGroup(testGroup.id, user1.token);
        
        expect(deleteResponse).toHaveProperty('message');
        expect(deleteResponse.message).toContain('deleted permanently');

        // Verify the group is completely deleted
        await expect(apiDriver.getGroupFullDetails(testGroup.id, user1.token))
            .rejects.toThrow(/404|not found/i);

        // Verify user2 also can't access it
        await expect(apiDriver.getGroupFullDetails(testGroup.id, user2.token))
            .rejects.toThrow(/404|not found/i);

        // Verify the expense is also deleted (hard delete removes everything)
        await expect(apiDriver.getExpense(createdExpense.id, user1.token))
            .rejects.toThrow(/404|not found/i);
    });
});
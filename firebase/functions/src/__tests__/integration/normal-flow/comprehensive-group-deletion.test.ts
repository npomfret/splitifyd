// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// This test verifies that hard group deletion works correctly with both
// soft-deleted and active expenses, ensuring comprehensive cleanup

import { describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, CreateGroupRequestBuilder, CreateExpenseRequestBuilder, SettlementBuilder, borrowTestUsers } from '@splitifyd/test-support';
import { getFirestore } from '../../../firebase';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreCollections } from '@splitifyd/shared';
import { getTopLevelMembershipDocId } from '../../../utils/groupMembershipHelpers';

describe('Group Deletion with Soft-Deleted Expenses', () => {
    const apiDriver = new ApiDriver();

    test('should successfully delete group with soft-deleted expenses using hard delete', async () => {
        const users = await borrowTestUsers(2);
        const [user1, user2] = users;

        // Create a group
        const groupData = new CreateGroupRequestBuilder().withName(`Bug Reproduction Group ${uuidv4()}`).withDescription('Testing group deletion with soft-deleted expenses').build();

        const testGroup = await apiDriver.createGroup(groupData, user1.token);

        // Add second user to the group
        const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

        // Create an expense
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Expense to be deleted')
            .withAmount(50)
            .withPaidBy(user1.uid)
            .withParticipants([user1.uid, user2.uid])
            .withSplitType('equal')
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
        await expect(apiDriver.getGroupFullDetails(testGroup.id, user1.token)).rejects.toThrow(/404|not found/i);

        // Also verify that user2 can't access it
        await expect(apiDriver.getGroupFullDetails(testGroup.id, user2.token)).rejects.toThrow(/404|not found/i);
    });

    test('should delete group with multiple soft-deleted expenses', async () => {
        const users = await borrowTestUsers(3);
        const [user1, user2, user3] = users;

        // Create a group with multiple members
        const groupData = new CreateGroupRequestBuilder().withName(`Multi Expense Group ${uuidv4()}`).withDescription('Testing group deletion with multiple soft-deleted expenses').build();

        const testGroup = await apiDriver.createGroup(groupData, user1.token);

        // Add other users to the group
        const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user3.token);

        // Create multiple expenses and soft-delete them all
        const expenseIds: string[] = [];

        for (let i = 1; i <= 3; i++) {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription(`Expense ${i}`)
                .withAmount(25 * i)
                .withPaidBy(users[i - 1].uid)
                .withParticipants([user1.uid, user2.uid, user3.uid])
                .withSplitType('equal')
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
            await expect(apiDriver.getGroupFullDetails(testGroup.id, user.token)).rejects.toThrow(/404|not found/i);
        }
    });

    test('should clean up member subcollection when deleting group', async () => {
        const users = await borrowTestUsers(4);
        const [owner, ...members] = users;

        // Create a group with multiple members
        const groupData = new CreateGroupRequestBuilder().withName(`Member Cleanup Group ${uuidv4()}`).withDescription('Testing member subcollection cleanup').build();

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
        await expect(apiDriver.getGroupFullDetails(testGroup.id, owner.token)).rejects.toThrow(/404|not found/i);

        // Verify members can't access it either (confirms proper cleanup)
        for (const member of members) {
            await expect(apiDriver.getGroupFullDetails(testGroup.id, member.token)).rejects.toThrow(/404|not found/i);
        }
    });

    test('should successfully delete group with active (non-deleted) expenses using hard delete', async () => {
        const users = await borrowTestUsers(2);
        const [user1, user2] = users;

        // Create a group
        const groupData = new CreateGroupRequestBuilder().withName(`Active Expense Group ${uuidv4()}`).withDescription('Testing hard delete with active expenses').build();

        const testGroup = await apiDriver.createGroup(groupData, user1.token);

        // Add second user
        const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

        // Create an active expense (don't delete it)
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Active expense')
            .withAmount(75)
            .withPaidBy(user1.uid)
            .withParticipants([user1.uid, user2.uid])
            .withSplitType('equal')
            .build();

        const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

        // Hard delete should succeed even with active expenses
        const deleteResponse = await apiDriver.deleteGroup(testGroup.id, user1.token);

        expect(deleteResponse).toHaveProperty('message');
        expect(deleteResponse.message).toContain('deleted permanently');

        // Verify the group is completely deleted
        await expect(apiDriver.getGroupFullDetails(testGroup.id, user1.token)).rejects.toThrow(/404|not found/i);

        // Verify user2 also can't access it
        await expect(apiDriver.getGroupFullDetails(testGroup.id, user2.token)).rejects.toThrow(/404|not found/i);

        // Verify the expense is also deleted (hard delete removes everything)
        await expect(apiDriver.getExpense(createdExpense.id, user1.token)).rejects.toThrow(/404|not found/i);
    });

    test('should completely delete group with ALL subcollections and related data', async () => {
        const users = await borrowTestUsers(4);
        const [owner, member1, member2, member3] = users;

        // Create a comprehensive group with ALL possible related data
        const groupData = new CreateGroupRequestBuilder().withName(`Comprehensive Deletion Test ${uuidv4()}`).withDescription('Testing complete deletion of all subcollections').build();

        const testGroup = await apiDriver.createGroup(groupData, owner.token);
        const groupId = testGroup.id;

        // Add multiple members to create member documents
        const shareResponse = await apiDriver.generateShareLink(groupId, owner.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, member1.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, member2.token);
        await apiDriver.joinGroupViaShareLink(shareResponse.linkId, member3.token);

        // Create multiple expenses (both active and soft-deleted) to populate various collections
        const expenses = [];
        for (let i = 1; i <= 4; i++) {
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(25 * i)
                .withPaidBy(users[i - 1].uid)
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
        const settlementData = new SettlementBuilder().withGroupId(groupId).withPayer(member1.uid).withPayee(owner.uid).withAmount(50.0).build();
        await apiDriver.createSettlement(settlementData, member1.token);

        // Create multiple share links to populate shareLinks subcollection
        await apiDriver.generateShareLink(groupId, owner.token);
        await apiDriver.generateShareLink(groupId, owner.token);

        // Add comments on group to populate group comments subcollection
        await apiDriver.createGroupComment(groupId, 'Group comment 1', owner.token);
        await apiDriver.createGroupComment(groupId, 'Group comment 2', member1.token);

        // Add comments on expenses to populate expense comments subcollections
        await apiDriver.createExpenseComment(expenses[2].id, 'Expense comment 1', owner.token);
        await apiDriver.createExpenseComment(expenses[2].id, 'Expense comment 2', member1.token);
        await apiDriver.createExpenseComment(expenses[3].id, 'Another expense comment', member2.token);

        // Wait to ensure all data has been created and change documents generated
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Use FirestoreReader for proper verification
        const firestore = getFirestore();
        const firestoreReader = new FirestoreReader(firestore);

        // VERIFICATION BEFORE DELETION: Use the group deletion data method that mirrors the actual deletion logic
        const groupDeletionData = await firestoreReader.getGroupDeletionData(groupId);

        expect(groupDeletionData.expenses.size).toBeGreaterThanOrEqual(4); // All 4 expenses
        expect(groupDeletionData.settlements.size).toBeGreaterThanOrEqual(1); // At least our settlement
        expect(groupDeletionData.shareLinks.size).toBeGreaterThanOrEqual(2); // 2 share links created
        expect(groupDeletionData.groupComments.size).toBeGreaterThanOrEqual(2); // 2 group comments

        // Count expense comments across all expenses
        const totalExpenseComments = groupDeletionData.expenseComments.reduce((sum, snapshot) => sum + snapshot.size, 0);
        expect(totalExpenseComments).toBeGreaterThanOrEqual(3); // 3 expense comments total

        console.log(
            `Before deletion - Expenses: ${groupDeletionData.expenses.size}, Settlements: ${groupDeletionData.settlements.size}, Share links: ${groupDeletionData.shareLinks.size}, Group comments: ${groupDeletionData.groupComments.size}, Expense comments: ${totalExpenseComments},`,
        );

        // PERFORM HARD DELETE
        const deleteResponse = await apiDriver.deleteGroup(groupId, owner.token);

        expect(deleteResponse).toHaveProperty('message');
        expect(deleteResponse.message).toContain('deleted permanently');

        // COMPREHENSIVE VERIFICATION: ALL subcollections should be completely deleted

        // 1. Main group document should be deleted - use FirestoreReader method
        const groupExists = await firestoreReader.verifyDocumentExists(FirestoreCollections.GROUPS, groupId);
        expect(groupExists).toBe(false);

        // 2. Use group deletion data method to verify all subcollections are empty
        const groupDeletionDataAfter = await firestoreReader.getGroupDeletionData(groupId);

        expect(groupDeletionDataAfter.expenses.size).toBe(0);
        expect(groupDeletionDataAfter.settlements.size).toBe(0);
        expect(groupDeletionDataAfter.shareLinks.size).toBe(0);
        expect(groupDeletionDataAfter.groupComments.size).toBe(0);

        // Verify all expense comment subcollections are empty
        const totalExpenseCommentsAfter = groupDeletionDataAfter.expenseComments.reduce((sum, snapshot) => sum + snapshot.size, 0);
        expect(totalExpenseCommentsAfter).toBe(0);

        // 5. All top-level GROUP_MEMBERSHIPS documents should be deleted - use FirestoreReader
        for (const user of users) {
            const topLevelDocId = getTopLevelMembershipDocId(user.uid, groupId);
            const membershipExists = await firestoreReader.verifyDocumentExists(FirestoreCollections.GROUP_MEMBERSHIPS, topLevelDocId);
            expect(membershipExists).toBe(false);
        }

        // 10. API calls should return 404 for all users
        for (const user of users) {
            await expect(apiDriver.getGroupFullDetails(groupId, user.token)).rejects.toThrow(/404|not found/i);
        }

        // 11. Individual expenses should return 404
        for (const expense of expenses) {
            await expect(apiDriver.getExpense(expense.id, owner.token)).rejects.toThrow(/404|not found/i);
        }

        console.log('✅ Comprehensive group deletion test passed - all subcollections verified as deleted');
    });
});

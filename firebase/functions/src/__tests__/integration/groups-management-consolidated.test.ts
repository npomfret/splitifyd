import { calculateEqualSplits, PooledTestUser } from '@splitifyd/shared';
import {
    ApiDriver,
    borrowTestUsers,
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    CreateSettlementRequestBuilder,
    ExpenseUpdateBuilder,
    getFirebaseEmulatorConfig,
    GroupUpdateBuilder,
    SettlementUpdateBuilder,
} from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, test } from 'vitest';
import { getAuth, getFirestore } from '../../firebase';
import { ComponentBuilder } from '../../services/ComponentBuilder';

// NOTE: This integration test suite now focuses exclusively on Firebase-specific features that
// require the emulator: concurrent operations, optimistic locking, and subcollection cleanup.
//
// Business logic tests (CRUD, access control, permissions) have been moved to unit tests in:
// firebase/functions/src/__tests__/unit/groups/GroupCRUDAndAccessControl.test.ts

describe('Groups Management - Concurrent Operations and Deletion Tests', () => {
    const apiDriver = new ApiDriver();
    const identityToolkit = getFirebaseEmulatorConfig().identityToolkit;
    const applicationBuilder = ComponentBuilder.createComponentBuilder(getFirestore(), getAuth(), identityToolkit);
    const firestoreReader = applicationBuilder.buildFirestoreReader();
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    afterEach(async () => {
    });

    describe('Concurrent Operations and Optimistic Locking', () => {
        test('should handle concurrent group joins correctly', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Concurrent Join Test ${uuidv4()}`)
                    .withDescription('Testing concurrent joins')
                    .build(),
                users[0].token,
            );

            // Generate share link
            const shareLink = await apiDriver.generateShareableLink(testGroup.id, undefined, users[0].token);

            // Both users try to join simultaneously
            const joinPromises = [
                apiDriver.joinGroupByLink(shareLink.shareToken, users[1].token),
                apiDriver.joinGroupByLink(shareLink.shareToken, users[2].token),
            ];

            const results = await Promise.allSettled(joinPromises);

            // Both should succeed or handle conflicts gracefully
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            if (failures.length > 0) {
                expect(successes.length).toBeGreaterThan(0);
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorCode = failure.reason?.response?.data?.error?.code;
                        expect(['CONCURRENT_UPDATE', 'ALREADY_MEMBER']).toContain(errorCode);
                    }
                }
            } else {
                expect(successes.length).toBe(2);
            }

            // Verify final state - both users should be members
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, users[0].token);
            expect(members.members.length).toBe(3);
            expect(members.members.find((m) => m.uid === users[1].uid)).toBeDefined();
            expect(members.members.find((m) => m.uid === users[2].uid)).toBeDefined();
        });

        test('should handle concurrent group updates with optimistic locking', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Concurrent Update Test ${uuidv4()}`)
                    .withDescription('Testing concurrent updates')
                    .build(),
                users[0].token,
            );

            // Add second user as member
            const shareLink = await apiDriver.generateShareableLink(testGroup.id, undefined, users[0].token);
            await apiDriver.joinGroupByLink(shareLink.shareToken, users[1].token);

            // Same user tries multiple concurrent updates
            const updatePromises = [
                apiDriver.updateGroup(
                    testGroup.id,
                    new GroupUpdateBuilder()
                        .withName('First Update')
                        .build(),
                    users[0].token,
                ),
                apiDriver.updateGroup(
                    testGroup.id,
                    new GroupUpdateBuilder()
                        .withName('Second Update')
                        .build(),
                    users[0].token,
                ),
                apiDriver.updateGroup(
                    testGroup.id,
                    new GroupUpdateBuilder()
                        .withDescription('Updated description')
                        .build(),
                    users[0].token,
                ),
            ];

            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');
            const conflicts = results.filter(
                (r) =>
                    r.status === 'rejected'
                    && (r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE' || r.reason?.message?.includes('CONCURRENT_UPDATE') || r.reason?.message?.includes('409')),
            );

            // At least one update should succeed
            expect(successes.length).toBeGreaterThan(0);

            // If there are failures, they should be concurrency-related
            if (failures.length > 0) {
                expect(conflicts.length).toBeGreaterThan(0);
            }

            // Verify final state integrity - at least one update should have applied
            const { group: finalGroup } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, users[0].token);
            expect(finalGroup.name === 'First Update' || finalGroup.name === 'Second Update' || finalGroup.description === 'Updated description').toBeTruthy();
        });

        test('should handle concurrent expense operations', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Expense Locking Test ${uuidv4()}`, [users[0], users[1]], users[0].token);

            // Create an expense first
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Test Expense')
                    .withAmount(100, 'USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Try concurrent expense updates
            const concurrentParticipants = [users[0].uid, users[1].uid];
            const updatePromises = [
                apiDriver.updateExpense(
                    expense.id,
                    new ExpenseUpdateBuilder()
                        .withAmount(200, 'USD')
                        .withParticipants(concurrentParticipants)
                        .withSplits(calculateEqualSplits(200, 'USD', concurrentParticipants))
                        .build(),
                    users[0].token,
                ),
                apiDriver.updateExpense(
                    expense.id,
                    new ExpenseUpdateBuilder()
                        .withAmount(300, 'USD')
                        .withParticipants(concurrentParticipants)
                        .withSplits(calculateEqualSplits(300, 'USD', concurrentParticipants))
                        .build(),
                    users[0].token,
                ),
            ];

            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');
            const conflicts = results.filter(
                (r) =>
                    r.status === 'rejected'
                    && (r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE' || r.reason?.message?.includes('CONCURRENT_UPDATE') || r.reason?.message?.includes('409')),
            );

            expect(successes.length).toBeGreaterThan(0);

            if (failures.length > 0) {
                expect(conflicts.length).toBeGreaterThan(0);
            }

            // Verify final state
            const expenses = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            const updatedExpense = expenses.expenses.find((e: any) => e.id === expense.id);
            expect(['200', '300']).toContain(updatedExpense?.amount);
        });

        test('should handle concurrent expense deletion and modification', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Expense Delete Test ${uuidv4()}`, [users[0], users[1]], users[0].token);

            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Test Expense for Deletion')
                    .withAmount(50, 'USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Try concurrent delete and update
            const deleteUpdateParticipants = [users[0].uid, users[1].uid];
            const promises = [
                apiDriver.deleteExpense(expense.id, users[0].token),
                apiDriver.updateExpense(
                    expense.id,
                    new ExpenseUpdateBuilder()
                        .withAmount(75, 'USD')
                        .withParticipants(deleteUpdateParticipants)
                        .withSplits(calculateEqualSplits(75, 'USD', deleteUpdateParticipants))
                        .build(),
                    users[0].token,
                ),
            ];

            const results = await Promise.allSettled(promises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            expect(successes.length).toBeGreaterThanOrEqual(1);

            if (failures.length > 0) {
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorMessage = failure.reason?.message || '';
                        expect(errorMessage).toMatch(/not found|concurrent|conflict|does not exist/i);
                    }
                }
            }

            // Verify final state - expense is either deleted or updated
            try {
                const remainingExpense = await apiDriver.getExpense(expense.id, users[0].token);
                expect(remainingExpense.amount).toBe('75');
            } catch (error: any) {
                expect(error.message).toMatch(/not found|does not exist/i);
            }
        });

        test('should handle concurrent settlement operations', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Settlement Test ${uuidv4()}`, [users[0], users[1]], users[0].token);

            const settlement = await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(users[0].uid)
                    .withPayeeId(users[1].uid)
                    .withAmount(50, 'USD')
                    .withNote('Test settlement')
                    .build(),
                users[0].token,
            );

            // Try concurrent settlement updates
            const updatePromises = [
                apiDriver.updateSettlement(
                    settlement.id,
                    new SettlementUpdateBuilder()
                        .withAmount(75, 'USD')
                        .build(),
                    users[0].token,
                ),
                apiDriver.updateSettlement(
                    settlement.id,
                    new SettlementUpdateBuilder()
                        .withAmount(100, 'USD')
                        .build(),
                    users[0].token,
                ),
            ];

            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');
            const conflicts = failures.filter(
                (r) =>
                    r.status === 'rejected'
                    && (r.reason?.message?.includes('CONCURRENT_UPDATE') || r.reason?.message?.includes('409')),
            );

            expect(successes.length).toBeGreaterThan(0);

            if (failures.length > 0) {
                for (const failure of failures) {
                    console.log(JSON.stringify(failure));
                }
                expect(conflicts.length).toBeGreaterThan(0);
            }

            // Verify final state
            const updatedSettlement = await apiDriver.getSettlement(testGroup.id, settlement.id, users[0].token);
            expect(['75', '100']).toContain(updatedSettlement?.amount);
        });

        test('should handle cross-entity race conditions', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Cross-Entity Race Test ${uuidv4()}`)
                    .withDescription('Testing cross-entity race conditions')
                    .build(),
                users[0].token,
            );

            const shareLink = await apiDriver.generateShareableLink(testGroup.id, undefined, users[0].token);

            // User joins while expense is being created simultaneously
            const promises = [
                apiDriver.joinGroupByLink(shareLink.shareToken, users[1].token),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withDescription('Race condition expense')
                        .withAmount(100, 'USD')
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid])
                        .withSplitType('equal')
                        .build(),
                    users[0].token,
                ),
            ];

            const results = await Promise.allSettled(promises);

            // Both operations should succeed independently
            for (const result of results) {
                expect(result.status).toBe('fulfilled');
            }

            // Verify final state
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, users[0].token);
            const expenses = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);

            expect(members.members.find((m) => m.uid === users[1].uid)).toBeDefined();
            expect(expenses.expenses.length).toBe(1);
            expect(expenses.expenses[0].description).toBe('Race condition expense');
        });
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
            await apiDriver.joinGroupByLink(shareLink.shareToken, users[1].token);

            // Verify 2 members before deletion
            const { members } = await apiDriver.getGroupFullDetails(group.id, undefined, users[0].token);
            expect(members.members.length).toBe(2);

            // Delete the group
            await apiDriver.deleteGroup(group.id, users[0].token);

            const deletedGroup = await firestoreReader.getGroup(group.id, { includeDeleted: true });
            expect(deletedGroup).not.toBeNull();
            expect(deletedGroup?.deletedAt).not.toBeNull();

            // Verify the group is deleted from the backend
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
            await apiDriver.joinGroupByLink(shareResponse.shareToken, user2.token);

            // Create an expense
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Expense to be deleted')
                .withAmount(50, 'USD')
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
            expect(deleteResponse.message).toBe('Group deleted successfully');

            const deletedGroup = await firestoreReader.getGroup(testGroup.id, { includeDeleted: true });
            expect(deletedGroup).not.toBeNull();
            expect(deletedGroup?.deletedAt).not.toBeNull();

            // Verify the group is actually deleted
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
            await apiDriver.joinGroupByLink(shareResponse.shareToken, user2.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, user3.token);

            // Create multiple expenses and soft-delete them all
            const expenseIds: string[] = [];

            for (let i = 1; i <= 3; i++) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(`Expense ${i}`)
                    .withAmount(30.0 * i, 'USD')
                    .withPaidBy(groupUsers[i - 1].uid)
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
            expect(deleteResponse.message).toBe('Group deleted successfully');

            const deletedGroup = await firestoreReader.getGroup(testGroup.id, { includeDeleted: true });
            expect(deletedGroup).not.toBeNull();
            expect(deletedGroup?.deletedAt).not.toBeNull();

            // Verify the group is deleted for all users
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
            for (const member of members) {
                await apiDriver.joinGroupByLink(shareResponse.shareToken, member.token);
            }

            // Verify all members are in the group
            const { members: groupMembers } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, owner.token);
            expect(groupMembers.members).toHaveLength(4); // owner + 3 members

            // Delete the group
            const deleteResponse = await apiDriver.deleteGroup(testGroup.id, owner.token);

            expect(deleteResponse).toHaveProperty('message');
            expect(deleteResponse.message).toBe('Group deleted successfully');

            const deletedGroup = await firestoreReader.getGroup(testGroup.id, { includeDeleted: true });
            expect(deletedGroup).not.toBeNull();
            expect(deletedGroup?.deletedAt).not.toBeNull();

            // Verify the group is completely gone
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
            await apiDriver.joinGroupByLink(shareResponse.shareToken, user2.token);

            // Create an active expense (don't delete it)
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Active expense')
                .withAmount(75, 'USD')
                .withPaidBy(user1.uid)
                .withParticipants([user1.uid, user2.uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

            // Hard delete should succeed even with active expenses
            const deleteResponse = await apiDriver.deleteGroup(testGroup.id, user1.token);

            expect(deleteResponse).toHaveProperty('message');
            expect(deleteResponse.message).toBe('Group deleted successfully');

            const deletedGroup = await firestoreReader.getGroup(testGroup.id, { includeDeleted: true });
            expect(deletedGroup).not.toBeNull();
            expect(deletedGroup?.deletedAt).not.toBeNull();

            // Verify the group is completely deleted
            await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, user1.token)).rejects.toThrow(/404|not found/i);

            // Verify user2 also can't access it
            await expect(apiDriver.getGroupFullDetails(testGroup.id, undefined, user2.token)).rejects.toThrow(/404|not found/i);

            // Verify the expense is also inaccessible via API after soft delete
            await expect(apiDriver.getExpense(createdExpense.id, user1.token)).rejects.toThrow(/404|not found/i);
        });

        test('should soft delete group while preserving related data', async () => {
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
            await apiDriver.joinGroupByLink(shareResponse.shareToken, member1.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, member2.token);
            await apiDriver.joinGroupByLink(shareResponse.shareToken, member3.token);

            // Create multiple expenses (both active and soft-deleted) to populate various collections
            const expenses = [];
            for (let i = 1; i <= 4; i++) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(100 * i, 'USD')
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
            await apiDriver.createGroupComment(groupId, 'Group comment 1', owner.token);
            await apiDriver.createGroupComment(groupId, 'Group comment 2', member1.token);

            // Add comments on expenses to populate expense comments subcollections
            await apiDriver.createExpenseComment(expenses[2].id, 'Expense comment 1', owner.token);
            await apiDriver.createExpenseComment(expenses[2].id, 'Expense comment 2', member1.token);
            await apiDriver.createExpenseComment(expenses[3].id, 'Another expense comment', member2.token);

            // VERIFICATION BEFORE DELETION: Use the group deletion data method that mirrors the actual deletion logic
            const groupDeletionData = await firestoreReader.getGroupDeletionData(groupId);

            expect(groupDeletionData.expenses.size).toBeGreaterThanOrEqual(4); // All 4 expenses
            expect(groupDeletionData.settlements.size).toBeGreaterThanOrEqual(1); // At least our settlement
            expect(groupDeletionData.shareLinks.size).toBeGreaterThanOrEqual(2); // 2 share links created
            expect(groupDeletionData.groupComments.size).toBeGreaterThanOrEqual(2); // 2 group comments

            // Count expense comments across all expenses
            const totalExpenseComments = groupDeletionData.expenseComments.reduce((sum, snapshot) => sum + snapshot.size, 0);
            expect(totalExpenseComments).toBeGreaterThanOrEqual(3); // 3 expense comments total

            // Perform soft delete
            const deleteResponse = await apiDriver.deleteGroup(groupId, owner.token);

            expect(deleteResponse).toHaveProperty('message');
            expect(deleteResponse.message).toBe('Group deleted successfully');

            const deletedGroup = await firestoreReader.getGroup(groupId, { includeDeleted: true });
            expect(deletedGroup).not.toBeNull();
            expect(deletedGroup?.deletedAt).not.toBeNull();

            // COMPREHENSIVE VERIFICATION: Data remains persisted for potential recovery

            const groupDeletionDataAfter = await firestoreReader.getGroupDeletionData(groupId);

            expect(groupDeletionDataAfter.expenses.size).toBeGreaterThanOrEqual(expenses.length);
            expect(groupDeletionDataAfter.settlements.size).toBeGreaterThanOrEqual(1);
            expect(groupDeletionDataAfter.shareLinks.size).toBeGreaterThanOrEqual(2);
            expect(groupDeletionDataAfter.groupComments.size).toBeGreaterThanOrEqual(2);

            const totalExpenseCommentsAfter = groupDeletionDataAfter.expenseComments.reduce((sum, snapshot) => sum + snapshot.size, 0);
            expect(totalExpenseCommentsAfter).toBeGreaterThanOrEqual(3);

            // 10. API calls should return 404 for all users
            for (const user of groupUsers) {
                await expect(apiDriver.getGroupFullDetails(groupId, undefined, user.token)).rejects.toThrow(/404|not found/i);
            }

            // 11. Individual expenses should return 404
            for (const expense of expenses) {
                await expect(apiDriver.getExpense(expense.id, owner.token)).rejects.toThrow(/404|not found/i);
            }
        }, 15000); // Increased timeout for comprehensive test with many operations
    });
});

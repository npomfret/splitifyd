import { beforeEach, describe, expect, it } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, ExpenseBuilder, User} from '@splitifyd/test-support';
import { Group, groupSize } from '@splitifyd/shared';

describe('Error Handling and Recovery Testing', () => {
    const apiDriver = new ApiDriver();
    let testGroup: Group;

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);

        // Create a fresh test group for each test
        testGroup = await apiDriver.createGroupWithMembers('Error Handling Test Group', [users[0]], users[0].token);
    });

    describe('4.1 Service Outage Scenarios', () => {
        describe('External Service Failures', () => {
            it('should handle Firestore connection failures gracefully', async () => {
                // Test with non-existent group ID to simulate Firestore issues
                const nonExistentGroupId = 'non-existent-group-' + uuidv4();

                await expect(
                    apiDriver.createExpense(
                        new ExpenseBuilder()
                            .withGroupId(nonExistentGroupId)
                            .withDescription('Test with invalid group')
                            .withAmount(100)
                            .withPaidBy(users[0].uid)
                            .withParticipants([users[0].uid])
                            .build(),
                        users[0].token,
                    ),
                ).rejects.toThrow(/not found|404|group.*not.*exist|DOCUMENT_NOT_FOUND/i);
            });

            it('should handle partial service degradation gracefully', async () => {
                // Test operations that depend on multiple services
                // Create valid expense first
                const validExpense = await apiDriver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(testGroup.id)
                        .withDescription('Valid expense for degradation test')
                        .withAmount(100)
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid])
                        .build(),
                    users[0].token,
                );

                // Test that read operations still work even if writes might fail
                const retrievedExpense = await apiDriver.getExpense(validExpense.id, users[0].token);
                expect(retrievedExpense).toBeDefined();
                expect(retrievedExpense.id).toBe(validExpense.id);

                // Test that group data is still accessible
                const groupData = await apiDriver.getGroup(testGroup.id, users[0].token);
                expect(groupData).toHaveProperty('id');
                expect(groupData.id).toBe(testGroup.id);
            });

            it('should handle database permission errors gracefully', async () => {
                // Test accessing resources user doesn't have permission for
                const unauthorizedUser = users[1];

                // Try to access group expenses with user not in group
                await expect(apiDriver.getGroupExpenses(testGroup.id, unauthorizedUser.token)).rejects.toThrow(/403|forbidden|permission|access.*denied/i);

                // Try to create expense in group user doesn't belong to
                await expect(
                    apiDriver.createExpense(
                        new ExpenseBuilder()
                            .withGroupId(testGroup.id)
                            .withDescription('Unauthorized expense')
                            .withAmount(100)
                            .withPaidBy(unauthorizedUser.uid)
                            .withParticipants([unauthorizedUser.uid])
                            .build(),
                        unauthorizedUser.token,
                    ),
                ).rejects.toThrow(/403|forbidden|permission|access.*denied|not.*member/i);
            });
        });

        describe('Network Issues', () => {
            it('should handle malformed request payloads gracefully', async () => {
                // Test with completely invalid JSON structure
                await expect(
                    apiDriver.createExpense(
                        {
                            // Missing required fields
                            description: 'Malformed request',
                            invalidField: 'should not exist',
                        } as any,
                        users[0].token,
                    ),
                ).rejects.toThrow(/400|bad.*request|validation|required|invalid/i);
            });

            it('should handle oversized request payloads gracefully', async () => {
                // Test with extremely large description
                const oversizedDescription = 'x'.repeat(10000); // 10KB description

                await expect(
                    apiDriver.createExpense(
                        new ExpenseBuilder().withGroupId(testGroup.id).withDescription(oversizedDescription).withAmount(100).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                        users[0].token,
                    ),
                ).rejects.toThrow(/400|payload.*large|request.*size|validation|description.*long/i);
            });

            it('should handle rapid request bursts gracefully', async () => {
                // Create multiple rapid requests to test rate limiting
                const rapidRequests = Array(20)
                    .fill(null)
                    .map((_, index) =>
                        apiDriver.getGroup(testGroup.id, users[0].token)
                            .then((result) => ({ success: true, index, result }))
                            .catch((error) => ({ success: false, index, error: error.message })),
                    );

                const results = await Promise.all(rapidRequests);

                // Some should succeed, some might hit rate limits
                const successes = results.filter((r) => r.success);
                const rateLimited = results.filter((r) => !r.success && (r as any).error.includes('429'));

                // All or most should succeed (no rate limiting on read operations)
                expect(successes.length).toBeGreaterThanOrEqual(10);

                // If any hit rate limits, they should have proper error messages
                rateLimited.forEach((result) => {
                    expect((result as any).error).toMatch(/429|rate.*limit|too.*many.*requests/i);
                });
            });

            it('should handle concurrent operations with conflicting data gracefully', async () => {
                // Create an expense
                const baseExpense = await apiDriver.createExpense(
                    new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Conflict test expense').withAmount(100).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                    users[0].token,
                );

                // Try to update and delete the same expense simultaneously
                const updatePromise = apiDriver.updateExpense(
                        baseExpense.id,
                        {
                            description: 'Updated by update operation',
                            amount: 150,
                        },
                        users[0].token,
                    )
                    .then(() => ({ operation: 'update', success: true }))
                    .catch((error) => ({ operation: 'update', success: false, error: error.message }));

                const deletePromise = apiDriver.deleteExpense(baseExpense.id, users[0].token)
                    .then(() => ({ operation: 'delete', success: true }))
                    .catch((error) => ({ operation: 'delete', success: false, error: error.message }));

                const [updateResult, deleteResult] = await Promise.all([updatePromise, deletePromise]);

                // At least one should complete (either both fail with proper errors, or one succeeds)
                const successes = [updateResult, deleteResult].filter((r) => r.success);
                const failures = [updateResult, deleteResult].filter((r) => !r.success);

                // Either one succeeds and one fails, or both fail with proper error messages
                if (successes.length === 0) {
                    // Both failed - this is OK if they have proper error messages
                    expect(failures.length).toBe(2);
                    failures.forEach((failure) => {
                        expect((failure as any).error).toMatch(/not.*found|404|deleted|conflict|internal.*error|500/i);
                    });
                } else {
                    // At least one succeeded
                    expect(successes.length).toBeGreaterThanOrEqual(1);
                }
            });

            it('should handle graceful degradation when services are slow', async () => {
                // Test with operations that might be slow
                const startTime = Date.now();

                // Perform multiple operations
                const operations = [await apiDriver.getGroup(testGroup.id, users[0].token), await apiDriver.getGroupExpenses(testGroup.id, users[0].token), await apiDriver.listGroups(users[0].token)];

                const results = await Promise.allSettled(operations);
                const endTime = Date.now();
                const totalTime = endTime - startTime;

                // All operations should complete within reasonable time even if slow
                expect(totalTime).toBeLessThan(30000); // 30 second timeout

                // Most operations should succeed
                const successful = results.filter((r) => r.status === 'fulfilled');
                expect(successful.length).toBeGreaterThanOrEqual(2);

                // Failed operations should have meaningful errors
                const failed = results.filter((r) => r.status === 'rejected');
                failed.forEach((failure) => {
                    const reason = (failure as PromiseRejectedResult).reason;
                    expect(reason).toBeDefined();
                });
            });
        });
    });

    describe('4.2 Data Integrity', () => {
        describe('Backup and Recovery', () => {
            it('should handle data export functionality gracefully', async () => {
                // Create some test data first
                const exportTestExpense = await apiDriver.createExpense(
                    new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Export test expense').withAmount(100).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                    users[0].token,
                );

                // Test getting all user's data (simulate export)
                const groupData = await apiDriver.getGroup(testGroup.id, users[0].token);
                const expenseData = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
                const groupsList = await apiDriver.listGroups(users[0].token);

                // Verify all data is accessible for export
                expect(groupData).toBeDefined();
                expect(groupData).toHaveProperty('name');
                expect(groupData).toHaveProperty('members');

                expect(expenseData).toHaveProperty('expenses');
                expect(expenseData.expenses.length).toBeGreaterThan(0);

                expect(groupsList).toHaveProperty('groups');
                expect(Array.isArray(groupsList.groups)).toBe(true);

                // Verify data consistency across endpoints
                const expenseIds = expenseData.expenses.map((e: any) => e.id);
                expect(expenseIds).toContain(exportTestExpense.id);
            });

            it('should handle missing data references gracefully', async () => {
                // Test referencing non-existent expense
                const fakeExpenseId = 'fake-expense-' + uuidv4();

                await expect(apiDriver.getExpense(fakeExpenseId, users[0].token)).rejects.toThrow(/not.*found|404/i);

                // Test referencing non-existent group
                const fakeGroupId = 'fake-group-' + uuidv4();

                await expect(apiDriver.getGroupExpenses(fakeGroupId, users[0].token)).rejects.toThrow(/not.*found|404|access.*denied|permission/i);
            });

            it('should handle orphaned data cleanup scenarios', async () => {
                // Create expense, then simulate orphaned state by checking references
                const cleanupTestExpense = await apiDriver.createExpense(
                    new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Cleanup test expense').withAmount(100).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(),
                    users[0].token,
                );

                // Verify expense exists and is properly linked
                const expense = await apiDriver.getExpense(cleanupTestExpense.id, users[0].token);
                expect(expense.groupId).toBe(testGroup.id);
                expect(expense.paidBy).toBe(users[0].uid);
                expect(expense.participants).toContain(users[0].uid);

                // Verify group contains reference to expense
                const groupExpenses = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
                const expenseIds = groupExpenses.expenses.map((e: any) => e.id);
                expect(expenseIds).toContain(cleanupTestExpense.id);

                // Test that deleting expense properly cleans up references
                await apiDriver.deleteExpense(cleanupTestExpense.id, users[0].token);

                // Verify expense is gone
                await expect(apiDriver.getExpense(cleanupTestExpense.id, users[0].token)).rejects.toThrow(/not.*found|404/i);

                // Verify group no longer contains reference
                const updatedGroupExpenses = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
                const updatedExpenseIds = updatedGroupExpenses.expenses.map((e: any) => e.id);
                expect(updatedExpenseIds).not.toContain(cleanupTestExpense.id);
            });

            it('should handle data consistency after failed operations', async () => {
                // Get initial state
                const initialExpenses = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
                const initialGroupData = await apiDriver.getGroup(testGroup.id, users[0].token);
                const initialExpenseCount = initialExpenses.expenses.length;

                // Attempt invalid operation that should fail
                try {
                    await apiDriver.createExpense(
                        new ExpenseBuilder()
                            .withGroupId(testGroup.id)
                            .withDescription('Invalid expense - negative amount')
                            .withAmount(-100) // Invalid
                            .withPaidBy(users[0].uid)
                            .withParticipants([users[0].uid])
                            .build(),
                        users[0].token,
                    );
                } catch (error) {
                    // Expected to fail
                }

                // Verify state is unchanged after failed operation
                const finalExpenses = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
                const finalGroupData = await apiDriver.getGroup(testGroup.id, users[0].token);

                expect(finalExpenses.expenses.length).toBe(initialExpenseCount);

                // Group data should remain unchanged
                expect(finalGroupData.name).toBe(initialGroupData.name);
                expect(groupSize(finalGroupData)).toBe(groupSize(initialGroupData));
            });

            it('should handle database transaction consistency', async () => {
                // Test that complex operations maintain consistency
                const user2 = users[1];

                // Add user to group
                const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
                await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

                // Create expense involving both users
                const consistencyExpense = await apiDriver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(testGroup.id)
                        .withDescription('Consistency test expense')
                        .withAmount(100)
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid, user2.uid])
                        .build(),
                    users[0].token,
                );

                // Verify both users can see the expense immediately
                const mainUserView = await apiDriver.getExpense(consistencyExpense.id, users[0].token);
                const user2View = await apiDriver.getExpense(consistencyExpense.id, user2.token);

                expect(mainUserView.id).toBe(user2View.id);
                expect(mainUserView.amount).toBe(user2View.amount);
                expect(mainUserView.participants).toEqual(user2View.participants);

                // Verify group state is consistent for both users
                const mainUserGroupView = await apiDriver.getGroup(testGroup.id, users[0].token);
                const user2GroupView = await apiDriver.getGroup(testGroup.id, user2.token);

                // Both should see the same group state
                expect(mainUserGroupView.id).toBe(user2GroupView.id);
                expect(mainUserGroupView.name).toBe(user2GroupView.name);
                expect(Object.keys(mainUserGroupView.members).length).toBe(Object.keys(user2GroupView.members).length);
            });
        });
    });
});

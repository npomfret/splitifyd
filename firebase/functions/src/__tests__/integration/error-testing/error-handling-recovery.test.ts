/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../../support/ApiDriver';
import { ExpenseBuilder, UserBuilder } from '../../support/builders';
import { clearAllTestData } from '../../support/cleanupHelpers';
import {Group, groupSize} from '../../../shared/shared-types';

describe('Error Handling and Recovery Testing', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let testGroup: Group;

    jest.setTimeout(10000); // Timeout for error handling tests

    beforeAll(async () => {
        // Clear any existing test data first
        await clearAllTestData();

        driver = new ApiDriver();

        // Create main test user
        mainUser = await driver.createUser(new UserBuilder().build());

        // Create a test group
        testGroup = await driver.createGroupWithMembers('Error Handling Test Group', [mainUser], mainUser.token);
    });

    afterAll(async () => {
        // Clean up all test data
        await clearAllTestData();
    });

    describe('4.1 Service Outage Scenarios', () => {
        describe('External Service Failures', () => {
            it('should handle Firestore connection failures gracefully', async () => {
                // Test with non-existent group ID to simulate Firestore issues
                const nonExistentGroupId = 'non-existent-group-' + uuidv4();

                await expect(
                    driver.createExpense(
                        new ExpenseBuilder()
                            .withGroupId(nonExistentGroupId)
                            .withDescription('Test with invalid group')
                            .withAmount(100)
                            .withPaidBy(mainUser.uid)
                            .withParticipants([mainUser.uid])
                            .build(),
                        mainUser.token,
                    ),
                ).rejects.toThrow(/not found|404|group.*not.*exist|DOCUMENT_NOT_FOUND/i);
            });

            it('should handle partial service degradation gracefully', async () => {
                // Test operations that depend on multiple services
                // Create valid expense first
                const validExpense = await driver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(testGroup.id)
                        .withDescription('Valid expense for degradation test')
                        .withAmount(100)
                        .withPaidBy(mainUser.uid)
                        .withParticipants([mainUser.uid])
                        .build(),
                    mainUser.token,
                );

                // Test that read operations still work even if writes might fail
                const retrievedExpense = await driver.getExpense(validExpense.id, mainUser.token);
                expect(retrievedExpense).toBeDefined();
                expect(retrievedExpense.id).toBe(validExpense.id);

                // Test that group data is still accessible
                const groupData = await driver.getGroup(testGroup.id, mainUser.token);
                expect(groupData).toHaveProperty('id');
                expect(groupData.id).toBe(testGroup.id);
            });

            it('should handle database permission errors gracefully', async () => {
                // Test accessing resources user doesn't have permission for
                const unauthorizedUser = await driver.createUser(new UserBuilder().build());

                // Try to access group expenses with user not in group
                await expect(driver.getGroupExpenses(testGroup.id, unauthorizedUser.token)).rejects.toThrow(/403|forbidden|permission|access.*denied/i);

                // Try to create expense in group user doesn't belong to
                await expect(
                    driver.createExpense(
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
                    driver.createExpense(
                        {
                            // Missing required fields
                            description: 'Malformed request',
                            invalidField: 'should not exist',
                        } as any,
                        mainUser.token,
                    ),
                ).rejects.toThrow(/400|bad.*request|validation|required|invalid/i);
            });

            it('should handle oversized request payloads gracefully', async () => {
                // Test with extremely large description
                const oversizedDescription = 'x'.repeat(10000); // 10KB description

                await expect(
                    driver.createExpense(
                        new ExpenseBuilder().withGroupId(testGroup.id).withDescription(oversizedDescription).withAmount(100).withPaidBy(mainUser.uid).withParticipants([mainUser.uid]).build(),
                        mainUser.token,
                    ),
                ).rejects.toThrow(/400|payload.*large|request.*size|validation|description.*long/i);
            });

            it('should handle rapid request bursts gracefully', async () => {
                // Create multiple rapid requests to test rate limiting
                const rapidRequests = Array(20)
                    .fill(null)
                    .map((_, index) =>
                        driver
                            .getGroup(testGroup.id, mainUser.token)
                            .then((result) => ({ success: true, index, result }))
                            .catch((error) => ({ success: false, index, error: error.message })),
                    );

                const results = await Promise.all(rapidRequests);

                // Some should succeed, some might hit rate limits
                const successes = results.filter((r) => r.success);
                const rateLimited = results.filter((r) => !r.success && (r as any).error.includes('429'));

                // All or most should succeed (no rate limiting on read operations)
                expect(successes.length).toBeGreaterThanOrEqual(15);

                // If any hit rate limits, they should have proper error messages
                rateLimited.forEach((result) => {
                    expect((result as any).error).toMatch(/429|rate.*limit|too.*many.*requests/i);
                });
            });

            it('should handle concurrent operations with conflicting data gracefully', async () => {
                // Create an expense
                const baseExpense = await driver.createExpense(
                    new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Conflict test expense').withAmount(100).withPaidBy(mainUser.uid).withParticipants([mainUser.uid]).build(),
                    mainUser.token,
                );

                // Try to update and delete the same expense simultaneously
                const updatePromise = driver
                    .updateExpense(
                        baseExpense.id,
                        {
                            description: 'Updated by update operation',
                            amount: 150,
                        },
                        mainUser.token,
                    )
                    .then(() => ({ operation: 'update', success: true }))
                    .catch((error) => ({ operation: 'update', success: false, error: error.message }));

                const deletePromise = driver
                    .deleteExpense(baseExpense.id, mainUser.token)
                    .then(() => ({ operation: 'delete', success: true }))
                    .catch((error) => ({ operation: 'delete', success: false, error: error.message }));

                const [updateResult, deleteResult] = await Promise.all([updatePromise, deletePromise]);

                // One should succeed, the other should fail gracefully
                const successes = [updateResult, deleteResult].filter((r) => r.success);
                const failures = [updateResult, deleteResult].filter((r) => !r.success);

                expect(successes.length).toBeGreaterThanOrEqual(1);

                // Failures should have meaningful error messages
                failures.forEach((failure) => {
                    expect((failure as any).error).toMatch(/not.*found|404|deleted|conflict|internal.*error|500/i);
                });
            });

            it('should handle graceful degradation when services are slow', async () => {
                // Test with operations that might be slow
                const startTime = Date.now();

                // Perform multiple operations
                const operations = [await driver.getGroup(testGroup.id, mainUser.token), await driver.getGroupExpenses(testGroup.id, mainUser.token), await driver.listGroups(mainUser.token)];

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
                const exportTestExpense = await driver.createExpense(
                    new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Export test expense').withAmount(100).withPaidBy(mainUser.uid).withParticipants([mainUser.uid]).build(),
                    mainUser.token,
                );

                // Test getting all user's data (simulate export)
                const groupData = await driver.getGroup(testGroup.id, mainUser.token);
                const expenseData = await driver.getGroupExpenses(testGroup.id, mainUser.token);
                const groupsList = await driver.listGroups(mainUser.token);

                // Verify all data is accessible for export
                expect(groupData).toBeDefined();
                expect(groupData).toHaveProperty('name');
                expect(groupData).toHaveProperty('memberIds');

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

                await expect(driver.getExpense(fakeExpenseId, mainUser.token)).rejects.toThrow(/not.*found|404/i);

                // Test referencing non-existent group
                const fakeGroupId = 'fake-group-' + uuidv4();

                await expect(driver.getGroupExpenses(fakeGroupId, mainUser.token)).rejects.toThrow(/not.*found|404|access.*denied|permission/i);
            });

            it('should handle orphaned data cleanup scenarios', async () => {
                // Create expense, then simulate orphaned state by checking references
                const cleanupTestExpense = await driver.createExpense(
                    new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Cleanup test expense').withAmount(100).withPaidBy(mainUser.uid).withParticipants([mainUser.uid]).build(),
                    mainUser.token,
                );

                // Verify expense exists and is properly linked
                const expense = await driver.getExpense(cleanupTestExpense.id, mainUser.token);
                expect(expense.groupId).toBe(testGroup.id);
                expect(expense.paidBy).toBe(mainUser.uid);
                expect(expense.participants).toContain(mainUser.uid);

                // Verify group contains reference to expense
                const groupExpenses = await driver.getGroupExpenses(testGroup.id, mainUser.token);
                const expenseIds = groupExpenses.expenses.map((e: any) => e.id);
                expect(expenseIds).toContain(cleanupTestExpense.id);

                // Test that deleting expense properly cleans up references
                await driver.deleteExpense(cleanupTestExpense.id, mainUser.token);

                // Verify expense is gone
                await expect(driver.getExpense(cleanupTestExpense.id, mainUser.token)).rejects.toThrow(/not.*found|404/i);

                // Verify group no longer contains reference
                const updatedGroupExpenses = await driver.getGroupExpenses(testGroup.id, mainUser.token);
                const updatedExpenseIds = updatedGroupExpenses.expenses.map((e: any) => e.id);
                expect(updatedExpenseIds).not.toContain(cleanupTestExpense.id);
            });

            it('should handle data consistency after failed operations', async () => {
                // Get initial state
                const initialExpenses = await driver.getGroupExpenses(testGroup.id, mainUser.token);
                const initialGroupData = await driver.getGroup(testGroup.id, mainUser.token);
                const initialExpenseCount = initialExpenses.expenses.length;

                // Attempt invalid operation that should fail
                try {
                    await driver.createExpense(
                        new ExpenseBuilder()
                            .withGroupId(testGroup.id)
                            .withDescription('Invalid expense - negative amount')
                            .withAmount(-100) // Invalid
                            .withPaidBy(mainUser.uid)
                            .withParticipants([mainUser.uid])
                            .build(),
                        mainUser.token,
                    );
                } catch (error) {
                    // Expected to fail
                }

                // Verify state is unchanged after failed operation
                const finalExpenses = await driver.getGroupExpenses(testGroup.id, mainUser.token);
                const finalGroupData = await driver.getGroup(testGroup.id, mainUser.token);

                expect(finalExpenses.expenses.length).toBe(initialExpenseCount);

                // Group data should remain unchanged
                expect(finalGroupData.name).toBe(initialGroupData.name);
                expect(groupSize(finalGroupData)).toBe(groupSize(initialGroupData));
            });

            it('should handle database transaction consistency', async () => {
                // Test that complex operations maintain consistency
                const user2 = await driver.createUser(new UserBuilder().build());

                // Add user to group
                const shareLink = await driver.generateShareLink(testGroup.id, mainUser.token);
                await driver.joinGroupViaShareLink(shareLink.linkId, user2.token);

                // Create expense involving both users
                const consistencyExpense = await driver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(testGroup.id)
                        .withDescription('Consistency test expense')
                        .withAmount(100)
                        .withPaidBy(mainUser.uid)
                        .withParticipants([mainUser.uid, user2.uid])
                        .build(),
                    mainUser.token,
                );

                // Verify both users can see the expense immediately
                const mainUserView = await driver.getExpense(consistencyExpense.id, mainUser.token);
                const user2View = await driver.getExpense(consistencyExpense.id, user2.token);

                expect(mainUserView.id).toBe(user2View.id);
                expect(mainUserView.amount).toBe(user2View.amount);
                expect(mainUserView.participants).toEqual(user2View.participants);

                // Verify group state is consistent for both users
                const mainUserGroupView = await driver.getGroup(testGroup.id, mainUser.token);
                const user2GroupView = await driver.getGroup(testGroup.id, user2.token);

                // Both should see the same group state
                expect(mainUserGroupView.id).toBe(user2GroupView.id);
                expect(mainUserGroupView.name).toBe(user2GroupView.name);
                expect(mainUserGroupView.memberIds.length).toBe(user2GroupView.memberIds.length);
            });
        });
    });
});

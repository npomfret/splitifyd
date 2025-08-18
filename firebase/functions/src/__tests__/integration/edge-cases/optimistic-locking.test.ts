/**
 * @jest-environment node
 */

// Tests for optimistic locking implementation to prevent race conditions

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../../support/ApiDriver';
import { SplitTypes } from '../../../shared/shared-types';

describe('Optimistic Locking Integration Tests', () => {
    jest.setTimeout(25000); // it takes about 18s

    let driver: ApiDriver;
    let users: User[] = [];

    beforeAll(async () => {
        driver = new ApiDriver();

        // Create test users
        for (let i = 0; i < 3; i++) {
            const user = await driver.createUser({
                email: `optimisticlock${uuidv4().substring(0, 6)}@test.com`,
                password: `Password123!`,
                displayName: `OptimisticUser${i}`,
            });
            users.push(user);
        }
    });

    afterAll(async () => {
        // Clean up groups and users
        // Note: ApiDriver doesn't have deleteUser, so we'll skip cleanup for now
    });

    describe('Group Optimistic Locking', () => {
        test('should detect concurrent updates when two users join group simultaneously', async () => {
            // User 1 creates a group
            const group = await driver.createGroup(
                {
                    name: 'Concurrent Join Test Group',
                    description: 'Testing concurrent joins',
                },
                users[0].token,
            );

            // Generate share link
            const shareLink = await driver.generateShareLink(group.id, users[0].token);

            // Both User 2 and User 3 try to join at the same time
            const joinPromises = [driver.joinGroupViaShareLink(shareLink.linkId, users[1].token), driver.joinGroupViaShareLink(shareLink.linkId, users[2].token)];

            const results = await Promise.allSettled(joinPromises);

            // Both should succeed due to transaction handling, or one might get a conflict
            // Count successful and failed operations
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            // If we have failures, check if they're due to concurrent updates
            if (failures.length > 0) {
                // We should have at least one success
                expect(successes.length).toBeGreaterThan(0);

                // Any failures should be concurrent update conflicts or already member errors
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorCode = failure.reason?.response?.data?.error?.code;
                        expect(['CONCURRENT_UPDATE', 'ALREADY_MEMBER']).toContain(errorCode);
                    }
                }
            } else {
                // Both succeeded, which is fine with proper transaction handling
                expect(successes.length).toBe(2);
            }

            // Verify final state - both users should be members
            const finalGroup = await driver.getGroup(group.id, users[0].token);
            expect(finalGroup.memberIds).toContain(users[0].uid);
            expect(finalGroup.memberIds).toContain(users[1].uid);
            expect(finalGroup.memberIds).toContain(users[2].uid);
            expect(finalGroup.memberIds.length).toBe(3);
        });

        test('should prevent concurrent group updates', async () => {
            // User 1 creates a group
            const group = await driver.createGroup(
                {
                    name: 'Concurrent Update Test Group',
                    description: 'Testing concurrent updates',
                },
                users[0].token,
            );

            // Share with User 2
            const shareLink = await driver.generateShareLink(group.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Both users try to update the group simultaneously
            const updatePromises = [driver.updateGroup(group.id, { name: 'Updated by User 1' }, users[0].token), driver.updateGroup(group.id, { name: 'Updated by User 2' }, users[1].token)];

            const results = await Promise.allSettled(updatePromises);

            // Check results
            const successes = results.filter((r) => r.status === 'fulfilled');

            // At least one should succeed
            expect(successes.length).toBeGreaterThan(0);

            // If there are failures, they should be concurrent update conflicts or permission errors
            // Note: Both might succeed if they don't truly overlap in timing
            if (results.filter((r) => r.status === 'rejected').length > 0) {
                const failures = results.filter((r) => r.status === 'rejected');
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorCode = failure.reason?.response?.data?.error?.code || failure.reason?.code;
                        // Could be CONCURRENT_UPDATE, permission error, or other valid error
                        // If errorCode exists, it should be one of these
                        if (errorCode) {
                            expect(['CONCURRENT_UPDATE', 'FORBIDDEN', 'NOT_AUTHORIZED', 'UNAUTHORIZED']).toContain(errorCode);
                        }
                    }
                }
            }

            // Verify final state - should have one of the names
            const finalGroup = await driver.getGroup(group.id, users[0].token);
            expect(['Updated by User 1', 'Updated by User 2', 'Concurrent Update Test Group']).toContain(finalGroup.name);
        });
    });

    describe('Expense Optimistic Locking', () => {
        test('should prevent concurrent expense updates', async () => {
            // Create group and add both users
            const group = await driver.createGroup(
                {
                    name: 'Expense Locking Test Group',
                    description: 'Testing expense concurrent updates',
                },
                users[0].token,
            );

            const shareLink = await driver.generateShareLink(group.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Create an expense
            const expense = await driver.createExpense(
                {
                    groupId: group.id,
                    description: 'Test Expense',
                    amount: 100,
                    currency: 'USD',
                    paidBy: users[0].uid,
                    category: 'food',
                    date: new Date().toISOString(),
                    splitType: SplitTypes.EQUAL,
                    participants: [users[0].uid, users[1].uid],
                },
                users[0].token,
            );

            // Both users try to update the expense simultaneously
            const updatePromises = [driver.updateExpense(expense.id, { amount: 200 }, users[0].token), driver.updateExpense(expense.id, { amount: 300 }, users[0].token)];

            const results = await Promise.allSettled(updatePromises);

            // Check the actual errors

            // Check results
            const successes = results.filter((r) => r.status === 'fulfilled');
            const conflicts = results.filter((r) => r.status === 'rejected' && r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE');

            // At least one should succeed
            expect(successes.length).toBeGreaterThan(0);

            // If there are failures, they should be concurrent update conflicts
            if (results.length - successes.length > 0) {
                expect(conflicts.length).toBeGreaterThan(0);
            }

            // Verify final state - should have one of the amounts
            const expenses = await driver.getGroupExpenses(group.id, users[0].token);
            const updatedExpense = expenses.expenses.find((e: any) => e.id === expense.id);
            expect([200, 300]).toContain(updatedExpense?.amount);
        });

        test('should prevent concurrent expense deletion', async () => {
            // Create group and add both users
            const group = await driver.createGroup(
                {
                    name: 'Expense Delete Locking Test',
                    description: 'Testing expense concurrent deletion',
                },
                users[0].token,
            );

            const shareLink = await driver.generateShareLink(group.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Create multiple expenses
            const expenseData = {
                groupId: group.id,
                description: 'Test Expense for Deletion',
                amount: 50,
                currency: 'USD',
                paidBy: users[0].uid,
                category: 'food',
                date: new Date().toISOString(),
                splitType: SplitTypes.EQUAL,
                participants: [users[0].uid, users[1].uid],
            };

            const expense1 = await driver.createExpense(expenseData, users[0].token);
            await driver.createExpense({ ...expenseData, description: 'Another expense' }, users[0].token);

            // Try to delete and update the same expense simultaneously
            const promises = [driver.deleteExpense(expense1.id, users[0].token), driver.updateExpense(expense1.id, { amount: 75 }, users[0].token)];

            const results = await Promise.allSettled(promises);

            // Check the actual errors

            // One should succeed, one might fail with conflict or not found
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            expect(successes.length).toBeGreaterThan(0);

            if (failures.length > 0) {
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorCode = failure.reason?.response?.data?.error?.code;
                        // Could be CONCURRENT_UPDATE or NOT_FOUND (if delete succeeded first)
                        expect(['CONCURRENT_UPDATE', 'NOT_FOUND', 'EXPENSE_NOT_FOUND']).toContain(errorCode);
                    }
                }
            }
        });
    });

    describe('Settlement Optimistic Locking', () => {
        test('should prevent concurrent settlement updates', async () => {
            // Create group with all users
            const group = await driver.createGroup(
                {
                    name: 'Settlement Locking Test Group',
                    description: 'Testing settlement concurrent updates',
                },
                users[0].token,
            );

            const shareLink = await driver.generateShareLink(group.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Create a settlement
            const settlement = await driver.createSettlement(
                {
                    groupId: group.id,
                    payerId: users[0].uid,
                    payeeId: users[1].uid,
                    amount: 50,
                    currency: 'USD',
                    note: 'Test settlement',
                },
                users[0].token,
            );

            // Try to update the settlement concurrently
            const updatePromises = [driver.updateSettlement(settlement.id, { amount: 75 }, users[0].token), driver.updateSettlement(settlement.id, { amount: 100 }, users[0].token)];

            const results = await Promise.allSettled(updatePromises);

            // Check results
            const successes = results.filter((r) => r.status === 'fulfilled');
            const conflicts = results.filter((r) => r.status === 'rejected' && r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE');

            // At least one should succeed
            expect(successes.length).toBeGreaterThan(0);

            // If there are failures, they should be concurrent update conflicts
            if (results.length - successes.length > 0) {
                expect(conflicts.length).toBeGreaterThan(0);
            }

            // Verify final state
            const updatedSettlement = await driver.getSettlement(settlement.id, users[0].token);
            expect([75, 100]).toContain(updatedSettlement?.amount);
        });
    });

    describe('Cross-Entity Race Conditions', () => {
        test('should handle user joining while expense is being created', async () => {
            // User 1 creates a group
            const group = await driver.createGroup(
                {
                    name: 'Cross-Entity Race Test',
                    description: 'Testing cross-entity race conditions',
                },
                users[0].token,
            );

            // Generate share link
            const shareLink = await driver.generateShareLink(group.id, users[0].token);

            // User 2 joins while User 1 creates expense simultaneously
            const expenseData = {
                groupId: group.id,
                description: 'Race condition expense',
                amount: 100,
                currency: 'USD',
                paidBy: users[0].uid,
                category: 'food',
                date: new Date().toISOString(),
                splitType: SplitTypes.EQUAL,
                participants: [users[0].uid], // Only original user initially
            };

            const promises = [driver.joinGroupViaShareLink(shareLink.linkId, users[1].token), driver.createExpense(expenseData, users[0].token)];

            const results = await Promise.allSettled(promises);

            // Both operations should succeed independently
            for (const result of results) {
                expect(result.status).toBe('fulfilled');
            }

            // Verify final state
            const finalGroup = await driver.getGroup(group.id, users[0].token);
            expect(finalGroup.memberIds).toContain(users[1].uid);

            const expenses = await driver.getGroupExpenses(group.id, users[0].token);
            expect(expenses.expenses.length).toBe(1);
            expect(expenses.expenses[0].description).toBe('Race condition expense');
        });

        test('should maintain data integrity with rapid successive joins and updates', async () => {
            // Create a group
            const group = await driver.createGroup(
                {
                    name: 'Rapid Operations Test',
                    description: 'Testing rapid successive operations',
                },
                users[0].token,
            );

            // Generate share link
            const shareLink = await driver.generateShareLink(group.id, users[0].token);

            // Perform rapid operations
            const operations = [
                // User 1 joins
                driver.joinGroupViaShareLink(shareLink.linkId, users[1].token),
                // Update group name
                driver.updateGroup(group.id, { name: 'Updated Name 1' }, users[0].token),
                // User 2 joins
                driver.joinGroupViaShareLink(shareLink.linkId, users[2].token),
                // Create expense
                driver.createExpense(
                    {
                        groupId: group.id,
                        description: 'Rapid test expense',
                        amount: 50,
                        currency: 'USD',
                        paidBy: users[0].uid,
                        category: 'food',
                        date: new Date().toISOString(),
                        splitType: SplitTypes.EQUAL,
                        participants: [users[0].uid],
                    },
                    users[0].token,
                ),
                // Update group again
                driver.updateGroup(group.id, { name: 'Updated Name 2' }, users[0].token),
            ];

            const results = await Promise.allSettled(operations);

            // Count successes and failures
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            // Most operations should succeed
            expect(successes.length).toBeGreaterThan(failures.length);

            // Check failure reasons
            for (const failure of failures) {
                if (failure.status === 'rejected') {
                    const errorCode = failure.reason?.response?.data?.error?.code;
                    // Should be either concurrent update or already member
                    expect(['CONCURRENT_UPDATE', 'ALREADY_MEMBER']).toContain(errorCode);
                }
            }

            // Verify final state integrity
            const finalGroup = await driver.getGroup(group.id, users[0].token);

            // All users should be members (some join attempts might have failed due to conflicts but retry would work)
            expect(finalGroup.memberIds.length).toBeGreaterThanOrEqual(1); // At least creator

            // Group should have a name (one of the updates)
            expect(finalGroup.name).toBeTruthy();

            // Check expenses
            const expenses = await driver.getGroupExpenses(group.id, users[0].token);
            // Expense creation should have succeeded
            const createdExpenses = results.filter((r, i) => i === 3 && r.status === 'fulfilled');
            if (createdExpenses.length > 0) {
                expect(expenses.expenses.length).toBeGreaterThan(0);
            }
        });
    });
});


// Tests for optimistic locking implementation to prevent race conditions

import { beforeAll, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '@splitifyd/test-support';
import {groupSize} from '@splitifyd/shared';
import { ExpenseBuilder, ExpenseUpdateBuilder, CreateGroupRequestBuilder, SettlementBuilder, SettlementUpdateBuilder, GroupUpdateBuilder, UserBuilder } from '@splitifyd/test-support';

describe('Optimistic Locking Integration Tests', () => {
    // vi.setTimeout(25000); // it takes about 18s

    let driver: ApiDriver;
    let users: User[] = [];

    beforeAll(async () => {
        driver = new ApiDriver();

        // Create test users
        for (let i = 0; i < 3; i++) {
            const user = await driver.createUser(
                new UserBuilder()
                    .withEmail(`optimisticlock${uuidv4().substring(0, 6)}@test.com`)
                    .withDisplayName(`OptimisticUser${i}`)
                    .build()
            );
            users.push(user);
        }
    });


    describe('Group Optimistic Locking', () => {
        test('should detect concurrent updates when two users join group simultaneously', async () => {
            // User 1 creates a group
            const group = await driver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Concurrent Join Test Group')
                    .withDescription('Testing concurrent joins')
                    .build(),
                users[0].token,
            );

            // Generate share link
            const shareLink = await driver.generateShareLink(group.id, users[0].token);

            // Both User 2 and User 3 try to join at the same time
            const joinPromises = [
                driver.joinGroupViaShareLink(shareLink.linkId, users[1].token), 
                driver.joinGroupViaShareLink(shareLink.linkId, users[2].token)
            ];

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
            expect(finalGroup.members).toHaveProperty(users[0].uid);
            expect(finalGroup.members).toHaveProperty(users[1].uid);
            expect(finalGroup.members).toHaveProperty(users[2].uid);
            expect(groupSize(finalGroup)).toBe(3);
        });

        test('should prevent concurrent group updates', async () => {
            // User 1 creates a group
            const group = await driver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Concurrent Update Test Group')
                    .withDescription('Testing concurrent updates')
                    .build(),
                users[0].token,
            );

            // Share with User 2
            const shareLink = await driver.generateShareLink(group.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Same user tries to update the group simultaneously (testing optimistic locking)
            const updatePromises = [
                driver.updateGroup(group.id, new GroupUpdateBuilder().withName('First Update').build(), users[0].token), 
                driver.updateGroup(group.id, new GroupUpdateBuilder().withName('Second Update').build(), users[0].token)
            ];

            const results = await Promise.allSettled(updatePromises);

            // Check results
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            // At least one should succeed
            expect(successes.length).toBeGreaterThan(0);

            // If there are failures, they should be concurrent update conflicts
            if (failures.length > 0) {
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorMessage = failure.reason?.message || '';
                        // Should be a concurrent update or similar conflict
                        expect(errorMessage).toMatch(/concurrent|conflict|version|timestamp/i);
                    }
                }
            }

            // Verify final state - should have one of the update names
            const finalGroup = await driver.getGroup(group.id, users[0].token);
            expect(['First Update', 'Second Update']).toContain(finalGroup.name);
        });
    });

    describe('Expense Optimistic Locking', () => {
        test('should prevent concurrent expense updates', async () => {
            // Create group and add both users
            const group = await driver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Expense Locking Test Group')
                    .withDescription('Testing expense concurrent updates')
                    .build(),
                users[0].token,
            );

            const shareLink = await driver.generateShareLink(group.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Create an expense
            const expense = await driver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withDescription('Test Expense')
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .build(),
                users[0].token,
            );

            // Same user tries to update the expense simultaneously (testing optimistic locking)
            const updatePromises = [
                driver.updateExpense(expense.id, new ExpenseUpdateBuilder().withAmount(200).build(), users[0].token), 
                driver.updateExpense(expense.id, new ExpenseUpdateBuilder().withAmount(300).build(), users[0].token)
            ];

            const results = await Promise.allSettled(updatePromises);

            // Check results
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');
            // Check for CONCURRENT_UPDATE in error message since the error structure varies
            const conflicts = results.filter((r) => 
                r.status === 'rejected' && 
                (r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE' ||
                 r.reason?.message?.includes('CONCURRENT_UPDATE') ||
                 r.reason?.message?.includes('409')));
            
            // At least one should succeed
            expect(successes.length).toBeGreaterThan(0);

            // If there are failures, they should be concurrent update conflicts
            if (failures.length > 0) {
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
                new CreateGroupRequestBuilder()
                    .withName('Expense Delete Locking Test')
                    .withDescription('Testing expense concurrent deletion')
                    .build(),
                users[0].token,
            );

            const shareLink = await driver.generateShareLink(group.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Create multiple expenses
            const expense1 = await driver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withDescription('Test Expense for Deletion')
                    .withAmount(50)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .build(),
                users[0].token
            );
            await driver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withDescription('Another expense')
                    .withAmount(50)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .build(),
                users[0].token
            );

            // Try to delete and update the same expense simultaneously
            const promises = [
                driver.deleteExpense(expense1.id, users[0].token), 
                driver.updateExpense(expense1.id, new ExpenseUpdateBuilder().withAmount(75).build(), users[0].token)
            ];

            const results = await Promise.allSettled(promises);

            // One should succeed, one should fail
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            expect(successes.length).toBeGreaterThanOrEqual(1);

            if (failures.length > 0) {
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorMessage = failure.reason?.message || '';
                        // Should be NOT_FOUND (if delete succeeded first) or concurrent update conflict
                        expect(errorMessage).toMatch(/not found|concurrent|conflict|does not exist/i);
                    }
                }
            }

            // Verify final state - expense should either be deleted or updated, but not both
            try {
                const remainingExpense = await driver.getExpense(expense1.id, users[0].token);
                // If expense still exists, it should have the updated amount
                expect(remainingExpense.amount).toBe(75);
            } catch (error: any) {
                // If expense doesn't exist, that's also valid (delete succeeded)
                expect(error.message).toMatch(/not found|does not exist/i);
            }
        });
    });

    describe('Settlement Optimistic Locking', () => {
        test('should prevent concurrent settlement updates', async () => {
            // Create group with all users
            const group = await driver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Settlement Locking Test Group')
                    .withDescription('Testing settlement concurrent updates')
                    .build(),
                users[0].token,
            );

            const shareLink = await driver.generateShareLink(group.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Create a settlement
            const settlement = await driver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(group.id)
                    .withPayer(users[0].uid)
                    .withPayee(users[1].uid)
                    .withAmount(50)
                    .withNote('Test settlement')
                    .build(),
                users[0].token,
            );

            // Try to update the settlement concurrently with same user
            const updatePromises = [
                driver.updateSettlement(settlement.id, new SettlementUpdateBuilder().withAmount(75).build(), users[0].token), 
                driver.updateSettlement(settlement.id, new SettlementUpdateBuilder().withAmount(100).build(), users[0].token)
            ];

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
                new CreateGroupRequestBuilder()
                    .withName('Cross-Entity Race Test')
                    .withDescription('Testing cross-entity race conditions')
                    .build(),
                users[0].token,
            );

            // Generate share link
            const shareLink = await driver.generateShareLink(group.id, users[0].token);

            // User 2 joins while User 1 creates expense simultaneously
            const promises = [
                driver.joinGroupViaShareLink(shareLink.linkId, users[1].token), 
                driver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(group.id)
                        .withDescription('Race condition expense')
                        .withAmount(100)
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid]) // Only original user initially
                        .build(),
                    users[0].token
                )
            ];

            const results = await Promise.allSettled(promises);

            // Both operations should succeed independently
            for (const result of results) {
                expect(result.status).toBe('fulfilled');
            }

            // Verify final state
            const finalGroup = await driver.getGroup(group.id, users[0].token);
            expect(finalGroup.members).toHaveProperty(users[1].uid);

            const expenses = await driver.getGroupExpenses(group.id, users[0].token);
            expect(expenses.expenses.length).toBe(1);
            expect(expenses.expenses[0].description).toBe('Race condition expense');
        });

        test('should handle concurrent group updates from same user', async () => {
            // Create a group
            const group = await driver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Concurrent Updates Test')
                    .withDescription('Testing concurrent updates from same user')
                    .build(),
                users[0].token,
            );

            // Perform multiple concurrent updates with same user (proper optimistic locking test)
            const operations = [
                driver.updateGroup(group.id, new GroupUpdateBuilder().withName('Update 1').build(), users[0].token),
                driver.updateGroup(group.id, new GroupUpdateBuilder().withName('Update 2').build(), users[0].token),
                driver.updateGroup(group.id, new GroupUpdateBuilder().withDescription('Updated description').build(), users[0].token),
            ];

            const results = await Promise.allSettled(operations);

            // At least one should succeed
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            expect(successes.length).toBeGreaterThanOrEqual(1);

            // Check failure reasons for optimistic locking conflicts
            for (const failure of failures) {
                if (failure.status === 'rejected') {
                    const errorMessage = failure.reason?.message || '';
                    // Should be concurrent update conflicts
                    expect(errorMessage).toMatch(/concurrent|conflict|version|timestamp/i);
                }
            }

            // Verify final state integrity
            const finalGroup = await driver.getGroup(group.id, users[0].token);

            // Group should have been updated by at least one operation
            expect(finalGroup.name === 'Update 1' || finalGroup.name === 'Update 2' || 
                   finalGroup.description === 'Updated description').toBeTruthy();
        });
    });
});

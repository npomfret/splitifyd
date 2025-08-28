// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '@splitifyd/test-support';
import { ExpenseBuilder, UserBuilder } from '@splitifyd/test-support';
import { SecurityPresets, MemberRoles, Group } from '@splitifyd/shared';

describe('Permission System Edge Cases', () => {
    let driver: ApiDriver;
    let users: User[] = [];

    beforeAll(async () => {
        driver = new ApiDriver();

        // Create test users
        users = await Promise.all([
            driver.createUser(new UserBuilder().withName('Edge Admin').build()),
            driver.createUser(new UserBuilder().withName('Edge Member').build()),
            driver.createUser(new UserBuilder().withName('Edge Viewer').build()),
            driver.createUser(new UserBuilder().withName('Non Member').build()),
        ]);
    });

    describe('Non-member Access Attempts', () => {
        let testGroup: Group;

        beforeAll(async () => {
            const groupName = `Non-member Test ${uuidv4()}`;
            testGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 2), users[0].token);
        });

        test('non-member cannot create expenses', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Non-member attempt')
                .withAmount(50)
                .withPaidBy(users[3].uid)
                .withParticipants([users[3].uid])
                .withCategory('food')
                .build();

            await expect(driver.createExpense(expenseData, users[3].token)).rejects.toThrow(/failed with status 403/);
        });

        test('non-member cannot access group expenses', async () => {
            await expect(driver.getGroupExpenses(testGroup.id, users[3].token)).rejects.toThrow(/failed with status 403/);
        });

        test('non-member cannot change group settings', async () => {
            await expect(
                driver.apiRequest(
                    `/groups/${testGroup.id}/security/preset`,
                    'POST',
                    {
                        preset: SecurityPresets.MANAGED,
                    },
                    users[3].token,
                ),
            ).rejects.toThrow(/failed with status 403/);
        });
    });

    describe('Invalid Parameter Handling', () => {
        let edgeGroup: Group;

        beforeAll(async () => {
            const groupName = `Edge Parameters Test ${uuidv4()}`;
            edgeGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 3), users[0].token);
        });

        test('invalid security preset rejected', async () => {
            await expect(
                driver.apiRequest(
                    `/groups/${edgeGroup.id}/security/preset`,
                    'POST',
                    {
                        preset: 'invalid-preset',
                    },
                    users[0].token,
                ),
            ).rejects.toThrow(/failed with status 400/);
        });

        test('invalid member role rejected', async () => {
            await expect(
                driver.apiRequest(
                    `/groups/${edgeGroup.id}/members/${users[1].uid}/role`,
                    'PUT',
                    {
                        role: 'invalid-role',
                    },
                    users[0].token,
                ),
            ).rejects.toThrow(/failed with status 400/);
        });

        test('changing role of non-existent member fails', async () => {
            await expect(
                driver.apiRequest(
                    `/groups/${edgeGroup.id}/members/non-existent-user/role`,
                    'PUT',
                    {
                        role: MemberRoles.MEMBER,
                    },
                    users[0].token,
                ),
            ).rejects.toThrow(/failed with status 404/);
        });

        test('empty permissions object rejected', async () => {
            await expect(
                driver.apiRequest(
                    `/groups/${edgeGroup.id}/permissions`,
                    'PUT',
                    {
                        permissions: null,
                    },
                    users[0].token,
                ),
            ).rejects.toThrow(/failed with status 400/);
        });
    });

    describe('Permission Cache Invalidation', () => {
        let cacheGroup: Group;

        beforeAll(async () => {
            const groupName = `Cache Test ${uuidv4()}`;
            cacheGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 2), users[0].token);
        });

        test('role change invalidates permissions immediately', async () => {
            // First, member can create expenses (open collaboration default)
            const expenseData = new ExpenseBuilder()
                .withGroupId(cacheGroup.id)
                .withDescription('Before role change')
                .withAmount(100)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);
            expect(expense.id).toBeDefined();

            // Switch to managed group preset
            await driver.apiRequest(
                `/groups/${cacheGroup.id}/security/preset`,
                'POST',
                {
                    preset: SecurityPresets.MANAGED,
                },
                users[0].token,
            );

            // Set users[1] as viewer
            await driver.apiRequest(
                `/groups/${cacheGroup.id}/members/${users[1].uid}/role`,
                'PUT',
                {
                    role: MemberRoles.VIEWER,
                },
                users[0].token,
            );

            // Now viewer cannot create expenses (permission should be immediately invalidated)
            const newExpenseData = new ExpenseBuilder()
                .withGroupId(cacheGroup.id)
                .withDescription('After role change')
                .withAmount(50)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('food')
                .build();

            await expect(driver.createExpense(newExpenseData, users[1].token)).rejects.toThrow(/failed with status 403/);
        });

        test('preset change affects permissions immediately', async () => {
            // Create new group starting with managed preset
            const managedGroupName = `Managed Cache Test ${uuidv4()}`;
            const managedGroup = await driver.createGroupWithMembers(managedGroupName, users.slice(0, 2), users[0].token);

            // Apply managed preset
            await driver.apiRequest(
                `/groups/${managedGroup.id}/security/preset`,
                'POST',
                {
                    preset: SecurityPresets.MANAGED,
                },
                users[0].token,
            );

            // Member cannot edit admin's expense in managed mode
            const adminExpenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Admin expense')
                .withAmount(200)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withCategory('food')
                .build();

            const adminExpense = await driver.createExpense(adminExpenseData, users[0].token);

            // Member cannot edit admin's expense
            await expect(driver.updateExpense(adminExpense.id, { description: 'Unauthorized edit' }, users[1].token)).rejects.toThrow(/failed with status 403/);

            // Switch to open collaboration
            await driver.apiRequest(
                `/groups/${managedGroup.id}/security/preset`,
                'POST',
                {
                    preset: SecurityPresets.OPEN,
                },
                users[0].token,
            );

            // Now member CAN edit admin's expense (permission immediately updated)
            const updatedExpense = await driver.updateExpense(adminExpense.id, { description: 'Now allowed edit' }, users[1].token);
            expect(updatedExpense.description).toBe('Now allowed edit');
        });
    });

    describe('Custom Permission Combinations', () => {
        let customGroup: Group;

        beforeAll(async () => {
            const groupName = `Custom Permissions Test ${uuidv4()}`;
            customGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 3), users[0].token);
        });

        test('custom permission combination works correctly', async () => {
            // Create custom permission set: anyone can edit, but only admins can delete
            await driver.apiRequest(
                `/groups/${customGroup.id}/permissions`,
                'PUT',
                {
                    permissions: {
                        expenseEditing: 'anyone',
                        expenseDeletion: 'admin-only',
                    },
                },
                users[0].token,
            );

            // Create expense as member
            const expenseData = new ExpenseBuilder()
                .withGroupId(customGroup.id)
                .withDescription('Custom permission test')
                .withAmount(75)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);

            // Member can edit (expenseEditing: anyone)
            const updatedExpense = await driver.updateExpense(expense.id, { description: 'Member edited' }, users[1].token);
            expect(updatedExpense.description).toBe('Member edited');

            // But member cannot delete (expenseDeletion: admin-only)
            await expect(driver.deleteExpense(expense.id, users[1].token)).rejects.toThrow(/failed with status 403/);

            // Admin can delete
            await driver.deleteExpense(expense.id, users[0].token);
        });

        test('mixed permission levels work as expected', async () => {
            // Set mixed permissions: members can manage expenses but not settings
            await driver.apiRequest(
                `/groups/${customGroup.id}/permissions`,
                'PUT',
                {
                    permissions: {
                        expenseEditing: 'anyone',
                        expenseDeletion: 'anyone',
                        settingsManagement: 'admin-only',
                    },
                },
                users[0].token,
            );

            // Member can create/edit expenses
            const expenseData = new ExpenseBuilder()
                .withGroupId(customGroup.id)
                .withDescription('Mixed permission test')
                .withAmount(120)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('entertainment')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);
            expect(expense.id).toBeDefined();

            // But member cannot change settings
            await expect(
                driver.apiRequest(
                    `/groups/${customGroup.id}/permissions`,
                    'PUT',
                    {
                        permissions: { expenseEditing: 'admin-only' },
                    },
                    users[1].token,
                ),
            ).rejects.toThrow(/failed with status 403/);
        });
    });

    describe('Concurrent Operations', () => {
        let concurrentGroup: Group;

        beforeAll(async () => {
            const groupName = `Concurrent Test ${uuidv4()}`;
            concurrentGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 2), users[0].token);
        });

        test('concurrent expense operations work correctly', async () => {
            // Create multiple expenses concurrently
            const expensePromises = Array.from({ length: 3 }, (_, i) => {
                const expenseData = new ExpenseBuilder()
                    .withGroupId(concurrentGroup.id)
                    .withDescription(`Concurrent expense ${i + 1}`)
                    .withAmount(25 * (i + 1))
                    .withPaidBy(users[i % 2].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withCategory('food')
                    .build();

                return driver.createExpense(expenseData, users[i % 2].token);
            });

            const expenses = await Promise.all(expensePromises);

            // All expenses should be created successfully
            expenses.forEach((expense, i) => {
                expect(expense.id).toBeDefined();
                expect(expense.description).toBe(`Concurrent expense ${i + 1}`);
            });
        });

        test('concurrent permission changes are handled correctly', async () => {
            // Try to change multiple permissions at once
            const permissionPromises = [
                driver.apiRequest(
                    `/groups/${concurrentGroup.id}/permissions`,
                    'PUT',
                    {
                        permissions: { expenseEditing: 'admin-only' },
                    },
                    users[0].token,
                ),
                driver.apiRequest(
                    `/groups/${concurrentGroup.id}/members/${users[1].uid}/role`,
                    'PUT',
                    {
                        role: MemberRoles.VIEWER,
                    },
                    users[0].token,
                ),
            ];

            // Both operations should succeed (order may vary)
            const results = await Promise.all(permissionPromises);
            results.forEach((result) => {
                expect(result.message).toBeDefined();
            });
        });
    });
});

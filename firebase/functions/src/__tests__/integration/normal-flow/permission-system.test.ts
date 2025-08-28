// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '@splitifyd/test-support';
import { ExpenseBuilder, UserBuilder } from '@splitifyd/test-support';
import { SecurityPresets, MemberRoles, PermissionLevels, Group } from '@splitifyd/shared';

describe('Permission System Integration Tests', () => {
    let driver: ApiDriver;
    let users: User[] = [];

    beforeAll(async () => {
        driver = new ApiDriver();

        // Create test users: admin, member1, member2, viewer
        users = await Promise.all([
            driver.createUser(new UserBuilder().withName('Admin User').build()),
            driver.createUser(new UserBuilder().withName('Member 1').build()),
            driver.createUser(new UserBuilder().withName('Member 2').build()),
            driver.createUser(new UserBuilder().withName('Viewer User').build()),
        ]);
    });

    describe('Open Collaboration Preset (Default)', () => {
        let openGroup: Group;

        beforeAll(async () => {
            const groupName = `Open Collaboration Test ${uuidv4()}`;
            openGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 3), users[0].token);

            // Verify group has open collaboration settings by default
            expect(openGroup.securityPreset).toBe(SecurityPresets.OPEN);
            expect(openGroup.permissions.expenseEditing).toBe(PermissionLevels.ANYONE);
            expect(openGroup.permissions.memberInvitation).toBe(PermissionLevels.ANYONE);
        });

        test('any member can create expenses', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(openGroup.id)
                .withDescription('Test expense by member')
                .withAmount(50)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid, users[2].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);
            expect(expense.id).toBeDefined();
            expect(expense.createdBy).toBe(users[1].uid);
        });

        test('any member can edit any expense', async () => {
            // Member 1 creates expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(openGroup.id)
                .withDescription('Original description')
                .withAmount(100)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid, users[2].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);

            // Member 2 (different user) edits the expense
            const updateData = {
                description: 'Updated by different member',
                amount: 150,
            };

            const updatedExpense = await driver.updateExpense(expense.id, updateData, users[2].token);
            expect(updatedExpense.description).toBe('Updated by different member');
            expect(updatedExpense.amount).toBe(150);
        });

        test('any member can delete any expense', async () => {
            // Member 1 creates expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(openGroup.id)
                .withDescription('To be deleted')
                .withAmount(75)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);

            // Member 2 deletes the expense (different user)
            await driver.deleteExpense(expense.id, users[2].token);

            // Verify expense is deleted
            await expect(driver.getExpense(expense.id, users[1].token)).rejects.toThrow();
        });
    });

    describe('Managed Group Preset', () => {
        let managedGroup: Group;

        beforeAll(async () => {
            const groupName = `Managed Group Test ${uuidv4()}`;
            managedGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 3), users[0].token);

            // Apply managed group preset
            await driver.apiRequest(
                `/groups/${managedGroup.id}/security/preset`,
                'POST',
                {
                    preset: SecurityPresets.MANAGED,
                },
                users[0].token,
            );

            // Set user roles: users[0] = admin, users[1] = member, users[2] = viewer
            await driver.apiRequest(
                `/groups/${managedGroup.id}/members/${users[1].uid}/role`,
                'PUT',
                {
                    role: MemberRoles.MEMBER,
                },
                users[0].token,
            );

            await driver.apiRequest(
                `/groups/${managedGroup.id}/members/${users[2].uid}/role`,
                'PUT',
                {
                    role: MemberRoles.VIEWER,
                },
                users[0].token,
            );

            // Refresh group data to get updated permissions
            managedGroup = await driver.getGroup(managedGroup.id, users[0].token);
        });

        test('members can create expenses', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Member created expense')
                .withAmount(60)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid, users[0].uid])
                .withCategory('transport')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);
            expect(expense.id).toBeDefined();
            expect(expense.createdBy).toBe(users[1].uid);
        });

        test('viewers cannot create expenses', async () => {
            const expenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Viewer attempt')
                .withAmount(30)
                .withPaidBy(users[2].uid)
                .withParticipants([users[2].uid])
                .withCategory('food')
                .build();

            await expect(driver.createExpense(expenseData, users[2].token)).rejects.toMatchObject({
                status: 403,
                message: expect.stringContaining('permission'),
            });
        });

        test('members can edit their own expenses', async () => {
            // Member creates expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Member own expense')
                .withAmount(80)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);

            // Same member edits it
            const updateData = { description: 'Updated by owner' };
            const updatedExpense = await driver.updateExpense(expense.id, updateData, users[1].token);
            expect(updatedExpense.description).toBe('Updated by owner');
        });

        test('members cannot edit others expenses', async () => {
            // Admin creates expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Admin expense')
                .withAmount(120)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[0].token);

            // Member tries to edit admin's expense
            const updateData = { description: 'Unauthorized edit attempt' };
            await expect(driver.updateExpense(expense.id, updateData, users[1].token)).rejects.toMatchObject({
                status: 403,
                message: expect.stringContaining('permission'),
            });
        });

        test('admins can edit any expense', async () => {
            // Member creates expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Member expense')
                .withAmount(90)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);

            // Admin edits member's expense
            const updateData = { description: 'Edited by admin' };
            const updatedExpense = await driver.updateExpense(expense.id, updateData, users[0].token);
            expect(updatedExpense.description).toBe('Edited by admin');
        });

        test('members can delete their own expenses', async () => {
            // Member creates expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('To delete by owner')
                .withAmount(40)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);

            // Same member deletes it
            await driver.deleteExpense(expense.id, users[1].token);

            // Verify deletion
            await expect(driver.getExpense(expense.id, users[1].token)).rejects.toThrow();
        });

        test('members cannot delete others expenses', async () => {
            // Admin creates expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Admin expense to protect')
                .withAmount(200)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withCategory('entertainment')
                .build();

            const expense = await driver.createExpense(expenseData, users[0].token);

            // Member tries to delete admin's expense
            await expect(driver.deleteExpense(expense.id, users[1].token)).rejects.toMatchObject({
                status: 403,
                message: expect.stringContaining('permission'),
            });
        });

        test('admins can delete any expense', async () => {
            // Member creates expense
            const expenseData = new ExpenseBuilder()
                .withGroupId(managedGroup.id)
                .withDescription('Member expense for admin deletion')
                .withAmount(55)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid])
                .withCategory('food')
                .build();

            const expense = await driver.createExpense(expenseData, users[1].token);

            // Admin deletes member's expense
            await driver.deleteExpense(expense.id, users[0].token);

            // Verify deletion
            await expect(driver.getExpense(expense.id, users[0].token)).rejects.toThrow();
        });
    });

    describe('Role Management', () => {
        let roleTestGroup: Group;

        beforeAll(async () => {
            const groupName = `Role Management Test ${uuidv4()}`;
            roleTestGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 3), users[0].token);
        });

        test('admins can change member roles', async () => {
            // Change user[1] to viewer role
            await driver.apiRequest(
                `/groups/${roleTestGroup.id}/members/${users[1].uid}/role`,
                'PUT',
                {
                    role: MemberRoles.VIEWER,
                },
                users[0].token,
            );

            const updatedGroup = await driver.getGroup(roleTestGroup.id, users[0].token);
            expect(updatedGroup.members[users[1].uid].role).toBe(MemberRoles.VIEWER);
        });

        test('members cannot change roles', async () => {
            await expect(
                driver.apiRequest(
                    `/groups/${roleTestGroup.id}/members/${users[2].uid}/role`,
                    'PUT',
                    {
                        role: MemberRoles.ADMIN,
                    },
                    users[1].token,
                ),
            ).rejects.toMatchObject({
                status: 403,
            });
        });

        test('cannot demote last admin', async () => {
            // Try to demote the only admin (users[0])
            await expect(
                driver.apiRequest(
                    `/groups/${roleTestGroup.id}/members/${users[0].uid}/role`,
                    'PUT',
                    {
                        role: MemberRoles.MEMBER,
                    },
                    users[0].token,
                ),
            ).rejects.toMatchObject({
                status: 400,
                message: expect.stringContaining('last admin'),
            });
        });
    });

    describe('Security Preset Switching', () => {
        let presetGroup: Group;

        beforeAll(async () => {
            const groupName = `Preset Switching Test ${uuidv4()}`;
            presetGroup = await driver.createGroupWithMembers(groupName, users.slice(0, 2), users[0].token);
        });

        test('can switch from open to managed preset', async () => {
            // Verify starts as open
            expect(presetGroup.securityPreset).toBe(SecurityPresets.OPEN);
            expect(presetGroup.permissions.expenseEditing).toBe(PermissionLevels.ANYONE);

            // Switch to managed
            await driver.apiRequest(
                `/groups/${presetGroup.id}/security/preset`,
                'POST',
                {
                    preset: SecurityPresets.MANAGED,
                },
                users[0].token,
            );

            // Verify change
            const updatedGroup = await driver.getGroup(presetGroup.id, users[0].token);
            expect(updatedGroup.securityPreset).toBe(SecurityPresets.MANAGED);
            expect(updatedGroup.permissions.expenseEditing).toBe(PermissionLevels.OWNER_AND_ADMIN);
        });

        test('can switch back to open preset', async () => {
            // Switch back to open
            await driver.apiRequest(
                `/groups/${presetGroup.id}/security/preset`,
                'POST',
                {
                    preset: SecurityPresets.OPEN,
                },
                users[0].token,
            );

            // Verify change
            const updatedGroup = await driver.getGroup(presetGroup.id, users[0].token);
            expect(updatedGroup.securityPreset).toBe(SecurityPresets.OPEN);
            expect(updatedGroup.permissions.expenseEditing).toBe(PermissionLevels.ANYONE);
        });

        test('only admins can change security presets', async () => {
            // Member tries to change preset
            await expect(
                driver.apiRequest(
                    `/groups/${presetGroup.id}/security/preset`,
                    'POST',
                    {
                        preset: SecurityPresets.MANAGED,
                    },
                    users[1].token,
                ),
            ).rejects.toMatchObject({
                status: 403,
                message: expect.stringContaining('permission'),
            });
        });
    });
});

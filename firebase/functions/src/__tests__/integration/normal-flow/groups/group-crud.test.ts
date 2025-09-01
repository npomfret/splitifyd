// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, CreateGroupRequestBuilder, ExpenseBuilder, GroupUpdateBuilder, User} from '@splitifyd/test-support';

describe('RESTful Group CRUD Operations', () => {
    const apiDriver = new ApiDriver();
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);
    });

    describe('POST /groups - Create Group', () => {
        test('should create a new group with minimal data', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).withDescription('A test group for API testing').build();

            const response = await apiDriver.createGroup(groupData, users[0].token);

            expect(response.id).toBeDefined();
            expect(response.name).toBe(groupData.name);
            expect(response.description).toBe(groupData.description);
            expect(response.createdBy).toBe(users[0].uid);
            expect(Object.keys(response.members)).toHaveLength(1);
            expect(response.members).toHaveProperty(users[0].uid);
            // members is a map of member UIDs to member info
            // expenseCount removed - calculated on demand
        });

        test('should create a group with member objects', async () => {
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Group with Members ${uuidv4()}`)
                .withMembers([
                    {
                        uid: users[0].uid,
                        displayName: users[0].displayName,
                        email: users[0].email,
                    },
                ])
                .build();

            const response = await apiDriver.createGroup(groupData, users[0].token);

            expect(Object.keys(response.members)).toHaveLength(1);
            expect(response.id).toBeDefined();
            expect(response.name).toBe(groupData.name);
        });

        test('should validate required fields', async () => {
            // Missing name
            await expect(apiDriver.createGroup({ description: 'No name' }, users[0].token)).rejects.toThrow(/name.*required/i);

            // Empty name
            await expect(apiDriver.createGroup({ name: '   ' }, users[0].token)).rejects.toThrow(/name.*required/i);
        });

        test('should validate field lengths', async () => {
            const longName = 'a'.repeat(101);
            const longDescription = 'b'.repeat(501);

            await expect(apiDriver.createGroup({ name: longName }, users[0].token)).rejects.toThrow(/less than 100 characters/i);

            await expect(apiDriver.createGroup({ name: 'Valid Name', description: longDescription }, users[0].token)).rejects.toThrow(/less than or equal to 500 characters/i);
        });

        test('should require authentication', async () => {
            await expect(apiDriver.createGroup({ name: 'Test' }, '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should be able to fetch balances immediately after creating group', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Balance Test Group ${uuidv4()}`).withDescription('Testing immediate balance fetch').build();

            const createdGroup = await apiDriver.createGroup(groupData, users[0].token);

            // Verify the group can be fetched normally
            const fetchedGroup = await apiDriver.getGroup(createdGroup.id, users[0].token);
            expect(fetchedGroup).toBeDefined();
            expect(fetchedGroup.id).toBe(createdGroup.id);

            // Fetch balances immediately after creation
            const balances = await apiDriver.getGroupBalances(createdGroup.id, users[0].token);

            expect(balances).toBeDefined();
            expect(balances.groupId).toBe(createdGroup.id);
            expect(balances.userBalances).toBeDefined();
        });
    });

    describe('GET /groups/:id - Get Group', () => {
        let testGroup: any;

        beforeEach(async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Get Test Group ${uuidv4()}`).build();
            testGroup = await apiDriver.createGroup(groupData, users[0].token);
        });

        test('should retrieve a group by ID', async () => {
            const response = await apiDriver.getGroup(testGroup.id, users[0].token);

            expect(response.id).toBe(testGroup.id);
            expect(response.name).toBe(testGroup.name);
            expect(response.description).toBe(testGroup.description);
            expect(Object.keys(response.members)).toHaveLength(1);
            expect(response.balance).toBeDefined();
            expect(response.balance!.balancesByCurrency).toBeDefined();
            expect(Object.keys(response.balance!.balancesByCurrency).length).toBe(0);
        });

        test('should include balance information', async () => {
            // Create an expense to generate balance
            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Test expense').withAmount(100).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build();
            await apiDriver.createExpense(expenseData, users[0].token);

            // Poll until the balance is updated
            const groupWithBalance = await apiDriver.pollGroupUntilBalanceUpdated(testGroup.id, users[0].token, (group) => group.balance?.balancesByCurrency !== undefined, { timeout: 500 });

            expect(groupWithBalance.balance).toBeDefined();
            expect(groupWithBalance.balance?.balancesByCurrency).toBeDefined();
            const usdBalance = groupWithBalance.balance?.balancesByCurrency?.['USD'];
            if (usdBalance) {
                expect(usdBalance.netBalance).toBe(0); // Paid for self only
            }
        });

        test('should return 404 for non-existent group', async () => {
            await expect(apiDriver.getGroup('non-existent-id', users[0].token)).rejects.toThrow(/404|not found/i);
        });

        test('should restrict access to non-members', async () => {
            await expect(apiDriver.getGroup(testGroup.id, users[1].token)).rejects.toThrow(/404|not found/i);
        });

        test('should require authentication', async () => {
            await expect(apiDriver.getGroup(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
        });
    });

    describe('PUT /groups/:id - Update Group', () => {
        let testGroup: any;

        beforeEach(async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Update Test Group ${uuidv4()}`).withDescription('Original description').build();
            testGroup = await apiDriver.createGroup(groupData, users[0].token);
        });

        test('should update group name', async () => {
            const updates = new GroupUpdateBuilder().withName('Updated Group Name').build();

            await apiDriver.updateGroup(testGroup.id, updates, users[0].token);

            // Verify update
            const updated = await apiDriver.getGroup(testGroup.id, users[0].token);
            expect(updated.name).toBe('Updated Group Name');
            expect(updated.description).toBe(testGroup.description); // Unchanged
        });

        test('should update group description', async () => {
            const updates = new GroupUpdateBuilder().withDescription('Updated description').build();

            await apiDriver.updateGroup(testGroup.id, updates, users[0].token);

            // Verify update
            const updated = await apiDriver.getGroup(testGroup.id, users[0].token);
            expect(updated.description).toBe('Updated description');
            expect(updated.name).toBe(testGroup.name); // Unchanged
        });

        test('should update multiple fields', async () => {
            const updates = new GroupUpdateBuilder().withName('New Name').withDescription('New description').build();

            await apiDriver.updateGroup(testGroup.id, updates, users[0].token);

            // Verify updates
            const updated = await apiDriver.getGroup(testGroup.id, users[0].token);
            expect(updated.name).toBe('New Name');
            expect(updated.description).toBe('New description');
        });

        test('should validate update fields', async () => {
            const longName = 'a'.repeat(101);

            await expect(apiDriver.updateGroup(testGroup.id, { name: longName }, users[0].token)).rejects.toThrow(/name.*length/i);
        });

        test('should only allow owner to update', async () => {
            // Add user[1] as member first
            await apiDriver.joinGroupViaShareLink((await apiDriver.generateShareLink(testGroup.id, users[0].token)).linkId, users[1].token);

            // Member should not be able to update
            await expect(apiDriver.updateGroup(testGroup.id, { name: 'Hacked' }, users[1].token)).rejects.toThrow(/403|forbidden/i);
        });

        test('should require authentication', async () => {
            await expect(apiDriver.updateGroup(testGroup.id, { name: 'Test' }, '')).rejects.toThrow(/401|unauthorized/i);
        });
    });

    describe('DELETE /groups/:id - Delete Group', () => {
        test('should delete a group without expenses', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Delete Test Group ${uuidv4()}`).build();
            const testGroup = await apiDriver.createGroup(groupData, users[0].token);

            // Delete the group
            await apiDriver.deleteGroup(testGroup.id, users[0].token);

            // Verify it's deleted
            await expect(apiDriver.getGroup(testGroup.id, users[0].token)).rejects.toThrow(/404|not found/i);
        });

        test('should not delete group with expenses', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Group with Expenses ${uuidv4()}`).build();
            const testGroup = await apiDriver.createGroup(groupData, users[0].token);

            // Add an expense
            const expenseData = new ExpenseBuilder().withGroupId(testGroup.id).withDescription('Test expense').withAmount(50).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build();
            await apiDriver.createExpense(expenseData, users[0].token);

            // Try to delete - should fail
            await expect(apiDriver.deleteGroup(testGroup.id, users[0].token)).rejects.toThrow(/Cannot delete.*expenses/i);
        });

        test('should only allow owner to delete', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Owner Only Delete ${uuidv4()}`).build();
            const testGroup = await apiDriver.createGroup(groupData, users[0].token);

            // Add user[1] as member
            await apiDriver.joinGroupViaShareLink((await apiDriver.generateShareLink(testGroup.id, users[0].token)).linkId, users[1].token);

            // Member should not be able to delete
            await expect(apiDriver.deleteGroup(testGroup.id, users[1].token)).rejects.toThrow(/403|forbidden/i);
        });

        test('should require authentication', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Auth Test Delete ${uuidv4()}`).build();
            const testGroup = await apiDriver.createGroup(groupData, users[0].token);

            await expect(apiDriver.deleteGroup(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
        });
    });
});
/**
 * @jest-environment node
 */

// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../../support/ApiDriver';
import { UserBuilder, GroupBuilder } from '../../support/builders';
import { clearAllTestData } from '../../support/cleanupHelpers';

describe('RESTful Group Endpoints', () => {
    let driver: ApiDriver;
    let users: User[] = [];

    // Set a longer timeout for these integration tests
    jest.setTimeout(10000);

    beforeAll(async () => {
        // Clear any existing test data first
        await clearAllTestData();

        driver = new ApiDriver();
        users = await Promise.all([driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build()), driver.createUser(new UserBuilder().build())]);
    });

    afterAll(async () => {
        // Clean up all test data
        await clearAllTestData();
    });

    describe('POST /groups - Create Group', () => {
        test('should create a new group with minimal data', async () => {
            const groupData = new GroupBuilder().withName(`Test Group ${uuidv4()}`).withDescription('A test group for API testing').build();

            const response = await driver.createGroup(groupData, users[0].token);

            expect(response.id).toBeDefined();
            expect(response.name).toBe(groupData.name);
            expect(response.description).toBe(groupData.description);
            expect(response.createdBy).toBe(users[0].uid);
            expect(response.memberIds).toHaveLength(1);
            expect(response.memberIds[0]).toBe(users[0].uid);
            // memberIds is the array of member UIDs
            // expenseCount removed - calculated on demand
        });

        test('should create a group with member objects', async () => {
            const groupData = new GroupBuilder()
                .withName(`Group with Members ${uuidv4()}`)
                .withMembers([
                    {
                        uid: users[0].uid,
                        displayName: users[0].displayName,
                        email: users[0].email,
                    },
                ])
                .build();

            const response = await driver.createGroup(groupData, users[0].token);

            expect(response.memberIds).toHaveLength(1);
            expect(response.id).toBeDefined();
            expect(response.name).toBe(groupData.name);
        });

        test('should validate required fields', async () => {
            // Missing name
            await expect(driver.createGroup({ description: 'No name' }, users[0].token)).rejects.toThrow(/name.*required/i);

            // Empty name
            await expect(driver.createGroup({ name: '   ' }, users[0].token)).rejects.toThrow(/name.*required/i);
        });

        test('should validate field lengths', async () => {
            const longName = 'a'.repeat(101);
            const longDescription = 'b'.repeat(501);

            await expect(driver.createGroup({ name: longName }, users[0].token)).rejects.toThrow(/less than 100 characters/i);

            await expect(driver.createGroup({ name: 'Valid Name', description: longDescription }, users[0].token)).rejects.toThrow(/less than or equal to 500 characters/i);
        });

        test('should require authentication', async () => {
            await expect(driver.createGroup({ name: 'Test' }, '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should be able to fetch balances immediately after creating group', async () => {
            const groupData = new GroupBuilder().withName(`Balance Test Group ${uuidv4()}`).withDescription('Testing immediate balance fetch').build();

            const createdGroup = await driver.createGroup(groupData, users[0].token);

            // Verify the group can be fetched normally
            const fetchedGroup = await driver.getGroup(createdGroup.id, users[0].token);
            expect(fetchedGroup).toBeDefined();
            expect(fetchedGroup.id).toBe(createdGroup.id);

            // Fetch balances immediately after creation
            const balances = await driver.getGroupBalances(createdGroup.id, users[0].token);

            expect(balances).toBeDefined();
            expect(balances.groupId).toBe(createdGroup.id);
            expect(balances.userBalances).toBeDefined();
        });
    });

    describe('GET /groups/:id - Get Group', () => {
        let testGroup: any;

        beforeEach(async () => {
            const groupData = new GroupBuilder().withName(`Get Test Group ${uuidv4()}`).build();
            testGroup = await driver.createGroup(groupData, users[0].token);
        });

        test('should retrieve a group by ID', async () => {
            const response = await driver.getGroup(testGroup.id, users[0].token);

            expect(response.id).toBe(testGroup.id);
            expect(response.name).toBe(testGroup.name);
            expect(response.description).toBe(testGroup.description);
            expect(response.memberIds).toHaveLength(1);
            expect(response.balance).toBeDefined();
            // userBalance is null for groups without expenses
            if (response.balance.userBalance) {
                expect(response.balance.userBalance.netBalance).toBe(0);
            } else {
                expect(response.balance.userBalance).toBeNull();
            }
        });

        test('should include balance information', async () => {
            // Create an expense to generate balance
            const expenseData = {
                groupId: testGroup.id,
                description: 'Test expense',
                amount: 100,
                currency: 'USD',
                paidBy: users[0].uid,
                participants: [users[0].uid],
                splitType: 'equal' as const,
                date: new Date().toISOString(),
                category: 'food',
            };
            await driver.createExpense(expenseData, users[0].token);

            // Poll until the balance is updated
            const groupWithBalance = await driver.pollGroupUntilBalanceUpdated(testGroup.id, users[0].token, (group) => group.balance && group.balance.userBalance !== null, { timeout: 500 });

            expect(groupWithBalance.balance).toBeDefined();
            expect(groupWithBalance.balance.userBalance).toBeDefined();
            expect(groupWithBalance.balance.userBalance.netBalance).toBe(0); // Paid for self only
        });

        test('should return 404 for non-existent group', async () => {
            await expect(driver.getGroup('non-existent-id', users[0].token)).rejects.toThrow(/404|not found/i);
        });

        test('should restrict access to non-members', async () => {
            await expect(driver.getGroup(testGroup.id, users[1].token)).rejects.toThrow(/404|not found/i);
        });

        test('should require authentication', async () => {
            await expect(driver.getGroup(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
        });
    });

    describe('PUT /groups/:id - Update Group', () => {
        let testGroup: any;

        beforeEach(async () => {
            const groupData = new GroupBuilder().withName(`Update Test Group ${uuidv4()}`).withDescription('Original description').build();
            testGroup = await driver.createGroup(groupData, users[0].token);
        });

        test('should update group name', async () => {
            const updates = {
                name: 'Updated Group Name',
            };

            await driver.updateGroup(testGroup.id, updates, users[0].token);

            // Verify update
            const updated = await driver.getGroup(testGroup.id, users[0].token);
            expect(updated.name).toBe(updates.name);
            expect(updated.description).toBe(testGroup.description); // Unchanged
        });

        test('should update group description', async () => {
            const updates = {
                description: 'Updated description',
            };

            await driver.updateGroup(testGroup.id, updates, users[0].token);

            // Verify update
            const updated = await driver.getGroup(testGroup.id, users[0].token);
            expect(updated.description).toBe(updates.description);
            expect(updated.name).toBe(testGroup.name); // Unchanged
        });

        test('should update multiple fields', async () => {
            const updates = {
                name: 'New Name',
                description: 'New description',
            };

            await driver.updateGroup(testGroup.id, updates, users[0].token);

            // Verify updates
            const updated = await driver.getGroup(testGroup.id, users[0].token);
            expect(updated.name).toBe(updates.name);
            expect(updated.description).toBe(updates.description);
        });

        test('should validate update fields', async () => {
            const longName = 'a'.repeat(101);

            await expect(driver.updateGroup(testGroup.id, { name: longName }, users[0].token)).rejects.toThrow(/name.*length/i);
        });

        test('should only allow owner to update', async () => {
            // Add user[1] as member first
            await driver.joinGroupViaShareLink((await driver.generateShareLink(testGroup.id, users[0].token)).linkId, users[1].token);

            // Member should not be able to update
            await expect(driver.updateGroup(testGroup.id, { name: 'Hacked' }, users[1].token)).rejects.toThrow(/403|forbidden/i);
        });

        test('should require authentication', async () => {
            await expect(driver.updateGroup(testGroup.id, { name: 'Test' }, '')).rejects.toThrow(/401|unauthorized/i);
        });
    });

    describe('DELETE /groups/:id - Delete Group', () => {
        test('should delete a group without expenses', async () => {
            const groupData = new GroupBuilder().withName(`Delete Test Group ${uuidv4()}`).build();
            const testGroup = await driver.createGroup(groupData, users[0].token);

            // Delete the group
            await driver.deleteGroup(testGroup.id, users[0].token);

            // Verify it's deleted
            await expect(driver.getGroup(testGroup.id, users[0].token)).rejects.toThrow(/404|not found/i);
        });

        test('should not delete group with expenses', async () => {
            const groupData = new GroupBuilder().withName(`Group with Expenses ${uuidv4()}`).build();
            const testGroup = await driver.createGroup(groupData, users[0].token);

            // Add an expense
            const expenseData = {
                groupId: testGroup.id,
                description: 'Test expense',
                amount: 50,
                currency: 'USD',
                paidBy: users[0].uid,
                participants: [users[0].uid],
                splitType: 'equal' as const,
                date: new Date().toISOString(),
                category: 'food',
            };
            await driver.createExpense(expenseData, users[0].token);

            // Try to delete - should fail
            await expect(driver.deleteGroup(testGroup.id, users[0].token)).rejects.toThrow(/Cannot delete.*expenses/i);
        });

        test('should only allow owner to delete', async () => {
            const groupData = new GroupBuilder().withName(`Owner Only Delete ${uuidv4()}`).build();
            const testGroup = await driver.createGroup(groupData, users[0].token);

            // Add user[1] as member
            await driver.joinGroupViaShareLink((await driver.generateShareLink(testGroup.id, users[0].token)).linkId, users[1].token);

            // Member should not be able to delete
            await expect(driver.deleteGroup(testGroup.id, users[1].token)).rejects.toThrow(/403|forbidden/i);
        });

        test('should require authentication', async () => {
            const groupData = new GroupBuilder().withName(`Auth Test Delete ${uuidv4()}`).build();
            const testGroup = await driver.createGroup(groupData, users[0].token);

            await expect(driver.deleteGroup(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
        });
    });

    describe('GET /groups - List Groups', () => {
        beforeEach(async () => {
            // Create multiple groups for testing
            const groupPromises = [];
            for (let i = 0; i < 5; i++) {
                groupPromises.push(driver.createGroup(new GroupBuilder().withName(`List Test Group ${i} ${uuidv4()}`).build(), users[0].token));
            }
            await Promise.all(groupPromises);
        });

        test('should list all user groups', async () => {
            const response = await driver.listGroups(users[0].token);

            expect(response.groups).toBeDefined();
            expect(Array.isArray(response.groups)).toBe(true);
            expect(response.groups.length).toBeGreaterThanOrEqual(5);
            expect(response.count).toBe(response.groups.length);
            expect(response.hasMore).toBeDefined();
        });

        test('should include group summaries with balance', async () => {
            const response = await driver.listGroups(users[0].token);

            const firstGroup = response.groups[0];
            expect(firstGroup).toHaveProperty('id');
            expect(firstGroup).toHaveProperty('name');
            expect(firstGroup).toHaveProperty('memberIds');
            expect(firstGroup).toHaveProperty('balance');
            expect(firstGroup.balance).toHaveProperty('userBalance');
            expect(firstGroup.balance).toHaveProperty('balancesByCurrency');
            // userBalance is null for groups without balances
            expect(firstGroup).toHaveProperty('lastActivity');
            // expenseCount and lastExpense removed - calculated on demand
        });

        test('should support pagination', async () => {
            // Get first page
            const page1 = await driver.listGroups(users[0].token, { limit: 2 });
            expect(page1.groups).toHaveLength(2);
            expect(page1.hasMore).toBe(true);
            expect(page1.nextCursor).toBeDefined();

            // Get second page
            const page2 = await driver.listGroups(users[0].token, {
                limit: 2,
                cursor: page1.nextCursor,
            });
            expect(page2.groups).toHaveLength(2);

            // Ensure no duplicate IDs
            const page1Ids = page1.groups.map((g: any) => g.id);
            const page2Ids = page2.groups.map((g: any) => g.id);
            const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
            expect(intersection).toHaveLength(0);
        });

        test('should support ordering', async () => {
            const responseDesc = await driver.listGroups(users[0].token, { order: 'desc' });
            const responseAsc = await driver.listGroups(users[0].token, { order: 'asc' });

            // The most recently updated should be first in desc, last in asc
            expect(responseDesc.groups[0].id).not.toBe(responseAsc.groups[0].id);
        });

        test('should only show groups where user is member', async () => {
            // Create a group with only user[1]
            const otherGroup = await driver.createGroup(new GroupBuilder().withName(`Other User Group ${uuidv4()}`).build(), users[1].token);

            // user[0] should not see this group
            const response = await driver.listGroups(users[0].token);
            const groupIds = response.groups.map((g: any) => g.id);
            expect(groupIds).not.toContain(otherGroup.id);
        });

        test('should require authentication', async () => {
            await expect(driver.listGroups('')).rejects.toThrow(/401|unauthorized/i);
        });
    });

    describe('GET /groups/balances - Group Balances', () => {
        let testGroup: any;

        beforeEach(async () => {
            const groupData = new GroupBuilder().withName(`Balance Test Group ${uuidv4()}`).withDescription('Testing balance endpoint').build();
            testGroup = await driver.createGroup(groupData, users[0].token);
        });

        test('should return correct response structure for empty group', async () => {
            const balances = await driver.getGroupBalances(testGroup.id, users[0].token);

            // Verify server response structure matches what server actually returns
            expect(balances).toHaveProperty('groupId', testGroup.id);
            expect(balances).toHaveProperty('userBalances');
            expect(balances).toHaveProperty('simplifiedDebts');
            expect(balances).toHaveProperty('lastUpdated');

            // For empty group, balances should be empty
            expect(typeof balances.userBalances).toBe('object');
            expect(Array.isArray(balances.simplifiedDebts)).toBe(true);
            expect(typeof balances.lastUpdated).toBe('string');
        });

        test('should return balances for group with expenses', async () => {
            // Add multiple users to the group
            const shareLink = await driver.generateShareLink(testGroup.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[2].token);

            // Create an expense where user 0 pays for everyone
            const expenseData = {
                groupId: testGroup.id,
                description: 'Dinner for everyone',
                amount: 150, // $1.50
                currency: 'USD',
                paidBy: users[0].uid,
                participants: [users[0].uid, users[1].uid, users[2].uid],
                splitType: 'equal' as const,
                date: new Date().toISOString(),
                category: 'food',
            };
            await driver.createExpense(expenseData, users[0].token);

            // Wait for balance calculation
            const balances = await driver.pollGroupBalancesUntil(testGroup.id, users[0].token, (b) => b.userBalances && Object.keys(b.userBalances).length > 0, { timeout: 500 });

            // Verify response structure
            expect(balances.groupId).toBe(testGroup.id);
            expect(balances.userBalances).toBeDefined();
            expect(balances.simplifiedDebts).toBeDefined();
            expect(balances.lastUpdated).toBeDefined();

            // Verify balance calculations
            expect(Object.keys(balances.userBalances)).toContain(users[0].uid);
            expect(balances.userBalances[users[0].uid]).toHaveProperty('netBalance');

            // User 0 should have positive balance (others owe them)
            expect(balances.userBalances[users[0].uid].netBalance).toBeGreaterThan(0);
        });

        test('should handle complex multi-expense scenarios', async () => {
            // Add another user
            const shareLink = await driver.generateShareLink(testGroup.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Create multiple expenses with different payers
            const expenses = [
                {
                    groupId: testGroup.id,
                    description: 'Lunch',
                    amount: 60, // $0.60
                    currency: 'USD',
                    paidBy: users[0].uid,
                    participants: [users[0].uid, users[1].uid],
                    splitType: 'equal' as const,
                    date: new Date().toISOString(),
                    category: 'food',
                },
                {
                    groupId: testGroup.id,
                    description: 'Coffee',
                    amount: 20, // $0.20
                    currency: 'USD',
                    paidBy: users[1].uid,
                    participants: [users[0].uid, users[1].uid],
                    splitType: 'equal' as const,
                    date: new Date().toISOString(),
                    category: 'food',
                },
            ];

            for (const expense of expenses) {
                await driver.createExpense(expense, users[0].token);
            }

            // Wait for balance calculation
            const balances = await driver.pollGroupBalancesUntil(testGroup.id, users[0].token, (b) => b.userBalances && Object.keys(b.userBalances).length >= 2, { timeout: 500 });

            // Verify both users have balances
            expect(Object.keys(balances.userBalances)).toHaveLength(2);
            expect(balances.userBalances[users[0].uid]).toBeDefined();
            expect(balances.userBalances[users[1].uid]).toBeDefined();

            // Net balances should add up to zero
            const user0Balance = balances.userBalances[users[0].uid].netBalance;
            const user1Balance = balances.userBalances[users[1].uid].netBalance;
            expect(user0Balance + user1Balance).toBeCloseTo(0, 2);
        });

        test('should require authentication', async () => {
            await expect(driver.getGroupBalances(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should return 404 for non-existent group', async () => {
            await expect(driver.getGroupBalances('non-existent-id', users[0].token)).rejects.toThrow(/404|not found/i);
        });

        test('should restrict access to group members only', async () => {
            // User 1 is not a member of the group
            await expect(driver.getGroupBalances(testGroup.id, users[1].token)).rejects.toThrow(/403|forbidden/i);
        });

        test('should validate groupId parameter', async () => {
            // Test with missing groupId (should be handled by validation)
            try {
                await driver.makeInvalidApiCall('/groups/balances', 'GET', null, users[0].token);
                fail('Should have thrown validation error');
            } catch (error) {
                expect((error as Error).message).toMatch(/validation|required|groupId/i);
            }
        });

        test('should handle groups with no expenses gracefully', async () => {
            const balances = await driver.getGroupBalances(testGroup.id, users[0].token);

            expect(balances.groupId).toBe(testGroup.id);
            expect(balances.userBalances).toBeDefined();
            expect(balances.simplifiedDebts).toBeDefined();
            expect(Array.isArray(balances.simplifiedDebts)).toBe(true);
            expect(balances.simplifiedDebts).toHaveLength(0);
        });

        test('should return updated timestamp', async () => {
            const balances = await driver.getGroupBalances(testGroup.id, users[0].token);

            expect(balances.lastUpdated).toBeDefined();
            expect(typeof balances.lastUpdated).toBe('string');

            // Should be a valid ISO date string
            const date = new Date(balances.lastUpdated);
            expect(date).toBeInstanceOf(Date);
            expect(date.getTime()).not.toBeNaN();
        });

        test('should include simplified debts for complex scenarios', async () => {
            // Create a three-person group with circular debts
            const shareLink = await driver.generateShareLink(testGroup.id, users[0].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            await driver.joinGroupViaShareLink(shareLink.linkId, users[2].token);

            // Create expenses that would benefit from debt simplification
            const expenses = [
                {
                    groupId: testGroup.id,
                    description: 'User 0 pays for all',
                    amount: 300, // $3.00
                    currency: 'USD',
                    paidBy: users[0].uid,
                    participants: [users[0].uid, users[1].uid, users[2].uid],
                    splitType: 'equal' as const,
                    date: new Date().toISOString(),
                    category: 'food',
                },
                {
                    groupId: testGroup.id,
                    description: 'User 1 pays for User 0 and 2',
                    amount: 120, // $1.20
                    currency: 'USD',
                    paidBy: users[1].uid,
                    participants: [users[0].uid, users[1].uid, users[2].uid],
                    splitType: 'equal' as const,
                    date: new Date().toISOString(),
                    category: 'transport',
                },
            ];

            for (const expense of expenses) {
                await driver.createExpense(expense, users[0].token);
            }

            // Wait for balance calculation
            const balances = await driver.pollGroupBalancesUntil(testGroup.id, users[0].token, (b) => b.userBalances && Object.keys(b.userBalances).length >= 3, { timeout: 500 });

            // Should have simplified debts
            expect(Array.isArray(balances.simplifiedDebts)).toBe(true);

            // Verify debt structure if any exist
            if (balances.simplifiedDebts.length > 0) {
                balances.simplifiedDebts.forEach((debt: any) => {
                    expect(debt).toHaveProperty('from');
                    expect(debt).toHaveProperty('to');
                    expect(debt).toHaveProperty('amount');
                    expect(typeof debt.amount).toBe('number');
                    expect(debt.amount).toBeGreaterThan(0);
                });
            }
        });
    });
});

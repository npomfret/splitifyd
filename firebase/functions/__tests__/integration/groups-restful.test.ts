/**
 * @jest-environment node
 */

// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../support/ApiDriver';
import { UserBuilder, GroupBuilder } from '../support/builders';

describe('RESTful Group Endpoints', () => {
  let driver: ApiDriver;
  let users: User[] = [];

  // Set a longer timeout for these integration tests
  jest.setTimeout(10000);

  beforeAll(async () => {
    driver = new ApiDriver();
    users = await Promise.all([
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
    ]);
  });

  describe('POST /groups - Create Group', () => {
    test('should create a new group with minimal data', async () => {
      const groupData = new GroupBuilder()
        .withName(`Test Group ${uuidv4()}`)
        .withDescription('A test group for API testing')
        .build();

      const response = await driver.createGroupNew(groupData, users[0].token);

      expect(response.id).toBeDefined();
      expect(response.name).toBe(groupData.name);
      expect(response.description).toBe(groupData.description);
      expect(response.createdBy).toBe(users[0].uid);
      expect(response.members).toHaveLength(1);
      expect(response.members[0].uid).toBe(users[0].uid);
      expect(response.memberIds).toContain(users[0].uid);
      expect(response.expenseCount).toBe(0);
    });

    test('should create a group with member emails', async () => {
      const groupData = new GroupBuilder()
        .withName(`Group with Members ${uuidv4()}`)
        .withMemberEmails(['test1@example.com', 'test2@example.com'])
        .build();

      const response = await driver.createGroupNew(groupData, users[0].token);

      expect(response.memberEmails).toHaveLength(3); // creator + 2 emails
      expect(response.memberEmails).toContain(users[0].email);
      expect(response.memberEmails).toContain('test1@example.com');
      expect(response.memberEmails).toContain('test2@example.com');
    });

    test('should validate required fields', async () => {
      // Missing name
      await expect(
        driver.createGroupNew({ description: 'No name' }, users[0].token)
      ).rejects.toThrow(/name.*required/i);

      // Empty name
      await expect(
        driver.createGroupNew({ name: '   ' }, users[0].token)
      ).rejects.toThrow(/name.*required/i);
    });

    test('should validate field lengths', async () => {
      const longName = 'a'.repeat(101);
      const longDescription = 'b'.repeat(501);

      await expect(
        driver.createGroupNew({ name: longName }, users[0].token)
      ).rejects.toThrow(/less than 100 characters/i);

      await expect(
        driver.createGroupNew({ name: 'Valid Name', description: longDescription }, users[0].token)
      ).rejects.toThrow(/less than or equal to 500 characters/i);
    });

    test('should require authentication', async () => {
      await expect(
        driver.createGroupNew({ name: 'Test' }, '')
      ).rejects.toThrow(/401|unauthorized/i);
    });
  });

  describe('GET /groups/:id - Get Group', () => {
    let testGroup: any;

    beforeEach(async () => {
      const groupData = new GroupBuilder()
        .withName(`Get Test Group ${uuidv4()}`)
        .build();
      testGroup = await driver.createGroupNew(groupData, users[0].token);
    });

    test('should retrieve a group by ID', async () => {
      const response = await driver.getGroupNew(testGroup.id, users[0].token);

      expect(response.id).toBe(testGroup.id);
      expect(response.name).toBe(testGroup.name);
      expect(response.description).toBe(testGroup.description);
      expect(response.members).toHaveLength(1);
      expect(response.balance).toBeDefined();
      // userBalance is optional for groups without expenses
      if (response.balance.userBalance) {
        expect(response.balance.userBalance.netBalance).toBe(0);
      } else {
        expect(response.balance.userBalance).toBeUndefined();
      }
    });

    test('should include balance information', async () => {
      // Create an expense to generate balance
      const expenseData = {
        groupId: testGroup.id,
        description: 'Test expense',
        amount: 100,
        paidBy: users[0].uid,
        participants: [users[0].uid],
        splitType: 'equal' as const,
        date: new Date().toISOString(),
        category: 'food'
      };
      await driver.createExpense(expenseData, users[0].token);

      // Poll until the balance is updated
      const groupWithBalance = await driver.pollGroupUntilBalanceUpdated(
        testGroup.id,
        users[0].token,
        (group) => group.balance && group.balance.userBalance !== undefined,
        { timeout: 5000 }
      );

      expect(groupWithBalance.balance).toBeDefined();
      expect(groupWithBalance.balance.userBalance).toBeDefined();
      expect(groupWithBalance.balance.userBalance.netBalance).toBe(0); // Paid for self only
    });

    test('should return 404 for non-existent group', async () => {
      await expect(
        driver.getGroupNew('non-existent-id', users[0].token)
      ).rejects.toThrow(/404|not found/i);
    });

    test('should restrict access to non-members', async () => {
      await expect(
        driver.getGroupNew(testGroup.id, users[1].token)
      ).rejects.toThrow(/404|not found/i);
    });

    test('should require authentication', async () => {
      await expect(
        driver.getGroupNew(testGroup.id, '')
      ).rejects.toThrow(/401|unauthorized/i);
    });
  });

  describe('PUT /groups/:id - Update Group', () => {
    let testGroup: any;

    beforeEach(async () => {
      const groupData = new GroupBuilder()
        .withName(`Update Test Group ${uuidv4()}`)
        .withDescription('Original description')
        .build();
      testGroup = await driver.createGroupNew(groupData, users[0].token);
    });

    test('should update group name', async () => {
      const updates = {
        name: 'Updated Group Name'
      };

      await driver.updateGroupNew(testGroup.id, updates, users[0].token);

      // Verify update
      const updated = await driver.getGroupNew(testGroup.id, users[0].token);
      expect(updated.name).toBe(updates.name);
      expect(updated.description).toBe(testGroup.description); // Unchanged
    });

    test('should update group description', async () => {
      const updates = {
        description: 'Updated description'
      };

      await driver.updateGroupNew(testGroup.id, updates, users[0].token);

      // Verify update
      const updated = await driver.getGroupNew(testGroup.id, users[0].token);
      expect(updated.description).toBe(updates.description);
      expect(updated.name).toBe(testGroup.name); // Unchanged
    });

    test('should update multiple fields', async () => {
      const updates = {
        name: 'New Name',
        description: 'New description'
      };

      await driver.updateGroupNew(testGroup.id, updates, users[0].token);

      // Verify updates
      const updated = await driver.getGroupNew(testGroup.id, users[0].token);
      expect(updated.name).toBe(updates.name);
      expect(updated.description).toBe(updates.description);
    });

    test('should validate update fields', async () => {
      const longName = 'a'.repeat(101);

      await expect(
        driver.updateGroupNew(testGroup.id, { name: longName }, users[0].token)
      ).rejects.toThrow(/name.*length/i);
    });

    test('should only allow owner to update', async () => {
      // Add user[1] as member first
      await driver.joinGroupViaShareLink(
        (await driver.generateShareLink(testGroup.id, users[0].token)).linkId,
        users[1].token
      );

      // Member should not be able to update
      await expect(
        driver.updateGroupNew(testGroup.id, { name: 'Hacked' }, users[1].token)
      ).rejects.toThrow(/403|forbidden/i);
    });

    test('should require authentication', async () => {
      await expect(
        driver.updateGroupNew(testGroup.id, { name: 'Test' }, '')
      ).rejects.toThrow(/401|unauthorized/i);
    });
  });

  describe('DELETE /groups/:id - Delete Group', () => {
    test('should delete a group without expenses', async () => {
      const groupData = new GroupBuilder()
        .withName(`Delete Test Group ${uuidv4()}`)
        .build();
      const testGroup = await driver.createGroupNew(groupData, users[0].token);

      // Delete the group
      await driver.deleteGroupNew(testGroup.id, users[0].token);

      // Verify it's deleted
      await expect(
        driver.getGroupNew(testGroup.id, users[0].token)
      ).rejects.toThrow(/404|not found/i);
    });

    test('should not delete group with expenses', async () => {
      const groupData = new GroupBuilder()
        .withName(`Group with Expenses ${uuidv4()}`)
        .build();
      const testGroup = await driver.createGroupNew(groupData, users[0].token);

      // Add an expense
      const expenseData = {
        groupId: testGroup.id,
        description: 'Test expense',
        amount: 50,
        paidBy: users[0].uid,
        participants: [users[0].uid],
        splitType: 'equal' as const,
        date: new Date().toISOString(),
        category: 'food'
      };
      await driver.createExpense(expenseData, users[0].token);

      // Try to delete - should fail
      await expect(
        driver.deleteGroupNew(testGroup.id, users[0].token)
      ).rejects.toThrow(/Cannot delete.*expenses/i);
    });

    test('should only allow owner to delete', async () => {
      const groupData = new GroupBuilder()
        .withName(`Owner Only Delete ${uuidv4()}`)
        .build();
      const testGroup = await driver.createGroupNew(groupData, users[0].token);

      // Add user[1] as member
      await driver.joinGroupViaShareLink(
        (await driver.generateShareLink(testGroup.id, users[0].token)).linkId,
        users[1].token
      );

      // Member should not be able to delete
      await expect(
        driver.deleteGroupNew(testGroup.id, users[1].token)
      ).rejects.toThrow(/403|forbidden/i);
    });

    test('should require authentication', async () => {
      const groupData = new GroupBuilder()
        .withName(`Auth Test Delete ${uuidv4()}`)
        .build();
      const testGroup = await driver.createGroupNew(groupData, users[0].token);

      await expect(
        driver.deleteGroupNew(testGroup.id, '')
      ).rejects.toThrow(/401|unauthorized/i);
    });
  });

  describe('GET /groups - List Groups', () => {
    beforeEach(async () => {
      // Create multiple groups for testing
      const groupPromises = [];
      for (let i = 0; i < 5; i++) {
        groupPromises.push(
          driver.createGroupNew(new GroupBuilder()
            .withName(`List Test Group ${i} ${uuidv4()}`)
            .build(), users[0].token)
        );
      }
      await Promise.all(groupPromises);
    });

    test('should list all user groups', async () => {
      const response = await driver.listGroupsNew(users[0].token);

      expect(response.groups).toBeDefined();
      expect(Array.isArray(response.groups)).toBe(true);
      expect(response.groups.length).toBeGreaterThanOrEqual(5);
      expect(response.count).toBe(response.groups.length);
      expect(response.hasMore).toBeDefined();
    });

    test('should include group summaries with balance', async () => {
      const response = await driver.listGroupsNew(users[0].token);

      const firstGroup = response.groups[0];
      expect(firstGroup).toHaveProperty('id');
      expect(firstGroup).toHaveProperty('name');
      expect(firstGroup).toHaveProperty('memberCount');
      expect(firstGroup).toHaveProperty('balance');
      expect(firstGroup.balance).toHaveProperty('totalOwed');
      expect(firstGroup.balance).toHaveProperty('totalOwing');
      // userBalance is optional - may be undefined for groups without balances
      expect(firstGroup).toHaveProperty('lastActivity');
      expect(firstGroup).toHaveProperty('expenseCount');
    });

    test('should support pagination', async () => {
      // Get first page
      const page1 = await driver.listGroupsNew(users[0].token, { limit: 2 });
      expect(page1.groups).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Get second page
      const page2 = await driver.listGroupsNew(users[0].token, { 
        limit: 2, 
        cursor: page1.nextCursor 
      });
      expect(page2.groups).toHaveLength(2);
      
      // Ensure no duplicate IDs
      const page1Ids = page1.groups.map((g: any) => g.id);
      const page2Ids = page2.groups.map((g: any) => g.id);
      const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    test('should support ordering', async () => {
      const responseDesc = await driver.listGroupsNew(users[0].token, { order: 'desc' });
      const responseAsc = await driver.listGroupsNew(users[0].token, { order: 'asc' });

      // The most recently updated should be first in desc, last in asc
      expect(responseDesc.groups[0].id).not.toBe(responseAsc.groups[0].id);
    });

    test('should only show groups where user is member', async () => {
      // Create a group with only user[1]
      const otherGroup = await driver.createGroupNew(new GroupBuilder()
        .withName(`Other User Group ${uuidv4()}`)
        .build(), users[1].token);

      // user[0] should not see this group
      const response = await driver.listGroupsNew(users[0].token);
      const groupIds = response.groups.map((g: any) => g.id);
      expect(groupIds).not.toContain(otherGroup.id);
    });

    test('should require authentication', async () => {
      await expect(
        driver.listGroupsNew('')
      ).rejects.toThrow(/401|unauthorized/i);
    });
  });

});
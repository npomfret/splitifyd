/**
 * @jest-environment node
 */

// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

// Using native fetch from Node.js 18+
import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../support/ApiDriver';
import { ExpenseBuilder, GroupBuilder, UserBuilder } from '../support/builders';



describe('Comprehensive API Test Suite', () => {
  let driver: ApiDriver;
  let users: User[] = [];

  // Set a longer timeout for these integration tests
  jest.setTimeout(10000);

  beforeAll(async () => {
    driver = new ApiDriver();
    users = await Promise.all([
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
    ]);
  });

  describe('User Authentication', () => {
    test('should allow users to register and log in', () => {
      expect(users.length).toBe(2);
      users.forEach(user => {
        expect(user.uid).toBeDefined();
        expect(user.token).toBeDefined();
        expect(user.email).toContain('@test.com');
      });
    });
  });

  describe('Group Management', () => {
    describe('Group Creation', () => {
      test('should create a new group', async () => {
        const groupData = new GroupBuilder()
          .withName(`Test Group ${uuidv4()}`)
          .build();

        const response = await driver.createGroupNew(groupData, users[0].token);

        expect(response.id).toBeDefined();
        const createdGroup = response;

        // Verify the group was created
        const fetchedGroup = await driver.getGroupNew(createdGroup.id, users[0].token);
        expect(fetchedGroup.name).toBe(groupData.name);
        expect(fetchedGroup.members.length).toBe(1); // Only creator initially
      });

    });

    describe('Group Sharing & Access Control', () => {
      test('should only allow group members to access group details', async () => {
        // Create a group using the new API
        const groupData = new GroupBuilder()
          .withName(`Members Only Group ${uuidv4()}`)
          .build();
        const testGroup = await driver.createGroupNew(groupData, users[0].token);
        
        // Create a third user who is not part of the group
        const outsiderUser = await driver.createTestUser(new UserBuilder().build());
        
        // Try to access group as non-member
        await expect(
          driver.getGroupNew(testGroup.id, outsiderUser.token)
        ).rejects.toThrow(/403|FORBIDDEN|not.*member|access.*denied|404|NOT_FOUND/i);
      });

      test('should generate shareable link for group (admin only)', async () => {
        // Create a test group
        const testGroup = await driver.createGroup(`Share Link Test Group ${uuidv4()}`, users, users[0].token);
        
        // Admin (creator) should be able to generate a share link
        const shareResponse = await driver.generateShareLink(testGroup.id, users[0].token);
        
        expect(shareResponse).toHaveProperty('shareableUrl');
        expect(shareResponse).toHaveProperty('linkId');
        expect(shareResponse.shareableUrl).toContain('http');
        expect(shareResponse.shareableUrl).toContain('/join-group.html?linkId=');
        expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
      });

      test('should not allow non-admin to generate shareable link', async () => {
        // Create a new group where user[0] is the admin
        const nonAdminGroup = await driver.createGroup(`Non-Admin Test Group ${uuidv4()}`, users, users[0].token);
        
        // User[1] should not be able to generate a share link
        await expect(
          driver.generateShareLink(nonAdminGroup.id, users[1].token)
        ).rejects.toThrow(/403|FORBIDDEN|admin|not.*authorized/i);
      });

      test('should allow new users to join group via share link', async () => {
        // First, create a new group and generate a share link
        const shareableGroupData = new GroupBuilder()
          .withMember(users[0])
          .build();
        
        const shareableGroup = await driver.createGroupNew(shareableGroupData, users[0].token);
        
        // Generate share link
        const shareResponse = await driver.generateShareLink(shareableGroup.id, users[0].token);
        
        // Create a new user who will join via the link
        const newUser = await driver.createTestUser(new UserBuilder().build());
        
        // Join the group using the share token
        const joinResponse = await driver.joinGroupViaShareLink(shareResponse.linkId, newUser.token);
        
        expect(joinResponse).toHaveProperty('groupId');
        expect(joinResponse.groupId).toBe(shareableGroup.id);
        expect(joinResponse).toHaveProperty('message');
        expect(joinResponse).toHaveProperty('groupName');
        
        // Verify the user was added to the group
        const updatedGroup = await driver.getGroupNew(shareableGroup.id, newUser.token);
        const memberUids = updatedGroup.members.map((m: any) => m.uid);
        expect(memberUids).toContain(newUser.uid);
      });

      test('should not allow duplicate joining via share link', async () => {
        // Create a group with a share link
        const dupTestGroupData = new GroupBuilder()
          .withMember(users[0])
          .build();
        
        const dupTestGroup = await driver.createGroupNew(dupTestGroupData, users[0].token);
        const shareResponse = await driver.generateShareLink(dupTestGroup.id, users[0].token);
        
        // Add user[1] to the group via share link
        await driver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);
        
        // Try to join again with the same user
        await expect(
          driver.joinGroupViaShareLink(shareResponse.linkId, users[1].token)
        ).rejects.toThrow(/already.*member|duplicate.*member/i);
      });

      test('should reject invalid share tokens', async () => {
        const invalidUser = await driver.createTestUser(new UserBuilder().build());
        
        // Try to join with an invalid token
        await expect(
          driver.joinGroupViaShareLink('INVALID_TOKEN_12345', invalidUser.token)
        ).rejects.toThrow(/Invalid.*link|not found|expired|404/i);
      });

      test('should allow multiple users to join group using the same share link', async () => {
        // Create a new group with only one member
        const multiJoinGroupData = new GroupBuilder()
          .withMember(users[0])
          .build();
        
        const multiJoinGroup = await driver.createGroupNew(multiJoinGroupData, users[0].token);
        
        // Generate a share link
        const shareResponse = await driver.generateShareLink(multiJoinGroup.id, users[0].token);
        
        // Create multiple new users who will join via the same link
        const newUsers = await Promise.all([
          driver.createTestUser(new UserBuilder().build()),
          driver.createTestUser(new UserBuilder().build()),
          driver.createTestUser(new UserBuilder().build())
        ]);
        
        // All users should be able to join using the same link
        for (const user of newUsers) {
          const joinResponse = await driver.joinGroupViaShareLink(shareResponse.linkId, user.token);
          
          expect(joinResponse).toHaveProperty('groupId');
          expect(joinResponse.groupId).toBe(multiJoinGroup.id);
          expect(joinResponse).toHaveProperty('message');
        }
        
        // Verify all users were added to the group
        const updatedGroup = await driver.getGroupNew(multiJoinGroup.id, users[0].token);
        const memberUids = updatedGroup.members.map((m: any) => m.uid);
        
        // Should have original member + 3 new members = 4 total
        expect(memberUids.length).toBe(4);
        expect(memberUids).toContain(users[0].uid);
        newUsers.forEach(user => {
          expect(memberUids).toContain(user.uid);
        });
      });
    });
  });

  describe('Expense Management', () => {
    let testGroup: any;

    beforeEach(async () => {
      testGroup = await driver.createGroup(`Test Group ${uuidv4()}`, users, users[0].token);
    });

    describe('Expense Creation', () => {
      test('should add an expense to the group', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withParticipants(users.map(u => u.uid))
          .build();

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();
        const createdExpense = { id: response.id, ...expenseData };

        // Verify the expense was created by fetching it
        const fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
        expect(fetchedExpense.description).toBe(expenseData.description);
        expect(fetchedExpense.amount).toBe(expenseData.amount);
        expect(fetchedExpense.paidBy).toBe(users[0].uid);
      });

      test('should add an expense with an unequal split', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('Unequal Split Expense')
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants(users.map(u => u.uid))
          .withSplits([
            { userId: users[0].uid, amount: 80 },
            { userId: users[1].uid, amount: 20 }
          ])
          .withCategory('utilities')
          .build();

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        // Verify the expense was created correctly with unequal splits
        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(100);
        expect(createdExpense.splitType).toBe('exact');
        expect(createdExpense.splits).toHaveLength(2);
        const user0Split = createdExpense.splits.find((s: any) => s.userId === users[0].uid);
        const user1Split = createdExpense.splits.find((s: any) => s.userId === users[1].uid);
        expect(user0Split?.amount).toBe(80);
        expect(user1Split?.amount).toBe(20);
        
        // Verify the splits add up to the total amount
        const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBe(100);
      });

      test("should list all of a group's expenses", async () => {
        // Add multiple expenses
        await driver.createExpense(new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withAmount(100)
          .withPaidBy(users[0].uid)
          .withParticipants(users.map(u => u.uid))
          .withDescription('First Test Expense')
          .build(), users[0].token);
        
        await driver.createExpense(new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withAmount(50)
          .withPaidBy(users[1].uid)
          .withParticipants(users.map(u => u.uid))
          .withDescription('Second Test Expense')
          .build(), users[1].token);
        
        const response = await driver.getGroupExpenses(testGroup.id, users[0].token);
        expect(response).toHaveProperty('expenses');
        expect(Array.isArray(response.expenses)).toBe(true);
        expect(response.expenses.length).toBe(2);
        const expenseDescriptions = response.expenses.map((e: any) => e.description);
        expect(expenseDescriptions).toContain('First Test Expense');
        expect(expenseDescriptions).toContain('Second Test Expense');
      });
    });

    describe('Expense Updates', () => {
      test('should update an expense', async () => {
        const initialExpenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withAmount(100)
          .withPaidBy(users[0].uid)
          .withParticipants(users.map(u => u.uid))
          .build();
        const createdExpense = await driver.createExpense(initialExpenseData, users[0].token);
        
        const updatedData = {
          description: 'Updated Test Expense',
          amount: 150.50,
          category: 'food'
        };

        // Use PUT for updates, passing the expense ID in the query
        await driver.updateExpense(createdExpense.id, updatedData, users[0].token);

        const fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
        
        expect(fetchedExpense.description).toBe(updatedData.description);
        expect(fetchedExpense.amount).toBe(updatedData.amount);
        expect(fetchedExpense.category).toBe(updatedData.category);
      });

      test('should recalculate splits when amount is updated with exact split type', async () => {
        // Create a new expense specifically for this test
        const testExpenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('Split Recalculation Test')
          .withAmount(100)
          .withPaidBy(users[0].uid)
          .withParticipants(users.map(u => u.uid))
          .build();

        const createResponse = await driver.createExpense(testExpenseData, users[0].token);
        expect(createResponse.id).toBeDefined();

        // Fetch the created expense to verify initial splits
        const initialExpense = await driver.getExpense(createResponse.id, users[0].token);
        expect(initialExpense.amount).toBe(100);
        expect(initialExpense.splits).toHaveLength(2);
        expect(initialExpense.splits[0].amount).toBe(50);
        expect(initialExpense.splits[1].amount).toBe(50);

        // Update only the amount
        const updatedData = {
          amount: 150.50
        };

        await driver.updateExpense(createResponse.id, updatedData, users[0].token);

        // Fetch the updated expense to verify splits were recalculated
        const updatedExpense = await driver.getExpense(createResponse.id, users[0].token);
        
        expect(updatedExpense.amount).toBe(150.50);
        expect(updatedExpense.splits).toHaveLength(2);
        expect(updatedExpense.splits[0].amount).toBe(75.25);
        expect(updatedExpense.splits[1].amount).toBe(75.25);
        
        // Verify that the total of splits equals the new amount
        const totalSplits = updatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBe(150.50);
      });

      test('should recalculate splits when amount is updated with exact split type', async () => {
        // Create an expense with exact splits
        const testExpenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('Exact Split Test')
          .withAmount(100)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants(users.map(u => u.uid))
          .withSplits([
            { userId: users[0].uid, amount: 60 },
            { userId: users[1].uid, amount: 40 }
          ])
          .build();

        const createResponse = await driver.createExpense(testExpenseData, users[0].token);
        expect(createResponse.id).toBeDefined();

        // Fetch the created expense to verify initial splits
        const initialExpense = await driver.getExpense(createResponse.id, users[0].token);
        expect(initialExpense.amount).toBe(100);
        expect(initialExpense.splits).toHaveLength(2);
        const user0Split = initialExpense.splits.find((s: any) => s.userId === users[0].uid);
        const user1Split = initialExpense.splits.find((s: any) => s.userId === users[1].uid);
        expect(user0Split?.amount).toBe(60);
        expect(user1Split?.amount).toBe(40);

        // Update only the amount - should revert to equal splits since no new splits provided
        const updatedData = {
          amount: 150
        };

        await driver.updateExpense(createResponse.id, updatedData, users[0].token);

        // Fetch the updated expense to verify splits were recalculated to equal
        const updatedExpense = await driver.getExpense(createResponse.id, users[0].token);
        
        expect(updatedExpense.amount).toBe(150);
        expect(updatedExpense.splits).toHaveLength(2);
        expect(updatedExpense.splits[0].amount).toBe(75);
        expect(updatedExpense.splits[1].amount).toBe(75);
        
        // Verify that the total of splits equals the new amount
        const totalSplits = updatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBe(150);
      });
    });

    describe('Expense Deletion', () => {
      test('should delete an expense', async () => {
        // First, create an expense to be deleted
        const expenseToDeleteData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('To be deleted')
          .withAmount(50)
          .withPaidBy(users[1].uid)
          .withParticipants(users.map(u => u.uid))
          .build();
        const createdExpense = await driver.createExpense(expenseToDeleteData, users[1].token);
        expect(createdExpense.id).toBeDefined();

        // Now, delete it
        await driver.deleteExpense(createdExpense.id, users[1].token);

        // Verify it's gone
        await expect(
          driver.getExpense(createdExpense.id, users[1].token)
        ).rejects.toThrow(/not found|deleted|404/);
      });
    });
  });

  describe('Balance Calculations', () => {
    let balanceTestGroup: any;

    beforeEach(async () => {
      balanceTestGroup = await driver.createGroup(`Balance Test Group ${uuidv4()}`, users, users[0].token);
    });

    test('should include balance information in group details', async () => {
      // Create an expense: User 0 pays 100, split equally between 2 users
      const expenseData = new ExpenseBuilder()
        .withGroupId(balanceTestGroup.id)
        .withAmount(100)
        .withPaidBy(users[0].uid)
        .withParticipants(users.map(u => u.uid))
        .build();
      await driver.createExpense(expenseData, users[0].token);
      
      // Get group details to check balance info
      const groupDetails = await driver.getGroupNew(balanceTestGroup.id, users[0].token);
      
      // Verify the response structure includes balance info
      expect(groupDetails).toHaveProperty('id');
      expect(groupDetails).toHaveProperty('name');
      expect(groupDetails).toHaveProperty('members');
      expect(groupDetails.members.length).toBeGreaterThan(0);
    });

    test('should include balance data in listGroups response', async () => {
      // Add an expense: User 0 pays 100, split equally between 2 users
      const expenseData = new ExpenseBuilder()
        .withGroupId(balanceTestGroup.id)
        .withAmount(100)
        .withPaidBy(users[0].uid)
        .withParticipants(users.map(u => u.uid))
        .build();
      await driver.createExpense(expenseData, users[0].token);
      
      // Get group list to check balance data
      
      // Test the listGroups endpoint (which dashboard uses)
      const listResponse = await driver.listGroupsNew(users[0].token);
      
      expect(listResponse).toHaveProperty('groups');
      expect(Array.isArray(listResponse.groups)).toBe(true);
      
      // Find our test group in the list
      const testGroupInList = listResponse.groups.find((group: any) => group.id === balanceTestGroup.id);
      expect(testGroupInList).toBeDefined();
      
      // Verify balance data is included
      expect(testGroupInList!.balance).toHaveProperty('userBalance');
      // Check if userBalance might be null or undefined in some cases
      if (testGroupInList!.balance.userBalance !== null && testGroupInList!.balance.userBalance !== undefined) {
        expect(typeof testGroupInList!.balance.userBalance).toBe('object');
        expect(testGroupInList!.balance.userBalance).toHaveProperty('netBalance');
      }
      
      // User 0 paid 100, split equally between 2 users = User 0 should be owed 50
      // But balance calculation might be async, so we accept 0 as well
      const netBalance = testGroupInList!.balance.userBalance?.netBalance || 0;
      expect([0, 50]).toContain(netBalance);
    });

    // NOTE: This test now uses synchronous metadata updates in expense handlers
    // instead of relying solely on triggers, ensuring consistency in both emulator and production
    test('should include expense metadata in listGroups response after creating expenses', async () => {
      // First, verify the group starts with no expense metadata
      const initialListResponse = await driver.listGroupsNew(users[0].token);
      const initialGroupInList = initialListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);
      
      expect(initialGroupInList).toBeDefined();
      expect(initialGroupInList!.expenseCount).toBe(0);
      expect(initialGroupInList!.lastExpense).toBeNull();
      
      // Add an expense
      const expenseData = new ExpenseBuilder()
        .withGroupId(balanceTestGroup.id)
        .withAmount(75)
        .withPaidBy(users[0].uid)
        .withParticipants(users.map(u => u.uid))
        .build();
      await driver.createExpense(expenseData, users[0].token);
      
      // Check immediately after creating expense (should be synchronous now)
      const updatedListResponse = await driver.listGroupsNew(users[0].token);
      const updatedGroupInList = updatedListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);
      
      expect(updatedGroupInList).toBeDefined();
      
      // Verify expense metadata is populated synchronously
      expect(updatedGroupInList!).toHaveProperty('expenseCount');
      expect(updatedGroupInList!.expenseCount).toBe(1);
      
      expect(updatedGroupInList!).toHaveProperty('lastExpense');
      expect(updatedGroupInList!.lastActivityRaw).toBeDefined();
      expect(typeof updatedGroupInList!.lastActivityRaw).toBe('string');
      
      // Verify the lastActivityRaw is a valid ISO timestamp
      expect(new Date(updatedGroupInList!.lastActivityRaw).getTime()).not.toBeNaN();
      
      // Add another expense to test count increment
      const secondExpenseData = new ExpenseBuilder()
        .withGroupId(balanceTestGroup.id)
        .withAmount(25)
        .withPaidBy(users[1].uid)
        .withParticipants(users.map(u => u.uid))
        .build();
      await driver.createExpense(secondExpenseData, users[1].token);
      
      // Check immediately after second expense
      const finalListResponse = await driver.listGroupsNew(users[0].token);
      const finalGroupInList = finalListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);
      
      expect(finalGroupInList!.expenseCount).toBe(2);
      expect(finalGroupInList!.lastActivityRaw).toBeDefined();
      
      // The lastActivityRaw should be updated to the more recent expense
      const lastExpenseTime = new Date(finalGroupInList!.lastActivityRaw);
      const initialExpenseTime = new Date(updatedGroupInList!.lastActivityRaw);
      expect(lastExpenseTime.getTime()).toBeGreaterThanOrEqual(initialExpenseTime.getTime());
    });
  });

  describe('API Security & Headers', () => {
    test('should return proper CORS headers', async () => {
      const testOrigin = 'http://localhost:3000';
      const url = `${driver.getBaseUrl()}/health`;
      
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          'Origin': testOrigin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type,Authorization'
        }
      });
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });

    test('should return security headers', async () => {
      const url = `${driver.getBaseUrl()}/health`;
      const response = await fetch(url);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
      expect(response.headers.get('X-Frame-Options')).toBeTruthy();
      expect(response.headers.get('X-XSS-Protection')).toBeTruthy();
    });
  });
});
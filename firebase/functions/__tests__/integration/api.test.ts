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



describe('Comprehensive API Test Suite', () => {
  let driver: ApiDriver;
  let users: User[] = [];

  // Set a longer timeout for these integration tests
  jest.setTimeout(30000);

  beforeAll(async () => {
    driver = new ApiDriver();
    // Create unique users for this test run to avoid collisions
    const userSuffix = uuidv4().slice(0, 8);
    users = await Promise.all([
      driver.createTestUser({ email: `testuser1-${userSuffix}@test.com`, password: 'Password123!', displayName: 'Test User 1' }),
      driver.createTestUser({ email: `testuser2-${userSuffix}@test.com`, password: 'Password123!', displayName: 'Test User 2' }),
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
        const groupName = `Test Group ${uuidv4()}`;
        const groupData = {
          name: groupName,
          members: users.map(u => ({ uid: u.uid, name: u.displayName, email: u.email, initials: u.displayName.split(' ').map(n => n[0]).join('') }))
        };

        const response = await driver.createDocument(groupData, users[0].token);

        expect(response.id).toBeDefined();
        const createdGroup = { id: response.id, ...groupData };

        // Verify the group was created
        const fetchedGroup = await driver.getDocument(createdGroup.id, users[0].token);
        expect(fetchedGroup.data.name).toBe(groupName);
        expect(fetchedGroup.data.members.length).toBe(2);
      });

    });

    describe('Group Sharing & Access Control', () => {
      test('should only allow group members to access balances', async () => {
        // Create a group for this test
        const testGroup = await driver.createGroup(`Members Only Group ${uuidv4()}`, users, users[0].token);
        
        // Create a third user who is not part of the group
        const outsiderUser = await driver.createTestUser({
          email: `outsider-${uuidv4()}@test.com`,
          password: 'Password123!',
          displayName: 'Outsider User'
        });
        
        // Try to access balances as non-member
        await expect(
          driver.getGroupBalances(testGroup.id, outsiderUser.token)
        ).rejects.toThrow(/403|FORBIDDEN|not.*member|access.*denied/i);
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
        expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9]{16}$/);
      });

      test('should not allow non-admin to generate shareable link', async () => {
        // Create a new group where user[1] is not the admin
        const nonAdminGroupData = {
          name: `Non-Admin Test Group ${uuidv4()}`,
          members: users.map(u => ({ uid: u.uid, name: u.displayName, email: u.email, initials: u.displayName.split(' ').map(n => n[0]).join('') })),
          createdBy: users[0].uid
        };
        
        const nonAdminGroup = await driver.createDocument(nonAdminGroupData, users[0].token);
        
        // User[1] should not be able to generate a share link
        await expect(
          driver.generateShareLink(nonAdminGroup.id, users[1].token)
        ).rejects.toThrow(/403|FORBIDDEN|admin|not.*authorized/i);
      });

      test('should allow new users to join group via share link', async () => {
        // First, create a new group and generate a share link
        const shareableGroupData = {
          name: `Shareable Group ${uuidv4()}`,
          members: [{ uid: users[0].uid, name: users[0].displayName, email: users[0].email, initials: users[0].displayName.split(' ').map(n => n[0]).join('') }]
        };
        
        const shareableGroup = await driver.createDocument(shareableGroupData, users[0].token);
        
        // Generate share link
        const shareResponse = await driver.generateShareLink(shareableGroup.id, users[0].token);
        
        // Create a new user who will join via the link
        const newUser = await driver.createTestUser({
          email: `newuser-${uuidv4()}@test.com`,
          password: 'Password123!',
          displayName: 'New User'
        });
        
        // Join the group using the share token
        const joinResponse = await driver.joinGroupViaShareLink(shareResponse.linkId, newUser.token);
        
        expect(joinResponse).toHaveProperty('groupId');
        expect(joinResponse.groupId).toBe(shareableGroup.id);
        expect(joinResponse).toHaveProperty('message');
        expect(joinResponse).toHaveProperty('groupName');
        
        // Verify the user was added to the group
        const updatedGroup = await driver.getDocument(shareableGroup.id, newUser.token);
        const memberUids = updatedGroup.data.members.map((m: any) => m.uid);
        expect(memberUids).toContain(newUser.uid);
      });

      test('should not allow duplicate joining via share link', async () => {
        // Create a group with a share link
        const dupTestGroupData = {
          name: `Duplicate Test Group ${uuidv4()}`,
          members: [{ uid: users[0].uid, name: users[0].displayName, email: users[0].email, initials: users[0].displayName.split(' ').map(n => n[0]).join('') }]
        };
        
        const dupTestGroup = await driver.createDocument(dupTestGroupData, users[0].token);
        const shareResponse = await driver.generateShareLink(dupTestGroup.id, users[0].token);
        
        // Add user[1] to the group via share link
        await driver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);
        
        // Try to join again with the same user
        await expect(
          driver.joinGroupViaShareLink(shareResponse.linkId, users[1].token)
        ).rejects.toThrow(/already.*member|duplicate.*member/i);
      });

      test('should reject invalid share tokens', async () => {
        const invalidUser = await driver.createTestUser({
          email: `invalid-${uuidv4()}@test.com`,
          password: 'Password123!',
          displayName: 'Invalid User'
        });
        
        // Try to join with an invalid token
        await expect(
          driver.joinGroupViaShareLink('INVALID_TOKEN_12345', invalidUser.token)
        ).rejects.toThrow(/Invalid.*link|not found|expired|404/i);
      });

      test('should allow multiple users to join group using the same share link', async () => {
        // Create a new group with only one member
        const multiJoinGroupData = {
          name: `Multi-Join Group ${uuidv4()}`,
          members: [{ uid: users[0].uid, name: users[0].displayName, email: users[0].email, initials: users[0].displayName.split(' ').map(n => n[0]).join('') }]
        };
        
        const multiJoinGroup = await driver.createDocument(multiJoinGroupData, users[0].token);
        
        // Generate a share link
        const shareResponse = await driver.generateShareLink(multiJoinGroup.id, users[0].token);
        
        // Create multiple new users who will join via the same link
        const newUsers = await Promise.all([
          driver.createTestUser({
            email: `multiuser1-${uuidv4()}@test.com`,
            password: 'Password123!',
            displayName: 'Multi User 1'
          }),
          driver.createTestUser({
            email: `multiuser2-${uuidv4()}@test.com`,
            password: 'Password123!',
            displayName: 'Multi User 2'
          }),
          driver.createTestUser({
            email: `multiuser3-${uuidv4()}@test.com`,
            password: 'Password123!',
            displayName: 'Multi User 3'
          })
        ]);
        
        // All users should be able to join using the same link
        for (const user of newUsers) {
          const joinResponse = await driver.joinGroupViaShareLink(shareResponse.linkId, user.token);
          
          expect(joinResponse).toHaveProperty('groupId');
          expect(joinResponse.groupId).toBe(multiJoinGroup.id);
          expect(joinResponse).toHaveProperty('message');
        }
        
        // Verify all users were added to the group
        const updatedGroup = await driver.getDocument(multiJoinGroup.id, users[0].token);
        const memberUids = updatedGroup.data.members.map((m: any) => m.uid);
        
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
        const expenseData = {
          groupId: testGroup.id,
          description: 'Test Expense',
          amount: 100,
          category: 'other',
          date: new Date().toISOString(),
          paidBy: users[0].uid,
          splitType: 'equal',
          participants: users.map(u => u.uid)
        };

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();
        const createdExpense = { id: response.id, ...expenseData };

        // Verify the expense was created by fetching it
        const fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
        expect(fetchedExpense.description).toBe('Test Expense');
        expect(fetchedExpense.amount).toBe(100);
        expect(fetchedExpense.paidBy).toBe(users[0].uid);
      });

      test('should add an expense with an unequal split', async () => {
        const expenseData = {
          groupId: testGroup.id,
          description: 'Unequal Split Expense',
          amount: 100,
          paidBy: users[0].uid,
          splitType: 'exact',
          participants: users.map(u => u.uid),
          splits: [
            { userId: users[0].uid, amount: 80 },
            { userId: users[1].uid, amount: 20 }
          ],
          date: new Date().toISOString(),
          category: 'utilities',
        };

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        // Verify the expense was created correctly with unequal splits
        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(100);
        expect(createdExpense.splitType).toBe('exact');
        expect(createdExpense.splits).toHaveLength(2);
        expect(createdExpense.splits.find((s: any) => s.userId === users[0].uid).amount).toBe(80);
        expect(createdExpense.splits.find((s: any) => s.userId === users[1].uid).amount).toBe(20);
        
        // Verify the splits add up to the total amount
        const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBe(100);
      });

      test("should list all of a group's expenses", async () => {
        // Add multiple expenses
        await driver.createExpense({
          ...driver.createTestExpense(testGroup.id, users[0].uid, users.map(u => u.uid), 100),
          description: 'First Test Expense'
        }, users[0].token);
        
        await driver.createExpense({
          ...driver.createTestExpense(testGroup.id, users[1].uid, users.map(u => u.uid), 50),
          description: 'Second Test Expense'
        }, users[1].token);
        
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
        const initialExpenseData = driver.createTestExpense(testGroup.id, users[0].uid, users.map(u => u.uid), 100);
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
        const testExpenseData = {
          groupId: testGroup.id,
          description: 'Split Recalculation Test',
          amount: 100,
          category: 'other',
          date: new Date().toISOString(),
          paidBy: users[0].uid,
          splitType: 'equal',
          participants: users.map(u => u.uid)
        };

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
        const testExpenseData = {
          groupId: testGroup.id,
          description: 'Exact Split Test',
          amount: 100,
          category: 'other',
          date: new Date().toISOString(),
          paidBy: users[0].uid,
          splitType: 'exact',
          participants: users.map(u => u.uid),
          splits: [
            { userId: users[0].uid, amount: 60 },
            { userId: users[1].uid, amount: 40 }
          ]
        };

        const createResponse = await driver.createExpense(testExpenseData, users[0].token);
        expect(createResponse.id).toBeDefined();

        // Fetch the created expense to verify initial splits
        const initialExpense = await driver.getExpense(createResponse.id, users[0].token);
        expect(initialExpense.amount).toBe(100);
        expect(initialExpense.splits).toHaveLength(2);
        expect(initialExpense.splits.find((s: any) => s.userId === users[0].uid).amount).toBe(60);
        expect(initialExpense.splits.find((s: any) => s.userId === users[1].uid).amount).toBe(40);

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
        const expenseToDeleteData = {
          groupId: testGroup.id,
          description: 'To be deleted',
          amount: 50,
          paidBy: users[1].uid,
          splitType: 'equal',
          participants: users.map(u => u.uid),
          date: new Date().toISOString(),
          category: 'other',
        };
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

    test('should calculate group balances correctly', async () => {
      // Create an expense: User 0 pays 100, split equally between 2 users
      const expenseData = driver.createTestExpense(balanceTestGroup.id, users[0].uid, users.map(u => u.uid), 100);
      await driver.createExpense(expenseData, users[0].token);
      
      // Wait for Firebase triggers to update balances
      const balances = await driver.waitForBalanceUpdate(balanceTestGroup.id, users[0].token);
      
      // Verify the response structure
      expect(balances).toHaveProperty('groupId');
      expect(balances).toHaveProperty('userBalances');
      expect(balances).toHaveProperty('simplifiedDebts');
      expect(balances).toHaveProperty('lastUpdated');
      
      // Verify user balances are present for both users
      expect(balances.userBalances).toHaveProperty(users[0].uid);
      expect(balances.userBalances).toHaveProperty(users[1].uid);
      
      // User 0 paid 100, split equally between 2 users
      // So user 0 should be owed 50 by user 1
      const user0Balance = balances.userBalances[users[0].uid];
      const user1Balance = balances.userBalances[users[1].uid];
      
      expect(user0Balance.userId).toBe(users[0].uid);
      expect(user0Balance.name).toBe(users[0].displayName);
      expect(user0Balance.owedBy[users[1].uid]).toBe(50);
      
      expect(user1Balance.userId).toBe(users[1].uid);
      expect(user1Balance.name).toBe(users[1].displayName);
      expect(user1Balance.owes[users[0].uid]).toBe(50);
    });

    test('should include balance data in listDocuments response', async () => {
      // Add an expense: User 0 pays 100, split equally between 2 users
      const expenseData = driver.createTestExpense(balanceTestGroup.id, users[0].uid, users.map(u => u.uid), 100);
      await driver.createExpense(expenseData, users[0].token);
      
      // Wait for balance calculations to complete
      await driver.waitForBalanceUpdate(balanceTestGroup.id, users[0].token);
      
      // Test the listDocuments endpoint (which dashboard uses)
      const listResponse = await driver.listDocuments(users[0].token);
      
      expect(listResponse).toHaveProperty('documents');
      expect(Array.isArray(listResponse.documents)).toBe(true);
      
      // Find our test group in the list
      const testGroupInList = listResponse.documents.find((doc: any) => doc.id === balanceTestGroup.id);
      expect(testGroupInList).toBeDefined();
      
      // Verify balance data is included
      expect(testGroupInList!.data).toHaveProperty('yourBalance');
      expect(typeof testGroupInList!.data.yourBalance).toBe('number');
      
      // User 0 paid 100, split equally between 2 users = User 0 should be owed 50
      expect(testGroupInList!.data.yourBalance).toBe(50);
    });

    // NOTE: This test now uses synchronous metadata updates in expense handlers
    // instead of relying solely on triggers, ensuring consistency in both emulator and production
    test('should include expense metadata in listDocuments response after creating expenses', async () => {
      // First, verify the group starts with no expense metadata
      const initialListResponse = await driver.listDocuments(users[0].token);
      const initialGroupInList = initialListResponse.documents.find((doc: any) => doc.id === balanceTestGroup.id);
      
      expect(initialGroupInList).toBeDefined();
      expect(initialGroupInList!.data.expenseCount).toBeUndefined();
      expect(initialGroupInList!.data.lastExpenseTime).toBeUndefined();
      
      // Add an expense
      const expenseData = driver.createTestExpense(balanceTestGroup.id, users[0].uid, users.map(u => u.uid), 75);
      await driver.createExpense(expenseData, users[0].token);
      
      // Check immediately after creating expense (should be synchronous now)
      const updatedListResponse = await driver.listDocuments(users[0].token);
      const updatedGroupInList = updatedListResponse.documents.find((doc: any) => doc.id === balanceTestGroup.id);
      
      expect(updatedGroupInList).toBeDefined();
      
      // Verify expense metadata is populated synchronously
      expect(updatedGroupInList!.data).toHaveProperty('expenseCount');
      expect(updatedGroupInList!.data.expenseCount).toBe(1);
      
      expect(updatedGroupInList!.data).toHaveProperty('lastExpenseTime');
      expect(updatedGroupInList!.data.lastExpenseTime).toBeDefined();
      expect(typeof updatedGroupInList!.data.lastExpenseTime).toBe('string');
      
      // Verify the lastExpenseTime is a valid ISO timestamp
      expect(new Date(updatedGroupInList!.data.lastExpenseTime).getTime()).not.toBeNaN();
      
      // Add another expense to test count increment
      const secondExpenseData = driver.createTestExpense(balanceTestGroup.id, users[1].uid, users.map(u => u.uid), 25);
      await driver.createExpense(secondExpenseData, users[1].token);
      
      // Check immediately after second expense
      const finalListResponse = await driver.listDocuments(users[0].token);
      const finalGroupInList = finalListResponse.documents.find((doc: any) => doc.id === balanceTestGroup.id);
      
      expect(finalGroupInList!.data.expenseCount).toBe(2);
      expect(finalGroupInList!.data.lastExpenseTime).toBeDefined();
      
      // The lastExpenseTime should be updated to the more recent expense
      const lastExpenseTime = new Date(finalGroupInList!.data.lastExpenseTime);
      const initialExpenseTime = new Date(updatedGroupInList!.data.lastExpenseTime);
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
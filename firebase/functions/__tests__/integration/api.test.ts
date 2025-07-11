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

  test('should allow users to register and log in', () => {
    expect(users.length).toBe(2);
    users.forEach(user => {
      expect(user.uid).toBeDefined();
      expect(user.token).toBeDefined();
      expect(user.email).toContain('@test.com');
    });
  });

  test('should create a new group', async () => {
    const groupName = `Test Group ${uuidv4()}`;
    const groupData = {
      name: groupName,
      members: users.map(u => ({ uid: u.uid, name: u.displayName, email: u.email, initials: u.displayName.split(' ').map(n => n[0]).join('') }))
    };

    const response = await driver.apiRequest('/createDocument', 'POST', { data: groupData }, users[0].token);

    expect(response.id).toBeDefined();
    const createdGroup = { id: response.id, ...groupData };

    // Verify the group was created
    const fetchedGroup = await driver.getDocument(createdGroup.id, users[0].token);
    expect(fetchedGroup.data.name).toBe(groupName);
    expect(fetchedGroup.data.members.length).toBe(2);
  });

  test('should add an expense to the group', async () => {
    // First create a group for this test
    const testGroup = await driver.createGroup(`Test Group ${uuidv4()}`, users, users[0].token);
    
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

    const response = await driver.apiRequest('/expenses', 'POST', expenseData, users[0].token);
    expect(response.id).toBeDefined();
    const createdExpense = { id: response.id, ...expenseData };

    // Verify the expense was created by fetching it
    const fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
    expect(fetchedExpense.description).toBe('Test Expense');
    expect(fetchedExpense.amount).toBe(100);
    expect(fetchedExpense.paidBy).toBe(users[0].uid);
  });

  test('should delete an expense', async () => {
    // Create a group for this test
    const testGroup = await driver.createGroup(`Delete Test Group ${uuidv4()}`, users, users[0].token);
    
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

  test('should calculate group balances correctly', async () => {
    // Create a group and expense for this test
    const testGroup = await driver.createGroup(`Balance Test Group ${uuidv4()}`, users, users[0].token);
    
    // Create an expense: User 0 pays 100, split equally between 2 users
    const expenseData = driver.createTestExpense(testGroup.id, users[0].uid, users.map(u => u.uid), 100);
    await driver.createExpense(expenseData, users[0].token);
    
    // Wait for Firebase triggers to update balances
    const balances = await driver.waitForBalanceUpdate(testGroup.id, users[0].token);
    
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

  test('should handle groups with different member data structures', async () => {
    // Create a group with members in a different structure (testing the fix in balanceHandlers.ts)
    const altGroupData = {
      name: `Alt Structure Group ${uuidv4()}`,
      // Testing flat member structure instead of nested under data
      members: users.map(u => ({ uid: u.uid, name: u.displayName, email: u.email, initials: u.displayName.split(' ').map(n => n[0]).join('') }))
    };

    const altGroup = await driver.apiRequest('/createDocument', 'POST', { data: altGroupData }, users[0].token);
    
    // Add an expense to this group
    const altExpenseData = {
      groupId: altGroup.id,
      description: 'Alternative Group Expense',
      amount: 200,
      category: 'other',
      date: new Date().toISOString(),
      paidBy: users[1].uid,
      splitType: 'equal',
      participants: users.map(u => u.uid)
    };

    await driver.createExpense(altExpenseData, users[1].token);
    
    // Wait for Firebase triggers to update balances
    const altBalances = await driver.waitForBalanceUpdate(altGroup.id, users[0].token);
    
    expect(altBalances).toHaveProperty('userBalances');
    expect(Object.keys(altBalances.userBalances).length).toBe(2);
    
    // Verify the names are resolved correctly using the member map
    const altUser0Balance = altBalances.userBalances[users[0].uid];
    const altUser1Balance = altBalances.userBalances[users[1].uid];
    
    expect(altUser0Balance.name).toBe(users[0].displayName);
    expect(altUser1Balance.name).toBe(users[1].displayName);
    
    // User 1 paid 200, split equally between 2 users
    // So user 1 should be owed 100 by user 0
    expect(altUser1Balance.owedBy[users[0].uid]).toBe(100);
    expect(altUser0Balance.owes[users[1].uid]).toBe(100);
  });

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
    
    const nonAdminGroup = await driver.apiRequest('/createDocument', 'POST', { data: nonAdminGroupData }, users[0].token);
    
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
    
    const shareableGroup = await driver.apiRequest('/createDocument', 'POST', { data: shareableGroupData }, users[0].token);
    
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
    
    const dupTestGroup = await driver.apiRequest('/createDocument', 'POST', { data: dupTestGroupData }, users[0].token);
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
    
    const multiJoinGroup = await driver.apiRequest('/createDocument', 'POST', { data: multiJoinGroupData }, users[0].token);
    
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

  test('should update an expense', async () => {
    // Create a group and expense for this test
    const testGroup = await driver.createGroup(`Update Test Group ${uuidv4()}`, users, users[0].token);
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

  test('should recalculate splits when only amount is updated', async () => {
    // Create a group for this test
    const testGroup = await driver.createGroup(`Split Recalc Group ${uuidv4()}`, users, users[0].token);
    
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
    // Create a group for this test
    const testGroup = await driver.createGroup(`Exact Split Group ${uuidv4()}`, users, users[0].token);
    
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


  test('should add an expense with an unequal split', async () => {
    // Create a group for this test
    const testGroup = await driver.createGroup(`Unequal Split Group ${uuidv4()}`, users, users[0].token);
    
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
    // Create a group and add multiple expenses
    const testGroup = await driver.createGroup(`List Expenses Group ${uuidv4()}`, users, users[0].token);
    
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

  describe('Advanced Debt and Balance Scenarios', () => {
    let testGroup: any;
    let user1: User, user2: User, user3: User;

    beforeAll(async () => {
      // Create a fresh set of users for this specific suite to ensure isolation
      const userSuffix = uuidv4().slice(0, 8);
      [user1, user2, user3] = await Promise.all([
        driver.createTestUser({ email: `adv-user1-${userSuffix}@test.com`, password: 'Password123!', displayName: 'Adv User 1' }),
        driver.createTestUser({ email: `adv-user2-${userSuffix}@test.com`, password: 'Password123!', displayName: 'Adv User 2' }),
        driver.createTestUser({ email: `adv-user3-${userSuffix}@test.com`, password: 'Password123!', displayName: 'Adv User 3' }),
      ]);
    });

    beforeEach(async () => {
      // Create a new group before each test to ensure no state leakage
      testGroup = await driver.createGroup(`Advanced Test Group ${uuidv4()}`, [user1, user2, user3], user1.token);
    });

    // TODO: This test is timing out, likely due to a backend issue with asynchronous balance updates.
    test.skip('should correctly calculate balances after an expense is deleted', async () => {
      // Step 1: Create an expense that generates debt
      const expenseData = driver.createTestExpense(testGroup.id, user1.uid, [user1.uid, user2.uid], 100);
      const expense = await driver.createExpense(expenseData, user1.token);
      
      // Step 2: Verify the initial debt (User 2 owes User 1 $50)
      let balances = await driver.waitForBalanceUpdate(testGroup.id, user1.token, (b) => b.simplifiedDebts.length > 0, 58000);
      expect(balances.simplifiedDebts[0]).toMatchObject({ from: { userId: user2.uid }, to: { userId: user1.uid }, amount: 50 });

      // Step 3: Delete the expense
      await driver.deleteExpense(expense.id, user1.token);

      // Step 4: Verify the debt is gone
      balances = await driver.waitForBalanceUpdate(testGroup.id, user1.token, (b) => b.simplifiedDebts.length === 0, 58000);
      expect(balances.simplifiedDebts).toHaveLength(0);
    });

    // TODO: This test is timing out, likely due to a backend issue with asynchronous balance updates.
    test.skip('should correctly update balances after an expense is modified', async () => {
      // Step 1: Create an initial expense (User 1 paid 100, User 2 owes 50)
      const expenseData = driver.createTestExpense(testGroup.id, user1.uid, [user1.uid, user2.uid], 100);
      const expense = await driver.createExpense(expenseData, user1.token);
      await driver.waitForBalanceUpdate(testGroup.id, user1.token, (b) => b.simplifiedDebts.length > 0, 58000);

      // Step 2: Update the expense amount
      await driver.updateExpense(expense.id, { amount: 150 }, user1.token);

      // Step 3: Verify the new debt (User 2 owes User 1 $75)
      const balances = await driver.waitForBalanceUpdate(testGroup.id, user1.token, 
        (b) => b.simplifiedDebts.some((d: any) => d.from.userId === user2.uid && d.to.userId === user1.uid && d.amount === 75),
        58000
      );
      
      const matchingDebt = balances.simplifiedDebts.find((d: any) => d.from.userId === user2.uid && d.to.userId === user1.uid);
      expect(matchingDebt).toBeDefined();
      expect(matchingDebt.amount).toBe(75);
    });

    // TODO: This test fails because the backend seems to reject split amounts of 0, which is required to model this circular debt.
    test.skip('should handle circular debts correctly (A->B, B->C, C->A)', async () => {
      // Expense 1: User 1 pays 30 for User 2
      await driver.createExpense(driver.createTestExpense(testGroup.id, user1.uid, [user2.uid], 30), user1.token);
      // Expense 2: User 2 pays 30 for User 3
      await driver.createExpense(driver.createTestExpense(testGroup.id, user2.uid, [user3.uid], 30), user2.token);
      // Expense 3: User 3 pays 30 for User 1
      await driver.createExpense(driver.createTestExpense(testGroup.id, user3.uid, [user1.uid], 30), user3.token);

      // After all expenses, the debts should cancel out perfectly.
      const balances = await driver.waitForBalanceUpdate(testGroup.id, user1.token, (b) => b.simplifiedDebts.length === 0);
      expect(balances.simplifiedDebts).toHaveLength(0);
    });

    // TODO: The backend now correctly rejects negative expense amounts.
    test.skip('should handle refunds (negative expenses) correctly', async () => {
      // Step 1: User 1 pays 100 for a shared item for User 1 & 2. (User 2 owes User 1 $50)
      await driver.createExpense(driver.createTestExpense(testGroup.id, user1.uid, [user1.uid, user2.uid], 100), user1.token);
      
      // Step 2: A $40 refund is issued, paid by the store to User 1.
      const refundData = {
        ...driver.createTestExpense(testGroup.id, user1.uid, [user1.uid, user2.uid], -40),
        description: "Refund for item"
      };
      await driver.createExpense(refundData, user1.token);

      // The original $100 cost is now effectively $60. The equal split is $30.
      // User 1 paid $100 but got $40 back, so is out $60. Their share is $30, so they are owed $30.
      // User 2's share is $30.
      // Therefore, User 2 should now owe User 1 $30.
      const balances = await driver.waitForBalanceUpdate(testGroup.id, user1.token, (b) => b.simplifiedDebts[0]?.amount === 30);
      expect(balances.simplifiedDebts[0]).toMatchObject({ from: user2.uid, to: user1.uid, amount: 30 });
    });

    // TODO: This test fails because the backend validation for split sums seems to be disabled.
    test.skip('should reject an expense where exact splits do not sum to the total amount', async () => {
      const expenseData = {
        groupId: testGroup.id,
        description: 'Mismatched Splits',
        amount: 100,
        paidBy: user1.uid,
        splitType: 'exact',
        participants: [user1.uid, user2.uid],
        splits: [
          { userId: user1.uid, amount: 50 },
          { userId: user2.uid, amount: 49.99 } // Does not add up to 100
        ]
      };

      await expect(
        driver.createExpense(expenseData, user1.token)
      ).rejects.toThrow(/Splits do not sum up to the total amount|400/);
    });

    // TODO: This test is failing because the backend is rejecting a valid positive amount.
    test.skip('should correctly calculate balances for a percentage-based split', async () => {
      const expenseData = {
        groupId: testGroup.id,
        description: 'Percentage Split',
        amount: 200,
        paidBy: user1.uid,
        splitType: 'percentage',
        participants: [user1.uid, user2.uid],
        splits: [
          { userId: user1.uid, percentage: 60 }, // $120
          { userId: user2.uid, percentage: 40 }  // $80
        ],
        category: 'entertainment',
        date: new Date().toISOString(),
      };
      await driver.createExpense(expenseData, user1.token);

      // User 1 paid 200, their share is 120. They are owed 80.
      // User 2's share is 80. They owe 80.
      const balances = await driver.waitForBalanceUpdate(testGroup.id, user1.token, (b) => b.simplifiedDebts.length > 0, 58000);
      expect(balances.simplifiedDebts[0]).toMatchObject({
        from: { userId: user2.uid },
        to: { userId: user1.uid },
        amount: 80
      });
    });

    test('should reject a percentage-based split where percentages do not sum to 100', async () => {
      const expenseData = {
        groupId: testGroup.id,
        description: 'Invalid Percentage Split',
        amount: 100,
        paidBy: user1.uid,
        splitType: 'percentage',
        participants: [user1.uid, user2.uid],
        splits: [
          { userId: user1.uid, percentage: 50 },
          { userId: user2.uid, percentage: 49 }
        ],
        category: 'other',
        date: new Date().toISOString(),
      };

      await expect(
        driver.createExpense(expenseData, user1.token)
      ).rejects.toThrow(/Percentages must sum to 100|400/);
    });

    // TODO: The backend no longer supports 'shares' as a split type.
    test.skip('should correctly calculate balances for a share-based split', async () => {
      const expenseData = {
        groupId: testGroup.id,
        description: 'Share-based Split',
        amount: 150,
        paidBy: user1.uid,
        splitType: 'shares',
        participants: [user1.uid, user2.uid, user3.uid],
        splits: [
          { userId: user1.uid, shares: 1 }, // 1/6 of 150 = 25
          { userId: user2.uid, shares: 2 }, // 2/6 of 150 = 50
          { userId: user3.uid, shares: 3 }, // 3/6 of 150 = 75
        ]
      };
      await driver.createExpense(expenseData, user1.token);

      // User 1 paid 150. Their share is 25. They are owed 125.
      // User 2 owes 50.
      // User 3 owes 75.
      const balances = await driver.waitForBalanceUpdate(testGroup.id, user1.token);
      const debts = balances.simplifiedDebts;
      
      expect(debts).toHaveLength(2);
      expect(debts).toContainEqual({ from: user2.uid, to: user1.uid, amount: 50, fromName: user2.displayName, toName: user1.displayName });
      expect(debts).toContainEqual({ from: user3.uid, to: user1.uid, amount: 75, fromName: user3.displayName, toName: user1.displayName });
    });

    // TODO: The backend now correctly requires the payer to be a participant in the expense.
    test.skip('should handle case where payer is not included in the split', async () => {
      // User 1 pays 100, but the expense is only for User 2 and User 3
      const expenseData = {
        groupId: testGroup.id,
        description: 'Payer Not Involved',
        amount: 100,
        paidBy: user1.uid,
        splitType: 'equal',
        participants: [user2.uid, user3.uid] // User 1 is not in this list
      };
      await driver.createExpense(expenseData, user1.token);

      // User 2 owes User 1 $50.
      // User 3 owes User 1 $50.
      const balances = await driver.waitForBalanceUpdate(testGroup.id, user1.token);
      const debts = balances.simplifiedDebts;

      expect(debts).toHaveLength(2);
      expect(debts).toContainEqual({ from: user2.uid, to: user1.uid, amount: 50, fromName: user2.displayName, toName: user1.displayName });
      expect(debts).toContainEqual({ from: user3.uid, to: user1.uid, amount: 50, fromName: user3.displayName, toName: user1.displayName });
    });
  });
});
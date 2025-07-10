/**
 * @jest-environment node
 */

// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

// Using native fetch from Node.js 18+
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Read emulator configuration from firebase.json
const firebaseConfigPath = path.join(__dirname, '../../../firebase.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

const FUNCTIONS_PORT = firebaseConfig.emulators.functions.port;
const FIRESTORE_PORT = firebaseConfig.emulators.firestore.port;
const AUTH_PORT = firebaseConfig.emulators.auth.port;

const API_BASE_URL = `http://localhost:${FUNCTIONS_PORT}/splitifyd/us-central1/api`;
const FIREBASE_API_KEY = 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg'; // Default API key for emulator

// Set emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = `localhost:${FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;

interface User {
  uid: string;
  email: string;
  displayName: string;
  token: string;
}

// Helper function for making API requests
async function apiRequest(endpoint: string, method = 'POST', body: unknown = null, token: string | null = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request to ${endpoint} failed with status ${response.status}: ${errorText}`);
  }
  // Handle cases where the response might be empty
  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : {};
}



// Helper to create a new user and get an auth token
async function createTestUser(userInfo: { email: string; password: string; displayName: string }): Promise<User> {
  try {
    // Register user via API
    await apiRequest('/register', 'POST', {
      email: userInfo.email,
      password: userInfo.password,
      displayName: userInfo.displayName
    });
  } catch (error) {
    // Ignore "already exists" errors
    if (!(error instanceof Error && error.message.includes('EMAIL_EXISTS'))) {
      throw error;
    }
  }

  // Use Firebase Auth REST API to sign in
  const signInResponse = await fetch(
    `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userInfo.email,
        password: userInfo.password,
        returnSecureToken: true
      })
    }
  );

  if (!signInResponse.ok) {
    const error = await signInResponse.json() as { error?: { message?: string } };
    throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
  }

  const authData = await signInResponse.json() as { idToken: string };
  
  // We need the UID. In a real test setup, you might need to use the Admin SDK
  // to get this, but for this test, we'll just decode the token (INSECURE, FOR TESTING ONLY).
  const decodedToken = JSON.parse(Buffer.from(authData.idToken.split('.')[1], 'base64').toString()) as { user_id: string };

  return {
    uid: decodedToken.user_id,
    email: userInfo.email,
    displayName: userInfo.displayName,
    token: authData.idToken
  };
}


describe('Comprehensive API Test Suite', () => {
  let users: User[] = [];
  let group: any = {};
  let expense: any = {};

  // Set a longer timeout for these integration tests
  jest.setTimeout(30000);

  beforeAll(async () => {
    // Create unique users for this test run to avoid collisions
    const userSuffix = uuidv4().slice(0, 8);
    users = await Promise.all([
      createTestUser({ email: `testuser1-${userSuffix}@test.com`, password: 'Password123!', displayName: 'Test User 1' }),
      createTestUser({ email: `testuser2-${userSuffix}@test.com`, password: 'Password123!', displayName: 'Test User 2' }),
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

    const response = await apiRequest('/createDocument', 'POST', { data: groupData }, users[0].token);

    expect(response.id).toBeDefined();
    group = { id: response.id, ...groupData };

    // Verify the group was created
    const fetchedGroup = await apiRequest(`/getDocument?id=${group.id}`, 'GET', null, users[0].token);
    expect(fetchedGroup.data.name).toBe(groupName);
    expect(fetchedGroup.data.members.length).toBe(2);
  });

  test('should add an expense to the group', async () => {
    const expenseData = {
      groupId: group.id,
      description: 'Test Expense',
      amount: 100,
      category: 'other',
      date: new Date().toISOString(),
      paidBy: users[0].uid,
      splitType: 'equal',
      participants: users.map(u => u.uid)
    };

    const response = await apiRequest('/expenses', 'POST', expenseData, users[0].token);
    expect(response.id).toBeDefined();
    expense = { id: response.id, ...expenseData };

    // Verify the expense was created by fetching it
    const fetchedExpense = await apiRequest(`/expenses?id=${expense.id}`, 'GET', null, users[0].token);
    expect(fetchedExpense.description).toBe('Test Expense');
    expect(fetchedExpense.amount).toBe(100);
    expect(fetchedExpense.paidBy).toBe(users[0].uid);
  });

  test('should delete an expense', async () => {
    // First, create an expense to be deleted
    const expenseToDeleteData = {
      groupId: group.id,
      description: 'To be deleted',
      amount: 50,
      paidBy: users[1].uid,
      splitType: 'equal',
      participants: users.map(u => u.uid),
      date: new Date().toISOString(),
      category: 'other',
    };
    const createdExpense = await apiRequest('/expenses', 'POST', expenseToDeleteData, users[1].token);
    expect(createdExpense.id).toBeDefined();

    // Now, delete it
    await apiRequest(`/expenses?id=${createdExpense.id}`, 'DELETE', null, users[1].token);

    // Verify it's gone
    await expect(
      apiRequest(`/expenses?id=${createdExpense.id}`, 'GET', null, users[1].token)
    ).rejects.toThrow();
  });

  test('should calculate group balances correctly', async () => {
    // Get balances for the group
    const balances = await apiRequest(`/groups/balances?groupId=${group.id}`, 'GET', null, users[0].token);
    
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

    const altGroup = await apiRequest('/createDocument', 'POST', { data: altGroupData }, users[0].token);
    
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

    await apiRequest('/expenses', 'POST', altExpenseData, users[1].token);
    
    // Try to get balances - this should work with both member structures
    const altBalances = await apiRequest(`/groups/balances?groupId=${altGroup.id}`, 'GET', null, users[0].token);
    
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
    // Create a third user who is not part of the group
    const outsiderUser = await createTestUser({
      email: `outsider-${uuidv4()}@test.com`,
      password: 'Password123!',
      displayName: 'Outsider User'
    });
    
    // Try to access balances as non-member
    await expect(
      apiRequest(`/groups/balances?groupId=${group.id}`, 'GET', null, outsiderUser.token)
    ).rejects.toThrow(/403|FORBIDDEN/);
  });

  test('should generate shareable link for group (admin only)', async () => {
    // Create a test group if not already created
    if (!group.id) {
      const groupData = {
        name: `Test Group ${uuidv4()}`,
        members: users.map(u => ({ uid: u.uid, name: u.displayName, email: u.email, initials: u.displayName.split(' ').map(n => n[0]).join('') }))
      };
      const response = await apiRequest('/createDocument', 'POST', { data: groupData }, users[0].token);
      group = { id: response.id, ...groupData };
    }
    
    // Admin (creator) should be able to generate a share link
    const shareResponse = await apiRequest('/groups/share', 'POST', { groupId: group.id }, users[0].token);
    
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
    
    const nonAdminGroup = await apiRequest('/createDocument', 'POST', { data: nonAdminGroupData }, users[0].token);
    
    // User[1] should not be able to generate a share link
    await expect(
      apiRequest('/groups/share', 'POST', { groupId: nonAdminGroup.id }, users[1].token)
    ).rejects.toThrow(/403|FORBIDDEN|admin/);
  });

  test('should allow new users to join group via share link', async () => {
    // First, create a new group and generate a share link
    const shareableGroupData = {
      name: `Shareable Group ${uuidv4()}`,
      members: [{ uid: users[0].uid, name: users[0].displayName, email: users[0].email, initials: users[0].displayName.split(' ').map(n => n[0]).join('') }]
    };
    
    const shareableGroup = await apiRequest('/createDocument', 'POST', { data: shareableGroupData }, users[0].token);
    
    // Generate share link
    const shareResponse = await apiRequest('/groups/share', 'POST', { groupId: shareableGroup.id }, users[0].token);
    
    // Create a new user who will join via the link
    const newUser = await createTestUser({
      email: `newuser-${uuidv4()}@test.com`,
      password: 'Password123!',
      displayName: 'New User'
    });
    
    // Join the group using the share token
    const joinResponse = await apiRequest('/groups/join', 'POST', { 
      linkId: shareResponse.linkId
    }, newUser.token);
    
    expect(joinResponse).toHaveProperty('groupId');
    expect(joinResponse.groupId).toBe(shareableGroup.id);
    expect(joinResponse).toHaveProperty('message');
    expect(joinResponse).toHaveProperty('groupName');
    
    // Verify the user was added to the group
    const updatedGroup = await apiRequest(`/getDocument?id=${shareableGroup.id}`, 'GET', null, newUser.token);
    const memberUids = updatedGroup.data.members.map((m: any) => m.uid);
    expect(memberUids).toContain(newUser.uid);
  });

  test('should not allow duplicate joining via share link', async () => {
    // Create a group with a share link
    const dupTestGroupData = {
      name: `Duplicate Test Group ${uuidv4()}`,
      members: [{ uid: users[0].uid, name: users[0].displayName, email: users[0].email, initials: users[0].displayName.split(' ').map(n => n[0]).join('') }]
    };
    
    const dupTestGroup = await apiRequest('/createDocument', 'POST', { data: dupTestGroupData }, users[0].token);
    const shareResponse = await apiRequest('/groups/share', 'POST', { groupId: dupTestGroup.id }, users[0].token);
    
    // Add user[1] to the group via share link
    await apiRequest('/groups/join', 'POST', { 
      linkId: shareResponse.linkId
    }, users[1].token);
    
    // Try to join again with the same user
    await expect(
      apiRequest('/groups/join', 'POST', { 
        linkId: shareResponse.linkId
      }, users[1].token)
    ).rejects.toThrow(/already a member/);
  });

  test('should reject invalid share tokens', async () => {
    const invalidUser = await createTestUser({
      email: `invalid-${uuidv4()}@test.com`,
      password: 'Password123!',
      displayName: 'Invalid User'
    });
    
    // Try to join with an invalid token
    await expect(
      apiRequest('/groups/join', 'POST', { 
        linkId: 'INVALID_TOKEN_12345'
      }, invalidUser.token)
    ).rejects.toThrow(/Invalid.*link|not found/);
  });

  test('should allow multiple users to join group using the same share link', async () => {
    // Create a new group with only one member
    const multiJoinGroupData = {
      name: `Multi-Join Group ${uuidv4()}`,
      members: [{ uid: users[0].uid, name: users[0].displayName, email: users[0].email, initials: users[0].displayName.split(' ').map(n => n[0]).join('') }]
    };
    
    const multiJoinGroup = await apiRequest('/createDocument', 'POST', { data: multiJoinGroupData }, users[0].token);
    
    // Generate a share link
    const shareResponse = await apiRequest('/groups/share', 'POST', { groupId: multiJoinGroup.id }, users[0].token);
    
    // Create multiple new users who will join via the same link
    const newUsers = await Promise.all([
      createTestUser({
        email: `multiuser1-${uuidv4()}@test.com`,
        password: 'Password123!',
        displayName: 'Multi User 1'
      }),
      createTestUser({
        email: `multiuser2-${uuidv4()}@test.com`,
        password: 'Password123!',
        displayName: 'Multi User 2'
      }),
      createTestUser({
        email: `multiuser3-${uuidv4()}@test.com`,
        password: 'Password123!',
        displayName: 'Multi User 3'
      })
    ]);
    
    // All users should be able to join using the same link
    for (const user of newUsers) {
      const joinResponse = await apiRequest('/groups/join', 'POST', { 
        linkId: shareResponse.linkId
      }, user.token);
      
      expect(joinResponse).toHaveProperty('groupId');
      expect(joinResponse.groupId).toBe(multiJoinGroup.id);
      expect(joinResponse).toHaveProperty('message');
    }
    
    // Verify all users were added to the group
    const updatedGroup = await apiRequest(`/getDocument?id=${multiJoinGroup.id}`, 'GET', null, users[0].token);
    const memberUids = updatedGroup.data.members.map((m: any) => m.uid);
    
    // Should have original member + 3 new members = 4 total
    expect(memberUids.length).toBe(4);
    expect(memberUids).toContain(users[0].uid);
    newUsers.forEach(user => {
      expect(memberUids).toContain(user.uid);
    });
  });

  test('should update an expense', async () => {
    const updatedData = {
      description: 'Updated Test Expense',
      amount: 150.50,
      category: 'food'
    };

    // Use PUT for updates, passing the expense ID in the query
    await apiRequest(`/expenses?id=${expense.id}`, 'PUT', updatedData, users[0].token);

    const fetchedExpense = await apiRequest(`/expenses?id=${expense.id}`, 'GET', null, users[0].token);
    
    expect(fetchedExpense.description).toBe(updatedData.description);
    expect(fetchedExpense.amount).toBe(updatedData.amount);
    expect(fetchedExpense.category).toBe(updatedData.category);
  });

  test('should recalculate splits when only amount is updated', async () => {
    // Create a new expense specifically for this test
    const testExpenseData = {
      groupId: group.id,
      description: 'Split Recalculation Test',
      amount: 100,
      category: 'other',
      date: new Date().toISOString(),
      paidBy: users[0].uid,
      splitType: 'equal',
      participants: users.map(u => u.uid)
    };

    const createResponse = await apiRequest('/expenses', 'POST', testExpenseData, users[0].token);
    expect(createResponse.id).toBeDefined();

    // Fetch the created expense to verify initial splits
    const initialExpense = await apiRequest(`/expenses?id=${createResponse.id}`, 'GET', null, users[0].token);
    expect(initialExpense.amount).toBe(100);
    expect(initialExpense.splits).toHaveLength(2);
    expect(initialExpense.splits[0].amount).toBe(50);
    expect(initialExpense.splits[1].amount).toBe(50);

    // Update only the amount
    const updatedData = {
      amount: 150.50
    };

    await apiRequest(`/expenses?id=${createResponse.id}`, 'PUT', updatedData, users[0].token);

    // Fetch the updated expense to verify splits were recalculated
    const updatedExpense = await apiRequest(`/expenses?id=${createResponse.id}`, 'GET', null, users[0].token);
    
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
      groupId: group.id,
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

    const createResponse = await apiRequest('/expenses', 'POST', testExpenseData, users[0].token);
    expect(createResponse.id).toBeDefined();

    // Fetch the created expense to verify initial splits
    const initialExpense = await apiRequest(`/expenses?id=${createResponse.id}`, 'GET', null, users[0].token);
    expect(initialExpense.amount).toBe(100);
    expect(initialExpense.splits).toHaveLength(2);
    expect(initialExpense.splits.find((s: any) => s.userId === users[0].uid).amount).toBe(60);
    expect(initialExpense.splits.find((s: any) => s.userId === users[1].uid).amount).toBe(40);

    // Update only the amount - should revert to equal splits since no new splits provided
    const updatedData = {
      amount: 150
    };

    await apiRequest(`/expenses?id=${createResponse.id}`, 'PUT', updatedData, users[0].token);

    // Fetch the updated expense to verify splits were recalculated to equal
    const updatedExpense = await apiRequest(`/expenses?id=${createResponse.id}`, 'GET', null, users[0].token);
    
    expect(updatedExpense.amount).toBe(150);
    expect(updatedExpense.splits).toHaveLength(2);
    expect(updatedExpense.splits[0].amount).toBe(75);
    expect(updatedExpense.splits[1].amount).toBe(75);
    
    // Verify that the total of splits equals the new amount
    const totalSplits = updatedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
    expect(totalSplits).toBe(150);
  });


  test('should add an expense with an unequal split', async () => {
    const expenseData = {
      groupId: group.id,
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

    const response = await apiRequest('/expenses', 'POST', expenseData, users[0].token);
    expect(response.id).toBeDefined();

    // After this expense, user 0 has paid 100 but their share is 80. User 1 owes them 20.
    // Let's check the new balance state
    const balances = await apiRequest(`/groups/balances?groupId=${group.id}`, 'GET', null, users[0].token);
    // Note: This balance check includes ALL previous expenses from the test suite.
    // The cumulative balance will be calculated from all expenses added so far.
    expect(balances.userBalances[users[0].uid].owedBy[users[1].uid]).toBe(50);
    expect(balances.userBalances[users[1].uid].owes[users[0].uid]).toBe(50);
  });



  test("should list all of a group's expenses", async () => {
    const response = await apiRequest(`/expenses/group?groupId=${group.id}`, 'GET', null, users[0].token);
    expect(response).toHaveProperty('expenses');
    expect(Array.isArray(response.expenses)).toBe(true);
    // We have added multiple expenses to this group
    expect(response.expenses.length).toBeGreaterThanOrEqual(2);
    const expenseDescriptions = response.expenses.map((e: any) => e.description);
    expect(expenseDescriptions).toContain('Updated Test Expense');
    expect(expenseDescriptions).toContain('Unequal Split Expense');
  });


  test('should return proper CORS headers', async () => {
    const testOrigin = 'http://localhost:3000';
    const url = `${API_BASE_URL}/health`;
    
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
    const url = `${API_BASE_URL}/health`;
    const response = await fetch(url);
    
    expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
    expect(response.headers.get('X-Frame-Options')).toBeTruthy();
    expect(response.headers.get('X-XSS-Protection')).toBeTruthy();
  });
});
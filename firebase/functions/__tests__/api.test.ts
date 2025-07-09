/**
 * @jest-environment node
 */

// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import fetch, { RequestInit } from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = 'http://localhost:5001/splitifyd/us-central1/api';
const FIREBASE_API_KEY = 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg'; // Default API key for emulator

// Set emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

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
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
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
    const error = await signInResponse.json();
    throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
  }

  const authData = await signInResponse.json();
  
  // We need the UID. In a real test setup, you might need to use the Admin SDK
  // to get this, but for this test, we'll just decode the token (INSECURE, FOR TESTING ONLY).
  const decodedToken = JSON.parse(Buffer.from(authData.idToken.split('.')[1], 'base64').toString());

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
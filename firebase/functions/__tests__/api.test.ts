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


// Helper to exchange a custom token for an ID token
async function exchangeCustomTokenForIdToken(customToken: string): Promise<string> {
  const url = `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to exchange custom token');
  }
  return data.idToken;
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

  // Login to get custom token
  const loginResponse = await apiRequest('/login', 'POST', {
    email: userInfo.email,
    password: userInfo.password
  });

  // Exchange custom token for ID token
  const idToken = await exchangeCustomTokenForIdToken(loginResponse.customToken);

  // We need the UID. In a real test setup, you might need to use the Admin SDK
  // to get this, but for this test, we'll just decode the token (INSECURE, FOR TESTING ONLY).
  const decodedToken = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());

  return {
    uid: decodedToken.user_id,
    email: userInfo.email,
    displayName: userInfo.displayName,
    token: idToken
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
});